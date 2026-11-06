'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { 
  Athlete, 
  WorkoutBlock, 
  WorkoutSet, 
  WorkoutItem, 
  WorkoutSegment, 
  Group, 
  Workout,
  Material,
  Stroke,
  WorkType,
  Zone
} from '@/lib/types';
import { 
  useFirebase, 
  useCollection, 
  useMemoFirebase, 
  updateDocumentNonBlocking 
} from '@/firebase';
import { collection, Timestamp, doc, addDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  PlusCircle, 
  Trash2, 
  Save, 
  Layers, 
  FolderPlus,
  Info,
  Clock,
  Navigation
} from 'lucide-react';
import { ZONES_CONFIG, formatPace, calculateBlockVolume, calculateBlockDuration, flattenWorkoutStats } from '@/lib/swim-utils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import WorkoutSetRow from './WorkoutSetRow';

interface WorkoutPlannerProps {
    selectedDate: Date;
    workoutData: Workout | null;
    isCycleMode?: boolean;
    onSaved?: () => void;
    groupFilterOverride?: Group;
}

export default function WorkoutPlanner({ selectedDate, workoutData, isCycleMode = false, onSaved, groupFilterOverride }: WorkoutPlannerProps) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();

    const [workoutTitle, setWorkoutTitle] = useState("");
    const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
    const [groupFilter, setGroupFilter] = useState<'all' | Group>(groupFilterOverride || 'all');

    useEffect(() => {
        setWorkoutTitle(workoutData?.title || `Séance du ${format(selectedDate, 'dd MMMM yyyy', {locale: fr})}`);
        setBlocks(workoutData?.blocks || [
          { id: 'root-1', title: 'Échauffement', reps: 1, items: [] },
          { id: 'root-2', title: 'Corps de séance', reps: 1, items: [] },
          { id: 'root-3', title: 'Récupération', reps: 1, items: [] }
        ]);
        if (workoutData?.group) setGroupFilter(workoutData.group);
    }, [selectedDate, workoutData]);

    const athletesCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'users', user.uid, 'athletes');
    }, [firestore, user]);

    const { data: allAthletes } = useCollection<Athlete>(athletesCollection);

    const squadPaces = useMemo(() => {
      const swimmers = allAthletes?.filter(a => (groupFilter === 'all' || a.group === groupFilter) && a.cssPace) || [];
      if (swimmers.length === 0) return null;
      const avgCss = swimmers.reduce((acc, s) => acc + s.cssPace!, 0) / swimmers.length;
      return Object.keys(ZONES_CONFIG).reduce((acc, key) => {
        const config = ZONES_CONFIG[key as keyof typeof ZONES_CONFIG];
        acc[key] = { p100: avgCss / ((config.minPct + (isFinite(config.maxPct) ? config.maxPct : config.minPct * 1.1)) / 2) };
        return acc;
      }, {} as Record<string, { p100: number }>);
    }, [allAthletes, groupFilter]);

    const stats = useMemo(() => {
      const volume = blocks.reduce((acc, b) => acc + calculateBlockVolume(b), 0);
      const duration = blocks.reduce((acc, b) => acc + calculateBlockDuration(b, squadPaces), 0);
      return { volume, duration };
    }, [blocks, squadPaces]);

    // --- Tree Mutations ---

    const addRootBlock = () => {
      const newBlock: WorkoutBlock = { 
        id: `root-${Date.now()}`, 
        title: 'Nouvelle Partie', 
        reps: 1, 
        items: [] 
      };
      setBlocks([...blocks, newBlock]);
    };

    const addSetToBlock = (blockId: string) => {
      const newSet: WorkoutSet = {
        id: `set-${Date.now()}`,
        reps: 1,
        rest: 15,
        segments: [{ id: `seg-${Date.now()}`, distance: 100, stroke: 'CRAWL', workType: 'FULL', zone: 'z2', material: [], rest: 0 }]
      };
      
      const updateItems = (items: WorkoutItem[]): WorkoutItem[] => {
        return items.map(item => {
          if (item.kind === 'block') {
            if (item.data.id === blockId) {
              return { ...item, data: { ...item.data, items: [...(item.data.items || []), { kind: 'set', data: newSet }] } };
            }
            return { ...item, data: { ...item.data, items: updateItems(item.data.items || []) } };
          }
          return item;
        });
      };
      
      if (blocks.some(b => b.id === blockId)) {
        setBlocks(blocks.map(b => b.id === blockId ? { ...b, items: [...(b.items || []), { kind: 'set', data: newSet }] } : b));
      } else {
        setBlocks(prev => updateItems(prev.map(b => ({ kind: 'block', data: b } as WorkoutItem))).map(i => (i as any).data));
      }
    };

    const addSubBlockToBlock = (blockId: string) => {
      const newBlock: WorkoutBlock = { id: `block-${Date.now()}`, title: 'Nouveau Sous-Bloc', reps: 1, items: [] };
      const updateItems = (items: WorkoutItem[]): WorkoutItem[] => {
        return items.map(item => {
          if (item.kind === 'block') {
            if (item.data.id === blockId) {
              return { ...item, data: { ...item.data, items: [...(item.data.items || []), { kind: 'block', data: newBlock }] } };
            }
            return { ...item, data: { ...item.data, items: updateItems(item.data.items || []) } };
          }
          return item;
        });
      };
      if (blocks.some(b => b.id === blockId)) {
        setBlocks(blocks.map(b => b.id === blockId ? { ...b, items: [...(b.items || []), { kind: 'block', data: newBlock }] } : b));
      } else {
        setBlocks(prev => updateItems(prev.map(b => ({ kind: 'block', data: b } as WorkoutItem))).map(i => (i as any).data));
      }
    };

    const deleteItem = (itemId: string) => {
      const filterItems = (items: WorkoutItem[]): WorkoutItem[] => {
        return items.filter(item => {
          if (item.kind === 'set' && item.data.id === itemId) return false;
          if (item.kind === 'block' && item.data.id === itemId) return false;
          return true;
        }).map(item => {
          if (item.kind === 'block') return { ...item, data: { ...item.data, items: filterItems(item.data.items || []) } };
          return item;
        });
      };
      setBlocks(prev => filterItems(prev.map(b => ({ kind: 'block', data: b } as WorkoutItem))).map(i => (i as any).data));
    };

    const updateSet = (setId: string, newData: Partial<WorkoutSet>) => {
      const mapItems = (items: WorkoutItem[]): WorkoutItem[] => {
        return items.map(item => {
          if (item.kind === 'set' && item.data.id === setId) return { ...item, data: { ...item.data, ...newData } };
          if (item.kind === 'block') return { ...item, data: { ...item.data, items: mapItems(item.data.items || []) } };
          return item;
        });
      };
      setBlocks(prev => mapItems(prev.map(b => ({ kind: 'block', data: b } as WorkoutItem))).map(i => (i as any).data));
    };

    const updateBlock = (blockId: string, newData: Partial<WorkoutBlock>) => {
      const mapItems = (items: WorkoutItem[]): WorkoutItem[] => {
        return items.map(item => {
          if (item.kind === 'block') {
            if (item.data.id === blockId) return { ...item, data: { ...item.data, ...newData } };
            return { ...item, data: { ...item.data, items: mapItems(item.data.items || []) } };
          }
          return item;
        });
      };
      if (blocks.some(b => b.id === blockId)) {
        setBlocks(blocks.map(b => b.id === blockId ? { ...b, ...newData } : b));
      } else {
        setBlocks(prev => mapItems(prev.map(b => ({ kind: 'block', data: b } as WorkoutItem))).map(i => (i as any).data));
      }
    };

    const handleSave = async () => {
      if (!firestore || !user) return;
      const finalStats = flattenWorkoutStats(blocks);
      const payload: Omit<Workout, 'id'> = {
        ownerId: user.uid,
        title: workoutTitle,
        date: Timestamp.fromDate(selectedDate),
        blocks,
        group: groupFilter,
        isCycleSession: isCycleMode,
        summary: {
          ...finalStats,
          totalDuration: stats.duration
        }
      };

      if (workoutData?.id) {
        updateDocumentNonBlocking(doc(firestore, 'users', user.uid, 'workouts', workoutData.id), payload);
      } else {
        await addDoc(collection(firestore, 'users', user.uid, 'workouts'), payload);
      }
      toast({ title: "Séance enregistrée !" });
      if (onSaved) onSaved();
    };

    // --- Rendering ---

    const renderItem = (item: WorkoutItem, depth: number) => {
      if (item.kind === 'set') {
        return (
          <WorkoutSetRow 
            key={item.data.id} 
            set={item.data} 
            onUpdate={(newData) => updateSet(item.data.id, newData)}
            onDelete={() => deleteItem(item.data.id)}
            squadPaces={squadPaces}
          />
        );
      }
      return renderBlock(item.data, depth + 1);
    };

    const renderBlock = (block: WorkoutBlock, depth = 0) => (
      <div key={block.id} className={cn(
        "space-y-4 rounded-xl transition-all",
        depth > 0 ? "border-l-4 border-slate-200 pl-6 py-4 bg-slate-50/30" : "bg-white border p-6 shadow-sm mb-6"
      )}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-grow">
            <div className="bg-slate-900 text-white text-[10px] font-black h-6 w-6 flex items-center justify-center rounded-md shrink-0">
              {depth === 0 ? "B" : "S"}
            </div>
            <Input 
              value={block.title} 
              onChange={e => updateBlock(block.id, { title: e.target.value })}
              className={cn(
                "font-black uppercase tracking-tight border-none bg-transparent shadow-none p-0 focus-visible:ring-0", 
                depth === 0 ? "text-xl text-slate-900" : "text-lg text-slate-600"
              )}
              placeholder="Nom de la partie..."
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border">
              <span className="text-[10px] font-black text-slate-400 uppercase">Multiplier</span>
              <Input 
                type="number" 
                value={block.reps} 
                onChange={e => updateBlock(block.id, { reps: parseInt(e.target.value) || 1 })}
                className="w-12 h-7 text-center font-black bg-white border-slate-200"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteItem(block.id)} className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {block.items?.map(item => renderItem(item, depth))}
        </div>

        <div className="flex gap-2 pt-2 border-t border-dashed mt-4">
          <Button variant="outline" size="sm" onClick={() => addSetToBlock(block.id)} className="text-[10px] font-black uppercase h-8 bg-white hover:bg-primary hover:text-white transition-all">
            <PlusCircle className="mr-2 h-3.5 w-3.5" /> Ajouter une Série
          </Button>
          <Button variant="outline" size="sm" onClick={() => addSubBlockToBlock(block.id)} className="text-[10px] font-black uppercase h-8 bg-white hover:bg-indigo-600 hover:text-white transition-all">
            <FolderPlus className="mr-2 h-3.5 w-3.5" /> Ajouter un Sous-Bloc
          </Button>
        </div>
      </div>
    );

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-24">
            <div className="flex flex-wrap justify-between items-center gap-6 bg-slate-900 text-white p-8 rounded-2xl shadow-2xl border-b-4 border-primary">
                <div className="flex-grow min-w-[300px] space-y-2">
                    <Input 
                        value={workoutTitle} 
                        onChange={e => setWorkoutTitle(e.target.value)}
                        className="bg-transparent border-none text-4xl font-black p-0 h-auto focus-visible:ring-0 placeholder:text-white/10 uppercase tracking-tighter"
                        placeholder="Titre de la séance..."
                    />
                    <div className="flex items-center gap-4 text-white/40 font-black uppercase tracking-widest text-[10px]">
                      <span className="bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/20">Groupe {groupFilter}</span>
                      <span className="flex items-center gap-1.5"><Navigation className="w-3 h-3" /> {format(selectedDate, 'eeee dd MMMM', {locale: fr})}</span>
                    </div>
                </div>
                <div className="flex items-center gap-10">
                    <div className="text-right">
                        <div className="text-[10px] uppercase font-black text-white/30 flex items-center justify-end gap-1"><Info className="w-3 h-3" /> Volume</div>
                        <div className="text-4xl font-black text-primary">{(stats.volume / 1000).toFixed(2)} <span className="text-sm font-bold text-white/20">km</span></div>
                    </div>
                    <div className="h-12 w-px bg-white/10" />
                    <div className="text-right">
                        <div className="text-[10px] uppercase font-black text-white/30 flex items-center justify-end gap-1"><Clock className="w-3 h-3" /> Durée</div>
                        <div className="text-4xl font-black text-primary">{Math.round(stats.duration / 60)} <span className="text-sm font-bold text-white/20">min</span></div>
                    </div>
                    <Button size="lg" onClick={handleSave} className="h-16 px-10 font-black uppercase tracking-widest shadow-xl bg-primary hover:bg-primary/90 text-white border-b-4 border-primary-foreground/20">
                        <Save className="mr-3" /> Enregistrer
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
              {blocks.map(b => renderBlock(b))}
            </div>

            <div className="flex justify-center pt-4">
                <Button 
                    variant="outline" 
                    onClick={addRootBlock}
                    className="border-2 border-dashed border-slate-200 h-16 w-full text-slate-400 hover:text-primary hover:border-primary hover:bg-primary/5 font-black uppercase tracking-widest transition-all rounded-2xl"
                >
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Ajouter une nouvelle partie (Échauffement, Corps...)
                </Button>
            </div>
        </div>
    );
}
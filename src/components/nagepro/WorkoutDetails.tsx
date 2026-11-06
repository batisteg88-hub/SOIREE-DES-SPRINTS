'use client';

import type { Workout, WorkoutBlock, WorkoutItem, WorkoutSegment, Athlete } from '@/lib/types';
import { 
  ZONES_CONFIG, 
  STROKE_LABELS, 
  MATERIAL_LABELS, 
  WORK_TYPE_LABELS, 
  formatPace
} from '@/lib/swim-utils';
import { format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Layers, Clock, Info, Tag, Timer, Navigation, MousePointer2, Users, UserX, UserCheck, ChevronRight, CheckCircle2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface WorkoutDetailsProps {
    workout: Workout;
    viewMode: 'preview' | 'live';
    athletes?: Athlete[];
    onComplete?: () => void;
}

export default function WorkoutDetails({ workout, athletes = [], onComplete }: WorkoutDetailsProps) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [paceRef, setPaceRef] = useState<100 | 200 | 400>(100);
    const [absentIds, setAbsentIds] = useState<string[]>(workout.absentSwimmerIds || []);
    const [isFinishing, setIsFinishing] = useState(false);

    const togglePresence = (id: string) => {
        setAbsentIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const groupDefaultCss = useMemo(() => {
        const fallbacks: Record<string, number> = {
            'NV1': 150, 'NV1+': 135, 'NV2': 120, 'N3': 105, 'N4': 90, 'N1': 75
        };
        const validSwimmers = athletes.filter(s => s.cssPace && isFinite(s.cssPace));
        if (validSwimmers.length > 0) {
            return validSwimmers.reduce((acc, s) => acc + s.cssPace!, 0) / validSwimmers.length;
        }
        return fallbacks[workout.group as string] || 100;
    }, [athletes, workout.group]);

    const laneDistribution = useMemo(() => {
        const presentSwimmers = athletes
            .filter(a => !absentIds.includes(a.id!))
            .sort((a, b) => (a.cssPace ?? Infinity) - (b.cssPace ?? Infinity));
        
        const maxLanes = 3;
        const lanes = Array.from({ length: maxLanes }, () => [] as Athlete[]);
        
        if (presentSwimmers.length === 0) return lanes;

        presentSwimmers.forEach((s, i) => {
            const laneIdx = Math.floor(i * maxLanes / presentSwimmers.length);
            lanes[Math.min(laneIdx, 2)].push(s);
        });

        return lanes;
    }, [athletes, absentIds]);

    const lanePaces = useMemo(() => {
        return laneDistribution.map((lane, idx) => {
            const swimmersWithPace = lane.filter(s => s.cssPace && isFinite(s.cssPace));
            let laneAvgCss = groupDefaultCss;
            
            if (swimmersWithPace.length > 0) {
                laneAvgCss = swimmersWithPace.reduce((acc, s) => acc + s.cssPace!, 0) / swimmersWithPace.length;
            } else {
                if (idx === 0) laneAvgCss = groupDefaultCss * 0.9;
                if (idx === 2) laneAvgCss = groupDefaultCss * 1.1;
            }

            return Object.keys(ZONES_CONFIG).reduce((acc, key) => {
                const config = ZONES_CONFIG[key as keyof typeof ZONES_CONFIG];
                const representativePct = (config.minPct + (isFinite(config.maxPct) ? config.maxPct : config.minPct * 1.1)) / 2;
                acc[key] = { p100: laneAvgCss / representativePct };
                return acc;
            }, {} as Record<string, { p100: number }>);
        });
    }, [laneDistribution, groupDefaultCss]);

    const handleFinishWorkout = async () => {
        if (!firestore || !user || !workout.id) return;
        setIsFinishing(true);
        try {
            const workoutRef = doc(firestore, 'users', user.uid, 'workouts', workout.id);
            const now = new Date();
            const completionDay = startOfDay(now);

            // 1. Update Workout status
            updateDocumentNonBlocking(workoutRef, {
                isCompleted: true,
                completedAt: Timestamp.fromDate(now),
                absentSwimmerIds: absentIds
            });

            // 2. Sync Attendance for this group
            const attendanceCol = collection(firestore, 'users', user.uid, 'attendances');
            const nextDay = new Date(completionDay);
            nextDay.setDate(nextDay.getDate() + 1);

            const q = query(
                attendanceCol, 
                where('date', '>=', Timestamp.fromDate(completionDay)),
                where('date', '<', Timestamp.fromDate(nextDay))
            );
            
            const snapshot = await getDocs(q);
            const groupPresences: Record<string, 'present' | 'absent'> = {};
            athletes.forEach(a => {
                if (a.id) {
                    groupPresences[a.id] = absentIds.includes(a.id) ? 'absent' : 'present';
                }
            });

            if (!snapshot.empty) {
                const attendDoc = snapshot.docs[0];
                const existingPresences = attendDoc.data().presences || {};
                updateDocumentNonBlocking(doc(attendanceCol, attendDoc.id), {
                    presences: { ...existingPresences, ...groupPresences }
                });
            } else {
                addDocumentNonBlocking(attendanceCol, {
                    ownerId: user.uid,
                    date: Timestamp.fromDate(completionDay),
                    presences: groupPresences
                });
            }

            toast({
                title: "Séance terminée !",
                description: "Les statistiques de volume et de présence ont été enregistrées.",
            });

            if (onComplete) onComplete();
        } catch (err) {
            toast({ variant: "destructive", title: "Erreur lors de la validation" });
        } finally {
            setIsFinishing(false);
        }
    };

    const renderSegment = (seg: WorkoutSegment, setRest: number = 0) => (
      <div key={seg.id} className="flex flex-col bg-slate-50 border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:border-primary/20 transition-colors">
        <div className={cn(
            "p-6 flex items-center justify-between border-b-2",
            ZONES_CONFIG[seg.zone].bg,
            ZONES_CONFIG[seg.zone].color
        )}>
            <div className="flex items-center gap-6">
                <span className="text-5xl font-black">{seg.distance}m</span>
                <div className="flex flex-col">
                    <span className="text-sm font-black uppercase opacity-70 tracking-widest">{ZONES_CONFIG[seg.zone].label}</span>
                    <span className="text-xl font-black uppercase">{STROKE_LABELS[seg.stroke]} • {WORK_TYPE_LABELS[seg.workType]}</span>
                </div>
            </div>
            {seg.material.length > 0 && (
                <div className="flex gap-2">
                    {seg.material.map(m => (
                        <Badge key={m} variant="secondary" className="bg-white/80 text-[11px] font-black uppercase border border-current/10 px-3 h-7">
                            {MATERIAL_LABELS[m]}
                        </Badge>
                    ))}
                </div>
            )}
        </div>

        <div className="p-0">
            <div className="grid grid-cols-3 divide-x-2 divide-slate-100 bg-white">
                {lanePaces.map((lane, lIdx) => {
                    const p100 = lane[seg.zone].p100;
                    const swimTime = (seg.distance / 100) * p100;
                    const depTime = swimTime + (seg.rest || setRest || 0);
                    const splitTime = (paceRef / 100) * p100;

                    return (
                        <div key={lIdx} className="p-6 flex flex-col items-center group hover:bg-slate-50/50 transition-colors">
                            <div className="text-[11px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2">
                                <div className="w-5 h-5 bg-slate-900 text-white rounded flex items-center justify-center text-[10px]">L{lIdx+1}</div>
                                Ligne {lIdx + 1}
                            </div>
                            <div className="grid grid-cols-1 gap-4 w-full text-center">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Temps de Nage</div>
                                    <div className="text-4xl font-black font-mono text-primary leading-none tabular-nums">{formatPace(swimTime)}</div>
                                </div>
                                <div className="pt-4 border-t-2 border-dashed border-slate-50 space-y-1">
                                    <div className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">Intervalle Départ</div>
                                    <div className="text-3xl font-black font-mono text-emerald-600 leading-none tabular-nums">{formatPace(depTime)}</div>
                                </div>
                                <div className="text-xs font-black text-slate-300 italic pt-2">
                                    Pace /{paceRef}m: {formatPace(splitTime)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    );

    const renderItem = (item: WorkoutItem, depth: number) => {
      if (item.kind === 'set') {
        const isSequence = item.data.reps === 1 && (item.data.repetitionSize || 0) > 0;
        return (
          <div key={item.data.id} className="flex gap-8 items-start py-10 border-b-2 border-slate-50 last:border-0 group/item">
            {!isSequence && item.data.reps > 1 ? (
                <div className="flex flex-col items-center justify-center min-w-[100px] h-32 bg-slate-900 text-white rounded-[2rem] shadow-xl border-b-[6px] border-primary shrink-0 scale-110">
                    <span className="text-5xl font-black leading-none">{item.data.reps}</span>
                    <span className="text-[11px] font-black uppercase tracking-widest mt-2 opacity-50">Fois</span>
                </div>
            ) : (
                <div className="w-24 shrink-0 flex justify-center pt-4">
                    <ChevronRight className="w-10 h-10 text-slate-200" />
                </div>
            )}
            
            <div className="flex-grow space-y-6">
                <div className="flex flex-col gap-6">
                    {item.data.segments.map(seg => renderSegment(seg, isSequence ? 0 : item.data.rest))}
                </div>
                
                {item.data.notes && (
                    <div className="flex items-center gap-4 p-6 bg-amber-50 border-l-[6px] border-amber-400 text-amber-900 text-lg font-bold rounded-r-3xl shadow-sm">
                        <Info className="w-7 h-7 shrink-0 text-amber-500" />
                        <span>Note : {item.data.notes}</span>
                    </div>
                )}
            </div>

            {!isSequence && item.data.rest > 0 && (
                <div className="flex flex-col items-center justify-center min-w-[120px] h-32 bg-white border-2 border-slate-200 rounded-[2rem] shadow-sm shrink-0 mt-2">
                    <span className="text-4xl font-black text-slate-800 leading-none">{item.data.rest}s</span>
                    <span className="text-[11px] font-black uppercase tracking-widest mt-2 text-slate-400">Repos</span>
                </div>
            )}
          </div>
        );
      }
      return renderBlock(item.data, depth + 1);
    };

    const renderBlock = (block: WorkoutBlock, depth = 0) => (
      <div key={block.id} className={cn(
        "rounded-[3rem] transition-all",
        depth > 0 
          ? "mt-10 border-l-[6px] border-slate-100 pl-12" 
          : "bg-white border-2 border-slate-200 p-12 shadow-2xl mb-16"
      )}>
        <div className="flex items-center justify-between mb-12 pb-6 border-b-4 border-slate-50">
          <div className="flex items-center gap-6">
            <div className={cn(
              "flex items-center justify-center rounded-2xl font-black text-white shadow-lg",
              depth === 0 ? "h-16 w-16 bg-slate-900 text-2xl" : "h-12 w-12 bg-slate-400 text-xl"
            )}>
              {block.reps}x
            </div>
            <h3 className={cn(
              "font-black uppercase tracking-tight", 
              depth === 0 ? "text-5xl text-slate-900" : "text-3xl text-slate-600"
            )}>
              {block.title}
            </h3>
          </div>
        </div>
        <div className="space-y-4">
          {block.items?.map(item => renderItem(item, depth))}
        </div>
      </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in zoom-in-95 duration-500 pb-48">
            {/* EN-TÊTE GÉANT */}
            <div className="bg-slate-900 text-white p-12 rounded-[4rem] shadow-2xl border-b-[16px] border-primary flex flex-col gap-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[120px] pointer-events-none" />
                
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10 relative z-10">
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center gap-4">
                          <Badge className="bg-primary hover:bg-primary font-black uppercase text-[12px] tracking-widest px-6 h-9 rounded-xl shadow-lg">Mode Coaching Pro</Badge>
                          <Badge variant="outline" className="text-white/60 border-white/20 font-black uppercase text-[12px] px-6 h-9 rounded-xl">Groupe {workout.group || 'N/A'}</Badge>
                          {workout.isCompleted && (
                              <Badge className="bg-emerald-500 hover:bg-emerald-500 font-black uppercase text-[12px] tracking-widest px-6 h-9 rounded-xl flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4" /> Séance Validée
                              </Badge>
                          )}
                        </div>
                        <h1 className="text-7xl font-black uppercase tracking-tighter leading-none">{workout.title}</h1>
                        <div className="flex flex-wrap items-center gap-8 text-white/40 font-black uppercase tracking-widest text-xs">
                          <p className="flex items-center gap-3">
                            <Clock className="w-6 h-6 text-primary" />
                            {format(workout.date.toDate(), 'eeee dd MMMM yyyy', { locale: fr })}
                          </p>
                          <button 
                            onClick={() => setPaceRef(p => p === 100 ? 200 : p === 200 ? 400 : 100)}
                            className="flex items-center gap-3 bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-xl border border-white/10 transition-all text-white active:scale-95 shadow-inner"
                          >
                            <MousePointer2 className="w-5 h-5 text-sky-400" />
                            Passages: /{paceRef}m
                          </button>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-12 bg-white/5 p-10 rounded-[3rem] border border-white/10 backdrop-blur-xl shadow-2xl relative z-10 w-full xl:w-auto">
                        <div className="text-right">
                            <div className="text-[12px] font-black text-white/30 uppercase tracking-widest mb-3">Volume Global</div>
                            <div className="text-6xl font-black text-primary leading-none">
                              {((workout.summary?.totalDistance || 0) / 1000).toFixed(2)} 
                              <span className="text-2xl opacity-20 ml-2">km</span>
                            </div>
                        </div>
                        <div className="h-20 w-px bg-white/10" />
                        <div className="text-right">
                            <div className="text-[12px] font-black text-white/30 uppercase tracking-widest mb-3">Temps de Nage</div>
                            <div className="text-6xl font-black text-primary leading-none">
                              {Math.round((workout.summary?.totalDuration || 0) / 60)} 
                              <span className="text-2xl opacity-20 ml-2">min</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* LIGNES D'EAU & ÉMARGEMENT */}
            <div className="bg-white border-2 border-slate-200 rounded-[3.5rem] p-12 shadow-2xl">
                <div className="flex items-center justify-between mb-10 border-b-2 pb-6">
                    <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-4 text-slate-800">
                        <Users className="w-10 h-10 text-primary" />
                        Configuration des Lignes d'Eau
                    </h2>
                    <Badge variant="secondary" className="font-black text-lg px-6 h-10 bg-slate-100 text-slate-600 rounded-xl">
                        {athletes.length - absentIds.length} Nageurs présents
                    </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {laneDistribution.map((lane, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-[2.5rem] p-8 border-2 border-slate-100 flex flex-col h-full hover:border-primary/30 hover:bg-white transition-all shadow-sm">
                            <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-slate-900 text-white text-[12px] font-black h-8 w-8 flex items-center justify-center rounded-xl">L{idx+1}</div>
                                    <span className="font-black text-slate-700 uppercase text-lg">Ligne {idx+1}</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{lane.length} actifs</span>
                            </div>
                            <div className="space-y-3 flex-grow">
                                {lane.length > 0 ? lane.map(s => (
                                    <div key={s.id} className="flex items-center justify-between group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-3 h-3 rounded-full shadow-sm", s.gender === 'F' ? "bg-pink-400" : "bg-primary")} />
                                            <span className="text-sm font-black text-slate-700 uppercase tracking-tight">{s.name}</span>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-slate-300 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                            onClick={() => togglePresence(s.id!)}
                                            title="Marquer absent pour cette séance"
                                        >
                                            <UserX className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )) : (
                                    <div className="text-sm text-slate-400 italic text-center py-10 border-2 border-dashed border-slate-200 rounded-3xl">Ligne vide</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {absentIds.length > 0 && (
                    <div className="mt-12 pt-8 border-t-2 border-dashed border-slate-100">
                        <h3 className="text-[12px] font-black text-slate-400 uppercase mb-6 tracking-[0.2em] flex items-center gap-2">
                            <UserX className="w-4 h-4" /> Absents (Cliquez pour restaurer)
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {athletes.filter(a => absentIds.includes(a.id!)).map(s => (
                                <button 
                                    key={s.id} 
                                    onClick={() => togglePresence(s.id!)}
                                    className="flex items-center gap-3 bg-red-50 border-2 border-red-100 px-5 py-3 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 transition-all group shadow-sm active:scale-95"
                                >
                                    <UserCheck className="w-5 h-5 text-red-300 group-hover:text-emerald-400" />
                                    <span className="text-sm font-black text-red-600 uppercase line-through group-hover:no-underline group-hover:text-emerald-700">{s.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* CONTENU PÉDAGOGIQUE */}
            <div className="space-y-8">
              {workout.blocks?.map(b => renderBlock(b))}
            </div>

            {/* BARRE D'ACTIONS FLOTTANTE */}
            {!workout.isCompleted && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500">
                    <Button 
                        size="lg" 
                        onClick={handleFinishWorkout}
                        disabled={isFinishing}
                        className="h-20 px-12 rounded-[2.5rem] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-[0.2em] text-xl shadow-[0_20px_50px_rgba(16,185,129,0.4)] border-b-8 border-emerald-800 transition-all active:translate-y-1 active:border-b-0"
                    >
                        {isFinishing ? (
                            <span className="flex items-center gap-3"><Clock className="animate-spin" /> Enregistrement...</span>
                        ) : (
                            <span className="flex items-center gap-4"><CheckCircle2 className="w-8 h-8" /> Terminer la Séance</span>
                        )}
                    </Button>
                </div>
            )}

            {workout.isCompleted && (
                <div className="bg-emerald-50 border-4 border-emerald-200 p-10 rounded-[3rem] text-center space-y-4">
                    <Trophy className="w-16 h-16 text-emerald-500 mx-auto" />
                    <h2 className="text-3xl font-black text-emerald-800 uppercase">Entraînement Terminé !</h2>
                    <p className="text-emerald-600 font-bold max-w-md mx-auto">Cette séance a été enregistrée avec succès. Les volumes et présences sont désormais visibles dans vos statistiques globales.</p>
                </div>
            )}
        </div>
    );
}

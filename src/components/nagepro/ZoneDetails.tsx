
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Athlete, Performance, Group } from '@/lib/types';
import { formatPace, ZONES_CONFIG, calculateAdvancedSwimmingProfile, GROUP_CONFIG } from '@/lib/swim-utils';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, History, Pencil, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import PerformanceForm from './PerformanceForm';
import {
  useFirebase,
  useCollection,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  useMemoFirebase,
} from '@/firebase';
import { collection, doc, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type AthleteCardProps = {
  athlete: Athlete;
  onDelete: (id: string) => void;
};

const editAthleteSchema = z.object({
  name: z.string().min(2, { message: 'Le nom doit contenir au moins 2 caractères.' }),
  group: z.enum(['NV1', 'NV1+', 'NV2', 'N3', 'N4', 'N1'], { required_error: "Le groupe est requis." }),
  gender: z.enum(['M', 'F'], { required_error: "Le sexe est requis." }),
});

export default function SwimmerCard({ athlete, onDelete }: AthleteCardProps) {
  const { firestore, user } = useFirebase();
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isPerfLogOpen, setIsPerfLogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [perfToDelete, setPerfToDelete] = useState<Performance | null>(null);

  const performancesCollection = useMemoFirebase(() => {
    if (!firestore || !user || !athlete.id) return null;
    return collection(firestore, 'users', user.uid, 'athletes', athlete.id, 'performances');
  }, [firestore, user, athlete.id]);

  const { data: performances } = useCollection<Performance>(performancesCollection);

  const form = useForm<z.infer<typeof editAthleteSchema>>({
    resolver: zodResolver(editAthleteSchema),
    defaultValues: {
        name: athlete.name,
        group: athlete.group || 'N3',
        gender: athlete.gender || 'M',
    },
  });

  useEffect(() => {
    if (isEditOpen) {
        form.reset({
            name: athlete.name,
            group: athlete.group || 'N3',
            gender: athlete.gender || 'M',
        });
    }
  }, [isEditOpen, athlete, form]);

  const handleUpdateAthlete = async (values: z.infer<typeof editAthleteSchema>) => {
    if (!firestore || !user || !athlete.id) return;
    const athleteDocRef = doc(firestore, 'users', user.uid, 'athletes', athlete.id);
    updateDocumentNonBlocking(athleteDocRef, {
        name: values.name,
        group: values.group as Group,
        gender: values.gender,
    });
    setIsEditOpen(false);
  };

  const handleAddPerformance = async (distance: number, timeInSeconds: number, date: Date) => {
    if (!performancesCollection || !firestore || !user || !athlete.id) return;
    const newPerf = { distance, timeInSeconds, date: Timestamp.fromDate(date) };
    await addDocumentNonBlocking(performancesCollection, newPerf);
    const allPerformances = [...(performances || []), newPerf];
    const newProfile = calculateAdvancedSwimmingProfile(allPerformances as Performance[]);
    const athleteDocRef = doc(firestore, 'users', user.uid, 'athletes', athlete.id);
    updateDocumentNonBlocking(athleteDocRef, { ...newProfile });
    setIsPerfLogOpen(false);
  };
  
  const handleDeletePerformance = async () => {
    if (!perfToDelete || !firestore || !user || !athlete.id) return;
    const performanceDocRef = doc(firestore, 'users', user.uid, 'athletes', athlete.id, 'performances', perfToDelete.id!);
    try {
        await deleteDoc(performanceDocRef);
        const remainingPerformances = performances?.filter(p => p.id !== perfToDelete.id) || [];
        const newProfile = calculateAdvancedSwimmingProfile(remainingPerformances);
        const athleteDocRef = doc(firestore, 'users', user.uid, 'athletes', athlete.id);
        const updateData = newProfile 
            ? { ...newProfile }
            : { cssPace: null, cssSpeed: null, awc: null, zones: null, isProvisional: null };
        await updateDoc(athleteDocRef, updateData);
    } catch (error) {
        console.error("Erreur lors de la suppression de la performance:", error);
    } finally {
        setPerfToDelete(null);
    }
  };

  const sortedPerformances = useMemo(() => {
    if (!performances) return [];
    return [...performances].sort((a, b) => b.date.toMillis() - a.date.toMillis());
  }, [performances]);

  const insights = useMemo(() => {
    if (!athlete.cssPace || !athlete.group) return null;
    const lastPerf = sortedPerformances[0];
    const isEvolving = lastPerf ? (lastPerf.timeInSeconds / lastPerf.distance) * 100 < (athlete.cssPace - 0.5) : false;
    const isRegressing = lastPerf ? (lastPerf.timeInSeconds / lastPerf.distance) * 100 > (athlete.cssPace + 1.0) : false;
    
    let suggestion: Group | null = null;
    let type: 'up' | 'down' | null = null;

    const pace = athlete.cssPace;
    const currentGroup = athlete.group;

    if (currentGroup === 'NV1' && pace < 135) { suggestion = 'NV1+'; type = 'up'; }
    else if (currentGroup === 'NV1+') {
        if (pace < 115) { suggestion = 'NV2'; type = 'up'; }
        else if (pace > 130) { suggestion = 'NV1'; type = 'down'; }
    }
    else if (currentGroup === 'NV2') {
        if (pace < 105) { suggestion = 'N3'; type = 'up'; }
        else if (pace > 125) { suggestion = 'NV1+'; type = 'down'; }
    }
    else if (currentGroup === 'N3') {
        if (pace < 90) { suggestion = 'N4'; type = 'up'; }
        else if (pace > 110) { suggestion = 'NV2'; type = 'down'; }
    }
    else if (currentGroup === 'N4') {
        if (pace < 75) { suggestion = 'N1'; type = 'up'; }
        else if (pace > 95) { suggestion = 'N3'; type = 'down'; }
    }
    else if (currentGroup === 'N1' && pace > 85) { suggestion = 'N4'; type = 'down'; }

    return { isEvolving, isRegressing, suggestion, type };
  }, [athlete.cssPace, athlete.group, sortedPerformances]);

  const profileData = useMemo(() => {
    if (athlete.cssPace && athlete.zones && isFinite(athlete.cssPace)) {
        return {
            cssPace: athlete.cssPace,
            zones: athlete.zones,
            awc: athlete.awc,
            isProvisional: athlete.isProvisional ?? false,
        }
    }
    return null;
  }, [athlete]);

  return (
    <>
      <div className="card p-0 overflow-hidden break-inside-avoid relative group border-l-4 border-primary">
        <div className="p-5 bg-white border-b flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <span className={cn('h-3 w-3 rounded-full', athlete.gender === 'F' ? 'bg-pink-500' : 'bg-primary')}></span>
                {athlete.name}
              </h3>
              {athlete.group && (
                <span className="text-sm font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">{athlete.group}</span>
              )}
            </div>
             {profileData ? (
                <div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 text-xs font-bold bg-muted text-muted-foreground rounded-md">
                            CSS: {formatPace(profileData.cssPace)}/100m
                        </span>
                        {profileData.awc != null && profileData.awc > 0 && (
                            <span className="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-md">
                                AWC: {profileData.awc.toFixed(1)}m
                            </span>
                        )}
                        {profileData.isProvisional && (
                            <span className="px-2 py-1 text-xs font-bold bg-cyan-100 text-cyan-800 rounded-md">
                                Profil estimé
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                 <span className="px-2 py-1 mt-2 text-xs font-bold bg-slate-100 text-slate-500 rounded-md inline-block">
                    Données insuffisantes
                  </span>
            )}
            <div className="flex flex-wrap gap-2 pt-1 no-print">
                {insights?.isEvolving && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Forme Ascendante
                    </Badge>
                )}
                {insights?.isRegressing && (
                    <Badge variant="secondary" className="bg-red-50 text-red-600 hover:bg-red-50 border-red-100">
                        <TrendingDown className="w-3 h-3 mr-1" />
                        Baisse de forme
                    </Badge>
                )}
                {insights?.suggestion && (
                    <Badge variant="secondary" className={cn(
                        "hover:opacity-90 border",
                        insights.type === 'up' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                    )}>
                        {insights.type === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        Objectif: {insights.suggestion}
                    </Badge>
                )}
            </div>
          </div>
        </div>
        <div className="absolute top-3 right-3 no-print flex gap-1">
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-100 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="w-4 h-4" /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Modifier le profil de {athlete.name}</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleUpdateAthlete)} className="space-y-6">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Nom de l'athlète</FormLabel><FormControl><Input {...field} placeholder="Ex: Lucas P." /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="group" render={({ field }) => (
                                <FormItem><FormLabel>Groupe</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Groupe..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="NV1">NV1</SelectItem><SelectItem value="NV1+">NV1+</SelectItem><SelectItem value="NV2">NV2</SelectItem><SelectItem value="N3">N3</SelectItem><SelectItem value="N4">N4</SelectItem><SelectItem value="N1">N1</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="gender" render={({ field }) => (
                                <FormItem><FormLabel>Sexe</FormLabel><Tabs value={field.value} onValueChange={field.onChange} className="w-full"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="M">M</TabsTrigger><TabsTrigger value="F">F</TabsTrigger></TabsList></Tabs><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <Button type="submit" className="w-full" size="lg">Enregistrer</Button>
                    </form>
                </Form>
              </DialogContent>
            </Dialog>
            <Dialog open={isPerfLogOpen} onOpenChange={setIsPerfLogOpen}>
              <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"><PlusCircle className="w-4 h-4" /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Ajouter une performance pour {athlete.name}</DialogTitle></DialogHeader>
                <PerformanceForm onSubmit={handleAddPerformance} onFormSubmitted={() => setIsPerfLogOpen(false)}/>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setIsDeleteAlertOpen(true)}><Trash2 className="w-4 h-4" /></Button>
        </div>
        
        {profileData ? (
          <div className="space-y-1 p-4">
            {Object.keys(ZONES_CONFIG).map(key => {
              const zoneConfig = ZONES_CONFIG[key as keyof typeof ZONES_CONFIG];
              const zoneData = profileData.zones[key];
              return (
                <div key={key} className={`flex items-center justify-between p-3 rounded-lg ${zoneConfig.bg}`}>
                    <div className="flex items-center gap-3">
                        <span className={`font-bold text-lg w-8 text-center ${zoneConfig.color}`}>{zoneConfig.label.substring(0,2)}</span>
                        <div>
                            <div className={`font-bold text-sm ${zoneConfig.color}`}>{zoneConfig.label}</div>
                            <div className="text-[11px] text-slate-500 leading-tight">{zoneConfig.desc}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-mono font-bold text-slate-800 text-lg tracking-tighter">
                          {key === 'z5' ? `< ${formatPace(zoneData.min)}` : `${formatPace(zoneData.max)} - ${formatPace(zoneData.min)}`}
                        </div>
                        <div className="font-mono text-slate-500 text-xs -mt-1">/ 100m</div>
                    </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">
            <p>Ajoutez au moins une performance pour calculer le profil de l'athlète.</p>
          </div>
        )}

        {athlete.group && (
          <div className="px-4 pb-4">
             <div className="bg-slate-50/50 rounded-lg p-3 border border-dashed">
                <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 
                    Profil de Compétences {athlete.group}
                </h4>
                <div className="grid grid-cols-1 gap-2">
                    {GROUP_CONFIG[athlete.group].objectives.map((obj: string) => (
                        <div key={obj} className="flex items-center gap-2">
                            <Checkbox 
                                id={`skill-${athlete.id}-${obj}`} 
                                checked={athlete.skills?.[obj] || false}
                                onCheckedChange={() => {
                                    if (!firestore || !user || !athlete.id) return;
                                    const currentSkills = athlete.skills || {};
                                    const newSkills = { ...currentSkills, [obj]: !currentSkills[obj] };
                                    const athleteDocRef = doc(firestore, 'users', user.uid, 'athletes', athlete.id);
                                    updateDocumentNonBlocking(athleteDocRef, { skills: newSkills });
                                }}
                                className="h-3.5 w-3.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            />
                            <label 
                                htmlFor={`skill-${athlete.id}-${obj}`}
                                className={cn(
                                    "text-[11px] font-bold cursor-pointer transition-colors leading-none",
                                    athlete.skills?.[obj] ? "text-emerald-700" : "text-slate-500"
                                )}
                            >
                                {obj}
                            </label>
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}

        <div className="bg-slate-50 p-3 border-t">
          <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2"><History className="w-4 h-4"/> Historique des tests (90j)</h4>
          {sortedPerformances && sortedPerformances.length > 0 ? (
            <ul className="text-xs text-slate-600 space-y-1">
              {sortedPerformances.map(p => (
                <li key={p.id} className="flex justify-between items-center group/perf font-mono">
                  <span>{p.distance}m en {formatPace(p.timeInSeconds)} <span className="text-slate-400 ml-2">({formatPace((p.timeInSeconds / p.distance) * 100)}/100m)</span></span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{format(p.date.toDate(), 'dd/MM/yy')}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/perf:opacity-100" onClick={() => setPerfToDelete(p)}><Trash2 className="w-3 h-3"/></Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 italic">Aucune performance récente.</p>
          )}
        </div>
      </div>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr(e) ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action supprimera définitivement l'athlète "{athlete.name}" et toutes ses performances.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (athlete.id) { onDelete(athlete.id); setIsDeleteAlertOpen(false); } }}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!perfToDelete} onOpenChange={(isOpen) => !isOpen && setPerfToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmer la suppression</AlertDialogTitle><AlertDialogDescription>Voulez-vous vraiment supprimer cette performance ?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPerfToDelete(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeletePerformance}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

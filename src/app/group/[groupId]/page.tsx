
"use client";

import React, { useState, useMemo, use } from 'react';
import type { Athlete, Performance, Group as GroupType, Workout, Presence } from '@/lib/types';
import {
  useFirebase,
  useCollection,
  useMemoFirebase,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, addDoc, getDocs, Timestamp, updateDoc, query, where, writeBatch } from 'firebase/firestore';
import { formatPace, calculateAdvancedSwimmingProfile, GROUP_CONFIG, ZONES_CONFIG } from '@/lib/swim-utils';
import AuthGuard from '@/components/auth/AuthGuard';
import Header from '@/components/nagepro/Header';
import SwimmerCard from '@/components/nagepro/ZoneDetails';
import AsnsGrid from '@/components/nagepro/AsnsGrid';
import { ChevronLeft, TrendingUp, LayoutGrid, Timer, PlusCircle, Target, CheckCircle2, ShieldCheck, BookOpen, Search, UserPlus, GraduationCap, CalendarDays, Clock, PlayCircle, Settings2, Pencil, CalendarPlus, Trash2, Info, CalendarX, Play, Users2, Star, BarChart3, History, Activity, X, Users, PieChart as PieChartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import PerformanceForm from '@/components/nagepro/PerformanceForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AthleteForm from '@/components/nagepro/SwimmerForm';
import BulkSwimmerForm from '@/components/nagepro/BulkSwimmerForm';
import { Badge } from '@/components/ui/badge';
import WorkoutPlanner from '@/components/nagepro/WorkoutPlanner';
import WorkoutDetails from '@/components/nagepro/WorkoutDetails';
import { startOfDay, format, isSameDay, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
    AreaChart,
    Area,
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
} from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';

interface GroupPageProps {
  params: Promise<{ groupId: string }>;
}

function PerformanceCells({ athleteId }: { athleteId: string }) {
  const { firestore, user } = useFirebase();
  const perfCollection = useMemoFirebase(() => {
     if(!firestore || !user || !athleteId) return null;
     return collection(firestore, 'users', user.uid, 'athletes', athleteId, 'performances');
  }, [firestore, user, athleteId]);
  const { data: perfs } = useCollection<Performance>(perfCollection);
  const results = useMemo(() => {
    if(!perfs) return { p400: null, p200: null, p50: null };
    const sorted = [...perfs].sort((a,b) => b.date.toMillis() - a.date.toMillis());
    return {
        p400: sorted.find(p => p.distance === 400),
        p200: sorted.find(p => p.distance === 200),
        p50: sorted.find(p => p.distance === 50),
    };
  }, [perfs]);
  return (
    <>
      <TableCell className="font-mono text-center font-bold text-slate-700">
        {results.p400 ? formatPace(results.p400.timeInSeconds) : '--:--'}
      </TableCell>
      <TableCell className="font-mono text-center text-slate-500">
        {results.p200 ? formatPace(results.p200.timeInSeconds) : '--:--'}
      </TableCell>
      <TableCell className="font-mono text-center text-slate-500">
        {results.p50 ? formatPace(results.p50.timeInSeconds) : '--:--'}
      </TableCell>
    </>
  );
}

function GroupPageContent({ groupId }: { groupId: string }) {
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('name');
  const [genderFilter, setGenderFilter] = useState<'all' | 'M' | 'F'>('all');
  const [activeView, setActiveView] = useState('profiles');
  const [perfAthleteId, setPerfAthleteId] = useState<string | null>(null);
  const [isPerfDialogOpen, setIsPerfDialogOpen] = useState(false);
  const [isAddAthleteDialogOpen, setIsAddAthleteDialogOpen] = useState(false);
  const [isBulkAddDialogOpen, setIsBulkAddDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Workout | null>(null);
  const [viewingSession, setViewingSession] = useState<Workout | null>(null);
  const [isGeneratingCycle, setIsGeneratingCycle] = useState(false);
  
  const [planningSession, setPlanningSession] = useState<Workout | null>(null);
  const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<string>('');
  const [chartMetric, setChartMetric] = useState<'volume' | 'ratio'>('volume');

  const decodedGroupId = decodeURIComponent(groupId) as GroupType;
  const config = GROUP_CONFIG[decodedGroupId];

  const athletesCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'athletes');
  }, [firestore, user]);

  const { data: allAthletes, isLoading: athletesLoading } = useCollection<Athlete>(athletesCollection);

  const groupAthletes = useMemo(() => {
    if (!allAthletes) return [];
    return allAthletes.filter(a => a.group === decodedGroupId);
  }, [allAthletes, decodedGroupId]);

  const cycleQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'users', user.uid, 'workouts'),
        where('group', '==', decodedGroupId),
        where('isCycleSession', '==', true)
    );
  }, [firestore, user, decodedGroupId]);

  const { data: cycleWorkouts } = useCollection<Workout>(cycleQuery);

  const realWorkoutsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'users', user.uid, 'workouts'),
        where('group', '==', decodedGroupId)
    );
  }, [firestore, user, decodedGroupId]);

  const { data: allGroupWorkouts } = useCollection<Workout>(realWorkoutsQuery);

  const workoutsByBloc = useMemo(() => {
    if (!cycleWorkouts) return [];
    const groups: Record<number, Workout[]> = {};
    cycleWorkouts.forEach(w => {
        const idx = w.blocIndex ?? 0;
        if (!groups[idx]) groups[idx] = [];
        groups[idx].push(w);
    });
    return Object.keys(groups)
        .map(Number)
        .sort((a, b) => a - b)
        .map(index => ({
            index,
            sessions: groups[index].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        }));
  }, [cycleWorkouts]);

  const groupActivityStats = useMemo(() => {
    if (!allGroupWorkouts) return { totalKm: 0, count: 0, avgKm: 0, list: [], byStroke: { NC: 0, Educ: 0, Spe: 0 }, evolution: [] };
    
    const completed = allGroupWorkouts.filter(w => w.isCompleted);
    let totalDist = 0;
    const byStroke = { NC: 0, Educ: 0, Spe: 0 };
    const evolution: any[] = [];

    const sortedCompleted = [...completed].sort((a, b) => {
        const dateA = a.completedAt?.toMillis() || a.date.toMillis();
        const dateB = b.completedAt?.toMillis() || b.date.toMillis();
        return dateA - dateB;
    });

    sortedCompleted.forEach(w => {
        const workoutDist = w.summary?.totalDistance || 0;
        totalDist += workoutDist;
        
        byStroke.NC += w.summary?.byWorkType?.FULL || 0;
        byStroke.Educ += w.summary?.byWorkType?.DRILL || 0;
        byStroke.Spe += w.summary?.byWorkType?.SPE || 0;
        
        const date = w.completedAt?.toDate() || w.date.toDate();
        evolution.push({
            date: format(date, 'dd/MM'),
            volume: workoutDist / 1000,
            present: groupAthletes.length - (w.absentSwimmerIds?.length || 0),
            total: groupAthletes.length,
            ratio: groupAthletes.length > 0 ? Math.round(((groupAthletes.length - (w.absentSwimmerIds?.length || 0)) / groupAthletes.length) * 100) : 0
        });
    });

    return {
        totalKm: totalDist / 1000,
        count: completed.length,
        avgKm: completed.length > 0 ? (totalDist / completed.length) / 1000 : 0,
        list: [...sortedCompleted].reverse(),
        byStroke,
        evolution
    };
  }, [allGroupWorkouts, groupAthletes.length]);

  const currentCycleWeekIdx = useMemo(() => {
    const now = new Date();
    const startOfYearDate = new Date(now.getFullYear(), 0, 1);
    let firstMonday = new Date(startOfYearDate);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }
    const diff = now.getTime() - firstMonday.getTime();
    if (diff < 0) return -1;
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
  }, []);

  const weekDaysInfo = useMemo(() => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const now = new Date();
    const startOfYearDate = new Date(now.getFullYear(), 0, 1);
    let firstMonday = new Date(startOfYearDate);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }
    
    const weekStartMonday = new Date(firstMonday);
    weekStartMonday.setDate(firstMonday.getDate() + (currentCycleWeekIdx * 7));
    
    const weekSunday = new Date(weekStartMonday);
    weekSunday.setDate(weekStartMonday.getDate() - 1);

    return days.map((d, i) => {
        const dayDate = new Date(weekSunday);
        dayDate.setDate(weekSunday.getDate() + i);
        
        let workout = allGroupWorkouts?.find(w => !w.isCycleSession && isSameDay(w.date.toDate(), dayDate)) || null;
        
        if (!workout) {
            const isNV1 = decodedGroupId === 'NV1' || decodedGroupId === 'NV1+';
            const sessionIdx = isNV1 ? currentCycleWeekIdx : currentCycleWeekIdx * 2;
            
            if (d === 'Lundi') {
                workout = cycleWorkouts?.find(w => w.order === sessionIdx) || null;
            }
            if (d === 'Mercredi' && !isNV1) {
                workout = cycleWorkouts?.find(w => w.order === sessionIdx + 1) || null;
            }
        }

        return { name: d, workout, date: dayDate };
    });
  }, [cycleWorkouts, allGroupWorkouts, currentCycleWeekIdx, decodedGroupId]);

  const groupStats = useMemo(() => {
    const swimmers = groupAthletes.filter(a => a.cssPace && isFinite(a.cssPace));
    const avgPace = swimmers.length > 0 
        ? swimmers.reduce((acc, s) => acc + s.cssPace!, 0) / swimmers.length 
        : null;
    return { count: groupAthletes.length, avgPace };
  }, [groupAthletes]);

  const filteredAndSortedAthletes = useMemo(() => {
    return groupAthletes
        .filter(swimmer => {
            const matchesSearch = swimmer.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesGender = genderFilter === 'all' || swimmer.gender === genderFilter;
            return matchesSearch && matchesGender;
        })
        .sort((a, b) => {
            if (sortOption === 'name') return a.name.localeCompare(b.name);
            if (sortOption === 'strength_desc') {
                const paceA = a.cssPace ?? Infinity;
                const paceB = b.cssPace ?? Infinity;
                return paceA - paceB;
            }
            if (sortOption === 'strength_asc') {
                const paceA = a.cssPace ?? 0;
                const paceB = b.cssPace ?? 0;
                return paceB - paceA;
            }
            return 0;
        });
  }, [groupAthletes, searchTerm, sortOption, genderFilter]);

  const cleanWorkoutTitle = (title: string) => title.replace(/^Sem\.\s*\d+\s*-\s*/i, '');

  const handleDeleteAthlete = (athleteId: string) => {
    if (!firestore || !user) return;
    const athleteDocRef = doc(firestore, 'users', user.uid, 'athletes', athleteId);
    deleteDocumentNonBlocking(athleteDocRef);
    toast({ title: "Athlète supprimé" });
  };

  const handleToggleGender = (athleteId: string, currentGender: 'M' | 'F' | undefined) => {
    if (!firestore || !user) return;
    const newGender = currentGender === 'F' ? 'M' : 'F';
    const athleteDocRef = doc(firestore, 'users', user.uid, 'athletes', athleteId);
    updateDocumentNonBlocking(athleteDocRef, { gender: newGender });
    toast({ title: "Sexe mis à jour" });
  };

  const handleAddAthlete = (name: string, group: GroupType, gender: 'M' | 'F') => {
    if (!firestore || !user || !athletesCollection) return;
    const exists = allAthletes?.some(a => a.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        toast({ variant: "destructive", title: "Déjà présent", description: `${name} existe déjà.` });
        return;
    }
    try {
      const newAthlete: Omit<Athlete, 'id'> = {
        ownerId: user.uid,
        name,
        group,
        gender,
      };
      addDocumentNonBlocking(athletesCollection, newAthlete);
      toast({ title: "Athlète ajouté" });
      setIsAddAthleteDialogOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const handleBulkAddAthletes = async (swimmers: { name: string, gender: 'M' | 'F' }[]) => {
    if (!firestore || !user || !athletesCollection) return;
    
    let addedCount = 0;
    let skippedCount = 0;

    for (const swimmer of swimmers) {
        const exists = allAthletes?.some(a => a.name.toLowerCase() === swimmer.name.toLowerCase());
        if (exists) {
            skippedCount++;
            continue;
        }
        
        const newAthlete: Omit<Athlete, 'id'> = {
            ownerId: user.uid,
            name: swimmer.name,
            group: decodedGroupId,
            gender: swimmer.gender,
        };
        addDocumentNonBlocking(athletesCollection, newAthlete);
        addedCount++;
    }

    toast({ 
        title: "Importation terminée", 
        description: `${addedCount} nageurs ajoutés.${skippedCount > 0 ? ` (${skippedCount} doublons ignorés)` : ''}` 
    });
    setIsBulkAddDialogOpen(false);
  };

  const handleAddPerformanceSubmit = async (distance: number, timeInSeconds: number, date: Date) => {
    if (!firestore || !user || !perfAthleteId) return;
    try {
        const perfCol = collection(firestore, 'users', user.uid, 'athletes', perfAthleteId, 'performances');
        await addDoc(perfCol, { distance, timeInSeconds, date: Timestamp.fromDate(date) });
        const snapshot = await getDocs(perfCol);
        const allPerfs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Performance));
        const newProfile = calculateAdvancedSwimmingProfile(allPerfs);
        if (newProfile) {
            const athleteRef = doc(firestore, 'users', user.uid, 'athletes', perfAthleteId);
            await updateDoc(athleteRef, { ...newProfile });
        }
        toast({ title: "Performance enregistrée" });
    } catch (error) {
        console.error("Error adding performance:", error);
    } finally {
        setIsPerfDialogOpen(false);
        setPerfAthleteId(null);
    }
  };

  const handleGenerateCycle = async () => {
    if (!firestore || !user || !config.pedagogicalCycle.blocs) return;
    setIsGeneratingCycle(true);
    try {
        const batch = writeBatch(firestore);
        const workoutsCol = collection(firestore, 'users', user.uid, 'workouts');
        let sessionGlobalCount = 0;
        config.pedagogicalCycle.blocs.forEach((bloc: { sessions: Array<{ title: string; activities?: Array<{ description?: string }> }> }, bIdx: number) => {
            bloc.sessions.forEach((session, sIdx: number) => {
                const newDocRef = doc(workoutsCol);
                const workout: Omit<Workout, 'id'> = {
                    ownerId: user.uid,
                    title: session.title,
                    date: Timestamp.now(),
                    group: decodedGroupId,
                    isCycleSession: true,
                    blocIndex: bIdx,
                    order: sessionGlobalCount++,
                    blocks: [
                        {
                            id: `bloc-init-${Date.now()}`,
                            title: "Contenu Pédagogique",
                            reps: 1,
                            items: (session.activities || []).map((act: { description?: string }, aIdx: number) => {
                                return {
                                    kind: 'set',
                                    data: {
                                        id: `set-${Date.now()}-${aIdx}`,
                                        reps: 1,
                                        rest: 30,
                                        notes: act.description,
                                        segments: [{ 
                                            id: `seg-${Date.now()}-${aIdx}`, 
                                            distance: 0, 
                                            stroke: 'CHOICE',
                                            workType: 'DRILL',
                                            zone: 'z1',
                                            material: [],
                                            rest: 0
                                        }]
                                    }
                                };
                            })
                        }
                    ]
                };
                batch.set(newDocRef, workout);
            });
        });
        await batch.commit();
        toast({ title: "Cycle généré avec succès !" });
    } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Erreur lors de la génération" });
    } finally {
        setIsGeneratingCycle(false);
    }
  };

  const handlePlanSessionSubmit = async () => {
    if (!firestore || !user || !planningSession) return;
    try {
        const workoutsCol = collection(firestore, 'users', user.uid, 'workouts');
        const workoutCopy: Omit<Workout, 'id'> = {
            ownerId: user.uid,
            title: planningSession.title,
            date: Timestamp.fromDate(startOfDay(new Date(targetDate))),
            blocks: planningSession.blocks,
            group: decodedGroupId,
            isCycleSession: false,
            isCompleted: false,
            summary: planningSession.summary
        };
        await addDoc(workoutsCol, workoutCopy);
        toast({ title: "Séance planifiée !", description: `Ajoutée au programme du ${format(new Date(targetDate), 'dd/MM/yyyy')}` });
        setPlanningSession(null);
    } catch (err) {
        toast({ variant: "destructive", title: "Erreur lors de la planification" });
    }
  };

  const handleSaveNewStatsDate = async (workoutId: string) => {
    if (!firestore || !user || !tempDate) return;
    
    const workoutRef = doc(firestore, 'users', user.uid, 'workouts', workoutId);
    const newDate = new Date(tempDate + 'T12:00:00'); 
    const completionDay = startOfDay(newDate);

    updateDocumentNonBlocking(workoutRef, { 
        completedAt: Timestamp.fromDate(newDate) 
    });

    const workout = allGroupWorkouts?.find(w => w.id === workoutId);
    if (workout && groupAthletes.length > 0) {
        try {
            const attendanceCol = collection(firestore, 'users', user.uid, 'attendances');
            
            const nextDay = new Date(completionDay);
            nextDay.setDate(nextDay.getDate() + 1);

            const q = query(
                attendanceCol, 
                where('date', '>=', Timestamp.fromDate(completionDay)),
                where('date', '<', Timestamp.fromDate(nextDay))
            );
            
            const snapshot = await getDocs(q);
            
            const absentIds = workout.absentSwimmerIds || [];
            const newGroupPresences: Record<string, Presence> = {};
            
            groupAthletes.forEach(a => {
                if (a.id) {
                    newGroupPresences[a.id] = absentIds.includes(a.id) ? 'absent' : 'present';
                }
            });

            if (!snapshot.empty) {
                const attendDoc = snapshot.docs[0];
                const existingPresences = attendDoc.data().presences || {};
                updateDocumentNonBlocking(doc(attendanceCol, attendDoc.id), {
                    presences: { ...existingPresences, ...newGroupPresences }
                });
            } else {
                addDocumentNonBlocking(attendanceCol, {
                    ownerId: user.uid,
                    date: Timestamp.fromDate(completionDay),
                    presences: newGroupPresences
                });
            }
        } catch (err) {
            console.error("Erreur lors de la mise à jour de l'émargement:", err);
        }
    }

    setEditingDateId(null);
    toast({ title: "Date et émargement mis à jour" });
  };

  const chartConfig = {
    volume: { label: "Volume (km)", color: "hsl(var(--primary))" },
    present: { label: "Présents", color: "hsl(var(--chart-2))" },
    ratio: { label: "Présence (%)", color: "hsl(var(--chart-4))" }
  } satisfies ChartConfig;

  if (athletesLoading && !allAthletes) {
    return <div className="text-center p-12 text-slate-500">Chargement...</div>;
  }

  if (!config) {
    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-12">
            <Target className="w-12 h-12 text-slate-300 mb-4" />
            <h1 className="text-xl font-bold text-slate-800">Groupe non trouvé</h1>
            <Link href="/">
                <Button variant="default">Retour au tableau de bord</Button>
            </Link>
        </div>
    );
  }

  const showPerformances = !['NV1', 'NV1+'].includes(decodedGroupId);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <AuthGuard>
        <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
                <Link href="/">
                    <Button variant="ghost" className="text-slate-500 hover:bg-white">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Tableau de bord
                    </Button>
                </Link>
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                    <div className="text-right">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Groupe {decodedGroupId}</div>
                        <div className="text-2xl font-black text-slate-800">{groupStats.count} Nageurs</div>
                    </div>
                    <div className="h-10 w-px bg-slate-200 mx-2" />
                    <div className="text-right">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">CSS Moyenne</div>
                        <div className="text-2xl font-mono font-bold text-primary flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            {groupStats.avgPace ? formatPace(groupStats.avgPace) : "--:--"}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2">
                        <CalendarDays className="w-6 h-6 text-primary" />
                        Séances du Cycle - Semaine {currentCycleWeekIdx + 1}
                    </h2>
                    <Badge variant="outline" className="font-bold border-primary text-primary">
                        Phase actuelle: {config.pedagogicalCycle.title}
                    </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                    {weekDaysInfo.map((dayInfo, idx) => {
                        const isOfficialDay = dayInfo.name === 'Lundi' || (dayInfo.name === 'Mercredi' && decodedGroupId !== 'NV1' && decodedGroupId !== 'NV1+');
                        const isOptionalDay = dayInfo.name === 'Vendredi';
                        
                        const isNV1 = decodedGroupId === 'NV1' || decodedGroupId === 'NV1+';
                        const isThisWeekCycleSession = dayInfo.workout && dayInfo.workout.isCycleSession && 
                            (isNV1 ? dayInfo.workout.order === currentCycleWeekIdx : Math.floor((dayInfo.workout.order || 0) / 2) === currentCycleWeekIdx);

                        return (
                            <Card 
                                key={idx} 
                                className={cn(
                                    "border-2 transition-all shadow-sm flex flex-col h-full group relative overflow-visible cursor-pointer",
                                    dayInfo.workout 
                                        ? "border-primary/20 hover:border-primary hover:bg-slate-50/50" 
                                        : "border-slate-100 opacity-60 bg-slate-50/50 hover:opacity-100 hover:border-primary/40 hover:bg-white",
                                    (dayInfo.workout && !dayInfo.workout.isCycleSession && isOptionalDay) ? "border-emerald-500/30" : "",
                                    (isThisWeekCycleSession) ? "animate-blink-primary" : ""
                                )}
                                onClick={() => {
                                    if (dayInfo.workout) {
                                        setViewingSession(dayInfo.workout);
                                    } else {
                                        setTargetDate(format(dayInfo.date, 'yyyy-MM-dd'));
                                        setEditingSession({
                                            id: '',
                                            ownerId: user?.uid || '',
                                            title: `Séance du ${dayInfo.name}`,
                                            date: Timestamp.fromDate(dayInfo.date),
                                            blocks: [],
                                            group: decodedGroupId,
                                            isCycleSession: false
                                        });
                                    }
                                }}
                            >
                                {dayInfo.workout ? (
                                    <div className="absolute -top-3 -right-2 flex gap-1 z-10">
                                        <Button 
                                            variant="secondary" 
                                            size="icon" 
                                            className="h-8 w-8 rounded-full shadow-lg border-2 border-white bg-white text-primary hover:bg-slate-50"
                                            title="Modifier la séance"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSession(dayInfo.workout!);
                                            }}
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <div className={cn(
                                            "text-white h-8 w-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white",
                                            isOfficialDay ? "bg-primary" : "bg-emerald-500"
                                        )} title="Lire la séance">
                                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="absolute -top-2 -right-2 bg-slate-200 text-slate-400 h-8 w-8 rounded-full flex items-center justify-center shadow-sm border-2 border-white z-10 opacity-0 group-hover:opacity-100 transition-opacity" title="Ajouter une séance">
                                        <PlusCircle className="w-4 h-4" />
                                    </div>
                                )}
                                <CardHeader className="pb-2 flex flex-col items-center">
                                    <Badge className={cn(
                                        "uppercase font-black text-base px-8 py-3 mb-3 shadow-sm w-full text-center flex justify-center",
                                        dayInfo.workout 
                                            ? (isOfficialDay ? "bg-primary" : "bg-emerald-500") 
                                            : "bg-slate-200 text-slate-500"
                                    )}>
                                        {dayInfo.name}
                                    </Badge>
                                    {dayInfo.workout ? (
                                        <div className="relative w-full">
                                            <CardTitle className="text-xs font-black text-slate-800 uppercase text-center min-h-[2rem] line-clamp-2">
                                                {isOptionalDay && !dayInfo.workout.isCycleSession && <span className="block text-[9px] text-emerald-600 mb-1">Optionnelle</span>}
                                                {cleanWorkoutTitle(dayInfo.workout.title)}
                                            </CardTitle>
                                        </div>
                                    ) : (
                                        <div className="py-4 flex flex-col items-center gap-1">
                                            <CardTitle className="text-xs font-bold uppercase text-slate-400 text-center">Repos</CardTitle>
                                            <span className="text-[9px] font-bold text-slate-300 uppercase">Cliquer pour ajouter</span>
                                        </div>
                                    )}
                                </CardHeader>
                                {dayInfo.workout && (
                                    <CardContent 
                                        className="flex-grow pb-4 px-3"
                                    >
                                        <div className="space-y-1">
                                            {dayInfo.workout.blocks?.map(b => (
                                                <div key={b.id} className="text-[10px] font-medium text-slate-600 flex items-center gap-1.5">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                        isOfficialDay ? "bg-primary/40" : "bg-emerald-400"
                                                    )} />
                                                    <span className="truncate">{(b.items?.length || 0)} séries • {b.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end gap-3 no-print">
                <Button 
                    variant="outline"
                    onClick={() => setIsBulkAddDialogOpen(true)}
                    className="h-11 px-6 font-bold border-primary text-primary hover:bg-primary/5"
                >
                    <Users2 className="mr-2 h-5 w-5" />
                    Ajout Multiple
                </Button>
                <Button 
                    onClick={() => setIsAddAthleteDialogOpen(true)}
                    className="h-11 px-6 font-bold"
                >
                    <UserPlus className="mr-2 h-5 w-5" />
                    Nouveau Nageur
                </Button>
            </div>

            <Tabs value={activeView} onValueChange={setActiveView} className="space-y-6">
                <TabsList className="bg-white border">
                    <TabsTrigger value="profiles" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                        <LayoutGrid className="w-4 h-4 mr-2" />
                        Profils
                    </TabsTrigger>
                    {showPerformances && (
                        <TabsTrigger value="performances" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                            <Timer className="w-4 h-4 mr-2" />
                            Performances
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="objectives" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Objectifs
                    </TabsTrigger>
                    <TabsTrigger value="cycle" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                        <GraduationCap className="w-4 h-4 mr-2" />
                        Cycle Pédagogique
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Statistiques
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profiles" className="mt-0 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border shadow-sm no-print">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Rechercher un nageur..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-10"
                            />
                        </div>
                        
                        <Select value={sortOption} onValueChange={setSortOption}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder="Trier par..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Trier par Nom (A-Z)</SelectItem>
                                <SelectItem value="strength_desc">Trier par Plus fort (CSS ↓)</SelectItem>
                                <SelectItem value="strength_asc">Trier par Moins fort (CSS ↑)</SelectItem>
                            </SelectContent>
                        </Select>

                        <Tabs value={genderFilter} onValueChange={(val) => setGenderFilter(val as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 h-10">
                                <TabsTrigger value="all">Tous</TabsTrigger>
                                <TabsTrigger value="M">Hommes</TabsTrigger>
                                <TabsTrigger value="F">Femmes</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center justify-end gap-2 text-xs font-bold text-slate-400 uppercase pr-2">
                            <Users2 className="w-4 h-4" />
                            {filteredAndSortedAthletes.length} résultat{filteredAndSortedAthletes.length > 1 ? 's' : ''}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {filteredAndSortedAthletes.map(athlete => (
                          <div key={athlete.id} id={`swimmer-card-${athlete.id}`} className="scroll-mt-24">
                            <SwimmerCard athlete={athlete} onDelete={handleDeleteAthlete} />
                          </div>
                        ))}
                    </div>
                </TabsContent>

                {showPerformances && (
                    <TabsContent value="performances" className="mt-0">
                        <div className="card overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[200px] font-bold">Nageur</TableHead>
                                        <TableHead className="text-center font-bold">Sexe</TableHead>
                                        <TableHead className="text-center font-bold text-primary">CSS (/100m)</TableHead>
                                        <TableHead className="text-center font-bold">Dernier 400m</TableHead>
                                        <TableHead className="text-center font-bold">Dernier 200m</TableHead>
                                        <TableHead className="text-center font-bold">Dernier 50m</TableHead>
                                        <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAndSortedAthletes.map(athlete => (
                                        <TableRow key={athlete.id} className="hover:bg-slate-50/50">
                                            <TableCell className="font-bold text-slate-900">
                                                <Link href={`#swimmer-card-${athlete.id}`} onClick={() => setActiveView('profiles')} className="hover:text-primary transition-colors">
                                                    {athlete.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 w-8 rounded-full p-0 hover:bg-slate-200 transition-all"
                                                    onClick={() => handleToggleGender(athlete.id!, athlete.gender)}
                                                >
                                                    <span className={cn(
                                                        "inline-block w-3 h-3 rounded-full",
                                                        athlete.gender === 'F' ? "bg-pink-500" : "bg-primary"
                                                    )} />
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-primary">
                                                {athlete.cssPace ? formatPace(athlete.cssPace) : '--:--'}
                                            </TableCell>
                                            <PerformanceCells athleteId={athlete.id!} />
                                            <TableCell className="text-right pr-6">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-primary hover:bg-primary/10"
                                                    onClick={() => {
                                                        setPerfAthleteId(athlete.id!);
                                                        setIsPerfDialogOpen(true);
                                                    }}
                                                >
                                                    <PlusCircle className="h-5 w-5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                )}

                <TabsContent value="objectives" className="mt-0">
                    {decodedGroupId === 'NV1+' ? (
                       <AsnsGrid athletes={groupAthletes} />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Card className="border-l-4 border-l-primary">
                            <CardHeader>
                                <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                                    <Target className="w-6 h-6 text-primary" />
                                    Référentiel de Performance
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Cible Chronométrique</div>
                                    <div className="text-3xl font-black text-primary">{config.targetPace}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Focus Technique Majeur</div>
                                    <div className="text-lg font-bold text-slate-700">{config.technicalFocus}</div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-dashed">
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-primary" />
                                        Prérequis d'entrée
                                    </div>
                                    <div className="space-y-2">
                                        {(config.prerequisites || []).map((pre: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                <div className="w-2 h-2 bg-primary rounded-full" />
                                                {pre}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    Compétences à Valider
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {(config.objectives || []).map((obj: string, i: number) => (
                                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 font-medium">
                                        <div className="w-5 h-5 bg-white border rounded flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                            {i + 1}
                                        </div>
                                        {obj}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                      </div>
                    )}
                </TabsContent>

                <TabsContent value="cycle" className="mt-0">
                    <Card className="border-t-4 border-t-indigo-500 shadow-xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 pb-8">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                <div>
                                    <CardTitle className="text-3xl font-black text-slate-800 uppercase flex items-center gap-3">
                                        < GraduationCap className="w-8 h-8 text-indigo-500" />
                                        {config.pedagogicalCycle.title}
                                    </CardTitle>
                                    <CardDescription className="text-indigo-600 font-bold text-lg mt-1">
                                        Focus : {config.technicalFocus}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="h-10 border-indigo-200 text-indigo-700 bg-indigo-50 px-4 text-sm font-bold">
                                        <CalendarDays className="w-4 h-4 mr-2" />
                                        {config.pedagogicalCycle.duration}
                                    </Badge>
                                    {(!cycleWorkouts || cycleWorkouts.length === 0) && (
                                        <Button 
                                            variant="default" 
                                            onClick={handleGenerateCycle}
                                            disabled={isGeneratingCycle}
                                            className="bg-indigo-600 hover:bg-indigo-700 font-bold h-10"
                                        >
                                            <Settings2 className="mr-2 h-4 w-4" />
                                            Générer le cycle interactif
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-8 p-6">
                            {(!cycleWorkouts || cycleWorkouts.length === 0) ? (
                                <div className="bg-slate-50 p-12 rounded-xl border-2 border-dashed text-center space-y-4">
                                    <PlayCircle className="w-12 h-12 text-slate-300 mx-auto" />
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-700">Le cycle interactif n'est pas encore activé</h4>
                                        <p className="text-slate-500 max-w-md mx-auto">Activez le cycle pour pouvoir modifier chaque séance avec l'outil de création et les planifier dans votre calendrier.</p>
                                    </div>
                                    <Button onClick={handleGenerateCycle} disabled={isGeneratingCycle} size="lg" className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                                        Activer maintenant
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {workoutsByBloc.map((bloc) => {
                                        const blocConfig = config.pedagogicalCycle.blocs?.[bloc.index];
                                        const sessionsByWeek: Record<number, Workout[]> = {};
                                        
                                        const isNV1 = decodedGroupId === 'NV1' || decodedGroupId === 'NV1+';

                                        bloc.sessions.forEach(s => {
                                            const weekIdx = isNV1 ? (s.order ?? 0) : Math.floor((s.order ?? 0) / 2);
                                            if (!sessionsByWeek[weekIdx]) sessionsByWeek[weekIdx] = [];
                                            sessionsByWeek[weekIdx].push(s);
                                        });
                                        const sortedWeekIndices = Object.keys(sessionsByWeek).map(Number).sort((a,b) => a - b);

                                        return (
                                            <div key={bloc.index} className="space-y-6">
                                                <div className="flex items-baseline gap-4 border-b pb-2">
                                                    <div className="bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">Bloc {bloc.index + 1}</div>
                                                    <h4 className="font-black text-slate-800 uppercase text-lg">{blocConfig?.title || `Partie ${bloc.index + 1}`}</h4>
                                                </div>
                                                <p className="text-sm text-slate-500 font-medium italic mb-4">{blocConfig?.objective}</p>
                                                
                                                <div className="space-y-10 pl-4 border-l-2 border-indigo-100">
                                                    {sortedWeekIndices.map((weekIdx) => {
                                                        const weekPlanned = sessionsByWeek[weekIdx].reduce((acc, s) => acc + (s.summary?.totalDistance || 0), 0);
                                                        const weekPerformed = (allGroupWorkouts || []).reduce((acc, w) => {
                                                            if (!w.isCompleted) return acc;
                                                            const date = w.completedAt?.toDate() || w.date.toDate();
                                                            const startOfYearDate = new Date(date.getFullYear(), 0, 1);
                                                            let firstMonday = new Date(startOfYearDate);
                                                            while (firstMonday.getDay() !== 1) {
                                                              firstMonday.setDate(firstMonday.getDate() + 1);
                                                            }
                                                            const diff = date.getTime() - firstMonday.getTime();
                                                            const wIdx = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
                                                            if (wIdx === weekIdx) return acc + (w.summary?.totalDistance || 0);
                                                            return acc;
                                                        }, 0);
                                                        
                                                        const optionalSessions = (allGroupWorkouts || []).filter(w => {
                                                            if (w.isCycleSession) return false;
                                                            const date = w.completedAt?.toDate() || w.date.toDate();
                                                            const startOfYearDate = new Date(date.getFullYear(), 0, 1);
                                                            let firstMonday = new Date(startOfYearDate);
                                                            while (firstMonday.getDay() !== 1) {
                                                              firstMonday.setDate(firstMonday.getDate() + 1);
                                                            }
                                                            const diff = date.getTime() - firstMonday.getTime();
                                                            const wIdx = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
                                                            return wIdx === weekIdx && getDay(date) === 5; 
                                                        });

                                                        return (
                                                            <div key={weekIdx} className="space-y-4">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <h5 className="text-sm font-black text-indigo-500 uppercase tracking-tighter bg-indigo-50 px-2 py-0.5 rounded">Semaine {weekIdx + 1}</h5>
                                                                        <div className="h-px bg-indigo-100 w-24" />
                                                                    </div>
                                                                    <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-slate-300">Effectué</span>
                                                                            <span className="text-xs font-black text-emerald-600">{(weekPerformed / 1000).toFixed(2)} km</span>
                                                                        </div>
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-slate-300">À effectuer</span>
                                                                            <span className="text-xs font-black text-indigo-600">{(weekPlanned / 1000).toFixed(2)} km</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="space-y-6">
                                                                    <div className={cn(
                                                                        "grid gap-4",
                                                                        sessionsByWeek[weekIdx].length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                                                                    )}>
                                                                        {sessionsByWeek[weekIdx].map((session) => {
                                                                            const sessionWeekIdx = isNV1 ? (session.order ?? 0) : Math.floor((session.order || 0) / 2);
                                                                            const isCurrentWeek = sessionWeekIdx === currentCycleWeekIdx;
                                                                            return (
                                                                                <div 
                                                                                    key={session.id} 
                                                                                    className={cn(
                                                                                        "group relative bg-white border-2 border-slate-100 rounded-xl p-5 transition-all shadow-sm hover:shadow-md cursor-pointer overflow-visible",
                                                                                        isCurrentWeek ? "animate-blink-primary border-primary bg-primary/5" : "hover:border-indigo-200"
                                                                                    )}
                                                                                    onClick={() => setViewingSession(session)}
                                                                                >
                                                                                    <div className="absolute -top-3 -right-2 flex gap-1 z-10">
                                                                                        <Button 
                                                                                            variant="secondary" 
                                                                                            size="icon" 
                                                                                            className="h-8 w-8 rounded-full shadow-lg border-2 border-white bg-white text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                                                                                            title="Modifier la séance"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setEditingSession(session);
                                                                                            }}
                                                                                        >
                                                                                            <Pencil className="w-3.5 h-3.5" />
                                                                                        </Button>
                                                                                        <div className="bg-primary text-white h-8 w-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white" title="Lire la séance">
                                                                                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex justify-between items-start mb-3">
                                                                                        <div className="space-y-1">
                                                                                            <h5 className="font-black text-slate-800 uppercase tracking-tight line-clamp-1">
                                                                                                {cleanWorkoutTitle(session.title)}
                                                                                            </h5>
                                                                                            {isCurrentWeek && (
                                                                                                <Badge className="bg-primary text-[10px] h-5 uppercase font-black px-2">Semaine Actuelle</Badge>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="space-y-2">
                                                                                        {session.blocks?.map(b => (
                                                                                            <div key={b.id} className="text-xs text-slate-500 font-medium flex items-center gap-2">
                                                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                                                                                                {(b.items?.length || 0)} séries • {b.title}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                                                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Configuration Cycle</div>
                                                                                        <div className="text-xs font-black text-indigo-600">Séance {session.order !== undefined ? session.order + 1 : '-'}</div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>

                                                                    {optionalSessions.length > 0 && (
                                                                        <div className="space-y-3 pt-4 border-t border-dashed">
                                                                            <h6 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                                                                <Star className="w-3 h-3 fill-current" />
                                                                                Séance Optionnelle (Vendredi)
                                                                            </h6>
                                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                                {optionalSessions.map(session => (
                                                                                    <div 
                                                                                        key={session.id}
                                                                                        className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 hover:bg-emerald-50 transition-all cursor-pointer group relative"
                                                                                        onClick={() => setViewingSession(session)}
                                                                                    >
                                                                                        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                                                                                             <Button 
                                                                                                variant="secondary" 
                                                                                                size="icon" 
                                                                                                className="h-6 w-6 rounded-full shadow-sm border bg-white text-emerald-600 hover:bg-emerald-50"
                                                                                                title="Modifier"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setEditingSession(session);
                                                                                                }}
                                                                                            >
                                                                                                <Pencil className="w-2.5 h-2.5" />
                                                                                            </Button>
                                                                                        </div>
                                                                                        <div className="flex justify-between items-start gap-2">
                                                                                            <p className="text-xs font-black text-slate-700 uppercase line-clamp-1">{session.title}</p>
                                                                                            <Play className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                                                        </div>
                                                                                        <div className="mt-2 flex items-center justify-between">
                                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">{format(session.completedAt?.toDate() || session.date.toDate(), 'eeee dd/MM', { locale: fr })}</span>
                                                                                            <span className="text-[9px] font-black text-emerald-600">{((session.summary?.totalDistance || 0) / 1000).toFixed(2)} km</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="stats" className="mt-0 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-white border-l-4 border-l-primary shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-primary" /> Distance Totale Parcours
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black text-slate-800">{groupActivityStats.totalKm.toFixed(2)} <span className="text-xl font-bold text-slate-400">km</span></div>
                                <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">Volume cumulé validé</p>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-white border-l-4 border-l-emerald-500 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Séances Effectuées
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black text-slate-800">{groupActivityStats.count} <span className="text-xl font-bold text-slate-400">séances</span></div>
                                <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">Nombre total de validations</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-white border-l-4 border-l-indigo-500 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-indigo-500" /> Moyenne par Séance
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black text-slate-800">{groupActivityStats.avgKm.toFixed(2)} <span className="text-xl font-bold text-slate-400">km</span></div>
                                <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">Volume moyen par entraînement</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <Card className="lg:col-span-8 shadow-sm">
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                                        <TrendingUp className="w-6 h-6 text-primary" />
                                        Évolution de la charge
                                    </CardTitle>
                                    <CardDescription>Volume kilométrique et taux de présence par séance</CardDescription>
                                </div>
                                <Tabs value={chartMetric} onValueChange={(val) => setChartMetric(val as any)} className="w-auto">
                                    <TabsList className="h-8 bg-slate-100 border-none">
                                        <TabsTrigger value="volume" className="text-[10px] uppercase font-black px-3 h-6">Volume</TabsTrigger>
                                        <TabsTrigger value="ratio" className="text-[10px] uppercase font-black px-3 h-6">Présence</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </CardHeader>
                            <CardContent className="h-[350px] pt-4">
                                {groupActivityStats.evolution.length > 0 ? (
                                    <ChartContainer config={chartConfig} className="h-full w-full">
                                        <AreaChart data={groupActivityStats.evolution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis 
                                                dataKey="date" 
                                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis 
                                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                                                tickLine={false}
                                                axisLine={false}
                                                unit={chartMetric === 'volume' ? 'km' : '%'}
                                            />
                                            <RechartsTooltip 
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-slate-900 text-white p-3 rounded-xl border border-white/10 shadow-2xl">
                                                                <p className="font-black text-xs uppercase mb-2 border-b border-white/10 pb-1">Séance du {label}</p>
                                                                <div className="space-y-1">
                                                                    <p className="text-[10px] flex justify-between gap-4">
                                                                        <span className="text-slate-400">Volume :</span>
                                                                        <span className="font-black text-primary">{payload[0].payload.volume} km</span>
                                                                    </p>
                                                                    <p className="text-[10px] flex justify-between gap-4">
                                                                        <span className="text-slate-400">Présence :</span>
                                                                        <span className="font-black text-emerald-400">{payload[0].payload.ratio}% ({payload[0].payload.present}/{payload[0].payload.total})</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey={chartMetric} 
                                                stroke={chartMetric === 'volume' ? 'hsl(var(--primary))' : 'hsl(var(--chart-4))'} 
                                                fillOpacity={1} 
                                                fill={`url(#colorMetric)`} 
                                                strokeWidth={3}
                                            />
                                            <defs>
                                                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={chartMetric === 'volume' ? 'hsl(var(--primary))' : 'hsl(var(--chart-4))'} stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor={chartMetric === 'volume' ? 'hsl(var(--primary))' : 'hsl(var(--chart-4))'} stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                        </AreaChart>
                                    </ChartContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase text-xs">Données insuffisantes</div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-4 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                                    <PieChartIcon className="w-6 h-6 text-primary" />
                                    Breakdown Volume
                                </CardTitle>
                                <CardDescription>Répartition par type de travail</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-4">
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl border-2 border-primary/10 bg-primary/5">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="text-[10px] font-black text-primary uppercase">Nage Complète (NC)</span>
                                            <span className="text-xs font-black">{(groupActivityStats.byStroke.NC / 1000).toFixed(2)} km</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: `${(groupActivityStats.byStroke.NC / (groupActivityStats.totalKm * 1000 || 1)) * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl border-2 border-indigo-100 bg-indigo-50/50">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase">Éducatifs (Tech)</span>
                                            <span className="text-xs font-black">{(groupActivityStats.byStroke.Educ / 1000).toFixed(2)} km</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500" style={{ width: `${(groupActivityStats.byStroke.Educ / (groupActivityStats.totalKm * 1000 || 1)) * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl border-2 border-rose-100 bg-rose-50/50">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="text-[10px] font-black text-rose-600 uppercase">Nage Spécialité</span>
                                            <span className="text-xs font-black">{(groupActivityStats.byStroke.Spe / 1000).toFixed(2)} km</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500" style={{ width: `${(groupActivityStats.byStroke.Spe / (groupActivityStats.totalKm * 1000 || 1)) * 100}%` }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-dashed">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                                        <Info className="w-3 h-3" />
                                        Ratio calculé sur {groupActivityStats.count} séances
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50">
                            <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
                                <History className="w-6 h-6 text-slate-400" />
                                Historique des validations
                            </CardTitle>
                            <CardDescription>
                                Liste exhaustive des entraînements validés en mode Direct pour le groupe {decodedGroupId}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {groupActivityStats.list.length > 0 ? (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold">Date de validation</TableHead>
                                            <TableHead className="font-bold">Séance</TableHead>
                                            <TableHead className="text-center font-bold">Type</TableHead>
                                            <TableHead className="text-center font-bold">Présents</TableHead>
                                            <TableHead className="text-right font-bold pr-6">Volume réalisé</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupActivityStats.list.map((workout) => (
                                            <TableRow key={workout.id} className="hover:bg-slate-50/50">
                                                <TableCell className="font-mono font-bold text-slate-500">
                                                    {editingDateId === workout.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <Input 
                                                                type="date" 
                                                                value={tempDate} 
                                                                onChange={(e) => setTempDate(e.target.value)}
                                                                className="h-8 w-36 text-xs bg-white"
                                                            />
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => handleSaveNewStatsDate(workout.id)}>
                                                                <CheckCircle2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => setEditingDateId(null)}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 group/date">
                                                            {format(workout.completedAt?.toDate() || workout.date.toDate(), 'dd/MM/yyyy')}
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-6 w-6 opacity-0 group-hover/date:opacity-100 transition-opacity text-primary hover:bg-primary/10"
                                                                title="Modifier la date et synchroniser l'émargement"
                                                                onClick={() => {
                                                                    setEditingDateId(workout.id);
                                                                    setTempDate(format(workout.completedAt?.toDate() || workout.date.toDate(), 'yyyy-MM-dd'));
                                                                }}
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-black text-slate-800 uppercase tracking-tight">
                                                    {workout.title}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {getDay(workout.completedAt?.toDate() || workout.date.toDate()) === 5 ? (
                                                        <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">Optionnelle</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] border-primary/20 text-primary bg-primary/5">Cycle Officiel</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-sm font-black text-slate-700">
                                                            {groupAthletes.length - (workout.absentSwimmerIds?.length || 0)} / {groupAthletes.length}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Nageurs</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <span className="text-lg font-black text-primary">
                                                        {((workout.summary?.totalDistance || 0) / 1000).toFixed(2)} km
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-4">
                                    <Activity className="w-12 h-12 opacity-20" />
                                    <p className="font-bold">Aucune séance n'a encore été validée pour ce groupe.</p>
                                    <p className="text-sm max-w-xs mx-auto">Validez une séance en mode Direct pour commencer à accumuler des statistiques.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {filteredAndSortedAthletes.length === 0 && (
                    <div className="text-center p-12 card bg-slate-50 text-slate-400">
                        Aucun nageur ne correspond à vos critères.
                    </div>
                )}
            </Tabs>

            <Dialog open={isAddAthleteDialogOpen} onOpenChange={setIsAddAthleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nouveau nageur - Groupe {decodedGroupId}</DialogTitle>
                    </DialogHeader>
                    <AthleteForm 
                        onSubmit={handleAddAthlete} 
                        buttonText="Créer le profil" 
                        defaultValues={{ group: decodedGroupId }} 
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isBulkAddDialogOpen} onOpenChange={setIsBulkAddDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users2 className="w-6 h-6 text-primary" />
                            Ajout Multiple - Groupe {decodedGroupId}
                        </DialogTitle>
                    </DialogHeader>
                    <BulkSwimmerForm 
                        groupId={decodedGroupId}
                        onSave={handleBulkAddAthletes}
                        onCancel={() => setIsBulkAddDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
                <DialogContent className="max-w-5xl h-[90vh] overflow-y-auto p-0 border-none bg-slate-50">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Édition de la séance</DialogTitle>
                    </DialogHeader>
                    <div className="p-6">
                        {editingSession && (
                            <WorkoutPlanner 
                                key={editingSession.id || `new-${editingSession.date?.toMillis()}`}
                                selectedDate={editingSession.date?.toDate() || new Date()}
                                workoutData={editingSession}
                                isCycleMode={editingSession.isCycleSession}
                                onSaved={() => setEditingSession(null)}
                                groupFilterOverride={decodedGroupId}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingSession} onOpenChange={(open) => !open && setViewingSession(null)}>
                <DialogContent className="max-w-7xl h-[95vh] overflow-y-auto p-0 border-none bg-white">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Détails de la séance</DialogTitle>
                    </DialogHeader>
                    <div className="p-6">
                        {viewingSession && (
                            <WorkoutDetails 
                                key={viewingSession.id}
                                workout={viewingSession}
                                viewMode="live"
                                athletes={groupAthletes}
                                onComplete={() => setViewingSession(null)}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!planningSession} onOpenChange={(open) => !open && setPlanningSession(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Planifier la séance : {planningSession?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-sm text-muted-foreground">Sélectionnez la date à laquelle vous souhaitez intégrer cette séance au programme du groupe.</p>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Date de la séance</label>
                            <Input 
                                type="date" 
                                value={targetDate} 
                                onChange={(e) => setTargetDate(e.target.value)} 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPlanningSession(null)}>Annuler</Button>
                        <Button onClick={handlePlanSessionSubmit} className="bg-emerald-600 hover:bg-emerald-700">Confirmer la planification</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
      </AuthGuard>
    </div>
  );
}

export default function GroupPage({ params }: GroupPageProps) {
  const { groupId } = use(params);
  return <GroupPageContent groupId={groupId} />;
}

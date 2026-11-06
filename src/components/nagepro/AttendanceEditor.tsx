
'use client';

import React, { useState, useMemo } from 'react';
import type { Athlete, Attendance, Presence, Group } from '@/lib/types';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, Timestamp, doc } from 'firebase/firestore';
import { 
    startOfMonth, 
    endOfMonth, 
    format, 
    eachDayOfInterval, 
    getDate, 
    isSameMonth, 
    subMonths, 
    addMonths,
    startOfYear,
    endOfYear,
    startOfDay,
    isToday
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Eye, UserX, Circle, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import AttendanceStatsTable from './AttendanceStatsTable';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function AttendanceEditor() {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [groupFilter, setGroupFilter] = useState<'all' | Group>('all');

    // --- Data Fetching ---
    const athletesCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'users', user.uid, 'athletes');
    }, [firestore, user]);

    const { data: allAthletes } = useCollection<Athlete>(athletesCollection);

    const filteredAthletes = useMemo(() => {
        if (!allAthletes) return [];
        let list = [...allAthletes];
        if (groupFilter !== 'all') {
            list = list.filter(a => a.group === groupFilter);
        }
        return list.sort((a,b) => a.name.localeCompare(b.name));
    }, [allAthletes, groupFilter]);

    // --- Monthly Attendance Data ---
    const monthlyAttendanceQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        
        return query(
            collection(firestore, 'users', user.uid, 'attendances'),
            where('date', '>=', Timestamp.fromDate(monthStart)),
            where('date', '<=', Timestamp.fromDate(monthEnd))
        );
    }, [firestore, user, currentMonth]);
    
    const { data: monthlyAttendanceDocs } = useCollection<Attendance>(monthlyAttendanceQuery);

    const attendanceByDate = useMemo(() => {
        if (!monthlyAttendanceDocs) return {};
        return monthlyAttendanceDocs.reduce((acc, doc) => {
            const dateKey = format(doc.date.toDate(), 'yyyy-MM-dd');
            acc[dateKey] = doc;
            return acc;
        }, {} as Record<string, Attendance>);
    }, [monthlyAttendanceDocs]);

    // --- Yearly Stats Data ---
    const yearlyAttendanceQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;

        const yearStart = startOfYear(currentMonth);
        const yearEnd = endOfYear(currentMonth);

        return query(
            collection(firestore, 'users', user.uid, 'attendances'),
            where('date', '>=', Timestamp.fromDate(yearStart)),
            where('date', '<=', Timestamp.fromDate(yearEnd))
        )
    }, [firestore, user, currentMonth]);

    const { data: yearlyAttendanceDocs } = useCollection<Attendance>(yearlyAttendanceQuery);

    // --- Event Handlers ---
    const handleClearDate = (date: Date) => {
        if (!firestore || !user) return;
        
        const dateKey = format(date, 'yyyy-MM-dd');
        const attendanceDoc = attendanceByDate[dateKey];
        if (!attendanceDoc) return;

        const newPresences = { ...(attendanceDoc?.presences || {}) };
        let clearedCount = 0;

        if (groupFilter !== 'all') {
            const groupSwimmerIds = allAthletes?.filter(a => a.group === groupFilter).map(a => a.id!) || [];
            groupSwimmerIds.forEach(id => {
                if (newPresences[id]) {
                    delete newPresences[id];
                    clearedCount++;
                }
            });
        } else {
            clearedCount = Object.keys(newPresences).length;
            Object.keys(newPresences).forEach(key => delete newPresences[key]);
        }

        if (clearedCount === 0) return;

        const docRef = doc(firestore, 'users', user.uid, 'attendances', attendanceDoc.id);
        updateDocumentNonBlocking(docRef, { presences: newPresences });
        toast({ 
            title: "Émargement effacé", 
            description: `Les données du ${format(date, 'dd/MM/yyyy')} pour le groupe ${groupFilter} ont été réinitialisées.` 
        });
    };

    const handleCyclePresence = (swimmerId: string, date: Date) => {
        if (!firestore || !user) return;
        
        const dateKey = format(date, 'yyyy-MM-dd');
        const attendanceDoc = attendanceByDate[dateKey];
        const currentPresence = attendanceDoc?.presences?.[swimmerId];
        
        const newPresences = { ...(attendanceDoc?.presences || {}) };
        
        let nextPresence: Presence | undefined;
        if (currentPresence === 'present') {
            nextPresence = 'absent';
        } else if (currentPresence === 'absent') {
            nextPresence = undefined; // Back to blank
        } else { // Covers 'undefined'
            nextPresence = 'present';
        }

        if (nextPresence) {
            newPresences[swimmerId] = nextPresence;
        } else {
            delete newPresences[swimmerId];
        }

        if (attendanceDoc) {
            const docRef = doc(firestore, 'users', user.uid, 'attendances', attendanceDoc.id);
            updateDocumentNonBlocking(docRef, { presences: newPresences });
        } else {
            const newAttendance: Omit<Attendance, 'id'> = {
                ownerId: user.uid,
                date: Timestamp.fromDate(startOfDay(date)),
                presences: newPresences
            };
            addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'attendances'), newAttendance);
        }
    };
    
    const daysInMonth = useMemo(() => eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth)
    }), [currentMonth]);

    const getPresenceIcon = (presence: Presence | undefined) => {
        switch (presence) {
            case 'absent':
                return { Icon: UserX, className: 'text-red-500', label: 'Absent(e)' };
            case 'present':
                return { Icon: Eye, className: 'text-green-500', label: 'Présent(e)' };
            default:
                return { Icon: Circle, className: 'text-slate-300 hover:bg-slate-200', label: 'Non renseigné' };
        }
    };

    return (
        <div className="space-y-6">
            <div className="card p-6 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Feuille d'émargement</h1>
                    <div className="flex items-center gap-2 rounded-md border bg-background overflow-hidden">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                            <ChevronLeft className="h-6 w-6"/>
                        </Button>
                        <h2 className="text-lg font-bold text-center w-40">{format(currentMonth, "MMMM yyyy", { locale: fr })}</h2>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                            <ChevronRight className="h-6 w-6"/>
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <Filter className="w-3 h-3" /> Filtrer par groupe
                    </div>
                    <Tabs value={groupFilter} onValueChange={(val) => setGroupFilter(val as any)} className="w-full">
                        <TabsList className="grid grid-cols-4 md:flex h-auto p-1 bg-slate-100 flex-wrap">
                            <TabsTrigger value="all" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Tous</TabsTrigger>
                            <TabsTrigger value="NV1" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">NV1</TabsTrigger>
                            <TabsTrigger value="NV1+" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">NV1+</TabsTrigger>
                            <TabsTrigger value="NV2" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">NV2</TabsTrigger>
                            <TabsTrigger value="N3" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">N3</TabsTrigger>
                            <TabsTrigger value="N4" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">N4</TabsTrigger>
                            <TabsTrigger value="N1" className="text-xs px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">N1</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {filteredAthletes.length > 0 && (
                <div className="card p-0 overflow-hidden">
                    <TooltipProvider delayDuration={100}>
                         <div className="overflow-x-auto">
                            <Table className="whitespace-nowrap border-collapse">
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead className="sticky left-0 bg-slate-50 z-10 w-[200px] border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Athlète</TableHead>
                                        {daysInMonth.map(day => {
                                            const today = isToday(day);
                                            const dateKey = format(day, 'yyyy-MM-dd');
                                            const hasData = attendanceByDate[dateKey] !== undefined;
                                            return (
                                                <TableHead 
                                                    key={day.toString()} 
                                                    className={cn(
                                                        "text-center w-10 p-0 text-[10px] font-bold relative group/head",
                                                        today && "bg-primary/10 border-x border-primary/30"
                                                    )}
                                                >
                                                    {today && <div className="absolute top-0 left-0 right-0 h-1 bg-primary z-20" />}
                                                    <div className="flex flex-col items-center justify-center py-2 relative">
                                                        {hasData && (
                                                            <button 
                                                                onClick={() => handleClearDate(day)}
                                                                className="absolute -top-1 opacity-0 group-hover/head:opacity-100 transition-opacity bg-red-100 text-red-600 hover:bg-red-200 rounded px-1 text-[8px] font-black uppercase z-30 shadow-sm"
                                                                title="Effacer l'émargement de ce jour"
                                                            >
                                                                CLR
                                                            </button>
                                                        )}
                                                        <span className={cn("text-slate-400 font-medium", today && "text-primary font-black")}>{format(day, 'eeeee', { locale: fr })}</span>
                                                        <span className={cn("text-slate-800", today && "text-primary font-black scale-110")}>{getDate(day)}</span>
                                                    </div>
                                                </TableHead>
                                            );
                                        })}
                                        <TableHead className="sticky right-0 bg-slate-50 z-10 text-center border-l shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">Présence</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAthletes.map((swimmer) => {
                                        const stats = { present: 0, absent: 0 };
                                        daysInMonth.forEach(day => {
                                            if (isSameMonth(day, currentMonth)) {
                                                const dateKey = format(day, 'yyyy-MM-dd');
                                                const presence = attendanceByDate[dateKey]?.presences?.[swimmer.id!];
                                                if (presence === 'present' || presence === 'absent') {
                                                    stats[presence] = (stats[presence] || 0) + 1;
                                                }
                                            }
                                        });

                                        const totalForPercent = stats.present + stats.absent;
                                        const presencePercentage = totalForPercent > 0 ? (stats.present / totalForPercent) * 100 : 0;

                                        return (
                                            <TableRow key={swimmer.id} className="hover:bg-slate-50 transition-colors">
                                                <TableCell className="sticky left-0 bg-card z-10 font-bold text-slate-700 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                                    <div className="flex flex-col">
                                                        <span>{swimmer.name}</span>
                                                        <span className="text-[9px] font-black text-primary uppercase">{swimmer.group}</span>
                                                    </div>
                                                </TableCell>
                                                {daysInMonth.map(day => {
                                                    const today = isToday(day);
                                                    const dateKey = format(day, 'yyyy-MM-dd');
                                                    const presence = attendanceByDate[dateKey]?.presences?.[swimmer.id!];
                                                    const { Icon, className, label } = getPresenceIcon(presence);
                                                    return (
                                                        <TableCell 
                                                            key={day.toString()} 
                                                            className={cn(
                                                                "text-center p-0 w-10",
                                                                today && "bg-primary/5 border-x border-primary/10"
                                                            )}
                                                        >
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleCyclePresence(swimmer.id!, day)}
                                                                        className={cn("h-10 w-full rounded-none hover:bg-slate-100", className)}
                                                                    >
                                                                        <Icon className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{label} le {format(day, 'dd MMMM', { locale: fr })}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableCell>
                                                    );
                                                })}
                                                <TableCell className="sticky right-0 bg-card z-10 text-center font-black text-primary border-l shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                                                    {totalForPercent > 0 ? `${presencePercentage.toFixed(0)}%` : '-'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                         </div>
                    </TooltipProvider>
                </div>
            )}
             {filteredAthletes.length === 0 && (
                <div className="card p-12 text-center text-muted-foreground flex flex-col items-center gap-4">
                    <Filter className="w-12 h-12 opacity-20" />
                    <p className="font-bold">Aucun athlète trouvé pour ce filtre.</p>
                </div>
             )}
             
             {yearlyAttendanceDocs && filteredAthletes.length > 0 && (
                <div className="card p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        Statistiques Annuelles ({format(currentMonth, 'yyyy')})
                        <span className="text-xs font-normal text-slate-400 uppercase tracking-widest ml-2">Groupe: {groupFilter}</span>
                    </h2>
                    <AttendanceStatsTable athletes={filteredAthletes} attendanceRecords={yearlyAttendanceDocs} />
                </div>
             )}
        </div>
    );
}

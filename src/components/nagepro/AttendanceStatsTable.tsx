'use client';

import type { Athlete, Attendance } from '@/lib/types';
import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

interface AttendanceStatsTableProps {
    athletes: Athlete[];
    attendanceRecords: Attendance[];
}

export default function AttendanceStatsTable({ athletes, attendanceRecords }: AttendanceStatsTableProps) {
    
    const stats = useMemo(() => {
        const athleteStats = athletes.map(athlete => {
            let present = 0;
            let absent = 0;
            
            attendanceRecords.forEach(rec => {
                const presence = rec.presences?.[athlete.id!];
                if (presence === 'present') {
                    present++;
                } else if (presence === 'absent') {
                    absent++;
                }
            });

            const totalSessionsWithPresence = present + absent;

            if (totalSessionsWithPresence === 0) {
                 return {
                    ...athlete,
                    present: 0,
                    absent: 0,
                    total: 0,
                    presencePercentage: 0,
                };
            }

            const presencePercentage = (present / totalSessionsWithPresence) * 100;
            
            return {
                ...athlete,
                present,
                absent,
                total: totalSessionsWithPresence,
                presencePercentage,
            }
        });

        const filteredStats = athleteStats.filter(stat => stat.total > 0);

        return filteredStats.sort((a,b) => b.presencePercentage - a.presencePercentage);

    }, [athletes, attendanceRecords]);

    if (!stats || stats.length === 0) {
        return <p className="text-muted-foreground">Aucune donnée de présence pour cette année.</p>;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[200px]">Athlète</TableHead>
                    <TableHead>Taux de Présence</TableHead>
                    <TableHead className="text-right">Détails (Présent / Total)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {stats.map(stat => (
                    <TableRow key={stat.id}>
                        <TableCell className="font-medium">{stat.name}</TableCell>
                        <TableCell>
                           <div className="flex items-center gap-4">
                                <Progress value={stat.presencePercentage} className="w-48" />
                                <span className="font-semibold">{stat.presencePercentage.toFixed(1)}%</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                            {stat.present} / {stat.total}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

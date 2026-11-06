"use client";

import type { Athlete, Presence } from '@/lib/types';
import { formatPace, ZONES_CONFIG } from '@/lib/swim-utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SwimmerListProps = {
  swimmers: Athlete[];
  swimmerPresence: Record<string, Presence>;
  groupByZone: string;
  onCyclePresence: (swimmerId: string) => void;
};

export default function SwimmerList({ swimmers, swimmerPresence, groupByZone, onCyclePresence }: SwimmerListProps) {
  
  const getPaceForZone = (swimmer: Athlete, zoneKey: string): number => {
    if (!swimmer.zones || !swimmer.cssPace) return Infinity;
    const zone = swimmer.zones[zoneKey];
    if (zone) {
      // Use the middle of the zone for sorting
      return (zone.min + zone.max) / 2;
    }
    return Infinity;
  };
  
  const getPresenceDetails = (presence: Presence) => {
    switch (presence) {
      case 'excluded':
        return {
          Icon: EyeOff,
          label: 'Exclu du calcul',
        };
      case 'absent':
        return {
          Icon: UserX,
          label: 'Absent',
        };
      case 'present':
      default:
        return {
          Icon: Eye,
          label: 'Présent',
        };
    }
  };

  const sorted = [...swimmers].sort((a, b) => getPaceForZone(a, groupByZone) - getPaceForZone(b, groupByZone));
  const maxLanes = 3;
  
  const presentSwimmers = sorted.filter(s => (swimmerPresence[s.id!] ?? 'present') !== 'absent');
  const swimmersPerLane = Math.ceil(presentSwimmers.length / maxLanes);

  const lanes = Array.from({ length: maxLanes }, (_, i) => {
    if (swimmersPerLane === 0) return [];
    return presentSwimmers.slice(i * swimmersPerLane, (i + 1) * swimmersPerLane);
  }).filter(lane => lane.length > 0);

  const getZoneLabel = (zone: string) => {
    const config = ZONES_CONFIG[zone as keyof typeof ZONES_CONFIG];
    return config ? config.label.substring(0, 2) : 'CSS';
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {lanes.map((lane, index) => {
        
        const swimmersForAverage = lane.filter(s => (swimmerPresence[s.id!] ?? 'present') === 'present' && s.cssPace);

        const avgCssPace = swimmersForAverage.length > 0
          ? swimmersForAverage.reduce((acc, curr) => acc + curr.cssPace!, 0) / swimmersForAverage.length
          : Infinity;
        
        const avgPaceForSelectedZone = swimmersForAverage.length > 0
            ? swimmersForAverage.reduce((acc, curr) => acc + getPaceForZone(curr, groupByZone), 0) / swimmersForAverage.length
            : Infinity;

        
        const laneZones = isFinite(avgCssPace) ? Object.keys(ZONES_CONFIG).reduce((acc, key) => {
            const zoneConfig = ZONES_CONFIG[key as keyof typeof ZONES_CONFIG];
            const minPace = avgCssPace / zoneConfig.maxPct;
            const maxPace = avgCssPace / zoneConfig.minPct;
            acc[key as keyof typeof ZONES_CONFIG] = { min: minPace, max: maxPace };
            return acc;
        }, {} as Record<keyof typeof ZONES_CONFIG, {min: number, max: number}>) : null;

        return (
          <div key={index} className="card p-0 flex flex-col overflow-hidden">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-primary text-lg">Ligne {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full font-semibold">
                      {swimmersForAverage.length > 0 ? `Moy. (${getZoneLabel(groupByZone)}): ${formatPace(avgPaceForSelectedZone)}` : 'Ligne vide'}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">({swimmersForAverage.length}/{lane.length})</span>
                  </div>
              </div>
              <div className="space-y-1">
                {lane.map(s => {
                  const presence = swimmerPresence[s.id!] || 'present';
                  const { Icon: PresenceIcon, label: presenceLabel } = getPresenceDetails(presence);
                  const genderColor = s.gender === 'F' ? 'bg-pink-500' : 'bg-primary';
                  
                  return (
                      <div 
                        key={s.id} 
                        className={cn(
                            "flex justify-between items-center text-sm p-2 rounded-md hover:bg-slate-100 transition-colors",
                             presence === 'excluded' && "opacity-60"
                        )}
                      >
                          <a href={`#swimmer-card-${s.id}`} className="flex items-center gap-2 min-w-0 flex-grow">
                              <span className={`h-2.5 w-2.5 rounded-full ${genderColor} flex-shrink-0`}></span>
                              <span className="font-medium truncate">{s.name}</span>
                          </a>
                          
                          <div className="flex items-center gap-1 flex-shrink-0">
                               <span className="font-mono text-sm font-medium">{formatPace(getPaceForZone(s, groupByZone))}</span>
                               <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onCyclePresence(s.id!)}
                                  className="h-7 w-7 text-slate-500 hover:bg-slate-200"
                                  title={`Statut: ${presenceLabel}. Cliquer pour changer.`}
                               >
                                  <PresenceIcon className="h-4 w-4" />
                                </Button>
                          </div>
                      </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-auto border-t bg-slate-50/50">
                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1" className="border-b-0">
                        <AccordionTrigger className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:no-underline [&[data-state=open]>svg]:text-primary" disabled={swimmersForAverage.length === 0}>
                            {swimmersForAverage.length > 0 ? "Afficher les allures de la ligne" : "Aucun nageur pour la moyenne"}
                        </AccordionTrigger>
                        <AccordionContent className="p-0 bg-white">
                             {laneZones && (
                               <Table>
                                  <TableBody>
                                      {Object.entries(laneZones).map(([key, zoneData]) => {
                                          const zoneConfig = ZONES_CONFIG[key as keyof typeof ZONES_CONFIG];
                                          return (
                                              <TableRow key={key} className="border-b last:border-b-0">
                                                  <TableCell className={`p-2 font-bold text-xs w-10 ${zoneConfig.color}`}>{zoneConfig.label.substring(0, 2)}</TableCell>
                                                  <TableCell className="p-2 text-[11px] text-slate-500 leading-tight">{zoneConfig.desc}</TableCell>
                                                  <TableCell className="p-2 text-right font-mono font-bold text-slate-800 text-sm tracking-tighter">
                                                     {isFinite(zoneData.max) ? `${formatPace(zoneData.min)} - ${formatPace(zoneData.max)}` : `< ${formatPace(zoneData.min)}`}
                                                  </TableCell>
                                              </TableRow>
                                          )
                                      })}
                                  </TableBody>
                              </Table>
                             )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
          </div>
        )
      })}
    </div>
  );
}


"use client";

import React from 'react';
import type { Athlete } from '@/lib/types';
import { ASNS_OBJECTIVES } from '@/lib/swim-utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AsnsGridProps {
  athletes: Athlete[];
}

export default function AsnsGrid({ athletes }: AsnsGridProps) {
  const { firestore, user } = useFirebase();

  const handleToggleSkill = (athlete: Athlete, skill: string) => {
    if (!firestore || !user || !athlete.id) return;
    const currentSkills = athlete.skills || {};
    const newSkills = { ...currentSkills, [skill]: !currentSkills[skill] };
    const athleteDocRef = doc(firestore, 'users', user.uid, 'athletes', athlete.id);
    updateDocumentNonBlocking(athleteDocRef, { skills: newSkills });
  };

  const handleUpdateEvaluator = (athlete: Athlete, evaluator: string) => {
    if (!firestore || !user || !athlete.id) return;
    const athleteDocRef = doc(firestore, 'users', user.uid, 'athletes', athlete.id);
    updateDocumentNonBlocking(athleteDocRef, { evaluator });
  };

  const isValidated = (athlete: Athlete) => {
    return ASNS_OBJECTIVES.every(obj => athlete.skills?.[obj]);
  };

  return (
    <div className="bg-white rounded-xl border shadow-xl overflow-hidden font-sans">
      <div className="bg-slate-50 border-b p-4 text-center">
        <h2 className="text-3xl font-black uppercase tracking-tighter">GRILLE EVALUATION ASNS</h2>
      </div>
      
      <div className="overflow-x-auto">
        <TooltipProvider delayDuration={100}>
          <Table className="border-collapse text-[11px]">
            <TableHeader className="bg-slate-100">
              <TableRow className="divide-x divide-slate-300">
                <TableHead className="w-8 text-center bg-slate-200 font-black">Nb</TableHead>
                <TableHead className="w-40 font-black uppercase">Nom & Prénom</TableHead>
                <TableHead className="w-8 text-center font-black">Gen.</TableHead>
                <TableHead className="w-12 text-center font-black">Année</TableHead>
                <TableHead className="w-24 text-center bg-slate-200 font-black flex items-center justify-center">
                   <span className="-rotate-45 inline-block origin-center whitespace-nowrap">Evaluateur</span>
                </TableHead>
                
                {/* PARCOURS AQUATIQUE */}
                <TableHead colSpan={11} className="text-center font-black uppercase tracking-widest bg-blue-50 border-b-2 border-blue-200">
                  Parcours Aquatique
                </TableHead>
                
                {/* CONN & ATTITUDE */}
                <TableHead colSpan={3} className="text-center font-black uppercase tracking-widest bg-emerald-50 border-b-2 border-emerald-200">
                  Conn & Attitude
                </TableHead>
                
                <TableHead className="w-24 text-center font-black bg-slate-200">Validation</TableHead>
              </TableRow>
              <TableRow className="divide-x divide-slate-300 text-[9px] uppercase font-bold text-slate-500 bg-slate-50">
                <TableCell colSpan={5} className="bg-white"></TableCell>
                {ASNS_OBJECTIVES.map((obj, i) => (
                  <TableCell key={i} className="text-center p-0.5 min-w-[30px] h-20 relative">
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <div className="absolute inset-0 flex items-center justify-center p-1 cursor-help hover:bg-slate-100">
                             <span className="text-slate-900 font-black text-xs">{i + 1}</span>
                           </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                           <p className="font-bold">{i + 1}. {obj}</p>
                        </TooltipContent>
                     </Tooltip>
                  </TableCell>
                ))}
                <TableCell className="bg-white"></TableCell>
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {athletes.map((athlete, idx) => {
                const validated = isValidated(athlete);
                return (
                  <TableRow key={athlete.id} className="divide-x divide-slate-200 hover:bg-slate-50 transition-colors">
                    <TableCell className="text-center font-bold bg-slate-50">{idx + 1}</TableCell>
                    <TableCell className="font-black uppercase">{athlete.name}</TableCell>
                    <TableCell className={cn(
                      "text-center font-black",
                      athlete.gender === 'F' ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {athlete.gender}
                    </TableCell>
                    <TableCell className="text-center font-mono">{athlete.birthYear || '----'}</TableCell>
                    <TableCell className="p-1">
                       <Select 
                        value={athlete.evaluator || ""} 
                        onValueChange={(val) => handleUpdateEvaluator(athlete, val)}
                       >
                          <SelectTrigger className="h-6 text-[10px] border-none shadow-none bg-transparent">
                             <SelectValue placeholder="..." />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="MNS 1">MNS 1</SelectItem>
                             <SelectItem value="MNS 2">MNS 2</SelectItem>
                             <SelectItem value="Coach">Coach</SelectItem>
                          </SelectContent>
                       </Select>
                    </TableCell>
                    
                    {/* CHECKBOXES 1-14 */}
                    {ASNS_OBJECTIVES.map((obj) => (
                      <TableCell key={obj} className="text-center p-0">
                        <div className="flex items-center justify-center w-full h-full p-2">
                           <Checkbox 
                              checked={!!athlete.skills?.[obj]} 
                              onCheckedChange={() => handleToggleSkill(athlete, obj)}
                              className="h-4 w-4 border-slate-400"
                           />
                        </div>
                      </TableCell>
                    ))}
                    
                    <TableCell className="p-0">
                       <div className={cn(
                         "h-full w-full py-2 px-1 text-center font-black uppercase text-[10px] flex items-center justify-center min-h-[40px]",
                         validated ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                       )}>
                         {validated ? "Validé" : "En cours"}
                       </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
      
      <div className="p-4 bg-slate-50 text-[10px] text-slate-400 italic">
        * Cette grille suit le référentiel officiel de l'Attestation du Savoir-Nager en Sécurité (ASNS).
      </div>
    </div>
  );
}

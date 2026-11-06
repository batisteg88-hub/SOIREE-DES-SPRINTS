
'use client';

import React, { useState } from 'react';
import type { 
  WorkoutSet, 
  WorkoutSegment, 
  Stroke, 
  Zone, 
  Material, 
  WorkType 
} from '@/lib/types';
import { 
  STROKE_LABELS, 
  ZONES_CONFIG, 
  MATERIAL_LABELS, 
  MATERIAL_SHORT_LABELS,
  WORK_TYPE_SHORT_LABELS,
  formatPace 
} from '@/lib/swim-utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Tag,
  Split,
  Info,
  Undo2,
  LayoutGrid,
  MousePointer2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger, 
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

interface WorkoutSetRowProps {
  set: WorkoutSet;
  onUpdate: (newData: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  squadPaces: Record<string, { p100: number }> | null;
}

export default function WorkoutSetRow({ set, onUpdate, onDelete, squadPaces }: WorkoutSetRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [paceRef, setPaceRef] = useState<100 | 200 | 400>(100);

  const isSequence = set.reps === 1 && (set.repetitionSize || 0) > 0;
  const repSize = set.repetitionSize || 1;
  
  const displayReps = isSequence ? (set.segments.length / repSize) : set.reps;
  const templateSegments = isSequence ? set.segments.slice(0, repSize) : set.segments;
  const isDecomposed = templateSegments.length > 1;
  const totalDistance = templateSegments.reduce((acc, seg) => acc + seg.distance, 0);
  
  const checkSegmentConsistency = (sIdx: number) => {
    if (!isSequence) return { zone: true, workType: true, stroke: true };
    const baseSeg = set.segments[sIdx];
    let zoneConsistent = true;
    let typeConsistent = true;
    let strokeConsistent = true;
    
    for (let i = sIdx + repSize; i < set.segments.length; i += repSize) {
      if (set.segments[i].zone !== baseSeg.zone) zoneConsistent = false;
      if (set.segments[i].workType !== baseSeg.workType) typeConsistent = false;
      if (set.segments[i].stroke !== baseSeg.stroke) strokeConsistent = false;
    }
    return { zone: zoneConsistent, workType: typeConsistent, stroke: strokeConsistent };
  };

  const allStrokesIdentical = set.segments.length > 0 && set.segments.every(s => s.stroke === set.segments[0].stroke);

  const calculateSetTimes = () => {
    let totalSwimTime = 0;
    
    if (isSequence) {
        set.segments.forEach(seg => {
            const p100 = squadPaces?.[seg.zone]?.p100 || 90;
            const sTime = (seg.distance / 100) * p100;
            totalSwimTime += sTime;
        });
    } else {
        let oneRepSwimTime = 0;
        set.segments.forEach(seg => {
            const p100 = squadPaces?.[seg.zone]?.p100 || 90;
            oneRepSwimTime += (seg.distance / 100) * p100;
        });
        totalSwimTime = oneRepSwimTime * set.reps;
    }
    
    return { totalSwimTime };
  };

  const times = calculateSetTimes();

  const handleRepsChange = (newVal: number) => {
    if (newVal < 1) return;
    if (isSequence) {
      const currentReps = set.segments.length / repSize;
      if (newVal > currentReps) {
        let newSegments = [...set.segments];
        const template = set.segments.slice(0, repSize);
        for (let i = 0; i < newVal - currentReps; i++) {
          template.forEach((seg, sIdx) => {
            newSegments.push({
              ...seg,
              id: `seg-${Date.now()}-${currentReps + i}-${sIdx}`,
            });
          });
        }
        onUpdate({ segments: newSegments });
      } else if (newVal < currentReps) {
        onUpdate({ segments: set.segments.slice(0, newVal * repSize) });
      }
    } else {
      onUpdate({ reps: newVal });
    }
  };

  const updateSegment = (segId: string, newData: Partial<WorkoutSegment>) => {
    if (isSequence) {
      const segIndex = set.segments.findIndex(s => s.id === segId);
      if (segIndex !== -1 && segIndex < repSize) {
        const newSegments = [...set.segments];
        for (let i = 0; i < set.segments.length; i += repSize) {
          const targetIndex = i + segIndex;
          if (targetIndex < newSegments.length) {
            newSegments[targetIndex] = { ...newSegments[targetIndex], ...newData };
          }
        }
        onUpdate({ segments: newSegments });
      }
    } else {
      onUpdate({
        segments: set.segments.map(s => s.id === segId ? { ...s, ...newData } : s)
      });
    }
  };

  const updateAllSegments = (newData: Partial<WorkoutSegment>) => {
    onUpdate({
      segments: set.segments.map(s => ({ ...s, ...newData }))
    });
  };

  const updateSpecificRepetition = (repIndex: number, newData: Partial<WorkoutSegment>) => {
    const startIndex = repIndex * repSize;
    const newSegments = [...set.segments];
    for (let i = startIndex; i < startIndex + repSize && i < newSegments.length; i++) {
      newSegments[i] = { ...newSegments[i], ...newData };
    }
    onUpdate({ segments: newSegments });
  };

  const updateSpecificRepetitionRest = (repIndex: number, rest: number) => {
    const startIndex = repIndex * repSize;
    const lastIndexInRep = startIndex + repSize - 1;
    const newSegments = [...set.segments];
    if (newSegments[lastIndexInRep]) {
        newSegments[lastIndexInRep] = { ...newSegments[lastIndexInRep], rest };
        onUpdate({ segments: newSegments });
    }
  };

  const toggleRepetitionMaterial = (repIndex: number, material: Material) => {
    const startIndex = repIndex * repSize;
    const firstSegOfRep = set.segments[startIndex];
    if (!firstSegOfRep) return;

    const currentMaterials = firstSegOfRep.material || [];
    const isSelected = currentMaterials.includes(material);
    const nextMaterials = isSelected 
        ? currentMaterials.filter(item => item !== material)
        : Array.from(new Set([...currentMaterials, material]));

    updateSpecificRepetition(repIndex, { material: nextMaterials });
  };

  const toggleAllMaterials = (m: Material) => {
    const isSelected = set.segments[0].material.includes(m);
    const newSegments = set.segments.map(s => {
        const currentMaterials = s.material || [];
        const nextMaterials = isSelected 
            ? currentMaterials.filter(item => item !== m)
            : Array.from(new Set([...currentMaterials, m]));
        return { ...s, material: nextMaterials };
    });
    onUpdate({ segments: newSegments });
  };

  const addSegment = () => {
    const lastSeg = templateSegments[templateSegments.length - 1];
    let newSegments = [...set.segments];
    
    if (isSequence) {
        const updatedSegments: WorkoutSegment[] = [];
        const currentRepsCount = set.segments.length / repSize;
        for (let i = 0; i < currentRepsCount; i++) {
            const currentRep = set.segments.slice(i * repSize, (i + 1) * repSize);
            const lastRepSeg = currentRep[currentRep.length - 1];
            updatedSegments.push(...currentRep);
            updatedSegments.push({
                id: `seg-${Date.now()}-${i}-new`,
                distance: 50,
                stroke: lastRepSeg?.stroke || 'CRAWL',
                workType: lastRepSeg?.workType || 'FULL',
                zone: lastRepSeg?.zone || 'z2',
                material: lastRepSeg?.material || [],
                rest: 0
            });
        }
        onUpdate({ segments: updatedSegments, repetitionSize: repSize + 1 });
    } else {
        if (lastSeg && lastSeg.distance > 25) {
          const half = Math.floor(lastSeg.distance / 2);
          newSegments[newSegments.length - 1] = { ...lastSeg, distance: lastSeg.distance - half };
          newSegments.push({
            ...lastSeg,
            id: `seg-${Date.now()}`,
            distance: half,
            rest: 0,
            material: lastSeg.material || []
          });
        } else {
          newSegments.push({
            id: `seg-${Date.now()}`,
            distance: 50,
            stroke: lastSeg?.stroke || 'CRAWL',
            workType: lastSeg?.workType || 'FULL',
            zone: lastSeg?.zone || 'z2',
            material: lastSeg?.material || [],
            rest: 0
          });
        }
        onUpdate({ segments: newSegments });
    }
    setIsExpanded(true);
  };

  const undoLastSplit = () => {
    if (templateSegments.length <= 1) return;
    
    if (isSequence) {
        const updatedSegments: WorkoutSegment[] = [];
        const currentRepsCount = set.segments.length / repSize;
        for (let i = 0; i < currentRepsCount; i++) {
            const currentRep = set.segments.slice(i * repSize, (i + 1) * repSize);
            const removed = currentRep.pop()!;
            const lastRemaining = { ...currentRep[currentRep.length - 1] };
            lastRemaining.distance += removed.distance;
            currentRep[currentRep.length - 1] = lastRemaining;
            updatedSegments.push(...currentRep);
        }
        onUpdate({ segments: updatedSegments, repetitionSize: repSize - 1 });
    } else {
        const newSegments = [...set.segments];
        const removed = newSegments.pop()!;
        const lastRemaining = { ...newSegments[newSegments.length - 1] };
        lastRemaining.distance += removed.distance;
        newSegments[newSegments.length - 1] = lastRemaining;
        onUpdate({ segments: newSegments });
    }
  };

  const toggleSequenceMode = () => {
    if (isSequence) {
      const firstRepSegments = set.segments.slice(0, repSize).map(s => ({...s, rest: 0}));
      onUpdate({
        reps: Math.max(1, Math.floor(set.segments.length / repSize)),
        segments: firstRepSegments,
        repetitionSize: undefined
      });
      setIsExpanded(false);
    } else {
      const currentRepSize = set.segments.length;
      const repsCount = set.reps > 1 ? set.reps : 4;
      const newSegments: WorkoutSegment[] = [];
      
      for (let i = 0; i < repsCount; i++) {
        set.segments.forEach((seg, sIdx) => {
          newSegments.push({
            ...seg,
            id: `seg-${Date.now()}-${i}-${sIdx}`,
            rest: (sIdx === currentRepSize - 1 && i < repsCount - 1) ? set.rest : (seg.rest || 0)
          });
        });
      }
      
      onUpdate({ 
        reps: 1, 
        segments: newSegments, 
        repetitionSize: currentRepSize 
      });
      setIsExpanded(true);
    }
  };

  const groupedRepetitions = [];
  if (isSequence) {
    for (let i = 0; i < set.segments.length; i += repSize) {
      groupedRepetitions.push(set.segments.slice(i, i + repSize));
    }
  }

  const materialOptions = Object.entries(MATERIAL_LABELS).filter(([k]) => k !== 'NONE');

  const mainMaterials = set.segments[0]?.material || [];
  const mainMaterialLabel = mainMaterials.length > 0 
    ? mainMaterials.map(m => MATERIAL_SHORT_LABELS[m]).join('+')
    : "Matériel";

  return (
    <div className={cn(
        "bg-white border-2 rounded-xl p-4 shadow-sm transition-all group/row",
        isExpanded ? "border-primary/30 ring-4 ring-primary/5" : "border-slate-100 hover:border-primary/20"
    )}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Input 
            type="number" 
            value={displayReps} 
            onChange={e => handleRepsChange(parseInt(e.target.value) || 1)}
            className={cn(
              "w-12 h-10 text-center font-black text-lg border-primary/20 bg-primary/5 text-primary",
              isSequence && "bg-amber-50 border-amber-200 text-amber-700"
            )}
          />
          <span className="font-black text-slate-300">x</span>
        </div>

        <div className="flex-grow">
          <div className="flex items-center gap-2">
                {isDecomposed && (
                  <div className="flex items-center gap-1 text-sm font-black text-slate-700 whitespace-nowrap">
                    <span>{totalDistance}</span>
                    <span className="text-slate-400 font-bold lowercase">en</span>
                  </div>
                )}

                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all",
                  "border-dashed bg-slate-100/50 border-slate-200",
                  isSequence && "border-amber-200 bg-amber-50/30"
                )}>
                  {isDecomposed && <span className="text-slate-400 font-black text-[10px] ml-1">(</span>}
                  {templateSegments.map((seg, sIdx) => {
                    const { zone: zoneConsistent, workType: typeConsistent } = checkSegmentConsistency(sIdx);
                    
                    return (
                      <React.Fragment key={seg.id}>
                        {sIdx > 0 && <span className="text-slate-300 font-black text-xs mx-0.5">+</span>}
                        
                        <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-md shadow-sm border border-slate-100 group/seg-pill">
                          <Input 
                              type="number" 
                              value={seg.distance} 
                              onChange={(e) => updateSegment(seg.id, { distance: parseInt(e.target.value) || 0 })}
                              className="w-10 h-6 border-none bg-transparent font-black p-0 focus-visible:ring-0 text-center text-xs"
                          />
                          
                          <div className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-colors",
                            zoneConsistent ? ZONES_CONFIG[seg.zone].bg : "bg-slate-200",
                            zoneConsistent ? ZONES_CONFIG[seg.zone].color : "text-slate-500"
                          )}>
                            <Select 
                                value={typeConsistent ? seg.workType : ""} 
                                onValueChange={val => updateSegment(seg.id, { workType: val as WorkType })}
                            >
                                <SelectTrigger className="h-4 w-auto border-none bg-transparent p-0 text-[10px] font-black focus:ring-0 shadow-none gap-1 [&>svg]:hidden lowercase">
                                    <SelectValue placeholder="MIX" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(WORK_TYPE_SHORT_LABELS).map(([k, v]) => (
                                        <SelectItem key={k} value={k} className="text-[10px] font-bold">{v}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select 
                                value={zoneConsistent ? seg.zone : ""} 
                                onValueChange={val => updateSegment(seg.id, { zone: val as Zone })}
                            >
                                <SelectTrigger className="h-4 w-auto border-none bg-transparent p-0 text-[10px] font-black focus:ring-0 shadow-none [&>svg]:hidden uppercase">
                                    <SelectValue placeholder="Z?" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(ZONES_CONFIG).map(([k, v]) => (
                                        <SelectItem key={k} value={k} className="text-[10px] font-black uppercase">{k}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })}
                  {isDecomposed && <span className="text-slate-400 font-black text-[10px] mr-1">)</span>}
                  <span className="text-[10px] font-black text-slate-400 uppercase mr-1">m</span>
                </div>

                <div className="flex gap-0.5">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={addSegment}
                    className="h-7 w-7 text-primary hover:bg-primary/10 transition-transform active:scale-95"
                  >
                    <Split className="w-3.5 h-3.5" />
                  </Button>

                  {templateSegments.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={undoLastSplit}
                      className="h-7 w-7 text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-transform active:scale-95"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleSequenceMode}
                  className={cn(
                    "h-7 w-7 text-[8px] uppercase font-black p-0 transition-all shrink-0",
                    isSequence ? "bg-amber-500 text-white border-amber-600" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  )}
                  title={isSequence ? "Mode Simple" : "Mode Séquence"}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </Button>
                
                <Select 
                  value={allStrokesIdentical ? set.segments[0].stroke : ""} 
                  onValueChange={val => updateAllSegments({ stroke: val as Stroke })}
                >
                  <SelectTrigger className="w-28 h-9 font-bold [&>svg]:hidden text-xs">
                    <SelectValue placeholder="Nages mixtes" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STROKE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs font-bold">{v}</SelectItem>)}
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className={cn(
                      "h-9 text-[10px] font-black gap-1.5 transition-colors bg-white min-w-[80px]",
                      mainMaterials.length > 0 ? "bg-primary/10 border-primary text-primary" : "text-slate-500"
                    )}>
                      <Tag className="w-3 h-3" /> 
                      <span className="truncate max-w-[120px]">
                        {mainMaterialLabel}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    <DropdownMenuLabel className="text-[10px] font-black text-slate-400 uppercase">Équipement</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {materialOptions.map(([k, v]) => {
                      const isChecked = set.segments[0].material.includes(k as Material);
                      return (
                        <DropdownMenuCheckboxItem
                          key={k}
                          id={`mat-${set.id}-${k}`}
                          checked={isChecked}
                          onCheckedChange={() => toggleAllMaterials(k as Material)}
                          onSelect={(e) => e.preventDefault()}
                          className="text-xs font-bold"
                        >
                          {v}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {!isSequence && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase">Repos</span>
              <Input 
                type="number" 
                value={set.rest} 
                onChange={e => onUpdate({ rest: parseInt(e.target.value) || 0 })}
                className="w-12 h-8 text-center font-bold text-sm"
              />
            </div>
          )}
          <div className="text-right flex flex-col items-end min-w-[100px]">
            <div className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">
                Nage Totale
            </div>
            <div className="font-mono font-black text-primary text-sm leading-none">
                {formatPace(times.totalSwimTime)}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsExpanded(!isExpanded)} 
              className={cn("h-8 w-8 transition-colors", isExpanded ? "text-primary" : "text-slate-400")}
            >
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-destructive/30 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-dashed space-y-4 animate-in slide-in-from-top-2 duration-200">
          {isSequence && (
            <div className="flex flex-wrap gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
              {groupedRepetitions.map((repSegments, repIdx) => {
                const firstSeg = repSegments[0];
                const lastSeg = repSegments[repSegments.length - 1];
                const repMats = firstSeg.material || [];
                const repMatLabel = repMats.length > 0 
                  ? repMats.map(m => MATERIAL_SHORT_LABELS[m]).join('+')
                  : "";

                const repDist = repSegments.reduce((acc, s) => acc + s.distance, 0);
                const repTime = repSegments.reduce((acc, s) => {
                    const p100 = squadPaces?.[s.zone]?.p100 || 90;
                    return acc + (s.distance / 100) * p100;
                }, 0);
                const scaledPace = (paceRef / (repDist || 1)) * repTime;
                const repDeparture = repTime + (lastSeg.rest || 0);

                return (
                  <div key={repIdx} className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden h-14">
                    <div className="bg-slate-900 text-white text-[10px] font-black uppercase h-full px-2 flex items-center justify-center min-w-[2rem] border-r">
                      {repIdx + 1}
                    </div>
                    
                    <Select 
                      value={firstSeg.stroke} 
                      onValueChange={val => updateSpecificRepetition(repIdx, { stroke: val as Stroke })}
                    >
                      <SelectTrigger className="w-[90px] h-full text-[10px] font-bold bg-transparent border-none shadow-none focus:ring-0 [&>svg]:hidden px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STROKE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-[10px] font-bold">{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className={cn(
                      "flex items-center gap-1 h-full px-2 border-slate-100",
                      "border-l border-r",
                      ZONES_CONFIG[firstSeg.zone].bg,
                      ZONES_CONFIG[firstSeg.zone].color
                    )}>
                      <Select 
                        value={firstSeg.workType} 
                        onValueChange={val => updateSpecificRepetition(repIdx, { workType: val as WorkType })}
                      >
                        <SelectTrigger className="h-full w-auto border-none bg-transparent p-0 text-[9px] font-black focus:ring-0 shadow-none [&>svg]:hidden lowercase">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(WORK_TYPE_SHORT_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-[10px] font-bold">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select 
                        value={firstSeg.zone} 
                        onValueChange={val => updateSpecificRepetition(repIdx, { zone: val as Zone })}
                      >
                        <SelectTrigger className="h-full w-auto border-none bg-transparent p-0 text-[10px] font-black focus:ring-0 shadow-none [&>svg]:hidden uppercase">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ZONES_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-[10px] font-black uppercase">{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className={cn(
                          "h-full px-2 rounded-none border-l hover:bg-slate-50 transition-colors gap-1.5",
                          repMats.length > 0 ? "text-primary bg-primary/5 min-w-[40px]" : "text-slate-300 w-8"
                        )}>
                          <Tag className="w-3 h-3" />
                          {repMats.length > 0 && (
                            <span className="text-[8px] font-black uppercase tracking-tighter truncate max-w-[60px]">
                              {repMatLabel}
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-48" align="start">
                        <DropdownMenuLabel className="text-[9px] font-black text-slate-400 uppercase px-2 py-1.5">Équipement spécifique #{repIdx + 1}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {materialOptions.map(([k, v]) => {
                          const isChecked = firstSeg.material.includes(k as Material);
                          return (
                            <DropdownMenuCheckboxItem
                              key={k}
                              id={`mat-${set.id}-${repIdx}-${k}`}
                              checked={isChecked}
                              onCheckedChange={() => toggleRepetitionMaterial(repIdx, k as Material)}
                              onSelect={(e) => e.preventDefault()}
                              className="text-[10px] font-bold"
                            >
                              {v}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex items-center px-2 h-full border-l bg-slate-50/50">
                        <span className="text-[8px] font-black text-slate-400 mr-1 uppercase">R:</span>
                        <Input 
                            type="number" 
                            value={lastSeg.rest || 0} 
                            onChange={e => updateSpecificRepetitionRest(repIdx, parseInt(e.target.value) || 0)}
                            className="w-8 h-full border-none bg-transparent p-0 text-[10px] font-black focus-visible:ring-0 text-center"
                        />
                    </div>

                    <div className="flex flex-col items-end justify-center min-w-[160px] border-l h-full px-3 gap-0.5">
                        <div className="flex items-center justify-between w-full">
                            <span className="text-[9px] font-black text-slate-400 uppercase">Nage</span>
                            <span className="text-[12px] font-mono font-black text-primary leading-none">{formatPace(repTime)}</span>
                        </div>
                        <div className="flex items-center justify-between w-full border-t border-slate-100 pt-0.5">
                            <span className="text-[9px] font-black text-emerald-600 uppercase">Départ</span>
                            <span className="text-[12px] font-mono font-black text-emerald-700 leading-none">{formatPace(repDeparture)}</span>
                        </div>
                        <Button 
                            variant="secondary" 
                            className="h-5 w-full p-0 bg-slate-100 hover:bg-slate-200 text-[9px] font-black text-slate-500 uppercase rounded-md transition-colors mt-0.5"
                            onClick={() => setPaceRef(p => p === 100 ? 200 : p === 200 ? 400 : 100)}
                            title="Basculer l'allure de référence (100/200/400m)"
                        >
                            <MousePointer2 className="w-2.5 h-2.5 mr-1" />
                            /{paceRef}m: {formatPace(scaledPace)}
                        </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center flex-grow">
              <Info className="w-3.5 h-3.5 text-slate-300" />
              <Input 
                placeholder="Consignes techniques (ex: Respi 3/5/7)..." 
                value={set.notes || ''} 
                onChange={e => onUpdate({ notes: e.target.value })}
                className="h-8 text-xs w-full max-w-md italic bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

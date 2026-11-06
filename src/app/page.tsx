
"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import type { Athlete, Performance, Group } from '@/lib/types';
import { useToast } from "@/hooks/use-toast"
import {
  useFirebase,
  useCollection,
  deleteDocumentNonBlocking,
  useMemoFirebase,
} from '@/firebase';
import { collection, doc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { calculateAdvancedSwimmingProfile, formatPace, GROUP_CONFIG } from '@/lib/swim-utils';
import AuthGuard from '@/components/auth/AuthGuard';

import Header from '@/components/nagepro/Header';
import AthleteForm from '@/components/nagepro/SwimmerForm';
import SquadChart from '@/components/nagepro/ZonesChart';
import { UserPlus, Trash2, Users2, TrendingUp, ArrowRight, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startOfDay } from 'date-fns';
import Link from 'next/link';

function HomePageContent() {
  const { toast } = useToast();
  const { firestore, user } = useFirebase();

  const [isSeeding, setIsSeeding] = useState(false);
  const seedingStarted = useRef(false);

  const athletesCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'athletes');
  }, [firestore, user]);

  const { data: allAthletes, isLoading: athletesLoading } = useCollection<Athlete>(athletesCollection);

  useEffect(() => {
    const seedData = async () => {
        if (!firestore || !user || seedingStarted.current) return;
        
        seedingStarted.current = true;
        setIsSeeding(true);

        const athletesToAdd: { name: string; time: number; gender: 'M' | 'F' }[] = [
            { name: "Eléonore", time: 321.81, gender: 'F' },
            { name: "Julie", time: 322.17, gender: 'F' },
            { name: "Noé", time: 287.56, gender: 'M' },
            { name: "Irshad", time: 333.38, gender: 'M' },
            { name: "FANNY", time: 331.22, gender: 'F' },
            { name: "Clara", time: 336.38, gender: 'F' },
            { name: "Cléo", time: 346.69, gender: 'F' },
            { name: "Nicolas", time: 358.31, gender: 'M' },
            { name: "Juline", time: 343.47, gender: 'F' },
            { name: "Stela", time: 343.65, gender: 'F' },
            { name: "Mégane", time: 382.00, gender: 'F' },
            { name: "Maëlle", time: 389.10, gender: 'F' },
            { name: "Hubert", time: 405.00, gender: 'M' },
            { name: "Adrian", time: 381.47, gender: 'M' },
            { name: "Armelle", time: 396.11, gender: 'F' },
            { name: "CLEMENT", time: 369.40, gender: 'M' },
            { name: "Ewan", time: 360.89, gender: 'M' },
            { name: "Lucas", time: 355.56, gender: 'M' },
        ];

        toast({
            title: "Mise à jour du profil Coach",
            description: "Importation des données N4 en cours...",
        });

        const now = Timestamp.fromDate(startOfDay(new Date()));

        for (const athleteData of athletesToAdd) {
            try {
                const exists = allAthletes?.some(a => a.name.toLowerCase() === athleteData.name.toLowerCase());
                if (exists) continue;

                const athletesCollectionRef = collection(firestore, 'users', user.uid, 'athletes');
                
                const newAthleteData = {
                    ownerId: user.uid,
                    name: athleteData.name,
                    group: 'N4' as Group,
                    gender: athleteData.gender,
                };
                
                const docRef = await addDoc(athletesCollectionRef, newAthleteData);

                const performancesCollectionRef = collection(firestore, 'users', user.uid, 'athletes', docRef.id, 'performances');
                const newPerf: Omit<Performance, 'id'> = { 
                    distance: 400, 
                    timeInSeconds: athleteData.time, 
                    date: now
                };
                const perfDocRef = await addDoc(performancesCollectionRef, newPerf);
                const perfWithId: Performance = { ...newPerf, id: perfDocRef.id };

                const newProfile = calculateAdvancedSwimmingProfile([perfWithId]);

                if (newProfile) {
                    await updateDoc(docRef, { ...newProfile });
                }

            } catch (error) {
                console.error(`Failed to seed athlete ${athleteData.name}:`, error);
            }
        }
        
        toast({
            title: "Données prêtes",
            description: "Les nageurs ont été restaurés avec succès.",
        });
        setIsSeeding(false);
    };

    if (allAthletes && allAthletes.length === 0 && !athletesLoading && !isSeeding && !seedingStarted.current) {
        seedData();
    }
  }, [firestore, user, allAthletes, athletesLoading, toast, isSeeding]);

  const handleCleanupDuplicates = () => {
    if (!allAthletes || !firestore || !user) return;
    const seenNames = new Set<string>();
    const duplicates: string[] = [];
    const sorted = [...allAthletes].sort((a, b) => a.name.localeCompare(b.name));
    for (const swimmer of sorted) {
      if (seenNames.has(swimmer.name)) {
        if (swimmer.id) duplicates.push(swimmer.id);
      } else {
        seenNames.add(swimmer.name);
      }
    }
    if (duplicates.length === 0) {
      toast({ title: "Aucun doublon trouvé" });
      return;
    }
    toast({ title: "Nettoyage", description: `Suppression de ${duplicates.length} doublons...` });
    for (const id of duplicates) {
      const docRef = doc(firestore, 'users', user.uid, 'athletes', id);
      deleteDocumentNonBlocking(docRef);
    }
  };

  const handleAddAthlete = (name: string, group: Group, gender: 'M' | 'F') => {
    if (!firestore || !user || !athletesCollection) return;
    const exists = allAthletes?.some(a => a.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        toast({ variant: "destructive", title: "Déjà présent", description: `${name} existe déjà dans la base.` });
        return;
    }
    try {
      const newAthlete: Omit<Athlete, 'id'> = {
        ownerId: user.uid,
        name,
        group,
        gender,
      };
      addDoc(athletesCollection, newAthlete);
      toast({ title: "Athlète ajouté", description: `${name} est maintenant dans la base.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  const groupStats = useMemo(() => {
    if (!allAthletes) return [];
    return (['NV1', 'NV1+', 'NV2', 'N3', 'N4', 'N1'] as const).map(group => {
        const swimmers = allAthletes.filter(a => a.group === group && a.cssPace && isFinite(a.cssPace));
        const avgPace = swimmers.length > 0 
            ? swimmers.reduce((acc, s) => acc + s.cssPace!, 0) / swimmers.length 
            : null;
        return { 
            group, 
            count: allAthletes.filter(a => a.group === group).length, 
            avgPace,
            config: GROUP_CONFIG[group]
        };
    });
  }, [allAthletes]);

  if (athletesLoading && !allAthletes) {
    return <div className="text-center p-12 text-slate-500">Synchronisation des données...</div>;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <AuthGuard>
        <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
                <div className="lg:col-span-4 card p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-3 text-slate-800">
                        <UserPlus className="text-primary"/>
                        Ajouter un athlète
                    </h2>
                    <AthleteForm onSubmit={handleAddAthlete} buttonText="Ajouter l'athlète" />
                    <div className="mt-8 pt-6 border-t">
                        <Button variant="outline" size="sm" onClick={handleCleanupDuplicates} className="w-full text-slate-500 hover:text-destructive hover:border-destructive no-print">
                            <Trash2 className="mr-2 h-4 w-4"/>
                            Nettoyer les doublons
                        </Button>
                    </div>
                </div>
                <div className="lg:col-span-8 card p-6 flex flex-col h-[450px]">
                     <SquadChart swimmers={allAthletes || []} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 no-print">
                {groupStats.map(stat => (
                    <Link key={stat.group} href={`/group/${stat.group}`} className="group">
                        <div className="card h-full p-6 flex flex-col justify-between border-l-4 border-l-primary hover:border-l-primary/70 transition-all hover:scale-[1.02]">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                        <Users2 className="h-5 w-5 text-primary group-hover:text-white" />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Groupe {stat.group}</div>
                                        <div className="text-xl font-black text-slate-800">{stat.count} Nageurs</div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-1">
                                        <Target className="w-3 h-3 text-primary" />
                                        Objectif: {stat.config.targetPace}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                                        {stat.config.technicalFocus} : {stat.config.objectives.slice(0, 2).join(', ')}...
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                <div className="text-left">
                                    <div className="text-[9px] font-bold text-muted-foreground uppercase">CSS Moyenne</div>
                                    <div className="text-lg font-mono font-bold text-primary flex items-center gap-1">
                                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                                        {stat.avgPace ? formatPace(stat.avgPace) : "--:--"}
                                    </div>
                                </div>
                                <div className="text-slate-300 group-hover:text-primary transition-colors">
                                    <ArrowRight className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </main>
      </AuthGuard>
    </div>
  );
}

export default function Home() {
  return <HomePageContent />;
}

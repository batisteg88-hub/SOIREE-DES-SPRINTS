
'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from "@/components/nagepro/Header";
import WorkoutPlanner from "@/components/nagepro/WorkoutPlanner";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Workout } from '@/lib/types';
import { Calendar } from '@/components/ui/calendar';
import { fr } from 'date-fns/locale';
import { isSameDay, startOfDay, parseISO, isValid } from 'date-fns';
import AuthGuard from '@/components/auth/AuthGuard';

function PlannerContent() {
  const { user, firestore } = useFirebase();
  const searchParams = useSearchParams();
  const dateQueryParam = searchParams.get('date');

  // Safely initialize state for hydration
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    let initialDate = startOfDay(new Date());
    if (dateQueryParam) {
      const parsedDate = parseISO(dateQueryParam);
      if (isValid(parsedDate)) {
        initialDate = startOfDay(parsedDate);
      }
    }
    setSelectedDate(initialDate);
  }, [dateQueryParam]);

  // Fetch all workouts for the user
  const workoutsCollection = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'workouts');
  }, [firestore, user]);

  const { data: allWorkouts } = useCollection<Workout>(workoutsCollection);

  // Find the workout for the selected date
  const selectedWorkout = useMemo(() => {
    if (!allWorkouts || !selectedDate) return null;
    return allWorkouts.find(w => isSameDay(w.date.toDate(), selectedDate)) || null;
  }, [allWorkouts, selectedDate]);

  // Dates that have workouts for the calendar
  const workoutDays = useMemo(() => {
    return allWorkouts ? allWorkouts.map(w => w.date.toDate()) : [];
  }, [allWorkouts]);

  if (!selectedDate) {
      return <div className="text-center p-12 text-slate-500">Initialisation...</div>;
  }

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 xl:col-span-3">
               <div className="card p-3">
                  <h2 className="text-lg font-bold text-slate-800 mb-2 px-2">Calendrier des Séances</h2>
                  <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(day) => day && setSelectedDate(startOfDay(day))}
                      locale={fr}
                      className="p-0"
                      modifiers={{ scheduled: workoutDays }}
                      modifiersClassNames={{
                          scheduled: 'bg-primary/20 rounded-full',
                      }}
                  />
               </div>
          </div>
          <div className="lg:col-span-8 xl:col-span-9">
              <WorkoutPlanner 
                  key={selectedDate.toISOString()} 
                  selectedDate={selectedDate} 
                  workoutData={selectedWorkout}
              />
          </div>
      </div>
    </main>
  );
}

function PlannerPageContent() {
  return (
    <Suspense fallback={
      <div className="text-center p-12 text-slate-500">Chargement...</div>
    }>
      <PlannerContent />
    </Suspense>
  )
}

export default function PlannerPage() {
  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <Header />
      <AuthGuard>
        <PlannerPageContent />
      </AuthGuard>
    </div>
  )
}

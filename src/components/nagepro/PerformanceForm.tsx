"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const formSchema = z.object({
  distance: z.coerce.number().positive(),
  minutes: z.coerce.number().int().min(0).optional(),
  seconds: z.coerce.number().int().min(0).max(59).optional(),
  hundredths: z.coerce.number().int().min(0).max(99).optional(),
  date: z.date({ required_error: "La date du test est requise." }),
}).refine(
  (data) => (data.minutes ?? 0) > 0 || (data.seconds ?? 0) > 0 || (data.hundredths ?? 0) > 0,
  {
    message: "Le temps doit être supérieur à 0.",
    path: ["seconds"], // Attach error to seconds field
  }
);


type PerformanceFormProps = {
  onSubmit: (distance: number, timeInSeconds: number, date: Date) => void;
  onFormSubmitted?: () => void;
};

const availableDistances = [50, 100, 200, 400, 800, 1500];

export default function PerformanceForm({ onSubmit, onFormSubmitted }: PerformanceFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      distance: 400,
      minutes: undefined,
      seconds: undefined,
      hundredths: undefined,
      date: new Date(),
    },
  });

  function handleFormSubmit(values: z.infer<typeof formSchema>) {
    const timeInSeconds = (values.minutes || 0) * 60 + (values.seconds || 0) + (values.hundredths || 0) / 100;
    onSubmit(values.distance, timeInSeconds, values.date);
    if (onFormSubmitted) {
      onFormSubmitted();
    }
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="distance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distance (m)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableDistances.map(d => (
                        <SelectItem key={d} value={String(d)}>{d}m</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date du test</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const dateValue = e.target.value;
                        // Add 'T00:00:00' to local time to avoid timezone issues.
                        field.onChange(dateValue ? new Date(dateValue + 'T00:00:00') : null);
                      }}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        
        <div>
            <FormLabel>Temps réalisé</FormLabel>
            <div className="flex gap-1 items-start">
              <FormField
                control={form.control}
                name="minutes"
                render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ''} className="font-mono" placeholder="Min" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )}
              />
              <span className="text-muted-foreground pt-2">:</span>
              <FormField
                control={form.control}
                name="seconds"
                render={({ field }) => (
                    <FormItem className="flex-1">
                       <FormControl>
                        <Input type="number" {...field} value={field.value ?? ''} className="font-mono" placeholder="Sec" />
                       </FormControl>
                      <FormMessage />
                    </FormItem>
                )}
              />
               <span className="text-muted-foreground pt-2">.</span>
               <FormField
                control={form.control}
                name="hundredths"
                render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ''} className="font-mono" placeholder="00" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                )}
              />
            </div>
        </div>

        <Button type="submit" className="w-full" size="lg">
            Ajouter la performance
        </Button>
      </form>
    </Form>
  );
}


"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Group } from '@/lib/types';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Le nom doit contenir au moins 2 caractères.' }),
  group: z.enum(['NV1', 'NV1+', 'NV2', 'N3', 'N4', 'N1'], { required_error: "Le groupe est requis." }),
  gender: z.enum(['M', 'F'], { required_error: "Le sexe est requis." }),
});

type AthleteFormProps = {
  onSubmit: (name: string, group: Group, gender: 'M' | 'F') => void;
  buttonText: string;
  defaultValues?: Partial<z.infer<typeof formSchema>>;
};

export default function AthleteForm({ onSubmit, buttonText, defaultValues }: AthleteFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      group: defaultValues?.group || 'N3',
      gender: defaultValues?.gender || 'M',
    },
  });

  function handleFormSubmit(values: z.infer<typeof formSchema>) {
    onSubmit(values.name, values.group as Group, values.gender);
    form.reset({ ...form.getValues(), name: '' });
    form.setFocus('name');
  }

  return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de l'athlète</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Lucas P." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="group"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Groupe</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Groupe..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NV1">NV1</SelectItem>
                          <SelectItem value="NV1+">NV1+</SelectItem>
                          <SelectItem value="NV2">NV2</SelectItem>
                          <SelectItem value="N3">N3</SelectItem>
                          <SelectItem value="N4">N4</SelectItem>
                          <SelectItem value="N1">N1</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexe</FormLabel>
                     <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="M">M</TabsTrigger>
                            <TabsTrigger value="F">F</TabsTrigger>
                        </TabsList>
                     </Tabs>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </div>
          <Button type="submit" className="w-full" size="lg">
              {buttonText}
          </Button>
        </form>
      </Form>
  );
}

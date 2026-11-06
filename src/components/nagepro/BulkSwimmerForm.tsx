"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Group } from '@/lib/types';

interface BulkSwimmerEntry {
    name: string;
    gender: 'M' | 'F';
}

interface BulkSwimmerFormProps {
    groupId: Group;
    onSave: (swimmers: BulkSwimmerEntry[]) => void;
    onCancel: () => void;
}

export default function BulkSwimmerForm({ groupId, onSave, onCancel }: BulkSwimmerFormProps) {
    const [rows, setRows] = useState<BulkSwimmerEntry[]>([
        { name: '', gender: 'M' },
        { name: '', gender: 'M' },
        { name: '', gender: 'M' },
        { name: '', gender: 'M' },
        { name: '', gender: 'M' },
    ]);

    const addRow = () => {
        setRows([...rows, { name: '', gender: 'M' }]);
    };

    const removeRow = (index: number) => {
        if (rows.length <= 1) return;
        setRows(rows.filter((_, i) => i !== index));
    };

    const updateRow = (index: number, field: keyof BulkSwimmerEntry, value: string) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: value };
        setRows(newRows);
    };

    const handleSave = () => {
        const validSwimmers = rows.filter(r => r.name.trim().length >= 2);
        if (validSwimmers.length === 0) return;
        onSave(validSwimmers);
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-dashed text-center">
                <p className="text-sm text-slate-600 font-medium">
                    Saisissez les noms des nageurs pour le groupe <span className="font-bold text-primary">{groupId}</span>.
                    Seules les lignes avec un nom valide seront enregistrées.
                </p>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-12 text-center">#</TableHead>
                            <TableHead>Nom & Prénom</TableHead>
                            <TableHead className="w-32 text-center">Sexe</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/30 transition-colors">
                                <TableCell className="text-center font-bold text-slate-400">{idx + 1}</TableCell>
                                <TableCell>
                                    <Input 
                                        placeholder="Ex: Lucas P." 
                                        value={row.name}
                                        onChange={(e) => updateRow(idx, 'name', e.target.value)}
                                        className="h-9 focus-visible:ring-primary"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Tabs 
                                        value={row.gender} 
                                        onValueChange={(val) => updateRow(idx, 'gender', val as 'M'|'F')}
                                        className="w-full"
                                    >
                                        <TabsList className="grid grid-cols-2 h-8 p-0.5">
                                            <TabsTrigger value="M" className="text-[10px] h-7">M</TabsTrigger>
                                            <TabsTrigger value="F" className="text-[10px] h-7">F</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </TableCell>
                                <TableCell>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => removeRow(idx)}
                                        className="h-8 w-8 text-slate-300 hover:text-destructive transition-colors"
                                        disabled={rows.length <= 1}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="p-3 bg-slate-50/50 border-t">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={addRow}
                        className="w-full border-dashed bg-white text-slate-500 hover:text-primary hover:border-primary transition-all"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter une ligne
                    </Button>
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={onCancel} className="flex-1">
                    Annuler
                </Button>
                <Button 
                    onClick={handleSave} 
                    className="flex-1 font-bold shadow-lg"
                    disabled={rows.filter(r => r.name.trim().length >= 2).length === 0}
                >
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer {rows.filter(r => r.name.trim().length >= 2).length} nageurs
                </Button>
            </div>
        </div>
    );
}

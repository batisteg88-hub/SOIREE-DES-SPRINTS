
"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from 'lucide-react';

type SwimmerControlsProps = {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    sortOption: string;
    onSortChange: (value: string) => void;
    groupFilter: string;
    onGroupFilterChange: (value: string) => void;
};

export default function SwimmerControls({
    searchTerm,
    onSearchChange,
    sortOption,
    onSortChange,
    groupFilter,
    onGroupFilterChange,
}: SwimmerControlsProps) {
    // Determine if we are on a specific group page (filter is locked)
    const isLocked = ['NV1', 'NV1+', 'NV2', 'N3', 'N4', 'N1'].includes(groupFilter);

    return (
        <div className="card p-4 mb-6 no-print">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Rechercher par nom..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={sortOption} onValueChange={onSortChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Trier par..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name">Trier par Nom (A-Z)</SelectItem>
                        <SelectItem value="cssPace">Trier par CSS (Rapide → Lent)</SelectItem>
                    </SelectContent>
                </Select>
                <Tabs value={groupFilter} onValueChange={onGroupFilterChange}>
                    <TabsList className="grid w-full grid-cols-7">
                        {isLocked ? (
                            <TabsTrigger value={groupFilter} className="col-span-7">Filtre : Groupe {groupFilter}</TabsTrigger>
                        ) : (
                            <>
                                <TabsTrigger value="all">Tous</TabsTrigger>
                                <TabsTrigger value="NV1">NV1</TabsTrigger>
                                <TabsTrigger value="NV1+">NV1+</TabsTrigger>
                                <TabsTrigger value="NV2">NV2</TabsTrigger>
                                <TabsTrigger value="N3">N3</TabsTrigger>
                                <TabsTrigger value="N4">N4</TabsTrigger>
                                <TabsTrigger value="N1">N1</TabsTrigger>
                            </>
                        )}
                    </TabsList>
                </Tabs>
            </div>
        </div>
    );
}

"use client";

import { Zap } from 'lucide-react';

export default function WorkoutGenerator() {
  return (
    <div className="shadow-md rounded-2xl border bg-card text-card-foreground p-6 border-l-4 border-rose-500">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-rose-500" />
            Générateur de Séance "Red Mist"
        </h3>
        <p className="text-xs text-slate-500 mb-4">Série type basée sur la CSS actuelle du groupe.</p>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm font-mono text-slate-700">
            <div className="mb-2 font-bold text-rose-600 uppercase">Série Seuil (CSS Development)</div>
            <ul className="space-y-2 list-disc list-inside">
                <li>4 x 400m @ CSS + 20s/100m</li>
                <li>8 x 200m @ CSS + 15s/100m</li>
                <li>16 x 100m @ CSS + 10s</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-400 italic">
                * Les temps de départ individuels sont sur les fiches ci-dessous.
            </div>
        </div>
    </div>
  );
}


"use client"

import * as React from "react"
import { ScatterChart, Scatter, CartesianGrid, XAxis, YAxis, Tooltip, Label } from "recharts"
import type { Athlete } from "@/lib/types"
import {
  ChartContainer,
} from "@/components/ui/chart"

type SquadChartProps = {
  swimmers: Athlete[]
}

const chartConfig = {
  swimmers: {
    label: "Nageurs",
    color: "hsl(var(--chart-1))",
  },
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-2 border rounded-lg bg-background/90 backdrop-blur-sm shadow-lg">
        <p className="font-bold text-lg text-primary">{data.name}</p>
        <p className="text-sm text-foreground">Vitesse Critique: <span className="font-bold">{data.y.toFixed(2)} m/s</span></p>
        <p className="text-sm text-foreground">AWC: <span className="font-bold">{data.x.toFixed(1)} m</span></p>
      </div>
    );
  }

  return null;
};


export default function SquadChart({ swimmers }: SquadChartProps) {

  const data = React.useMemo(() => swimmers
    .filter((s): s is Athlete & { awc: number; cssSpeed: number } =>
      s.awc != null && s.cssSpeed != null && s.awc > 0 && s.cssSpeed > 0)
    .map(s => ({
      x: s.awc,
      y: s.cssSpeed,
      name: s.name,
  })), [swimmers]);
  
  const yDomain: [number | 'auto', number | 'auto'] = React.useMemo(() => {
    if (data.length === 0) return [1.2, 1.6];
    const yValues = data.map(d => d.y);
    const min = Math.min(...yValues);
    const max = Math.max(...yValues);
    const buffer = (max - min) * 0.10 || 0.05;
    return [min - buffer, max + buffer];
  }, [data]);

  const xDomain: [number | 'auto', number | 'auto'] = React.useMemo(() => {
    if (data.length === 0) return [0, 20];
    const xValues = data.map(d => d.x);
    const min = Math.min(...xValues);
    const max = Math.max(...xValues);
    const buffer = (max - min) * 0.10 || 2;
    return [Math.max(0, min - buffer), max + buffer];
  }, [data]);

  if (data.length === 0) {
    return (
         <div className="text-center flex-grow flex items-center justify-center text-slate-400">
            Données de performance insuffisantes pour afficher le graphique.
         </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-2 px-4">
          <h3 className="font-bold text-slate-700">Profil Performance (Vitesse Critique vs. AWC)</h3>
      </div>
      <ChartContainer config={chartConfig} className="flex-1 w-full aspect-auto h-full">
        <ScatterChart
          margin={{ top: 20, right: 30, bottom: 30, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            type="number" 
            dataKey="x" 
            name="AWC" 
            unit="m" 
            domain={xDomain}
            tickCount={8}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) => typeof value === 'number' ? value.toFixed(0) : value}

          >
              <Label value="Capacité de Travail Anaérobie (AWC, en m)" position="insideBottom" offset={-15} className="text-sm fill-muted-foreground" />
          </XAxis>
          <YAxis 
            type="number" 
            dataKey="y" 
            name="Vitesse Critique" 
            unit="m/s"
            domain={yDomain}
            width={80}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
          >
              <Label value="Vitesse Critique (m/s)" angle={-90} position="insideLeft" offset={-15} className="text-sm fill-muted-foreground" />
          </YAxis>
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            content={<CustomTooltip />} 
          />
          <Scatter name="Nageurs" data={data} fill="var(--color-swimmers)" r={7} />
        </ScatterChart>
      </ChartContainer>
    </div>
  )
}

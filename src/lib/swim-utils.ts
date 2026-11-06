
import type { 
  Performance, 
  CalculatedProfile, 
  ZoneData, 
  Group, 
  WorkoutBlock, 
  WorkoutSet, 
  WorkoutItem,
  WorkoutSegment,
  Stroke,
  Zone,
  Material,
  WorkType
} from './types';

export const ZONES_CONFIG = {
    z1: { minPct: 0.75, maxPct: 0.82, label: "Z1 - Récupération", desc: "Aérobie légère.", color: "text-emerald-600", bg: "bg-emerald-50" },
    z2: { minPct: 0.83, maxPct: 0.89, label: "Z2 - Endurance", desc: "Base foncière.", color: "text-sky-600", bg: "bg-sky-50" },
    z3: { minPct: 0.90, maxPct: 0.96, label: "Z3 - Seuil (CSS)", desc: "Aérobie intensive.", color: "text-indigo-600", bg: "bg-indigo-50" },
    z4: { minPct: 0.97, maxPct: 1.05, label: "Z4 - Puissance", desc: "VO2Max / VMA.", color: "text-orange-600", bg: "bg-orange-50" },
    z5: { minPct: 1.06, maxPct: Infinity, label: "Z5 - Vitesse", desc: "Anaérobie / Lactique.", color: "text-rose-600", bg: "bg-rose-50" }
};

export const STROKE_LABELS: Record<Stroke, string> = {
  CRAWL: 'Crawl',
  BACK: 'Dos',
  BREAST: 'Brasse',
  FLY: 'Papillon',
  IM: '4 Nages',
  CHOICE: 'Au choix'
};

export const MATERIAL_LABELS: Record<Material, string> = {
  PADDLES: 'Plaquettes',
  FINS: 'Palmes',
  SNORKEL: 'Tuba',
  BAND: 'Élastique',
  PULL_BUOY: 'Pull Buoy',
  BOARD: 'Planche',
  NONE: 'Sans matériel'
};

export const MATERIAL_SHORT_LABELS: Record<Material, string> = {
  PADDLES: 'Plaq',
  FINS: 'Palm',
  SNORKEL: 'Tuba',
  BAND: 'Elas',
  PULL_BUOY: 'Pull',
  BOARD: 'Plan',
  NONE: ''
};

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  FULL: 'Nage Complète',
  KICK: 'Battements',
  DRILL: 'Éducatif',
  PULL: 'Bras seuls',
  SPE: 'Nage Spé'
};

export const WORK_TYPE_SHORT_LABELS: Record<WorkType, string> = {
  FULL: 'NC',
  KICK: 'batt',
  DRILL: 'éduc',
  PULL: 'bras',
  SPE: 'nage'
};

// --- Recursive Calculations ---

export function calculateBlockVolume(block: WorkoutBlock): number {
  let subTotal = 0;
  if (!block.items) return 0;
  block.items.forEach(item => {
    if (item.kind === 'set') {
      const setDist = item.data.segments.reduce((acc, seg) => acc + seg.distance, 0);
      subTotal += setDist * item.data.reps;
    } else {
      subTotal += calculateBlockVolume(item.data);
    }
  });
  return subTotal * (block.reps || 1);
}

export function calculateBlockDuration(block: WorkoutBlock, squadPaces: Record<string, { p100: number }> | null): number {
  let subTotal = 0;
  if (!block.items) return 0;
  block.items.forEach(item => {
    if (item.kind === 'set') {
      let setDuration = 0;
      const isSequence = item.data.reps === 1 && (item.data.repetitionSize || 0) > 0;
      
      if (isSequence) {
          item.data.segments.forEach(seg => {
            const p100 = squadPaces?.[seg.zone]?.p100 || 90;
            setDuration += (seg.distance / 100) * p100 + (seg.rest || 0);
          });
          subTotal += setDuration;
      } else {
          item.data.segments.forEach(seg => {
            const p100 = squadPaces?.[seg.zone]?.p100 || 90;
            setDuration += (seg.distance / 100) * p100;
          });
          subTotal += (setDuration + item.data.rest) * item.data.reps;
      }
    } else {
      subTotal += calculateBlockDuration(item.data, squadPaces);
    }
  });
  return subTotal * (block.reps || 1);
}

export function flattenWorkoutStats(blocks: WorkoutBlock[]) {
  const stats = {
    totalDistance: 0,
    byZone: {} as Record<string, number>,
    byStroke: {} as Record<string, number>,
    byMaterial: {} as Record<string, number>,
    byWorkType: {} as Record<string, number>
  };

  function processBlock(block: WorkoutBlock, multiplier: number) {
    const totalMult = multiplier * (block.reps || 1);
    if (!block.items) return;
    block.items.forEach(item => {
      if (item.kind === 'set') {
        const setMult = totalMult * item.data.reps;
        item.data.segments.forEach(seg => {
          const dist = seg.distance * setMult;
          stats.totalDistance += dist;
          stats.byZone[seg.zone] = (stats.byZone[seg.zone] || 0) + dist;
          stats.byStroke[seg.stroke] = (stats.byStroke[seg.stroke] || 0) + dist;
          stats.byWorkType[seg.workType] = (stats.byWorkType[seg.workType] || 0) + dist;
          seg.material.forEach(m => {
            stats.byMaterial[m] = (stats.byMaterial[m] || 0) + dist;
          });
        });
      } else {
        processBlock(item.data, totalMult);
      }
    });
  }

  blocks.forEach(b => processBlock(b, 1));
  return stats;
}

// --- Formatting ---

export function formatPace(secs: number): string {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return "--:--";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.round((secs % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

export function calculateAdvancedSwimmingProfile(performances: Performance[]): CalculatedProfile | null {
    const TODAY = new Date();
    
    const validPerfs = performances
        .filter(p => !!p.date)
        .map(p => {
            const ageSemaines = (TODAY.getTime() - p.date.toDate().getTime()) / (1000 * 60 * 60 * 24 * 7);
            const adjustedTime = p.timeInSeconds * Math.pow(0.9985, ageSemaines); 
            return { x: adjustedTime, y: p.distance };
        });

    if (validPerfs.length === 0) return null;
    
    if (validPerfs.length === 1) {
        const perf = validPerfs[0];
        const cssPace = (perf.x / perf.y) * 100;
        const cssSpeed = 100 / cssPace;
        const zones: ZoneData = {};
        Object.keys(ZONES_CONFIG).forEach(k => {
            const config = ZONES_CONFIG[k as keyof typeof ZONES_CONFIG];
            zones[k] = { min: cssPace / config.minPct, max: cssPace / config.maxPct };
        });
        return { cssSpeed, cssPace, awc: 0, zones, isProvisional: true };
    }

    let n = validPerfs.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    validPerfs.forEach(p => {
        sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x;
    });

    const denominator = (n * sumXX - sumX * sumX);
    if (denominator <= 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    if (slope <= 0) return null;

    const cssSpeed = slope;
    const cssPace = 100 / cssSpeed;
    const zones: ZoneData = {};
    Object.keys(ZONES_CONFIG).forEach(k => {
        const config = ZONES_CONFIG[k as keyof typeof ZONES_CONFIG];
        zones[k] = { min: cssPace / config.minPct, max: cssPace / config.maxPct };
    });

    return { cssSpeed, cssPace, awc: intercept, zones, isProvisional: false };
}

export const ASNS_OBJECTIVES = [
  "Entrée dans l'eau",
  "Flottaison ventrale",
  "Passage ventre/dos",
  "Flottaison dorsale",
  "Immersion",
  "Surplace vertical",
  "Propulsion ventrale (15m)",
  "Franchissement obstacle",
  "Propulsion dorsale (15m)",
  "Vérification sécurité",
  "Appel secours",
  "Connaissance milieu",
  "Usage matériel",
  "Respect consignes"
];

export const GROUP_CONFIG: Record<Group, any> = {
  'NV1': { 
    label: 'Niveau 1', 
    targetPace: '> 2:00', 
    objectives: ['Aisance aquatique', 'Immersion prolongée', 'Flottaison'], 
    prerequisites: ['Aucun'],
    technicalFocus: 'Équilibre & Respiration', 
    pedagogicalCycle: { 
      title: 'Initiation', 
      duration: '12 sem',
      blocs: [
        { title: 'Équilibre horizontal', objective: 'Maintenir son corps à la surface', sessions: [] },
        { title: 'Inspiration/Expiration', objective: 'Automatiser le cycle respiratoire', sessions: [] }
      ]
    } 
  },
  'NV1+': { 
    label: 'Niveau 1+', 
    targetPace: '1:55-2:10', 
    objectives: ['Validation ASNS', 'Autonomie sécuritaire'], 
    prerequisites: ['Validation NV1'],
    technicalFocus: 'Sécurité & Parcours', 
    pedagogicalCycle: { 
      title: 'Validation ASNS', 
      duration: '14 sem',
      blocs: [
        { title: 'Parcours Aquatique', objective: 'Enchaîner les 14 étapes ASNS', sessions: [] }
      ]
    } 
  },
  'NV2': { 
    label: 'Niveau 2', 
    targetPace: '1:45-2:00', 
    objectives: ['Coordination Crawl/Dos', 'Virages simples'], 
    prerequisites: ['ASNS validée'],
    technicalFocus: 'Efficacité de la nage', 
    pedagogicalCycle: { title: 'Technique Fondamentale', duration: '10 sem' } 
  },
  'N3': { 
    label: 'Niveau 3', 
    targetPace: '1:30-1:45', 
    objectives: ['Entraînement au Seuil', 'Maîtrise des 4 nages'], 
    prerequisites: ['400m < 7:30'],
    technicalFocus: 'Aérobie & Intensité', 
    pedagogicalCycle: { title: 'Développement Capacité', duration: 'Trimestre 1' } 
  },
  'N4': { 
    label: 'Niveau 4', 
    targetPace: '< 1:30', 
    objectives: ['Puissance VMA', 'Spécialisation'], 
    prerequisites: ['400m < 6:15'],
    technicalFocus: 'Performance & Chrono', 
    pedagogicalCycle: { title: 'Compétition & Puissance', duration: 'Saison' } 
  },
  'N1': { 
    label: 'Elite N1', 
    targetPace: '< 1:15', 
    objectives: ['Optimisation Elite', 'Analyse biomécanique'], 
    prerequisites: ['Niveau National'],
    technicalFocus: 'Expertise & Détails', 
    pedagogicalCycle: { title: 'Haut Niveau', duration: 'Annuel' } 
  }
};

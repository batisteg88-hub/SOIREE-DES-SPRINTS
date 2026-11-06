
import type { Timestamp } from 'firebase/firestore';

export type Presence = 'present' | 'absent' | 'excluded';

export type Group = 'NV1' | 'NV1+' | 'NV2' | 'N3' | 'N4' | 'N1';

export type Material = 'PADDLES' | 'FINS' | 'SNORKEL' | 'BAND' | 'PULL_BUOY' | 'BOARD' | 'NONE';
export type Stroke = 'CRAWL' | 'BACK' | 'BREAST' | 'FLY' | 'IM' | 'CHOICE';
export type WorkType = 'FULL' | 'KICK' | 'DRILL' | 'PULL' | 'SPE';
export type Zone = 'z1' | 'z2' | 'z3' | 'z4' | 'z5';

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export type Athlete = {
  id?: string;
  ownerId: string;
  name: string;
  group?: Group;
  gender?: 'M' | 'F';
  birthYear?: number;
  evaluator?: string;
  cssPace?: number; 
  cssSpeed?: number;
  awc?: number;
  zones?: ZoneData;
  isProvisional?: boolean;
  skills?: Record<string, boolean>;
};

export type Performance = {
  id?: string;
  distance: number;
  timeInSeconds: number;
  date: Timestamp;
};

export type ZoneInfo = {
  min: number;
  max: number;
};

export type ZoneData = {
  [key: string]: ZoneInfo;
};

export type CalculatedProfile = {
  cssSpeed: number;
  cssPace: number;
  awc: number;
  zones: ZoneData;
  isProvisional: boolean;
};

// --- Professional Workout Structure (Recursive Tree) ---

export type WorkoutSegment = {
  id: string;
  distance: number;
  stroke: Stroke;
  workType: WorkType;
  zone: Zone;
  material: Material[];
  rest: number; // Individual recovery after this segment
};

export type WorkoutSet = {
  id: string;
  reps: number;
  segments: WorkoutSegment[];
  rest: number; // Recovery after each full rep in seconds
  notes?: string;
  repetitionSize?: number; // Number of segments per repetition in sequence mode
};

export type WorkoutItem = 
  | { kind: 'set'; data: WorkoutSet }
  | { kind: 'block'; data: WorkoutBlock };

export type WorkoutBlock = {
  id: string;
  title: string;
  reps: number;
  items: WorkoutItem[];
};

export type Workout = {
  id: string;
  ownerId: string;
  date: Timestamp;
  title: string;
  blocks: WorkoutBlock[]; 
  group?: 'all' | Group;
  isCycleSession?: boolean;
  blocIndex?: number;
  order?: number;
  isCompleted?: boolean;
  completedAt?: Timestamp;
  absentSwimmerIds?: string[];
  summary?: {
    totalDistance: number;
    totalDuration: number;
    byZone: Record<string, number>;
    byStroke: Record<string, number>;
    byMaterial: Record<string, number>;
    byWorkType: Record<string, number>;
  };
};

export type Attendance = {
  id: string;
  ownerId: string;
  date: Timestamp;
  presences: Record<string, Presence>;
};

export type Routine = '가슴·삼두' | '등·이두' | '어깨' | '하체';

export interface WorkoutSet {
  weight: number;
  reps: number;
  drops?: { weight: number; reps: number }[];
}

export interface WorkoutLog {
  id: string;
  date: string; // yyyy-MM-dd (로컬 날짜)
  routine: Routine;
  exercise: string;
  sets: WorkoutSet[];
  memo?: string;
  createdAt: string;
}

export interface CustomExercise {
  routine: Routine;
  exercise: string;
}

export type NewLog = Omit<WorkoutLog, 'id' | 'createdAt'>;

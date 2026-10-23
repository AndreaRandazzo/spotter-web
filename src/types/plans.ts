export interface PlanExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  targetSets: number;
  targetReps: string;
  targetRpe: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface PlanDay {
  id: string;
  name: string;
  dayOfWeek: number | null;
  orderIndex: number;
  exercises: PlanExercise[];
}

export interface WorkoutPlan {
  id: string;
  athleteId: string;
  createdByTrainerId: string;
  name: string;
  description: string | null;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  days: PlanDay[];
}

export interface WorkoutPlanSummary {
  id: string;
  athleteId: string;
  name: string;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
}

export interface CreatePlanRequest {
  athleteId: string;
  name: string;
  description?: string;
  validFrom?: string;
  validTo?: string;
}

export interface AddDayRequest {
  name: string;
  dayOfWeek?: number;
}

export interface AddExerciseRequest {
  exerciseId: string;
  targetSets: number;
  targetReps: string;
  targetRpe?: number;
  restSeconds?: number;
  notes?: string;
}

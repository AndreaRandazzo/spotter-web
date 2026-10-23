export interface SetLog {
  setNumber: number;
  reps: number;
  weight: number | null;
  rpe: number | null;
  isWarmup: boolean;
  completedAt: string;
}

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  notes: string | null;
  sets: SetLog[];
}

export type SessionStatus = "IN_PROGRESS" | "COMPLETED";

export interface WorkoutSession {
  id: string;
  athleteId: string;
  planDayId: string;
  planDayName: string;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  exerciseLogs: ExerciseLog[];
}

export interface WorkoutSessionSummary {
  id: string;
  athleteId: string;
  planDayId: string;
  planDayName: string;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
}

export interface StartSessionRequest {
  planDayId: string;
}

export interface LogSetRequest {
  reps: number;
  weight?: number;
  rpe?: number;
  isWarmup?: boolean;
}

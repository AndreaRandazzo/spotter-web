import client from "./client";
import type {
  WorkoutSession,
  WorkoutSessionSummary,
  LogSetRequest,
  SetLog,
  SessionStatus,
} from "../types/sessions";
import type { Page } from "../types/common";

export async function startSession(id: string, planDayId: string): Promise<WorkoutSession> {
  const response = await client.put<WorkoutSession>(`/api/sessions/${id}`, { planDayId });
  return response.data;
}

export async function logSet(
  sessionId: string,
  exerciseLogId: string,
  setNumber: number,
  request: LogSetRequest,
): Promise<SetLog> {
  const response = await client.put<SetLog>(
    `/api/sessions/${sessionId}/exercise-logs/${exerciseLogId}/sets/${setNumber}`,
    request,
  );
  return response.data;
}

export async function deleteSet(
  sessionId: string,
  exerciseLogId: string,
  setNumber: number,
): Promise<void> {
  await client.delete(
    `/api/sessions/${sessionId}/exercise-logs/${exerciseLogId}/sets/${setNumber}`,
  );
}

export async function completeSession(id: string): Promise<WorkoutSession> {
  const response = await client.patch<WorkoutSession>(`/api/sessions/${id}/complete`);
  return response.data;
}

export async function getSession(id: string): Promise<WorkoutSession> {
  const response = await client.get<WorkoutSession>(`/api/sessions/${id}`);
  return response.data;
}

export async function listSessions(params?: {
  athleteId?: string;
  status?: SessionStatus;
}): Promise<Page<WorkoutSessionSummary>> {
  const response = await client.get<Page<WorkoutSessionSummary>>("/api/sessions", { params });
  return response.data;
}

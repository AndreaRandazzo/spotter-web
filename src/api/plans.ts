import client from "./client";
import type {
  WorkoutPlan,
  WorkoutPlanSummary,
  CreatePlanRequest,
  AddDayRequest,
  AddExerciseRequest,
  PlanDay,
  PlanExercise,
} from "../types/plans";
import type { Page } from "../types/common";

export async function createPlan(request: CreatePlanRequest): Promise<WorkoutPlan> {
  const response = await client.post<WorkoutPlan>("/api/plans", request);
  return response.data;
}

export async function addDay(planId: string, request: AddDayRequest): Promise<PlanDay> {
  const response = await client.post<PlanDay>(`/api/plans/${planId}/days`, request);
  return response.data;
}

export async function addExercise(
  planId: string,
  dayId: string,
  request: AddExerciseRequest,
): Promise<PlanExercise> {
  const response = await client.post<PlanExercise>(
    `/api/plans/${planId}/days/${dayId}/exercises`,
    request,
  );
  return response.data;
}

export async function getPlan(id: string): Promise<WorkoutPlan> {
  const response = await client.get<WorkoutPlan>(`/api/plans/${id}`);
  return response.data;
}

export async function getMyPlan(): Promise<WorkoutPlan> {
  const response = await client.get<WorkoutPlan>("/api/plans/me");
  return response.data;
}

export async function listPlansByAthlete(athleteId: string): Promise<Page<WorkoutPlanSummary>> {
  const response = await client.get<Page<WorkoutPlanSummary>>("/api/plans", {
    params: { athleteId },
  });
  return response.data;
}

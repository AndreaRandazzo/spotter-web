import client from "./client";
import type { CoachingRelationship, CoachingStatus } from "../types/coaching";
import type { Page } from "../types/common";

export async function invite(athleteEmail: string): Promise<CoachingRelationship> {
  const response = await client.post<CoachingRelationship>("/api/coaching", { athleteEmail });
  return response.data;
}

export async function acceptInvite(id: string): Promise<CoachingRelationship> {
  const response = await client.patch<CoachingRelationship>(`/api/coaching/${id}/accept`);
  return response.data;
}

export async function endRelationship(id: string): Promise<CoachingRelationship> {
  const response = await client.patch<CoachingRelationship>(`/api/coaching/${id}/end`);
  return response.data;
}

export async function listCoaching(status?: CoachingStatus): Promise<Page<CoachingRelationship>> {
  const response = await client.get<Page<CoachingRelationship>>("/api/coaching", {
    params: status ? { status } : undefined,
  });
  return response.data;
}

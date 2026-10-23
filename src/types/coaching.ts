export interface CoachingUserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export type CoachingStatus = "PENDING" | "ACTIVE" | "ENDED";

export interface CoachingRelationship {
  id: string;
  trainer: CoachingUserInfo;
  athlete: CoachingUserInfo;
  status: CoachingStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface InviteAthleteRequest {
  athleteEmail: string;
}

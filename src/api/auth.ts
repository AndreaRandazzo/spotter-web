import client from "./client";
import type { AuthResponse, LoginRequest, UserResponse } from "../types/auth";

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const response = await client.post<AuthResponse>("/api/auth/login", request);
  return response.data;
}

export async function getCurrentUser(): Promise<UserResponse> {
  const response = await client.get<UserResponse>("/api/users/me");
  return response.data;
}

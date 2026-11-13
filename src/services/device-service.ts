import { apiFetch } from "@/lib/api";

export interface ActiveSession {
  id: string;
  name: string;
  deviceName: string;
  deviceType: "phone" | "tablet" | "desktop";
  osName: string;
  osVersion: string;
  browserOrApp: string;
  ipAddress: string;
  location: string;
  lastActive: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

export interface SessionsResponse {
  currentDevice: ActiveSession | null;
  otherDevices: ActiveSession[];
}

export async function getActiveSessionsApi(): Promise<SessionsResponse> {
  return await apiFetch<SessionsResponse>("/auth/sessions");
}

export async function revokeSessionApi(sessionId: string): Promise<{ message: string }> {
  return await apiFetch<{ message: string }>(`/auth/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function revokeOtherSessionsApi(): Promise<{ message: string }> {
  return await apiFetch<{ message: string }>("/auth/sessions/revoke-others", {
    method: "POST",
  });
}

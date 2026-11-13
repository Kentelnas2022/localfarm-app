import { apiFetch, getAuthToken } from "@/lib/api";

export interface ConnectionRequestItem {
  id: string; // connection_id
  userId: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  mutualFriends?: string;
  timeAgo?: string;
  status: "pending" | "accepted" | "declined" | "blocked";
}

export interface FriendItem {
  id: string; // user_id
  connectionId: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  collectionName?: string;
  hasMutual: boolean;
}

export interface SuggestionUserItem {
  id: string; // user_id
  name: string;
  username?: string;
  avatarUrl?: string;
  mutualFriends?: string;
}

export interface SentRequestItem {
  id: string; // connection_id
  userId: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  friendsCount?: string;
  timeAgo?: string;
}

export interface SearchedUserItem {
  id: string; // user_id
  connectionId: string | null;
  name: string;
  username?: string;
  avatarUrl?: string;
  role?: string;
  relationship: "none" | "pending_sent" | "pending_received" | "accepted";
}

export interface NearbyUserItem {
  id: string; // user_id
  connectionId?: string | null;
  name: string;
  username?: string;
  avatarUrl?: string;
  location?: string;
  distance: string;
  distanceKm?: number;
  relationship?: "none" | "pending_sent" | "pending_received" | "accepted";
}


export async function getConnectionRequestsApi(): Promise<ConnectionRequestItem[]> {
  const token = await getAuthToken();
  if (!token) return [];
  try {
    const res = await apiFetch<{ requests: ConnectionRequestItem[]; count: number }>(
      "/connections/requests"
    );
    return res.requests || [];
  } catch {
    return [];
  }
}

export async function respondToConnectionRequestApi(
  connectionId: string,
  action: "confirm" | "decline" | "accepted" | "declined"
): Promise<{ message: string; status: string }> {
  return await apiFetch<{ message: string; status: string }>("/connections/respond", {
    method: "POST",
    body: JSON.stringify({ connectionId, action }),
  });
}

export async function getFriendsApi(): Promise<FriendItem[]> {
  const token = await getAuthToken();
  if (!token) return [];
  try {
    const res = await apiFetch<{ friends: FriendItem[]; count: number }>("/connections/friends");
    return res.friends || [];
  } catch {
    return [];
  }
}

export async function getSuggestionsApi(): Promise<SuggestionUserItem[]> {
  const token = await getAuthToken();
  if (!token) return [];
  try {
    const res = await apiFetch<{ suggestions: SuggestionUserItem[]; count: number }>(
      "/connections/suggestions"
    );
    return res.suggestions || [];
  } catch {
    return [];
  }
}

export async function getSentRequestsApi(): Promise<SentRequestItem[]> {
  const token = await getAuthToken();
  if (!token) return [];
  try {
    const res = await apiFetch<{ sentRequests: SentRequestItem[]; count: number }>(
      "/connections/sent"
    );
    return res.sentRequests || [];
  } catch {
    return [];
  }
}

export async function searchUsersToConnectApi(
  query: string
): Promise<SearchedUserItem[]> {
  if (!query.trim()) return [];
  const res = await apiFetch<{ users: SearchedUserItem[]; count: number }>(
    `/connections/search?q=${encodeURIComponent(query.trim())}`
  );
  return res.users || [];
}

export async function sendFriendRequestApi(
  targetUserId: string
): Promise<{ message: string; connectionId?: string; relationship: string }> {
  return await apiFetch<{ message: string; connectionId?: string; relationship: string }>(
    "/connections/send",
    {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    }
  );
}

export async function cancelFriendRequestApi(
  targetUserId: string,
  connectionId?: string
): Promise<{ message: string; relationship: string }> {
  return await apiFetch<{ message: string; relationship: string }>("/connections/cancel", {
    method: "POST",
    body: JSON.stringify({ targetUserId, connectionId }),
  });
}

export async function getConnectionCollectionsApi(): Promise<string[]> {
  const res = await apiFetch<{ collections: string[] }>("/connections/collections");
  return res.collections || [];
}

export async function updateConnectionCollectionApi(
  connectionId: string,
  collectionName: string
): Promise<{ message: string; collectionName: string }> {
  return await apiFetch<{ message: string; collectionName: string }>(
    `/connections/${connectionId}/collection`,
    {
      method: "PUT",
      body: JSON.stringify({ collectionName }),
    }
  );
}

export async function getNearbyUsersApi(params?: {
  lat?: number;
  lng?: number;
}): Promise<NearbyUserItem[]> {
  const query =
    params?.lat !== undefined && params?.lng !== undefined
      ? `?lat=${params.lat}&lng=${params.lng}`
      : "";
  const res = await apiFetch<{ users: NearbyUserItem[]; count: number }>(
    `/connections/nearby${query}`
  );
  return res.users || [];
}


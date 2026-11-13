import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../lib/api";

export interface BlockedUserItem {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  blockedAt?: string;
}

const BLOCKED_STORAGE_KEY = "localfarm_blocked_users_list";

export async function getBlockedUsers(): Promise<BlockedUserItem[]> {
  // First try dynamic backend API
  try {
    const res = await apiFetch<{ blockedUsers: BlockedUserItem[] }>("/users/blocked");
    if (res && Array.isArray(res.blockedUsers)) {
      await AsyncStorage.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(res.blockedUsers));
      return res.blockedUsers;
    }
  } catch (err) {
    // Offline / unauthenticated fallback
  }

  try {
    const data = await AsyncStorage.getItem(BLOCKED_STORAGE_KEY);
    if (data !== null) {
      return JSON.parse(data);
    }
    return [];
  } catch (err) {
    console.warn("Failed to load blocked users:", err);
    return [];
  }
}

export async function blockUser(user: {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
}): Promise<BlockedUserItem[]> {
  // Optimistic update
  let updatedList: BlockedUserItem[] = [];
  try {
    const current = await getBlockedUsers();
    const filtered = current.filter((u) => u.id !== user.id);
    const newEntry: BlockedUserItem = {
      id: user.id,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      blockedAt: "Just now",
    };
    updatedList = [newEntry, ...filtered];
    await AsyncStorage.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.warn("Failed to cache blocked user locally:", err);
  }

  // Persist to server & MySQL
  try {
    await apiFetch("/users/block", {
      method: "POST",
      body: JSON.stringify({ blockedUserId: user.id }),
    });
  } catch (err) {
    console.warn("Failed to sync block to server:", err);
  }

  return updatedList;
}

export async function unblockUser(userId: string): Promise<BlockedUserItem[]> {
  // Optimistic local update
  let updatedList: BlockedUserItem[] = [];
  try {
    const current = await getBlockedUsers();
    updatedList = current.filter((u) => u.id !== userId);
    await AsyncStorage.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.warn("Failed to update unblock locally:", err);
  }

  // Persist to server & MySQL
  try {
    await apiFetch(`/users/unblock/${userId}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("Failed to sync unblock to server:", err);
  }

  return updatedList;
}

export async function isUserBlocked(userId: string): Promise<boolean> {
  try {
    const current = await getBlockedUsers();
    return current.some((u) => u.id === userId);
  } catch {
    return false;
  }
}


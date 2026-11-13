import { apiFetch } from "@/lib/api";

export type NotificationType =
  | "tag"
  | "like"
  | "comment"
  | "friend_request"
  | "friend_accepted"
  | "group_invite"
  | "mention"
  | "system"
  | "challenge"
  | "announcement"
  | "scam_alert"
  | "emergency";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  user: {
    id?: string;
    name: string;
    avatarUrl?: string;
  };
  title?: string;
  content: string;
  entityName?: string;
  targetId?: number | null;
  time: string;
  createdAt?: string;
  isUnread: boolean;
  hasActionButtons?: boolean;
  announcement?: {
    id: string;
    title: string;
    content: string;
    category: string;
    priority: string;
    targetAudience?: string;
    isPinned?: boolean;
    createdAt: string;
    author?: string;
  };
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  count: number;
  unreadCount?: number;
}

export async function getNotificationsApi(): Promise<{
  notifications: NotificationItem[];
  unreadCount: number;
}> {
  try {
    const res = await apiFetch<NotificationsResponse>("/notifications");
    const notifications = res.notifications || [];
    const unreadCount =
      typeof res.unreadCount === "number"
        ? res.unreadCount
        : notifications.filter((n) => n.isUnread).length;
    return { notifications, unreadCount };
  } catch (err) {
    console.warn("[getNotificationsApi Error]", err);
    return { notifications: [], unreadCount: 0 };
  }
}

export async function markNotificationAsReadApi(id: string): Promise<boolean> {
  try {
    await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
    return true;
  } catch (err) {
    console.warn(`[markNotificationAsReadApi Error] Failed for ${id}:`, err);
    return false;
  }
}

export async function markAllNotificationsAsReadApi(): Promise<boolean> {
  try {
    await apiFetch("/notifications/read-all", { method: "PUT" });
    return true;
  } catch (err) {
    console.warn("[markAllNotificationsAsReadApi Error]", err);
    return false;
  }
}

export async function deleteNotificationApi(id: string): Promise<boolean> {
  try {
    await apiFetch(`/notifications/${id}`, { method: "DELETE" });
    return true;
  } catch (err) {
    console.warn(`[deleteNotificationApi Error] Failed for ${id}:`, err);
    return false;
  }
}

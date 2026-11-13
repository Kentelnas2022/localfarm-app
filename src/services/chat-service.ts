import { apiFetch } from "@/lib/api";

export interface ActiveChatUser {
  id: string;
  name: string;
  fullName: string;
  avatarUrl?: string;
  isOnline: boolean;
  isSelf?: boolean;
}

export interface ConversationItem {
  id: string; // conversation_id
  otherUserId: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  snippet: string;
  time: string;
  unread: number;
  isLastSenderMe?: boolean;
  isDelivered?: boolean;
  isSeen?: boolean;
  isTyping?: boolean;
  online: boolean;
  isArchived?: boolean;
  isSpam?: boolean;
  isAccepted?: boolean;
  isMuted?: boolean;
  isRestricted?: boolean;
  isFriend?: boolean;
}

export interface RestrictedUserItem {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  conversationId?: string;
}

export interface LocationPinData {
  title: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface PriceOfferData {
  id: string;
  produceName: string;
  icon?: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  notes?: string;
  status: "pending" | "accepted" | "declined" | "countered";
  counterPrice?: string;
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  sender: "user" | "other";
  senderId?: string;
  receiverId?: string;
  type?:
    | "text"
    | "image"
    | "location"
    | "offer"
    | "auto_reply"
    | "sticker"
    | "audio";
  text?: string;
  imageUrl?: string;
  avatarUrl?: string;
  time?: string;
  isDelivered?: boolean;
  isSeen?: boolean;
  location?: LocationPinData;
  offer?: PriceOfferData;
}

export async function getActiveChatUsersApi(): Promise<ActiveChatUser[]> {
  const res = await apiFetch<{ users: ActiveChatUser[] }>(
    "/chats/active-users",
  );
  return res.users || [];
}

export async function getConversationsApi(options?: {
  category?: "messages" | "requests" | "spam" | "archived";
}): Promise<ConversationItem[]> {
  const category = options?.category || "messages";
  const res = await apiFetch<{
    conversations: ConversationItem[];
    count: number;
  }>(`/chats/conversations?category=${category}`);
  return res.conversations || [];
}

export async function archiveConversationApi(
  conversationId: string,
  isArchived = true,
): Promise<{ success: boolean; isArchived: boolean }> {
  return await apiFetch<{ success: boolean; isArchived: boolean }>(
    `/chats/conversations/${conversationId}/archive`,
    {
      method: "POST",
      body: JSON.stringify({ isArchived }),
    },
  );
}

export async function spamConversationApi(
  conversationId: string,
  isSpam = true,
): Promise<{ success: boolean; isSpam: boolean }> {
  return await apiFetch<{ success: boolean; isSpam: boolean }>(
    `/chats/conversations/${conversationId}/spam`,
    {
      method: "POST",
      body: JSON.stringify({ isSpam }),
    },
  );
}

export async function acceptMessageRequestApi(
  conversationId: string,
): Promise<{ success: boolean; message: string }> {
  return await apiFetch<{ success: boolean; message: string }>(
    `/chats/conversations/${conversationId}/accept-request`,
    {
      method: "POST",
    },
  );
}

export async function getRestrictedUsersApi(): Promise<RestrictedUserItem[]> {
  try {
    const res = await apiFetch<{ users: RestrictedUserItem[]; count: number }>(
      "/chats/restricted-users",
    );
    return res.users || [];
  } catch {
    return [];
  }
}

export async function muteConversationApi(
  conversationId: string,
  isMuted = true,
): Promise<{ success: boolean; isMuted: boolean }> {
  return await apiFetch<{ success: boolean; isMuted: boolean }>(
    `/chats/conversations/${conversationId}/mute`,
    {
      method: "POST",
      body: JSON.stringify({ isMuted }),
    },
  );
}

export async function restrictUserApi(
  userId: string,
  restrict = true,
): Promise<{ success: boolean; isRestricted: boolean }> {
  return await apiFetch<{ success: boolean; isRestricted: boolean }>(
    `/chats/users/${userId}/restrict`,
    {
      method: "POST",
      body: JSON.stringify({ restrict }),
    },
  );
}

export async function blockUserChatApi(
  userId: string,
  block = true,
): Promise<{ success: boolean; isBlocked: boolean }> {
  return await apiFetch<{ success: boolean; isBlocked: boolean }>(
    `/chats/users/${userId}/block`,
    {
      method: "POST",
      body: JSON.stringify({ block }),
    },
  );
}

export async function getMessagesApi(params: {
  conversationId?: string;
  userId?: string;
}): Promise<{
  messages: ChatMessage[];
  conversationId: string | null;
  isTyping?: boolean;
}> {
  let endpoint = "/chats/messages";
  const queryParams: string[] = [];
  if (params.conversationId)
    queryParams.push(`conversationId=${params.conversationId}`);
  if (params.userId) queryParams.push(`userId=${params.userId}`);
  if (queryParams.length > 0) endpoint += `?${queryParams.join("&")}`;

  return await apiFetch<{
    messages: ChatMessage[];
    conversationId: string | null;
    isTyping?: boolean;
  }>(endpoint);
}

export async function sendTypingStatusApi(payload: {
  conversationId?: string;
  receiverId?: string;
  isTyping: boolean;
}): Promise<{ success: boolean }> {
  try {
    return await apiFetch<{ success: boolean }>("/chats/typing", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    return { success: false };
  }
}

export async function sendMessageApi(params: {
  receiverId?: string;
  conversationId?: string;
  messageText: string;
  messageType?:
    | "text"
    | "image"
    | "location"
    | "offer"
    | "auto_reply"
    | "sticker"
    | "audio";
  imageUrl?: string;
  autoReplyText?: string;
  autoReplyType?: string;
}): Promise<{ message: string; data: ChatMessage; autoReply?: ChatMessage }> {
  return await apiFetch<{
    message: string;
    data: ChatMessage;
    autoReply?: ChatMessage;
  }>("/chats/messages", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface ChatFarmerInfo {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string;
  phoneNumber: string;
  farmName: string;
  farmLocation: string;
  primaryCrops: string;
  isVerified: boolean;
  bio: string;
  memberSince: string;
}

export interface SharedMediaItem {
  id: string;
  imageUrl: string;
  createdAt: string;
}

export interface SharedLinkItem {
  id: string;
  url: string;
  title: string;
  createdAt?: string;
}

export async function getChatUserInfoApi(
  userId: string,
): Promise<ChatFarmerInfo | null> {
  try {
    const res = await apiFetch<{ user: ChatFarmerInfo }>(
      `/chats/user/${userId}/info`,
    );
    return res.user;
  } catch (err) {
    console.warn("[chat-service] getChatUserInfoApi error:", err);
    return null;
  }
}

export async function getSharedMediaApi(
  params: string | { conversationId?: string; userId?: string },
): Promise<{
  media: SharedMediaItem[];
  links: SharedLinkItem[];
}> {
  try {
    let endpoint = "";
    if (typeof params === "string") {
      endpoint = `/chats/conversations/${params}/media`;
    } else if (params.conversationId) {
      endpoint = `/chats/conversations/${params.conversationId}/media`;
      if (params.userId) {
        endpoint += `?userId=${encodeURIComponent(params.userId)}`;
      }
    } else if (params.userId) {
      endpoint = `/chats/conversations/media?userId=${encodeURIComponent(params.userId)}`;
    } else {
      return { media: [], links: [] };
    }

    const res = await apiFetch<{
      media: SharedMediaItem[];
      links?: SharedLinkItem[];
    }>(endpoint);
    return {
      media: res.media || [],
      links: res.links || [],
    };
  } catch (err) {
    console.warn("[chat-service] getSharedMediaApi error:", err);
    return { media: [], links: [] };
  }
}

export interface QuickInquiryCard {
  id: string;
  icon: string;
  tag: string;
  tagBg?: string;
  tagText?: string;
  title: string;
  desc: string;
  btnText: string;
  replyText: string;
  replyType: "auto_reply" | "location";
  locationData?: LocationPinData;
}

export async function getFarmerInquiriesApi(
  farmerId: string,
): Promise<QuickInquiryCard[]> {
  try {
    const res = await apiFetch<{ inquiries: QuickInquiryCard[] }>(
      `/chats/farmer/${farmerId}/inquiries`,
    );
    return res.inquiries || [];
  } catch (err) {
    console.warn("[chat-service] getFarmerInquiriesApi error:", err);
    return [];
  }
}

export async function deleteConversationApi(params: {
  conversationId?: string;
  userId?: string;
}): Promise<{ message: string }> {
  let endpoint = "/chats/conversations";
  if (params.conversationId) {
    endpoint = `/chats/conversations/${params.conversationId}`;
    if (params.userId) {
      endpoint += `?userId=${encodeURIComponent(params.userId)}`;
    }
  } else if (params.userId) {
    endpoint = `/chats/conversations/with-user/${encodeURIComponent(params.userId)}`;
  }

  return await apiFetch<{ message: string }>(endpoint, {
    method: "DELETE",
    body: JSON.stringify({
      conversationId: params.conversationId,
      userId: params.userId,
    }),
  });
}

export interface SubmitReportPayload {
  reportedUserId?: string;
  conversationId?: string;
  reason: string;
  statement: string;
  attachmentUrl?: string;
}

export async function submitUserReportApi(
  payload: SubmitReportPayload,
): Promise<{ success: boolean; reportId?: number; message: string }> {
  return await apiFetch<{
    success: boolean;
    reportId?: number;
    message: string;
  }>("/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

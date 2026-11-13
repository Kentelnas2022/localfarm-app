import { apiFetch } from "@/lib/api";

export interface OriginalPostItem {
  id: string;
  userId: string;
  authorName: string;
  authorRole: string;
  avatarUri: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  timeAgo: string;
  content: string;
  imageUrl: string;
  images?: string[];
  category: string;
  isVerified?: boolean;
}

export interface TaggedUser {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
}

export interface PostItem {
  id: string;
  userId: string;
  authorName: string;
  authorRole: string;
  avatarUri: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  timeAgo: string;
  content: string;
  imageUrl: string;
  images?: string[];
  category: string;
  privacy: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  userReaction?: string | null;
  isSaved?: boolean;
  isShared?: boolean;
  isVerified?: boolean;
  originalPost?: OriginalPostItem | null;
  expiresAt?: number | string | null;
  durationLabel?: string;
  taggedUsers?: TaggedUser[];
  isPreHarvest?: boolean;
  expectedHarvestDate?: string | null;
  availableQuantity?: number | null;
  reservedQuantity?: number;
  cropName?: string | null;
  unit?: string;
  pricePerUnit?: number | null;
  pickupHub?: string | null;
}

export interface SavedPostItem extends PostItem {
  savedId: string;
  collectionName: string;
  savedAt: string;
}

export interface SavedCollectionDetail {
  name: string;
  itemCount: number;
  coverImageUrl?: string;
  hasCurrentPost?: boolean;
  isDefault?: boolean;
}

export interface CommentItem {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  avatarUri?: string;
  timeAgo: string;
  content: string;
  likes: number;
  isLiked: boolean;
  isVerified?: boolean;
  parentId?: string | null;
}

export interface CreatePostPayload {
  content: string;
  category?: string;
  privacy?: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photos?: string[];
  images?: string[];
  imageUrl?: string;
  taggedUserIds?: string[];
  expiresAt?: number | string | null;
  temporaryDuration?: number;
  durationLabel?: string;
  viewerCount?: number;
  durationSeconds?: number;
  isLiveReplay?: boolean;
}

export async function getPostsApi(
  category?: string,
  userId?: string | number,
  search?: string
): Promise<PostItem[]> {
  const queryParts: string[] = [];
  if (category && category !== "All") {
    queryParts.push(`category=${encodeURIComponent(category)}`);
  }
  if (userId) {
    queryParts.push(`userId=${encodeURIComponent(String(userId))}`);
  }
  if (search && search.trim()) {
    queryParts.push(`search=${encodeURIComponent(search.trim())}`);
  }
  const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  const res = await apiFetch<{ posts: PostItem[]; count: number }>(`/posts${query}`);
  return res.posts || [];
}

export async function createPostApi(payload: CreatePostPayload): Promise<PostItem> {
  const res = await apiFetch<{ message: string; post: PostItem }>("/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.post;
}

export async function recordLiveStreamApi(payload: {
  viewerCount?: number;
  durationSeconds?: number;
  status?: string;
  postId?: number | string | null;
}): Promise<{ message: string; liveStream: any }> {
  return await apiFetch<{ message: string; liveStream: any }>("/live-streams", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function toggleLikePostApi(
  postId: string,
  reactionType?: string,
): Promise<{ isLiked: boolean; likesCount: number; userReaction?: string | null }> {
  return await apiFetch<{ isLiked: boolean; likesCount: number; userReaction?: string | null }>(
    `/posts/${postId}/like`,
    {
      method: "POST",
      body: JSON.stringify({ reactionType }),
    },
  );
}

export async function getPostCommentsApi(postId: string): Promise<CommentItem[]> {
  const res = await apiFetch<{ comments: CommentItem[]; count: number }>(`/posts/${postId}/comments`);
  return res.comments || [];
}

export async function addPostCommentApi(
  postId: string,
  content: string,
  parentId?: string | null
): Promise<CommentItem> {
  const res = await apiFetch<{ message: string; comment: CommentItem }>(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, parentId }),
  });
  return res.comment;
}

export async function toggleLikeCommentApi(commentId: string): Promise<{ isLiked: boolean; likesCount: number }> {
  return await apiFetch<{ isLiked: boolean; likesCount: number }>(`/comments/${commentId}/like`, {
    method: "POST",
  });
}

export async function sharePostApi(
  postId: string,
  shareType: string = "public",
  caption?: string,
  groupName?: string,
  privacy?: string
): Promise<{ message: string; sharesCount: number; sharedPost?: PostItem | null }> {
  return await apiFetch<{ message: string; sharesCount: number; sharedPost?: PostItem | null }>(`/posts/${postId}/share`, {
    method: "POST",
    body: JSON.stringify({ shareType, caption, groupName, privacy }),
  });
}

export async function getPostByIdApi(postId: string): Promise<PostItem> {
  const res = await apiFetch<{ post: PostItem }>(`/posts/${postId}`);
  return res.post;
}

export async function updatePostApi(
  postId: string,
  data: {
    content?: string;
    category?: string;
    privacy?: string;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string | null;
    photos?: string[];
    expiresAt?: number | null;
    durationLabel?: string;
  }
): Promise<{
  message: string;
  post: {
    id: string;
    content: string;
    category: string;
    privacy: string;
    location?: string;
    latitude?: number | null;
    longitude?: number | null;
    imageUrl?: string;
  };
}> {
  return await apiFetch<{
    message: string;
    post: {
      id: string;
      content: string;
      category: string;
      privacy: string;
      location?: string;
      latitude?: number | null;
      longitude?: number | null;
      imageUrl?: string;
    };
  }>(`/posts/${postId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePostApi(postId: string): Promise<{ message: string }> {
  return await apiFetch<{ message: string }>(`/posts/${postId}`, {
    method: "DELETE",
  });
}

export async function getSavedPostsApi(): Promise<SavedPostItem[]> {
  const res = await apiFetch<{ savedPosts: SavedPostItem[]; count: number }>("/posts/saved");
  return res.savedPosts || [];
}

export async function getSavedCollectionsApi(): Promise<string[]> {
  const res = await apiFetch<{ collections: string[] }>("/posts/saved/collections");
  return res.collections || ["All Saved"];
}

export async function toggleSavePostApi(
  postId: string,
  collectionName?: string
): Promise<{ message: string; isSaved: boolean; collectionName?: string | null }> {
  return await apiFetch<{ message: string; isSaved: boolean; collectionName?: string | null }>(
    `/posts/${postId}/save`,
    {
      method: "POST",
      body: JSON.stringify({ collectionName }),
    }
  );
}

export async function getSavedCollectionDetailsApi(
  postId?: string
): Promise<SavedCollectionDetail[]> {
  const query = postId ? `?postId=${encodeURIComponent(postId)}` : "";
  const res = await apiFetch<{ collections: SavedCollectionDetail[] }>(
    `/posts/saved/collections/details${query}`
  );
  return res.collections || [];
}

export async function createSavedCollectionApi(
  name: string,
  postId?: string
): Promise<{ message: string; collection?: SavedCollectionDetail }> {
  return await apiFetch<{ message: string; collection?: SavedCollectionDetail }>(
    "/posts/saved/collections",
    {
      method: "POST",
      body: JSON.stringify({ name, postId }),
    }
  );
}

export async function renameSavedCollectionApi(
  oldName: string,
  newName: string
): Promise<{ message: string }> {
  return await apiFetch<{ message: string }>("/posts/saved/collections/rename", {
    method: "PATCH",
    body: JSON.stringify({ oldName, newName }),
  });
}

export async function deleteSavedCollectionApi(
  name: string
): Promise<{ message: string }> {
  return await apiFetch<{ message: string }>(
    `/posts/saved/collections/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
    }
  );
}


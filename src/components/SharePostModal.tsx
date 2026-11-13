import { useAuth } from "@/hooks/use-auth";
import { sendMessageApi } from "@/services/chat-service";
import { FriendItem, getFriendsApi } from "@/services/connection-service";
import { PostItem, sharePostApi } from "@/services/post-service";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface SharePostModalProps {
  visible: boolean;
  onClose: () => void;
  post: PostItem | null;
  onShareSuccess?: (sharedPost?: PostItem | null, newSharesCount?: number) => void;
  onShowToast?: (message: string, type?: "success" | "error" | "info") => void;
}

type ShareViewMode = "menu" | "feed" | "message";

export type PrivacyType = "Public" | "Friends" | "Only me";

interface PrivacyConfig {
  id: PrivacyType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PRIVACY_OPTIONS: PrivacyConfig[] = [
  {
    id: "Public",
    label: "Public",
    description: "Anyone on Local Farm",
    icon: "globe-outline",
  },
  {
    id: "Friends",
    label: "Friends",
    description: "Your connections only",
    icon: "people-outline",
  },
  {
    id: "Only me",
    label: "Only me",
    description: "Only visible to you",
    icon: "lock-closed-outline",
  },
];

export default function SharePostModal({
  visible,
  onClose,
  post,
  onShareSuccess,
  onShowToast,
}: SharePostModalProps) {
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<ShareViewMode>("menu");
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<PrivacyType>("Public");
  const [showPrivacyDropdown, setShowPrivacyDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Message forwarding state
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [messageNote, setMessageNote] = useState("");
  const [sentFriendIds, setSentFriendIds] = useState<Record<string, boolean>>({});
  const [sendingFriendId, setSendingFriendId] = useState<string | null>(null);

  // Reset modal state whenever closed or when target post changes
  useEffect(() => {
    if (visible) {
      setViewMode("menu");
      setCaption("");
      setPrivacy("Public");
      setShowPrivacyDropdown(false);
      setFriendSearchQuery("");
      setMessageNote("");
      setSentFriendIds({});
    }
  }, [visible, post?.id]);

  // Load friends when entering message view
  useEffect(() => {
    if (viewMode === "message" && friends.length === 0) {
      setIsLoadingFriends(true);
      getFriendsApi()
        .then((data) => setFriends(data))
        .catch((err) => console.log("[SharePostModal] Load friends err:", err))
        .finally(() => setIsLoadingFriends(false));
    }
  }, [viewMode]);

  if (!post) return null;

  const originalAuthorName =
    post.originalPost?.authorName || post.authorName || "Local Farmer";
  const originalAuthorAvatar =
    post.originalPost?.avatarUri || post.avatarUri || "";
  const originalAuthorRole =
    post.originalPost?.authorRole || post.authorRole || post.category || "Field";
  const originalTimeAgo =
    post.originalPost?.timeAgo || post.timeAgo || "Recently";
  const originalContent =
    post.originalPost?.content || post.content || "";
  const originalImageUrl =
    post.originalPost?.imageUrl || post.imageUrl || "";



  // 2. Share to Feed with thoughts
  const handleConfirmFeedShare = async () => {
    setIsSubmitting(true);
    try {
      const res = await sharePostApi(
        post.id,
        "public",
        caption.trim(),
        undefined,
        privacy,
      );
      onShowToast?.("Post shared with your thoughts!", "success");
      onShareSuccess?.(res.sharedPost, res.sharesCount);
      onClose();
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to share post.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };


  // 4. Send in Message
  const handleSendMessageToFriend = async (friend: FriendItem) => {
    if (sentFriendIds[friend.id] || sendingFriendId === friend.id) return;

    setSendingFriendId(friend.id);
    try {
      const postUrl = `https://localfarm.app/post/${post.id}`;
      const text = messageNote.trim()
        ? `${messageNote.trim()}\n\nCheck out this post: ${postUrl}`
        : `Check out this post by ${originalAuthorName}: ${postUrl}`;

      await sendMessageApi({
        receiverId: friend.id,
        messageText: text,
      });

      // Update post share count
      sharePostApi(post.id, "message").catch(() => {});

      setSentFriendIds((prev) => ({ ...prev, [friend.id]: true }));
      onShowToast?.(`Sent to ${friend.name}!`, "success");
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to send message.", "error");
    } finally {
      setSendingFriendId(null);
    }
  };

  // 5. Copy Link
  const handleCopyLink = async () => {
    try {
      const postUrl = `https://localfarm.app/post/${post.id}`;
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(postUrl);
      } else if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(postUrl);
      }
      onShowToast?.("Post link copied to clipboard!", "success");
      onClose();
    } catch {
      onShowToast?.("Could not copy link.", "error");
    }
  };

  // 6. Native Device Share
  const handleNativeShare = async () => {
    try {
      const postUrl = `https://localfarm.app/post/${post.id}`;
      await Share.share({
        title: `Post by ${originalAuthorName}`,
        message: `${originalContent ? originalContent.slice(0, 100) + "... " : ""}${postUrl}`,
        url: postUrl,
      });
      onClose();
    } catch {
      // User cancelled share
    }
  };

  // Filtered friends for message view
  const filteredFriends = friends.filter((f) => {
    const q = friendSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      f.name.toLowerCase().includes(q) ||
      (f.username && f.username.toLowerCase().includes(q))
    );
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-black/60 justify-end sm:justify-center sm:items-center sm:p-4"
      >
        <Pressable
          className="absolute inset-0"
          onPress={() => {
            if (!isSubmitting) onClose();
          }}
        />

        <View
          className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl z-10 max-h-[90vh] flex-col"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          {/* ============================================================ */}
          {/* VIEW 1: MAIN FACEBOOK-STYLE SHARE SHEET MENU */}
          {/* ============================================================ */}
          {viewMode === "menu" && (
            <View className="flex-col">
              {/* Menu Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
                <Text className="text-lg font-bold text-gray-900">Share Post</Text>
                <TouchableOpacity
                  onPress={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
                  accessibilityRole="button"
                  accessibilityLabel="Close share menu"
                >
                  <Ionicons name="close" size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              {/* Target Post Quick Snippet Preview */}
              <View className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mr-2.5 items-center justify-center">
                  {originalAuthorAvatar ? (
                    <Image
                      source={{ uri: originalAuthorAvatar }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={16} color="#9CA3AF" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-gray-800" numberOfLines={1}>
                    {originalAuthorName}
                  </Text>
                  <Text className="text-[11px] text-gray-500" numberOfLines={1}>
                    {originalContent || "Photo post"}
                  </Text>
                </View>
              </View>

              {/* Action Options List */}
              <ScrollView className="max-h-[60vh] py-2" showsVerticalScrollIndicator={false}>
                {/* 1. Share to Feed with Thoughts */}
                <TouchableOpacity
                  onPress={() => setViewMode("feed")}
                  className="flex-row items-center px-5 py-3.5 active:bg-gray-50 border-b border-gray-50"
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mr-3.5 border border-green-100">
                    <Ionicons name="create-outline" size={22} color="#166534" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">
                      Share to Feed
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Write your own thoughts before sharing
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
                {/* 2. Send in Message */}
                <TouchableOpacity
                  onPress={() => setViewMode("message")}
                  className="flex-row items-center px-5 py-3.5 active:bg-gray-50 border-b border-gray-50"
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3.5 border border-blue-100">
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color="#1D4ED8" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">
                      Send in Message
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Send to a friend or chat conversation
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
                {/* 3. Copy Link */}
                <TouchableOpacity
                  onPress={handleCopyLink}
                  className="flex-row items-center px-5 py-3.5 active:bg-gray-50 border-b border-gray-50"
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center mr-3.5 border border-amber-100">
                    <Ionicons name="link-outline" size={22} color="#B45309" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">
                      Copy Link
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Copy post link to share anywhere
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 6. More Options (System Share) */}
                <TouchableOpacity
                  onPress={handleNativeShare}
                  className="flex-row items-center px-5 py-3.5 active:bg-gray-50 mb-2"
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3.5">
                    <Ionicons name="share-outline" size={22} color="#374151" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">
                      More Options...
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Share via apps on your device
                    </Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* ============================================================ */}
          {/* VIEW 2: SHARE TO FEED (EDIT THOUGHTS & QUOTE EMBED) */}
          {/* ============================================================ */}
          {viewMode === "feed" && (
            <View className="flex-col max-h-[85vh]">
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => setViewMode("menu")}
                    disabled={isSubmitting}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3"
                  >
                    <Ionicons name="arrow-back" size={18} color="#374151" />
                  </TouchableOpacity>
                  <Text className="text-lg font-bold text-gray-900">
                    Share to Feed
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={isSubmitting}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <ScrollView
                className="px-5 py-4"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Author Info Row */}
                <View className="flex-row items-center mb-3">
                  <View className="w-11 h-11 rounded-full border border-green-500 items-center justify-center bg-gray-100 mr-3 overflow-hidden">
                    {user?.avatarUrl ? (
                      <Image
                        source={{ uri: user.avatarUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={22} color="#9CA3AF" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-gray-900 text-base">
                      {user?.name || user?.username || "You"}
                    </Text>
                    {/* Privacy Dropdown Selector */}
                    <View className="relative z-30 self-start">
                      <TouchableOpacity
                        onPress={() => setShowPrivacyDropdown((prev) => !prev)}
                        className="flex-row items-center mt-1 bg-green-50 px-2.5 py-1 rounded-full border border-green-200/80 active:bg-green-100"
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={
                            privacy === "Public"
                              ? "globe-outline"
                              : privacy === "Friends"
                              ? "people-outline"
                              : "lock-closed-outline"
                          }
                          size={12}
                          color="#166534"
                        />
                        <Text className="text-xs font-semibold text-green-800 ml-1 mr-1">
                          {privacy}
                        </Text>
                        <Ionicons
                          name={showPrivacyDropdown ? "chevron-up" : "chevron-down"}
                          size={12}
                          color="#166534"
                        />
                      </TouchableOpacity>

                      {/* Dropdown Menu Popup */}
                      {showPrivacyDropdown && (
                        <View
                          className="absolute top-8 left-0 z-50 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1"
                          style={{
                            elevation: 8,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 10,
                          }}
                        >
                          {PRIVACY_OPTIONS.map((opt) => {
                            const isSelected = privacy === opt.id;
                            return (
                              <TouchableOpacity
                                key={opt.id}
                                onPress={() => {
                                  setPrivacy(opt.id);
                                  setShowPrivacyDropdown(false);
                                }}
                                className={`flex-row items-center px-3 py-2.5 ${
                                  isSelected ? "bg-green-50/70" : "active:bg-gray-50"
                                }`}
                                activeOpacity={0.7}
                              >
                                <View
                                  className={`w-7 h-7 rounded-full items-center justify-center mr-2.5 ${
                                    isSelected ? "bg-green-100" : "bg-gray-100"
                                  }`}
                                >
                                  <Ionicons
                                    name={opt.icon}
                                    size={14}
                                    color={isSelected ? "#166534" : "#4B5563"}
                                  />
                                </View>
                                <View className="flex-1">
                                  <Text
                                    className={`text-xs font-bold ${
                                      isSelected ? "text-green-800" : "text-gray-800"
                                    }`}
                                  >
                                    {opt.label}
                                  </Text>
                                  <Text className="text-[10px] text-gray-500">
                                    {opt.description}
                                  </Text>
                                </View>
                                {isSelected && (
                                  <Ionicons name="checkmark" size={15} color="#166534" />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Caption / Thoughts Input */}
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Say something about this post..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  className="text-base text-gray-800 min-h-[90px] text-top mb-4"
                  style={{ textAlignVertical: "top" }}
                  autoFocus={true}
                />

                {/* Embedded Original Post Preview */}
                <View className="border border-gray-200 rounded-2xl p-3.5 bg-gray-50/80 mb-2">
                  <View className="flex-row items-center mb-2.5">
                    <View className="w-8 h-8 rounded-full border border-green-400 items-center justify-center bg-gray-200 mr-2.5 overflow-hidden">
                      {originalAuthorAvatar ? (
                        <Image
                          source={{ uri: originalAuthorAvatar }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={16} color="#9CA3AF" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900 text-xs" numberOfLines={1}>
                        {originalAuthorName}
                      </Text>
                      <Text className="text-[11px] text-gray-500" numberOfLines={1}>
                        {originalAuthorRole} • {originalTimeAgo}
                      </Text>
                    </View>
                  </View>

                  {originalContent ? (
                    <Text className="text-sm text-gray-700 mb-2 leading-relaxed" numberOfLines={4}>
                      {originalContent}
                    </Text>
                  ) : null}

                  {originalImageUrl ? (
                    <Image
                      source={{ uri: originalImageUrl }}
                      className="w-full h-40 rounded-xl bg-gray-200"
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              </ScrollView>

              {/* Bottom Confirm Button */}
              <View className="px-5 py-3.5 border-t border-gray-100 bg-white">
                <TouchableOpacity
                  onPress={handleConfirmFeedShare}
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl bg-[#72AF5B] items-center justify-center flex-row shadow-sm active:bg-[#5e944a]"
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="arrow-redo" size={18} color="#ffffff" />
                      <Text className="text-white font-bold text-base ml-2">
                        Share Now
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ============================================================ */}
          {/* VIEW 3: SEND IN MESSAGE (FRIEND SELECTOR) */}
          {/* ============================================================ */}
          {viewMode === "message" && (
            <View className="flex-col max-h-[85vh]">
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => setViewMode("menu")}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3"
                  >
                    <Ionicons name="arrow-back" size={18} color="#374151" />
                  </TouchableOpacity>
                  <Text className="text-lg font-bold text-gray-900">
                    Send in Message
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              {/* Friend Search Bar */}
              <View className="px-5 py-2.5 border-b border-gray-100">
                <View className="flex-row items-center bg-gray-100 px-3 py-2 rounded-xl">
                  <Ionicons name="search" size={18} color="#9CA3AF" />
                  <TextInput
                    value={friendSearchQuery}
                    onChangeText={setFriendSearchQuery}
                    placeholder="Search friends..."
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 ml-2 text-sm text-gray-900 p-0"
                  />
                  {friendSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setFriendSearchQuery("")}>
                      <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Quick Message Note Input */}
              <View className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                <TextInput
                  value={messageNote}
                  onChangeText={setMessageNote}
                  placeholder="Write a note (optional)..."
                  placeholderTextColor="#9CA3AF"
                  className="text-xs text-gray-800 py-1"
                />
              </View>

              {/* Friends List */}
              {isLoadingFriends ? (
                <View className="py-12 items-center justify-center">
                  <ActivityIndicator size="small" color="#72AF5B" />
                  <Text className="text-xs text-gray-500 mt-2">Loading friends...</Text>
                </View>
              ) : filteredFriends.length === 0 ? (
                <View className="py-12 items-center justify-center px-4">
                  <Ionicons name="people-outline" size={36} color="#D1D5DB" />
                  <Text className="text-sm font-semibold text-gray-600 mt-2">
                    {friendSearchQuery ? "No friends match your search" : "No friends connected yet"}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-1 text-center">
                    {friendSearchQuery
                      ? "Try searching for a different name."
                      : "Connect with farmers and growers to send posts directly in chat."}
                  </Text>
                </View>
              ) : (
                <ScrollView className="max-h-[50vh] px-5 py-2" showsVerticalScrollIndicator={false}>
                  {filteredFriends.map((friend) => {
                    const isSent = sentFriendIds[friend.id];
                    const isSending = sendingFriendId === friend.id;

                    return (
                      <View
                        key={friend.id}
                        className="flex-row items-center justify-between py-3 border-b border-gray-50"
                      >
                        <View className="flex-row items-center flex-1 mr-3">
                          <View className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden mr-3 items-center justify-center">
                            {friend.avatarUrl ? (
                              <Image
                                source={{ uri: friend.avatarUrl }}
                                className="w-full h-full"
                                resizeMode="cover"
                              />
                            ) : (
                              <Ionicons name="person" size={20} color="#9CA3AF" />
                            )}
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                              {friend.name}
                            </Text>
                            {friend.username ? (
                              <Text className="text-xs text-gray-500" numberOfLines={1}>
                                {friend.username}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        {/* Send Action Button */}
                        <TouchableOpacity
                          onPress={() => handleSendMessageToFriend(friend)}
                          disabled={isSent || isSending}
                          className={`px-4 py-2 rounded-full flex-row items-center ${
                            isSent
                              ? "bg-green-100 border border-green-300"
                              : "bg-[#72AF5B] active:bg-[#5e944a]"
                          }`}
                        >
                          {isSending ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : isSent ? (
                            <>
                              <Ionicons name="checkmark" size={14} color="#15803D" />
                              <Text className="text-xs font-bold text-green-700 ml-1">
                                Sent
                              </Text>
                            </>
                          ) : (
                            <Text className="text-xs font-bold text-white">Send</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}


        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

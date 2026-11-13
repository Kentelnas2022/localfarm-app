import { useAuth } from "@/hooks/use-auth";
import { blockUser } from "@/services/blocked-users-service";
import {
  ActiveChatUser,
  archiveConversationApi,
  blockUserChatApi,
  ConversationItem,
  deleteConversationApi,
  getActiveChatUsersApi,
  getConversationsApi,
  muteConversationApi,
  restrictUserApi,
} from "@/services/chat-service";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChatSidebarModal from "../../components/ChatSidebarModal";
import BottomNavBar from "../../components/Navigation";

export default function Chats() {
  const router = useRouter();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveChatUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Long-press modal state
  const [selectedChatForOptions, setSelectedChatForOptions] = useState<ConversationItem | null>(null);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const fetchChatsData = async (isPull = false, isSilent = false) => {
    if (isPull) setIsRefreshing(true);
    else if (!isSilent && conversations.length === 0) setIsLoading(true);

    try {
      const [convsData, usersData] = await Promise.all([
        getConversationsApi({ category: "messages" }),
        getActiveChatUsersApi(),
      ]);
      setConversations(convsData);
      setActiveUsers(usersData);
    } catch (err) {
      console.warn("Error fetching chat data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchChatsData(false, true);

      const interval = setInterval(() => {
        fetchChatsData(false, true);
      }, 3000);

      return () => clearInterval(interval);
    }, [])
  );

  const handleOpenConversation = (chat: ConversationItem) => {
    router.push({
      pathname: "/user/ChatConversation",
      params: {
        conversationId: chat.id,
        userId: chat.otherUserId,
        name: chat.name,
        avatarUrl: chat.avatarUrl || "",
        online: "true",
      },
    } as any);
  };

  const handleOpenUserChat = (activeUser: ActiveChatUser) => {
    router.push({
      pathname: "/user/ChatConversation",
      params: {
        userId: activeUser.id,
        name: activeUser.fullName || activeUser.name,
        avatarUrl: activeUser.avatarUrl || "",
        online: "true",
      },
    } as any);
  };

  const handleOpenOptionsModal = (chat: ConversationItem) => {
    setSelectedChatForOptions(chat);
    setIsOptionsModalVisible(true);
  };

  const handleCloseOptionsModal = () => {
    if (isActionInProgress) return;
    setIsOptionsModalVisible(false);
    setSelectedChatForOptions(null);
  };

  const handleArchiveConversation = async (chat: ConversationItem) => {
    try {
      setIsActionInProgress(true);
      setConversations((prev) => prev.filter((c) => c.id !== chat.id));
      handleCloseOptionsModal();
      await archiveConversationApi(chat.id, true);
      const msg = `Conversation with ${chat.name} archived.`;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Archived", msg);
      }
      fetchChatsData(false, true);
    } catch (err: any) {
      fetchChatsData(false, true);
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleToggleMuteConversation = async (chat: ConversationItem) => {
    try {
      setIsActionInProgress(true);
      const nextMuted = !chat.isMuted;
      setConversations((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, isMuted: nextMuted } : c))
      );
      handleCloseOptionsModal();
      await muteConversationApi(chat.id, nextMuted);
      const msg = nextMuted
        ? `Notifications muted for ${chat.name}.`
        : `Notifications unmuted for ${chat.name}.`;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Notifications", msg);
      }
      fetchChatsData(false, true);
    } catch (err: any) {
      fetchChatsData(false, true);
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleToggleRestrictConversation = async (chat: ConversationItem) => {
    try {
      setIsActionInProgress(true);
      const nextRestricted = !chat.isRestricted;
      if (nextRestricted) {
        setConversations((prev) => prev.filter((c) => c.id !== chat.id));
      }
      handleCloseOptionsModal();
      await restrictUserApi(chat.otherUserId, nextRestricted);
      const msg = nextRestricted
        ? `${chat.name} restricted. Moved to Restricted Accounts.`
        : `${chat.name} is no longer restricted.`;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Restriction", msg);
      }
      fetchChatsData(false, true);
    } catch (err: any) {
      fetchChatsData(false, true);
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleBlockConversation = (chat: ConversationItem) => {
    const blockPrompt = `Block ${chat.name}? They will not be able to send you messages or find your profile on Local Farm.`;
    const performBlock = async () => {
      try {
        setIsActionInProgress(true);
        setConversations((prev) => prev.filter((c) => c.id !== chat.id));
        handleCloseOptionsModal();
        await Promise.all([
          blockUserChatApi(chat.otherUserId, true),
          blockUser({
            id: chat.otherUserId,
            name: chat.name,
            username: chat.username,
            avatarUrl: chat.avatarUrl,
          }),
        ]);
        const msg = `${chat.name} has been blocked.`;
        if (Platform.OS === "web") {
          window.alert(msg);
        } else {
          Alert.alert("Blocked", msg);
        }
        fetchChatsData(false, true);
      } catch (err: any) {
        fetchChatsData(false, true);
      } finally {
        setIsActionInProgress(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(blockPrompt)) {
        performBlock();
      }
    } else {
      Alert.alert("Block User", blockPrompt, [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: performBlock },
      ]);
    }
  };

  const handleDeleteConversation = (chat: ConversationItem) => {
    const deletePrompt = `Delete all chat with ${chat.name}? This will permanently remove all messages in this conversation. This cannot be undone.`;
    const performDelete = async () => {
      try {
        setIsActionInProgress(true);
        setConversations((prev) => prev.filter((c) => c.id !== chat.id));
        handleCloseOptionsModal();
        await deleteConversationApi({
          conversationId: chat.id,
          userId: chat.otherUserId,
        });
        const msg = `Conversation with ${chat.name} deleted.`;
        if (Platform.OS === "web") {
          window.alert(msg);
        } else {
          Alert.alert("Deleted", msg);
        }
        fetchChatsData(false, true);
      } catch (err: any) {
        fetchChatsData(false, true);
        const errMsg = err?.message || "Failed to delete chat.";
        if (Platform.OS === "web") {
          window.alert(errMsg);
        } else {
          Alert.alert("Error", errMsg);
        }
      } finally {
        setIsActionInProgress(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(deletePrompt)) {
        performDelete();
      }
    } else {
      Alert.alert("Delete All Chat", deletePrompt, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  const filteredConversations = conversations.filter((chat) => {
    const q = searchQuery.toLowerCase();
    return (
      chat.name.toLowerCase().includes(q) ||
      (chat.username && chat.username.toLowerCase().includes(q)) ||
      chat.snippet.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView
      className="flex-1 bg-white relative h-full"
      style={{ flex: 1, position: "relative", minHeight: "100%", overflow: "hidden" }}
    >
      {/* 1. Header Section */}
      <View className="flex-row justify-between items-center px-5 pt-4 pb-2 bg-white">
        <Text className="text-3xl font-bold text-gray-900">Chats</Text>
        <TouchableOpacity
          onPress={() => router.push("/user/People" as any)}
          className="p-1 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="New message"
        >
          <Ionicons name="create-outline" size={26} color="#34594A" />
        </TouchableOpacity>
      </View>

      {/* 2. Search Bar */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity
          onPress={() => setSidebarVisible(true)}
          className="p-1 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Open chat sidebar menu"
        >
          <Ionicons name="menu-outline" size={28} color="#34594A" />
        </TouchableOpacity>

        {/* Search Input */}
        <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-4 h-11 border border-gray-100">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-base text-gray-800 pr-2 h-full font-medium"
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              className="p-1 mr-1"
            >
              <Ionicons name="close-circle" size={18} color="#34594A" />
            </TouchableOpacity>
          ) : null}
          <Ionicons name="search-outline" size={20} color="#34594A" />
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        alwaysBounceVertical={false}
        alwaysBounceHorizontal={false}
        directionalLockEnabled={true}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchChatsData(true)}
            colors={["#34594A"]}
            tintColor="#34594A"
          />
        }
      >
        {/* 3. Active Users Horizontal Carousel */}
        <View className="py-2 border-b border-gray-50">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-5"
          >
            {/* Self "Me (+)" Item */}
            <View className="items-center mr-4">
              <View className="relative">
                <View className="h-14 w-14 rounded-full bg-gray-200 items-center justify-center border border-gray-200 overflow-hidden">
                  {user?.avatarUrl ? (
                    <Image
                      source={{ uri: user.avatarUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={28} color="#34594A" />
                  )}
                </View>
                <View className="absolute -bottom-0.5 -right-0.5 bg-[#34594A] w-5 h-5 rounded-full items-center justify-center border-2 border-white">
                  <Ionicons name="add" size={14} color="#FFFFFF" />
                </View>
              </View>
              <Text className="text-xs font-semibold text-gray-800 mt-1.5">
                Me
              </Text>
            </View>

            {/* Other Active Users */}
            {activeUsers.map((activeUser) => (
              <TouchableOpacity
                key={activeUser.id}
                onPress={() => handleOpenUserChat(activeUser)}
                className="items-center mr-4"
                activeOpacity={0.8}
              >
                <View className="relative">
                  <View className="h-14 w-14 rounded-full bg-gray-200 items-center justify-center border border-gray-200 overflow-hidden">
                    {activeUser.avatarUrl ? (
                      <Image
                        source={{ uri: activeUser.avatarUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={28} color="#34594A" />
                    )}
                  </View>
                  {activeUser.isOnline && (
                    <View className="absolute bottom-0 right-0 bg-[#34594A] w-3.5 h-3.5 rounded-full border-2 border-white" />
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  className="text-xs font-medium text-gray-700 mt-1.5 max-w-[60px] text-center"
                >
                  {activeUser.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 4. Conversations List */}
        {isLoading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#34594A" />
            <Text className="text-sm text-gray-500 mt-2 font-medium">
              Loading chats...
            </Text>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View className="py-16 items-center justify-center px-6">
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
              <Ionicons name="chatbubbles-outline" size={32} color="#34594A" />
            </View>
            <Text className="text-base font-bold text-gray-800 mb-1">
              No Conversations Yet
            </Text>
            <Text className="text-xs text-gray-500 text-center">
              Tap on an active user above or search for farmers to start chatting.
            </Text>
          </View>
        ) : (
          <View className="px-5 pt-1">
            {filteredConversations.map((chat) => (
              <TouchableOpacity
                key={chat.id}
                onPress={() => handleOpenConversation(chat)}
                onLongPress={() => handleOpenOptionsModal(chat)}
                className="py-3.5 border-b border-gray-100 flex-row items-center justify-between active:bg-gray-50 rounded-xl px-1"
                activeOpacity={0.7}
              >
                {/* Left: Avatar with Online Indicator */}
                <View className="relative mr-3.5">
                  <View className="h-14 w-14 rounded-full bg-gray-200 items-center justify-center border border-gray-200 overflow-hidden">
                    {chat.avatarUrl ? (
                      <Image
                        source={{ uri: chat.avatarUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={28} color="#34594A" />
                    )}
                  </View>
                  {chat.online && (
                    <View className="absolute bottom-0 right-0 bg-[#34594A] w-3.5 h-3.5 rounded-full border-2 border-white" />
                  )}
                </View>

                {/* Middle: Name & Last Message Snippet */}
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Text
                      onLongPress={() => handleOpenOptionsModal(chat)}
                      className="font-bold text-gray-900 text-base leading-tight"
                    >
                      {chat.name}
                    </Text>
                    {chat.isMuted && (
                      <Ionicons name="notifications-off" size={13} color="#9CA3AF" />
                    )}
                  </View>
                  {chat.isTyping ? (
                    <View className="flex-row items-center gap-1.5">
                      <View className="flex-row items-center gap-0.5">
                        <View className="w-1.5 h-1.5 rounded-full bg-[#34594A]" />
                        <View className="w-1.5 h-1.5 rounded-full bg-[#34594A]/70" />
                        <View className="w-1.5 h-1.5 rounded-full bg-[#34594A]/40" />
                      </View>
                      <Text
                        numberOfLines={1}
                        className="text-sm font-semibold text-[#34594A] italic"
                      >
                        typing...
                      </Text>
                    </View>
                  ) : (
                    <Text
                      numberOfLines={1}
                      className={`text-sm ${
                        chat.unread > 0
                          ? "font-bold text-gray-900"
                          : "text-gray-500 font-normal"
                      }`}
                    >
                      {chat.snippet || "Start a conversation"}
                    </Text>
                  )}
                </View>

                {/* Right: Time & Status / Badge */}
                <View className="items-end justify-center gap-1.5 min-w-[50px]">
                  <Text
                    className={`text-xs ${
                      chat.isTyping
                        ? "text-[#34594A] font-bold"
                        : chat.unread > 0
                          ? "text-red-500 font-bold"
                          : "text-gray-400 font-medium"
                    }`}
                  >
                    {chat.time}
                  </Text>

                  {chat.isTyping ? (
                    <View className="px-1.5 py-0.5 rounded-full bg-[#34594A]/15">
                      <Text className="text-[10px] text-[#34594A] font-bold">typing</Text>
                    </View>
                  ) : chat.unread > 0 ? (
                    <View className="bg-red-500 rounded-full h-5 min-w-[20px] px-1.5 items-center justify-center">
                      <Text className="text-white text-[11px] font-bold">
                        {chat.unread > 9 ? "9+" : chat.unread}
                      </Text>
                    </View>
                  ) : chat.isLastSenderMe ? (
                    chat.isSeen ? (
                      <Ionicons
                        name="checkmark-done"
                        size={16}
                        color="#34594A"
                      />
                    ) : chat.isDelivered ? (
                      <Ionicons
                        name="checkmark-done"
                        size={16}
                        color="#9CA3AF"
                      />
                    ) : (
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color="#9CA3AF"
                      />
                    )
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 5. Messenger-style Long-Press Action Modal */}
      <Modal
        visible={isOptionsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseOptionsModal}
        statusBarTranslucent={true}
      >
        <View className="flex-1 justify-end bg-black/50">
          <TouchableWithoutFeedback onPress={handleCloseOptionsModal}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <View
            className="bg-white rounded-t-3xl pt-3 pb-8 px-5 w-full max-w-lg mx-auto shadow-2xl"
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              elevation: 25,
            }}
          >
            {/* Grabber Handle */}
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mb-3" />

            {/* Target Contact Header Preview */}
            {selectedChatForOptions && (
              <View className="flex-row items-center pb-3.5 border-b border-gray-100 mb-2">
                <View className="relative mr-3.5">
                  <View className="h-12 w-12 rounded-full bg-gray-200 items-center justify-center border border-gray-200 overflow-hidden">
                    {selectedChatForOptions.avatarUrl ? (
                      <Image
                        source={{ uri: selectedChatForOptions.avatarUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={24} color="#34594A" />
                    )}
                  </View>
                  {selectedChatForOptions.online && (
                    <View className="absolute bottom-0 right-0 bg-[#34594A] w-3 h-3 rounded-full border-2 border-white" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900 leading-tight" numberOfLines={1}>
                    {selectedChatForOptions.name}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                    {selectedChatForOptions.username
                      ? `@${selectedChatForOptions.username}`
                      : selectedChatForOptions.online
                        ? "Active now"
                        : "Local Farm member"}
                  </Text>
                </View>
                {isActionInProgress && (
                  <ActivityIndicator size="small" color="#34594A" className="ml-2" />
                )}
              </View>
            )}

            {/* Action Items List */}
            {selectedChatForOptions && (
              <View className="py-1">
                {/* 1. Archive */}
                <TouchableOpacity
                  onPress={() => handleArchiveConversation(selectedChatForOptions)}
                  disabled={isActionInProgress}
                  activeOpacity={0.7}
                  className="flex-row items-center py-3 px-2 rounded-xl active:bg-gray-100"
                >
                  <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3.5">
                    <Ionicons name="archive-outline" size={20} color="#34594A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">Archive</Text>
                    <Text className="text-xs text-gray-500">Hide conversation from chats</Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Mute / Unmute */}
                <TouchableOpacity
                  onPress={() => handleToggleMuteConversation(selectedChatForOptions)}
                  disabled={isActionInProgress}
                  activeOpacity={0.7}
                  className="flex-row items-center py-3 px-2 rounded-xl active:bg-gray-100"
                >
                  <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3.5">
                    <Ionicons
                      name={selectedChatForOptions.isMuted ? "notifications-outline" : "notifications-off-outline"}
                      size={20}
                      color="#34594A"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {selectedChatForOptions.isMuted ? "Unmute notifications" : "Mute notifications"}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {selectedChatForOptions.isMuted ? "Receive message alerts again" : "Silence message alerts"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 3. Restrict */}
                <TouchableOpacity
                  onPress={() => handleToggleRestrictConversation(selectedChatForOptions)}
                  disabled={isActionInProgress}
                  activeOpacity={0.7}
                  className="flex-row items-center py-3 px-2 rounded-xl active:bg-gray-100"
                >
                  <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3.5">
                    <Ionicons name="shield-outline" size={20} color="#34594A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {selectedChatForOptions.isRestricted ? "Unrestrict" : "Restrict"}
                    </Text>
                    <Text className="text-xs text-gray-500">Move to Restricted Accounts</Text>
                  </View>
                </TouchableOpacity>

                {/* 4. Block */}
                <TouchableOpacity
                  onPress={() => handleBlockConversation(selectedChatForOptions)}
                  disabled={isActionInProgress}
                  activeOpacity={0.7}
                  className="flex-row items-center py-3 px-2 rounded-xl active:bg-red-50"
                >
                  <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center mr-3.5">
                    <Ionicons name="ban-outline" size={20} color="#DC2626" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-red-600">Block</Text>
                    <Text className="text-xs text-red-400">They won't be able to message you</Text>
                  </View>
                </TouchableOpacity>

                {/* 5. Delete all chat */}
                <TouchableOpacity
                  onPress={() => handleDeleteConversation(selectedChatForOptions)}
                  disabled={isActionInProgress}
                  activeOpacity={0.7}
                  className="flex-row items-center py-3 px-2 rounded-xl active:bg-red-50"
                >
                  <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center mr-3.5">
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-red-600">Delete all chat</Text>
                    <Text className="text-xs text-red-400">Permanently delete this entire conversation</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 6. Bottom Navigation Component */}
      <BottomNavBar accentColor="#34594A" activeTab="Chat" showFab={false} />

      {/* 7. Chat Sidebar Modal Component */}
      <ChatSidebarModal
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        activeItem="Messages"
      />
    </SafeAreaView>
  );
}

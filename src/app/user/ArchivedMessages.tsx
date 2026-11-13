import {
  archiveConversationApi,
  ConversationItem,
  deleteConversationApi,
  getConversationsApi,
} from "@/services/chat-service";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChatSidebarModal from "../../components/ChatSidebarModal";
import BottomNavBar from "../../components/Navigation";

function ArchivedListItem({
  item,
  onPress,
  onLongPress,
}: {
  item: ConversationItem;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      className="flex-row items-center px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
      activeOpacity={0.7}
    >
      {/* Left Avatar */}
      <View className="w-13 h-13 rounded-full bg-gray-200 mr-3.5 items-center justify-center overflow-hidden border border-gray-200">
        {item.avatarUrl ? (
          <Image
            source={{ uri: item.avatarUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="person" size={26} color="#34594A" />
        )}
      </View>

      {/* Middle Text Content: Name & Snippet */}
      <View className="flex-1 min-w-0 pr-2">
        <Text
          className="text-base font-bold text-gray-900 mb-0.5 leading-tight"
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          className={`text-sm ${
            item.unread > 0 ? "font-bold text-gray-900" : "text-gray-500 font-normal"
          } truncate`}
          numberOfLines={1}
        >
          {item.snippet || "Archived conversation"}
        </Text>
      </View>

      {/* Right: Time & Badge */}
      <View className="items-end justify-center min-w-[56px] flex-shrink-0 gap-1">
        <Text className="text-xs text-gray-400 font-medium">{item.time}</Text>
        {item.unread > 0 && (
          <View className="bg-red-600 h-5 min-w-[20px] rounded-full items-center justify-center px-1 shadow-2xs">
            <Text className="text-white text-[11px] font-bold text-center leading-tight">
              {item.unread}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ArchivedMessages() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [archivedList, setArchivedList] = useState<ConversationItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ConversationItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchArchived = async (isPull = false) => {
    if (isPull) setIsRefreshing(true);
    else if (archivedList.length === 0) setIsLoading(true);

    try {
      const data = await getConversationsApi({ category: "archived" });
      setArchivedList(data);
    } catch (err) {
      console.warn("Failed to fetch archived chats:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchArchived(false);
    }, [])
  );

  const handleOpenConversation = (item: ConversationItem) => {
    router.push({
      pathname: "/user/ChatConversation",
      params: {
        conversationId: item.id,
        userId: item.otherUserId,
        name: item.name,
        avatarUrl: item.avatarUrl || "",
        online: "true",
      },
    } as any);
  };

  const handleUnarchive = async (chat: ConversationItem) => {
    try {
      setArchivedList((prev) => prev.filter((c) => c.id !== chat.id));
      setSelectedChat(null);
      await archiveConversationApi(chat.id, false);
      const msg = `Conversation with ${chat.name} unarchived and moved back to Messages.`;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Unarchived", msg);
      }
      fetchArchived(false);
    } catch {
      fetchArchived(false);
    }
  };

  const handleDelete = async (chat: ConversationItem) => {
    const doDelete = async () => {
      try {
        setArchivedList((prev) => prev.filter((c) => c.id !== chat.id));
        setSelectedChat(null);
        await deleteConversationApi({
          conversationId: chat.id,
          userId: chat.otherUserId,
        });
        fetchArchived(false);
      } catch {
        fetchArchived(false);
      }
    };

    const confirmMsg = `Permanently delete conversation with ${chat.name}?`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(confirmMsg)) {
        doDelete();
      }
    } else {
      Alert.alert("Delete Conversation", confirmMsg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const filteredArchived = archivedList.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.snippet.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaView
      className="flex-1 bg-white relative h-full"
      style={{ flex: 1, position: "relative", minHeight: "100%" }}
    >
      {/* 1. Header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2 bg-white">
        <Text className="text-3xl font-bold text-gray-900 tracking-tight">
          Chats
        </Text>
      </View>

      {/* 2. Search Bar Container */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <TouchableOpacity
          onPress={() => setSidebarVisible(true)}
          className="p-1 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Ionicons name="menu-outline" size={28} color="#34594A" />
        </TouchableOpacity>

        {/* Search Input Box */}
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
            <TouchableOpacity onPress={() => setSearchQuery("")} className="p-1 mr-1">
              <Ionicons name="close-circle" size={18} color="#34594A" />
            </TouchableOpacity>
          ) : null}
          <Ionicons name="search-outline" size={20} color="#34594A" />
        </View>
      </View>

      {/* Section Title */}
      <View className="px-5 py-2 flex-row items-center justify-between border-b border-gray-50">
        <Text className="text-lg font-bold text-gray-900">Archived</Text>
        <Text className="text-xs text-gray-400 font-medium">
          {archivedList.length} {archivedList.length === 1 ? "conversation" : "conversations"}
        </Text>
      </View>

      {/* Archived Scroll List */}
      <ScrollView
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchArchived(true)}
            colors={["#34594A"]}
            tintColor="#34594A"
          />
        }
      >
        {isLoading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#34594A" />
            <Text className="text-sm text-gray-500 mt-2 font-medium">
              Loading archived chats...
            </Text>
          </View>
        ) : filteredArchived.length > 0 ? (
          filteredArchived.map((item) => (
            <ArchivedListItem
              key={item.id}
              item={item}
              onPress={() => handleOpenConversation(item)}
              onLongPress={() => setSelectedChat(item)}
            />
          ))
        ) : (
          <View className="items-center justify-center py-20 px-6">
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
              <Ionicons name="archive-outline" size={36} color="#34594A" />
            </View>
            <Text className="text-gray-800 font-bold text-base mb-1">
              No Archived Chats
            </Text>
            <Text className="text-gray-500 text-xs text-center max-w-xs">
              Long-press any conversation in your inbox and tap "Archive Chat" to hide it here.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action Sheet Modal for Selected Archived Chat */}
      <Modal
        visible={Boolean(selectedChat)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedChat(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedChat(null)}>
          <View className="flex-1 bg-black/40 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-3xl p-5 pb-8 shadow-2xl">
                <Text className="text-base font-bold text-gray-900 mb-1">
                  {selectedChat?.name}
                </Text>
                <Text className="text-xs text-gray-400 mb-4">
                  Choose an action for this archived conversation
                </Text>

                {/* Unarchive Button */}
                <TouchableOpacity
                  onPress={() => selectedChat && handleUnarchive(selectedChat)}
                  className="flex-row items-center py-3.5 px-4 rounded-xl bg-gray-50 mb-2 active:bg-gray-100"
                >
                  <Ionicons name="arrow-undo-outline" size={20} color="#34594A" style={{ marginRight: 12 }} />
                  <Text className="text-sm font-semibold text-gray-800">
                    Unarchive (Move to Messages)
                  </Text>
                </TouchableOpacity>

                {/* Open Chat Button */}
                <TouchableOpacity
                  onPress={() => {
                    const c = selectedChat;
                    setSelectedChat(null);
                    if (c) handleOpenConversation(c);
                  }}
                  className="flex-row items-center py-3.5 px-4 rounded-xl bg-gray-50 mb-2 active:bg-gray-100"
                >
                  <Ionicons name="chatbubble-outline" size={20} color="#3B82F6" style={{ marginRight: 12 }} />
                  <Text className="text-sm font-semibold text-gray-800">
                    Open Conversation
                  </Text>
                </TouchableOpacity>

                {/* Delete Button */}
                <TouchableOpacity
                  onPress={() => selectedChat && handleDelete(selectedChat)}
                  className="flex-row items-center py-3.5 px-4 rounded-xl bg-red-50 active:bg-red-100"
                >
                  <Ionicons name="trash-outline" size={20} color="#DC2626" style={{ marginRight: 12 }} />
                  <Text className="text-sm font-semibold text-red-600">
                    Delete Conversation
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Bottom Navigation Bar */}
      <BottomNavBar accentColor="#34594A" showFab={false} activeTab="Chat" />

      {/* Sidebar Drawer */}
      <ChatSidebarModal
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        activeItem="Archived"
      />
    </SafeAreaView>
  );
}

import { ConversationItem, getConversationsApi } from "@/services/chat-service";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChatSidebarModal from "../../components/ChatSidebarModal";
import BottomNavBar from "../../components/Navigation";

function RequestListItem({
  item,
  onPress,
}: {
  item: ConversationItem;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
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
          {item.snippet || "Sent you a message request"}
        </Text>
      </View>

      {/* Right: Time & Unread Badge */}
      <View className="items-end justify-center min-w-[56px] flex-shrink-0 gap-1">
        <Text className="text-xs text-gray-400 font-medium">{item.time}</Text>
        {item.unread > 0 ? (
          <View className="bg-red-500 rounded-full h-5 min-w-[20px] px-1.5 items-center justify-center">
            <Text className="text-white text-[11px] font-bold">
              {item.unread > 9 ? "9+" : item.unread}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function MessageRequests() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [requests, setRequests] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchRequests = async (isPull = false) => {
    if (isPull) setIsRefreshing(true);
    else if (requests.length === 0) setIsLoading(true);

    try {
      const data = await getConversationsApi({ category: "requests" });
      setRequests(data);
    } catch (err) {
      console.warn("Failed to fetch message requests:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchRequests(false);
    }, [])
  );

  const filteredRequests = requests.filter(
    (req) =>
      req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.username && req.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      req.snippet.toLowerCase().includes(searchQuery.toLowerCase()),
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
        <Text className="text-lg font-bold text-gray-900">Message Request</Text>
        <Text className="text-xs text-gray-400 font-medium">
          {requests.length} {requests.length === 1 ? "request" : "requests"}
        </Text>
      </View>

      {/* Message Requests List */}
      <ScrollView
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchRequests(true)}
            colors={["#34594A"]}
            tintColor="#34594A"
          />
        }
      >
        {isLoading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#34594A" />
            <Text className="text-sm text-gray-500 mt-2 font-medium">
              Loading requests...
            </Text>
          </View>
        ) : filteredRequests.length > 0 ? (
          filteredRequests.map((item) => (
            <RequestListItem
              key={item.id}
              item={item}
              onPress={() => {
                router.push({
                  pathname: "/user/ChatConversation",
                  params: {
                    conversationId: item.id,
                    userId: item.otherUserId,
                    name: item.name,
                    avatarUrl: item.avatarUrl || "",
                    isRequest: "true",
                  },
                } as any);
              }}
            />
          ))
        ) : (
          <View className="items-center justify-center py-20 px-6">
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
              <Ionicons name="chatbubbles-outline" size={32} color="#34594A" />
            </View>
            <Text className="text-gray-800 font-bold text-base mb-1">
              No Message Requests
            </Text>
            <Text className="text-gray-500 text-xs text-center max-w-xs">
              Messages from people who aren't your connections will appear here.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <BottomNavBar accentColor="#34594A" showFab={false} activeTab="Chat" />

      {/* Sidebar Drawer */}
      <ChatSidebarModal
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        activeItem="Message Request"
      />
    </SafeAreaView>
  );
}

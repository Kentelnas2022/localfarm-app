import {
  ChatMessage,
  getMessagesApi,
  restrictUserApi,
} from "@/services/chat-service";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RestrictedChatConversation() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId?: string;
    name?: string;
    avatarUrl?: string;
    conversationId?: string;
  }>();

  const otherUserId = params.userId;
  const otherUserName = params.name || "User";
  const otherUserAvatar = params.avatarUrl || "";
  const conversationId = params.conversationId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestricted, setIsRestricted] = useState(true);

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      const data = await getMessagesApi({
        conversationId: conversationId || undefined,
        userId: otherUserId,
      });
      setMessages(data.messages || []);
    } catch (e) {
      console.warn("Failed to load restricted chat messages:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [conversationId, otherUserId]);

  const handleBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/user/RestrictedAccounts" as any);
      }
    } catch {
      router.push("/user/RestrictedAccounts" as any);
    }
  };

  const handleUnrestrict = async () => {
    if (!otherUserId) return;
    try {
      setIsRestricted(false);
      await restrictUserApi(otherUserId, false);
      const msg = `${otherUserName} has been unrestricted.`;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Unrestricted", msg);
      }
      setTimeout(handleBack, 400);
    } catch {
      setIsRestricted(true);
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white relative"
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
    >
      {/* Top Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-2xs z-10">
        <View className="flex-row items-center gap-3 flex-1 pr-2">
          <TouchableOpacity
            onPress={handleBack}
            className="p-1 -ml-2 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={28} color="#000000" />
          </TouchableOpacity>

          <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center overflow-hidden border border-gray-200">
            {otherUserAvatar ? (
              <Image source={{ uri: otherUserAvatar }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <Ionicons name="person" size={22} color="#34594A" />
            )}
          </View>

          <View className="flex-1">
            <Text
              className="text-base font-bold text-gray-900 leading-tight"
              numberOfLines={1}
            >
              {otherUserName}
            </Text>
            <Text className="text-xs text-gray-400 font-medium">Restricted</Text>
          </View>
        </View>
      </View>

      {/* Messages List */}
      <ScrollView
        className="flex-1 bg-[#F9F9F9] px-4 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: messages.length === 0 ? "center" : "flex-end", paddingBottom: 24 }}
      >
        {isLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="small" color="#34594A" />
          </View>
        ) : messages.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-xs text-gray-400">No messages found.</Text>
          </View>
        ) : (
          messages.map((item) => {
            const isUser = item.sender === "user";
            return (
              <View key={item.id} className="mb-2.5">
                <View
                  className={`flex-row items-end ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isUser && (
                    <View className="w-7 h-7 rounded-full bg-gray-200 mr-2 items-center justify-center overflow-hidden border border-gray-200">
                      {otherUserAvatar ? (
                        <Image source={{ uri: otherUserAvatar }} className="w-full h-full" resizeMode="cover" />
                      ) : (
                        <Ionicons name="person" size={14} color="#34594A" />
                      )}
                    </View>
                  )}

                  <View
                    className={`px-4 py-2.5 max-w-[76%] rounded-2xl ${
                      isUser
                        ? "bg-[#34594A] rounded-br-xs"
                        : "bg-[#F0F0F0] rounded-bl-xs shadow-2xs"
                    }`}
                  >
                    <Text
                      className={`text-sm leading-snug ${
                        isUser ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {item.text || (item.type === "image" ? "📷 [Photo]" : "Shared attachment")}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View className="px-4 pt-3.5 pb-6 bg-white border-t border-gray-100">
        <Text className="text-xs text-gray-500 text-center mb-2.5 font-medium">
          {isRestricted
            ? `You restricted ${otherUserName}. They won't see when you're online or read messages.`
            : `${otherUserName} has been unrestricted.`}
        </Text>

        <TouchableOpacity
          onPress={handleUnrestrict}
          disabled={!isRestricted}
          className={`w-full rounded-xl py-3 items-center justify-center shadow-2xs ${
            isRestricted ? "bg-gray-800 active:bg-gray-900" : "bg-green-600"
          }`}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Unrestrict user"
        >
          <Text className="text-sm font-bold text-white">
            {isRestricted ? "Unrestrict" : "Unrestricted ✓"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

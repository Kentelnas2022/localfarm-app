import {
  deleteNotificationApi,
  getNotificationsApi,
  markAllNotificationsAsReadApi,
  markNotificationAsReadApi,
  NotificationItem,
} from "@/services/notification-service";
import { useAuth } from "@/hooks/use-auth";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

export { NotificationItem };
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  onUnreadCountChange,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<
    NotificationItem["announcement"] | null
  >(null);

  const loadNotifications = useCallback(async () => {
    try {
      const { notifications: list, unreadCount } = await getNotificationsApi();
      // Filter out any self-notifications (e.g. user commented/liked/shared their own post)
      const filtered = list.filter((n) => {
        if (!user) return true;
        // Keep announcements and official system alerts
        if (
          n.type === "announcement" ||
          n.type === "scam_alert" ||
          n.type === "emergency" ||
          n.id.startsWith("announcement_")
        ) {
          return true;
        }
        const isSelfActorId =
          n.user?.id && String(n.user.id) === String(user.id);
        const isSelfActorName =
          user.name &&
          n.user?.name &&
          n.user.name.trim().toLowerCase() === user.name.trim().toLowerCase();
        return !isSelfActorId && !isSelfActorName;
      });
      setNotifications(filtered);
      if (onUnreadCountChange) {
        onUnreadCountChange(filtered.filter((n) => n.isUnread).length);
      }
    } catch (err) {
      console.warn("[NotificationModal] Load error:", err);
    }
  }, [onUnreadCountChange, user]);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      loadNotifications().finally(() => setIsLoading(false));
    } else {
      setShowSearch(false);
      setSearchQuery("");
      setSelectedAnnouncement(null);
    }
  }, [visible, loadNotifications]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isUnread: false })));
    if (onUnreadCountChange) {
      onUnreadCountChange(0);
    }
    await markAllNotificationsAsReadApi();
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    if (item.isUnread) {
      setNotifications((prev) => {
        const updated = prev.map((n) =>
          n.id === item.id ? { ...n, isUnread: false } : n,
        );
        if (onUnreadCountChange) {
          onUnreadCountChange(updated.filter((n) => n.isUnread).length);
        }
        return updated;
      });
      await markNotificationAsReadApi(item.id);
    }

    if (
      item.type === "announcement" ||
      item.type === "scam_alert" ||
      item.type === "emergency" ||
      item.id.startsWith("announcement_") ||
      item.announcement
    ) {
      setSelectedAnnouncement(
        item.announcement || {
          id: item.id,
          title: item.title || "Official Notice",
          content: item.content,
          category: item.entityName || (item.type === "scam_alert" ? "Scam Alert" : "General Notice"),
          priority: item.type === "emergency" ? "Urgent" : item.type === "scam_alert" ? "Urgent" : "Normal",
          createdAt: item.createdAt || new Date().toISOString(),
          author: item.user?.name || "Local Farm Admin",
        },
      );
      return;
    }

    if (item.type === "friend_request" || item.type === "friend_accepted") {
      onClose();
      router.push("/user/Friends" as any);
    } else if (
      item.type === "tag" ||
      item.type === "like" ||
      item.type === "comment"
    ) {
      onClose();
    }
  };

  const handleDeleteNotification = (id: string) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setNotifications((prev) => {
              const updated = prev.filter((n) => n.id !== id);
              if (onUnreadCountChange) {
                onUnreadCountChange(updated.filter((n) => n.isUnread).length);
              }
              return updated;
            });
            await deleteNotificationApi(id);
          },
        },
      ],
    );
  };

  const handleOptionsPress = (item: NotificationItem) => {
    Alert.alert("Notification Options", item.title || "Options", [
      { text: "Cancel", style: "cancel" },
      item.isUnread
        ? {
            text: "Mark as read",
            onPress: async () => {
              setNotifications((prev) => {
                const updated = prev.map((n) =>
                  n.id === item.id ? { ...n, isUnread: false } : n,
                );
                if (onUnreadCountChange) {
                  onUnreadCountChange(updated.filter((n) => n.isUnread).length);
                }
                return updated;
              });
              await markNotificationAsReadApi(item.id);
            },
          }
        : {
            text: "Close",
            style: "cancel",
          },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDeleteNotification(item.id),
      },
    ]);
  };

  const getReactionBadge = (type: NotificationItem["type"]) => {
    switch (type) {
      case "tag":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#6366F1] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="pricetag" size={11} color="white" />
          </View>
        );
      case "like":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#EF4444] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="heart" size={11} color="white" />
          </View>
        );
      case "comment":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#10B981] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="chatbubble" size={11} color="white" />
          </View>
        );
      case "friend_request":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1877f2] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="person-add" size={11} color="white" />
          </View>
        );
      case "friend_accepted":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#10B981] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="checkmark-circle" size={11} color="white" />
          </View>
        );
      case "group_invite":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1877f2] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="people" size={12} color="white" />
          </View>
        );
      case "mention":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2e7d32] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="at" size={12} color="white" />
          </View>
        );
      case "challenge":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#f59e0b] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="trophy" size={11} color="white" />
          </View>
        );
      case "scam_alert":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#EF4444] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="warning" size={11} color="white" />
          </View>
        );
      case "emergency":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#F59E0B] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="alert-circle" size={11} color="white" />
          </View>
        );
      case "announcement":
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#10B981] items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="megaphone" size={11} color="white" />
          </View>
        );
      case "system":
      default:
        return (
          <View
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-600 items-center justify-center border-2 border-white"
            style={{ elevation: 2 }}
          >
            <Ionicons name="notifications" size={11} color="white" />
          </View>
        );
    }
  };

  const filteredNotifications = searchQuery.trim()
    ? notifications.filter((n) => {
        const q = searchQuery.toLowerCase();
        return (
          n.user.name.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.entityName && n.entityName.toLowerCase().includes(q))
        );
      })
    : notifications;

  const unreadCount = notifications.filter((n) => n.isUnread).length;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <View
          className="flex-1 bg-white"
          style={{ flex: 1, backgroundColor: "#ffffff" }}
        >
          <SafeAreaView
            className="flex-1 bg-white"
            style={{ flex: 1, backgroundColor: "#ffffff" }}
            edges={["top", "bottom", "left", "right"]}
          >
            {/* 1. Top Navigation Bar */}
            <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-100">
              {/* Back Icon */}
              <TouchableOpacity
                onPress={onClose}
                className="p-1 -ml-1 active:opacity-70 flex-row items-center"
                accessibilityRole="button"
                accessibilityLabel="Close notifications"
              >
                <Ionicons name="arrow-back" size={26} color="#72AF5B" />
              </TouchableOpacity>

              {/* Title */}
              <Text className="text-xl font-bold text-black ml-3 flex-1">
                Notifications
              </Text>

              {/* Right Action Icons */}
              <View className="flex-row items-center gap-3">
                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={handleMarkAllAsRead}
                    className="py-1 px-2 rounded-md bg-white border border-[#72AF5B]"
                    accessibilityRole="button"
                    accessibilityLabel="Mark all as read"
                  >
                    <Text className="text-xs font-semibold text-[#000000]">
                      Mark all read
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setShowSearch((prev) => !prev)}
                  className="p-1 active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel="Search notifications"
                >
                  <Ionicons
                    name={showSearch ? "close-circle" : "search"}
                    size={22}
                    color="black"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  className="p-1 active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel="Close notifications"
                >
                  <Ionicons name="close" size={26} color="black" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Optional Search Bar */}
            {showSearch && (
              <View className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex-row items-center">
                <Ionicons name="search" size={18} color="#9CA3AF" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search notifications..."
                  className="flex-1 ml-2 text-sm text-gray-800"
                  autoFocus={true}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Notification List */}
            {isLoading ? (
              <View className="flex-1 items-center justify-center p-12">
                <ActivityIndicator size="large" color="#72AF5B" />
                <Text className="text-gray-500 text-sm mt-3">
                  Loading notifications...
                </Text>
              </View>
            ) : (
              <ScrollView
                className="flex-1 bg-white"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    colors={["#72AF5B"]}
                    tintColor="#72AF5B"
                  />
                }
              >
                {filteredNotifications.length === 0 ? (
                  <View className="p-12 items-center justify-center">
                    <Ionicons
                      name="notifications-off-outline"
                      size={48}
                      color="#9CA3AF"
                    />
                    <Text className="text-gray-500 text-base mt-3">
                      {searchQuery
                        ? "No matching notifications"
                        : "No notifications to show"}
                    </Text>
                  </View>
                ) : (
                  filteredNotifications.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleNotificationPress(item)}
                      className={`flex-row px-4 py-3.5 border-b border-gray-100 items-start ${
                        item.isUnread ? "bg-[#e7f3ff]" : "bg-white"
                      }`}
                      activeOpacity={0.8}
                    >
                      {/* Left Column (Avatar Person Icon & Badge) */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          if (
                            item.type === "announcement" ||
                            item.type === "scam_alert" ||
                            item.type === "emergency" ||
                            item.id.startsWith("announcement_") ||
                            item.announcement
                          ) {
                            handleNotificationPress(item);
                          } else {
                            onClose();
                            router.push("/user/Friends" as any);
                          }
                        }}
                        className="relative mr-3.5"
                      >
                        {item.type === "scam_alert" ? (
                          <View className="w-14 h-14 rounded-full bg-red-100 border border-red-300 items-center justify-center">
                            <Ionicons name="warning" size={26} color="#DC2626" />
                          </View>
                        ) : item.type === "emergency" ? (
                          <View className="w-14 h-14 rounded-full bg-amber-100 border border-amber-300 items-center justify-center">
                            <Ionicons name="alert-circle" size={26} color="#D97706" />
                          </View>
                        ) : item.type === "announcement" ? (
                          <View className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-300 items-center justify-center">
                            <Ionicons name="megaphone" size={24} color="#059669" />
                          </View>
                        ) : (
                          <View className="w-14 h-14 rounded-full bg-gray-200 border border-gray-300 items-center justify-center overflow-hidden">
                            {item.user.avatarUrl ? (
                              <Image
                                source={{ uri: item.user.avatarUrl }}
                                className="w-full h-full"
                                resizeMode="cover"
                              />
                            ) : (
                              <Ionicons name="person" size={28} color="#6B7280" />
                            )}
                          </View>
                        )}
                        {getReactionBadge(item.type)}
                      </TouchableOpacity>

                      {/* Middle Column (Text Content) */}
                      <View className="flex-1 pr-2">
                        {item.type === "scam_alert" ||
                        item.type === "emergency" ||
                        item.type === "announcement" ||
                        item.announcement ? (
                          <View>
                            <View className="flex-row items-center gap-1.5 mb-1">
                              <Text
                                className={`text-[11px] font-bold uppercase tracking-wider ${
                                  item.type === "scam_alert"
                                    ? "text-red-600"
                                    : item.type === "emergency"
                                    ? "text-amber-600"
                                    : "text-emerald-700"
                                }`}
                              >
                                Official Notice • {item.entityName || (item.type === "scam_alert" ? "Scam Alert" : "Bulletin")}
                              </Text>
                            </View>
                            <Text
                              className="text-[14px] font-bold text-gray-900 leading-snug"
                              numberOfLines={2}
                            >
                              {item.title}
                            </Text>
                            <Text
                              className="text-xs text-gray-600 mt-1 leading-4"
                              numberOfLines={2}
                            >
                              {item.content}
                            </Text>
                            <Text className="text-[11px] font-semibold text-emerald-700 mt-1">
                              Tap to read full details →
                            </Text>
                          </View>
                        ) : (
                          /* Main User Notification Text Content */
                          (() => {
                            let bodyText = item.content || "";
                            if (
                              item.user.name &&
                              bodyText
                                .toLowerCase()
                                .startsWith(item.user.name.toLowerCase())
                            ) {
                              bodyText = bodyText
                                .slice(item.user.name.length)
                                .trim();
                            }

                            const showEntityName =
                              item.entityName &&
                              !["connection", "post"].includes(
                                item.entityName.toLowerCase(),
                              );

                            return (
                              <Text className="text-[14px] text-gray-900 leading-snug">
                                <Text
                                  className="font-bold text-black"
                                  onPress={() => {
                                    onClose();
                                    router.push("/user/Friends" as any);
                                  }}
                                >
                                  {item.user.name}
                                </Text>{" "}
                                {bodyText}
                                {showEntityName ? (
                                  <Text className="font-bold text-black">
                                    {" "}
                                    {item.entityName}
                                  </Text>
                                ) : null}
                              </Text>
                            );
                          })()
                        )}

                        {/* Timestamp */}
                        <Text className="text-xs text-gray-500 mt-1">
                          {item.time}
                        </Text>
                      </View>

                      {/* Right Column (Options: Horizontal Ellipsis) */}
                      <TouchableOpacity
                        onPress={() => handleOptionsPress(item)}
                        className="p-1 -mr-1 self-start"
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Notification options"
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color="#65676B"
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}

            {/* Official Announcement / Scam Alert Details Modal */}
            <Modal
              visible={Boolean(selectedAnnouncement)}
              transparent
              animationType="fade"
              onRequestClose={() => setSelectedAnnouncement(null)}
            >
              <View className="flex-1 bg-black/60 items-center justify-center p-4">
                <View className="bg-white rounded-2xl w-full max-w-md max-h-[85%] overflow-hidden shadow-2xl">
                  {/* Modal Header */}
                  <View
                    className={`p-4 border-b flex-row items-center justify-between ${
                      selectedAnnouncement?.priority === "Urgent" ||
                      selectedAnnouncement?.category === "Scam Alert"
                        ? "bg-red-50 border-red-200"
                        : "bg-emerald-50 border-emerald-200"
                    }`}
                  >
                    <View className="flex-row items-center gap-2 flex-1 pr-2">
                      <Ionicons
                        name={
                          selectedAnnouncement?.category === "Scam Alert"
                            ? "warning"
                            : selectedAnnouncement?.priority === "Urgent"
                            ? "alert-circle"
                            : "megaphone"
                        }
                        size={22}
                        color={
                          selectedAnnouncement?.priority === "Urgent" ||
                          selectedAnnouncement?.category === "Scam Alert"
                            ? "#DC2626"
                            : "#059669"
                        }
                      />
                      <Text
                        className={`text-sm font-bold uppercase tracking-wider ${
                          selectedAnnouncement?.priority === "Urgent" ||
                          selectedAnnouncement?.category === "Scam Alert"
                            ? "text-red-800"
                            : "text-emerald-900"
                        }`}
                        numberOfLines={1}
                      >
                        {selectedAnnouncement?.category || "Official Notice"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedAnnouncement(null)}
                      className="w-8 h-8 rounded-full bg-white/80 items-center justify-center"
                    >
                      <Ionicons name="close" size={20} color="#4B5563" />
                    </TouchableOpacity>
                  </View>

                  {/* Modal Content */}
                  <ScrollView
                    className="p-4"
                    showsVerticalScrollIndicator={false}
                  >
                    <View className="flex-row items-center gap-2 mb-2">
                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          selectedAnnouncement?.priority === "Urgent"
                            ? "bg-red-100"
                            : "bg-gray-100"
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            selectedAnnouncement?.priority === "Urgent"
                              ? "text-red-700"
                              : "text-gray-700"
                          }`}
                        >
                          Priority: {selectedAnnouncement?.priority || "Normal"}
                        </Text>
                      </View>
                      {selectedAnnouncement?.targetAudience && (
                        <View className="px-2 py-0.5 rounded-full bg-blue-50">
                          <Text className="text-[11px] font-semibold text-blue-700">
                            Audience: {selectedAnnouncement.targetAudience}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text className="text-lg font-bold text-gray-900 mb-3 leading-6">
                      {selectedAnnouncement?.title}
                    </Text>

                    <Text className="text-sm text-gray-700 leading-6 mb-6">
                      {selectedAnnouncement?.content}
                    </Text>

                    {/* Author & Timestamp */}
                    <View className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-4">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs text-gray-500">Issued by:</Text>
                        <Text className="text-xs font-semibold text-gray-800">
                          {selectedAnnouncement?.author ||
                            "Local Farm Administration"}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-gray-500">Published:</Text>
                        <Text className="text-xs font-medium text-gray-600">
                          {selectedAnnouncement?.createdAt
                            ? new Date(
                                selectedAnnouncement.createdAt,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Official Bulletin"}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => setSelectedAnnouncement(null)}
                      className="w-full py-3 bg-[#72AF5B] rounded-xl items-center justify-center mt-2 active:opacity-90"
                    >
                      <Text className="text-white font-bold text-sm">
                        Got it, I understand
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
};

export default NotificationModal;

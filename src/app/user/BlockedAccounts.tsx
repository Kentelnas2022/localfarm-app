import { useToast } from "@/context/toast-context";
import {
  BlockedUserItem,
  getBlockedUsers,
  unblockUser,
} from "@/services/blocked-users-service";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BlockedAccounts() {
  const { showToast } = useToast();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const fetchBlocked = async (isPull = false) => {
    if (isPull) setIsRefreshing(true);
    try {
      const data = await getBlockedUsers();
      setBlockedUsers(data);
    } catch (err) {
      console.warn("Failed to load blocked accounts:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getBlockedUsers()
      .then((data) => {
        if (isMounted) setBlockedUsers(data);
      })
      .catch((err) => {
        console.warn("Failed to load blocked accounts:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return blockedUsers;
    const q = searchQuery.toLowerCase();
    return blockedUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q))
    );
  }, [blockedUsers, searchQuery]);

  const handleUnblockPress = (user: BlockedUserItem) => {
    Alert.alert(
      `Unblock ${user.name}?`,
      `${user.name} will be able to see your profile, posts, and send messages or connection requests.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: async () => {
            setUnblockingId(user.id);
            try {
              const updated = await unblockUser(user.id);
              setBlockedUsers(updated);
              showToast(`${user.name} has been unblocked.`, "success");
            } catch (err: any) {
              showToast(err?.message || "Failed to unblock user.", "error");
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/user/MenuProfile" as any);
      }
    } catch {
      router.push("/user/MenuProfile" as any);
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-[#F8F9FA] relative h-full"
      style={{ flex: 1, backgroundColor: "#F8F9FA" }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 pt-3 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          className="p-1 mr-3"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-undo" size={26} color="#1F2937" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-gray-900">Blocked Accounts</Text>
          <Text className="text-xs text-gray-500">
            {blockedUsers.length}{" "}
            {blockedUsers.length === 1 ? "person blocked" : "people blocked"}
          </Text>
        </View>
      </View>

      {/* Info Callout */}
      <View className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Text className="text-xs text-gray-600 leading-4">
          {"Once you block someone, they won't be able to find your profile, view your posts, or send you messages and connection requests."}
        </Text>
      </View>

      {/* Search Bar */}
      {blockedUsers.length > 0 && (
        <View className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
          <View className="flex-row items-center bg-gray-100 rounded-full px-3.5 h-10 border border-gray-100">
            <Ionicons
              name="search-outline"
              size={18}
              color="#9CA3AF"
              style={{ marginRight: 8 }}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search blocked users..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-sm text-gray-800 pr-2 h-full"
              autoCapitalize="none"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                activeOpacity={0.7}
                className="p-1"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* Content */}
      <ScrollView
        className="flex-1 px-4 pt-3"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchBlocked(true)}
            colors={["#77af5c"]}
            tintColor="#77af5c"
          />
        }
      >
        {isLoading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#77af5c" />
            <Text className="text-sm text-gray-500 mt-2 font-medium">
              Loading blocked accounts...
            </Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View className="py-16 items-center justify-center px-6">
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
              <Ionicons name="ban-outline" size={32} color="#9CA3AF" />
            </View>
            <Text className="text-base font-bold text-gray-800 mb-1 text-center">
              {searchQuery ? "No Matching Users" : "No Blocked Accounts"}
            </Text>
            <Text className="text-xs text-gray-500 text-center leading-5">
              {searchQuery
                ? "Try searching with a different name."
                : "People you block from their profile options will appear here. You can unblock them at any time."}
            </Text>
          </View>
        ) : (
          <View
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            {filteredUsers.map((user, idx) => {
              const isUnblocking = unblockingId === user.id;
              const isLast = idx === filteredUsers.length - 1;

              return (
                <View
                  key={user.id}
                  className={`flex-row items-center px-4 py-3.5 ${
                    !isLast ? "border-b border-gray-100" : ""
                  }`}
                >
                  {/* Avatar */}
                  <View className="h-12 w-12 rounded-full bg-gray-200 items-center justify-center mr-3.5 overflow-hidden border border-gray-200">
                    {user.avatarUrl ? (
                      <Image
                        source={{ uri: user.avatarUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={24} color="#6B7280" />
                    )}
                  </View>

                  {/* Info */}
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-bold text-gray-900 leading-tight">
                      {user.name}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      {user.username ? `@${user.username}` : "Blocked User"}
                    </Text>
                  </View>

                  {/* Unblock Button */}
                  <TouchableOpacity
                    onPress={() => handleUnblockPress(user)}
                    disabled={isUnblocking}
                    activeOpacity={0.7}
                    className="px-4 py-2 rounded-full border border-gray-300 bg-white items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel={`Unblock ${user.name}`}
                  >
                    {isUnblocking ? (
                      <ActivityIndicator size="small" color="#4B5563" />
                    ) : (
                      <Text className="text-xs font-semibold text-gray-800">
                        Unblock
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

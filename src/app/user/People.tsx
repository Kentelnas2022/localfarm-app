import { useToast } from "@/context/toast-context";
import {
  cancelFriendRequestApi,
  ConnectionRequestItem,
  getConnectionRequestsApi,
  respondToConnectionRequestApi,
  SearchedUserItem,
  searchUsersToConnectApi,
  sendFriendRequestApi,
} from "@/services/connection-service";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
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

import BottomNavBar from "../../components/Navigation";
import SidebarMenu from "../../components/SidebarMenu";

export default function People() {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("Request");

  // Requests state
  const [requests, setRequests] = useState<ConnectionRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestStates, setRequestStates] = useState<
    Record<string, "confirmed" | "declined" | "loading" | undefined>
  >({});

  // Search state
  const [searchResults, setSearchResults] = useState<SearchedUserItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchActionLoading, setSearchActionLoading] = useState<
    Record<string, boolean>
  >({});
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRequests = async (isPull = false) => {
    if (isPull) setIsRefreshing(true);
    try {
      const data = await getConnectionRequestsApi();
      setRequests(data);
    } catch (err: any) {
      console.log("Failed to fetch connection requests:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getConnectionRequestsApi()
      .then((data) => {
        if (isMounted) setRequests(data);
      })
      .catch((err: any) => {
        console.log("Failed to fetch connection requests:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        setSearchResults([]);
        setIsSearching(false);
      }, 0);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchUsersToConnectApi(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.warn("User search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Request actions
  const handleConfirm = async (item: ConnectionRequestItem | SearchedUserItem) => {
    const id = "connectionId" in item && item.connectionId ? item.connectionId : item.id;
    setRequestStates((prev) => ({ ...prev, [id]: "loading" }));
    try {
      await respondToConnectionRequestApi(id, "confirm");
      setRequestStates((prev) => ({ ...prev, [id]: "confirmed" }));
      showToast(`Connected with ${item.name}!`, "success");
      // Update in search results if present
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, relationship: "accepted" } : u
        )
      );
    } catch (err: any) {
      setRequestStates((prev) => ({ ...prev, [id]: undefined }));
      showToast(err?.message || "Failed to confirm request.", "error");
    }
  };

  const handleDecline = async (item: ConnectionRequestItem | SearchedUserItem) => {
    const id = "connectionId" in item && item.connectionId ? item.connectionId : item.id;
    setRequestStates((prev) => ({ ...prev, [id]: "loading" }));
    try {
      await respondToConnectionRequestApi(id, "decline");
      setRequestStates((prev) => ({ ...prev, [id]: "declined" }));
      showToast("Request removed.", "info");
      // Update in search results if present
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, relationship: "none" } : u
        )
      );
    } catch (err: any) {
      setRequestStates((prev) => ({ ...prev, [id]: undefined }));
      showToast(err?.message || "Failed to decline request.", "error");
    }
  };

  // Send friend request from search
  const handleSendFriendRequest = async (user: SearchedUserItem) => {
    setSearchActionLoading((prev) => ({ ...prev, [user.id]: true }));
    try {
      const res = await sendFriendRequestApi(user.id);
      showToast(res.message || `Friend request sent to ${user.name}!`, "success");
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, relationship: "pending_sent", connectionId: res.connectionId || null }
            : u
        )
      );
    } catch (err: any) {
      showToast(err?.message || "Failed to send friend request.", "error");
    } finally {
      setSearchActionLoading((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  // Cancel friend request
  const handleCancelRequest = async (user: SearchedUserItem) => {
    setSearchActionLoading((prev) => ({ ...prev, [user.id]: true }));
    try {
      await cancelFriendRequestApi(user.id, user.connectionId || undefined);
      showToast("Friend request canceled.", "info");
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, relationship: "none", connectionId: null } : u
        )
      );
    } catch (err: any) {
      showToast(err?.message || "Failed to cancel request.", "error");
    } finally {
      setSearchActionLoading((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  const isSearchMode = searchQuery.trim().length > 0;
  const activeRequests = requests.filter((r) => requestStates[r.id] !== "declined");

  return (
    <SafeAreaView
      className="flex-1 bg-white relative h-full"
      style={{ flex: 1, position: "relative", minHeight: "100%", overflow: "hidden" }}
    >
      {/* Main Content */}
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
            onRefresh={() => fetchRequests(true)}
            colors={["#34594A"]}
            tintColor="#34594A"
          />
        }
      >
        {/* Header Section */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-3xl font-bold text-gray-900">Connection</Text>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center px-5 py-3 gap-3">
          <TouchableOpacity
            onPress={() => setSidebarVisible(true)}
            className="p-1 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Open sidebar menu"
          >
            <Ionicons name="person-add-outline" size={26} color="#34594A" />
          </TouchableOpacity>

          {/* Search Input */}
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-4 h-11 border border-gray-100">
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search users to add..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-base text-gray-800 pr-2 h-full font-medium"
              autoCapitalize="none"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                className="p-1 mr-1"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="#34594A" />
              </TouchableOpacity>
            ) : null}
            <Ionicons name="search-outline" size={20} color="#34594A" />
          </View>
        </View>

        {/* -------------------- SEARCH MODE -------------------- */}
        {isSearchMode ? (
          <View className="px-5">
            <View className="flex-row justify-between items-center py-2 mb-2">
              <Text className="text-lg font-semibold text-gray-900">
                Search Results{" "}
                <Text className="text-[#34594A] font-bold">
                  ({searchResults.length})
                </Text>
              </Text>
              {isSearching ? <ActivityIndicator size="small" color="#34594A" /> : null}
            </View>

            {isSearching ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="large" color="#34594A" />
                <Text className="text-xs text-gray-500 mt-2">
                  Searching for users...
                </Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View className="py-16 items-center justify-center px-6">
                <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
                  <Ionicons name="search-outline" size={32} color="#34594A" />
                </View>
                <Text className="text-base font-bold text-gray-800 mb-1">
                  No Users Found
                </Text>
                <Text className="text-xs text-gray-500 text-center">
                  Try searching with a different name or username.
                </Text>
              </View>
            ) : (
              searchResults.map((user) => {
                const isLoadingAction = searchActionLoading[user.id];

                return (
                  <View
                    key={user.id}
                    className="py-3.5 border-b border-gray-100 flex-row items-center justify-between"
                  >
                    {/* Avatar */}
                    <View
                      className="h-13 w-13 rounded-full bg-gray-200 items-center justify-center mr-3.5 border border-gray-200 overflow-hidden"
                      style={{ width: 50, height: 50 }}
                    >
                      {user.avatarUrl ? (
                        <Image
                          source={{ uri: user.avatarUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={26} color="#34594A" />
                      )}
                    </View>

                    {/* Name & Username */}
                    <View className="flex-1 pr-2">
                      <Text className="font-bold text-gray-900 text-base leading-tight">
                        {user.name}
                      </Text>
                      <Text className="text-gray-500 text-xs mt-0.5">
                        {user.username ? `@${user.username}` : "Local Farmer"}
                      </Text>
                    </View>

                    {/* Action Buttons based on relationship */}
                    {user.relationship === "accepted" ? (
                      <View className="bg-[#EDF3EE] px-3 py-1.5 rounded-xl flex-row items-center gap-1 border border-[#E3ECE5]">
                        <Ionicons name="checkmark-circle" size={14} color="#34594A" />
                        <Text className="text-[#34594A] font-bold text-xs">
                          Connected
                        </Text>
                      </View>
                    ) : user.relationship === "pending_sent" ? (
                      <TouchableOpacity
                        onPress={() => handleCancelRequest(user)}
                        disabled={isLoadingAction}
                        className="bg-gray-100 px-3 py-1.5 rounded-xl flex-row items-center gap-1 border border-gray-200 active:bg-gray-200"
                      >
                        {isLoadingAction ? (
                          <ActivityIndicator size="small" color="#6B7280" />
                        ) : (
                          <>
                            <Ionicons name="time-outline" size={14} color="#34594A" />
                            <Text className="text-gray-700 font-semibold text-xs">
                              Requested
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : user.relationship === "pending_received" ? (
                      <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity
                          onPress={() => handleConfirm(user)}
                          className="bg-[#34594A] px-3 py-1.5 rounded-xl items-center justify-center active:bg-[#2A4F3E]"
                        >
                          <Text className="text-white font-bold text-xs">Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDecline(user)}
                          className="bg-gray-200 px-2.5 py-1.5 rounded-xl items-center justify-center active:bg-gray-300"
                        >
                          <Text className="text-gray-700 font-semibold text-xs">Decline</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      /* Not Connected: Add Friend Button */
                      <TouchableOpacity
                        onPress={() => handleSendFriendRequest(user)}
                        disabled={isLoadingAction}
                        className="bg-[#34594A] px-3.5 py-2 rounded-xl flex-row items-center justify-center gap-1 active:bg-[#2A4F3E] shadow-2xs"
                        activeOpacity={0.8}
                      >
                        {isLoadingAction ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="person-add" size={14} color="#FFFFFF" />
                            <Text className="text-white font-bold text-xs">
                              Add Friend
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          /* -------------------- INCOMING REQUESTS MODE -------------------- */
          <>
            {/* Request Header */}
            <View className="flex-row justify-between items-center px-5 py-3 mb-1">
              <Text className="text-lg font-semibold text-gray-900">
                Request{" "}
                <Text className="text-[#34594A] font-bold">
                  {activeRequests.filter((r) => requestStates[r.id] !== "confirmed").length}
                </Text>
              </Text>
            </View>

            {/* Loading State */}
            {isLoading ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="large" color="#34594A" />
                <Text className="text-sm text-gray-500 mt-2 font-medium">
                  Loading requests...
                </Text>
              </View>
            ) : activeRequests.length === 0 ? (
              <View className="py-16 items-center justify-center px-6">
                <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
                  <Ionicons name="people-outline" size={32} color="#34594A" />
                </View>
                <Text className="text-base font-bold text-gray-800 mb-1">
                  No Connection Requests
                </Text>
                <Text className="text-xs text-gray-500 text-center">
                  Use the search bar above to find farmers and send friend requests!
                </Text>
              </View>
            ) : (
              /* Request List */
              <View className="px-5">
                {activeRequests.map((item) => {
                  const state = requestStates[item.id];

                  return (
                    <View
                      key={item.id}
                      className="py-3.5 border-b border-gray-100 flex-row items-start justify-between"
                    >
                      {/* Circular Avatar */}
                      <View className="h-14 w-14 rounded-full bg-gray-200 items-center justify-center mr-3.5 border border-gray-200 overflow-hidden">
                        {item.avatarUrl ? (
                          <Image
                            source={{ uri: item.avatarUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons name="person" size={28} color="#34594A" />
                        )}
                      </View>

                      {/* Main Info & Action Buttons */}
                      <View className="flex-1">
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1 pr-2">
                            <Text className="font-bold text-gray-900 text-base leading-tight mb-1">
                              {item.name}
                            </Text>
                            <View className="flex-row items-center mb-2.5">
                              <Ionicons
                                name="people"
                                size={13}
                                color="#34594A"
                                style={{ marginRight: 4 }}
                              />
                              <Text className="text-gray-500 text-xs font-medium">
                                {item.mutualFriends || "Local Farm member"}
                              </Text>
                            </View>
                          </View>

                          {/* Time Received */}
                          <Text className="text-[#34594A] font-medium text-xs">
                            {item.timeAgo || "Recently"}
                          </Text>
                        </View>

                        {/* Card Bottom Buttons */}
                        {state === "confirmed" ? (
                          <View className="bg-[#EDF3EE] border border-[#34594A] py-2 rounded-xl items-center flex-row justify-center gap-1.5">
                            <Ionicons name="checkmark-circle" size={16} color="#34594A" />
                            <Text className="text-[#34594A] font-bold text-xs">
                              Request Confirmed
                            </Text>
                          </View>
                        ) : state === "declined" ? (
                          <View className="bg-red-50 border border-red-200 py-2 rounded-xl items-center">
                            <Text className="text-red-500 font-semibold text-xs">
                              Request Removed
                            </Text>
                          </View>
                        ) : (
                          <View className="flex-row items-center gap-2">
                            {/* Confirm Button */}
                            <TouchableOpacity
                              onPress={() => handleConfirm(item)}
                              disabled={state === "loading"}
                              className="flex-1 bg-[#34594A] py-2.5 rounded-xl items-center justify-center active:bg-[#2A4F3E] shadow-2xs"
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel="Confirm connection request"
                            >
                              {state === "loading" ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text className="text-white font-bold text-xs sm:text-sm">
                                  Confirm
                                </Text>
                              )}
                            </TouchableOpacity>

                            {/* Decline Button */}
                            <TouchableOpacity
                              onPress={() => handleDecline(item)}
                              disabled={state === "loading"}
                              className="flex-1 bg-[#E5E7EB] py-2.5 rounded-xl items-center justify-center active:bg-gray-300"
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel="Decline connection request"
                            >
                              <Text className="text-gray-700 font-semibold text-xs sm:text-sm">
                                Decline
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom Navigation Component */}
      <BottomNavBar accentColor="#34594A" activeTab="Connection" showFab={false} />

      {/* Sidebar Navigation Menu */}
      <SidebarMenu
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />
    </SafeAreaView>
  );
}

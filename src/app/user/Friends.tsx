import { FriendItem, getFriendsApi } from "@/services/connection-service";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BottomNavBar from "../../components/Navigation";
import SidebarMenu from "../../components/SidebarMenu";

const SORT_OPTIONS = ["Newest first", "Oldest first", "A to Z", "Z to A"];

export default function Friends() {
  const router = useRouter();
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [isSortDropdownVisible, setSortDropdownVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("Newest first");
  const [noMutualFilter, setNoMutualFilter] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFriendForOptions, setSelectedFriendForOptions] =
    useState<FriendItem | null>(null);

  const fetchFriends = async (isPull = false) => {
    if (isPull) setIsRefreshing(true);

    try {
      const data = await getFriendsApi();
      setFriends(data);
    } catch (err) {
      console.log("Failed to fetch friends:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getFriendsApi()
      .then((data) => {
        if (isMounted) setFriends(data);
      })
      .catch((err) => {
        console.log("Failed to fetch friends:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredFriends = useMemo(() => {
    let result = friends.filter((friend) => {
      const matchesSearch =
        friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (friend.username?.toLowerCase().includes(searchQuery.toLowerCase()) ??
          false);
      const matchesMutual = noMutualFilter ? !friend.hasMutual : true;
      return matchesSearch && matchesMutual;
    });

    if (selectedSort === "Newest first") {
      return result;
    } else if (selectedSort === "Oldest first") {
      return [...result].reverse();
    } else if (selectedSort === "A to Z") {
      return [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (selectedSort === "Z to A") {
      return [...result].sort((a, b) => b.name.localeCompare(a.name));
    }
    return result;
  }, [friends, searchQuery, noMutualFilter, selectedSort]);

  const handleOpenUserProfile = (friend: FriendItem) => {
    router.push({
      pathname: "/user/UserProfile",
      params: {
        userId: friend.id,
        userName: friend.name,
        userAvatar: friend.avatarUrl || "",
      },
    } as any);
  };

  const handleOpenChatWithFriend = (friend: FriendItem) => {
    router.push({
      pathname: "/user/ChatConversation",
      params: {
        userId: friend.id,
        name: friend.name,
        avatarUrl: friend.avatarUrl || "",
        online: "true",
      },
    } as any);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white relative h-full"
      style={{
        flex: 1,
        position: "relative",
        minHeight: "100%",
        overflow: "hidden",
      }}
    >
      {/* 1. Header Section */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-3xl font-bold text-gray-900">Connection</Text>
      </View>

      {/* 2. Search Bar */}
      <View className="flex-row items-center px-5 py-3 gap-3 mb-1">
        <TouchableOpacity
          onPress={() => setSidebarVisible(true)}
          className="p-1 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Open sidebar menu"
        >
          <Ionicons name="person-add-outline" size={26} color="#34594A" />
        </TouchableOpacity>

        <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-4 h-11 border border-gray-100">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search friends..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-base text-gray-800 pr-2 h-full"
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

      {/* Sort Dropdown Overlay */}
      {isSortDropdownVisible && (
        <>
          <Pressable
            onPress={() => setSortDropdownVisible(false)}
            className="absolute inset-0 z-40 bg-transparent"
          />

          <View
            style={{
              position: "absolute",
              top: 130,
              right: 20,
              zIndex: 50,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 10,
            }}
            className="bg-white p-4 rounded-2xl border border-gray-200 w-56"
          >
            <Text className="text-gray-500 font-bold text-sm tracking-wider mb-2.5">
              SORT BY
            </Text>

            <View className="space-y-1">
              {SORT_OPTIONS.map((option) => {
                const isSelected = selectedSort === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => {
                      setSelectedSort(option);
                      setSortDropdownVisible(false);
                    }}
                    className="flex-row items-center py-2"
                  >
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={isSelected ? "#34594A" : "#9CA3AF"}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      className={`text-sm ${
                        isSelected
                          ? "font-bold text-gray-900"
                          : "font-normal text-gray-600"
                      }`}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="border-b border-gray-200 my-3" />

            <Text className="text-gray-500 font-bold text-xs tracking-wider mb-2">
              FILTER
            </Text>

            <View className="flex-row items-center justify-between py-1">
              <Text className="text-gray-700 text-sm">No mutual friend</Text>
              <Switch
                value={noMutualFilter}
                onValueChange={setNoMutualFilter}
                trackColor={{ false: "#E5E7EB", true: "#34594A" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </>
      )}

      {/* Content */}
      <ScrollView
        className="flex-1 bg-white z-0"
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
            onRefresh={() => fetchFriends(true)}
            colors={["#34594A"]}
            tintColor="#34594A"
          />
        }
      >
        {isLoading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="large" color="#34594A" />
            <Text className="text-sm text-gray-500 mt-2 font-medium">
              Loading friends...
            </Text>
          </View>
        ) : (
          <>
            {/* ── FRIENDS HEADER ── */}
            <View className="flex-row justify-between items-center px-5 py-2 mb-1">
              <Text className="text-lg font-semibold text-gray-900">
                Friends{" "}
                <Text className="text-[#34594A] font-bold">
                  {filteredFriends.length}
                </Text>
              </Text>

              <TouchableOpacity
                onPress={() => setSortDropdownVisible(!isSortDropdownVisible)}
                className="flex-row items-center py-1 px-2 rounded-lg active:bg-gray-100"
              >
                <Text className="text-sm font-medium text-gray-700 mr-1">
                  Sort
                </Text>
                <Ionicons
                  name={
                    isSortDropdownVisible
                      ? "chevron-up-outline"
                      : "chevron-down-outline"
                  }
                  size={16}
                  color="#34594A"
                />
              </TouchableOpacity>
            </View>

            {filteredFriends.length === 0 ? (
              <View className="py-14 items-center justify-center px-6">
                <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
                  <Ionicons name="people-outline" size={32} color="#34594A" />
                </View>
                <Text className="text-base font-bold text-gray-800 mb-1">
                  No Friends Found
                </Text>
                <Text className="text-xs text-gray-500 text-center leading-5">
                  Confirm connection requests or add friends to see them here.
                </Text>
              </View>
            ) : (
              <View className="px-5">
                {filteredFriends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    onPress={() => handleOpenUserProfile(friend)}
                    activeOpacity={0.7}
                    className="flex-row items-center py-3.5 border-b border-gray-100 active:bg-gray-50"
                  >
                    <View className="h-12 w-12 rounded-full bg-gray-200 items-center justify-center mr-4 overflow-hidden border border-gray-200">
                      {friend.avatarUrl ? (
                        <Image
                          source={{ uri: friend.avatarUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={26} color="#34594A" />
                      )}
                    </View>

                    <View className="flex-1 pr-2">
                      <Text className="text-base font-semibold text-gray-800">
                        {friend.name}
                      </Text>
                      {friend.username ? (
                        <Text className="text-xs text-gray-400">
                          @{friend.username}
                        </Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setSelectedFriendForOptions(friend);
                      }}
                      className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
                      accessibilityRole="button"
                      accessibilityLabel="Friend options"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={18}
                        color="#34594A"
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Friend Options Bottom Sheet Modal */}
      <Modal
        visible={!!selectedFriendForOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedFriendForOptions(null)}
      >
        <View className="flex-1 justify-end">
          {/* Backdrop */}
          <Pressable
            onPress={() => setSelectedFriendForOptions(null)}
            className="absolute inset-0 bg-black/40"
          />

          {/* Bottom Sheet Card */}
          <View
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 20,
            }}
            className="bg-white rounded-t-3xl pt-4 pb-8 px-6 border-t border-gray-100"
          >
            {/* Grabber indicator */}
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center mb-4" />

            {/* Friend info header */}
            {selectedFriendForOptions && (
              <View className="flex-row items-center mb-4 pb-4 border-b border-gray-100">
                <View className="h-12 w-12 rounded-full bg-gray-200 items-center justify-center mr-3.5 overflow-hidden border border-gray-200">
                  {selectedFriendForOptions.avatarUrl ? (
                    <Image
                      source={{ uri: selectedFriendForOptions.avatarUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={24} color="#34594A" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">
                    {selectedFriendForOptions.name}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    {selectedFriendForOptions.username
                      ? `@${selectedFriendForOptions.username}`
                      : "Connected Friend"}
                  </Text>
                </View>
              </View>
            )}

            {/* Action Items */}
            <View className="space-y-1">
              <TouchableOpacity
                onPress={() => {
                  const target = selectedFriendForOptions;
                  setSelectedFriendForOptions(null);
                  if (target) handleOpenUserProfile(target);
                }}
                className="flex-row items-center py-3 px-3 rounded-2xl active:bg-gray-50"
              >
                <View className="w-10 h-10 rounded-full bg-[#EDF3EE] items-center justify-center mr-3.5 border border-[#E4EDE6]">
                  <Ionicons name="person-outline" size={20} color="#34594A" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    View Profile
                  </Text>
                  <Text className="text-xs text-gray-500">
                    See posts, photos, and info
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#34594A" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const target = selectedFriendForOptions;
                  setSelectedFriendForOptions(null);
                  if (target) handleOpenChatWithFriend(target);
                }}
                className="flex-row items-center py-3 px-3 rounded-2xl active:bg-gray-50"
              >
                <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3.5 border border-blue-100">
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color="#3B82F6"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    Message
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Send a direct message
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#34594A" />
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => setSelectedFriendForOptions(null)}
              className="mt-4 py-3.5 rounded-2xl bg-gray-100 items-center justify-center active:bg-gray-200"
            >
              <Text className="text-sm font-semibold text-gray-700">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNavBar accentColor="#34594A" activeTab="Connection" showFab={false} />
      <SidebarMenu
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        activeTab="Your Friends"
      />
    </SafeAreaView>
  );
}

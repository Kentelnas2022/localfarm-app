import { useToast } from "@/context/toast-context";
import {
  cancelFriendRequestApi,
  getNearbyUsersApi,
  NearbyUserItem,
  sendFriendRequestApi,
} from "@/services/connection-service";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
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

export default function NearbyUsers() {
  const { showToast } = useToast();
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());
  const [userStates, setUserStates] = useState<
    Record<string, "pending_sent" | "none" | "loading" | undefined>
  >({});

  const fetchNearbyUsers = async (isPull = false) => {
    if (isPull) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await getNearbyUsersApi();
      setNearbyUsers(data);
    } catch (err) {
      console.log("Failed to fetch nearby users:", err);
      showToast("Unable to load nearby users.", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNearbyUsers();
  }, []);

  const handleAddFriend = async (item: NearbyUserItem) => {
    setUserStates((prev) => ({ ...prev, [item.id]: "loading" }));
    try {
      await sendFriendRequestApi(item.id);
      setUserStates((prev) => ({ ...prev, [item.id]: "pending_sent" }));
      showToast(`Friend request sent to ${item.name}!`, "success");
    } catch (err: any) {
      setUserStates((prev) => ({ ...prev, [item.id]: undefined }));
      showToast(err.message || "Failed to send friend request.", "error");
    }
  };

  const handleCancelRequest = async (item: NearbyUserItem) => {
    setUserStates((prev) => ({ ...prev, [item.id]: "loading" }));
    try {
      await cancelFriendRequestApi(item.id, item.connectionId || undefined);
      setUserStates((prev) => ({ ...prev, [item.id]: "none" }));
      showToast("Friend request canceled.", "info");
    } catch (err: any) {
      setUserStates((prev) => ({ ...prev, [item.id]: undefined }));
      showToast(err.message || "Failed to cancel friend request.", "error");
    }
  };

  const handleNotInterested = (id: string) => {
    setHiddenUserIds((prev) => new Set([...prev, id]));
  };

  const filteredUsers = nearbyUsers.filter((user) => {
    if (hiddenUserIds.has(user.id)) return false;
    const currentRel = userStates[user.id] || user.relationship || "none";
    if (currentRel === "accepted") return false;
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      (user.username && user.username.toLowerCase().includes(query)) ||
      (user.location && user.location.toLowerCase().includes(query))
    );
  });

  return (
    <SafeAreaView
      className="flex-1 bg-white relative h-full"
      style={{ flex: 1, position: "relative", minHeight: "100%" }}
    >
      {/* Header Section */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-3xl font-bold text-gray-900">Connection</Text>
      </View>

      {/* Search Bar */}
      <View className="flex-row items-center px-5 py-3 gap-3 mb-1">
        <TouchableOpacity
          onPress={() => setSidebarVisible(true)}
          className="p-1 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Ionicons name="person-add-outline" size={26} color="#34594A" />
        </TouchableOpacity>

        {/* Search Input */}
        <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-4 h-11 border border-gray-100">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search nearby members..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-base text-gray-800 pr-2 h-full"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#34594A" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="search-outline" size={20} color="#34594A" />
          )}
        </View>
      </View>

      {/* Sub-Header */}
      <View className="px-5 mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-gray-800">
          Nearby Users
        </Text>
        {!isLoading && filteredUsers.length > 0 && (
          <Text className="text-xs font-semibold text-gray-500">
            {filteredUsers.length}{" "}
            {filteredUsers.length === 1 ? "person" : "people"} nearby
          </Text>
        )}
      </View>

      {/* Content Area */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#34594A" />
          <Text className="text-gray-500 text-sm mt-3 font-medium">
            Finding nearby farmers and users...
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-white"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchNearbyUsers(true)}
              colors={["#34594A"]}
            />
          }
        >
          <View className="px-5">
            {filteredUsers.length === 0 ? (
              <View className="items-center justify-center py-16 px-4">
                <Ionicons name="location-outline" size={48} color="#34594A" />
                <Text className="text-base font-semibold text-gray-700 mt-3">
                  {searchQuery
                    ? "No matching nearby members"
                    : "No nearby users found"}
                </Text>
                <Text className="text-xs text-gray-500 text-center mt-1">
                  {searchQuery
                    ? "Try adjusting your search keywords."
                    : "When new members join Local Farm in your area, they will appear here."}
                </Text>
              </View>
            ) : (
              filteredUsers.map((item) => {
                const currentRel =
                  userStates[item.id] || item.relationship || "none";
                const isActionLoading = userStates[item.id] === "loading";

                return (
                  <View
                    key={item.id}
                    className="py-3.5 border-b border-gray-100 flex-row items-start justify-between"
                  >
                    {/* Circular Avatar */}
                    <View className="h-14 w-14 rounded-full bg-gray-100 items-center justify-center mr-3.5 border border-gray-200 overflow-hidden">
                      {item.avatarUrl ? (
                        <Image
                          source={{ uri: item.avatarUrl }}
                          className="h-full w-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={30} color="#34594A" />
                      )}
                    </View>

                    {/* Info & Action Buttons Container */}
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900 text-base leading-tight mb-1">
                        {item.name}
                      </Text>

                      {/* Distance & Location Indicator */}
                      <View className="flex-row items-center mb-3 flex-wrap">
                        <Ionicons
                          name="location"
                          size={13}
                          color="#34594A"
                          style={{ marginRight: 3 }}
                        />
                        <Text className="text-xs font-semibold text-gray-600">
                          {item.distance}
                        </Text>
                        {item.location &&
                          item.location !== "Iligan City, Philippines" && (
                            <Text
                              className="text-xs text-gray-400 ml-1.5"
                              numberOfLines={1}
                            >
                              • {item.location}
                            </Text>
                          )}
                      </View>

                      {/* Action Buttons */}
                      {currentRel === "pending_sent" ? (
                        <TouchableOpacity
                          onPress={() => handleCancelRequest(item)}
                          disabled={isActionLoading}
                          className="w-full bg-gray-50 border border-[#34594A] py-2.5 rounded-xl items-center justify-center active:bg-gray-200"
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Cancel friend request to ${item.name}`}
                        >
                          {isActionLoading ? (
                            <ActivityIndicator size="small" color="#34594A" />
                          ) : (
                            <Text className="text-[#000000] font-semibold text-xs sm:text-sm">
                              Cancel Request
                            </Text>
                          )}
                        </TouchableOpacity>
                      ) : currentRel === "accepted" ? (
                        <View className="w-full bg-[#EDF3EE] border border-[#E3ECE5] py-2 rounded-xl flex-row items-center justify-center">
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color="#34594A"
                            style={{ marginRight: 4 }}
                          />
                          <Text className="text-[#34594A] font-semibold text-xs sm:text-sm">
                            Friends
                          </Text>
                        </View>
                      ) : (
                        <View className="flex-row items-center gap-2">
                          {/* Add Friend Button */}
                          <TouchableOpacity
                            onPress={() => handleAddFriend(item)}
                            disabled={isActionLoading}
                            className="flex-1 bg-[#34594A] py-2.5 px-3 rounded-xl flex-row items-center justify-center active:bg-[#2A4F3E] shadow-2xs"
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${item.name} as friend`}
                          >
                            {isActionLoading ? (
                              <ActivityIndicator
                                size="small"
                                color="#ffffff"
                              />
                            ) : (
                              <Text className="text-white font-bold text-sm sm:text-sm">
                                Add friend
                              </Text>
                            )}
                          </TouchableOpacity>

                          {/* Not Interested Button */}
                          <TouchableOpacity
                            onPress={() => handleNotInterested(item.id)}
                            disabled={isActionLoading}
                            className="flex-1 bg-gray-200 py-2.5 px-2 rounded-xl flex-row items-center justify-center active:bg-gray-300"
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={`Not interested in ${item.name}`}
                          >
                            <Text
                              className="text-gray-700 font-semibold text-sm sm:text-sm text-center"
                              numberOfLines={1}
                            >
                              Not Interested
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
      <BottomNavBar accentColor="#34594A" showFab={false} />
      <SidebarMenu
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        activeTab="Nearby Users"
      />
    </SafeAreaView>
  );
}

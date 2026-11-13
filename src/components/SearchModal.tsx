import { useAuth } from "@/hooks/use-auth";
import { searchUsersToConnectApi, SearchedUserItem } from "@/services/connection-service";
import { getPostsApi, PostItem } from "@/services/post-service";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

const RECENT_SEARCHES_KEY = "localfarm_recent_searches_v1";

const POPULAR_SUGGESTIONS = [
  "Sweet Corn",
  "Avocado",
  "Tomatoes",
  "Wholesaler",
  "Fresh Herbs",
  "Pala-o",
  "Tipanoy",
  "Field",
];

export const SearchModal: React.FC<SearchModalProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const { user } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "users" | "posts">("all");
  const [isSearching, setIsSearching] = useState(false);
  const [userResults, setUserResults] = useState<SearchedUserItem[]>([]);
  const [postResults, setPostResults] = useState<PostItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Load recent searches
  const loadRecentSearches = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) {
        setRecentSearches(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveRecentSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      const filtered = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      setRecentSearches(filtered);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  };

  const removeRecentSearch = async (term: string) => {
    try {
      const filtered = recentSearches.filter((s) => s !== term);
      setRecentSearches(filtered);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  };

  const clearAllRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (visible) {
      loadRecentSearches();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    } else {
      setSearchQuery("");
      setUserResults([]);
      setPostResults([]);
      setHasSearched(false);
    }
  }, [visible, loadRecentSearches]);

  // Execute Search
  const executeSearch = useCallback(
    async (text: string) => {
      const query = text.trim();
      if (!query) {
        setUserResults([]);
        setPostResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);

      try {
        const [users, posts] = await Promise.all([
          searchUsersToConnectApi(query).catch(() => []),
          getPostsApi(undefined, undefined, query).catch(() => []),
        ]);

        setUserResults(users || []);
        setPostResults(posts || []);
      } catch (err) {
        console.warn("[SearchModal] Search error:", err);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  // Debounced search on text change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setUserResults([]);
      setPostResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(searchQuery);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, executeSearch]);

  const handleSubmitSearch = () => {
    Keyboard.dismiss();
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
      executeSearch(searchQuery);
    }
  };

  const handleSelectSuggestion = (term: string) => {
    setSearchQuery(term);
    saveRecentSearch(term);
    executeSearch(term);
  };

  const handleUserPress = (u: SearchedUserItem) => {
    saveRecentSearch(u.name);
    onClose();
    router.push({
      pathname: "/user/UserProfile",
      params: {
        userId: u.id,
        userName: u.name,
        userAvatar: u.avatarUrl,
        userRole: u.role,
      },
    } as any);
  };

  const handlePostPress = (post: PostItem) => {
    saveRecentSearch(post.cropName || post.authorName);
    onClose();
    router.push({
      pathname: "/user/UserProfile",
      params: {
        userId: post.userId,
        userName: post.authorName,
        userAvatar: post.avatarUri,
        userRole: post.authorRole,
      },
    } as any);
  };

  const totalResultsCount = userResults.length + postResults.length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white" style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        {/* Top Search Header */}
        <View className="px-3 py-2.5 border-b border-gray-100 flex-row items-center gap-2">
          {/* Back button */}
          <TouchableOpacity
            onPress={onClose}
            className="p-2 rounded-full active:bg-gray-100"
            accessibilityRole="button"
            accessibilityLabel="Close search"
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          {/* Search Input Bar */}
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-3.5 py-1.5 border border-gray-200">
            <Ionicons name="search" size={19} color="#72AF5B" />
            <TextInput
              ref={inputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSubmitSearch}
              placeholder="Search produce, farmers, posts..."
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              clearButtonMode="never"
              className="flex-1 ml-2 text-sm text-gray-900 py-1"
              style={{ paddingVertical: Platform.OS === "ios" ? 4 : 2 }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setUserResults([]);
                  setPostResults([]);
                  setHasSearched(false);
                }}
                className="p-1"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Pills (Tabs) */}
        {hasSearched && (
          <View className="flex-row items-center px-4 py-2 border-b border-gray-100 bg-gray-50/70 gap-2">
            <TouchableOpacity
              onPress={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-full ${
                activeTab === "all" ? "bg-[#72AF5B]" : "bg-white border border-gray-200"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeTab === "all" ? "text-white" : "text-gray-700"
                }`}
              >
                All ({totalResultsCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("users")}
              className={`px-3 py-1.5 rounded-full ${
                activeTab === "users" ? "bg-[#72AF5B]" : "bg-white border border-gray-200"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeTab === "users" ? "text-white" : "text-gray-700"
                }`}
              >
                People ({userResults.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("posts")}
              className={`px-3 py-1.5 rounded-full ${
                activeTab === "posts" ? "bg-[#72AF5B]" : "bg-white border border-gray-200"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  activeTab === "posts" ? "text-white" : "text-gray-700"
                }`}
              >
                Produce & Posts ({postResults.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading Spinner */}
        {isSearching && (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator size="small" color="#72AF5B" />
            <Text className="text-xs text-gray-500 mt-2">Searching LocalFarm...</Text>
          </View>
        )}

        {/* Main Content Area */}
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Initial State: Suggestions & Recent Searches */}
          {!hasSearched && (
            <View className="p-4">
              {/* Popular / Quick Suggestions */}
              <View className="mb-6">
                <View className="flex-row items-center gap-1.5 mb-3">
                  <Ionicons name="trending-up" size={18} color="#72AF5B" />
                  <Text className="text-sm font-bold text-gray-900">Popular Searches</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {POPULAR_SUGGESTIONS.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => handleSelectSuggestion(tag)}
                      className="px-3.5 py-2 bg-emerald-50/70 border border-emerald-200 rounded-full active:bg-emerald-100 flex-row items-center gap-1.5"
                    >
                      <Ionicons name="leaf-outline" size={13} color="#237227" />
                      <Text className="text-xs font-semibold text-emerald-800">{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="time-outline" size={18} color="#6B7280" />
                      <Text className="text-sm font-bold text-gray-900">Recent Searches</Text>
                    </View>
                    <TouchableOpacity onPress={clearAllRecentSearches} className="p-1">
                      <Text className="text-xs font-semibold text-rose-600">Clear all</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="divide-y divide-gray-100">
                    {recentSearches.map((term) => (
                      <View
                        key={term}
                        className="flex-row items-center justify-between py-2.5 active:bg-gray-50"
                      >
                        <TouchableOpacity
                          onPress={() => handleSelectSuggestion(term)}
                          className="flex-row items-center gap-2.5 flex-1"
                        >
                          <Ionicons name="search-outline" size={16} color="#9CA3AF" />
                          <Text className="text-sm text-gray-700">{term}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => removeRecentSearch(term)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          className="p-1"
                        >
                          <Ionicons name="close" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Search Results */}
          {hasSearched && !isSearching && (
            <View className="p-4">
              {/* No results */}
              {totalResultsCount === 0 ? (
                <View className="py-16 items-center justify-center px-4">
                  <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
                    <Ionicons name="search-outline" size={32} color="#9CA3AF" />
                  </View>
                  <Text className="text-base font-bold text-gray-800 text-center">
                    No results found for "{searchQuery}"
                  </Text>
                  <Text className="text-xs text-gray-500 text-center mt-1.5 leading-relaxed max-w-xs">
                    Try searching for crop names (e.g. Avocado, Corn), farmer names, or locations in Iligan City.
                  </Text>
                </View>
              ) : (
                <>
                  {/* People / Farmers Section */}
                  {(activeTab === "all" || activeTab === "users") && userResults.length > 0 && (
                    <View className="mb-6">
                      <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="people" size={18} color="#72AF5B" />
                          <Text className="text-sm font-bold text-gray-900">
                            People & Farmers ({userResults.length})
                          </Text>
                        </View>
                      </View>

                      <View className="space-y-2">
                        {userResults.map((u) => (
                          <TouchableOpacity
                            key={u.id}
                            onPress={() => handleUserPress(u)}
                            className="flex-row items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-2xs active:bg-gray-50 mb-2"
                          >
                            <View className="flex-row items-center gap-3 flex-1 pr-2">
                              {/* Avatar */}
                              <View className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden border border-gray-200 items-center justify-center">
                                {u.avatarUrl ? (
                                  <Image
                                    source={{ uri: u.avatarUrl }}
                                    style={{ width: "100%", height: "100%" }}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <Ionicons name="person" size={20} color="#9CA3AF" />
                                )}
                              </View>

                              {/* Details */}
                              <View className="flex-1">
                                <View className="flex-row items-center gap-1.5">
                                  <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                                    {u.name}
                                  </Text>
                                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                </View>
                                <View className="flex-row items-center gap-2 mt-0.5">
                                  {u.username ? (
                                    <Text className="text-xs text-gray-500" numberOfLines={1}>
                                      @{u.username}
                                    </Text>
                                  ) : null}
                                  <Text className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    {u.role === "admin" ? "Wholesaler" : u.role || "Farmer"}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Produce & Posts Section */}
                  {(activeTab === "all" || activeTab === "posts") && postResults.length > 0 && (
                    <View>
                      <View className="flex-row items-center gap-1.5 mb-3">
                        <Ionicons name="newspaper" size={18} color="#72AF5B" />
                        <Text className="text-sm font-bold text-gray-900">
                          Produce & Newsfeed Posts ({postResults.length})
                        </Text>
                      </View>

                      <View className="space-y-3">
                        {postResults.map((post) => {
                          const thumb = post.imageUrl || (post.images && post.images.length > 0 ? post.images[0] : null);

                          return (
                            <TouchableOpacity
                              key={post.id}
                              onPress={() => handlePostPress(post)}
                              className="p-3.5 bg-white rounded-xl border border-gray-100 shadow-2xs active:bg-gray-50 mb-2.5"
                            >
                              {/* Author Row */}
                              <View className="flex-row items-center justify-between mb-2">
                                <View className="flex-row items-center gap-2">
                                  <View className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden border border-gray-200 items-center justify-center">
                                    {post.avatarUri ? (
                                      <Image
                                        source={{ uri: post.avatarUri }}
                                        style={{ width: "100%", height: "100%" }}
                                        resizeMode="cover"
                                      />
                                    ) : (
                                      <Ionicons name="person" size={15} color="#9CA3AF" />
                                    )}
                                  </View>
                                  <View>
                                    <Text className="text-xs font-bold text-gray-900">
                                      {post.authorName}
                                    </Text>
                                    <Text className="text-[10px] text-gray-400">
                                      {post.timeAgo || "Recently"}
                                    </Text>
                                  </View>
                                </View>

                                {post.category && (
                                  <Text className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    {post.category}
                                  </Text>
                                )}
                              </View>

                              {/* Content & Thumbnail */}
                              <View className="flex-row gap-3 items-start">
                                <View className="flex-1">
                                  {post.cropName ? (
                                    <View className="flex-row items-center gap-1 mb-1">
                                      <Ionicons name="basket" size={14} color="#72AF5B" />
                                      <Text className="text-xs font-bold text-gray-900">
                                        {post.cropName}
                                        {post.pricePerUnit != null ? ` • ₱${post.pricePerUnit}/${post.unit || "kg"}` : ""}
                                      </Text>
                                    </View>
                                  ) : null}

                                  <Text
                                    className="text-xs text-gray-700 leading-relaxed"
                                    numberOfLines={2}
                                  >
                                    {post.content}
                                  </Text>

                                  {post.location ? (
                                    <View className="flex-row items-center gap-1 mt-2">
                                      <Ionicons name="location-sharp" size={11} color="#6B7280" />
                                      <Text className="text-[11px] text-gray-500" numberOfLines={1}>
                                        {post.location}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>

                                {thumb ? (
                                  <Image
                                    source={{ uri: thumb }}
                                    className="w-16 h-16 rounded-lg bg-gray-100"
                                    style={{ width: 64, height: 64, borderRadius: 8 }}
                                    resizeMode="cover"
                                  />
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default SearchModal;

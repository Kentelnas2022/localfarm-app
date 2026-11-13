import { useToast } from "@/context/toast-context";
import {
  createSavedCollectionApi,
  deleteSavedCollectionApi,
  getSavedCollectionsApi,
  getSavedPostsApi,
  renameSavedCollectionApi,
  SavedPostItem,
  toggleSavePostApi,
} from "@/services/post-service";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import SaveToCollectionModal from "@/components/SaveToCollectionModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const COLLECTION_PADDING = 16;
const COLLECTION_GAP = 12;
const COLLECTION_CARD_WIDTH =
  (SCREEN_WIDTH - COLLECTION_PADDING * 2 - COLLECTION_GAP) / 2;

// Smooth subtle entrance for premium feel
function FadeEntrance({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [delay, progress, translateY]);

  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// Tactile press button with smooth spring animation
function TactileTouchable({
  children,
  onPress,
  style,
  disabled,
  activeOpacity = 0.85,
  scaleTo = 0.975,
  ...rest
}: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: Platform.OS !== "web",
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: Platform.OS !== "web",
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const flattened = StyleSheet.flatten(style) || {};
  const hasFlex = flattened.flex !== undefined;

  return (
    <Animated.View
      style={[
        hasFlex && { flex: flattened.flex },
        { transform: [{ scale }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled}
        style={[style, hasFlex && { width: "100%" }]}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function SavedPosts() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  const [savedPosts, setSavedPosts] = useState<SavedPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active view: 'collections' (2-column folders) or 'grid' (3-column photo grid)
  const [activeTab, setActiveTab] = useState<"collections" | "grid">("collections");
  // Currently opened collection in grid view (null means All Posts)
  const [activeCollectionName, setActiveCollectionName] = useState<string | null>(null);

  // Collections list from API
  const [collections, setCollections] = useState<string[]>(["All Saved"]);

  // Modals
  const [isCreateCollectionVisible, setIsCreateCollectionVisible] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedPostForDetail, setSelectedPostForDetail] = useState<SavedPostItem | null>(null);
  const [selectedPostForFolder, setSelectedPostForFolder] = useState<SavedPostItem | null>(null);
  const [isFolderPickerVisible, setIsFolderPickerVisible] = useState(false);
  const [collectionMenuTarget, setCollectionMenuTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const loadData = async () => {
    try {
      const [postsData, collectionsData] = await Promise.all([
        getSavedPostsApi(),
        getSavedCollectionsApi(),
      ]);
      setSavedPosts(postsData);
      setCollections(collectionsData);
    } catch (err: any) {
      console.warn("Failed to load saved posts:", err);
      showToast(err?.message || "Failed to load saved posts.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCollections = async () => {
    try {
      const data = await getSavedCollectionsApi();
      setCollections(data);
    } catch (err) {
      console.log("Failed to fetch collections:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([getSavedPostsApi(), getSavedCollectionsApi()])
      .then(([postsData, collectionsData]) => {
        if (isMounted) {
          setSavedPosts(postsData);
          setCollections(collectionsData);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          console.warn("Failed to load saved posts:", err);
          showToast(err?.message || "Failed to load saved posts.", "error");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleUnsave = async (postId: string) => {
    try {
      const res = await toggleSavePostApi(postId);
      if (!res.isSaved) {
        setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
        showToast("Removed from Saved", "info");
      }
      if (selectedPostForDetail?.id === postId) {
        setSelectedPostForDetail(null);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to unsave post.", "error");
    }
  };

  const handleSaveToCollection = async (collection: string) => {
    if (!selectedPostForFolder) return;
    try {
      await toggleSavePostApi(selectedPostForFolder.id, collection);
      setSavedPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPostForFolder.id
            ? { ...p, collectionName: collection }
            : p
        )
      );
      if (selectedPostForDetail?.id === selectedPostForFolder.id) {
        setSelectedPostForDetail((prev) =>
          prev ? { ...prev, collectionName: collection } : null
        );
      }
      showToast(`Saved to "${collection}"`, "success");
      setIsFolderPickerVisible(false);
      setSelectedPostForFolder(null);
      fetchCollections();
    } catch (err: any) {
      showToast(err?.message || "Failed to update collection.", "error");
    }
  };

  const handleCreateCollection = async () => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    try {
      await createSavedCollectionApi(trimmed, selectedPostForFolder?.id);
      if (!collections.includes(trimmed)) {
        setCollections((prev) => [...prev, trimmed]);
      }
      if (selectedPostForFolder) {
        setSavedPosts((prev) =>
          prev.map((p) =>
            p.id === selectedPostForFolder.id
              ? { ...p, collectionName: trimmed }
              : p
          )
        );
        showToast(`Saved to "${trimmed}"`, "success");
      } else {
        showToast(`Collection "${trimmed}" created`, "success");
      }
      setNewCollectionName("");
      setIsCreateCollectionVisible(false);
      setSelectedPostForFolder(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || "Failed to create collection", "error");
    }
  };

  const handleConfirmRename = async () => {
    if (!renameTarget || !renameInput.trim()) return;
    const trimmed = renameInput.trim();
    if (trimmed.toLowerCase() === renameTarget.toLowerCase()) {
      setRenameTarget(null);
      return;
    }
    setIsRenaming(true);
    try {
      await renameSavedCollectionApi(renameTarget, trimmed);
      showToast(`Collection renamed to "${trimmed}"`, "success");
      if (activeCollectionName === renameTarget) {
        setActiveCollectionName(trimmed);
      }
      setRenameTarget(null);
      await loadData();
    } catch (err: any) {
      showToast(err?.message || "Failed to rename collection", "error");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteCollection = (name: string) => {
    setCollectionMenuTarget(null);
    const executeDelete = async () => {
      try {
        await deleteSavedCollectionApi(name);
        showToast(`Collection "${name}" deleted. Posts moved to All Saved.`, "info");
        if (activeCollectionName === name) {
          setActiveCollectionName(null);
          setActiveTab("collections");
        }
        await loadData();
      } catch (err: any) {
        showToast(err?.message || "Failed to delete collection", "error");
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          `Delete "${name}"?\nPosts in this collection will not be deleted and will remain in All Saved.`
        )
      ) {
        executeDelete();
      }
    } else {
      Alert.alert(
        "Delete Collection?",
        `Posts in "${name}" will still be kept in All Saved.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: executeDelete },
        ]
      );
    }
  };

  // Extract distinct collection names
  const allCollectionNames = useMemo(() => {
    const set = new Set<string>();
    collections.forEach((c) => {
      if (c && c !== "All Saved") set.add(c);
    });
    savedPosts.forEach((p) => {
      if (p.collectionName && p.collectionName !== "All Saved") {
        set.add(p.collectionName);
      }
    });
    return Array.from(set);
  }, [collections, savedPosts]);

  // Posts filtered by collection (if in grid view) and search
  const visiblePosts = useMemo(() => {
    return savedPosts.filter((post) => {
      if (activeCollectionName) {
        const pCol = (post.collectionName || "All Saved").toLowerCase();
        if (pCol !== activeCollectionName.toLowerCase()) {
          return false;
        }
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const cMatch = (post.content || "").toLowerCase().includes(q);
        const aMatch = (post.authorName || "").toLowerCase().includes(q);
        const rMatch = (post.authorRole || "").toLowerCase().includes(q);
        const catMatch = (post.category || "").toLowerCase().includes(q);
        return cMatch || aMatch || rMatch || catMatch;
      }

      return true;
    });
  }, [savedPosts, activeCollectionName, searchQuery]);

  // Helper to get preview images for collection collage
  const getCollectionPreviewImages = (colName: string | null): string[] => {
    const matching = savedPosts.filter((p) => {
      if (!colName) return true;
      return (p.collectionName || "All Saved").toLowerCase() === colName.toLowerCase();
    });

    const urls: string[] = [];
    matching.forEach((p) => {
      const url = p.imageUrl || p.originalPost?.imageUrl || p.avatarUri;
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    });
    return urls.slice(0, 4);
  };

  // Helper for quad collage preview
  const renderCollageCover = (imageUrls: string[], size: number) => {
    if (imageUrls.length === 0) {
      return (
        <View
          style={{ width: size, height: size }}
          className="bg-[#FAFAFA] items-center justify-center rounded-lg border border-gray-200"
        >
          <Ionicons name="bookmark-outline" size={36} color="#DBDBDB" />
        </View>
      );
    }

    if (imageUrls.length < 4) {
      return (
        <Image
          source={{ uri: imageUrls[0] }}
          style={{ width: size, height: size, borderRadius: 8 }}
          resizeMode="cover"
        />
      );
    }

    // 2x2 Collage (Instagram signature look)
    const half = (size - 1) / 2;
    return (
      <View
        style={{ width: size, height: size, borderRadius: 8 }}
        className="overflow-hidden bg-gray-100 flex-row flex-wrap gap-[1px]"
      >
        {imageUrls.slice(0, 4).map((url, idx) => (
          <Image
            key={idx}
            source={{ uri: url }}
            style={{ width: half, height: half }}
            resizeMode="cover"
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 14) }]}>
      {/* 1. Calm Minimalist Header with proper notch clearance */}
      <View style={styles.headerBar}>
        <TactileTouchable
          onPress={() => {
            if (activeCollectionName) {
              setActiveCollectionName(null);
            } else if (activeTab === "grid") {
              setActiveTab("collections");
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.push("/user/MenuProfile" as any);
            }
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={21} color="#34594A" />
        </TactileTouchable>

        {/* Header Title */}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {activeCollectionName ? activeCollectionName : "Saved"}
        </Text>

        {/* Right Action Icons: Search & + New Collection & Options */}
        <View style={styles.headerRightActions}>
          {Boolean(
            activeCollectionName &&
              activeCollectionName.toLowerCase() !== "all saved"
          ) && (
            <TactileTouchable
              onPress={() => setCollectionMenuTarget(activeCollectionName)}
              style={styles.headerActionBtn}
              accessibilityRole="button"
              accessibilityLabel="Collection options"
            >
              <Ionicons name="ellipsis-horizontal" size={19} color="#34594A" />
            </TactileTouchable>
          )}

          <TactileTouchable
            onPress={() => {
              setSelectedPostForFolder(null);
              setIsCreateCollectionVisible(true);
            }}
            style={styles.headerActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Create collection"
          >
            <Ionicons name="add" size={22} color="#34594A" />
          </TactileTouchable>
        </View>
      </View>

      {/* 2. Calm Segmented Tab Switcher (Collections vs All Posts) */}
      {!activeCollectionName && (
        <View style={styles.tabSwitcherContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab("collections")}
            style={[
              styles.tabButton,
              activeTab === "collections" && styles.tabButtonActive,
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="grid-outline"
              size={13}
              color={activeTab === "collections" ? "#FFFFFF" : "#6E8074"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "collections" && styles.tabTextActive,
              ]}
            >
              Collections
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("grid")}
            style={[
              styles.tabButton,
              activeTab === "grid" && styles.tabButtonActive,
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="images-outline"
              size={13}
              color={activeTab === "grid" ? "#FFFFFF" : "#6E8074"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "grid" && styles.tabTextActive,
              ]}
            >
              All Posts
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Calm Privacy Hint Notice Capsule */}
      <View style={styles.privacyPill}>
        <Ionicons name="lock-closed" size={10} color="#52705E" />
        <Text style={styles.privacyText}>
          Only you can see what you&apos;ve saved
        </Text>
      </View>

      {/* 4. Main Content Area */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#34594A"]}
            tintColor="#34594A"
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#34594A" />
          </View>
        ) : savedPosts.length === 0 ? (
          /* Empty State - Foolish Minimalist & Organic */
          <FadeEntrance delay={40}>
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="bookmark-outline" size={34} color="#34594A" />
              </View>
              <Text style={styles.emptyTitle}>Save Posts</Text>
              <Text style={styles.emptySubtitle}>
                Save photos and updates from local growers and farmers to your collections.
              </Text>
              <TactileTouchable
                onPress={() => router.push("/user/NewsFeed" as any)}
                style={styles.exploreButton}
              >
                <Text style={styles.exploreButtonText}>Explore Feed</Text>
              </TactileTouchable>
            </View>
          </FadeEntrance>
        ) : activeTab === "collections" && !activeCollectionName ? (
          /* COLLECTIONS VIEW: 2-Column Square Cards */
          <View style={{ padding: COLLECTION_PADDING }}>
            <View style={styles.collectionsGrid}>
              {/* Card 1: All Posts Collection */}
              <FadeEntrance delay={20}>
                <TactileTouchable
                  onPress={() => {
                    setActiveCollectionName(null);
                    setActiveTab("grid");
                  }}
                  style={[styles.collectionCard, { width: COLLECTION_CARD_WIDTH }]}
                >
                  {renderCollageCover(
                    getCollectionPreviewImages(null),
                    COLLECTION_CARD_WIDTH
                  )}
                  <View style={styles.collectionMeta}>
                    <Text style={styles.collectionTitle} numberOfLines={1}>
                      All Posts
                    </Text>
                    <Text style={styles.collectionSubtitle}>
                      {savedPosts.length} {savedPosts.length === 1 ? "post" : "posts"}
                    </Text>
                  </View>
                </TactileTouchable>
              </FadeEntrance>

              {/* User Collections */}
              {allCollectionNames.map((colName, index) => {
                const count = savedPosts.filter(
                  (p) =>
                    (p.collectionName || "All Saved").toLowerCase() ===
                    colName.toLowerCase()
                ).length;
                const previewImgs = getCollectionPreviewImages(colName);

                return (
                  <FadeEntrance key={colName} delay={35 + index * 20}>
                    <TactileTouchable
                      onPress={() => {
                        setActiveCollectionName(colName);
                        setActiveTab("grid");
                      }}
                      style={[styles.collectionCard, { width: COLLECTION_CARD_WIDTH }]}
                    >
                      {renderCollageCover(previewImgs, COLLECTION_CARD_WIDTH)}
                      <View style={[styles.collectionMeta, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                        <View style={{ flex: 1, marginRight: 4 }}>
                          <Text style={styles.collectionTitle} numberOfLines={1}>
                            {colName}
                          </Text>
                          <Text style={styles.collectionSubtitle}>
                            {count} {count === 1 ? "post" : "posts"}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setCollectionMenuTarget(colName);
                          }}
                          style={styles.moreDotsBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name="ellipsis-vertical"
                            size={14}
                            color="#7A8B7F"
                          />
                        </TouchableOpacity>
                      </View>
                    </TactileTouchable>
                  </FadeEntrance>
                );
              })}

              {/* Card 3: "+ New Collection" Placeholder Tile */}
              <FadeEntrance delay={80}>
                <TactileTouchable
                  onPress={() => {
                    setSelectedPostForFolder(null);
                    setIsCreateCollectionVisible(true);
                  }}
                  style={[
                    styles.newCollectionPlaceholder,
                    {
                      width: COLLECTION_CARD_WIDTH,
                      height: COLLECTION_CARD_WIDTH,
                    },
                  ]}
                >
                  <View style={styles.newCollectionIconCircle}>
                    <Ionicons name="add" size={24} color="#34594A" />
                  </View>
                  <Text style={styles.newCollectionText}>
                    New Collection
                  </Text>
                </TactileTouchable>
              </FadeEntrance>
            </View>
          </View>
        ) : (
          /* GRID VIEW: 3-Column Square Photo Grid */
          <View>
            {visiblePosts.length === 0 ? (
              <View style={styles.emptyGridContainer}>
                <Ionicons name="images-outline" size={38} color="#A2B2A7" />
                <Text style={styles.emptyGridTitle}>
                  No Posts Saved
                </Text>
                <Text style={styles.emptyGridSubtitle}>
                  {searchQuery
                    ? `No matches for "${searchQuery}".`
                    : "Bookmark posts to see them in this collection."}
                </Text>
              </View>
            ) : (
              <View style={styles.photoGrid}>
                {visiblePosts.map((post, index) => {
                  const mediaUri =
                    post.imageUrl ||
                    post.originalPost?.imageUrl ||
                    post.avatarUri ||
                    null;

                  const isRightEdge = (index + 1) % NUM_COLUMNS === 0;

                  return (
                    <TouchableOpacity
                      key={post.savedId || post.id}
                      activeOpacity={0.88}
                      onPress={() => setSelectedPostForDetail(post)}
                      style={[
                        styles.tileBox,
                        {
                          width: TILE_SIZE,
                          height: TILE_SIZE,
                          marginRight: isRightEdge ? 0 : GRID_GAP,
                          marginBottom: GRID_GAP,
                        },
                      ]}
                    >
                      {mediaUri ? (
                        <Image
                          source={{ uri: mediaUri }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        /* Text Post Fallback Tile */
                        <View style={styles.textTileBox}>
                          <Text
                            style={styles.textTileContent}
                            numberOfLines={4}
                          >
                            {post.content || "Post update"}
                          </Text>
                          <Text
                            style={styles.textTileAuthor}
                            numberOfLines={1}
                          >
                            @{post.authorName}
                          </Text>
                        </View>
                      )}

                      {/* Top-Right Badge: Shared Post Indicator */}
                      {post.isShared && (
                        <View style={styles.sharedBadge}>
                          <Ionicons name="arrow-redo" size={9} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 5. Minimalist Post Detail Modal (When a photo tile is tapped) */}
      <Modal
        visible={!!selectedPostForDetail}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setSelectedPostForDetail(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TactileTouchable
              onPress={() => setSelectedPostForDetail(null)}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={20} color="#34594A" />
            </TactileTouchable>

            <Text style={styles.modalHeaderTitle}>Post</Text>

            <TactileTouchable
              onPress={() => {
                if (selectedPostForDetail) {
                  setSelectedPostForFolder(selectedPostForDetail);
                  setIsFolderPickerVisible(true);
                }
              }}
              style={styles.headerActionBtn}
            >
              <Ionicons name="folder-outline" size={20} color="#34594A" />
            </TactileTouchable>
          </View>

          {selectedPostForDetail && (
            <ScrollView style={{ flex: 1, backgroundColor: "#FFFFFF" }} showsVerticalScrollIndicator={false}>
              {/* Author Header */}
              <View style={styles.postAuthorRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={styles.postAuthorAvatar}>
                    {selectedPostForDetail.avatarUri ? (
                      <Image
                        source={{ uri: selectedPostForDetail.avatarUri }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={16} color="#7A8D80" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.postAuthorName}>
                      {selectedPostForDetail.authorName}
                    </Text>
                    <Text style={styles.postAuthorSubtext}>
                      {selectedPostForDetail.location || selectedPostForDetail.authorRole || "Local Farm"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedPostForFolder(selectedPostForDetail);
                    setIsFolderPickerVisible(true);
                  }}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#6E8074" />
                </TouchableOpacity>
              </View>

              {/* Main Post Media */}
              {(selectedPostForDetail.imageUrl ||
                selectedPostForDetail.originalPost?.imageUrl) ? (
                <View
                  style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH, backgroundColor: "#F3F6F3" }}
                >
                  <Image
                    source={{
                      uri:
                        selectedPostForDetail.imageUrl ||
                        selectedPostForDetail.originalPost?.imageUrl,
                    }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              {/* Action Icons Bar */}
              <View style={styles.postActionsBar}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <TouchableOpacity
                    onPress={() => router.push("/user/NewsFeed" as any)}
                    activeOpacity={0.6}
                  >
                    <Ionicons
                      name={selectedPostForDetail.isLiked ? "heart" : "heart-outline"}
                      size={24}
                      color={selectedPostForDetail.isLiked ? "#D9534F" : "#23382D"}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedPostForDetail(null);
                      router.push("/user/NewsFeed" as any);
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={22}
                      color="#23382D"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedPostForDetail(null);
                      router.push("/user/NewsFeed" as any);
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons
                      name="paper-plane-outline"
                      size={22}
                      color="#23382D"
                    />
                  </TouchableOpacity>
                </View>

                {/* Bookmark Saved Icon */}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedPostForFolder(selectedPostForDetail);
                    setIsFolderPickerVisible(true);
                  }}
                  activeOpacity={0.6}
                  accessibilityLabel="Save to collection"
                >
                  <Ionicons name="bookmark" size={23} color="#34594A" />
                </TouchableOpacity>
              </View>

              {/* Likes Count */}
              <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#23382D" }}>
                  {selectedPostForDetail.likes || 0} likes
                </Text>
              </View>

              {/* Caption */}
              <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                <Text style={{ fontSize: 13, lineHeight: 19, color: "#2E4237" }}>
                  <Text style={{ fontWeight: "700", color: "#1D3025" }}>
                    {selectedPostForDetail.authorName}{" "}
                  </Text>
                  {selectedPostForDetail.content}
                </Text>
              </View>

              {/* Comments & Timestamp */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
                {selectedPostForDetail.comments > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedPostForDetail(null);
                      router.push("/user/NewsFeed" as any);
                    }}
                    style={{ marginBottom: 6 }}
                  >
                    <Text style={{ fontSize: 12, color: "#7A8D80" }}>
                      View all {selectedPostForDetail.comments} comments
                    </Text>
                  </TouchableOpacity>
                )}
                <Text style={{ fontSize: 10, color: "#92A297", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {selectedPostForDetail.timeAgo} • Saved in{" "}
                  {selectedPostForDetail.collectionName || "All Saved"}
                </Text>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* 6. Minimalist "New Collection" Modal */}
      <Modal
        visible={isCreateCollectionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateCollectionVisible(false)}
      >
        <Pressable
          onPress={() => setIsCreateCollectionVisible(false)}
          style={styles.modalOverlay}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={styles.dialogCard}
          >
            <View style={styles.dialogIconBox}>
              <Ionicons name="folder-outline" size={24} color="#34594A" />
            </View>

            <Text style={styles.dialogTitle}>
              New Collection
            </Text>
            <Text style={styles.dialogSubtitle}>
              Give your collection a memorable name
            </Text>

            <TextInput
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              placeholder="Collection name"
              placeholderTextColor="#8E9E93"
              autoFocus
              style={styles.dialogInput}
            />

            <View style={styles.dialogButtonsRow}>
              <TactileTouchable
                onPress={() => {
                  setNewCollectionName("");
                  setIsCreateCollectionVisible(false);
                }}
                style={styles.dialogCancelBtn}
              >
                <Text style={styles.dialogCancelBtnText}>Cancel</Text>
              </TactileTouchable>

              <TactileTouchable
                onPress={handleCreateCollection}
                disabled={!newCollectionName.trim()}
                style={[
                  styles.dialogConfirmBtn,
                  !newCollectionName.trim() && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.dialogConfirmBtnText}>Save</Text>
              </TactileTouchable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 7. Save to Collection Modal */}
      <SaveToCollectionModal
        visible={isFolderPickerVisible && selectedPostForFolder !== null}
        postId={selectedPostForFolder?.id || null}
        postImageUrl={
          selectedPostForFolder?.imageUrl ||
          selectedPostForFolder?.originalPost?.imageUrl ||
          selectedPostForFolder?.avatarUri
        }
        currentCollectionName={selectedPostForFolder?.collectionName || "All Saved"}
        onClose={() => {
          setIsFolderPickerVisible(false);
          setSelectedPostForFolder(null);
        }}
        onSaveToCollection={async (collectionName) => {
          if (selectedPostForFolder) {
            await handleSaveToCollection(collectionName);
          }
        }}
        onCollectionCreated={() => {
          loadData();
        }}
        onShowToast={showToast}
      />

      {/* 8. Collection Context / Options Bottom Sheet */}
      {collectionMenuTarget && (
        <Modal
          visible={Boolean(collectionMenuTarget)}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setCollectionMenuTarget(null)}
        >
          <Pressable
            style={styles.bottomSheetOverlay}
            onPress={() => setCollectionMenuTarget(null)}
          >
            <Pressable
              style={styles.bottomSheetCard}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>

              <Text style={styles.sheetTitle}>
                {collectionMenuTarget}
              </Text>

              <TactileTouchable
                onPress={() => {
                  const target = collectionMenuTarget;
                  setCollectionMenuTarget(null);
                  setRenameTarget(target);
                  setRenameInput(target);
                }}
                style={styles.sheetRow}
              >
                <Ionicons name="pencil-outline" size={18} color="#34594A" />
                <Text style={styles.sheetRowText}>
                  Rename Collection
                </Text>
              </TactileTouchable>

              <TactileTouchable
                onPress={() => {
                  const target = collectionMenuTarget;
                  handleDeleteCollection(target);
                }}
                style={[styles.sheetRow, { marginTop: 4 }]}
              >
                <Ionicons name="trash-outline" size={18} color="#A05656" />
                <Text style={[styles.sheetRowText, { color: "#A05656" }]}>
                  Delete Collection
                </Text>
              </TactileTouchable>

              <TactileTouchable
                onPress={() => setCollectionMenuTarget(null)}
                style={styles.sheetCancelBtn}
              >
                <Text style={styles.sheetCancelBtnText}>Cancel</Text>
              </TactileTouchable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* 9. Rename Collection Modal */}
      {renameTarget && (
        <Modal
          visible={Boolean(renameTarget)}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setRenameTarget(null)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setRenameTarget(null)}
          >
            <Pressable
              style={styles.dialogCard}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.dialogTitle}>
                Rename Collection
              </Text>
              <TextInput
                value={renameInput}
                onChangeText={setRenameInput}
                autoFocus={true}
                style={styles.dialogInput}
                placeholder="Collection name"
                placeholderTextColor="#8E9E93"
              />
              <View style={styles.dialogButtonsRow}>
                <TactileTouchable
                  onPress={() => setRenameTarget(null)}
                  style={styles.dialogCancelBtn}
                >
                  <Text style={styles.dialogCancelBtnText}>Cancel</Text>
                </TactileTouchable>
                <TactileTouchable
                  onPress={handleConfirmRename}
                  disabled={!renameInput.trim() || isRenaming}
                  style={[
                    styles.dialogConfirmBtn,
                    (!renameInput.trim() || isRenaming) && { opacity: 0.5 },
                  ]}
                >
                  {isRenaming ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.dialogConfirmBtnText}>Save</Text>
                  )}
                </TactileTouchable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F9F7", // Calm organic background matching Reservations & Profile
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#F7F9F7",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECE6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: "#23382D", // Calm deep forest
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECE6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: "#E1E8E3",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#23382D",
    marginLeft: 8,
    height: "100%",
  },

  // Segmented Tab Switcher matching Reservations
  tabSwitcherContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 3,
    backgroundColor: "#EBF1EC",
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: "#34594A",
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6E8074",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },

  // Privacy Pill
  privacyPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF3EE",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2ECE4",
  },
  privacyText: {
    fontSize: 10.5,
    color: "#52705E",
    marginLeft: 5,
    fontWeight: "500",
  },

  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: 100,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty State - Calm & Uniform
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: "#EDF3EE",
    borderWidth: 1,
    borderColor: "#DEE8E0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: "#23382D",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#738579",
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 280,
  },
  exploreButton: {
    minHeight: 46,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: "#34594A", // Uniform calm primary button
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  exploreButtonText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },

  // Collections 2-Column Grid
  collectionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: COLLECTION_GAP,
  },
  collectionCard: {
    borderRadius: 14,
    overflow: "hidden",
  },
  collectionMeta: {
    marginTop: 7,
    paddingHorizontal: 2,
  },
  collectionTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#23382D",
    letterSpacing: -0.2,
  },
  collectionSubtitle: {
    fontSize: 11,
    color: "#778A7E",
    marginTop: 1,
  },
  moreDotsBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#EDF3EE",
    alignItems: "center",
    justifyContent: "center",
  },

  // New Collection Tile
  newCollectionPlaceholder: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#C5D4C9",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F6F2",
  },
  newCollectionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E5DC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  newCollectionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#34594A",
  },

  // Photo Grid
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tileBox: {
    backgroundColor: "#EBF1EC",
    overflow: "hidden",
  },
  textTileBox: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
    padding: 8,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5ECE6",
  },
  textTileContent: {
    fontSize: 10,
    color: "#293E33",
    lineHeight: 14,
    fontWeight: "500",
  },
  textTileAuthor: {
    fontSize: 9,
    color: "#778A7E",
    fontWeight: "600",
  },
  sharedBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    backgroundColor: "rgba(35, 56, 45, 0.7)",
    borderRadius: 3,
    padding: 2,
  },
  emptyGridContainer: {
    paddingVertical: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyGridTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#23382D",
    marginTop: 10,
    marginBottom: 4,
  },
  emptyGridSubtitle: {
    fontSize: 12,
    color: "#778A7E",
    textAlign: "center",
    maxWidth: 240,
  },

  // Post Detail Modal
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2EE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#23382D",
  },
  postAuthorRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  postAuthorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EDF3EE",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E1EAE3",
  },
  postAuthorName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#23382D",
  },
  postAuthorSubtext: {
    fontSize: 11,
    color: "#7A8D80",
  },
  postActionsBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  // Dialog Modals (New Collection / Rename)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(22, 38, 29, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  dialogIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EDF3EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#23382D",
    marginBottom: 4,
  },
  dialogSubtitle: {
    fontSize: 12,
    color: "#7A8D80",
    textAlign: "center",
    marginBottom: 16,
  },
  dialogInput: {
    width: "100%",
    backgroundColor: "#F6F9F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13.5,
    color: "#23382D",
    borderWidth: 1,
    borderColor: "#E2ECE4",
    marginBottom: 18,
  },
  dialogButtonsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 4,
  },
  dialogCancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#F1F5F2",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E2ECE4",
  },
  dialogCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5E7265",
  },
  dialogConfirmBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#34594A",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  dialogConfirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Bottom Sheet
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(22, 38, 29, 0.4)",
    justifyContent: "end",
  },
  bottomSheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  sheetHandleWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#D9E3DC",
    borderRadius: 2,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#23382D",
    textAlign: "center",
    marginBottom: 14,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F7FAF7",
    marginBottom: 6,
  },
  sheetRowText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#293E33",
    marginLeft: 12,
  },
  sheetCancelBtn: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#5E7265",
  },
});

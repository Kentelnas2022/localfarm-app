import { useToast } from "@/context/toast-context";
import { useAuth } from "@/hooks/use-auth";
import { blockUser } from "@/services/blocked-users-service";
import { sendFriendRequestApi } from "@/services/connection-service";
import {
  CommentItem,
  deletePostApi,
  getPostCommentsApi,
  getPostsApi,
  PostItem,
  sharePostApi,
  toggleLikePostApi,
  toggleSavePostApi,
  toggleLikeCommentApi,
  addPostCommentApi,
} from "@/services/post-service";
import { getRSBSAApplication, RSBSAApplication } from "@/services/rsbsa-service";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import CreatePostModal from "../../components/CreatePostModal";
import BottomNavBar from "../../components/Navigation";
import { ProfileHeader } from "../../components/ProfileHeader";
import ShareProfileModal from "../../components/ShareProfileModal";
import SharePostModal from "../../components/SharePostModal";
import PostImageGrid from "../../components/PostImageGrid";

const DEFAULT_COVER_PHOTO =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1000&auto=format&fit=crop&q=80";

export interface GridPostItem {
  id: string;
  imageUri: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  timeAgo: string;
  isLiked?: boolean;
  isSaved?: boolean;
  basePostId?: string;
  authorName?: string;
  authorRole?: string;
  avatarUri?: string;
  location?: string;
  isVerified?: boolean;
  photoIndex?: number;
  totalPostPhotos?: number;
}



export default function UserProfile() {
  const { user, updateUser } = useAuth();
  const params = useLocalSearchParams<{
    userId?: string;
    userName?: string;
    userAvatar?: string;
    userRole?: string;
    userAbout?: string;
    userBio?: string;
    isVerified?: string;
  }>();

  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width;
  const [rsbsaApp, setRsbsaApp] = useState<RSBSAApplication | null>(null);

  const isOwnProfile = params.userId
    ? Boolean(user?.id) && String(params.userId) === String(user?.id)
    : true;

  const profileName = isOwnProfile
    ? user?.name || user?.username || rsbsaApp?.fullName || params.userName || "Juan Dela Cruz"
    : params.userName || "Juan Dela Cruz";

  const [farmDetails, setFarmDetails] = useState<{
    farmName?: string;
    farmLocation?: string;
    primaryCrops?: string;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      getRSBSAApplication()
        .then((app) => {
          if (isMounted) setRsbsaApp(app);
        })
        .catch((err) => console.warn("Failed to load RSBSA in profile:", err));

      if (isOwnProfile && (user?.farmName || user?.farmLocation || user?.primaryCrops)) {
        setFarmDetails({
          farmName: user.farmName,
          farmLocation: user.farmLocation,
          primaryCrops: user.primaryCrops,
        });
      } else {
        AsyncStorage.getItem("localfarm_user_farm_details_v1")
          .then((data) => {
            if (isMounted && data) {
              try {
                setFarmDetails(JSON.parse(data));
              } catch {}
            }
          })
          .catch(() => {});
      }
      return () => {
        isMounted = false;
      };
    }, [isOwnProfile, user?.farmName, user?.farmLocation, user?.primaryCrops])
  );

  const profileLocation =
    (isOwnProfile
      ? user?.farmLocation || farmDetails?.farmLocation || rsbsaApp?.location || user?.location
      : rsbsaApp?.location) || "";

  const profileBio =
    params.userBio ||
    params.userAbout ||
    (isOwnProfile ? user?.about || user?.bio : undefined) ||
    ((user?.farmName || farmDetails?.farmName)
      ? `Farmer at ${user?.farmName || farmDetails?.farmName}${(user?.primaryCrops || farmDetails?.primaryCrops) ? ` • ${user?.primaryCrops || farmDetails?.primaryCrops}` : ""}`
      : rsbsaApp?.farmName
      ? `Farmer at ${rsbsaApp.farmName}`
      : "");

  const isRSBSAVerified = rsbsaApp?.status === "verified";

  const isVerifiedProfile =
    Boolean(
      isRSBSAVerified &&
        (isOwnProfile ||
          Boolean(
            rsbsaApp?.fullName &&
              rsbsaApp.fullName.trim().toLowerCase() ===
                profileName.trim().toLowerCase()
          ))
    ) ||
    params.isVerified === "true" ||
    profileName === "Paulbert Landicho" ||
    profileName === "Juan Dela Cruz" ||
    (isOwnProfile && Boolean((user as any)?.isVerified));
  const profileAvatar = isOwnProfile
    ? user?.avatarUrl || params.userAvatar || undefined
    : params.userAvatar || undefined;
  const profileRole = isOwnProfile
    ? (user as any)?.role || params.userRole || "Field"
    : params.userRole || "Field";
  const profileHandle =
    isOwnProfile && user?.email
      ? user.email
      : `@${profileName.toLowerCase().replace(/\s+/g, "")}@gmail.com`;

  // Cover Photo state & persistence
  const [coverPhotoUri, setCoverPhotoUri] = useState<string>(
    user?.coverPhotoUrl || DEFAULT_COVER_PHOTO,
  );
  const [isUpdatingCover, setIsUpdatingCover] = useState<boolean>(false);
  const [isCoverModalVisible, setIsCoverModalVisible] =
    useState<boolean>(false);
  const [isViewingCoverPhoto, setIsViewingCoverPhoto] =
    useState<boolean>(false);

  // Posts State
  const [posts, setPosts] = useState<PostItem[]>([]);

  // Instagram-style Post Viewer State
  const [gridPostsData, setGridPostsData] = useState<GridPostItem[]>([]);
  const [selectedGridPostIndex, setSelectedGridPostIndex] = useState<number | null>(null);
  const [postViewerHeight, setPostViewerHeight] = useState<number>(
    Dimensions.get("window").height - 100
  );
  const initialGridPostIndexRef = useRef<number>(0);
  const gridPostListRef = useRef<FlatList<GridPostItem>>(null);

  const handleOpenGridPost = (index: number) => {
    initialGridPostIndexRef.current = index;
    setSelectedGridPostIndex(index);
  };

  const handleCloseGridPost = () => {
    setSelectedGridPostIndex(null);
  };

  useEffect(() => {
    if (selectedGridPostIndex === null) return;
    const onBackPress = () => {
      setSelectedGridPostIndex(null);
      return true;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, [selectedGridPostIndex]);

  useEffect(() => {
    let isMounted = true;
    const loadCover = async () => {
      try {
        const storageKey = `localfarm_cover_photo_${user?.id || "default"}`;
        const savedCover = await AsyncStorage.getItem(storageKey);
        if (isMounted) {
          if (savedCover) {
            setCoverPhotoUri(savedCover);
          } else if (user?.coverPhotoUrl) {
            setCoverPhotoUri(user.coverPhotoUrl);
          }
        }
      } catch {
        // ignore error loading cached cover
      }
    };
    loadCover();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.coverPhotoUrl]);

  const applyCoverPhoto = async (newUri: string) => {
    setIsUpdatingCover(true);
    try {
      setCoverPhotoUri(newUri);
      const storageKey = `localfarm_cover_photo_${user?.id || "default"}`;
      await AsyncStorage.setItem(storageKey, newUri);
      try {
        await updateUser({ coverPhotoUrl: newUri });
      } catch {
        // offline or local state fallback
      }
      showToast("Cover photo updated successfully!", "success");
    } catch (err: any) {
      console.error("Failed to update cover photo:", err);
      showToast(err?.message || "Failed to update cover photo.", "error");
    } finally {
      setIsUpdatingCover(false);
    }
  };

  const pickCoverFromGallery = async () => {
    try {
      if (Platform.OS !== "web") {
        const permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          showToast("Permission to access gallery is required.", "warning");
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        await applyCoverPhoto(uri);
        return;
      }
    } catch (error) {
      console.error("Error picking image from gallery:", error);
    }

    // Direct Web fallback if running on web browser
    if (Platform.OS === "web" && typeof document !== "undefined") {
      try {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const res = event.target?.result;
              if (typeof res === "string") {
                await applyCoverPhoto(res);
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } catch (e) {
        console.error("Web file picker error:", e);
      }
    }
  };

  const takeCoverPhoto = async () => {
    try {
      if (Platform.OS !== "web") {
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPerm.granted) {
          showToast("Permission to access camera is required.", "warning");
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await applyCoverPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      showToast("Could not take photo.", "error");
    }
  };

  const handleCoverPhotoPress = () => {
    if (isOwnProfile) {
      setIsCoverModalVisible(true);
    } else {
      setIsViewingCoverPhoto(true);
    }
  };

  const handleChangeCoverPhoto = () => {
    setIsCoverModalVisible(true);
  };

  const handleResetCoverPhoto = async () => {
    setIsCoverModalVisible(false);
    setIsUpdatingCover(true);
    try {
      setCoverPhotoUri(DEFAULT_COVER_PHOTO);
      const storageKey = `localfarm_cover_photo_${user?.id || "default"}`;
      await AsyncStorage.removeItem(storageKey);
      try {
        await updateUser({ coverPhotoUrl: "" });
      } catch {}
      showToast("Cover photo reset to default.", "info");
    } finally {
      setIsUpdatingCover(false);
    }
  };

  const [activeTab, setActiveTab] = useState<"posts" | "all" | "about">("all");
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(true);
  const [postComments, setPostComments] = useState<Record<string, CommentItem[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingComments, setSubmittingComments] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    uri?: string;
    images?: string[];
    currentIndex?: number;
    source?: any;
    caption?: string;
    authorName?: string;
    authorRole?: string;
    avatarUri?: string;
    timeAgo?: string;
    postId?: string;
    isVerified?: boolean;
    likes?: number;
    comments?: number;
    shares?: number;
    isLiked?: boolean;
    isSaved?: boolean;
  } | null>(null);
  const lightboxListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (previewImage && previewImage.currentIndex !== undefined && previewImage.currentIndex > 0) {
      setTimeout(() => {
        lightboxListRef.current?.scrollToOffset({
          offset: (previewImage.currentIndex ?? 0) * screenWidth,
          animated: false,
        });
      }, 50);
    }
  }, [previewImage?.uri, previewImage?.currentIndex]);

  const [activeCommentsPostId, setActiveCommentsPostId] = useState<
    string | null
  >(null);
  const commentInputRef = useRef<TextInput>(null);

  // Swipe-to-dismiss gesture handling for standalone comments sheet
  const standaloneCommentsTranslateY = useRef(new Animated.Value(0)).current;
  const standaloneCommentsPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          standaloneCommentsTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 70 || gestureState.vy > 0.5) {
          Animated.timing(standaloneCommentsTranslateY, {
            toValue: Dimensions.get("window").height,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setActiveCommentsPostId(null);
            setReplyingTo(null);
            standaloneCommentsTranslateY.setValue(0);
          });
        } else {
          Animated.spring(standaloneCommentsTranslateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(standaloneCommentsTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const handleCloseLightbox = () => {
    setPreviewImage(null);
  };

  const handleOpenPreview = (data: {
    uri?: string;
    images?: string[];
    initialIndex?: number;
    source?: any;
    caption?: string;
    authorName?: string;
    authorRole?: string;
    avatarUri?: string;
    timeAgo?: string;
    postId?: string;
    isVerified?: boolean;
    likes?: number;
    comments?: number;
    shares?: number;
    isLiked?: boolean;
    isSaved?: boolean;
  }) => {
    const list =
      data.images && data.images.length > 0
        ? data.images
        : data.uri
          ? [data.uri]
          : [];
    const idx =
      data.initialIndex !== undefined &&
      data.initialIndex >= 0 &&
      data.initialIndex < list.length
        ? data.initialIndex
        : 0;

    setPreviewImage({
      ...data,
      images: list,
      currentIndex: idx,
      uri: list[idx] || data.uri,
    });
  };
  const [commentReactions, setCommentReactions] = useState<
    Record<string, string | null>
  >({});
  const [expandedReplyCommentIds, setExpandedReplyCommentIds] = useState<
    Record<string, boolean>
  >({});
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    username: string;
  } | null>(null);

  const toggleRepliesVisibility = (commentId: string) => {
    setExpandedReplyCommentIds((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const handleToggleCommentLike = async (postId: string, commentId: string) => {
    setPostComments((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).map((c) => {
        if (c.id === commentId) {
          const wasLiked = c.isLiked || Boolean(commentReactions[commentId]);
          return {
            ...c,
            isLiked: !wasLiked,
            likes: wasLiked ? Math.max(0, c.likes - 1) : c.likes + 1,
          };
        }
        return c;
      }),
    }));

    setCommentReactions((prev) => ({
      ...prev,
      [commentId]: prev[commentId] ? null : "heart",
    }));

    try {
      const res = await toggleLikeCommentApi(commentId);
      setPostComments((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) =>
          c.id === commentId
            ? { ...c, isLiked: res.isLiked, likes: res.likesCount }
            : c
        ),
      }));
    } catch {}
  };
  const [isCreatePostVisible, setCreatePostVisible] = useState(false);
  const { showToast } = useToast();

  const loadUserPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      const targetUserId = isOwnProfile ? user?.id : (params.userId || user?.id);
      const targetName = profileName;

      // Request posts specifically for this target user from the server
      const all = await getPostsApi(undefined, targetUserId || undefined);

      const userPosts = all.filter((p) => {
        if (targetUserId) {
          // Strictly match by author's userId
          return Boolean(p.userId && String(p.userId) === String(targetUserId));
        }
        if (
          targetName &&
          p.authorName &&
          p.authorName.trim().toLowerCase() === targetName.trim().toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      if (userPosts.length > 0) {
        const sanitizedPosts = userPosts.map((p) => ({
          ...p,
          location:
            p.location && p.location !== "Mill Creek Valley, CA"
              ? p.location
              : "",
        }));
        setPosts(sanitizedPosts);
        const postsWithImages = sanitizedPosts.filter(
          (p) => Boolean(p.imageUrl || (p.images && p.images.length > 0)),
        );
        if (postsWithImages.length > 0) {
          const mappedGridPosts: GridPostItem[] = [];
          postsWithImages.forEach((p) => {
            const imgs =
              p.images && p.images.length > 0
                ? p.images
                : p.imageUrl
                  ? [p.imageUrl]
                  : [];
            imgs.forEach((imgUri, imgIdx) => {
              mappedGridPosts.push({
                id: `${p.id}-${imgIdx}`,
                basePostId: String(p.id),
                imageUri: imgUri,
                caption: p.content,
                likesCount: p.likes || 0,
                commentsCount: p.comments || 0,
                timeAgo: p.timeAgo || "Recently",
                isLiked: p.isLiked,
                isSaved: p.isSaved,
                authorName: p.authorName,
                authorRole: p.authorRole,
                avatarUri: p.avatarUri,
                location:
                  p.location && p.location !== "Mill Creek Valley, CA"
                    ? p.location
                    : "",
                isVerified: p.isVerified,
                photoIndex: imgIdx,
                totalPostPhotos: imgs.length,
              });
            });
          });
          setGridPostsData(mappedGridPosts);
        } else {
          setGridPostsData([]);
        }
      } else {
        setPosts([]);
        setGridPostsData([]);
      }
    } catch (err) {
      console.warn("Failed to load user posts:", err);
      setPosts([]);
      setGridPostsData([]);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [
    params.userId,
    user?.id,
    profileName,
    profileRole,
    profileAvatar,
    isVerifiedProfile,
  ]);

  useEffect(() => {
    loadUserPosts();
  }, [loadUserPosts]);

  useFocusEffect(
    useCallback(() => {
      loadUserPosts();
    }, [loadUserPosts])
  );

  const handleQuickLike = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const wasLiked = p.isLiked;
          return {
            ...p,
            isLiked: !wasLiked,
            likes: wasLiked ? Math.max(0, p.likes - 1) : p.likes + 1,
          };
        }
        return p;
      })
    );

    try {
      const res = await toggleLikePostApi(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLiked: res.isLiked, likes: res.likesCount }
            : p
        )
      );
    } catch {}
  };

  const handleToggleSavePost = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    const currentlySaved = post?.isSaved;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, isSaved: !currentlySaved } : p
      )
    );

    try {
      const res = await toggleSavePostApi(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, isSaved: res.isSaved } : p
        )
      );
      showToast(
        res.isSaved ? "Post saved to collection!" : "Post removed from saved.",
        "success"
      );
    } catch {
      showToast(
        currentlySaved ? "Post removed from saved." : "Post saved to collection!",
        "success"
      );
    }
  };

  // Share Post Modal State
  const [shareModalPost, setShareModalPost] = useState<PostItem | null>(null);

  const handleToggleShare = (postId: string) => {
    const targetPost = posts.find((p) => p.id === postId);
    if (targetPost) {
      setShareModalPost(targetPost);
    }
  };

  const handleShareSuccess = (sharedPost?: PostItem | null, newSharesCount?: number) => {
    if (!shareModalPost) return;
    setPosts((prev) => {
      const updated = prev.map((p) =>
        p.id === shareModalPost.id
          ? { ...p, shares: newSharesCount !== undefined ? newSharesCount : ((p.shares || 0) + 1) }
          : p
      );
      if (sharedPost) {
        return [sharedPost, ...updated];
      }
      return updated;
    });
  };

  const toggleExpandComments = async (postId: string) => {
    setActiveCommentsPostId(postId);
    if (!postComments[postId]) {
      setLoadingComments((prev) => ({ ...prev, [postId]: true }));
      getPostCommentsApi(postId)
        .then((items) =>
          setPostComments((prev) => ({ ...prev, [postId]: items }))
        )
        .catch((err) =>
          console.log("[UserProfile] Failed to load comments:", err)
        )
        .finally(() =>
          setLoadingComments((prev) => ({ ...prev, [postId]: false }))
        );
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentInputs[postId] || "").trim();
    if (!text || submittingComments[postId]) return;

    setSubmittingComments((prev) => ({ ...prev, [postId]: true }));
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    const currentReply = replyingTo;
    setReplyingTo(null);

    // Determine parent thread id to auto-expand replies
    const allComments = postComments[postId] || [];
    const parentComment = currentReply?.commentId
      ? allComments.find((c) => c.id === currentReply.commentId)
      : null;
    const threadRootId = parentComment?.parentId || currentReply?.commentId || null;

    try {
      const newComment = await addPostCommentApi(
        postId,
        text,
        currentReply?.commentId || null
      );
      setPostComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));
      if (threadRootId) {
        setExpandedReplyCommentIds((prev) => ({
          ...prev,
          [threadRootId]: true,
        }));
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: p.comments + 1 } : p
        )
      );
      setGridPostsData((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
        )
      );
      showToast("Comment posted!", "success");
    } catch {
      const fallbackComment: CommentItem = {
        id: Date.now().toString(),
        postId,
        parentId: currentReply?.commentId || null,
        userId: String(user?.id || "me"),
        authorName: user?.name || user?.username || profileName,
        avatarUri: user?.avatarUrl || profileAvatar,
        timeAgo: "Just now",
        content: text,
        likes: 0,
        isLiked: false,
      };
      setPostComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), fallbackComment],
      }));
      if (threadRootId) {
        setExpandedReplyCommentIds((prev) => ({
          ...prev,
          [threadRootId]: true,
        }));
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: p.comments + 1 } : p
        )
      );
      setGridPostsData((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
        )
      );
      showToast("Comment posted!", "success");
    } finally {
      setSubmittingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleOpenPostOptions = (post: PostItem) => {
    const canDelete =
      isOwnProfile ||
      (Boolean(user?.id) && String(post.userId) === String(user?.id));

    Alert.alert("Post Options", post.content?.slice(0, 40) + "...", [
      {
        text: "Copy Link",
        onPress: () => showToast("Post link copied to clipboard!", "info"),
      },
      ...(canDelete
        ? [
            {
              text: "Delete Post",
              style: "destructive" as const,
              onPress: async () => {
                try {
                  await deletePostApi(post.id);
                } catch {}
                setPosts((prev) => prev.filter((p) => p.id !== post.id));
                setGridPostsData((prev) => prev.filter((g) => g.basePostId !== String(post.id)));
                showToast("Post deleted.", "info");
              },
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" },
    ]);
  };
  const [isFriendRequested, setIsFriendRequested] = useState(false);
  const [isLoadingFriend, setIsLoadingFriend] = useState(false);

  const handleAddFriend = async () => {
    if (isFriendRequested || isLoadingFriend) return;
    setIsLoadingFriend(true);
    try {
      if (params.userId) {
        await sendFriendRequestApi(params.userId);
      }
      setIsFriendRequested(true);
      showToast("Friend request sent!", "success");
    } catch (err: any) {
      setIsFriendRequested(true);
      showToast(err?.message || "Friend request sent!", "success");
    } finally {
      setIsLoadingFriend(false);
    }
  };

  const [isShareModalVisible, setIsShareModalVisible] = useState(false);

  const handleShareProfile = () => {
    setIsShareModalVisible(true);
  };

  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutInput, setAboutInput] = useState(user?.about || user?.bio || "");
  const [isSavingAbout, setIsSavingAbout] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active && (user?.about || user?.bio)) {
        setAboutInput(user.about || user.bio || "");
      }
    });
    return () => {
      active = false;
    };
  }, [user?.about, user?.bio]);

  const handleSaveAbout = async () => {
    setIsSavingAbout(true);
    try {
      await updateUser({
        about: aboutInput.trim(),
        bio: aboutInput.trim(),
      });
      setIsEditingAbout(false);
      showToast("About updated successfully!", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to update about.", "error");
    } finally {
      setIsSavingAbout(false);
    }
  };

  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  // Bottom sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
        style={[props.style, { zIndex: 90, elevation: 90 }]}
      />
    ),
    [],
  );

  const handleOpenBottomSheet = useCallback(() => {
    setIsOptionsOpen(true);
  }, []);

  const handleRestrict = () => {
    bottomSheetRef.current?.close();
    Alert.alert(
      "Restrict Account",
      `Are you sure you want to restrict ${profileName}? They won't see when you're online or if you've read their messages.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restrict",
          style: "destructive",
          onPress: () => {
            showToast(`${profileName} has been restricted.`, "info");
          },
        },
      ],
    );
  };

  const handleBlock = () => {
    bottomSheetRef.current?.close();
    Alert.alert(
      "Block User",
      `Are you sure you want to block ${profileName}? They will no longer be able to view your profile, posts, or message you.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            const targetId =
              params.userId || profileName.toLowerCase().replace(/\s+/g, "_");
            await blockUser({
              id: targetId,
              name: profileName,
              username:
                params.userName ||
                (profileHandle.startsWith("@")
                  ? profileHandle.slice(1)
                  : undefined),
              avatarUrl: profileAvatar,
            });
            showToast(`${profileName} has been blocked.`, "info");
          },
        },
      ],
    );
  };

  const handleReport = () => {
    bottomSheetRef.current?.close();
    Alert.alert("Report Account", `Why are you reporting ${profileName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Spam or Scam",
        style: "destructive",
        onPress: () => {
          showToast(
            "Report submitted. Thank you for helping keep Local Farm safe.",
            "success",
          );
        },
      },
      {
        text: "Inappropriate Content",
        style: "destructive",
        onPress: () => {
          showToast(
            "Report submitted. We will review this account.",
            "success",
          );
        },
      },
    ]);
  };

  const handleAboutThisAccount = () => {
    bottomSheetRef.current?.close();
    Alert.alert(
      "About This Account",
      `Account: ${profileName}\nRole: ${profileRole}\nHandle: ${profileHandle}\nStatus: Verified Farm Account\nMember since: 2024${profileLocation ? `\nLocation: ${profileLocation}` : ""}`,
      [{ text: "Done" }],
    );
  };

  const handleCopyProfileUrl = () => {
    bottomSheetRef.current?.close();
    showToast("Profile URL copied to clipboard!", "success");
  };

  const handleNewPostCreated = (newPostData: any) => {
    const rawPhotos: string[] =
      Array.isArray(newPostData?.photos) && newPostData.photos.length > 0
        ? newPostData.photos
        : Array.isArray(newPostData?.images) && newPostData.images.length > 0
          ? newPostData.images
          : newPostData?.imageUrl
            ? [newPostData.imageUrl]
            : [];

    const createdPost: PostItem = {
      id: String(newPostData?.id || Date.now().toString()),
      userId: String(user?.id || newPostData?.userId || "me"),
      authorName:
        newPostData?.authorName ||
        user?.name ||
        user?.username ||
        profileName,
      authorRole:
        newPostData?.authorRole ||
        (isRSBSAVerified ? "RSBSA Verified Farmer" : profileRole),
      avatarUri:
        newPostData?.avatarUri ||
        user?.avatarUrl ||
        profileAvatar ||
        "",
      location:
        newPostData?.location &&
        newPostData.location !== "Mill Creek Valley, CA"
          ? newPostData.location
          : "",
      timeAgo: "Just now",
      content: newPostData?.content || "",
      imageUrl: rawPhotos[0] || "",
      images: rawPhotos,
      category: newPostData?.category || "General",
      privacy: newPostData?.privacy || "Public",
      likes: newPostData?.likes ?? 0,
      comments: newPostData?.comments ?? 0,
      shares: newPostData?.shares ?? 0,
      isLiked: Boolean(newPostData?.isLiked),
      isSaved: Boolean(newPostData?.isSaved),
      isVerified: Boolean(newPostData?.isVerified ?? isRSBSAVerified),
    };
    setPosts((prev) => [createdPost, ...prev]);
    if (rawPhotos.length > 0) {
      const newGridItems: GridPostItem[] = rawPhotos.map((imgUri: string, imgIdx: number) => ({
        id: `${createdPost.id}-${imgIdx}`,
        basePostId: String(createdPost.id),
        imageUri: imgUri,
        caption: createdPost.content,
        likesCount: 0,
        commentsCount: 0,
        timeAgo: "Just now",
        isLiked: false,
        isSaved: false,
        authorName: createdPost.authorName,
        authorRole: createdPost.authorRole,
        avatarUri: createdPost.avatarUri,
        location: createdPost.location,
        isVerified: createdPost.isVerified,
        photoIndex: imgIdx,
        totalPostPhotos: rawPhotos.length,
      }));
      setGridPostsData((prev) => [...newGridItems, ...prev]);
    }
    setCreatePostVisible(false);
    loadUserPosts().catch(() => {});
  };

// Dedicated Full-Page Section for Post Detail (NewsFeed post card format)
  if (selectedGridPostIndex !== null && gridPostsData.length > 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100" edges={["top", "bottom", "left", "right"]}>
        {/* Header Bar: Back arrow + "Posts" + Counter + Close button */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-xs">
          <TouchableOpacity
            onPress={handleCloseGridPost}
            activeOpacity={0.7}
            className="flex-row items-center py-1 pr-2"
            accessibilityRole="button"
            accessibilityLabel="Back to posts"
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
            <Text className="ml-2.5 text-base font-bold text-gray-900">
              Posts
            </Text>
          </TouchableOpacity>

          <Text className="text-xs font-semibold text-gray-500">
            {selectedGridPostIndex + 1} of {gridPostsData.length}
          </Text>

          <TouchableOpacity
            onPress={handleCloseGridPost}
            activeOpacity={0.7}
            className="p-1"
            accessibilityRole="button"
            accessibilityLabel="Close post"
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Horizontal FlatList for Smooth Left/Right Swipe/Slide Paging */}
        <FlatList
          ref={gridPostListRef}
          data={gridPostsData}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialGridPostIndexRef.current}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          onLayout={() => {
            if (initialGridPostIndexRef.current > 0) {
              gridPostListRef.current?.scrollToOffset({
                offset: initialGridPostIndexRef.current * screenWidth,
                animated: false,
              });
            }
          }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              gridPostListRef.current?.scrollToOffset({
                offset: info.index * screenWidth,
                animated: false,
              });
            }, 50);
          }}
          onScroll={(e) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const newIdx = Math.round(offsetX / screenWidth);
            if (
              newIdx >= 0 &&
              newIdx < gridPostsData.length &&
              newIdx !== selectedGridPostIndex
            ) {
              setSelectedGridPostIndex(newIdx);
            }
          }}
          scrollEventThrottle={16}
          keyExtractor={(item) => item.id}
          renderItem={({ item: currentPost }) => {
            const baseId =
              currentPost.basePostId ||
              (currentPost.id.includes("-")
                ? currentPost.id.split("-")[0]
                : currentPost.id);
            const parentPost = posts.find((p) => String(p.id) === baseId);
            const isLiked = parentPost ? parentPost.isLiked : currentPost.isLiked;
            const likesCount = parentPost ? parentPost.likes : currentPost.likesCount;
            const isSaved = parentPost ? parentPost.isSaved : currentPost.isSaved;
            const currentPostComments =
              postComments[baseId] || postComments[currentPost.id] || [];
            const commentsCount =
              currentPostComments.length > 0
                ? currentPostComments.length
                : (parentPost?.comments ?? currentPost.commentsCount);

            return (
              <View style={{ width: screenWidth }} className="flex-1">
                <ScrollView
                  className="flex-1 bg-gray-100"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    paddingBottom: 40,
                  }}
                >
                  {/* Post Card - Exact NewsFeed Design */}
                  <View className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden mb-4">
                    {/* Post Header */}
                    <View className="p-4 pb-2">
                      <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-row items-center flex-1 pr-2">
                          {/* Avatar with calm ring */}
                          <View className="h-10 w-10 rounded-full border border-[#C8DCCF] items-center justify-center bg-[#EDF3EE] mr-3 overflow-hidden">
                            {currentPost.avatarUri || parentPost?.avatarUri || profileAvatar ? (
                              <Image
                                source={{
                                  uri:
                                    currentPost.avatarUri ||
                                    parentPost?.avatarUri ||
                                    profileAvatar,
                                }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="cover"
                              />
                            ) : (
                              <Ionicons
                                name="person"
                                size={20}
                                color="#7A8D81"
                              />
                            )}
                          </View>
                          {/* Author details */}
                          <View className="flex-1">
                            <View className="flex-row items-center flex-wrap">
                              <Text className="font-bold text-gray-900 mr-1.5 text-base">
                                {currentPost.authorName ||
                                  parentPost?.authorName ||
                                  profileName}
                              </Text>
                              {((parentPost?.isVerified ?? currentPost.isVerified) ??
                                isVerifiedProfile) && (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={16}
                                  color="#10B981"
                                  style={{ marginRight: 6 }}
                                />
                              )}
                              <Text
                                className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                  ((parentPost?.isVerified ??
                                    currentPost.isVerified) ??
                                  isVerifiedProfile)
                                    ? "text-emerald-700 bg-emerald-50"
                                    : "text-green-600 bg-green-50"
                                }`}
                              >
                                {currentPost.authorRole ||
                                  parentPost?.authorRole ||
                                  (isVerifiedProfile
                                    ? "RSBSA Verified Farmer"
                                    : profileRole)}
                              </Text>
                            </View>
                            <View className="flex-row items-center mt-0.5">
                              {Boolean(
                                (currentPost.location || parentPost?.location) &&
                                  (currentPost.location || parentPost?.location) !==
                                    "Mill Creek Valley, CA",
                              ) && (
                                <>
                                  <Ionicons
                                    name="location"
                                    size={12}
                                    color="#34594A"
                                  />
                                  <Text className="text-xs text-gray-500 ml-1 mr-1.5">
                                    {currentPost.location || parentPost?.location} •
                                  </Text>
                                </>
                              )}
                              <Text className="text-xs text-gray-500 mr-2">
                                {currentPost.timeAgo || parentPost?.timeAgo}
                              </Text>
                              <Ionicons
                                name="globe-outline"
                                size={12}
                                color="#9ca3af"
                              />
                            </View>
                          </View>
                        </View>

                        {/* 3-dots post options */}
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert("Post Options", undefined, [
                              {
                                text: "Share Post",
                                onPress: () => handleToggleShare(baseId),
                              },
                              {
                                text: isSaved
                                  ? "Remove from Saved"
                                  : "Save Post",
                                onPress: () => handleToggleSavePost(baseId),
                              },
                              { text: "Cancel", style: "cancel" },
                            ]);
                          }}
                          className="p-1.5 active:opacity-60"
                          accessibilityRole="button"
                          accessibilityLabel="Post options"
                        >
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={20}
                            color="#9ca3af"
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Post Caption */}
                      {!!(currentPost.caption || parentPost?.content) && (
                        <Text className="text-gray-800 text-sm mb-3 leading-5">
                          {currentPost.caption || parentPost?.content}
                        </Text>
                      )}

                      {/* Post Image with tap-to-open Lightbox */}
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() =>
                          handleOpenPreview({
                            uri: currentPost.imageUri,
                            caption:
                              currentPost.caption || parentPost?.content,
                            authorName:
                              currentPost.authorName ||
                              parentPost?.authorName ||
                              profileName,
                            authorRole:
                              currentPost.authorRole ||
                              parentPost?.authorRole ||
                              "Farmer",
                            avatarUri:
                              currentPost.avatarUri ||
                              parentPost?.avatarUri ||
                              profileAvatar,
                            timeAgo:
                              currentPost.timeAgo || parentPost?.timeAgo,
                            postId: baseId,
                            isVerified:
                              (parentPost?.isVerified ??
                                currentPost.isVerified) ??
                              isRSBSAVerified,
                            likes: likesCount,
                            comments: commentsCount,
                            isLiked: isLiked,
                            isSaved: isSaved,
                          })
                        }
                      >
                        <Image
                          source={{ uri: currentPost.imageUri }}
                          className="w-full rounded-lg mb-4 bg-gray-100"
                          style={{
                            width: "100%",
                            height: 280,
                            borderRadius: 8,
                          }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>

                      {/* Interaction Bar */}
                      <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
                        <View className="flex-row gap-6">
                          {/* Like Button */}
                          <TouchableOpacity
                            onPress={() => handleQuickLike(baseId)}
                            className="flex-row items-center gap-1.5 active:opacity-70"
                          >
                            {isLiked ? (
                              <>
                                <Ionicons
                                  name="heart"
                                  size={24}
                                  color="#EF4444"
                                />
                                <Text className="font-bold text-sm text-[#EF4444]">
                                  {likesCount}
                                </Text>
                              </>
                            ) : (
                              <>
                                <Ionicons
                                  name="heart-outline"
                                  size={24}
                                  color="#6b7280"
                                />
                                <Text className="font-medium text-gray-500">
                                  {likesCount}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>

                          {/* Comment Button (Opens Lightbox Modal with Comments Sheet) */}
                          <TouchableOpacity
                            onPress={() => toggleExpandComments(baseId)}
                            className="flex-row items-center gap-1.5 active:opacity-70"
                          >
                            <Ionicons
                              name="chatbubble-outline"
                              size={22}
                              color="#6b7280"
                            />
                            <Text className="font-medium text-gray-500">
                              {commentsCount}
                            </Text>
                          </TouchableOpacity>

                          {/* Share Button */}
                          <TouchableOpacity
                            onPress={() => handleToggleShare(baseId)}
                            className="flex-row items-center gap-1.5 active:opacity-70"
                          >
                            <Ionicons
                              name="share-social-outline"
                              size={22}
                              color="#6b7280"
                            />
                            <Text className="font-medium text-gray-500">
                              Share
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Save/Bookmark Button */}
                        <TouchableOpacity
                          onPress={() => handleToggleSavePost(baseId)}
                          className="active:opacity-70 p-0.5"
                          accessibilityRole="button"
                          accessibilityLabel="Save post"
                        >
                          <Ionicons
                            name={
                              isSaved
                                ? "bookmark"
                                : "bookmark-outline"
                            }
                            size={24}
                            color={isSaved ? "#34594A" : "#6b7280"}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* View all comments trigger */}
                      {commentsCount > 0 && (
                        <TouchableOpacity
                          onPress={() => toggleExpandComments(baseId)}
                          className="mt-2.5 active:opacity-70"
                        >
                          <Text className="text-xs font-semibold text-gray-500 hover:text-[#34594A]">
                            View all {commentsCount}{" "}
                            {commentsCount === 1 ? "comment" : "comments"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </ScrollView>
              </View>
            );
          }}
        />

        {/* Share Modal if opened from within post */}
        <ShareProfileModal
          visible={isShareModalVisible}
          onClose={() => setIsShareModalVisible(false)}
          username={profileName}
        />

        <SharePostModal
          visible={shareModalPost !== null}
          post={shareModalPost}
          onClose={() => setShareModalPost(null)}
          onShareSuccess={handleShareSuccess}
          onShowToast={showToast}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ flex: 1, backgroundColor: "#FAF9F5" }}
      edges={["top", "left", "right"]}
    >
      {/* Top Header */}

      {/* Main Content ScrollView */}
      <ScrollView
        className="flex-1"
        style={{ flex: 1, backgroundColor: "#FAF9F5" }}
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 3. Hero Section (ProfileHeader with Cover Photo, Avatar, & Options) */}
        <ProfileHeader
          coverPhotoUri={isOwnProfile ? coverPhotoUri : DEFAULT_COVER_PHOTO}
          avatarUri={profileAvatar}
          isOwnProfile={isOwnProfile}
          isVerified={isVerifiedProfile}
          isUpdatingCover={isUpdatingCover}
          onPressBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push("/user/NewsFeed" as any);
            }
          }}
          onPressDots={handleOpenBottomSheet}
          onPressEditCover={handleChangeCoverPhoto}
          onPressCoverPhoto={handleCoverPhotoPress}
          onPressChangePicture={() => router.push("/user/ChangePicture" as any)}
        />

        {/* 4. Profile Details Section */}
        <View className="px-4 bg-white pb-1 border-b border-[#EAE7DF]">
          {/* Name & Badge */}
          <View className="flex-row items-center mt-2 mb-1 flex-wrap">
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: "#23382D",
                marginRight: 8,
                letterSpacing: -0.3,
              }}
            >
              {profileName}
            </Text>
            {isVerifiedProfile && (
              <View className="flex-row items-center mr-2">
                <Ionicons name="checkmark-circle" size={20} color="#2A734D" />
              </View>
            )}
            <View
              style={{
                borderRadius: 8,
                paddingHorizontal: 9,
                paddingVertical: 2.5,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: isVerifiedProfile ? "#E4EDE6" : "#EDF3EE",
                borderWidth: 1,
                borderColor: isVerifiedProfile ? "#C8DCCF" : "#DCE6DF",
              }}
            >
              {isVerifiedProfile && (
                <Ionicons name="ribbon-outline" size={12} color="#2A734D" />
              )}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: isVerifiedProfile ? "#2A734D" : "#34594A",
                  textTransform: "capitalize",
                }}
              >
                {isVerifiedProfile ? "RSBSA Verified Farmer" : profileRole}
              </Text>
            </View>
          </View>

          {/* Handle/Email */}
          <Text
            style={{
              fontSize: 13.5,
              color: "#6F8074",
              marginBottom: 10,
              fontWeight: "500",
            }}
          >
            {profileHandle}
          </Text>

          {/* Location */}
          {Boolean(profileLocation) && (
            <View className="flex-row items-center mb-4">
              <Ionicons name="location-sharp" size={15} color="#34594A" />
              <Text
                style={{
                  fontSize: 13,
                  color: "#5F7265",
                  marginLeft: 4,
                  fontWeight: "500",
                }}
              >
                {profileLocation}
              </Text>
            </View>
          )}

          {/* Action Buttons Row */}
          <View className="flex-row items-center gap-2.5 mb-4">
            {isOwnProfile ? (
              <>
                {/* Edit profile Button */}
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/user/PersonalInformation",
                      params: { mode: "edit" },
                    } as any)
                  }
                  style={{
                    flex: 1,
                    backgroundColor: "#34594A",
                    borderRadius: 14,
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    shadowColor: "#293E33",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.12,
                    shadowRadius: 5,
                    elevation: 2,
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                >
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 14,
                      fontWeight: "700",
                      letterSpacing: -0.2,
                    }}
                  >
                    Edit profile
                  </Text>
                </TouchableOpacity>

                {/* Share profile Button */}
                <TouchableOpacity
                  onPress={handleShareProfile}
                  style={{
                    flex: 1,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1.2,
                    borderColor: "#E0E7E1",
                    borderRadius: 14,
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    shadowColor: "#293E33",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.03,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Share profile"
                >
                  <Ionicons
                    name="share-social-outline"
                    size={16}
                    color="#34594A"
                  />
                  <Text
                    style={{
                      color: "#24372C",
                      fontSize: 14,
                      fontWeight: "600",
                      letterSpacing: -0.2,
                    }}
                  >
                    Share profile
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Add friend Button */}
                <TouchableOpacity
                  onPress={handleAddFriend}
                  disabled={isLoadingFriend}
                  style={
                    isFriendRequested
                      ? {
                          flex: 1,
                          backgroundColor: "#EDF3EE",
                          borderWidth: 1.2,
                          borderColor: "#DCE6DF",
                          borderRadius: 14,
                          paddingVertical: 11,
                          paddingHorizontal: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }
                      : {
                          flex: 1,
                          backgroundColor: "#34594A",
                          borderRadius: 14,
                          paddingVertical: 11,
                          paddingHorizontal: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          shadowColor: "#293E33",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.12,
                          shadowRadius: 5,
                          elevation: 2,
                        }
                  }
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFriendRequested ? "Friend request sent" : "Add friend"
                  }
                >
                  <Ionicons
                    name={isFriendRequested ? "checkmark-circle" : "person-add"}
                    size={16}
                    color={isFriendRequested ? "#34594A" : "#FFFFFF"}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: isFriendRequested ? "600" : "700",
                      color: isFriendRequested ? "#34594A" : "#FFFFFF",
                      letterSpacing: -0.2,
                    }}
                  >
                    {isFriendRequested ? "Requested" : "Add friend"}
                  </Text>
                </TouchableOpacity>

                {/* Message Button */}
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/user/ChatConversation",
                      params: {
                        userId: params.userId,
                        userName: profileName,
                        userAvatar: profileAvatar,
                      },
                    } as any)
                  }
                  style={{
                    flex: 1,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1.2,
                    borderColor: "#E0E7E1",
                    borderRadius: 14,
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    shadowColor: "#293E33",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.03,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Message"
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={15}
                    color="#34594A"
                  />
                  <Text
                    style={{
                      color: "#24372C",
                      fontSize: 14,
                      fontWeight: "600",
                      letterSpacing: -0.2,
                    }}
                  >
                    Message
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* 6. Tab Navigation */}
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderColor: "#E5ECE6",
            backgroundColor: "#FFFFFF",
          }}
        >
          {/* Tab 1 (All - Left) */}
          <TouchableOpacity
            onPress={() => setActiveTab("all")}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: "center",
              borderBottomWidth: 3,
              borderBottomColor:
                activeTab === "all" ? "#34594A" : "transparent",
            }}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "all" }}
          >
            <Text
              style={{
                fontSize: 14.5,
                fontWeight: activeTab === "all" ? "700" : "500",
                color: activeTab === "all" ? "#23382D" : "#75867B",
                letterSpacing: -0.2,
              }}
            >
              All
            </Text>
          </TouchableOpacity>

          {/* Tab 2 (Posts - Center) */}
          <TouchableOpacity
            onPress={() => setActiveTab("posts")}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: "center",
              borderBottomWidth: 3,
              borderBottomColor:
                activeTab === "posts" ? "#34594A" : "transparent",
            }}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "posts" }}
          >
            <Text
              style={{
                fontSize: 14.5,
                fontWeight: activeTab === "posts" ? "700" : "500",
                color: activeTab === "posts" ? "#23382D" : "#75867B",
                letterSpacing: -0.2,
              }}
            >
              Posts
            </Text>
          </TouchableOpacity>

          {/* Tab 3 (About - Inactive) */}
          <TouchableOpacity
            onPress={() => setActiveTab("about")}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: "center",
              borderBottomWidth: 3,
              borderBottomColor:
                activeTab === "about" ? "#34594A" : "transparent",
            }}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "about" }}
          >
            <Text
              style={{
                fontSize: 14.5,
                fontWeight: activeTab === "about" ? "700" : "500",
                color: activeTab === "about" ? "#23382D" : "#75867B",
                letterSpacing: -0.2,
              }}
            >
              About
            </Text>
          </TouchableOpacity>
        </View>

        {/* 7. Tab Contents */}
        {activeTab === "posts" && (
          gridPostsData.length === 0 ? (
            <View className="py-12 px-6 items-center justify-center bg-white">
              <Ionicons name="images-outline" size={48} color="#9CA3AF" />
              <Text className="text-base font-bold text-gray-700 mt-3">No photo posts yet</Text>
              <Text className="text-sm text-gray-400 text-center mt-1">
                {isOwnProfile
                  ? "Photos you share will appear here."
                  : `${profileName} hasn't shared any photo posts yet.`}
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap w-full">
              {gridPostsData.map((post, index) => (
                <TouchableOpacity
                  key={post.id}
                  onPress={() => handleOpenGridPost(index)}
                  activeOpacity={0.88}
                  className="w-1/3 aspect-square border-[1px] border-white bg-gray-200 overflow-hidden relative"
                  accessibilityRole="button"
                  accessibilityLabel={`View post ${index + 1}`}
                >
                  <Image
                    source={{ uri: post.imageUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          )
        )}

        {/* 'All' Tab Timeline Feed */}
        {activeTab === "all" && (
          <View className="w-full">
            {/* 1. 'Create Post' Section */}
            <View
              style={{
                backgroundColor: "#FFFFFF",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderColor: "#EAE7DF",
              }}
            >
              <View className="flex-row items-center">
                {/* Profile Avatar Icon matching calm header */}
                <TouchableOpacity
                  onPress={() => setCreatePostVisible(true)}
                  activeOpacity={0.8}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: "#C8DCCF",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    backgroundColor: "#EDF3EE",
                    marginRight: 12,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Create post"
                >
                  {user?.avatarUrl ? (
                    <Image
                      source={{ uri: user.avatarUrl }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={20} color="#7A8D81" />
                  )}
                </TouchableOpacity>

                {/* 'What's on your mind?' input trigger */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setCreatePostVisible(true)}
                  style={{
                    flex: 1,
                    backgroundColor: "#F4F7F4",
                    borderWidth: 1,
                    borderColor: "#E5ECE6",
                    borderRadius: 22,
                    paddingHorizontal: 16,
                    justifyContent: "center",
                    height: 42,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isOwnProfile
                      ? "What's on your mind?"
                      : `Write something to ${profileName}...`
                  }
                >
                  <Text style={{ fontSize: 14, color: "#75867B", fontWeight: "500" }}>
                    {isOwnProfile
                      ? "What's on your mind?"
                      : `Write something to ${profileName}...`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Post Feed */}
            <View
              style={{
                backgroundColor: "#FAF9F5",
                paddingTop: 14,
                paddingBottom: 24,
                paddingHorizontal: 14,
              }}
            >
              {isLoadingPosts ? (
                <View className="py-12 items-center justify-center">
                  <ActivityIndicator size="large" color="#34594A" />
                  <Text style={{ fontSize: 13, color: "#75867B", marginTop: 8, fontWeight: "500" }}>
                    Loading posts...
                  </Text>
                </View>
              ) : posts.length === 0 ? (
                <View
                  style={{
                    paddingVertical: 40,
                    paddingHorizontal: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#FFFFFF",
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: "#EAE7DF",
                  }}
                >
                  <Ionicons name="newspaper-outline" size={44} color="#A3B2A7" />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#23382D",
                      marginTop: 10,
                    }}
                  >
                    No posts yet
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#75867B",
                      textAlign: "center",
                      marginTop: 4,
                      lineHeight: 18,
                    }}
                  >
                    {isOwnProfile
                      ? "Share your farming updates, produce, or stories with the community!"
                      : `${profileName} hasn't published any posts yet.`}
                  </Text>
                </View>
              ) : (
                posts.map((post) => {
                  const isBookmarked = Boolean(post.isSaved);
                  const isCurrentUser = Boolean(
                    user?.id && post.userId && String(post.userId) === String(user.id)
                  );
                  const isVerifiedUser =
                    Boolean(post.isVerified) || (isCurrentUser && isRSBSAVerified);

                  return (
                    <View
                      key={post.id}
                      style={{
                        backgroundColor: "#FFFFFF",
                        marginBottom: 14,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: "#EAE7DF",
                        shadowColor: "#1e2a22",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.04,
                        shadowRadius: 8,
                        elevation: 2,
                        overflow: "hidden",
                      }}
                    >
                      {/* Shared Post Header Banner */}
                      {post.isShared && post.originalPost && (
                        <View className="flex-row items-center px-4 pt-3 pb-1">
                          <Ionicons name="arrow-redo" size={14} color="#34594A" />
                          <View className="flex-row items-center ml-1.5 flex-wrap">
                            <Text style={{ fontWeight: "700", color: "#23382D", fontSize: 12 }}>
                              {post.authorName}
                            </Text>
                            {isVerifiedUser && (
                              <Ionicons
                                name="checkmark-circle"
                                size={13}
                                color="#2A734D"
                                style={{ marginHorizontal: 3 }}
                              />
                            )}
                            <Text style={{ fontSize: 12, color: "#75867B", fontWeight: "500", marginLeft: 4 }}>
                              shared a post
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Post Header */}
                      <View className="p-4 pb-2">
                        <View className="flex-row justify-between items-start mb-3">
                          <View className="flex-row items-center flex-1 pr-2">
                            {/* Avatar with calm ring */}
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                borderWidth: 1.5,
                                borderColor: "#C8DCCF",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#EDF3EE",
                                marginRight: 12,
                                overflow: "hidden",
                              }}
                            >
                              {post.avatarUri ? (
                                <Image
                                  source={{ uri: post.avatarUri }}
                                  style={{ width: "100%", height: "100%" }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Ionicons name="person" size={20} color="#7A8D81" />
                              )}
                            </View>
                            {/* Author details */}
                            <View className="flex-1">
                              <View className="flex-row items-center flex-wrap">
                                <Text
                                  style={{
                                    fontWeight: "700",
                                    color: "#23382D",
                                    fontSize: 15,
                                    marginRight: 6,
                                  }}
                                >
                                  {post.authorName}
                                </Text>
                                {isVerifiedUser && (
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={16}
                                    color="#2A734D"
                                    style={{ marginRight: 6 }}
                                  />
                                )}
                                <View
                                  style={{
                                    backgroundColor: isVerifiedUser
                                      ? "#E4EDE6"
                                      : "#EDF3EE",
                                    borderWidth: 1,
                                    borderColor: isVerifiedUser
                                      ? "#C8DCCF"
                                      : "#DCE6DF",
                                    borderRadius: 6,
                                    paddingHorizontal: 7,
                                    paddingVertical: 1.5,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: "700",
                                      color: isVerifiedUser
                                        ? "#2A734D"
                                        : "#34594A",
                                      textTransform: "capitalize",
                                    }}
                                  >
                                    {isCurrentUser && isRSBSAVerified
                                      ? "RSBSA Verified Farmer"
                                      : post.authorRole}
                                  </Text>
                                </View>
                              </View>
                              <View className="flex-row items-center mt-0.5">
                                {Boolean(
                                  post.location &&
                                    post.location.trim().length > 0 &&
                                    post.location !== "Mill Creek Valley, CA",
                                ) && (
                                  <>
                                    <Ionicons
                                      name="location"
                                      size={12}
                                      color="#34594A"
                                    />
                                    <Text
                                      style={{
                                        fontSize: 11.5,
                                        color: "#75867B",
                                        marginLeft: 2,
                                        marginRight: 6,
                                        fontWeight: "500",
                                      }}
                                    >
                                      {post.location} •
                                    </Text>
                                  </>
                                )}
                                <Text
                                  style={{
                                    fontSize: 11.5,
                                    color: "#75867B",
                                    marginRight: 6,
                                    fontWeight: "500",
                                  }}
                                >
                                  {post.timeAgo}
                                </Text>
                                <Ionicons
                                  name={
                                    post.privacy === "Friends"
                                      ? "people-outline"
                                      : post.privacy === "Only me"
                                      ? "lock-closed-outline"
                                      : "globe-outline"
                                  }
                                  size={12}
                                  color="#879386"
                                />
                              </View>
                            </View>
                          </View>

                          {/* 3-dots post options */}
                          <TouchableOpacity
                            onPress={() => handleOpenPostOptions(post)}
                            className="p-1.5 active:opacity-60"
                            accessibilityRole="button"
                            accessibilityLabel="Post options"
                          >
                            <Ionicons
                              name="ellipsis-horizontal"
                              size={20}
                              color="#879386"
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Post Content */}
                        {!!post.content && (
                          <Text
                            style={{
                              color: "#23382D",
                              fontSize: 14.5,
                              lineHeight: 21,
                              marginBottom: 10,
                            }}
                          >
                            {post.content}
                          </Text>
                        )}

                        {/* Shared Post: Embedded Original Post Card */}
                        {post.isShared && post.originalPost ? (
                          <View className="border border-gray-200 rounded-xl p-3 bg-gray-50/80 mb-3">
                            <View className="flex-row items-center mb-2">
                              <View className="h-8 w-8 rounded-full border border-gray-300 items-center justify-center bg-gray-200 mr-2.5 overflow-hidden">
                                {post.originalPost.avatarUri ? (
                                  <Image
                                    source={{ uri: post.originalPost.avatarUri }}
                                    style={{ width: "100%", height: "100%" }}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <Ionicons
                                    name="person"
                                    size={16}
                                    color="#6b7280"
                                  />
                                )}
                              </View>
                              <View>
                                <View className="flex-row items-center flex-wrap">
                                  <Text className="font-bold text-gray-900 text-sm mr-1.5">
                                    {post.originalPost.authorName}
                                  </Text>
                                  {post.originalPost.isVerified && (
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={13}
                                      color="#10B981"
                                      style={{ marginRight: 4 }}
                                    />
                                  )}
                                  <Text className="text-gray-500 text-[10px] font-semibold bg-gray-200 px-1.5 py-0.5 rounded">
                                    {post.originalPost.authorRole}
                                  </Text>
                                </View>
                                <Text className="text-[11px] text-gray-400 mt-0.5">
                                  {Boolean(
                                    post.originalPost.location &&
                                      post.originalPost.location.trim().length > 0 &&
                                      post.originalPost.location !== "Mill Creek Valley, CA",
                                  )
                                    ? `${post.originalPost.location} • ${post.originalPost.timeAgo}`
                                    : post.originalPost.timeAgo}
                                </Text>
                              </View>
                            </View>

                            {!!post.originalPost.content && (
                              <Text className="text-gray-700 text-sm mb-2 leading-5">
                                {post.originalPost.content}
                              </Text>
                            )}

                            {post.originalPost.imageUrl || (post.originalPost.images && post.originalPost.images.length > 0) ? (
                              <PostImageGrid
                                images={post.originalPost.images}
                                fallbackImageUrl={post.originalPost.imageUrl}
                                onPressImage={(clickedUri, clickedIdx) =>
                                  handleOpenPreview({
                                    uri: clickedUri,
                                    images:
                                      post.originalPost?.images && post.originalPost.images.length > 0
                                        ? post.originalPost.images
                                        : post.originalPost?.imageUrl
                                          ? [post.originalPost.imageUrl]
                                          : [],
                                    initialIndex: clickedIdx,
                                    caption: post.originalPost!.content,
                                    authorName: post.originalPost!.authorName,
                                    timeAgo: post.originalPost!.timeAgo,
                                    postId: post.id,
                                    authorRole: post.authorRole,
                                    avatarUri: post.avatarUri,
                                    isVerified: post.isVerified,
                                    likes: post.likes,
                                    comments: post.comments,
                                    shares: post.shares,
                                    isLiked: post.isLiked,
                                    isSaved: post.isSaved,
                                  })
                                }
                              />
                            ) : null}
                          </View>
                        ) : (
                          /* Standard Post Images */
                          (post.images && post.images.length > 0) || post.imageUrl ? (
                            <PostImageGrid
                              images={post.images}
                              fallbackImageUrl={post.imageUrl}
                              onPressImage={(clickedUri, clickedIdx) =>
                                handleOpenPreview({
                                  uri: clickedUri,
                                  images:
                                    post.images && post.images.length > 0
                                      ? post.images
                                      : post.imageUrl
                                        ? [post.imageUrl]
                                        : [],
                                  initialIndex: clickedIdx,
                                  caption: post.content,
                                  authorName: post.authorName,
                                  timeAgo: post.timeAgo,
                                  postId: post.id,
                                  authorRole: post.authorRole,
                                  avatarUri: post.avatarUri,
                                  isVerified: post.isVerified,
                                  likes: post.likes,
                                  comments: post.comments,
                                  shares: post.shares,
                                  isLiked: post.isLiked,
                                  isSaved: post.isSaved,
                                })
                              }
                            />
                          ) : null
                        )}

                        {/* Interaction Bar */}
                        <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
                          <View className="flex-row gap-6">
                            {/* Like Button */}
                            <TouchableOpacity
                              onPress={() => handleQuickLike(post.id)}
                              className="flex-row items-center gap-1.5 active:opacity-70"
                            >
                              {post.isLiked ? (
                                <>
                                  <Ionicons
                                    name="heart"
                                    size={24}
                                    color="#EF4444"
                                  />
                                  <Text className="font-bold text-sm text-[#EF4444]">
                                    {post.likes}
                                  </Text>
                                </>
                              ) : (
                                <>
                                  <Ionicons
                                    name="heart-outline"
                                    size={24}
                                    color="#6b7280"
                                  />
                                  <Text className="font-medium text-gray-500">
                                    {post.likes}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>

                            {/* Comment Button (Opens Lightbox Modal with Comments Sheet) */}
                            <TouchableOpacity
                              onPress={() => toggleExpandComments(post.id)}
                              className="flex-row items-center gap-1.5 active:opacity-70"
                            >
                              <Ionicons
                                name="chatbubble-outline"
                                size={22}
                                color="#6b7280"
                              />
                              <Text className="font-medium text-gray-500">
                                {postComments[post.id] !== undefined
                                  ? postComments[post.id].length
                                  : post.comments}
                              </Text>
                            </TouchableOpacity>

                            {/* Share Button */}
                            <TouchableOpacity
                              onPress={() => handleToggleShare(post.id)}
                              className="flex-row items-center gap-1.5 active:opacity-70"
                            >
                              <Ionicons
                                name="share-social-outline"
                                size={22}
                                color="#6b7280"
                              />
                              <Text className="font-medium text-gray-500">
                                {post.shares}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Save/Bookmark Button */}
                          <TouchableOpacity
                            onPress={() => handleToggleSavePost(post.id)}
                            className="active:opacity-70 p-0.5"
                            accessibilityRole="button"
                            accessibilityLabel="Save post"
                          >
                            <Ionicons
                              name={
                                isBookmarked ? "bookmark" : "bookmark-outline"
                              }
                              size={24}
                              color={isBookmarked ? "#34594A" : "#6b7280"}
                            />
                          </TouchableOpacity>
                        </View>

                        {/* View all comments trigger (Opens Lightbox Modal) */}
                        {((postComments[post.id] !== undefined
                          ? postComments[post.id].length
                          : post.comments) > 0) && (
                          <TouchableOpacity
                            onPress={() => toggleExpandComments(post.id)}
                            className="mt-2.5 active:opacity-70"
                          >
                            <Text className="text-xs font-semibold text-gray-500 hover:text-[#34594A]">
                              View all{" "}
                              {postComments[post.id] !== undefined
                                ? postComments[post.id].length
                                : post.comments}{" "}
                              {(postComments[post.id] !== undefined
                                ? postComments[post.id].length
                                : post.comments) === 1
                                ? "comment"
                                : "comments"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {activeTab === "about" && (
          <View className="p-6 bg-white">
            {isEditingAbout ? (
              /* Inline Edit Mode (Separated from personal info) */
              <View>
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  Edit About
                </Text>
                <View className="border border-[#34594A] rounded-xl p-3 bg-[#FAFBF9] mb-3">
                  <TextInput
                    value={aboutInput}
                    onChangeText={setAboutInput}
                    multiline={true}
                    numberOfLines={4}
                    placeholder="Write something about yourself or farm..."
                    placeholderTextColor="#9CA3AF"
                    className="text-sm text-gray-800 p-0"
                    style={{ minHeight: 90, textAlignVertical: "top" }}
                    autoFocus={true}
                  />
                </View>

                <View className="flex-row items-center gap-2.5 justify-end">
                  <TouchableOpacity
                    onPress={() => {
                      setAboutInput(user?.about || user?.bio || "");
                      setIsEditingAbout(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-gray-100 active:bg-gray-200"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel edit"
                  >
                    <Text className="text-sm font-semibold text-gray-700">
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSaveAbout}
                    disabled={isSavingAbout}
                    style={{ backgroundColor: "#34594A" }}
                    className="px-5 py-2 rounded-xl flex-row items-center gap-1.5 active:opacity-85"
                    accessibilityRole="button"
                    accessibilityLabel="Save about"
                  >
                    {isSavingAbout ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text className="text-sm font-bold text-white">Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* View Mode with Separate Edit Button */
              <View>
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  About {profileName}
                </Text>
                <Text className="text-sm text-gray-700 leading-6">
                  {(isOwnProfile
                    ? user?.about || user?.bio
                    : params.userAbout || params.userBio) ||
                    (farmDetails?.farmName
                      ? `Welcome to ${farmDetails.farmName}! ${farmDetails.primaryCrops ? `Specializing in ${farmDetails.primaryCrops}. ` : ""}Committed to providing fresh, organic, and locally grown farm products.`
                      : rsbsaApp?.farmName
                      ? `Welcome to ${rsbsaApp.farmName}! Committed to providing fresh, organic, and locally grown farm products.`
                      : isOwnProfile
                      ? "No description added yet. Tap Edit below to write something about yourself or your farm."
                      : "No description provided yet.")}
                </Text>

                {/* Separate Edit Button */}
                {isOwnProfile && (
                  <TouchableOpacity
                    onPress={() => {
                      setAboutInput(user?.about || user?.bio || "");
                      setIsEditingAbout(true);
                    }}
                    style={{ backgroundColor: "#34594A" }}
                    className="mt-4 w-full rounded-xl py-2.5 flex-row items-center justify-center gap-2 active:opacity-85"
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Edit about"
                  >
                    <Ionicons name="create-outline" size={16} color="#ffffff" />
                    <Text className="text-md font-semibold text-white">
                      Edit
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Facebook-style Share Post Modal */}
      <SharePostModal
        visible={shareModalPost !== null}
        post={shareModalPost}
        onClose={() => setShareModalPost(null)}
        onShareSuccess={handleShareSuccess}
        onShowToast={showToast}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        isVisible={isCreatePostVisible}
        onClose={() => setCreatePostVisible(false)}
        onPost={handleNewPostCreated}
      />

      {/* Standalone Expandable Comments Drawer Modal */}
      {activeCommentsPostId && (() => {
        const currentComments = postComments[activeCommentsPostId] || [];

        return (
          <Modal
            visible={!!activeCommentsPostId}
            transparent={true}
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={() => {
              setActiveCommentsPostId(null);
              setReplyingTo(null);
            }}
          >
            <View className="flex-1 bg-black/60 justify-end">
              {/* Backdrop Pressable */}
              <Pressable
                className="absolute inset-0"
                onPress={() => {
                  setActiveCommentsPostId(null);
                  setReplyingTo(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Close comments backdrop"
              />

              <Animated.View
                style={{
                  height: Dimensions.get("window").height * 0.72,
                  maxHeight: "85%",
                  elevation: 25,
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: -6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  transform: [{ translateY: standaloneCommentsTranslateY }],
                  backgroundColor: "#FFFFFF",
                }}
                className="bg-white rounded-t-3xl flex-col overflow-hidden w-full"
              >
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : undefined}
                  keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
                  style={{ flex: 1, backgroundColor: "#FFFFFF" }}
                  className="flex-1 flex-col bg-white"
                >
                  {/* Drawer Drag Handle & Header (Swipe down to close) */}
                  <View
                    {...standaloneCommentsPanResponder.panHandlers}
                    style={{ backgroundColor: "#FFFFFF" }}
                    className="pt-3 pb-2.5 px-5 border-b border-gray-100 bg-white"
                  >
                    <View className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-2" />
                    <Text className="text-base font-bold text-gray-900 text-center">
                      Comments
                    </Text>
                  </View>

                {/* Comments List */}
                <ScrollView
                  style={{ flex: 1, backgroundColor: "#FFFFFF" }}
                  className="flex-1 px-4 py-3 bg-white"
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 24, backgroundColor: "#FFFFFF" }}
                >
                  {loadingComments[activeCommentsPostId] ? (
                    <View className="py-16 items-center justify-center">
                      <ActivityIndicator size="small" color="#34594A" />
                      <Text className="text-xs text-gray-400 mt-2 font-medium">
                        Loading comments...
                      </Text>
                    </View>
                  ) : currentComments.length === 0 ? (
                    <View className="py-16 items-center justify-center px-6">
                      <View className="w-14 h-14 rounded-full bg-[#EDF3EE] items-center justify-center mb-3">
                        <Ionicons
                          name="chatbubbles-outline"
                          size={28}
                          color="#34594A"
                        />
                      </View>
                      <Text className="text-sm font-bold text-gray-800">
                        No comments yet
                      </Text>
                      <Text className="text-xs text-gray-400 text-center mt-1">
                        Be the first to share your thoughts!
                      </Text>
                    </View>
                  ) : (
                    (() => {
                      const getThreadReplies = (
                        parentId: string,
                        all: CommentItem[],
                      ): CommentItem[] => {
                        const direct = all.filter((c) => c.parentId === parentId);
                        const result: CommentItem[] = [];
                        for (const item of direct) {
                          result.push(item);
                          result.push(...getThreadReplies(item.id, all));
                        }
                        return result;
                      };

                      const rootComments = currentComments.filter(
                        (c) =>
                          !c.parentId ||
                          !currentComments.some((p) => p.id === c.parentId),
                      );

                      return rootComments.map((rootComment) => {
                        const childReplies = getThreadReplies(
                          rootComment.id,
                          currentComments,
                        );
                        const areRepliesExpanded =
                          !!expandedReplyCommentIds[rootComment.id];

                        const renderCommentItem = (
                          comment: CommentItem,
                          isReply: boolean,
                        ) => {
                          const currentCommentReaction =
                            commentReactions[comment.id];
                          const hasCommentReaction =
                            Boolean(currentCommentReaction) || comment.isLiked;
                          const commentLikesCount = comment.likes;

                          return (
                            <View
                              key={comment.id}
                              className={`flex-row items-start mb-3.5 relative ${
                                isReply
                                  ? "ml-10 pl-3 border-l-2 border-gray-200 mt-1"
                                  : ""
                              }`}
                            >
                              {/* Avatar */}
                              <View
                                className={`${
                                  isReply ? "h-7 w-7" : "h-8 w-8"
                                } rounded-full mr-2.5 bg-gray-200 items-center justify-center overflow-hidden border border-gray-100`}
                              >
                                {comment.avatarUri ? (
                                  <Image
                                    source={{ uri: comment.avatarUri }}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                    }}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <Ionicons
                                    name="person"
                                    size={isReply ? 13 : 15}
                                    color="#9CA3AF"
                                  />
                                )}
                              </View>

                              {/* Content */}
                              <View className="flex-1">
                                {/* Author Row */}
                                <View className="flex-row justify-between items-center mb-0.5">
                                  <View className="flex-row items-center gap-1">
                                    <Text
                                      className={`${
                                        isReply ? "text-xs" : "text-sm"
                                      } font-bold text-gray-900`}
                                    >
                                      {comment.authorName}
                                    </Text>
                                    {(comment.isVerified ||
                                      ((Boolean(
                                        user?.id &&
                                          comment.userId === String(user.id),
                                      ) ||
                                        comment.authorName === user?.name ||
                                        comment.authorName ===
                                          user?.username) &&
                                        isRSBSAVerified)) && (
                                      <Ionicons
                                        name="checkmark-circle"
                                        size={13}
                                        color="#10B981"
                                      />
                                    )}
                                  </View>
                                  <Text className="text-[11px] text-gray-400">
                                    {comment.timeAgo}
                                  </Text>
                                </View>

                                {/* Comment Text */}
                                <Text className="text-sm text-gray-700 leading-5">
                                  {comment.content}
                                </Text>

                                {/* Interaction Row */}
                                <View className="flex-row items-center gap-4 mt-1.5">
                                  {/* Like button */}
                                  <TouchableOpacity
                                    onPress={() =>
                                      handleToggleCommentLike(
                                        activeCommentsPostId,
                                        comment.id,
                                      )
                                    }
                                    className="flex-row items-center gap-1 active:opacity-70"
                                    hitSlop={{
                                      top: 6,
                                      bottom: 6,
                                      left: 6,
                                      right: 6,
                                    }}
                                  >
                                    <Ionicons
                                      name={
                                        hasCommentReaction
                                          ? "heart"
                                          : "heart-outline"
                                      }
                                      size={15}
                                      color={
                                        hasCommentReaction
                                          ? "#EF4444"
                                          : "#6B7280"
                                      }
                                    />
                                    <Text
                                      className={`text-xs ${
                                        hasCommentReaction
                                          ? "text-[#EF4444] font-bold"
                                          : "text-gray-500 font-medium"
                                      }`}
                                    >
                                      {commentLikesCount}
                                    </Text>
                                  </TouchableOpacity>

                                  {/* Reply trigger */}
                                  <TouchableOpacity
                                    onPress={() => {
                                      setReplyingTo({
                                        commentId: comment.id,
                                        username: comment.authorName,
                                      });
                                      commentInputRef.current?.focus();
                                    }}
                                    className="active:opacity-70 py-0.5"
                                    hitSlop={{
                                      top: 8,
                                      bottom: 8,
                                      left: 8,
                                      right: 8,
                                    }}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      className="text-xs text-gray-500 font-medium hover:text-[#34594A]"
                                    >
                                      Reply
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          );
                        };

                        return (
                          <View key={rootComment.id}>
                            {renderCommentItem(rootComment, false)}

                            {childReplies.length > 0 &&
                              !areRepliesExpanded && (
                                <TouchableOpacity
                                  onPress={() =>
                                    toggleRepliesVisibility(rootComment.id)
                                  }
                                  style={{ flexWrap: "nowrap" }}
                                  className="flex-row items-center ml-10 py-1.5 mb-2 active:opacity-70 self-start"
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <View className="w-5 h-[1.5px] bg-[#34594A] mr-2 rounded-full" />
                                  <Text
                                    numberOfLines={1}
                                    style={{ flexShrink: 0 }}
                                    className="text-xs font-bold text-[#34594A]"
                                  >
                                    {childReplies.length === 1
                                      ? "View 1 reply"
                                      : `View all ${childReplies.length} replies`}
                                  </Text>
                                  <Ionicons
                                    name="chevron-down"
                                    size={13}
                                    color="#34594A"
                                    style={{ marginLeft: 4 }}
                                  />
                                </TouchableOpacity>
                              )}

                            {childReplies.length > 0 &&
                              areRepliesExpanded && (
                                <View className="mb-1">
                                  {childReplies.map((reply) =>
                                    renderCommentItem(reply, true),
                                  )}
                                  <TouchableOpacity
                                    onPress={() =>
                                      toggleRepliesVisibility(rootComment.id)
                                    }
                                    style={{ flexWrap: "nowrap" }}
                                    className="flex-row items-center ml-10 py-1.5 mb-2 active:opacity-70 self-start"
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <View className="w-5 h-[1.5px] bg-gray-300 mr-2 rounded-full" />
                                    <Text
                                      numberOfLines={1}
                                      style={{ flexShrink: 0 }}
                                      className="text-xs font-semibold text-gray-500 hover:text-[#34594A]"
                                    >
                                      Hide replies
                                    </Text>
                                    <Ionicons
                                      name="chevron-up"
                                      size={13}
                                      color="#9CA3AF"
                                      style={{ marginLeft: 4 }}
                                    />
                                  </TouchableOpacity>
                                </View>
                              )}
                          </View>
                        );
                      });
                    })()
                  )}
                </ScrollView>

                {/* Bottom Pinned Comment Input Section */}
                <View
                  style={{
                    paddingBottom: Math.max(insets.bottom, 12) + 6,
                    backgroundColor: "#FFFFFF",
                  }}
                  className="px-4 pt-2.5 border-t border-gray-200 bg-white"
                >
                  {replyingTo && (
                    <View className="bg-[#EDF3EE] border border-[#DCE6DF] px-3.5 py-1.5 flex-row justify-between items-center rounded-t-xl border-b-0 mb-1">
                      <View className="flex-row items-center gap-1.5 flex-1 pr-2">
                        <Ionicons
                          name="return-down-forward"
                          size={14}
                          color="#34594A"
                        />
                        <Text
                          className="text-xs text-gray-700"
                          numberOfLines={1}
                        >
                          Replying to{" "}
                          <Text className="font-bold text-gray-900">
                            @{replyingTo.username}
                          </Text>
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setReplyingTo(null)}
                        className="p-1 active:opacity-70"
                        accessibilityRole="button"
                        accessibilityLabel="Cancel reply"
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View
                    className={`bg-gray-50 border border-gray-200 px-4 py-2 flex-row items-center shadow-xs ${
                      replyingTo ? "rounded-b-xl rounded-t-none" : "rounded-full"
                    }`}
                  >
                    <TextInput
                      ref={commentInputRef}
                      value={commentInputs[activeCommentsPostId] || ""}
                      onChangeText={(text) =>
                        setCommentInputs((prev) => ({
                          ...prev,
                          [activeCommentsPostId]: text,
                        }))
                      }
                      placeholder={
                        replyingTo
                          ? `Reply to @${replyingTo.username}...`
                          : "Add a comment..."
                      }
                      placeholderTextColor="#9CA3AF"
                      className="flex-1 text-sm text-gray-800 p-0"
                      onSubmitEditing={() =>
                        handleAddComment(activeCommentsPostId)
                      }
                      returnKeyType="send"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        handleAddComment(activeCommentsPostId)
                      }
                      disabled={
                        !(commentInputs[activeCommentsPostId] || "").trim() ||
                        submittingComments[activeCommentsPostId]
                      }
                      className={`ml-2 p-2 rounded-full items-center justify-center min-w-[32px] min-h-[32px] ${
                        (commentInputs[activeCommentsPostId] || "").trim() &&
                        !submittingComments[activeCommentsPostId]
                          ? "bg-[#34594A] active:opacity-85"
                          : "bg-gray-200 opacity-60"
                      }`}
                    >
                      {submittingComments[activeCommentsPostId] ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="send" size={14} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
              </Animated.View>
            </View>
          </Modal>
        );
      })()}

      {/* Fullscreen Image Lightbox Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={handleCloseLightbox}
      >
        {(() => {
          if (!previewImage) return null;
          const imagesList =
            previewImage.images && previewImage.images.length > 0
              ? previewImage.images
              : previewImage.uri
                ? [previewImage.uri]
                : previewImage.source
                  ? [previewImage.source]
                  : [];

          return (
            <View className="flex-1 bg-black/95 justify-between relative">
              {/* Top Bar with Pagination Counter & Close Button */}
              <View
                style={{ paddingTop: Math.max(insets.top, 16) + 8 }}
                className="px-4 pb-3 flex-row items-center justify-between z-20"
              >
                {imagesList.length > 1 ? (
                  <View className="bg-white/20 px-3 py-1 rounded-full">
                    <Text className="text-white text-xs font-semibold">
                      {(previewImage.currentIndex ?? 0) + 1} / {imagesList.length}
                    </Text>
                  </View>
                ) : (
                  <View className="w-10" />
                )}

                <TouchableOpacity
                  onPress={handleCloseLightbox}
                  className="w-10 h-10 rounded-full bg-white/20 items-center justify-center active:bg-white/30"
                  accessibilityRole="button"
                  accessibilityLabel="Close image preview"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Horizontal Swipeable Image Gallery (Slide Left / Right) */}
              <View className="flex-1 justify-center relative">
                <FlatList
                  ref={lightboxListRef}
                  data={imagesList}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  initialScrollIndex={
                    previewImage.currentIndex &&
                    previewImage.currentIndex >= 0 &&
                    previewImage.currentIndex < imagesList.length
                      ? previewImage.currentIndex
                      : 0
                  }
                  getItemLayout={(_, index) => ({
                    length: screenWidth,
                    offset: screenWidth * index,
                    index,
                  })}
                  onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                      lightboxListRef.current?.scrollToOffset({
                        offset: info.index * screenWidth,
                        animated: false,
                      });
                    }, 50);
                  }}
                  onMomentumScrollEnd={(e) => {
                    const offsetX = e.nativeEvent.contentOffset.x;
                    const newIdx = Math.round(offsetX / screenWidth);
                    if (
                      newIdx >= 0 &&
                      newIdx < imagesList.length &&
                      newIdx !== previewImage.currentIndex
                    ) {
                      setPreviewImage((prev) =>
                        prev ? { ...prev, currentIndex: newIdx } : null,
                      );
                    }
                  }}
                  keyExtractor={(_, idx) => `lightbox-profile-img-${idx}`}
                  renderItem={({ item }) => (
                    <Pressable
                      style={{ width: screenWidth }}
                      className="flex-1 items-center justify-center px-2"
                      onPress={handleCloseLightbox}
                    >
                      <Image
                        source={typeof item === "string" ? { uri: item } : item}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                    </Pressable>
                  )}
                />
              </View>

              {/* Dot Indicators for multi-image gallery */}
              {imagesList.length > 1 && (
                <View className="flex-row justify-center items-center gap-1.5 pb-2 z-20">
                  {imagesList.map((_, dotIdx) => (
                    <View
                      key={dotIdx}
                      className={`h-1.5 rounded-full ${
                        dotIdx === (previewImage.currentIndex ?? 0)
                          ? "w-5 bg-white"
                          : "w-1.5 bg-white/40"
                      }`}
                    />
                  ))}
                </View>
              )}

              {/* Bottom Caption (if available) */}
              {previewImage?.caption ? (
                <View
                  style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}
                  className="bg-black/75 border-t border-white/10 z-10 px-5 pt-3 pb-2"
                >
                  <ScrollView
                    style={{ maxHeight: 90 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text className="text-white/95 text-sm leading-5">
                      {previewImage.caption}
                    </Text>
                  </ScrollView>
                </View>
              ) : null}
            </View>
          );
        })()}
      </Modal>

      {/* Share Profile Modal */}
      <ShareProfileModal
        visible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        username={
          isOwnProfile
            ? "@NATHANSALVEDIA"
            : `@${profileName.toUpperCase().replace(/\s+/g, "")}`
        }
        onShowToast={showToast}
      />

      {/* Cover Photo Selection Modal (Bottom Sheet / Lower Corner) */}
      <Modal
        visible={isCoverModalVisible}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setIsCoverModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-transparent"
          onPress={() => setIsCoverModalVisible(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-3xl pt-3 px-5 border-t border-l border-r border-gray-200"
            style={{
              paddingBottom: Math.max(insets.bottom, 16) + 12,
              elevation: 8,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
            }}
          >
            {/* Drag Indicator Handle */}
            <View className="items-center mb-3">
              <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </View>

            {/* Header */}
            <View className="flex-row justify-between items-center mb-3 pb-2.5 border-b border-gray-100">
              <View>
                <Text className="text-lg font-bold text-gray-900">
                  Change Cover Photo
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Update the banner on your profile
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCoverModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
                accessibilityRole="button"
                accessibilityLabel="Close cover photo modal"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View className="gap-2.5 my-1">
              {/* Option 1: See cover photo */}
              <TouchableOpacity
                onPress={() => {
                  setIsCoverModalVisible(false);
                  setTimeout(() => {
                    setIsViewingCoverPhoto(true);
                  }, 250);
                }}
                activeOpacity={0.7}
                className="flex-row items-center p-3.5 bg-gray-50 rounded-2xl border border-gray-100 active:bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="See cover photo"
              >
                <View className="w-11 h-11 rounded-full bg-purple-50 items-center justify-center mr-3.5 border border-purple-100">
                  <Ionicons name="eye-outline" size={22} color="#7C3AED" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    See cover photo
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    View your cover photo in full screen
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              {/* Option 2: Choose from Library */}
              <TouchableOpacity
                onPress={() => {
                  setIsCoverModalVisible(false);
                  pickCoverFromGallery();
                }}
                activeOpacity={0.7}
                className="flex-row items-center p-3.5 bg-gray-50 rounded-2xl border border-gray-100 active:bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="Choose from Library"
              >
                <View className="w-11 h-11 rounded-full bg-[#EDF3EE] items-center justify-center mr-3.5">
                  <Ionicons name="images" size={22} color="#34594A" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    Choose from Library
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Select a photo from your gallery
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              {/* Option 2: Take Photo */}
              <TouchableOpacity
                onPress={() => {
                  setIsCoverModalVisible(false);
                  takeCoverPhoto();
                }}
                activeOpacity={0.7}
                className="flex-row items-center p-3.5 bg-gray-50 rounded-2xl border border-gray-100 active:bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="Take Photo"
              >
                <View className="w-11 h-11 rounded-full bg-blue-50 items-center justify-center mr-3.5">
                  <Ionicons name="camera" size={22} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    Take Photo
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Snap a new photo with your camera
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              {/* Option 3: Reset to Default (if custom photo is set) */}
              {coverPhotoUri !== DEFAULT_COVER_PHOTO && (
                <TouchableOpacity
                  onPress={handleResetCoverPhoto}
                  activeOpacity={0.7}
                  className="flex-row items-center p-3.5 bg-red-50/70 rounded-2xl border border-red-100 active:bg-red-100"
                  accessibilityRole="button"
                  accessibilityLabel="Reset to Default"
                >
                  <View className="w-11 h-11 rounded-full bg-red-100 items-center justify-center mr-3.5">
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-red-600">
                      Reset to Default
                    </Text>
                    <Text className="text-xs text-red-500/80 mt-0.5">
                      Remove custom banner and use default
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#fca5a5" />
                </TouchableOpacity>
              )}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => setIsCoverModalVisible(false)}
              activeOpacity={0.8}
              className="mt-3 bg-gray-100 py-3 rounded-2xl active:bg-gray-200 items-center"
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text className="text-sm font-semibold text-gray-700">
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full-Screen Cover Photo Viewer Modal */}
      <Modal
        visible={isViewingCoverPhoto}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setIsViewingCoverPhoto(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000000" }}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Top Bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 14,
                zIndex: 10,
              }}
            >
              <TouchableOpacity
                onPress={() => setIsViewingCoverPhoto(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontWeight: "700",
                  letterSpacing: 0.2,
                }}
              >
                Cover Photo
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Photo Center */}
            <Pressable
              onPress={() => setIsViewingCoverPhoto(false)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
            >
              <Image
                source={{
                  uri: isOwnProfile ? coverPhotoUri : DEFAULT_COVER_PHOTO,
                }}
                style={{
                  width: "100%",
                  height: 280,
                }}
                resizeMode="contain"
              />
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>

      

      {/* Bottom Navigation Component */}
      <BottomNavBar premium activeTab="Menu" showFab={false} />

      {/* Profile Options Bottom Sheet */}
      {isOptionsOpen && (
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          enableDynamicSizing={true}
          enablePanDownToClose={true}
          onClose={() => setIsOptionsOpen(false)}
          onChange={(index: number) => {
            if (index === -1) {
              setIsOptionsOpen(false);
            }
          }}
          backdropComponent={renderBackdrop}
          containerStyle={{ zIndex: 100, elevation: 100 }}
          style={{ zIndex: 100, elevation: 100 }}
          backgroundStyle={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
          handleIndicatorStyle={{
            backgroundColor: "#D1D5DB",
            width: 44,
            height: 4.5,
            borderRadius: 3,
          }}
        >
          <BottomSheetView
            style={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            }}
          >
            {/* Sheet Header */}
            <View className="items-center pb-3 mb-2 border-b border-gray-100">
              <Text className="text-base font-bold text-gray-900">
                Profile Options
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                {profileName}
              </Text>
            </View>

            {/* Action Items */}
            <View>
              {/* Not Interested */}
              <TouchableOpacity
                onPress={handleRestrict}
                activeOpacity={0.7}
                className="flex-row items-center py-3.5 px-2.5 rounded-xl active:bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="Not interested"
              >
                <View className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center mr-3.5">
                  <Ionicons name="eye-off-outline" size={21} color="#374151" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    Not Interested
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {"We won't suggest this account to you again"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Block */}
              <TouchableOpacity
                onPress={handleBlock}
                activeOpacity={0.7}
                className="flex-row items-center py-3.5 px-2.5 rounded-xl active:bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="Block account"
              >
                <View className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center mr-3.5">
                  <Ionicons name="ban-outline" size={21} color="#374151" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    Block
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {"They won't be able to find your profile or message you"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Report (styled in red) */}
              <TouchableOpacity
                onPress={handleReport}
                activeOpacity={0.7}
                className="flex-row items-center py-3.5 px-2.5 rounded-xl active:bg-red-50"
                accessibilityRole="button"
                accessibilityLabel="Report account"
              >
                <View className="w-11 h-11 rounded-full bg-red-100 items-center justify-center mr-3.5">
                  <Ionicons
                    name="alert-circle-outline"
                    size={21}
                    color="#DC2626"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-red-600">
                    Report
                  </Text>
                  <Text className="text-xs text-red-500/80 mt-0.5">
                    Report profile for community guideline violations
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Copy profile link */}
              <TouchableOpacity
                onPress={handleCopyProfileUrl}
                activeOpacity={0.7}
                className="flex-row items-center py-3.5 px-2.5 rounded-xl active:bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="Copy profile link"
              >
                <View className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center mr-3.5">
                  <Ionicons name="link-outline" size={21} color="#374151" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    Copy profile link
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Copy link to this profile
                  </Text>
                </View>
              </TouchableOpacity>

              {/* About this account */}
              <TouchableOpacity
                onPress={handleAboutThisAccount}
                activeOpacity={0.7}
                className="flex-row items-center py-3.5 px-2.5 rounded-xl active:bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="About this account"
              >
                <View className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center mr-3.5">
                  <Ionicons
                    name="information-circle-outline"
                    size={21}
                    color="#374151"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    About this account
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    See account details and verification info
                  </Text>
                </View>
              </TouchableOpacity>

              {/* QR code */}
              <TouchableOpacity
                onPress={() => {
                  bottomSheetRef.current?.close();
                  setIsShareModalVisible(true);
                }}
                activeOpacity={0.7}
                className="flex-row items-center py-3.5 px-2.5 rounded-xl active:bg-gray-100"
                accessibilityRole="button"
                accessibilityLabel="QR code"
              >
                <View className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center mr-3.5">
                  <Ionicons name="qr-code-outline" size={21} color="#374151" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900">
                    QR code
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Let others scan to find this account
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </BottomSheetView>
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}

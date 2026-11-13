import { useToast } from "@/context/toast-context";
import { useAuth } from "@/hooks/use-auth";
import {
  getFriendsApi,
  searchUsersToConnectApi,
} from "@/services/connection-service";
import {
  getCurrentDeviceLocation,
  LocationSearchResult,
  POPULAR_FARM_LOCATIONS,
  reverseGeocodeApi,
  searchLocationsApi,
} from "@/services/location-service";
import { createPostApi, PostItem } from "@/services/post-service";
import {
  getRSBSAApplication,
  RSBSAApplication,
  setRSBSAStatus,
} from "@/services/rsbsa-service";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import LeafletMap from "./LeafletMap";
import LiveBroadcasterModal from "./LiveBroadcasterModal";

export interface CreatePostModalProps {
  isVisible: boolean;
  onClose: () => void;
  onPost?: (post: PostItem) => void;
}

type ViewMode =
  | "POST_FORM"
  | "PRIVACY"
  | "LIVE_PERMISSION"
  | "TAG_PEOPLE"
  | "ADD_LOCATION";

type PrivacyType = "Public" | "Friends" | "Only me";

interface PrivacyOption {
  id: PrivacyType;
  title: PrivacyType;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Friend {
  id: string;
  fullName: string;
  firstName: string;
  username?: string;
  avatarUrl?: string;
}

const CATEGORIES = ["Field", "Wholesaler", "Temporary"];

export interface TemporaryDurationOption {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

export const TEMPORARY_DURATIONS: TemporaryDurationOption[] = [
  {
    label: "6 Hours",
    value: 6 * 3600 * 1000,
    icon: "sunny-outline",
    description: "Morning market stall or short pop-up",
  },
  {
    label: "10 Hours",
    value: 10 * 3600 * 1000,
    icon: "timer-outline",
    description: "Day-long farm stand or fresh batch",
  },
  {
    label: "12 Hours",
    value: 12 * 3600 * 1000,
    icon: "time-outline",
    description: "Same-day harvest & daily clearance",
  },
  {
    label: "24 Hours",
    value: 24 * 3600 * 1000,
    icon: "hourglass-outline",
    description: "Full-day agricultural post",
  },
];

const PRIVACY_OPTIONS: PrivacyOption[] = [
  {
    id: "Public",
    title: "Public",
    icon: "globe",
  },
  {
    id: "Friends",
    title: "Friends",
    icon: "people",
  },
  {
    id: "Only me",
    title: "Only me",
    icon: "lock-closed",
  },
];

export interface StaticFarmingLocation {
  id: string;
  name: string;
  barangay: string;
  latitude: number;
  longitude: number;
  type: string;
}

export const STATIC_POST_LOCATIONS: StaticFarmingLocation[] = [
  {
    id: "palao",
    name: "Pala-o, Iligan City",
    barangay: "Pala-o",
    latitude: 8.2283,
    longitude: 124.2452,
    type: "🌿 Farm Market",
  },
  {
    id: "tipanoy",
    name: "Tipanoy, Iligan City",
    barangay: "Tipanoy",
    latitude: 8.212,
    longitude: 124.254,
    type: "🥛 Dairy & Dragonfruit",
  },
  {
    id: "delcarmen",
    name: "Del Carmen, Iligan City",
    barangay: "Del Carmen",
    latitude: 8.2345,
    longitude: 124.243,
    type: "📦 Grains & Produce",
  },
  {
    id: "tubod",
    name: "Tubod, Iligan City",
    barangay: "Tubod",
    latitude: 8.209,
    longitude: 124.237,
    type: "🍌 Fruit Depot",
  },
  {
    id: "luinab",
    name: "Luinab, Iligan City",
    barangay: "Luinab",
    latitude: 8.2235,
    longitude: 124.261,
    type: "🌱 Herb Garden",
  },
  {
    id: "tambo",
    name: "Tambo, Iligan City",
    barangay: "Tambo",
    latitude: 8.2435,
    longitude: 124.254,
    type: "🚜 Wholesale Hub",
  },
  {
    id: "ditucalan",
    name: "Ditucalan, Iligan City",
    barangay: "Ditucalan",
    latitude: 8.1819,
    longitude: 124.1936,
    type: "🥚 Free-Range Poultry",
  },
  {
    id: "abuno",
    name: "Abuno, Iligan City",
    barangay: "Abuno",
    latitude: 8.2165,
    longitude: 124.2495,
    type: "🥭 Fruit Orchard",
  },
];

export default function CreatePostModal({
  isVisible,
  onClose,
  onPost,
}: CreatePostModalProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeView, setActiveView] = useState<ViewMode>("POST_FORM");
  const [privacySetting, setPrivacySetting] = useState<PrivacyType>("Public");
  const [isDefaultAudience, setIsDefaultAudience] = useState(false);
  const [content, setContent] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Field");
  const [temporaryDuration, setTemporaryDuration] = useState<number>(
    24 * 3600 * 1000,
  );
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [searchedUsers, setSearchedUsers] = useState<Friend[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapCoords, setMapCoords] = useState<{
    latitude: number;
    longitude: number;
  }>({ latitude: 8.2283, longitude: 124.2452 });
  const [locationSearch, setLocationSearch] = useState("Pala-o, Iligan City");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [rsbsaApp, setRsbsaApp] = useState<RSBSAApplication | null>(null);
  const [showRsbsaLockModal, setShowRsbsaLockModal] = useState(false);
  const [showLiveBroadcaster, setShowLiveBroadcaster] = useState(false);

  const loadFriends = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      const res = await getFriendsApi();
      setFriendsList(
        res.map((f) => ({
          id: f.id,
          fullName: f.name,
          firstName: f.name.split(" ")[0] || f.name,
          username: f.username,
          avatarUrl: f.avatarUrl,
        })),
      );
    } catch (e) {
      console.warn("Error fetching friends for tag:", e);
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadFriends();
    }
  }, [isVisible, loadFriends]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchedUsers([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const results = await searchUsersToConnectApi(searchQuery.trim());
        setSearchedUsers(
          results.map((u) => ({
            id: u.id,
            fullName: u.name,
            firstName: u.name.split(" ")[0] || u.name,
            username: u.username,
            avatarUrl: u.avatarUrl,
          })),
        );
      } catch (e) {
        console.warn("User search error for tag:", e);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filteredFriends = useMemo(() => {
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      const matchedFriends = friendsList.filter(
        (f) =>
          f.fullName.toLowerCase().includes(queryLower) ||
          (f.username && f.username.toLowerCase().includes(queryLower)),
      );
      const friendIds = new Set(matchedFriends.map((f) => f.id));
      const matchedSearched = searchedUsers.filter((u) => !friendIds.has(u.id));
      return [...matchedFriends, ...matchedSearched];
    }
    return friendsList;
  }, [searchQuery, friendsList, searchedUsers]);

  const getFriendById = useCallback(
    (userId: string) => {
      return (
        friendsList.find((f) => f.id === userId) ||
        searchedUsers.find((f) => f.id === userId)
      );
    },
    [friendsList, searchedUsers],
  );

  // Debounced live location search
  useEffect(() => {
    if (!locationSearch || locationSearch.trim().length < 2) {
      setSearchResults([]);
      setIsSearchingLocation(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const results = await searchLocationsApi(locationSearch);
        setSearchResults(results);
      } catch (err) {
        console.warn("Location search error:", err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 380);

    return () => clearTimeout(timer);
  }, [locationSearch]);

  const handleMapLocationSelect = async (lat: number, lng: number) => {
    setMapCoords({ latitude: lat, longitude: lng });
    setShowSearchResults(false);
    setIsGeocoding(true);
    try {
      const address = await reverseGeocodeApi(lat, lng);
      setLocationSearch(address);
    } catch (err) {
      console.warn("Reverse geocode error:", err);
      setLocationSearch(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSelectSearchResult = (result: LocationSearchResult) => {
    setMapCoords({ latitude: result.latitude, longitude: result.longitude });
    setLocationSearch(result.name || result.fullName);
    setShowSearchResults(false);
  };

  const handleUseCurrentLocation = async () => {
    setIsLocatingGps(true);
    try {
      const loc = await getCurrentDeviceLocation();
      if (loc) {
        setMapCoords({ latitude: loc.latitude, longitude: loc.longitude });
        setIsGeocoding(true);
        const resolved = await reverseGeocodeApi(loc.latitude, loc.longitude);
        setLocationSearch(resolved);
        setShowSearchResults(false);
        showToast("Centered on your current location!", "success");
      } else {
        showToast(
          "Could not detect your current location. Please ensure GPS/location permissions are enabled.",
          "warning",
        );
      }
    } catch (err: any) {
      showToast(err?.message || "Location request failed.", "error");
    } finally {
      setIsGeocoding(false);
      setIsLocatingGps(false);
    }
  };

  // Swipe-down-to-dismiss animated gesture
  const [translateY] = useState(() => new Animated.Value(0));

  const handleClose = useCallback(() => {
    setShowRsbsaLockModal(false);
    setActiveView("POST_FORM");
    translateY.setValue(0);
    onClose();
  }, [onClose, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            gestureState.dy > 5 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
          );
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.8) {
            Animated.timing(translateY, {
              toValue: Dimensions.get("window").height,
              duration: 200,
              useNativeDriver: true,
            }).start(() => handleClose());
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [handleClose, translateY],
  );

  useEffect(() => {
    if (!isVisible) {
      translateY.setValue(0);
      setActiveView("POST_FORM");
    }
  }, [isVisible, translateY]);

  useEffect(() => {
    if (isVisible) {
      getRSBSAApplication()
        .then((app) => setRsbsaApp(app))
        .catch(() => setRsbsaApp(null));
    }
  }, [isVisible]);

  const isRSBSAVerified = rsbsaApp?.status === "verified";

  const handleOpenLive = () => {
    if (!isRSBSAVerified) {
      setShowRsbsaLockModal(true);
      return;
    }
    setActiveView("LIVE_PERMISSION");
  };

  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePostSubmit = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && selectedPhotos.length === 0) {
      showToast("Please enter some text or select a photo.", "info");
      return;
    }

    setIsSubmitting(true);
    try {
      const isTemp = selectedCategory === "Temporary";
      const expiresAt = isTemp ? Date.now() + temporaryDuration : null;
      const durationOpt = TEMPORARY_DURATIONS.find(
        (d) => d.value === temporaryDuration,
      );

      const newPost = await createPostApi({
        content: trimmedContent,
        category: selectedCategory,
        privacy: privacySetting,
        location: selectedLocation ? selectedLocation.trim() : null,
        latitude: selectedLocation
          ? (selectedCoordinates?.latitude ?? mapCoords.latitude)
          : null,
        longitude: selectedLocation
          ? (selectedCoordinates?.longitude ?? mapCoords.longitude)
          : null,
        photos: selectedPhotos,
        images: selectedPhotos,
        imageUrl: selectedPhotos.length > 0 ? selectedPhotos[0] : undefined,
        taggedUserIds: taggedUserIds.length > 0 ? taggedUserIds : undefined,
        expiresAt,
        temporaryDuration: isTemp ? temporaryDuration : undefined,
        durationLabel: isTemp ? durationOpt?.label : undefined,
      });

      // Augment returned post with static expiry data and tagged users for client-side rendering/filtering
      const clientPost = {
        ...newPost,
        category: selectedCategory,
        privacy: privacySetting,
        location: selectedLocation ? selectedLocation.trim() : newPost.location,
        imageUrl:
          newPost.imageUrl ||
          (selectedPhotos.length > 0 ? selectedPhotos[0] : ""),
        images:
          newPost.images && newPost.images.length > 0
            ? newPost.images
            : (selectedPhotos.length > 0 ? selectedPhotos : []),
        latitude:
          newPost.latitude ??
          (selectedLocation
            ? (selectedCoordinates?.latitude ?? mapCoords.latitude)
            : null),
        longitude:
          newPost.longitude ??
          (selectedLocation
            ? (selectedCoordinates?.longitude ?? mapCoords.longitude)
            : null),
        expiresAt: isTemp ? expiresAt : null,
        durationLabel: isTemp ? durationOpt?.label : undefined,
        taggedUsers:
          newPost.taggedUsers && newPost.taggedUsers.length > 0
            ? newPost.taggedUsers
            : taggedUserIds.map((id) => {
                const u = getFriendById(id);
                return {
                  id,
                  name: u?.fullName || "User",
                  username: u?.username,
                  avatarUrl: u?.avatarUrl,
                };
              }),
      };

      showToast(
        isTemp
          ? `Temporary post published (${durationOpt?.label})!`
          : "Post shared to community!",
        "success",
      );
      if (onPost) {
        onPost(clientPost);
      }
      setContent("");
      setTaggedUserIds([]);
      setSelectedPhotos([]);
      setSelectedLocation(null);
      setSelectedCoordinates(null);
      setTemporaryDuration(24 * 3600 * 1000);
      handleClose();
    } catch (err: any) {
      showToast(err?.message || "Failed to create post.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishLiveReplay = async (data: {
    content: string;
    durationLabel: string;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    viewerCount?: number;
    durationSeconds?: number;
  }) => {
    try {
      const newPost = await createPostApi({
        content: data.content,
        category: "Field",
        privacy: privacySetting,
        location: data.location || selectedLocation || null,
        latitude:
          data.latitude ?? (selectedCoordinates?.latitude ?? mapCoords.latitude),
        longitude:
          data.longitude ??
          (selectedCoordinates?.longitude ?? mapCoords.longitude),
        durationLabel: data.durationLabel,
        viewerCount: data.viewerCount,
        durationSeconds: data.durationSeconds,
        isLiveReplay: true,
      });

      const clientPost: PostItem = {
        ...newPost,
        category: "Field",
        privacy: privacySetting,
        durationLabel: data.durationLabel,
        location: data.location || selectedLocation || newPost.location || "",
        latitude:
          newPost.latitude ??
          data.latitude ??
          selectedCoordinates?.latitude ??
          null,
        longitude:
          newPost.longitude ??
          data.longitude ??
          selectedCoordinates?.longitude ??
          null,
      };

      if (onPost) {
        onPost(clientPost);
      }
      showToast("Live stream replay shared to your community!", "success");
      setShowLiveBroadcaster(false);
      handleClose();
    } catch (err: any) {
      showToast(err?.message || "Failed to share live replay.", "error");
      throw err;
    }
  };

  const toggleTagUser = (userId: string) => {
    setTaggedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handlePickPhotosFromGallery = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showToast(
          "Permission to access your gallery is required to choose photos.",
          "warning",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedPhotos = result.assets.map((asset) => {
          if (asset.base64) {
            return `data:image/jpeg;base64,${asset.base64}`;
          }
          return asset.uri;
        });

        setSelectedPhotos((prev) => {
          const combined = [...prev];
          for (const photo of pickedPhotos) {
            if (!combined.includes(photo)) {
              combined.push(photo);
            }
          }
          return combined;
        });
      }
    } catch (err) {
      console.warn("Error picking photos from gallery:", err);
      showToast("Could not open gallery.", "error");
    }
  };

  const handleTakePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        showToast(
          "Permission to access your camera is required to take photos.",
          "warning",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const photo = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        setSelectedPhotos((prev) => [...prev, photo]);
      }
    } catch (err) {
      console.warn("Error capturing photo with camera:", err);
      showToast("Could not open camera.", "error");
    }
  };

  const getPrivacyIcon = (
    setting: PrivacyType,
  ): keyof typeof Ionicons.glyphMap => {
    switch (setting) {
      case "Friends":
        return "people";
      case "Only me":
        return "lock-closed";
      case "Public":
      default:
        return "globe";
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={() => {
        if (showRsbsaLockModal) {
          setShowRsbsaLockModal(false);
        } else if (activeView === "POST_FORM") {
          handleClose();
        } else {
          setActiveView("POST_FORM");
        }
      }}
    >
      {activeView === "POST_FORM" ? (
        <View 
          className="flex-1 justify-end"
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            justifyContent: "flex-end",
          }}
        >
          {/* Backdrop pressable to close when tapping outside */}
          <Pressable
            onPress={handleClose}
            className="absolute inset-0"
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close modal backdrop"
          />

          <Animated.View
            style={[
              {
                transform: [{ translateY }],
                backgroundColor: "#FFFFFF",
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                overflow: "hidden",
                width: "100%",
                maxHeight: "92%",
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.16,
                shadowRadius: 14,
                elevation: 25,
              },
            ]}
          >
            {/* Header Section */}
            <View 
              {...panResponder.panHandlers}
              className="flex-row justify-between items-center px-5 pt-4 pb-3"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#E5E7EB",
                backgroundColor: "#FFFFFF",
              }}
            >
              {/* Close Button X */}
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                className="p-1 -ml-1 rounded-full active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>

              {/* Title */}
              <Text className="font-bold text-lg text-gray-900 text-center">
                Create Post
              </Text>

              {/* Post Button */}
              <TouchableOpacity
                onPress={handlePostSubmit}
                disabled={isSubmitting}
                className="px-5 py-1.5 rounded-full active:opacity-80 flex-row items-center justify-center min-w-[68px]"
                style={{ backgroundColor: "#65B152" }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-sm">Post</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Scrollable Content Area */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              className="px-5 pt-4"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {/* User Profile & Badges */}
              <View className="flex-row items-center mb-3">
                {/* Avatar */}
                <View 
                  className="h-12 w-12 rounded-full items-center justify-center mr-3 overflow-hidden"
                  style={{ backgroundColor: "#D1D5DB" }}
                >
                  {user?.avatarUrl ? (
                    <Image
                      source={{ uri: user.avatarUrl }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={26} color="#FFFFFF" />
                  )}
                </View>

                {/* Info Stack */}
                <View className="flex-1">
                  <Text className="font-bold text-base text-gray-900 leading-5">
                    {user?.name ||
                      user?.fullName ||
                      user?.username ||
                      "Juan Dela Cruz"}
                  </Text>

                  {taggedUserIds.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setActiveView("TAG_PEOPLE")}
                      className="flex-row items-center mt-0.5"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pricetag" size={11} color="#65B152" style={{ marginRight: 3 }} />
                      <Text className="text-xs text-[#65B152] font-semibold" numberOfLines={1}>
                        with {taggedUserIds.length} {taggedUserIds.length === 1 ? "person" : "people"} tagged
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* 3 Badges Row matching design */}
                  <View className="flex-row items-center gap-1.5 mt-1.5 flex-wrap">
                    {/* Privacy Selector Trigger */}
                    <TouchableOpacity
                      onPress={() => setActiveView("PRIVACY")}
                      className="flex-row items-center px-2.5 py-1 rounded-full gap-1 active:opacity-80"
                      style={{ backgroundColor: "#E5E7EB" }}
                    >
                      <Ionicons
                        name={getPrivacyIcon(privacySetting)}
                        size={12}
                        color="#4B5563"
                      />
                      <Text className="text-[11px] text-gray-700 font-medium">
                        {privacySetting}
                      </Text>
                      <Ionicons name="chevron-down" size={10} color="#4B5563" />
                    </TouchableOpacity>

                    {/* Add Location Trigger */}
                    <TouchableOpacity
                      onPress={() => setActiveView("ADD_LOCATION")}
                      className="flex-row items-center px-2.5 py-1 rounded-full gap-1 active:opacity-80 max-w-[140px]"
                      style={{ backgroundColor: "#E5E7EB" }}
                    >
                      <Ionicons
                        name="location-outline"
                        size={12}
                        color="#4B5563"
                      />
                      <Text
                        className="text-[11px] text-gray-700 font-medium"
                        numberOfLines={1}
                      >
                        {selectedLocation || "Add location"}
                      </Text>
                      {selectedLocation && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setSelectedLocation(null);
                            setSelectedCoordinates(null);
                          }}
                          className="ml-0.5"
                          accessibilityRole="button"
                          accessibilityLabel="Remove location"
                        >
                          <Ionicons
                            name="close-circle"
                            size={12}
                            color="#4B5563"
                          />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                    {/* Live Trigger */}
                    <TouchableOpacity
                      onPress={handleOpenLive}
                      className="flex-row items-center px-2.5 py-1 rounded-full gap-1 active:opacity-80"
                      style={{ backgroundColor: "#E5E7EB" }}
                      accessibilityRole="button"
                      accessibilityLabel="Live"
                    >
                      <Ionicons
                        name="videocam-outline"
                        size={13}
                        color="#4B5563"
                      />
                      <Text className="text-[11px] text-gray-700 font-medium">
                        Live
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Text Input Area */}
              <View className="min-h-[100px] mb-3">
                <TextInput
                  multiline={true}
                  value={content}
                  onChangeText={setContent}
                  placeholder="What's growing on ? Share with your farming community ..."
                  placeholderTextColor="#9CA3AF"
                  className="text-base text-gray-800 leading-6 text-left"
                  style={{ 
                    textAlignVertical: "top",
                    fontSize: 15,
                    minHeight: 90,
                    color: "#1F2937",
                  }}
                />
              </View>

              {/* Selected Photos Preview */}
              {selectedPhotos.length > 0 && (
                <View className="mb-3">
                  <Text className="text-xs font-semibold text-gray-600 mb-1.5">
                    Attached Photos ({selectedPhotos.length})
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="flex-row"
                  >
                    {selectedPhotos.map((photoUri, idx) => (
                      <View
                        key={idx}
                        className="mr-2.5 relative rounded-xl overflow-hidden border border-gray-200 shadow-2xs"
                      >
                        <Image
                          source={{ uri: photoUri }}
                          className="w-20 h-20 rounded-xl"
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          onPress={() =>
                            setSelectedPhotos((prev) =>
                              prev.filter((p) => p !== photoUri),
                            )
                          }
                          className="absolute top-1 right-1 bg-black/70 rounded-full w-5 h-5 items-center justify-center"
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {/* Add more button */}
                    <TouchableOpacity
                      onPress={handlePickPhotosFromGallery}
                      className="w-20 h-20 rounded-xl border border-dashed border-gray-300 bg-gray-50 items-center justify-center active:bg-gray-100"
                    >
                      <Ionicons name="add" size={24} color="#65B152" />
                      <Text className="text-[10px] text-gray-500 font-medium mt-0.5">
                        Add more
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}

              {/* Attached Location Leaflet Map Preview Card */}
              {selectedLocation && (
                <View className="mb-3 rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-xs">
                  <View className="flex-row items-center justify-between px-3.5 py-2 bg-green-50/70 border-b border-green-100">
                    <View className="flex-row items-center gap-1.5 flex-1 mr-2">
                      <Ionicons name="location-sharp" size={15} color="#65B152" />
                      <Text
                        className="text-xs font-bold text-gray-900 flex-1"
                        numberOfLines={1}
                      >
                        {selectedLocation}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedLocation(null);
                        setSelectedCoordinates(null);
                      }}
                      className="w-6 h-6 rounded-full bg-white border border-gray-200 items-center justify-center active:bg-gray-100"
                      accessibilityRole="button"
                      accessibilityLabel="Remove location"
                    >
                      <Ionicons name="close" size={13} color="#4B5563" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ width: "100%", height: 140 }}>
                    <LeafletMap
                      latitude={
                        selectedCoordinates?.latitude || mapCoords.latitude
                      }
                      longitude={
                        selectedCoordinates?.longitude || mapCoords.longitude
                      }
                      zoom={15}
                      locationTitle={selectedLocation}
                      interactive={false}
                    />
                  </View>
                </View>
              )}

              {/* Category Selection */}
              <View className="mb-3">
                <Text className="font-bold text-sm text-gray-900 mb-2 mt-1">
                  Category
                </Text>
                <View className="flex-row gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat;

                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setSelectedCategory(cat)}
                        className="px-4 py-1.5 rounded-full border active:opacity-80 shadow-2xs"
                        style={{
                          backgroundColor: isSelected ? "#F0FDF4" : "#FFFFFF",
                          borderColor: isSelected ? "#72AF5B" : "#CBD5E1",
                          borderWidth: 1.5,
                        }}
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{
                            color: isSelected ? "#72AF5B" : "#475569",
                          }}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Flexible Temporary Duration Selector */}
                {selectedCategory === "Temporary" && (
                  <View className="mt-3 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl">
                    <View className="flex-row items-center justify-between mb-1.5">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons name="time" size={15} color="#D97706" />
                        <Text className="text-xs font-bold text-amber-900">
                          Temporary Post Duration
                        </Text>
                      </View>
                      <View className="bg-amber-200/80 px-2 py-0.5 rounded-full flex-row items-center gap-1">
                        <Ionicons name="flash" size={10} color="#B45309" />
                        <Text className="text-[10px] font-bold text-amber-800">
                          Auto-Expires
                        </Text>
                      </View>
                    </View>

                    <Text className="text-[11px] text-amber-800/90 leading-4 mb-2.5">
                      Choose how long this post remains active on the
                      community feed before disappearing:
                    </Text>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{
                        flexDirection: "row",
                        gap: 6,
                        alignItems: "center",
                        paddingVertical: 2,
                      }}
                    >
                      {TEMPORARY_DURATIONS.map((opt) => {
                        const isDurationActive = temporaryDuration === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => setTemporaryDuration(opt.value)}
                            className={`px-2.5 py-1.5 rounded-xl border flex-row items-center gap-1.5 active:opacity-80 ${
                              isDurationActive
                                ? "bg-amber-500 border-amber-600 shadow-2xs"
                                : "bg-white border-amber-200/90"
                            }`}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={opt.icon}
                              size={13}
                              color={isDurationActive ? "#FFFFFF" : "#D97706"}
                            />
                            <Text
                              className={`text-xs ${
                                isDurationActive
                                  ? "text-white font-bold"
                                  : "text-amber-900 font-semibold"
                              }`}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View 
              className="flex-row justify-around items-center pt-3"
              style={{
                borderTopWidth: 1,
                borderTopColor: "#E5E7EB",
                paddingBottom: Math.max(insets.bottom, 16) + 6,
                backgroundColor: "#FFFFFF",
              }}
            >
              {/* Photo Action Trigger */}
              <TouchableOpacity
                onPress={handlePickPhotosFromGallery}
                className="flex-row items-center py-1.5 px-3 rounded-lg active:bg-gray-50"
              >
                <Ionicons name="images-outline" size={20} color="#65B152" />
                <Text className="text-[#65B152] font-semibold text-sm ml-2">
                  {selectedPhotos.length > 0
                    ? `Photo (${selectedPhotos.length})`
                    : "Photo"}
                </Text>
              </TouchableOpacity>

              {/* Camera Action Trigger */}
              <TouchableOpacity
                onPress={handleTakePhotoWithCamera}
                className="flex-row items-center py-1.5 px-3 rounded-lg active:bg-gray-50"
              >
                <Ionicons name="camera-outline" size={20} color="#65B152" />
                <Text className="text-[#65B152] font-semibold text-sm ml-2">
                  Camera
                </Text>
              </TouchableOpacity>

              {/* Tag people Action Trigger */}
              <TouchableOpacity
                onPress={() => setActiveView("TAG_PEOPLE")}
                className="flex-row items-center py-1.5 px-3 rounded-lg active:bg-gray-50"
              >
                <Ionicons name="pricetag-outline" size={20} color="#65B152" />
                <Text className="text-[#65B152] font-semibold text-sm ml-2">
                  {taggedUserIds.length > 0
                    ? `Tag people (${taggedUserIds.length})`
                    : "Tag people"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      ) : (
        <SafeAreaView
          className="flex-1"
          edges={
            activeView === "ADD_LOCATION"
              ? ["bottom", "left", "right"]
              : ["top", "bottom", "left", "right"]
          }
          style={{
            flex: 1,
            backgroundColor: "#FFFFFF",
          }}
        >
          {activeView === "PRIVACY" ? (
            /* 2. WHO CAN SEE POST ? (PRIVACY) VIEW */
            <View className="flex-1 bg-white justify-between px-5 pt-3 pb-4 h-full">
              {/* Top Content */}
              <View>
                {/* Back Arrow Button */}
                <TouchableOpacity
                  onPress={() => setActiveView("POST_FORM")}
                  className="p-1 -ml-2 mb-2 self-start active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="chevron-back" size={28} color="#111827" />
                </TouchableOpacity>

                {/* Header Title */}
                <Text className="text-2xl font-bold text-gray-900 mb-1.5">
                  Who can see post ?
                </Text>
                <Text className="text-sm text-gray-500 mb-8 leading-5">
                  Your post will show up in Feed, on your profile and search
                  result
                </Text>

                {/* Privacy Options List */}
                <View className="space-y-4">
                  {PRIVACY_OPTIONS.map((option) => {
                    const isSelected = privacySetting === option.title;

                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={() => setPrivacySetting(option.title)}
                        className="flex-row items-center py-3.5 active:opacity-70"
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={option.icon}
                          size={23}
                          color={isSelected ? "#111827" : "#4B5563"}
                        />
                        <Text
                          className={`text-md ml-4 ${
                            isSelected
                              ? "font-bold text-gray-900"
                              : "font-semibold text-gray-800"
                          }`}
                        >
                          {option.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Bottom Actions */}
              <View className="mt-auto">
                {/* Set as default audience Row */}
                <View className="flex-row justify-between items-center mb-3 px-1">
                  <Text className="text-sm text-gray-600 font-medium">
                    Set as default audience
                  </Text>
                  <Switch
                    value={isDefaultAudience}
                    onValueChange={setIsDefaultAudience}
                    trackColor={{ false: "#E5E7EB", true: "#72AF5B" }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Done Button */}
                <TouchableOpacity
                  onPress={() => setActiveView("POST_FORM")}
                  className="w-full bg-[#72AF5B] py-3.5 rounded-xl items-center justify-center active:opacity-80"
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-bold text-base">Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : activeView === "LIVE_PERMISSION" && isRSBSAVerified ? (
            /* 3. GO LIVE CAMERA ACCESS PERMISSION VIEW */
            <View className="flex-1 bg-white justify-between px-5 pt-3 pb-3 h-full">
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: "space-between",
                }}
              >
                {/* Header & Main Content */}
                <View>
                  {/* Header Section */}
                  <View className="flex-row items-center pt-1 pb-2">
                    <TouchableOpacity
                      onPress={() => setActiveView("POST_FORM")}
                      className="p-1 -ml-2 active:opacity-70"
                      accessibilityRole="button"
                      accessibilityLabel="Go back"
                    >
                      <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-gray-900 ml-3">
                      Live
                    </Text>
                  </View>

                  {/* Main Graphic */}
                  <View className="items-center mt-6">
                    <View className="bg-green-100 p-5 rounded-3xl items-center justify-center">
                      <Ionicons name="videocam" size={68} color="#16a34a" />
                    </View>
                  </View>

                  {/* Typography */}
                  <Text className="text-2xl font-bold text-center mt-5 text-gray-800 leading-8">
                    Access Your Camera{"\n"}to{" "}
                    <Text className="text-[#72AF5B]">Cast Live</Text>
                  </Text>

                  {/* Verified Broadcaster Badge */}
                  <View className="flex-row items-center justify-center self-center bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mt-2.5">
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color="#10B981"
                    />
                    <Text className="text-xs font-semibold text-emerald-800 ml-1.5">
                      RSBSA Verified Broadcaster
                    </Text>
                  </View>

                  <Text className="text-sm text-gray-600 text-center px-4 mt-3 leading-5">
                    Allow access to your camera to cast live and connect with
                    your friends in real time. Your privacy is important to us.
                  </Text>

                  {/* Feature Info Box */}
                  <View className="bg-gray-100 rounded-2xl mx-1 mt-6 p-4">
                    {/* Feature 1 */}
                    <View className="flex-row items-start mb-4">
                      <View className="bg-gray-300 p-2 rounded-full mr-3.5 items-center justify-center">
                        <Ionicons name="videocam" size={16} color="#374151" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-gray-900">
                          Go Live with Friends
                        </Text>
                        <Text className="text-xs text-gray-500 mt-0.5">
                          Stream live video and share moments instantly.
                        </Text>
                      </View>
                    </View>

                    {/* Feature 2 */}
                    <View className="flex-row items-start mb-4">
                      <View className="bg-gray-300 p-2 rounded-full mr-3.5 items-center justify-center">
                        <Ionicons
                          name="shield-checkmark"
                          size={16}
                          color="#374151"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-gray-900">
                          Safe & Secure
                        </Text>
                        <Text className="text-xs text-gray-500 mt-0.5">
                          We do not record or store your live videos.
                        </Text>
                      </View>
                    </View>

                    {/* Feature 3 */}
                    <View className="flex-row items-start">
                      <View className="bg-gray-300 p-2 rounded-full mr-3.5 items-center justify-center">
                        <Ionicons
                          name="lock-closed"
                          size={16}
                          color="#374151"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-gray-900">
                          {"You're in Control"}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-0.5">
                          You can change or revoke camera access anytime in
                          settings.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Bottom Action Buttons */}
                <View className="mt-6 pb-2">
                  {/* Allow Button */}
                  <TouchableOpacity
                    onPress={() => {
                      setActiveView("POST_FORM");
                      setShowLiveBroadcaster(true);
                    }}
                    className="w-full bg-[#72AF5B] rounded-xl py-3.5 flex-row justify-center items-center mb-3 active:opacity-80 shadow-xs"
                    activeOpacity={0.8}
                  >
                    <Ionicons name="videocam" size={18} color="#FFFFFF" />
                    <Text className="text-white font-bold text-base ml-2">
                      Allow camera access
                    </Text>
                  </TouchableOpacity>

                  {/* Not Now Button */}
                  <TouchableOpacity
                    onPress={() => setActiveView("POST_FORM")}
                    className="w-full bg-white rounded-xl py-3.5 items-center justify-center shadow-xs border border-gray-200 active:bg-gray-50"
                    activeOpacity={0.8}
                  >
                    <Text className="text-gray-800 font-bold text-base">
                      Not Now
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          ) : activeView === "TAG_PEOPLE" ? (
            /* 4. TAG AND COLLABORATE VIEW */
            <View className="flex-1 bg-gray-50 h-full w-full relative">
              {/* Header Section */}
              <View className="flex-row items-center pt-3 pb-3 px-5 bg-gray-50">
                <TouchableOpacity
                  onPress={() => setActiveView("POST_FORM")}
                  className="p-1 -ml-2 active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="chevron-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-gray-900 flex-1 text-center mr-6">
                  Tag and collaborate
                </Text>
              </View>

              {/* Tagged People Preview (Horizontal Scroll) */}
              {taggedUserIds.length > 0 && (
                <View className="mb-2">
                  <Text className="text-sm font-medium text-gray-700 px-5 mb-3">
                    Tagged People ({taggedUserIds.length})
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="px-5"
                  >
                    {taggedUserIds.map((userId) => {
                      const user = getFriendById(userId);
                      if (!user) return null;

                      return (
                        <View key={user.id} className="items-center mr-4">
                          <View className="bg-gray-200 h-12 w-12 rounded-full mb-1 items-center justify-center overflow-hidden border border-gray-300">
                            {user.avatarUrl ? (
                              <Image
                                source={{ uri: user.avatarUrl }}
                                className="w-full h-full"
                                resizeMode="cover"
                              />
                            ) : (
                              <Ionicons
                                name="person"
                                size={22}
                                color="#6B7280"
                              />
                            )}
                          </View>
                          <Text className="text-xs text-gray-700 font-medium">
                            {user.firstName}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Search Bar */}
              <View className="bg-white rounded-2xl flex-row items-center px-4 py-2.5 mx-5 my-3 border border-gray-200 shadow-xs">
                <Ionicons name="search" size={20} color="#9CA3AF" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search members to tag..."
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 ml-2 text-base text-gray-800 p-0"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* User List (Vertical Mapping) */}
              <ScrollView
                className="flex-1 px-5"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
              >
                {isLoadingFriends || isSearchingUsers ? (
                  <View className="py-12 items-center justify-center">
                    <ActivityIndicator size="small" color="#72AF5B" />
                    <Text className="text-xs text-gray-500 mt-2">
                      Loading members...
                    </Text>
                  </View>
                ) : filteredFriends.length === 0 ? (
                  <View className="py-12 items-center justify-center px-4">
                    <Ionicons name="people-outline" size={36} color="#9CA3AF" />
                    <Text className="text-sm font-semibold text-gray-600 mt-2 text-center">
                      {searchQuery
                        ? "No members found matching your search"
                        : "No members to tag yet"}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-1 text-center">
                      {searchQuery
                        ? "Try searching by exact name or username."
                        : "Connect with farmers and friends or search their name above to tag them."}
                    </Text>
                  </View>
                ) : (
                  filteredFriends.map((friend) => {
                    const isSelected = taggedUserIds.includes(friend.id);

                    return (
                      <TouchableOpacity
                        key={friend.id}
                        onPress={() => toggleTagUser(friend.id)}
                        className="flex-row items-center bg-white rounded-2xl mb-2.5 p-3 shadow-xs border border-gray-100 active:opacity-80"
                        activeOpacity={0.7}
                      >
                        {/* Left (Avatar) */}
                        <View className="bg-gray-200 h-12 w-12 rounded-full mr-3 items-center justify-center overflow-hidden border border-gray-200">
                          {friend.avatarUrl ? (
                            <Image
                              source={{ uri: friend.avatarUrl }}
                              className="w-full h-full"
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons
                              name="person"
                              size={22}
                              color="#6B7280"
                            />
                          )}
                        </View>

                        {/* Middle (Info) */}
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-gray-800">
                            {friend.fullName}
                          </Text>
                          <Text className="text-xs text-gray-500 mt-0.5">
                            {friend.username
                              ? `@${friend.username}`
                              : "Member"}
                          </Text>
                        </View>

                        {/* Right (Checkbox) */}
                        <View
                          className={`h-6 w-6 rounded-md items-center justify-center ${
                            isSelected
                              ? "bg-[#72AF5B]"
                              : "border border-[#72AF5B] bg-white"
                          }`}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color="#FFFFFF"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              {/* Bottom Finished Action Button */}
              <View className="absolute bottom-0 left-0 right-0 p-5 bg-gray-50 border-t border-gray-200/60">
                <TouchableOpacity
                  onPress={() => setActiveView("POST_FORM")}
                  className="w-full bg-[#72AF5B] rounded-xl py-3.5 items-center justify-center active:opacity-80 shadow-sm"
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-bold text-base">
                    Finished
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : activeView === "ADD_LOCATION" ? (
            /* 7. ADD LOCATION VIEW (Leaflet Map with Dynamic Search & Geocoding) */
            <View className="flex-1 bg-white h-full w-full relative overflow-hidden">
              {/* Full-Screen Map filling upper corners */}
              <LeafletMap
                latitude={mapCoords.latitude}
                longitude={mapCoords.longitude}
                zoom={14}
                locationTitle={locationSearch || "Selected Farm Location"}
                interactive={true}
                onLocationSelect={handleMapLocationSelect}
              />

              {/* Floating Top Controls: Chevron Back Button + Search Bar + GPS Button */}
              <View
                style={{
                  position: "absolute",
                  top: Math.max(insets.top, 16) + 6,
                  left: 16,
                  right: 16,
                  zIndex: 40,
                }}
              >
                <View className="flex-row items-center gap-2">
                  {/* Floating Chevron Back Button */}
                  <TouchableOpacity
                    onPress={() => {
                      setShowSearchResults(false);
                      setActiveView("POST_FORM");
                    }}
                    activeOpacity={0.7}
                    className="w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg elevation-5 border border-gray-100"
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                  >
                    <Ionicons name="chevron-back" size={26} color="#111827" />
                  </TouchableOpacity>

                  {/* Floating Search Bar */}
                  <View className="flex-1 bg-white border border-[#72AF5B] rounded-full flex-row items-center px-3.5 h-11 shadow-lg elevation-5">
                    <Ionicons
                      name="search-outline"
                      size={18}
                      color="#6B7280"
                      style={{ marginRight: 6 }}
                    />
                    <TextInput
                      value={locationSearch}
                      onChangeText={(text) => {
                        setLocationSearch(text);
                        setShowSearchResults(true);
                      }}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowSearchResults(true);
                      }}
                      placeholder="Search farm, barangay, or city..."
                      placeholderTextColor="#9CA3AF"
                      className="flex-1 text-sm text-gray-800 p-0"
                      returnKeyType="search"
                    />
                    {isSearchingLocation ? (
                      <ActivityIndicator
                        size="small"
                        color="#72AF5B"
                        style={{ marginLeft: 4 }}
                      />
                    ) : locationSearch.length > 0 ? (
                      <TouchableOpacity
                        onPress={() => {
                          setLocationSearch("");
                          setSearchResults([]);
                          setShowSearchResults(false);
                        }}
                        className="p-1"
                      >
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* GPS Locator Button */}
                  <TouchableOpacity
                    onPress={handleUseCurrentLocation}
                    disabled={isLocatingGps}
                    activeOpacity={0.7}
                    className="w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg elevation-5 border border-gray-100"
                    accessibilityRole="button"
                    accessibilityLabel="Use current device location"
                  >
                    {isLocatingGps ? (
                      <ActivityIndicator size="small" color="#72AF5B" />
                    ) : (
                      <Ionicons name="locate" size={22} color="#72AF5B" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Autocomplete Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <View className="mt-2 bg-white rounded-2xl shadow-2xl elevation-8 border border-gray-200 overflow-hidden max-h-56">
                    <ScrollView
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled={true}
                    >
                      {searchResults.map((item, idx) => (
                        <TouchableOpacity
                          key={`${item.id || idx}-${item.latitude}`}
                          onPress={() => handleSelectSearchResult(item)}
                          className={`p-3 flex-row items-center border-b border-gray-100 active:bg-green-50 ${
                            idx === searchResults.length - 1 ? "border-b-0" : ""
                          }`}
                        >
                          <View className="w-8 h-8 rounded-full bg-green-50 items-center justify-center mr-2.5">
                            <Ionicons
                              name="location-sharp"
                              size={16}
                              color="#72AF5B"
                            />
                          </View>
                          <View className="flex-1 pr-1">
                            <Text
                              className="text-xs font-bold text-gray-900"
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                            {item.fullName ? (
                              <Text
                                className="text-[11px] text-gray-500 mt-0.5"
                                numberOfLines={1}
                              >
                                {item.fullName}
                              </Text>
                            ) : null}
                          </View>
                          <Ionicons
                            name="arrow-forward"
                            size={14}
                            color="#9CA3AF"
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>


              {/* Floating Bottom Info Card with Select & Cancel Location Buttons */}
              <View className="absolute bottom-6 left-5 right-5 z-20 bg-white rounded-2xl p-4 shadow-xl border border-gray-100">
                <View className="mb-3">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Ionicons
                      name="location-sharp"
                      size={18}
                      color="#72AF5B"
                    />
                    <Text
                      className="text-base font-bold text-gray-900 flex-1"
                      numberOfLines={1}
                    >
                      {locationSearch || "Selected Location"}
                    </Text>
                    {isGeocoding && (
                      <View className="flex-row items-center gap-1">
                        <ActivityIndicator size="small" color="#72AF5B" />
                        <Text className="text-[10px] text-[#72AF5B] font-medium">
                          Resolving...
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-500 leading-4">
                    Coordinates: {mapCoords.latitude.toFixed(4)},{" "}
                    {mapCoords.longitude.toFixed(4)}
                  </Text>
                  <Text className="text-[11px] text-gray-400 mt-0.5">
                    Tap anywhere on the map, use the search bar, or pick your GPS location.
                  </Text>
                </View>
                {/* Action Buttons Row */}
                <View className="flex-row justify-end gap-2.5 pt-1">
                  {/* Cancel Location Button */}
                  <TouchableOpacity
                    onPress={() => {
                      setShowSearchResults(false);
                      setActiveView("POST_FORM");
                    }}
                    className="bg-gray-100 px-4 py-2.5 rounded-xl border border-gray-200 items-center justify-center active:bg-gray-200"
                    activeOpacity={0.7}
                  >
                    <Text className="text-gray-700 font-semibold text-xs">
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  {/* Select Location Button */}
                  <TouchableOpacity
                    onPress={() => {
                      const finalName =
                        locationSearch || "Selected Farm Location";
                      setSelectedLocation(finalName);
                      setSelectedCoordinates(mapCoords);
                      setShowSearchResults(false);
                      setActiveView("POST_FORM");
                    }}
                    className="bg-[#72AF5B] px-5 py-2.5 rounded-xl items-center justify-center active:bg-[#5e944a] shadow-sm"
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-bold text-xs">
                      Select Location
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </SafeAreaView>
      )}

      {/* RSBSA Green Badge Requirement Modal Overlay */}
      {showRsbsaLockModal && (
        <View className="absolute inset-0 bg-black/60 z-50 justify-center items-center px-6">
          <Pressable
            onPress={() => setShowRsbsaLockModal(false)}
            className="absolute inset-0"
            accessibilityRole="button"
            accessibilityLabel="Dismiss modal backdrop"
          />
          <View
            className="bg-white rounded-3xl p-6 w-full max-w-sm items-center shadow-2xl z-10"
            accessibilityRole="alert"
          >
            {/* Badge & Camera Graphic */}
            <View className="relative mb-3">
              <View className="w-16 h-16 rounded-full bg-[#72AF5B] items-center justify-center">
                <Ionicons name="videocam" size={32} color="#ffffff" />
              </View>
              <View className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white items-center justify-center shadow-md">
                <Ionicons name="checkmark-circle" size={24} color="#72AF5B" />
              </View>
            </View>

            {/* Status / Category Pill */}
            <View
              className={`px-3 py-1 rounded-full mb-2 border ${
                rsbsaApp?.status === "pending"
                  ? "bg-amber-50 border-amber-200"
                  : rsbsaApp?.status === "rejected"
                    ? "bg-rose-50 border-rose-200"
                    : "bg-gray-50 border-[#72AF5B]"
              }`}
            >
              <Text
                className={`text-[11px] font-bold tracking-wide uppercase ${
                  rsbsaApp?.status === "pending"
                    ? "text-amber-800"
                    : rsbsaApp?.status === "rejected"
                      ? "text-rose-800"
                      : "text-emerald-800"
                }`}
              >
                {rsbsaApp?.status === "pending"
                  ? "Verification Under Review"
                  : rsbsaApp?.status === "rejected"
                    ? "Verification Needs Attention"
                    : "RSBSA Green Badge Required"}
              </Text>
            </View>

            {/* Modal Heading */}
            <Text className="text-xl font-bold text-[#E45742] text-center mb-2">
              Unlock Live Streaming
            </Text>

            {/* Explanation / Subtitle */}
            <Text className="text-sm text-gray-600 text-center leading-5 mb-4">
              {rsbsaApp?.status === "pending"
                ? "Your RSBSA application is currently under review by our team. Live streaming privileges will automatically unlock once verified."
                : rsbsaApp?.status === "rejected"
                  ? "Your previous RSBSA verification was not approved. Please update and re-submit your farming credentials to unlock live broadcasting."
                  : "Live video broadcasting is exclusively reserved for RSBSA-verified farmers. Earn the Green Badge to protect our marketplace from fraudulent sellers and stream live harvest updates to buyers."}
            </Text>

            {/* Security & Trust Benefits */}
            <View className="bg-gray-50 rounded-2xl p-3.5 w-full mb-5 border border-gray-100 gap-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="shield-checkmark" size={18} color="#72AF5B" />
                <Text className="text-sm font-semibold text-gray-800">
                  Protects buyers from fake farm listings
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="ribbon" size={18} color="#72AF5B" />
                <Text className="text-sm font-semibold text-gray-800">
                  Awards the official Green Badge to your profile
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="people" size={18} color="#72AF5B" />
                <Text className="text-sm font-semibold text-gray-800">
                  Builds instant trust with local wholesale and retail buyers
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              onPress={() => {
                setShowRsbsaLockModal(false);
                handleClose();
                router.push("/user/RSBSAVerification" as any);
              }}
              className="w-full text-sm bg-[#72AF5B] py-3.5 rounded-xl items-center justify-center active:opacity-85 shadow-sm mb-2.5"
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                rsbsaApp?.status === "pending"
                  ? "Check verification status"
                  : rsbsaApp?.status === "rejected"
                    ? "Review and re-apply"
                    : "Apply for RSBSA verification"
              }
            >
              <Text className="text-white font-bold text-sm">
                {rsbsaApp?.status === "pending"
                  ? "Check Verification Status"
                  : rsbsaApp?.status === "rejected"
                    ? "Review & Re-apply"
                    : "Apply for RSBSA Verification"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowRsbsaLockModal(false)}
              className="w-full py-3.5 bg-gray-100 border border-gray-200 rounded-xl items-center justify-center active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel="Dismiss dialog"
            >
              <Text className="text-gray-500 font-semibold text-sm text-center">
                Maybe Later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Dynamic Live Broadcaster Studio Modal */}
      <LiveBroadcasterModal
        isVisible={showLiveBroadcaster}
        onClose={() => setShowLiveBroadcaster(false)}
        onPublishReplay={handlePublishLiveReplay}
        initialLocation={selectedLocation}
        initialCoordinates={selectedCoordinates || mapCoords}
      />
    </Modal>
  );
}

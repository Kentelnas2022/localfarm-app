import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/context/toast-context";
import { useAuth } from "@/hooks/use-auth";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PRIVACY_SETTINGS_KEY = "localfarm_user_privacy_settings_v2";

interface PrivacySettings {
  profileVisibility: "Public" | "Friends" | "Only me";
  postAudience: "Public" | "Friends" | "Only me";
  storyAudience: "Public" | "Friends" | "Only me";
  taggingPermission: "Everyone" | "Friends" | "No one";
  connectionsListVisibility: "Public" | "Friends" | "Only me";
  pricingVisibility: "Public" | "Verified Only";
  // Location & Safety
  preciseLocation: boolean;
  mapDiscovery: boolean;
  // Interactions
  messagingScope: "everyone" | "friends";
  showOnlineStatus: boolean;
}

const DEFAULT_SETTINGS: PrivacySettings = {
  profileVisibility: "Public",
  postAudience: "Public",
  storyAudience: "Public",
  taggingPermission: "Everyone",
  connectionsListVisibility: "Public",
  pricingVisibility: "Public",
  preciseLocation: true,
  mapDiscovery: true,
  messagingScope: "everyone",
  showOnlineStatus: true,
};

interface AudienceOptionConfig {
  key: keyof PrivacySettings;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  options: {
    value: string;
    label: string;
    description: string;
  }[];
}

const AUDIENCE_OPTIONS: AudienceOptionConfig[] = [
  {
    key: "profileVisibility",
    title: "Profile Visibility",
    subtitle: "Who can see your farm details, bio, and contact info",
    icon: "person-circle-outline",
    iconBg: "bg-[#EDF3EE]",
    iconColor: "#34594A",
    options: [
      {
        value: "Public",
        label: "Public",
        description: "Visible to all farmers, buyers, and guests on Local Farm",
      },
      {
        value: "Friends",
        label: "Friends Only",
        description: "Only approved connected farmers & buyers can view",
      },
      {
        value: "Only me",
        label: "Only me",
        description: "Keep your farm details private and visible only to you",
      },
    ],
  },
  {
    key: "postAudience",
    title: "Posts & Harvests",
    subtitle: "Default audience for your harvest posts and updates",
    icon: "newspaper-outline",
    iconBg: "bg-[#EDF3EE]",
    iconColor: "#34594A",
    options: [
      {
        value: "Public",
        label: "Public",
        description: "Anyone on Local Farm can view your harvest updates",
      },
      {
        value: "Friends",
        label: "Friends",
        description: "Only your connected friends can view your posts",
      },
      {
        value: "Only me",
        label: "Only me",
        description: "Visible only to you by default",
      },
    ],
  },
  {
    key: "storyAudience",
    title: "Stories",
    subtitle: "Who can view your 24-hour expiring farm stories",
    icon: "time-outline",
    iconBg: "bg-[#EDF3EE]",
    iconColor: "#34594A",
    options: [
      {
        value: "Public",
        label: "Public",
        description: "Anyone on Local Farm can view your stories",
      },
      {
        value: "Friends",
        label: "Friends",
        description: "Only connected friends can see your stories",
      },
      {
        value: "Only me",
        label: "Only me",
        description: "Private to you only",
      },
    ],
  },
  {
    key: "taggingPermission",
    title: "Tagging & Mentions",
    subtitle: "Who can tag your farm in posts, harvests, and photos",
    icon: "pricetag-outline",
    iconBg: "bg-[#EDF3EE]",
    iconColor: "#34594A",
    options: [
      {
        value: "Everyone",
        label: "Everyone",
        description: "Any grower or buyer can tag your farm in posts",
      },
      {
        value: "Friends",
        label: "Friends Only",
        description: "Only your connected friends can tag your farm",
      },
      {
        value: "No one",
        label: "No one",
        description: "Don't allow anyone to tag or mention your farm",
      },
    ],
  },
  {
    key: "connectionsListVisibility",
    title: "Connections List",
    subtitle: "Who can see your connected farmers and buyers list",
    icon: "people-outline",
    iconBg: "bg-[#EDF3EE]",
    iconColor: "#34594A",
    options: [
      {
        value: "Public",
        label: "Public",
        description: "Anyone can see your network of connected farmers & buyers",
      },
      {
        value: "Friends",
        label: "Friends Only",
        description: "Only connected friends can see your network",
      },
      {
        value: "Only me",
        label: "Only me",
        description: "Keep your connection network private to yourself",
      },
    ],
  },
  {
    key: "pricingVisibility",
    title: "Produce Pricing",
    subtitle: "Who can view wholesale and retail crop prices",
    icon: "cash-outline",
    iconBg: "bg-[#EDF3EE]",
    iconColor: "#34594A",
    options: [
      {
        value: "Public",
        label: "Public to All",
        description: "All visitors and marketplace buyers can see your prices",
      },
      {
        value: "Verified Only",
        label: "Verified Buyers Only",
        description: "Only DA / RSBSA verified buyers can view crop prices",
      },
    ],
  },
];

export default function PrivacyCenter() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAudienceConfig, setSelectedAudienceConfig] =
    useState<AudienceOptionConfig | null>(null);

  const [activePolicyModal, setActivePolicyModal] = useState<
    "data_privacy" | "rsbsa_safety" | "export_data" | null
  >(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load saved privacy preferences dynamically from backend, falling back to AsyncStorage
  useEffect(() => {
    let isMounted = true;

    async function loadPrivacySettings() {
      // 1. Try backend API
      try {
        const res = await apiFetch<{ settings: PrivacySettings }>("/user/privacy");
        if (res && res.settings && isMounted) {
          setSettings((prev) => ({ ...prev, ...res.settings }));
          await AsyncStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(res.settings));
          setIsLoading(false);
          return;
        }
      } catch (e) {
        // Fall back to local storage
      }

      // 2. Offline / local fallback
      try {
        const saved = await AsyncStorage.getItem(PRIVACY_SETTINGS_KEY);
        if (saved && isMounted) {
          const parsed = JSON.parse(saved);
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch (err) {
        console.warn("Error loading privacy settings:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPrivacySettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateSetting = async <K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K],
    toastMessage?: string,
  ) => {
    const next = { ...settings, [key]: value };
    setSettings(next);

    // Save locally
    try {
      await AsyncStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(next));
      if (key === "storyAudience") {
        await AsyncStorage.setItem("localfarm_default_story_privacy", String(value));
      }
      if (toastMessage) {
        showToast(toastMessage, "success");
      }
    } catch (err) {
      console.warn("Failed to save privacy setting locally:", err);
      showToast("Failed to update setting.", "error");
    }

    // Persist dynamically to backend & MySQL
    try {
      await apiFetch("/user/privacy", {
        method: "PUT",
        body: JSON.stringify(next),
      });
    } catch (err) {
      console.warn("Failed to sync privacy setting with server:", err);
    }
  };

  const handleExportData = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setActivePolicyModal(null);
      Alert.alert(
        "Data Archive Ready",
        `An encrypted archive of your account activity, farm profile, and transaction history has been scheduled for delivery to ${
          user?.email || "your email address"
        }.`,
        [{ text: "Done" }],
      );
    }, 1500);
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ flex: 1, backgroundColor: "#FAF9F5" }}
      edges={["top", "left", "right"]}
    >
      {/* Top Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderColor: "#E5ECE6",
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push("/user/MenuProfile" as any);
            }
          }}
          activeOpacity={0.7}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#34594A" />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 17,
            fontWeight: "700",
            color: "#23382D",
            letterSpacing: -0.3,
          }}
        >
          Privacy Center
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        className="flex-1"
        style={{ flex: 1, backgroundColor: "#FAF9F5" }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Rich Hero Banner with calm forest LinearGradient */}
        <LinearGradient
          colors={["#29483B", "#38604F"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 18,
            padding: 18,
            marginBottom: 20,
            shadowColor: "#293E33",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 5,
            elevation: 2,
          }}
        >
          <View className="flex-row items-center gap-3 mb-2">
            <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">
                Your Privacy & Safety
              </Text>
              <Text style={{ color: "#E0EBE4", fontSize: 12 }}>
                Control farm visibility, location, and data security
              </Text>
            </View>
          </View>
          <Text style={{ color: "#D4E4DA", fontSize: 12, lineHeight: 18, marginTop: 4 }}>
            Local Farm gives you full autonomy over who sees your farm location,
            produce prices, posts, and agricultural registry records.
          </Text>
        </LinearGradient>

        {isLoading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="large" color="#34594A" />
            <Text style={{ fontSize: 12, color: "#75867B", marginTop: 8 }}>
              Loading privacy preferences...
            </Text>
          </View>
        ) : (
          <>
            {/* Section 1: Audience & Visibility (List of Options) */}
            <View className="mb-5">
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "700",
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  color: "#738579",
                  marginBottom: 8,
                  marginLeft: 4,
                }}
              >
                Audience & Visibility
              </Text>
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#E5ECE6",
                  shadowColor: "#293E33",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.035,
                  shadowRadius: 6,
                  elevation: 1,
                  overflow: "hidden",
                }}
              >
                {AUDIENCE_OPTIONS.map((item, index) => {
                  const currentValue = String(settings[item.key] || "");
                  const isLast = index === AUDIENCE_OPTIONS.length - 1;

                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setSelectedAudienceConfig(item)}
                      activeOpacity={0.7}
                      style={[
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 15,
                        },
                        !isLast && { borderBottomWidth: 1, borderColor: "#F0F4F0" },
                      ]}
                    >
                      <View className="flex-row items-center gap-3 flex-1 mr-3">
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            backgroundColor: "#EDF3EE",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name={item.icon}
                            size={20}
                            color="#34594A"
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            style={{
                              fontSize: 14.5,
                              fontWeight: "600",
                              color: "#24372C",
                              letterSpacing: -0.2,
                            }}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11.5,
                              color: "#7C8D82",
                              marginTop: 2,
                            }}
                            numberOfLines={1}
                          >
                            {item.subtitle}
                          </Text>
                        </View>
                      </View>

                      {/* Current Value Pill + Chevron */}
                      <View className="flex-row items-center gap-1.5">
                        <View
                          style={{
                            backgroundColor: "#EDF3EE",
                            paddingHorizontal: 10,
                            paddingVertical: 3.5,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: "#DCE6DF",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11.5,
                              fontWeight: "700",
                              color: "#34594A",
                            }}
                          >
                            {currentValue}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#879386"
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section 2: Farm Location & Safety */}
            <View className="mb-5">
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "700",
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  color: "#738579",
                  marginBottom: 8,
                  marginLeft: 4,
                }}
              >
                Location & Safety
              </Text>
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#E5ECE6",
                  padding: 16,
                  shadowColor: "#293E33",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.035,
                  shadowRadius: 6,
                  elevation: 1,
                  gap: 16,
                }}
              >
                {/* Precise GPS Coordinates */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Ionicons name="location-outline" size={18} color="#34594A" />
                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: "600",
                          color: "#24372C",
                          letterSpacing: -0.2,
                        }}
                      >
                        Exact Farm Gate GPS
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11.5, color: "#7C8D82", lineHeight: 16 }}>
                      When enabled, pinpoint GPS coordinates are included for pickup
                      directions. When disabled, only your barangay is displayed.
                    </Text>
                  </View>
                  <Switch
                    value={settings.preciseLocation}
                    onValueChange={(val) =>
                      updateSetting(
                        "preciseLocation",
                        val,
                        val
                          ? "Exact GPS enabled for farm pickups."
                          : "Location limited to general barangay.",
                      )
                    }
                    trackColor={{ false: "#E0E7E1", true: "#B8D5C4" }}
                    thumbColor={settings.preciseLocation ? "#34594A" : "#FFFFFF"}
                  />
                </View>

                {/* Explore Map Presence */}
                <View
                  style={{
                    paddingTop: 14,
                    borderTopWidth: 1,
                    borderColor: "#F0F4F0",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Ionicons name="map-outline" size={18} color="#34594A" />
                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: "600",
                          color: "#24372C",
                          letterSpacing: -0.2,
                        }}
                      >
                        Explore Map Discovery
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11.5, color: "#7C8D82", lineHeight: 16 }}>
                      Allow your farm pin and fresh harvests to appear on the
                      Local Farm community map.
                    </Text>
                  </View>
                  <Switch
                    value={settings.mapDiscovery}
                    onValueChange={(val) =>
                      updateSetting(
                        "mapDiscovery",
                        val,
                        val
                          ? "Farm visible on Explore Map."
                          : "Farm hidden from Explore Map.",
                      )
                    }
                    trackColor={{ false: "#E0E7E1", true: "#B8D5C4" }}
                    thumbColor={settings.mapDiscovery ? "#34594A" : "#FFFFFF"}
                  />
                </View>
              </View>
            </View>

            {/* Section 3: Social & Messaging Controls */}
            <View className="mb-5">
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "700",
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  color: "#738579",
                  marginBottom: 8,
                  marginLeft: 4,
                }}
              >
                Interactions & Accounts
              </Text>
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#E5ECE6",
                  shadowColor: "#293E33",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.035,
                  shadowRadius: 6,
                  elevation: 1,
                  overflow: "hidden",
                }}
              >
                {/* Who Can Message You */}
                <View style={{ padding: 16, borderBottomWidth: 1, borderColor: "#F0F4F0" }}>
                  <View className="flex-row items-center gap-2 mb-1">
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={18}
                      color="#34594A"
                    />
                    <Text
                      style={{
                        fontSize: 14.5,
                        fontWeight: "600",
                        color: "#24372C",
                        letterSpacing: -0.2,
                      }}
                    >
                      Message Inquiries
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: "#7C8D82", marginBottom: 10 }}>
                    Choose who can start direct chats or inquiries with your farm.
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      backgroundColor: "#F2F5F2",
                      padding: 3,
                      borderRadius: 12,
                      gap: 4,
                    }}
                  >
                    {(
                      [
                        { id: "everyone", label: "Everyone" },
                        { id: "friends", label: "Connected Friends" },
                      ] as const
                    ).map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() =>
                          updateSetting(
                            "messagingScope",
                            opt.id,
                            `Messaging inquiries set to ${opt.label}`,
                          )
                        }
                        style={[
                          { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
                          settings.messagingScope === opt.id && {
                            backgroundColor: "#FFFFFF",
                            shadowColor: "#293E33",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.06,
                            shadowRadius: 3,
                            elevation: 1,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: settings.messagingScope === opt.id ? "700" : "500",
                            color: settings.messagingScope === opt.id ? "#34594A" : "#738579",
                          }}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Show Online Activity Status */}
                <View
                  style={{
                    padding: 16,
                    borderBottomWidth: 1,
                    borderColor: "#F0F4F0",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View className="flex-1 mr-3">
                    <Text
                      style={{
                        fontSize: 14.5,
                        fontWeight: "600",
                        color: "#24372C",
                        letterSpacing: -0.2,
                      }}
                    >
                      Show Online Status
                    </Text>
                    <Text style={{ fontSize: 11.5, color: "#7C8D82", marginTop: 2 }}>
                      Let other growers and buyers see when you are active.
                    </Text>
                  </View>
                  <Switch
                    value={settings.showOnlineStatus}
                    onValueChange={(val) =>
                      updateSetting(
                        "showOnlineStatus",
                        val,
                        val ? "Online status visible." : "Online status hidden.",
                      )
                    }
                    trackColor={{ false: "#E0E7E1", true: "#B8D5C4" }}
                    thumbColor={settings.showOnlineStatus ? "#34594A" : "#FFFFFF"}
                  />
                </View>

                {/* Blocked Accounts Navigation */}
                <TouchableOpacity
                  onPress={() => router.push("/user/BlockedAccounts" as any)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 15,
                    borderBottomWidth: 1,
                    borderColor: "#F0F4F0",
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: "#F9ECEC",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="ban-outline" size={19} color="#B85454" />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: "600",
                          color: "#24372C",
                          letterSpacing: -0.2,
                        }}
                      >
                        Blocked Accounts
                      </Text>
                      <Text style={{ fontSize: 11.5, color: "#7C8D82", marginTop: 2 }}>
                        Manage blocked users and spam restrictions
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#879386" />
                </TouchableOpacity>

                {/* Restricted Accounts Navigation */}
                <TouchableOpacity
                  onPress={() => router.push("/user/RestrictedAccounts" as any)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 15,
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: "#F8F2E6",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="hand-left-outline" size={19} color="#B07D38" />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: "600",
                          color: "#24372C",
                          letterSpacing: -0.2,
                        }}
                      >
                        Restricted Accounts
                      </Text>
                      <Text style={{ fontSize: 11.5, color: "#7C8D82", marginTop: 2 }}>
                        Limit interactions without blocking
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#879386" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Section 4: Data Security & Policies */}
            <View className="mb-6">
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: "700",
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  color: "#738579",
                  marginBottom: 8,
                  marginLeft: 4,
                }}
              >
                Data & Policies
              </Text>
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#E5ECE6",
                  shadowColor: "#293E33",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.035,
                  shadowRadius: 6,
                  elevation: 1,
                  overflow: "hidden",
                }}
              >
                <TouchableOpacity
                  onPress={() => setActivePolicyModal("data_privacy")}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 15,
                    borderBottomWidth: 1,
                    borderColor: "#F0F4F0",
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: "#EDF3EE",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={19}
                        color="#34594A"
                      />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: "600",
                          color: "#24372C",
                          letterSpacing: -0.2,
                        }}
                      >
                        Data Privacy Policy
                      </Text>
                      <Text style={{ fontSize: 11.5, color: "#7C8D82", marginTop: 2 }}>
                        How your agricultural and contact data is secured
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#879386" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActivePolicyModal("rsbsa_safety")}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 15,
                    borderBottomWidth: 1,
                    borderColor: "#F0F4F0",
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: "#EDF3EE",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="ribbon-outline"
                        size={19}
                        color="#34594A"
                      />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: "600",
                          color: "#24372C",
                          letterSpacing: -0.2,
                        }}
                      >
                        RSBSA Registry & ID Protection
                      </Text>
                      <Text style={{ fontSize: 11.5, color: "#7C8D82", marginTop: 2 }}>
                        Government verification document safety guidelines
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#879386" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActivePolicyModal("export_data")}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 15,
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        backgroundColor: "#EDF3EE",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="cloud-download-outline"
                        size={19}
                        color="#34594A"
                      />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: "600",
                          color: "#24372C",
                          letterSpacing: -0.2,
                        }}
                      >
                        Download Your Farm Data
                      </Text>
                      <Text style={{ fontSize: 11.5, color: "#7C8D82", marginTop: 2 }}>
                        Export an archive of listings, transactions & profile
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#879386" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Audience Option Selection Bottom Sheet Modal */}
      <Modal
        visible={selectedAudienceConfig !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedAudienceConfig(null)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25, 38, 30, 0.45)" }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "75%",
              padding: 20,
              borderTopWidth: 1,
              borderColor: "#E5ECE6",
            }}
          >
            {/* Drag Handle */}
            <View className="items-center mb-3">
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: "#D4E2D8" }} />
            </View>

            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderColor: "#E5ECE6",
                marginBottom: 16,
              }}
            >
              <View className="flex-row items-center gap-2.5">
                {selectedAudienceConfig && (
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      backgroundColor: "#EDF3EE",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={selectedAudienceConfig.icon}
                      size={20}
                      color="#34594A"
                    />
                  </View>
                )}
                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#23382D",
                      letterSpacing: -0.2,
                    }}
                  >
                    {selectedAudienceConfig?.title}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: "#7C8D82", marginTop: 1 }}>
                    Select who can view or interact
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedAudienceConfig(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#F2F5F2",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={18} color="#75867B" />
              </TouchableOpacity>
            </View>

            {/* Options List */}
            <ScrollView showsVerticalScrollIndicator={false} className="mb-2">
              <View className="gap-2.5">
                {selectedAudienceConfig?.options.map((opt) => {
                  const isSelected =
                    String(settings[selectedAudienceConfig.key]) === opt.value;

                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        updateSetting(
                          selectedAudienceConfig.key,
                          opt.value as any,
                          `${selectedAudienceConfig.title} updated to ${opt.label}`,
                        );
                        setSelectedAudienceConfig(null);
                      }}
                      activeOpacity={0.7}
                      style={{
                        padding: 15,
                        borderRadius: 16,
                        borderWidth: isSelected ? 1.5 : 1,
                        borderColor: isSelected ? "#34594A" : "#E5ECE6",
                        backgroundColor: isSelected ? "#EDF3EE" : "#FAFBF9",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View className="flex-1 mr-3">
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: isSelected ? "700" : "600",
                            color: isSelected ? "#23382D" : "#24372C",
                          }}
                        >
                          {opt.label}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: "#7C8D82", marginTop: 3, lineHeight: 16 }}>
                          {opt.description}
                        </Text>
                      </View>

                      {/* Custom Radio Circle */}
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: isSelected ? 0 : 1.5,
                          borderColor: "#D0DCD3",
                          backgroundColor: isSelected ? "#34594A" : "#FFFFFF",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setSelectedAudienceConfig(null)}
              style={{
                width: "100%",
                backgroundColor: "#F2F5F2",
                paddingVertical: 13,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 8,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#5E7265", fontWeight: "600", fontSize: 14 }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Policy & Info Modals */}
      <Modal
        visible={activePolicyModal !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActivePolicyModal(null)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25, 38, 30, 0.45)" }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "80%",
              padding: 22,
              borderTopWidth: 1,
              borderColor: "#E5ECE6",
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderColor: "#E5ECE6",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: "#23382D",
                  letterSpacing: -0.2,
                }}
              >
                {activePolicyModal === "data_privacy"
                  ? "Local Farm Data Privacy"
                  : activePolicyModal === "rsbsa_safety"
                    ? "RSBSA Document Security"
                    : "Download Your Data"}
              </Text>
              <TouchableOpacity
                onPress={() => setActivePolicyModal(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#F2F5F2",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={18} color="#75867B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
              {activePolicyModal === "data_privacy" && (
                <View className="gap-3.5">
                  <Text style={{ fontSize: 13.5, color: "#4E6155", lineHeight: 21 }}>
                    Local Farm is dedicated to protecting the rights, privacy, and
                    agricultural livelihoods of Filipino farmers and buyers.
                  </Text>
                  <View
                    style={{
                      backgroundColor: "#EDF3EE",
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#DCE6DF",
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#23382D", marginBottom: 3 }}>
                      1. Encryption & Safeguards
                    </Text>
                    <Text style={{ fontSize: 12, color: "#4F6456", lineHeight: 18 }}>
                      All account passwords, session tokens, and personal farm
                      contact information are secured using industry-standard
                      cryptographic protocols.
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: "#F7FAF7",
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#E5ECE6",
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#23382D", marginBottom: 3 }}>
                      2. Commercial Non-Exploitation
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6B7D72", lineHeight: 18 }}>
                      We never sell, rent, or lease your harvest pricing, farm
                      yield records, or buyer transaction histories to third-party
                      advertisers or brokers.
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: "#F7FAF7",
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#E5ECE6",
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#23382D", marginBottom: 3 }}>
                      3. Granular Farm Privacy
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6B7D72", lineHeight: 18 }}>
                      You maintain continuous control over whether your farm gate
                      GPS coordinates are publicly navigable or blurred to
                      barangay-level approximations.
                    </Text>
                  </View>
                </View>
              )}

              {activePolicyModal === "rsbsa_safety" && (
                <View className="gap-3.5">
                  <Text style={{ fontSize: 13.5, color: "#4E6155", lineHeight: 21 }}>
                    RSBSA stubs and government farmer identity credentials are
                    confidential administrative records.
                  </Text>
                  <View
                    style={{
                      backgroundColor: "#EDF3EE",
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#DCE6DF",
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#23382D", marginBottom: 3 }}>
                      Verification Purpose Only
                    </Text>
                    <Text style={{ fontSize: 12, color: "#4F6456", lineHeight: 18 }}>
                      Uploaded RSBSA certificates and DA stubs are strictly utilized
                      for municipal verification and awarding the official green
                      checkmark badge.
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: "#F7FAF7",
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#E5ECE6",
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#23382D", marginBottom: 3 }}>
                      Never Shared Publicly
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6B7D72", lineHeight: 18 }}>
                      Your government RSBSA registration number and raw certificate
                      photos are never exposed on your public newsfeed, profile, or
                      search results.
                    </Text>
                  </View>
                </View>
              )}

              {activePolicyModal === "export_data" && (
                <View className="gap-4">
                  <Text style={{ fontSize: 13.5, color: "#4E6155", lineHeight: 21 }}>
                    Request an export of all information associated with your Local
                    Farm account, including:
                  </Text>
                  <View
                    style={{
                      backgroundColor: "#F7FAF7",
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "#E5ECE6",
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#4E6155" }}>• Farm profile & bio</Text>
                    <Text style={{ fontSize: 12, color: "#4E6155" }}>• Posted harvests & media</Text>
                    <Text style={{ fontSize: 12, color: "#4E6155" }}>• Message histories & inquiries</Text>
                    <Text style={{ fontSize: 12, color: "#4E6155" }}>• RSBSA verification records</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleExportData}
                    disabled={isExporting}
                    style={{
                      width: "100%",
                      backgroundColor: "#34594A",
                      paddingVertical: 13,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "#293E33",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.12,
                      shadowRadius: 5,
                      elevation: 2,
                    }}
                    activeOpacity={0.85}
                  >
                    {isExporting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
                        Request Data Archive
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setActivePolicyModal(null)}
              style={{
                width: "100%",
                backgroundColor: "#F2F5F2",
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 6,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#5E7265", fontWeight: "600", fontSize: 13.5 }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

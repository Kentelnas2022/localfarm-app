import { useToast } from "@/context/toast-context";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_RSBSA_STATE,
  getRSBSAApplication,
  RSBSAApplication,
} from "@/services/rsbsa-service";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Navigation from "../../components/Navigation";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FARM_DETAILS_STORAGE_KEY = "localfarm_user_farm_details_v1";

interface FarmDetails {
  farmName: string; // Farm or Product
  farmLocation: string;
  primaryCrops: string;
}

const DEFAULT_FARM_DETAILS: FarmDetails = {
  farmName: "",
  farmLocation: "",
  primaryCrops: "",
};

const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"];

// Floating Label Field with smooth placeholder animation
function FloatingLabelField({
  label,
  value,
  onChangeText,
  iconName,
  editable = true,
  isEditing = false,
  keyboardType,
  multiline,
  autoCapitalize,
  lockedBadge,
  children,
}: {
  label: string;
  value?: string;
  onChangeText?: (text: string) => void;
  iconName: keyof typeof Ionicons.glyphMap;
  editable?: boolean;
  isEditing?: boolean;
  keyboardType?: any;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  lockedBadge?: string;
  children?: React.ReactNode;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const hasValue = Boolean(value && value.trim().length > 0);
  const shouldFloat = !isEditing || isFocused || hasValue || Boolean(children);

  const animatedFocus = useRef(
    new Animated.Value(shouldFloat ? 1 : 0)
  ).current;

  useEffect(() => {
    Animated.timing(animatedFocus, {
      toValue: shouldFloat ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [shouldFloat]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleContainerPress = () => {
    if (isEditing && editable && !children) {
      inputRef.current?.focus();
    }
  };

  const labelTop = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [multiline ? 16 : 16, 5],
  });

  const labelFontSize = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [13.5, 10],
  });

  const labelColor = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: ["#7F9185", isFocused ? "#34594A" : "#6B7D72"],
  });

  const borderColor = isFocused
    ? "#34594A"
    : isEditing
    ? "#D8E3DB"
    : "#EAF0EC";

  const backgroundColor = isFocused
    ? "#FFFFFF"
    : isEditing
    ? "#FAFCFA"
    : "#F8FAF8";

  return (
    <Pressable
      onPress={handleContainerPress}
      style={[
        styles.floatingFieldContainer,
        {
          borderColor,
          backgroundColor,
          borderWidth: isFocused ? 1.5 : 1,
          minHeight: multiline ? (isEditing ? 96 : 72) : 56,
          alignItems: multiline ? "flex-start" : "center",
        },
      ]}
    >
      {/* Leading Icon */}
      <View
        style={[
          styles.floatingFieldIconBox,
          isFocused && styles.floatingFieldIconBoxFocused,
          multiline && { marginTop: 8 },
        ]}
      >
        <Ionicons
          name={iconName}
          size={16}
          color={isFocused ? "#34594A" : "#5F7467"}
        />
      </View>

      {/* Main Content Area */}
      <View style={styles.floatingFieldContent}>
        {/* Floating Animated Label */}
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.floatingLabelText,
            {
              top: labelTop,
              fontSize: labelFontSize,
              color: labelColor,
              fontWeight: isFocused ? "700" : "600",
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>

        {children ? (
          <View style={styles.floatingFieldCustomChild}>{children}</View>
        ) : isEditing && editable ? (
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            multiline={multiline}
            autoCapitalize={autoCapitalize}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[
              styles.floatingTextInput,
              multiline && {
                minHeight: 56,
                paddingTop: 22,
                textAlignVertical: "top",
              },
            ]}
          />
        ) : (
          <Text
            style={[
              styles.floatingValueText,
              !value && styles.floatingValueEmptyText,
              multiline && { marginTop: 22 },
            ]}
            numberOfLines={multiline ? undefined : 1}
          >
            {value || "Not specified"}
          </Text>
        )}
      </View>

      {/* Locked Badge if applicable */}
      {lockedBadge && (
        <View style={styles.lockedPill}>
          <Ionicons name="lock-closed" size={10} color="#34594A" />
          <Text style={styles.lockedPillText}>{lockedBadge}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Smooth subtle entrance for premium feel
function FadeEntrance({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
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
  scaleTo = 0.98,
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

export default function PersonalInformation() {
  const params = useLocalSearchParams<{ edit?: string; mode?: string }>();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  // Personal Info Form State
  const [formData, setFormData] = useState({
    name: user?.name || user?.fullName || "",
    username: user?.username || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    gender: user?.gender || "Male",
    bio: user?.about || user?.bio || "",
  });

  // Agricultural Profile State (Farm or Product)
  const [farmData, setFarmData] = useState<FarmDetails>({
    farmName: user?.farmName || "",
    farmLocation: user?.farmLocation || user?.location || "",
    primaryCrops: user?.primaryCrops || "",
  });

  // RSBSA Verification State
  const [rsbsaApp, setRsbsaApp] =
    useState<RSBSAApplication>(DEFAULT_RSBSA_STATE);

  // UI Control State
  const [isEditing, setIsEditing] = useState(
    params?.edit === "true" || params?.mode === "edit",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPicture, setIsChangingPicture] = useState(false);
  const [isPhotoOptionsVisible, setIsPhotoOptionsVisible] = useState(false);

  // Avatar adjustment state
  const [avatarUri, setAvatarUri] = useState<string>(user?.avatarUrl || "");
  const [avatarScale, setAvatarScale] = useState<number>(1);
  const [sliderProgress, setSliderProgress] = useState<number>(0.15);
  const [trackWidth, setTrackWidth] = useState<number>(280);

  // Check params for initial edit mode
  useEffect(() => {
    if (params?.edit === "true" || params?.mode === "edit") {
      setIsEditing(true);
    }
  }, [params?.edit, params?.mode]);

  // Sync user state on load
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || user.fullName || "",
        username: user.username || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        gender: user.gender || "Male",
        bio: user.about || user.bio || "",
      });
      setFarmData({
        farmName: user.farmName || "",
        farmLocation: user.farmLocation || user.location || "",
        primaryCrops: user.primaryCrops || "",
      });
      if (user.avatarUrl) {
        setAvatarUri(user.avatarUrl);
      }
    }
  }, [user]);

  // Load RSBSA and Farm Details from local storage
  useEffect(() => {
    let isMounted = true;
    const loadAgriculturalData = async () => {
      try {
        const app = await getRSBSAApplication();
        if (!isMounted) return;
        setRsbsaApp(app);

        if (user?.farmName || user?.farmLocation || user?.primaryCrops) {
          setFarmData({
            farmName: user.farmName || "",
            farmLocation: user.farmLocation || user.location || "",
            primaryCrops: user.primaryCrops || "",
          });
        } else {
          const savedFarm = await AsyncStorage.getItem(FARM_DETAILS_STORAGE_KEY);
          if (!isMounted) return;
          if (savedFarm) {
            const parsed = JSON.parse(savedFarm);
            setFarmData((prev) => ({ ...prev, ...parsed }));
          } else if (app && (app.farmName || app.location || app.crops)) {
            setFarmData({
              farmName: app.farmName || "",
              farmLocation: app.location || "",
              primaryCrops: app.crops || "",
            });
          }
        }
      } catch (err) {
        console.warn("Error loading agricultural profile data:", err);
      }
    };

    loadAgriculturalData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const updateSliderProgress = (locationX: number) => {
    if (trackWidth <= 0) return;
    const clampedX = Math.max(0, Math.min(locationX, trackWidth));
    setSliderProgress(clampedX / trackWidth);
  };

  const handleBack = () => {
    if (isChangingPicture) {
      setAvatarUri(user?.avatarUrl || "");
      setIsChangingPicture(false);
    } else if (isEditing) {
      handleCancelEdit();
    } else {
      try {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.push("/user/MenuProfile" as any);
        }
      } catch {
        router.push("/user/MenuProfile" as any);
      }
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      name: user?.name || user?.fullName || "",
      username: user?.username || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      gender: user?.gender || "Male",
      bio: user?.about || user?.bio || "",
    });
    setFarmData({
      farmName: user?.farmName || "",
      farmLocation: user?.farmLocation || user?.location || "",
      primaryCrops: user?.primaryCrops || "",
    });
    setIsEditing(false);
  };

  const handleDone = async () => {
    if (!formData.name.trim()) {
      showToast("Full name cannot be empty.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update user profile via auth context (persisting to PostgreSQL users table)
      await updateUser({
        name: formData.name.trim(),
        fullName: formData.name.trim(),
        username: formData.username.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        gender: formData.gender.trim(),
        about: formData.bio.trim(),
        bio: formData.bio.trim(),
        farmName: farmData.farmName.trim(),
        farmLocation: farmData.farmLocation.trim(),
        primaryCrops: farmData.primaryCrops.trim(),
      });

      // 2. Persist farm profile details
      await AsyncStorage.setItem(
        FARM_DETAILS_STORAGE_KEY,
        JSON.stringify(farmData),
      );

      // 3. Keep RSBSA application updated with farm profile if exists
      try {
        const currentRSBSA = await getRSBSAApplication();
        if (currentRSBSA && currentRSBSA.status !== "unverified") {
          const updatedRSBSA: RSBSAApplication = {
            ...currentRSBSA,
            fullName: formData.name.trim() || currentRSBSA.fullName,
            farmName: farmData.farmName || currentRSBSA.farmName,
            location: farmData.farmLocation || currentRSBSA.location,
            crops: farmData.primaryCrops || currentRSBSA.crops,
          };
          await AsyncStorage.setItem(
            "localfarm_rsbsa_verification_v1",
            JSON.stringify(updatedRSBSA),
          );
          setRsbsaApp(updatedRSBSA);
        }
      } catch (rsbsaSyncErr) {
        console.warn("RSBSA sync skipped:", rsbsaSyncErr);
      }

      setIsEditing(false);
      showToast("Personal & farm profile saved successfully!", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to update profile.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePicture = async () => {
    const newScale = 1 + sliderProgress * 1.2;
    setAvatarScale(newScale);
    setIsSaving(true);
    try {
      await updateUser({
        avatarUrl: avatarUri,
      });
      setIsChangingPicture(false);
      showToast("Profile picture updated successfully!", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to save picture.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelPicture = () => {
    setAvatarUri(user?.avatarUrl || "");
    setIsChangingPicture(false);
  };

  const pickImageFromGallery = async () => {
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
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setAvatarUri(uri);
        setSliderProgress(0.15);
        setIsChangingPicture(true);
        return;
      }
    } catch (error) {
      console.error("Error picking image from gallery:", error);
    }

    if (Platform.OS === "web" && typeof document !== "undefined") {
      try {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const res = event.target?.result;
              if (typeof res === "string") {
                setAvatarUri(res);
                setSliderProgress(0.15);
                setIsChangingPicture(true);
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } catch (webErr) {
        console.error("Web file picker error:", webErr);
      }
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      if (Platform.OS !== "web") {
        const permissionResult =
          await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
          showToast("Permission to access camera is required.", "warning");
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setAvatarUri(uri);
        setSliderProgress(0.15);
        setIsChangingPicture(true);
        return;
      }
    } catch (error) {
      console.error("Error taking photo:", error);
    }
  };

  // ---------------------------------------------------------------------------
  // Change Picture Screen View (Slider & Cropping)
  // ---------------------------------------------------------------------------
  if (isChangingPicture) {
    const thumbLeft = Math.max(
      0,
      Math.min(
        sliderProgress * (trackWidth || 280) - 12,
        (trackWidth || 280) - 24,
      ),
    );

    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancelPicture}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color="#293E33" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Change Picture</Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: "#FFFFFF" }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 20 }}
        >
          {/* Large Circular Profile Picture Preview */}
          <View style={{ alignItems: "center", justifyContent: "center", marginTop: 32, marginBottom: 24 }}>
            <TouchableOpacity
              onPress={pickImageFromGallery}
              activeOpacity={0.9}
              style={{ position: "relative" }}
              accessibilityRole="button"
              accessibilityLabel="Choose photo from gallery"
            >
              <View
                style={{
                  width: 240,
                  height: 240,
                  borderRadius: 120,
                  overflow: "hidden",
                  backgroundColor: "#F0F4EF",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#E5ECE6",
                }}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{
                      width: "100%",
                      height: "100%",
                      transform: [{ scale: 1 + sliderProgress * 1.2 }],
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ width: "100%", height: "100%", backgroundColor: "#34594A", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="person" size={110} color="#FFFFFF" />
                  </View>
                )}
              </View>

              {/* Gallery Icon Badge */}
              <View
                style={{
                  position: "absolute",
                  bottom: 6,
                  right: 12,
                  backgroundColor: "#34594A",
                  padding: 10,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                }}
              >
                <Ionicons name="images" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pickImageFromGallery}
              style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 6 }}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={18} color="#34594A" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#34594A" }}>
                Choose from gallery
              </Text>
            </TouchableOpacity>
          </View>

          {/* Slider & Actions Container */}
          <View style={{ width: "100%", maxWidth: 320, alignSelf: "center", marginTop: 10 }}>
            {/* Horizontal Slider Track */}
            <View
              onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(evt) =>
                updateSliderProgress(evt.nativeEvent.locationX)
              }
              onResponderMove={(evt) =>
                updateSliderProgress(evt.nativeEvent.locationX)
              }
              style={{ height: 32, justifyContent: "center", position: "relative" }}
            >
              <View style={{ height: 6, backgroundColor: "#EDF2EE", borderRadius: 3, width: "100%" }} />

              <View
                style={{
                  position: "absolute",
                  left: thumbLeft,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#34594A",
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                }}
              />
            </View>

            {/* Action Buttons: Cancel and Save */}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <TouchableOpacity
                onPress={handleCancelPicture}
                disabled={isSaving}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 13,
                  backgroundColor: "#F3F5F2",
                  borderWidth: 1,
                  borderColor: "#E2ECE4",
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#5E7265" }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSavePicture}
                disabled={isSaving}
                style={{
                  paddingHorizontal: 26,
                  paddingVertical: 12,
                  borderRadius: 13,
                  backgroundColor: "#34594A",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 100,
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Save"
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#FFFFFF" }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <Navigation activeTab="Menu" showFab={false} />
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Main View: Personal Information & Edit Information
  // ---------------------------------------------------------------------------
  const displayName = formData.name || user?.name || user?.fullName || "Grower";
  const isRSBSAVerified = rsbsaApp?.status === "verified";
  const isRSBSAPending = rsbsaApp?.status === "pending";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top Deep Forest Brand Banner Header (matching Reservations & Saved) */}
        <View style={styles.topBanner}>
          <View style={styles.bannerHeaderRow}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.bannerBackBtn}
              activeOpacity={0.75}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={isEditing ? "Cancel edit" : "Go back"}
            >
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.bannerTitleWrap}>
              <Text style={styles.bannerTitle}>
                {isEditing ? "Edit Information" : "Personal Information"}
              </Text>
              <Text style={styles.bannerSubtitle}>
                {isEditing
                  ? "Update farm & personal details"
                  : "Identity & Agricultural Details"}
              </Text>
            </View>

            <View style={{ width: 36 }} />
          </View>
        </View>

        {/* Overlapping Avatar Profile Section */}
        <FadeEntrance delay={20}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={[
                      styles.avatarImg,
                      { transform: [{ scale: avatarScale }] },
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={58} color="#9CA3AF" />
                  </View>
                )}
              </View>

              {/* Status Badge on Avatar */}
              {isRSBSAVerified ? (
                <View style={styles.avatarBadgeVerified}>
                  <Ionicons name="checkmark-circle" size={20} color="#2E7D5B" />
                </View>
              ) : (
                <View style={styles.avatarBadgeDot} />
              )}
            </View>

            {/* Profile Name & Primary Action */}
            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {displayName}
                </Text>
                {isRSBSAVerified && (
                  <Ionicons name="checkmark-circle" size={18} color="#2E7D5B" />
                )}
              </View>

              {/* Change Photo or Edit Information Action */}
              {isEditing ? (
                <TactileTouchable
                  onPress={() => setIsPhotoOptionsVisible(true)}
                  style={styles.actionPillBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Change picture"
                >
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                  <Text style={styles.actionPillText}>Change Photo</Text>
                </TactileTouchable>
              ) : (
                <TactileTouchable
                  onPress={() => setIsEditing(true)}
                  style={styles.actionPillBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Edit Information"
                >
                  <Ionicons name="create-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.actionPillText}>Edit Information</Text>
                </TactileTouchable>
              )}
            </View>
          </View>
        </FadeEntrance>

        {/* Content Body Container */}
        <View style={styles.bodyContent}>
          {/* ================================================================= */}
          {/* RSBSA VERIFICATION STATUS CARD (Hidden in Edit Mode)              */}
          {/* ================================================================= */}
          {!isEditing && (
            <FadeEntrance delay={60}>
              {isRSBSAVerified ? (
                <View style={styles.rsbsaCardVerified}>
                  <View style={styles.rsbsaCardRow}>
                    <View style={styles.rsbsaIconBoxVerified}>
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#2E7D5B"
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={styles.rsbsaTitleVerified}>
                          RSBSA Verified Grower
                        </Text>
                        <View style={styles.rsbsaPillVerified}>
                          <Text style={styles.rsbsaPillTextVerified}>
                            Official DA
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.rsbsaDescVerified} numberOfLines={1}>
                        {rsbsaApp?.rsbsaNumber
                          ? `Ref ID: ${rsbsaApp.rsbsaNumber}`
                          : "Department of Agriculture registered"}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push("/user/RSBSAVerification" as any)}
                      style={styles.rsbsaActionBtnVerified}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rsbsaActionTextVerified}>
                        Credentials →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : isRSBSAPending ? (
                <View style={styles.rsbsaCardPending}>
                  <View style={styles.rsbsaCardRow}>
                    <View style={styles.rsbsaIconBoxPending}>
                      <Ionicons name="time" size={20} color="#B45309" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={styles.rsbsaTitlePending}>
                          RSBSA Verification Pending
                        </Text>
                        <View style={styles.rsbsaPillPending}>
                          <Text style={styles.rsbsaPillTextPending}>
                            In Review
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.rsbsaDescPending} numberOfLines={1}>
                        Submitted for Municipal Agri Office verification.
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push("/user/RSBSAVerification" as any)}
                      style={styles.rsbsaActionBtnPending}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rsbsaActionTextPending}>
                        Track →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TactileTouchable
                  onPress={() => router.push("/user/RSBSAVerification" as any)}
                  style={styles.rsbsaCardUnverified}
                  accessibilityRole="button"
                  accessibilityLabel="Apply for RSBSA Grower Verification"
                >
                  <View style={styles.rsbsaCardRow}>
                    <View style={styles.rsbsaIconBoxUnverified}>
                      <Ionicons name="ribbon" size={20} color="#34594A" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.rsbsaTitleUnverified}>
                          Get RSBSA Verified
                        </Text>
                        <View style={styles.rsbsaPillUnverified}>
                          <Text style={styles.rsbsaPillTextUnverified}>
                            Badge
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.rsbsaDescUnverified}>
                        Register with the DA Registry System to earn the
                        verified grower badge & wholesale access.
                      </Text>
                    </View>
                    <View style={styles.rsbsaChevronWrap}>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#34594A"
                      />
                    </View>
                  </View>
                </TactileTouchable>
              )}
            </FadeEntrance>
          )}

          {/* ================================================================= */}
          {/* UNIFIED INFORMATION CONTAINER (Single container for view & edit)  */}
          {/* ================================================================= */}
          <FadeEntrance delay={80}>
            <View style={styles.unifiedCardContainer}>
              {/* SUBSECTION 1: Personal Identity */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="person" size={15} color="#34594A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Personal Identity</Text>
                  <Text style={styles.sectionSubtitle}>
                    {isEditing
                      ? "Update your personal name, username, and story"
                      : "Your personal profile details and bio"}
                  </Text>
                </View>
              </View>

              <FloatingLabelField
                label="Full Name"
                value={formData.name}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, name: text }))
                }
                iconName="person-outline"
                isEditing={isEditing}
              />

              <FloatingLabelField
                label="Username"
                value={formData.username}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, username: text }))
                }
                iconName="at-outline"
                autoCapitalize="none"
                isEditing={isEditing}
              />

              <FloatingLabelField
                label="Gender"
                value={formData.gender}
                iconName={
                  formData.gender === "Female"
                    ? "female-outline"
                    : formData.gender === "Male"
                    ? "male-outline"
                    : "male-female-outline"
                }
                isEditing={isEditing}
              >
                {isEditing ? (
                  <View style={styles.genderPillsRow}>
                    {GENDER_OPTIONS.map((g) => {
                      const isSelected = formData.gender === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          onPress={() =>
                            setFormData((prev) => ({ ...prev, gender: g }))
                          }
                          style={[
                            styles.genderPill,
                            isSelected && styles.genderPillSelected,
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.genderPillText,
                              isSelected && styles.genderPillTextSelected,
                            ]}
                          >
                            {g}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </FloatingLabelField>

              <FloatingLabelField
                label="Bio / Farm Story"
                value={formData.bio}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, bio: text }))
                }
                iconName="document-text-outline"
                multiline
                isEditing={isEditing}
              />

              {/* Section Divider */}
              <View style={styles.sectionDivider} />

              {/* SUBSECTION 2: Farm & Agricultural Identity */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="leaf" size={15} color="#34594A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>
                    Farm & Agricultural Identity
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    {isEditing
                      ? "Update your farm and harvest product details"
                      : "Your public grower credentials displayed across LocalFarm"}
                  </Text>
                </View>
              </View>

              <FloatingLabelField
                label="Farm or Product"
                value={farmData.farmName}
                onChangeText={(text) =>
                  setFarmData((prev) => ({ ...prev, farmName: text }))
                }
                iconName="storefront-outline"
                isEditing={isEditing}
              />

              <FloatingLabelField
                label="Farm Location (Barangay & Municipality)"
                value={farmData.farmLocation}
                onChangeText={(text) =>
                  setFarmData((prev) => ({ ...prev, farmLocation: text }))
                }
                iconName="location-outline"
                isEditing={isEditing}
              />

              <FloatingLabelField
                label="Primary Produce / Crops & Livestock"
                value={farmData.primaryCrops}
                onChangeText={(text) =>
                  setFarmData((prev) => ({ ...prev, primaryCrops: text }))
                }
                iconName="nutrition-outline"
                isEditing={isEditing}
              />

              {/* Section Divider */}
              <View style={styles.sectionDivider} />

              {/* SUBSECTION 3: Contact & Security */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="call" size={15} color="#34594A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Contact & Security</Text>
                  <Text style={styles.sectionSubtitle}>
                    Your direct communication and account login channels
                  </Text>
                </View>
              </View>

              <FloatingLabelField
                label="Phone Number"
                value={formData.phoneNumber}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, phoneNumber: text }))
                }
                iconName="call-outline"
                keyboardType="phone-pad"
                isEditing={isEditing}
              />

              <FloatingLabelField
                label="Email Address"
                value={formData.email || "user@localfarm.ph"}
                iconName="mail-outline"
                editable={false}
                lockedBadge="Primary"
                isEditing={isEditing}
              />
              {isEditing && (
                <Text style={styles.lockedNoteText}>
                  Primary login email cannot be edited directly for security.
                </Text>
              )}
            </View>
          </FadeEntrance>

          {/* ================================================================= */}
          {/* EDIT MODE BOTTOM ACTION BAR                                       */}
          {/* ================================================================= */}
          {isEditing && (
            <FadeEntrance delay={180}>
              <View style={styles.editActionBar}>
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  disabled={isSaving}
                  style={styles.cancelBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDone}
                  disabled={isSaving}
                  style={styles.saveBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Save Changes"
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={17} color="#FFFFFF" />
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </FadeEntrance>
          )}
        </View>
      </ScrollView>

      <Navigation activeTab="Menu" showFab={false} />

      {/* Photo Options Modal */}
      <Modal
        visible={isPhotoOptionsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPhotoOptionsVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsPhotoOptionsVisible(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Profile Picture</Text>
            <Text style={styles.modalSubtitle}>
              Select an option to update your photo
            </Text>

            {/* Option 1: Gallery */}
            <TouchableOpacity
              onPress={() => {
                setIsPhotoOptionsVisible(false);
                pickImageFromGallery();
              }}
              style={styles.modalOptionRow}
              accessibilityRole="button"
              accessibilityLabel="Choose from Gallery"
              activeOpacity={0.7}
            >
              <View style={styles.modalOptionIconBox}>
                <Ionicons name="images" size={18} color="#34594A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.modalOptionDesc}>
                  Pick an existing image from your device
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Camera */}
            <TouchableOpacity
              onPress={() => {
                setIsPhotoOptionsVisible(false);
                takePhotoWithCamera();
              }}
              style={styles.modalOptionRow}
              accessibilityRole="button"
              accessibilityLabel="Take Photo"
              activeOpacity={0.7}
            >
              <View style={styles.modalOptionIconBox}>
                <Ionicons name="camera" size={18} color="#34594A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Take Photo</Text>
                <Text style={styles.modalOptionDesc}>
                  Use your camera to take a new picture
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 3: Adjust Current Picture */}
            <TouchableOpacity
              onPress={() => {
                setIsPhotoOptionsVisible(false);
                setIsChangingPicture(true);
              }}
              style={styles.modalOptionRow}
              accessibilityRole="button"
              accessibilityLabel="Adjust Current Picture"
              activeOpacity={0.7}
            >
              <View style={styles.modalOptionIconBox}>
                <Ionicons name="crop" size={18} color="#34594A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Adjust Current Picture</Text>
                <Text style={styles.modalOptionDesc}>
                  Zoom and position your current avatar
                </Text>
              </View>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => setIsPhotoOptionsVisible(false)}
              style={styles.modalCancelBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              activeOpacity={0.8}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1EB",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F5F7F5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: "#293E33",
    textAlign: "center",
  },
  scrollArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Top Deep Forest Brand Banner (matching Reservations & Saved)
  topBanner: {
    backgroundColor: "#34594A",
    paddingTop: 14,
    paddingBottom: 68,
    paddingHorizontal: 16,
  },
  bannerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitleWrap: {
    alignItems: "center",
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: "#FFFFFF",
    textAlign: "center",
  },
  bannerSubtitle: {
    fontSize: 11.5,
    color: "#D2E3D6",
    textAlign: "center",
    marginTop: 2,
  },

  // Overlapping Avatar Section
  avatarSection: {
    marginTop: -52,
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "#E9EFEA",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E9EFEA",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeVerified: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#34594A",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  nameBlock: {
    alignItems: "center",
    marginTop: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileName: {
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: "#23382D",
    textAlign: "center",
  },
  actionPillBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#34594A",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionPillText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Content Container
  bodyContent: {
    paddingHorizontal: 16,
    marginTop: 18,
  },

  // RSBSA Status Cards (Crisp borders, zero harsh shadows)
  rsbsaCardUnverified: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5ECE6",
  },
  rsbsaCardVerified: {
    backgroundColor: "#F2F8F4",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#D5E8DC",
  },
  rsbsaCardPending: {
    backgroundColor: "#FEF9EC",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F7E6B8",
  },
  rsbsaCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rsbsaIconBoxUnverified: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#EDF3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  rsbsaIconBoxVerified: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#E1EFE6",
    alignItems: "center",
    justifyContent: "center",
  },
  rsbsaIconBoxPending: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#FDF0D1",
    alignItems: "center",
    justifyContent: "center",
  },
  rsbsaTitleUnverified: {
    fontSize: 14,
    fontWeight: "600",
    color: "#293E33",
  },
  rsbsaPillUnverified: {
    backgroundColor: "#EDF3EE",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rsbsaPillTextUnverified: {
    fontSize: 10,
    fontWeight: "700",
    color: "#34594A",
  },
  rsbsaDescUnverified: {
    fontSize: 11.5,
    lineHeight: 16,
    color: "#718376",
    marginTop: 2,
  },
  rsbsaChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#F4F7F3",
    alignItems: "center",
    justifyContent: "center",
  },
  rsbsaTitleVerified: {
    fontSize: 14,
    fontWeight: "700",
    color: "#184530",
  },
  rsbsaPillVerified: {
    backgroundColor: "#34594A",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rsbsaPillTextVerified: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  rsbsaDescVerified: {
    fontSize: 11.5,
    color: "#2B5E43",
    marginTop: 2,
  },
  rsbsaActionBtnVerified: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#CDE3D5",
  },
  rsbsaActionTextVerified: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#2E7D5B",
  },
  rsbsaTitlePending: {
    fontSize: 14,
    fontWeight: "700",
    color: "#78350F",
  },
  rsbsaPillPending: {
    backgroundColor: "#B45309",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rsbsaPillTextPending: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  rsbsaDescPending: {
    fontSize: 11.5,
    color: "#92400E",
    marginTop: 2,
  },
  rsbsaActionBtnPending: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#F2DC9D",
  },
  rsbsaActionTextPending: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#B45309",
  },

  // Single Unified Container (for both View and Edit modes)
  unifiedCardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5ECE6",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EDF3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: "#293E33",
  },
  sectionSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    color: "#7A887F",
    marginTop: 2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#EDF2EE",
    marginVertical: 14,
  },

  // Floating Label Fields (Smooth Placeholder Animation)
  floatingFieldContainer: {
    flexDirection: "row",
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  floatingFieldIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#F2F6F3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  floatingFieldIconBoxFocused: {
    backgroundColor: "#EBF3EE",
  },
  floatingFieldContent: {
    flex: 1,
    minHeight: 46,
    justifyContent: "center",
    position: "relative",
  },
  floatingLabelText: {
    position: "absolute",
    left: 0,
    right: 0,
    letterSpacing: -0.1,
  },
  floatingTextInput: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#22382B",
    paddingTop: 18,
    paddingBottom: 2,
    paddingHorizontal: 0,
    margin: 0,
    height: 48,
  },
  floatingValueText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1F3327",
    letterSpacing: -0.1,
    marginTop: 18,
    paddingBottom: 2,
  },
  floatingValueEmptyText: {
    color: "#8E9E94",
    fontWeight: "400",
  },
  floatingFieldCustomChild: {
    marginTop: 18,
    paddingBottom: 4,
  },

  // Gender Pill Selectors inside Floating Field
  genderPillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 2,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5ECE6",
    backgroundColor: "#F7FAF7",
    alignItems: "center",
    justifyContent: "center",
  },
  genderPillSelected: {
    backgroundColor: "#EDF3EE",
    borderColor: "#34594A",
    borderWidth: 1.5,
  },
  genderPillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#718376",
  },
  genderPillTextSelected: {
    color: "#34594A",
    fontWeight: "700",
  },

  // Locked Badge & Helper
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EDF3EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    marginLeft: 8,
  },
  lockedPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#34594A",
  },
  lockedNoteText: {
    fontSize: 11,
    color: "#839287",
    marginTop: 2,
    marginBottom: 4,
    marginLeft: 4,
  },

  // Edit Mode Action Bar
  editActionBar: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#F3F5F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2ECE4",
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#5E7265",
  },
  saveBtn: {
    flex: 2,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#34594A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  saveBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Photo Options Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(22, 38, 29, 0.45)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5ECE6",
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#293E33",
    textAlign: "center",
    marginBottom: 3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#7A887F",
    textAlign: "center",
    marginBottom: 16,
  },
  modalOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F7FAF7",
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E8EFE9",
    gap: 12,
  },
  modalOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EDF3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOptionTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#293E33",
  },
  modalOptionDesc: {
    fontSize: 11,
    color: "#7A887F",
    marginTop: 1,
  },
  modalCancelBtn: {
    marginTop: 6,
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: "#F3F5F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2ECE4",
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#5E7265",
  },
});

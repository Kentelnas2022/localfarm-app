import { useAuth } from "@/hooks/use-auth";
import { getRSBSAApplication, RSBSAApplication } from "@/services/rsbsa-service";
import { getMyReservationsApi } from "@/services/reservation-service";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Navigation from "../../components/Navigation";

// Smooth subtle entrance for premium feel
function FadeEntrance({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 340,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 340,
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

// Tactile press button with buttery spring animation
function TactileTouchable({
  children,
  onPress,
  style,
  disabled,
  activeOpacity = 0.85,
  scaleTo = 0.978,
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

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled}
        style={style}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MenuProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [rsbsaApp, setRsbsaApp] = useState<RSBSAApplication | null>(null);
  const [pendingReservationsCount, setPendingReservationsCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      getRSBSAApplication()
        .then((app) => {
          if (isMounted) setRsbsaApp(app);
        })
        .catch((err) => console.log("[MenuProfile] Failed to load RSBSA in MenuProfile:", err));

      getMyReservationsApi("seller", "pending")
        .then((res) => {
          if (isMounted && res && Array.isArray(res.reservations)) {
            setPendingReservationsCount(res.reservations.length);
          }
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }, [])
  );

  const isRSBSAVerified = rsbsaApp?.status === "verified";

  const handleBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/user/NewsFeed" as any);
      }
    } catch {
      router.push("/user/NewsFeed" as any);
    }
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut || isSwitching) return;
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (err) {
      console.warn("[MenuProfile] Logout error:", err);
    } finally {
      try {
        router.replace("/auth/Login" as any);
      } catch {
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "/auth/Login";
        }
      }
      setIsLoggingOut(false);
    }
  };

  const handleSwitchAccount = async () => {
    if (isSwitching || isLoggingOut) return;
    setIsSwitching(true);
    try {
      await signOut();
    } catch (err) {
      console.warn("[MenuProfile] Switch account error:", err);
    } finally {
      try {
        router.replace("/auth/Login" as any);
      } catch {
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "/auth/Login";
        }
      }
      setIsSwitching(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 14) }]}>
      {/* 1. Refined Minimalist Header with proper notch clearance */}
      <View style={styles.headerBar}>
        <TactileTouchable
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={21} color="#34594A" />
        </TactileTouchable>

        <Text style={styles.headerTitle}>Profile</Text>

        {/* Balance layout spacer */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
      >
        <View style={styles.contentWrap}>
          {/* 2. User Profile Hero Card */}
          <FadeEntrance delay={40}>
            <TactileTouchable
              onPress={() =>
                router.push({
                  pathname: "/user/UserProfile",
                  params: {
                    userId: user?.id,
                    userName: user?.name || user?.username || "Local Farmer",
                    userAvatar: user?.avatarUrl,
                    userRole: isRSBSAVerified
                      ? "RSBSA Verified Farmer"
                      : (user as any)?.role || "Farmer",
                    isVerified: isRSBSAVerified ? "true" : "false",
                  },
                } as any)
              }
              style={styles.profileCard}
              accessibilityRole="button"
              accessibilityLabel="Show profile"
            >
              <View style={styles.profileRow}>
                {/* Avatar with calm ring & status indicator */}
                <View style={styles.avatarWrapper}>
                  <View style={styles.avatarImageContainer}>
                    {user?.avatarUrl ? (
                      <Image
                        source={{ uri: user.avatarUrl }}
                        style={styles.avatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={24} color="#7A8D81" />
                    )}
                  </View>
                  {isRSBSAVerified && (
                    <View style={styles.verifiedBadgeCircle}>
                      <Ionicons name="checkmark-circle" size={17} color="#2A734D" />
                    </View>
                  )}
                </View>

                {/* Identity Info */}
                <View style={styles.profileInfo}>
                  <View style={styles.profileNameRow}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {user?.name || user?.username || "Local Farmer"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.profileSubtitle,
                      isRSBSAVerified && styles.profileSubtitleVerified,
                    ]}
                    numberOfLines={1}
                  >
                    {isRSBSAVerified
                      ? "RSBSA Verified Grower ✓"
                      : user?.email || "Manage your farm profile"}
                  </Text>
                </View>

                <View style={styles.chevronBox}>
                  <Ionicons name="chevron-forward" size={18} color="#97A69C" />
                </View>
              </View>
            </TactileTouchable>
          </FadeEntrance>

          {/* 3. Settings Section Header */}
          <FadeEntrance delay={80}>
            <Text style={styles.sectionHeading}>Settings</Text>

            <View style={styles.groupCard}>
              {/* Item 1: Personal Information */}
              <TactileTouchable
                onPress={() => router.push("/user/PersonalInformation" as any)}
                style={styles.menuRow}
                accessibilityRole="button"
              >
                <View style={styles.menuIconBox}>
                  <Ionicons name="person-outline" size={19} color="#34594A" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuTitle}>Personal Information</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#A2B0A6" />
              </TactileTouchable>

              <View style={styles.divider} />

              {/* Item 2: Security & Verification */}
              <TactileTouchable
                onPress={() => router.push("/user/Security" as any)}
                style={styles.menuRow}
                accessibilityRole="button"
                accessibilityLabel="Security and Verification"
              >
                <View style={styles.menuIconBox}>
                  <Ionicons name="shield-checkmark-outline" size={19} color="#34594A" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuTitle}>Security & Verification</Text>
                  <Text style={styles.menuDescription}>
                    Password, 2FA & RSBSA Grower Badge
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#A2B0A6" />
              </TactileTouchable>

              <View style={styles.divider} />

              {/* Item 3: Harvest Reservations (Highlighted with calm reservation theme) */}
              <TactileTouchable
                onPress={() => router.push("/user/Reservations" as any)}
                style={[styles.menuRow, styles.reservationRow]}
                accessibilityRole="button"
                accessibilityLabel="Harvest Reservations"
              >
                <View style={[styles.menuIconBox, styles.reservationIconBox]}>
                  <Ionicons name="basket-outline" size={19} color="#2A4F3E" />
                </View>
                <View style={styles.menuTextWrap}>
                  <View style={styles.rowInlineWithBadge}>
                    <Text style={styles.menuTitle}>Harvest Reservations</Text>
                    {pendingReservationsCount > 0 && (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>
                          {pendingReservationsCount} new
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.menuDescription}>
                    View buyers & manage pre-harvest bookings
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#2A4F3E" />
              </TactileTouchable>

              <View style={styles.divider} />

              {/* Item 4: Saved */}
              <TactileTouchable
                onPress={() => router.push("/user/SavedPosts" as any)}
                style={styles.menuRow}
                accessibilityRole="button"
              >
                <View style={styles.menuIconBox}>
                  <Ionicons name="bookmark-outline" size={19} color="#34594A" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuTitle}>Saved</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#A2B0A6" />
              </TactileTouchable>

              <View style={styles.divider} />

              {/* Item 5: Darkmode */}
              <View style={[styles.menuRow, { paddingVertical: 10 }]}>
                <View style={styles.menuIconBox}>
                  <Ionicons name="moon-outline" size={19} color="#34594A" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuTitle}>Darkmode</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={setIsDarkMode}
                  trackColor={{ false: "#E2E8E3", true: "#34594A" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E2E8E3"
                />
              </View>
            </View>
          </FadeEntrance>

          {/* 4. Support & Privacy Section */}
          <FadeEntrance delay={120}>
            <Text style={styles.sectionHeading}>Support & Policies</Text>

            <View style={styles.groupCard}>
              {/* Item 1: Help and support */}
              <TactileTouchable
                onPress={() =>
                  Alert.alert(
                    "Help & Support",
                    "Help & Support features are currently being updated. Please check back soon!",
                    [{ text: "OK" }]
                  )
                }
                style={styles.menuRow}
                accessibilityRole="button"
                accessibilityLabel="Help and support"
              >
                <View style={styles.menuIconBox}>
                  <Ionicons name="help-circle-outline" size={19} color="#34594A" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuTitle}>Help & support</Text>
                  <Text style={styles.menuDescription}>
                    FAQs, reporting & grower guides
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#A2B0A6" />
              </TactileTouchable>

              <View style={styles.divider} />

              {/* Item 2: Privacy Center */}
              <TactileTouchable
                onPress={() => router.push("/user/PrivacyCenter" as any)}
                style={styles.menuRow}
                accessibilityRole="button"
                accessibilityLabel="Privacy Center"
              >
                <View style={styles.menuIconBox}>
                  <Ionicons name="shield-checkmark-outline" size={19} color="#34594A" />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuTitle}>Privacy Center</Text>
                  <Text style={styles.menuDescription}>
                    Location safety, audience & policies
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color="#A2B0A6" />
              </TactileTouchable>
            </View>
          </FadeEntrance>

          {/* 5. Uniform Minimalist Action Buttons */}
          <FadeEntrance delay={160}>
            <View style={styles.actionsContainer}>
              {/* Switch Account Button (Uniform Calm Primary) */}
              <TactileTouchable
                style={[
                  styles.uniformButton,
                  styles.primaryActionButton,
                  (isSwitching || isLoggingOut) && styles.buttonDisabled,
                ]}
                onPress={handleSwitchAccount}
                disabled={isSwitching || isLoggingOut}
                accessibilityRole="button"
                accessibilityLabel="Switch account"
              >
                {isSwitching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.primaryButtonText}>
                  {isSwitching ? "Switching..." : "Switch account"}
                </Text>
              </TactileTouchable>

              {/* Logout Button (Uniform Calm Secondary Outline) */}
              <TactileTouchable
                style={[
                  styles.uniformButton,
                  styles.secondaryActionButton,
                  (isLoggingOut || isSwitching) && styles.buttonDisabled,
                ]}
                onPress={handleLogout}
                disabled={isLoggingOut || isSwitching}
                accessibilityRole="button"
                accessibilityLabel="Logout"
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#5A6D61" />
                ) : (
                  <Ionicons name="log-out-outline" size={18} color="#6E5454" />
                )}
                <Text style={styles.secondaryButtonText}>
                  {isLoggingOut ? "Logging out..." : "Log out"}
                </Text>
              </TactileTouchable>

              {/* Subtle Minimalist Footer */}
              <Text style={styles.footerBrand}>Local Farm • v1.0.0</Text>
            </View>
          </FadeEntrance>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <Navigation activeTab="Menu" showFab={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F9F7", // Calm organic background matching Reservations
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
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
  headerSpacer: {
    width: 38,
    height: 38,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 2,
    flexGrow: 1,
  },
  contentWrap: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },

  // Profile Hero Card
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5ECE6",
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 14,
  },
  avatarImageContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EDF3EE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E3ECE5",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  verifiedBadgeCircle: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 1,
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: "#23382D",
  },
  profileSubtitle: {
    fontSize: 12,
    color: "#75867B",
    marginTop: 2,
  },
  profileSubtitleVerified: {
    color: "#2C754E",
    fontWeight: "600",
  },
  chevronBox: {
    paddingLeft: 8,
  },

  // Headings
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#738579",
    marginBottom: 8,
    marginLeft: 6,
  },

  // Grouped Menu Cards
  groupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#E5ECE6",
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 6,
    elevation: 1,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EDF3EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  menuTextWrap: {
    flex: 1,
    justifyContent: "center",
  },
  menuTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#24372C",
    letterSpacing: -0.2,
  },
  menuDescription: {
    fontSize: 11,
    color: "#7C8D82",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F4F0",
    marginLeft: 49,
  },

  // Highlighted Harvest Reservation item
  reservationRow: {
    backgroundColor: "#FCFDFC",
    borderRadius: 12,
  },
  reservationIconBox: {
    backgroundColor: "#E4EDE6",
  },
  rowInlineWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pendingBadge: {
    backgroundColor: "#F3EBD8",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EADDC3",
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8B6B2F",
  },

  // Actions Container & Uniform Buttons
  actionsContainer: {
    marginTop: 4,
    gap: 10,
  },
  uniformButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryActionButton: {
    backgroundColor: "#34594A", // Calm deep forest green from Reservations
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  secondaryActionButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "#E0E7E1",
    shadowColor: "#293E33",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6E5454", // Subtle muted calm tone for destructive action
    letterSpacing: -0.2,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: "500",
    color: "#96A49B",
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 0.3,
  },
});

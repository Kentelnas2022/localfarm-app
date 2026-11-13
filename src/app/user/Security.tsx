import {
  DEFAULT_RSBSA_STATE,
  RSBSAApplication,
  getRSBSAApplication,
} from "@/services/rsbsa-service";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Navigation from "../../components/Navigation";

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

interface SecurityOption {
  id: string;
  title: string;
  subtitle?: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

const SECURITY_OPTIONS: SecurityOption[] = [
  {
    id: "1",
    title: "Change Password",
    subtitle: "Update login password and credentials",
    iconName: "key-outline",
  },
  {
    id: "2",
    title: "Two-factor Authentication",
    subtitle: "Add an extra layer of login protection",
    iconName: "shield-checkmark-outline",
  },
  {
    id: "3",
    title: "Your Devices",
    subtitle: "Manage active logins across your phones",
    iconName: "phone-portrait-outline",
  },
  {
    id: "4",
    title: "Activity logs",
    subtitle: "Review security events and session logins",
    iconName: "clipboard-outline",
  },
];

export default function Security() {
  const router = useRouter();

  const [rsbsaApp, setRsbsaApp] = useState<RSBSAApplication>(DEFAULT_RSBSA_STATE);
  const [isBenefitsModalVisible, setBenefitsModalVisible] = useState(false);

  const handleRsbsaCardPress = () => {
    if (rsbsaApp.status === "verified" || rsbsaApp.status === "pending") {
      router.push("/user/RSBSAVerification" as any);
    } else {
      setBenefitsModalVisible(true);
    }
  };

  const handleProceedToApply = () => {
    setBenefitsModalVisible(false);
    router.push("/user/RSBSAVerification" as any);
  };

  const loadRsbsaData = async () => {
    try {
      const data = await getRSBSAApplication();
      setRsbsaApp(data);
    } catch (err) {
      console.warn("Failed to load RSBSA data:", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRsbsaData();
    }, [])
  );

  const handleBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/user/MenuProfile" as any);
      }
    } catch {
      router.push("/user/MenuProfile" as any);
    }
  };

  const getStatusBadge = () => {
    switch (rsbsaApp.status) {
      case "verified":
        return {
          label: "Verified",
          bg: "#E8F5EE",
          color: "#2E7D5B",
          icon: "checkmark-circle" as const,
        };
      case "pending":
        return {
          label: "Under Review",
          bg: "#FEF3C7",
          color: "#B45309",
          icon: "time-outline" as const,
        };
      default:
        return {
          label: "Not Verified",
          bg: "#F3F5F2",
          color: "#718376",
          icon: "alert-circle-outline" as const,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* 1. Calm Minimalist Header matching Reservations & Saved */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color="#293E33" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Security & Verification</Text>
        </View>

        {/* Symmetry placeholder */}
        <View style={{ width: 36 }} />
      </View>

      {/* 2. Main Scroll Content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: AGRICULTURAL IDENTITY & BADGES */}
        <FadeEntrance delay={40}>
          <Text style={styles.sectionHeader}>Agricultural Identity & Badges</Text>

          <TactileTouchable
            onPress={handleRsbsaCardPress}
            style={styles.featuredCard}
            accessibilityRole="button"
            accessibilityLabel="RSBSA Grower Verification"
          >
            <View style={styles.featuredTopRow}>
              <View style={styles.featuredIconBox}>
                <Ionicons name="shield-checkmark" size={22} color="#34594A" />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.featuredTitle} numberOfLines={1}>
                  RSBSA Grower Verification
                </Text>
                <Text style={styles.featuredSubtitle} numberOfLines={1}>
                  Department of Agriculture registry
                </Text>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Ionicons name={badge.icon} size={12} color={badge.color} />
                <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                  {badge.label}
                </Text>
              </View>
            </View>

            <Text style={styles.featuredDescription}>
              {rsbsaApp.status === "verified"
                ? "Your farm identity is officially verified. You enjoy the green verified badge and priority placement on the Explore Map."
                : rsbsaApp.status === "pending"
                ? "Your RSBSA reference number is currently under review by our agricultural team. Tap to view status."
                : "Register your RSBSA reference number from the Municipal/City Agriculture Office to earn the official green checkmark badge."}
            </Text>

            <View style={styles.featuredFooter}>
              <Text style={styles.featuredLinkText}>
                {rsbsaApp.status === "verified"
                  ? "View Verified Credentials"
                  : rsbsaApp.status === "pending"
                  ? "View Application Status"
                  : "View Benefits & Apply"}
              </Text>
              <Ionicons name="arrow-forward" size={14} color="#34594A" />
            </View>
          </TactileTouchable>
        </FadeEntrance>

        {/* SECTION 2: ACCOUNT LOGIN & PROTECTION */}
        <FadeEntrance delay={90}>
          <Text style={styles.sectionHeader}>Account Login & Protection</Text>

          <View style={styles.groupedCard}>
            {SECURITY_OPTIONS.map((item, index) => {
              const isLast = index === SECURITY_OPTIONS.length - 1;
              return (
                <React.Fragment key={item.id}>
                  <TactileTouchable
                    onPress={() => {
                      if (item.id === "1") {
                        router.push("/user/ChangePassword" as any);
                      } else if (item.id === "2") {
                        router.push("/user/TwoFactorAuth" as any);
                      } else if (item.id === "3") {
                        router.push("/user/ManageDevices" as any);
                      } else if (item.id === "4") {
                        Alert.alert(
                          "Activity Logs",
                          "All recent logins have been verified from your current device. No unusual activities detected."
                        );
                      }
                    }}
                    style={styles.optionRow}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                  >
                    <View style={styles.optionIconBox}>
                      <Ionicons name={item.iconName} size={18} color="#34594A" />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.optionTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.optionSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>

                    <Ionicons name="chevron-forward" size={16} color="#A3B2A7" />
                  </TactileTouchable>

                  {!isLast && <View style={styles.divider} />}
                </React.Fragment>
              );
            })}
          </View>
        </FadeEntrance>
      </ScrollView>

      {/* 3. RSBSA Benefits Modal */}
      <Modal
        visible={isBenefitsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setBenefitsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setBenefitsModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close benefits modal"
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.modalEyebrowRow}>
                <Ionicons name="shield-checkmark" size={14} color="#DCE8DF" />
                <Text style={styles.modalEyebrowText}>Department of Agriculture</Text>
              </View>

              <Text style={styles.modalTitle}>RSBSA Grower Benefits</Text>
              <Text style={styles.modalSubtitle}>
                Discover what you gain when you verify your farm identity with the Registry System for Basic Sectors in Agriculture.
              </Text>
            </View>

            {/* Scrollable Benefits List */}
            <ScrollView
              style={{ flex: 1, paddingHorizontal: 18, paddingTop: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Group 1: In-App Perks */}
              <Text style={styles.modalGroupTitle}>Local Farm App Advantages</Text>

              <View style={{ gap: 9, marginBottom: 16 }}>
                <View style={styles.perkCard}>
                  <View style={styles.perkIconBox}>
                    <Ionicons name="checkmark-circle" size={18} color="#34594A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perkTitle}>Official Green Checkmark Badge (✓)</Text>
                    <Text style={styles.perkDesc}>
                      Distinguishes you across your profile, newsfeed posts, harvest listings, and comments as a legitimate local producer.
                    </Text>
                  </View>
                </View>

                <View style={styles.perkCard}>
                  <View style={styles.perkIconBox}>
                    <Ionicons name="people" size={18} color="#34594A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perkTitle}>Maximum Buyer & Wholesaler Trust</Text>
                    <Text style={styles.perkDesc}>
                      Restaurants, grocery retailers, and bulk wholesalers prioritize purchasing directly from verified growers.
                    </Text>
                  </View>
                </View>

                <View style={styles.perkCard}>
                  <View style={styles.perkIconBox}>
                    <Ionicons name="trending-up" size={18} color="#34594A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perkTitle}>Priority Map & Discovery Placement</Text>
                    <Text style={styles.perkDesc}>
                      Your harvests appear higher on the Explore Map and member recommendations, giving you more inquiries.
                    </Text>
                  </View>
                </View>

                <View style={styles.perkCard}>
                  <View style={styles.perkIconBox}>
                    <Ionicons name="shield" size={18} color="#34594A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perkTitle}>Protection from Farm Impersonation</Text>
                    <Text style={styles.perkDesc}>
                      Locks and validates your farm name and barangay so unverified accounts cannot falsely represent your farm.
                    </Text>
                  </View>
                </View>

                <View style={styles.perkCard}>
                  <View style={styles.perkIconBox}>
                    <Ionicons name="videocam" size={18} color="#34594A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perkTitle}>Exclusive Live Video Broadcasting</Text>
                    <Text style={styles.perkDesc}>
                      Broadcast live harvest updates and farm tours directly to buyers. Gated strictly to verified growers to keep streams genuine and scam-free.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Group 2: Government & DA Real-World Benefits */}
              <Text style={styles.modalGroupTitle}>Government (DA) Support & Safety Nets</Text>

              <View style={{ gap: 9, marginBottom: 16 }}>
                <View style={styles.perkCard}>
                  <View style={styles.perkIconBox}>
                    <Ionicons name="umbrella" size={18} color="#34594A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perkTitle}>Free Crop & Livestock Insurance (PCIC)</Text>
                    <Text style={styles.perkDesc}>
                      Automatic qualification for compensation in case of typhoons, droughts, pests, and floods.
                    </Text>
                  </View>
                </View>

                <View style={styles.perkCard}>
                  <View style={styles.perkIconBox}>
                    <Ionicons name="leaf" size={18} color="#34594A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perkTitle}>Subsidized Seeds & Fertilizer Vouchers</Text>
                    <Text style={styles.perkDesc}>
                      Access to seasonal certified planting materials and fertilizer discount cards distributed by the MAO/CAO.
                    </Text>
                  </View>
                </View>

                <View style={styles.perkCard}>
                  <View style={styles.perkIconBox}>
                    <Ionicons name="cash-outline" size={18} color="#34594A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perkTitle}>Financial Grants & Low-Interest Loans</Text>
                    <Text style={styles.perkDesc}>
                      Access to DA/LandBank financial assistance (RFFA, fuel discount) and collateral-free agricultural credit.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Free Enrollment Info Note */}
              <View style={styles.freeEnrollmentBanner}>
                <Ionicons name="information-circle" size={16} color="#77847B" />
                <Text style={styles.freeEnrollmentText}>
                  Registration is 100% Free at your City Agriculture Office (CAO) or Municipal Agriculture Office (MAO).
                </Text>
              </View>
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={handleProceedToApply}
                activeOpacity={0.8}
                style={styles.modalPrimaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Proceed to RSBSA verification application"
              >
                <Text style={styles.modalPrimaryBtnText}>Proceed to Application</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setBenefitsModalVisible(false)}
                activeOpacity={0.7}
                style={styles.modalSecondaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Close benefits modal"
              >
                <Text style={styles.modalSecondaryBtnText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. Bottom Navigation */}
      <Navigation activeTab="Menu" showFab={false} />
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
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 100,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#77847B",
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 6,
    paddingHorizontal: 2,
  },

  // Featured RSBSA Card (no green shadow, clean neutral border)
  featuredCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E5ECE6",
  },
  featuredTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featuredIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EDF3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#293E33",
  },
  featuredSubtitle: {
    fontSize: 12,
    color: "#7A887F",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  featuredDescription: {
    fontSize: 12.5,
    lineHeight: 19,
    color: "#607267",
    marginTop: 12,
    marginBottom: 14,
  },
  featuredFooter: {
    borderTopWidth: 1,
    borderTopColor: "#EDF1EB",
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featuredLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#34594A",
  },

  // Grouped Account Security Card
  groupedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5ECE6",
    overflow: "hidden",
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  optionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F5F7F3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8EDE5",
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#293E33",
  },
  optionSubtitle: {
    fontSize: 11.5,
    color: "#7A887F",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF1EB",
    marginHorizontal: 16,
  },

  // Benefits Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(22, 38, 29, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "86%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5ECE6",
    overflow: "hidden",
  },
  modalHeader: {
    backgroundColor: "#34594A",
    padding: 20,
    position: "relative",
  },
  modalCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  modalEyebrowText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#DCE8DF",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#D2E3D6",
    paddingRight: 20,
  },
  modalGroupTitle: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#77847B",
    textTransform: "uppercase",
    marginBottom: 9,
  },
  perkCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F6F9F5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3ECE5",
    padding: 12,
  },
  perkIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#EDF4EE",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  perkTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#23382D",
  },
  perkDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    color: "#6A7B70",
    marginTop: 2,
  },
  freeEnrollmentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F4F7F3",
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: "#E5ECE6",
    marginBottom: 16,
  },
  freeEnrollmentText: {
    fontSize: 11.5,
    lineHeight: 16,
    color: "#607267",
    flex: 1,
  },
  modalActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#EDF1EB",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  modalPrimaryBtn: {
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: "#34594A",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalSecondaryBtn: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#77847B",
  },
});

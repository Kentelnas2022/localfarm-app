import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { useToast } from "@/context/toast-context";
import {
  getMyReservationsApi,
  updateReservationStatusApi,
  HarvestReservation,
} from "@/services/reservation-service";
import DigitalReceiptModal from "@/components/DigitalReceiptModal";
import WeighInVerificationModal from "@/components/WeighInVerificationModal";

type FilterStatus = "all" | "pending" | "confirmed" | "ready_for_pickup" | "completed" | "cancelled";

// Subtle native-driven entrance; respect the device's reduced-motion preference.
function ReservationEntrance({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let alive = true;
    let animation: Animated.CompositeAnimation | undefined;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", reduced => {
      if (reduced) { animation?.stop(); progress.setValue(1); }
    });
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!alive || reduced) return;
      progress.setValue(0);
      animation = Animated.timing(progress, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" });
      animation.start();
    }).catch(() => progress.setValue(1));
    return () => { alive = false; animation?.stop(); subscription.remove(); };
  }, [delay, progress]);
  return <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}

export default function ReservationsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{
    postId?: string;
    cropName?: string;
    role?: "seller" | "buyer" | "all";
  }>();

  // Active Role tab: 'seller' = Customer Bookings (people who want to reserve my crops)
  // 'buyer' = My Pre-Orders (crops I reserved from other farmers)
  const [activeRole, setActiveRole] = useState<"seller" | "buyer">(
    params.role === "buyer" ? "buyer" : "seller"
  );
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [searchText, setSearchText] = useState("");
  const [filterPostId, setFilterPostId] = useState<string | null>(
    params.postId ? String(params.postId) : null
  );

  const [reservations, setReservations] = useState<HarvestReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Modals
  const [activeReceipt, setActiveReceipt] = useState<HarvestReservation | null>(null);
  const [weighInReservation, setWeighInReservation] = useState<HarvestReservation | null>(null);

  const loadReservations = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
        const res = await getMyReservationsApi(
          activeRole,
          "all",
          filterPostId || undefined
        );
        if (res && res.success && Array.isArray(res.reservations)) {
          setReservations(res.reservations);
        } else {
          setReservations([]);
        }
      } catch (err: any) {
        console.warn("[Reservations] Error loading reservations:", err.message);
        showToast("Could not load reservations.", "error");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeRole, filterPostId, showToast]
  );

  useEffect(() => {
    loadReservations(true);
  }, [loadReservations]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadReservations(false);
  };

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

  // Status update (Confirm, Mark Ready, Cancel)
  const handleUpdateStatus = async (
    reservation: HarvestReservation,
    newStatus: "confirmed" | "ready_for_pickup" | "cancelled"
  ) => {
    const actionLabel =
      newStatus === "confirmed"
        ? "Confirm"
        : newStatus === "ready_for_pickup"
        ? "Mark Ready for Pickup"
        : "Cancel";

    Alert.alert(
      `${actionLabel} Reservation?`,
      `Are you sure you want to ${actionLabel.toLowerCase()} reservation ${reservation.reservation_code}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: `Yes, ${actionLabel}`,
          style: newStatus === "cancelled" ? "destructive" : "default",
          onPress: async () => {
            setUpdatingId(reservation.id);
            try {
              const res = await updateReservationStatusApi(reservation.id, newStatus);
              if (res && res.success) {
                showToast(`Reservation ${actionLabel.toLowerCase()}ed!`, "success");
                loadReservations(false);
              } else {
                showToast(res.message || "Failed to update reservation.", "error");
              }
            } catch (err: any) {
              showToast(err.message || "Failed to update status.", "error");
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  // Copy reservation code to clipboard
  const handleCopyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    showToast(`Copied ${code} to clipboard!`, "info");
  };

  // Open Chat with the buyer or seller
  const handleOpenChat = (targetUser: {
    id: number | string;
    name?: string;
    avatar?: string;
  }) => {
    try {
      router.push({
        pathname: "/user/ChatConversation",
        params: {
          userId: String(targetUser.id),
          farmerId: String(targetUser.id),
          name: targetUser.name || "Customer",
          avatarUrl: targetUser.avatar || "",
          online: "true",
        },
      } as any);
    } catch {
      router.push("/user/Chats" as any);
    }
  };

  // Filtered reservations by search
  const filteredReservations = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const buyerName = r.buyer_name?.toLowerCase() || "";
      const sellerName = r.seller_name?.toLowerCase() || "";
      const crop = r.crop_name?.toLowerCase() || "";
      const code = r.reservation_code?.toLowerCase() || "";
      const notes = r.buyer_notes?.toLowerCase() || "";
      return (
        buyerName.includes(q) ||
        sellerName.includes(q) ||
        crop.includes(q) ||
        code.includes(q) ||
        notes.includes(q)
      );
    });
  }, [reservations, searchText, statusFilter]);

  // Status counts for badge indicators
  const statusCounts = useMemo(() => {
    const counts = {
      all: reservations.length,
      pending: 0,
      confirmed: 0,
      ready_for_pickup: 0,
      completed: 0,
      cancelled: 0,
    };
    reservations.forEach((r) => {
      if (r.status in counts) {
        counts[r.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [reservations]);

  const getStatusBadge = (status: HarvestReservation["status"]) => {
    const badges = {
      pending: { bg: "#F7F2E8", color: "#8A7042", label: "Pending approval", icon: "time-outline" },
      confirmed: { bg: "#EDF2F5", color: "#587184", label: "Confirmed", icon: "checkmark-circle-outline" },
      ready_for_pickup: { bg: "#EDF3EE", color: "#52785D", label: "Ready for pickup", icon: "cube-outline" },
      completed: { bg: "#EDF3EE", color: "#52785D", label: "Completed", icon: "shield-checkmark-outline" },
      cancelled: { bg: "#F8EEEE", color: "#986C6C", label: "Cancelled", icon: "close-circle-outline" },
    };
    return badges[status] || { bg: "#F1F3F2", color: "#6D7C73", label: status, icon: "ellipse-outline" };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. Header Bar — compact */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={21} color="#34594A" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={styles.headerTitle}>Reservations</Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Refresh reservations"
          disabled={isRefreshing || isLoading}
          onPress={onRefresh}
          style={styles.refreshIconBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={18} color="#4B5563" />
        </TouchableOpacity>
      </View>

      {/* 2. Post-Specific Filter Banner (If opened from a specific post) */}
      {filterPostId && (
        <View style={styles.postFilterBanner}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Ionicons name="leaf" size={18} color="#34594A" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#34594A", textTransform: "uppercase" }}>
                Filtered By Crop Post
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }} numberOfLines={1}>
                {params.cropName || `Post #${filterPostId}`}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setFilterPostId(null)}
            style={styles.viewAllFilterBtn}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#ffffff" }}>View All</Text>
            <Ionicons name="close-circle" size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Role Switcher Segmented Control */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: activeRole === "seller" }}
          onPress={() => setActiveRole("seller")}
          style={[
            styles.segmentButton,
            activeRole === "seller" && styles.segmentButtonActive,
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeRole === "seller" ? "#ffffff" : "#6B7280"}
          />
          <Text
            style={[
              styles.segmentText,
              activeRole === "seller" && styles.segmentTextActive,
            ]}
          >
            Customer Bookings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="tab"
          accessibilityState={{ selected: activeRole === "buyer" }}
          onPress={() => setActiveRole("buyer")}
          style={[
            styles.segmentButton,
            activeRole === "buyer" && styles.segmentButtonActive,
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="basket-outline"
            size={16}
            color={activeRole === "buyer" ? "#ffffff" : "#6B7280"}
          />
          <Text
            style={[
              styles.segmentText,
              activeRole === "buyer" && styles.segmentTextActive,
            ]}
          >
            My Pre-Orders
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Compact Status Filter Pills */}
      <View style={{ height: 40, marginBottom: 6 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, alignItems: "center" }}
        >
          {(
            [
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "confirmed", label: "Confirmed" },
              { key: "ready_for_pickup", label: "Ready" },
              { key: "completed", label: "Completed" },
              { key: "cancelled", label: "Cancelled" },
            ] as const
          ).map((item) => {
            const isSelected = statusFilter === item.key;
            const count = statusCounts[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setStatusFilter(item.key)}
                style={[
                  styles.filterPill,
                  isSelected ? styles.filterPillActive : styles.filterPillInactive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected ? styles.filterPillTextActive : styles.filterPillTextInactive,
                  ]}
                >
                  {item.label}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      isSelected ? styles.countBadgeActive : styles.countBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        isSelected ? styles.countBadgeTextActive : styles.countBadgeTextInactive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. Main List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#34594A"]} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#34594A" />
            <Text style={{ marginTop: 12, color: "#6B7280", fontSize: 13 }}>Loading reservations...</Text>
          </View>
        ) : filteredReservations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name={activeRole === "seller" ? "people-outline" : "basket-outline"}
                size={38}
                color="#779381"
              />
            </View>
            <Text style={styles.emptyTitle}>
              {searchText || statusFilter !== "all" ? "No matching reservations" : activeRole === "seller"
                ? "Your next harvest starts here"
                : "Something fresh is waiting"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchText || statusFilter !== "all" ? "Try another search or clear your filters to see your bookings." : activeRole === "seller"
                ? "When someone reserves your produce, you’ll find their booking and pickup details right here."
                : "Discover local harvests and reserve a little freshness for your next pickup."}
            </Text>
            {(searchText || statusFilter !== "all") && (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={() => { setSearchText(""); setStatusFilter("all"); }}><Text style={styles.btnTextGreen}>Clear filters</Text></TouchableOpacity>
            )}
            {activeRole === "buyer" && !searchText && statusFilter === "all" && (
              <TouchableOpacity
                onPress={() => router.push("/user/NewsFeed" as any)}
                style={styles.browseButton}
                activeOpacity={0.8}
              >
                <Ionicons name="newspaper-outline" size={18} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 14 }}>Explore local harvests</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredReservations.map((res, index) => {
            const badge = getStatusBadge(res.status);
            const isSeller = activeRole === "seller";
            const otherPersonName = isSeller
              ? res.buyer_name || res.buyer_username || "Local Buyer"
              : res.seller_name || res.seller_username || res.farm_name || "Local Farmer";
            const otherPersonAvatar = isSeller ? res.buyer_avatar : res.seller_avatar;
            const otherPersonPhone = isSeller ? res.buyer_phone : res.seller_phone;
            const otherPersonId = isSeller ? res.buyer_id : res.seller_id;
            const isProcessing = updatingId === res.id;

            return (
              <ReservationEntrance key={activeRole + res.id} delay={Math.min(index, 4) * 45}>
              <View style={styles.cardContainer}>
                {/* Card Header: Code & Status */}
                <View style={styles.cardHeader}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={"Copy reservation code " + res.reservation_code}
                    onPress={() => handleCopyCode(res.reservation_code)}
                    style={styles.codePill}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="copy-outline" size={13} color="#4B5563" />
                    <Text style={styles.codeText}>{res.reservation_code}</Text>
                  </TouchableOpacity>

                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Ionicons name={badge.icon as any} size={12} color={badge.color} />
                    <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>

                {/* Person Information Row (Buyer if seller view, Seller if buyer view) */}
                <View style={styles.personRow}>
                  <View style={styles.avatarWrap}>
                    {otherPersonAvatar ? (
                      <Image source={{ uri: otherPersonAvatar }} style={styles.avatarImg} />
                    ) : (
                      <Ionicons name="person" size={20} color="#9CA3AF" />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ alignItems: "flex-start", gap: 4 }}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {otherPersonName}
                      </Text>
                      <View style={styles.roleTag}>
                        <Text style={styles.roleTagText}>{isSeller ? "Customer" : "Grower"}</Text>
                      </View>
                    </View>
                    <Text style={styles.personSubtext} numberOfLines={1}>
                      {otherPersonPhone ? otherPersonPhone : isSeller ? (res.buyer_email || "Customer") : (res.farm_name || "Farm Producer")}
                    </Text>
                  </View>

                  {/* Quick Action: Chat & Call */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {otherPersonPhone && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${otherPersonPhone}`)}
                        style={styles.roundActionBtn}
                        activeOpacity={0.7}
                        accessibilityLabel="Call"
                      >
                        <Ionicons name="call" size={15} color="#34594A" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() =>
                        handleOpenChat({
                          id: otherPersonId,
                          name: otherPersonName,
                          avatar: otherPersonAvatar,
                        })
                      }
                      style={styles.roundActionBtn}
                      activeOpacity={0.7}
                      accessibilityLabel="Message"
                    >
                      <Ionicons name="chatbubble-ellipses" size={15} color="#34594A" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Product / Batch Details Box */}
                <View style={styles.detailsBox}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <View style={styles.cropIcon}>
                        <Ionicons name="leaf" size={14} color="#34594A" />
                      </View>
                      <Text style={styles.cropTitle} numberOfLines={2}>
                        {res.crop_name}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}><Text style={styles.amountTotal}>
                      ₱{Number(res.final_settled_amount ?? res.total_estimated_amount).toFixed(2)}
                    </Text><Text style={styles.amountCaption}>{res.status === "completed" ? "Final total" : "Estimated total"}</Text></View>
                  </View>

                  <View style={styles.specsRow}>
                    <Text style={styles.specsText}>
                      Reserved: <Text style={{ fontWeight: "700", color: "#111827" }}>{res.quantity} {res.unit || "kg"}</Text> @ ₱{Number(res.price_per_unit).toFixed(2)}/{res.unit || "kg"}
                    </Text>
                  </View>

                  {res.actual_weighed_quantity != null && (
                    <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="scale" size={13} color="#52785D" />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#52785D" }}>
                        Scale Verified: {res.actual_weighed_quantity} {res.unit || "kg"} (Settled: ₱{Number(res.final_settled_amount).toFixed(2)})
                      </Text>
                    </View>
                  )}

                  <View style={styles.metaRow}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                      <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                      <Text style={styles.metaText}>
                        Harvest: {res.harvest_date ? new Date(res.harvest_date).toLocaleDateString() : "Upcoming"}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
                      <Ionicons name="location-outline" size={12} color="#6B7280" />
                      <Text style={[styles.metaText, { flex: 1 }]}>
                        {res.pickup_location || "Local Market Hub"}
                      </Text>
                    </View>
                  </View>

                  {/* Buyer Notes */}
                  {res.buyer_notes && (
                    <View style={styles.notesBubble}>
                      <Ionicons name="chatbox-ellipses-outline" size={13} color="#6B7280" />
                      <Text style={styles.notesText} numberOfLines={2}>
                        "{res.buyer_notes}"
                      </Text>
                    </View>
                  )}
                </View>

                {/* Card Action Footer */}
                <View style={styles.cardFooter}>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#34594A" style={{ marginVertical: 6 }} />
                  ) : isSeller ? (
                    // SELLER ACTIONS (Farmer managing incoming reservations)
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%" }}>
                      {res.status === "pending" && (
                        <>
                          <TouchableOpacity
                            onPress={() => handleUpdateStatus(res, "confirmed")}
                            style={[styles.actionBtn, styles.btnConfirm]}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="checkmark-circle" size={15} color="#ffffff" />
                            <Text style={styles.btnTextWhite}>Confirm booking</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleUpdateStatus(res, "cancelled")}
                            style={[styles.actionBtn, styles.btnCancel]}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="close" size={15} color="#986C6C" />
                            <Text style={styles.btnTextRed}>Decline</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {res.status === "confirmed" && (
                        <>
                          <TouchableOpacity
                            onPress={() => handleUpdateStatus(res, "ready_for_pickup")}
                            style={[styles.actionBtn, styles.btnReady]}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="cube" size={15} color="#ffffff" />
                            <Text style={styles.btnTextWhite}>Mark ready</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => setWeighInReservation(res)}
                            style={[styles.actionBtn, styles.btnWeigh]}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="scale" size={15} color="#34594A" />
                            <Text style={styles.btnTextGreen}>Weigh in</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {res.status === "ready_for_pickup" && (
                        <TouchableOpacity
                          onPress={() => setWeighInReservation(res)}
                          style={[styles.actionBtn, styles.btnConfirm, { flex: 1 }]}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="scale" size={16} color="#ffffff" />
                          <Text style={styles.btnTextWhite}>Complete pickup</Text>
                        </TouchableOpacity>
                      )}

                      {res.status === "completed" && (
                        <TouchableOpacity
                          onPress={() => setActiveReceipt(res)}
                          style={[styles.actionBtn, styles.btnReceipt, { flex: 1 }]}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="receipt-outline" size={15} color="#52785D" />
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#52785D" }}>
                            View Digital Scale Receipt
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    // BUYER ACTIONS (User checking their pre-orders)
                    <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
                      <TouchableOpacity
                        onPress={() => setActiveReceipt(res)}
                        style={[styles.actionBtn, styles.btnConfirm, { flex: 1 }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="qr-code-outline" size={16} color="#ffffff" />
                        <Text style={styles.btnTextWhite}>Pickup receipt</Text>
                      </TouchableOpacity>

                      {res.status === "pending" && (
                        <TouchableOpacity
                          onPress={() => handleUpdateStatus(res, "cancelled")}
                          style={[styles.actionBtn, styles.btnCancel]}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.btnTextRed}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
              </ReservationEntrance>
            );
          })
        )}
      </ScrollView>

      {/* 7. Modals: Digital Receipt & Weigh-In */}
      <DigitalReceiptModal
        visible={!!activeReceipt}
        onClose={() => setActiveReceipt(null)}
        reservation={activeReceipt}
        isSeller={activeRole === "seller"}
        onOpenWeighIn={(r) => {
          setActiveReceipt(null);
          setWeighInReservation(r);
        }}
      />

      <WeighInVerificationModal
        visible={!!weighInReservation}
        onClose={() => setWeighInReservation(null)}
        reservation={weighInReservation}
        onSuccess={(updatedReceipt) => {
          setWeighInReservation(null);
          setActiveReceipt(updatedReceipt);
          loadReservations(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: "#FFFFFF" },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F5F7F5", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", letterSpacing: -0.4, color: "#293E33", textAlign: "center" },
  refreshIconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: "#E7ECE8", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  postFilterBanner: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: "#F4F7F3", flexDirection: "row", alignItems: "center", gap: 8 },
  viewAllFilterBtn: { backgroundColor: "#34594A", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  segmentedContainer: { flexDirection: "row", marginHorizontal: 16, marginBottom: 10, padding: 4, backgroundColor: "#F3F5F2", borderRadius: 14 },
  segmentButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 42, paddingHorizontal: 6, paddingVertical: 9, borderRadius: 11 },
  segmentButtonActive: { backgroundColor: "#34594A", shadowColor: "#293E33", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 5, elevation: 2 },
  segmentText: { fontSize: 12, fontWeight: "600", color: "#728076", flexShrink: 1, textAlign: "center" },
  segmentTextActive: { color: "#FFFFFF", fontWeight: "600" },
  filterPill: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 30, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  filterPillActive: { backgroundColor: "#EDF3EE", borderColor: "#EDF3EE" },
  filterPillInactive: { backgroundColor: "#FFFFFF", borderColor: "#EDF0EC" },
  filterPillText: { fontSize: 11 },
  filterPillTextActive: { color: "#34594A", fontWeight: "600" },
  filterPillTextInactive: { color: "#77847B", fontWeight: "500" },
  countBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 5 },
  countBadgeActive: { backgroundColor: "#DCE8DF" },
  countBadgeInactive: { backgroundColor: "#F3F5F2" },
  countBadgeText: { fontSize: 9, fontWeight: "600" },
  countBadgeTextActive: { color: "#34594A" },
  countBadgeTextInactive: { color: "#728076" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: 40, paddingBottom: 70 },
  emptyIconCircle: { width: 82, height: 82, borderRadius: 28, backgroundColor: "#F1F5EF", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "600", letterSpacing: -0.3, color: "#293E33", textAlign: "center", marginBottom: 10 },
  emptySubtitle: { fontSize: 13, color: "#7A887F", textAlign: "center", lineHeight: 21, marginBottom: 24, maxWidth: 290 },
  browseButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#34594A", paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  clearFiltersButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: "#EDF3EE" },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5ECE6",
  },
  cardHeader: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  codePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, borderRadius: 8 },
  codeText: { fontSize: 10, fontWeight: "600", color: "#75857A", letterSpacing: 0.5 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: "600" },
  personRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  avatarWrap: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#F0F4EF", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  personName: { fontSize: 14, fontWeight: "600", color: "#293E33", maxWidth: "100%" },
  roleTag: { backgroundColor: "#F0F4EF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  roleTagText: { fontSize: 9, fontWeight: "500", color: "#718376" },
  personSubtext: { fontSize: 11, color: "#7A887F", marginTop: 4 },
  roundActionBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#F5F7F3", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E8EDE5" },
  detailsBox: { backgroundColor: "#FFFFFF", paddingTop: 14, borderTopWidth: 1, borderTopColor: "#EDF1EB" },
  cropIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#EDF3E9", alignItems: "center", justifyContent: "center" },
  cropTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: "#293E33", flex: 1 },
  amountTotal: { fontSize: 17, fontWeight: "700", letterSpacing: -0.4, color: "#34594A" },
  amountCaption: { marginTop: 3, fontSize: 9, color: "#7A887F" },
  specsRow: { flexDirection: "row", alignItems: "center" },
  specsText: { fontSize: 12, lineHeight: 20, color: "#718075" },
  metaRow: { gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EDF1EB" },
  metaText: { fontSize: 11, lineHeight: 17, color: "#718075", fontWeight: "400" },
  notesBubble: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: "#F7F9F5", flexDirection: "row", alignItems: "flex-start", gap: 6 },
  notesText: { fontSize: 11, lineHeight: 17, color: "#718075", flex: 1 },
  cardFooter: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#EDF1EB" },
  actionBtn: { minHeight: 42, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  btnConfirm: { backgroundColor: "#34594A", flex: 1, minWidth: 130 },
  btnReady: { backgroundColor: "#34594A", flex: 1, minWidth: 110 },
  btnCancel: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EDDEDE", paddingHorizontal: 14 },
  btnWeigh: { backgroundColor: "#F1F5EF", borderWidth: 1, borderColor: "#E3EADF", flex: 1, minWidth: 110 },
  btnReceipt: { backgroundColor: "#F1F5EF", borderWidth: 1, borderColor: "#E3EADF" },
  btnTextWhite: { fontSize: 12, fontWeight: "600", color: "#FFFFFF", flexShrink: 1, textAlign: "center" },
  btnTextRed: { fontSize: 12, fontWeight: "600", color: "#986C6C" },
  btnTextGreen: { fontSize: 12, fontWeight: "600", color: "#34594A", flexShrink: 1, textAlign: "center" },
});

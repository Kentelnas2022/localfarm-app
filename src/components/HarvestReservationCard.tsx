import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { PostItem } from "@/services/post-service";

type Props = {
  post: PostItem;
  onReserve: () => void;
  onViewBookings: () => void;
};

/** Compact harvest offer shown within a newsfeed post. */
export default function HarvestReservationCard({ post, onReserve, onViewBookings }: Props) {
  const unit = post.unit || "kg";
  const capacity = Number(post.availableQuantity);
  const booked = Math.max(0, Number(post.reservedQuantity) || 0);
  const hasCapacity = Number.isFinite(capacity) && capacity > 0;
  const progress = hasCapacity ? Math.min(100, (booked / capacity) * 100) : 0;
  const harvestDate = post.expectedHarvestDate ? new Date(post.expectedHarvestDate) : null;
  const harvestLabel = harvestDate && !Number.isNaN(harvestDate.getTime())
    ? harvestDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Date to be announced";
  const price = post.pricePerUnit;
  const hasPrice = price != null && Number.isFinite(Number(price));

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.icon}><Ionicons name="leaf-outline" size={20} color="#617D68" /></View>
        <View style={styles.product}>
          <Text style={styles.eyebrow}>UPCOMING HARVEST</Text>
          <Text style={styles.title}>{post.cropName || "Fresh harvest batch"}</Text>
        </View>
      </View>

      <View style={styles.harvest}>
        <Ionicons name="calendar-outline" size={13} color="#819086" />
        <Text style={styles.harvestText}>Expected {harvestLabel}</Text>
      </View>

      <View style={styles.purchaseRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>Farm price</Text>
          <Text style={styles.price}>
            {hasPrice ? `₱${Number(price).toFixed(2)}` : "Ask grower"}
            {hasPrice && <Text style={styles.unit}> / {unit}</Text>}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onReserve}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={`Reserve ${post.cropName || "this harvest"}`}
          style={styles.reserveButton}
        >
          <Text style={styles.reserveText}>Reserve</Text>
          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {hasCapacity ? (
        <TouchableOpacity onPress={onViewBookings} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`View reservations: ${booked} of ${capacity} ${unit} reserved`} style={styles.availability}>
          <View style={styles.availabilityRow}>
            <Text style={styles.availabilityText}><Text style={styles.booked}>{booked} {unit}</Text> reserved</Text>
            <View style={styles.capacity}><Text style={styles.capacityText}>of {capacity} {unit}</Text><Ionicons name="chevron-forward" size={12} color="#8A988D" /></View>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        </TouchableOpacity>
      ) : post.pickupHub ? (
        <View style={styles.pickup}><Ionicons name="location-outline" size={13} color="#819086" /><Text style={styles.harvestText}>{post.pickupHub}</Text></View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, padding: 16, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E3EAE2" },
  heading: { flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#F0F4ED", alignItems: "center", justifyContent: "center" },
  product: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 8, fontWeight: "600", letterSpacing: 1.4, color: "#7D8B7E", marginBottom: 5 },
  title: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: -0.2, color: "#2C4033" },
  harvest: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  harvestText: { flexShrink: 1, fontSize: 11, lineHeight: 17, color: "#748377" },
  purchaseRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#EDF1EB" },
  priceBlock: { flexGrow: 1 },
  priceLabel: { fontSize: 10, color: "#7C8B80", marginBottom: 3 },
  price: { fontSize: 22, lineHeight: 28, fontWeight: "600", letterSpacing: -0.7, color: "#345440" },
  unit: { fontSize: 11, fontWeight: "400", letterSpacing: 0, color: "#7A897D" },
  reserveButton: { minHeight: 44, paddingHorizontal: 17, paddingVertical: 12, borderRadius: 13, backgroundColor: "#345944", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  reserveText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  availability: { paddingTop: 16, paddingBottom: 2, minHeight: 44 },
  availabilityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 },
  availabilityText: { flexShrink: 1, fontSize: 10, color: "#819084" },
  booked: { fontWeight: "500", color: "#5E7664" },
  capacity: { flexDirection: "row", alignItems: "center", gap: 3 },
  capacityText: { fontSize: 10, color: "#819084" },
  track: { height: 4, borderRadius: 4, overflow: "hidden", backgroundColor: "#EEF2EB" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: "#A3B69A" },
  pickup: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 14 },
});

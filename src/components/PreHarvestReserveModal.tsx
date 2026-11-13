import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createReservationApi, HarvestReservation } from '@/services/reservation-service';
import { useToast } from '@/context/toast-context';

interface PreHarvestReserveModalProps {
  visible: boolean;
  onClose: () => void;
  post: {
    id: string | number;
    cropName?: string | null;
    content?: string;
    authorName?: string;
    isVerified?: boolean;
    pricePerUnit?: number | null;
    unit?: string;
    expectedHarvestDate?: string | null;
    availableQuantity?: number | null;
    reservedQuantity?: number;
    pickupHub?: string | null;
    location?: string;
  } | null;
  onSuccess: (reservation: HarvestReservation) => void;
}

export default function PreHarvestReserveModal({
  visible,
  onClose,
  post,
  onSuccess,
}: PreHarvestReserveModalProps) {
  const { showToast } = useToast();
  const [quantity, setQuantity] = useState<number>(5);
  const [customInput, setCustomInput] = useState<string>('5');
  const [buyerNotes, setBuyerNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!post) return null;

  const cropName =
    post.cropName ||
    post.content?.split('\n')[0].replace(/^[#*-\s]+/, '').slice(0, 45) ||
    'Fresh Produce';
  const price = Number(post.pricePerUnit) || 35;
  const unit = post.unit || 'kg';
  const pickupLocation = post.pickupHub || post.location || 'Northern Valley Central Market Hub';

  // Calculate days left
  let daysLeftText = 'Harvest Soon';
  try {
    if (post.expectedHarvestDate) {
      const target = new Date(post.expectedHarvestDate);
      const diffDays = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        daysLeftText = `${diffDays} days to harvest`;
      } else if (diffDays === 0) {
        daysLeftText = 'Harvesting Today!';
      } else {
        daysLeftText = 'Freshly Harvested';
      }
    }
  } catch {}

  const totalAmount = (quantity * price).toFixed(2);

  const handleAdjustQuantity = (delta: number) => {
    const next = Math.max(1, quantity + delta);
    setQuantity(next);
    setCustomInput(String(next));
  };

  const handleInputChange = (text: string) => {
    setCustomInput(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0) {
      setQuantity(parsed);
    }
  };

  const handleSubmit = async () => {
    if (quantity <= 0) {
      showToast('Please enter at least 1 unit to reserve.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createReservationApi({
        postId: post.id,
        quantity,
        buyerNotes: buyerNotes.trim(),
      });

      if (res.success) {
        showToast(`Harvest Reserved! Advance booking for ${cropName} confirmed.`, 'success');
        const fallbackReservation: HarvestReservation = {
          id: res.reservation?.id || Date.now(),
          reservation_code: res.reservation?.reservation_code || `LF-RES-${Math.floor(1000 + Math.random() * 9000)}`,
          post_id: Number(post.id),
          seller_id: 0,
          buyer_id: 0,
          crop_name: cropName,
          quantity,
          unit,
          price_per_unit: price,
          total_estimated_amount: Number(totalAmount),
          harvest_date: post.expectedHarvestDate || new Date().toISOString(),
          pickup_location: pickupLocation,
          status: 'pending',
          qr_token: res.reservation?.qr_token || `QR_${Date.now()}`,
          buyer_notes: buyerNotes.trim() || null,
          created_at: new Date().toISOString(),
          ...(res.reservation || {}),
        };
        onSuccess(fallbackReservation);
        onClose();
      } else {
        showToast(res.message || 'Could not place reservation.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Unable to connect to server.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Subtle Top Pull Handle */}
          <View style={styles.handleBar} />

          {/* Clean Editorial Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={styles.eyebrowRow}>
                <Ionicons name="leaf" size={11} color="#3d6349" />
                <Text style={styles.eyebrowText}>PRE-HARVEST ALLOCATION</Text>
              </View>
              <Text style={styles.titleText}>Reserve Harvest Batch</Text>
              <Text style={styles.subtitleText} numberOfLines={1}>
                Direct from verified grower • {post.location || pickupLocation}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={17} color="#516859" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Batch Info Hero Card - Quiet Luxury */}
            <View style={styles.batchCard}>
              <View style={styles.batchTopRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.cropNameText}>{cropName}</Text>
                  <View style={styles.growerRow}>
                    <Text style={styles.growerName}>{post.authorName || 'Local Producer'}</Text>
                    {post.isVerified && (
                      <Ionicons name="checkmark-circle" size={13} color="#2b5037" />
                    )}
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.hubInlineText} numberOfLines={1}>
                      {pickupLocation}
                    </Text>
                  </View>
                </View>

                {/* Refined Harvest Countdown Tag */}
                <View style={styles.daysPill}>
                  <View style={styles.daysDot} />
                  <Text style={styles.daysPillText}>{daysLeftText}</Text>
                </View>
              </View>

              <View style={styles.batchBottomRow}>
                <Text style={styles.batchRateLabel}>Unit Price</Text>
                <Text style={styles.unitPriceText}>
                  ₱{price.toFixed(2)}{' '}
                  <Text style={styles.unitSub}>/ {unit}</Text>
                </Text>
              </View>
            </View>

            {/* 2. Unified Tactile Quantity Console */}
            <View style={styles.consoleCard}>
              <View style={styles.consoleHeader}>
                <Text style={styles.sectionLabel}>RESERVATION QUANTITY</Text>
                <Text style={styles.sectionSubtext}>Adjust amount</Text>
              </View>

              {/* Sculpted Stepper */}
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => handleAdjustQuantity(-5)}
                  style={styles.stepperMinusBtn}
                  activeOpacity={0.65}
                  accessibilityLabel="Decrease quantity"
                >
                  <Ionicons name="remove" size={18} color="#2b4735" />
                </TouchableOpacity>

                <View style={styles.stepperHeroDisplay}>
                  <TextInput
                    keyboardType="numeric"
                    value={customInput}
                    onChangeText={handleInputChange}
                    style={styles.stepperHeroInput}
                    selectTextOnFocus
                    underlineColorAndroid="transparent"
                  />
                  <Text style={styles.stepperHeroUnit}>{unit}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleAdjustQuantity(5)}
                  style={styles.stepperPlusBtn}
                  activeOpacity={0.8}
                  accessibilityLabel="Increase quantity"
                >
                  <Ionicons name="add" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Integrated Seamless Preset Chips */}
              <View style={styles.presetsRow}>
                {[5, 10, 25, 50].map((preset) => {
                  const isSelected = quantity === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      onPress={() => {
                        setQuantity(preset);
                        setCustomInput(String(preset));
                      }}
                      style={[
                        styles.presetChip,
                        isSelected ? styles.presetChipActive : styles.presetChipInactive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          isSelected ? styles.presetChipTextActive : styles.presetChipTextInactive,
                        ]}
                      >
                        {preset} {unit}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Special Requests / Notes */}
            <View style={styles.notesSection}>
              <Text style={styles.sectionLabel}>NOTE TO GROWER (OPTIONAL)</Text>
              <TextInput
                placeholder="e.g. Preferred morning pickup, will bring own crates..."
                placeholderTextColor="#95a69a"
                multiline
                numberOfLines={3}
                value={buyerNotes}
                onChangeText={setBuyerNotes}
                style={styles.notesInput}
                underlineColorAndroid="transparent"
              />
            </View>

            {/* 4. Elegant Receipt Summary Line */}
            <View style={styles.receiptLine}>
              <View style={{ flex: 1, paddingRight: 14 }}>
                <Text style={styles.receiptLabel}>ESTIMATED TOTAL</Text>
                <Text style={styles.receiptSubtext}>
                  ₱{price.toFixed(2)} × {quantity} {unit} • Verified upon scale weigh-in
                </Text>
              </View>
              <Text style={styles.receiptTotalAmount}>₱{totalAmount}</Text>
            </View>

            {/* 5. Primary Action & Dismiss */}
            <View style={styles.actionWrap}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={[styles.confirmBtn, isSubmitting && { opacity: 0.8 }]}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={styles.btnInnerRow}>
                    <Ionicons name="checkmark-sharp" size={17} color="#ffffff" />
                    <Text style={styles.confirmBtnText}>
                      Confirm {quantity} {unit} • ₱{totalAmount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={styles.cancelBtn}
                activeOpacity={0.6}
              >
                <Text style={styles.cancelBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(18, 27, 21, 0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: '#faf9f6',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderColor: '#e7ece3',
    maxHeight: '90%',
    shadowColor: '#122017',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d8ded6',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1ea',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  eyebrowText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#3d6349',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a271f',
    letterSpacing: -0.4,
  },
  subtitleText: {
    fontSize: 11.5,
    color: '#6e8073',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 28,
  },
  batchCard: {
    backgroundColor: '#f4f7f1',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dfe7dc',
    padding: 14,
    marginBottom: 16,
  },
  batchTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cropNameText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a271f',
    letterSpacing: -0.3,
  },
  growerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  growerName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#284131',
  },
  metaDot: {
    fontSize: 10,
    color: '#9db0a3',
  },
  hubInlineText: {
    fontSize: 11.5,
    color: '#5f7567',
    maxWidth: 170,
  },
  daysPill: {
    backgroundColor: '#274332',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  daysDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#98e3b2',
  },
  daysPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  batchBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e4ecdf',
  },
  batchRateLabel: {
    fontSize: 11,
    color: '#6f8375',
    fontWeight: '500',
  },
  unitPriceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#223c2d',
  },
  unitSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#657e6f',
  },
  consoleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2ebe0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#122017',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#5b7062',
    marginBottom: 6,
  },
  sectionSubtext: {
    fontSize: 10.5,
    color: '#8a9b8f',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  stepperMinusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperHeroDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  stepperHeroInput: {
    fontSize: 34,
    fontWeight: '800',
    color: '#192b20',
    textAlign: 'center',
    minWidth: 54,
    paddingVertical: 0,
    paddingHorizontal: 2,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: 'none',
      } as any,
    }),
  },
  stepperHeroUnit: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#6f8375',
    marginLeft: 3,
  },
  stepperPlusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#274332',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#274332',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  presetChipActive: {
    backgroundColor: '#274332',
    borderColor: '#274332',
  },
  presetChipInactive: {
    backgroundColor: '#f6f9f4',
    borderColor: '#e2ebe0',
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  presetChipTextInactive: {
    color: '#3b5143',
  },
  notesSection: {
    marginBottom: 16,
  },
  notesInput: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e1ebe0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 12.5,
    color: '#1a271f',
    textAlignVertical: 'top',
    minHeight: 68,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: 'none',
      } as any,
    }),
  },
  receiptLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e6ede3',
    borderBottomWidth: 1,
    borderBottomColor: '#e6ede3',
    marginBottom: 18,
  },
  receiptLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#46644f',
  },
  receiptSubtext: {
    fontSize: 11,
    color: '#657d6e',
    marginTop: 2,
    lineHeight: 15,
  },
  receiptTotalAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1d3626',
    letterSpacing: -0.6,
  },
  actionWrap: {
    gap: 8,
  },
  confirmBtn: {
    backgroundColor: '#274332',
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#274332',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#7a8e81',
  },
});

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '@/context/toast-context';
import { HarvestReservation } from '@/services/reservation-service';

interface DigitalReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  reservation: HarvestReservation | null;
  onOpenWeighIn?: (reservation: HarvestReservation) => void;
  isSeller?: boolean;
}

// Procedural SVG QR Code Renderer for robust offline visual representation
function RenderSvgQrCode({ code, size = 160 }: { code: string; size?: number }) {
  // Generate a deterministic 21x21 QR-like matrix pattern from the code string
  const gridSize = 21;
  const cellSize = size / gridSize;

  // Hash the string into bit patterns
  const seed = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const matrix: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  // Finder patterns at top-left, top-right, bottom-left
  const addFinderPattern = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startRow + r][startCol + c] = true;
        }
      }
    }
  };

  addFinderPattern(0, 0);
  addFinderPattern(0, gridSize - 7);
  addFinderPattern(gridSize - 7, 0);

  // Fill pseudo-data cells
  let bitIndex = seed;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Don't overwrite finder patterns
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= gridSize - 8;
      const inBottomLeft = r >= gridSize - 8 && c < 8;

      if (!inTopLeft && !inTopRight && !inBottomLeft) {
        bitIndex = (bitIndex * 9301 + 49297) % 233280;
        matrix[r][c] = (bitIndex % 3) === 0;
      }
    }
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <Rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.2}
              height={cellSize + 0.2}
              fill="#274332"
            />
          ) : null
        )
      )}
    </Svg>
  );
}

export default function DigitalReceiptModal({
  visible,
  onClose,
  reservation,
  onOpenWeighIn,
  isSeller = false,
}: DigitalReceiptModalProps) {
  const { showToast } = useToast();

  if (!reservation) return null;

  const statusStr = String(reservation.status || 'pending');
  const isCompleted = statusStr === 'completed';
  const isReady = statusStr === 'ready_for_pickup';
  const isConfirmed = statusStr === 'confirmed';

  const reservationCode = reservation.reservation_code || `LF-RES-${reservation.id || 'PENDING'}`;
  const qrCodeValue = reservation.qr_token || reservationCode;
  const cropName = reservation.crop_name || 'Produce';
  const quantity = Number(reservation.quantity) || 1;
  const unit = reservation.unit || 'kg';
  const pricePerUnit = Number(reservation.price_per_unit) || 0;
  const pickupLocation = reservation.pickup_location || 'Designated Farm Gate Hub';
  const totalAmount = Number(
    isCompleted && reservation.final_settled_amount
      ? reservation.final_settled_amount
      : reservation.total_estimated_amount || quantity * pricePerUnit
  ).toFixed(2);

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(reservationCode);
      showToast(`Code copied: ${reservationCode}`, 'success');
    } catch {
      showToast('Unable to copy code.', 'error');
    }
  };

  const handleShareReceipt = async () => {
    try {
      await Share.share({
        message: `🌾 Local Farm Digital Pickup Receipt\nReservation Code: ${reservationCode}\nCrop: ${cropName} (${quantity} ${unit})\nEstimated: ₱${totalAmount}\nPickup: ${pickupLocation}\nStatus: ${statusStr.toUpperCase()}`,
      });
    } catch {}
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(18, 27, 21, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#faf9f6', borderRadius: 28, width: '100%', maxWidth: 360, overflow: 'hidden', borderWidth: 1, borderColor: '#e6ece2', shadowColor: '#122017', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 12 }}>
          
          {/* Header Bar */}
          <View style={{ paddingHorizontal: 18, paddingVertical: 14, backgroundColor: '#274332', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="receipt-outline" size={15} color="#ffffff" />
              </View>
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13.5, letterSpacing: 0.2 }}>
                Digital Pickup Receipt
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={19} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 18, maxHeight: 480 }} showsVerticalScrollIndicator={false}>
            {/* Status Pill */}
            <View style={{ alignItems: 'center', marginVertical: 4 }}>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isCompleted ? '#edf4e9' : isReady ? '#ede9fe' : isConfirmed ? '#e0f2fe' : '#fef3c7',
                  borderWidth: 1,
                  borderColor: isCompleted ? '#c9ddc3' : isReady ? '#ddd6fe' : isConfirmed ? '#bae6fd' : '#fde68a',
                }}
              >
                <Ionicons
                  name={isCompleted ? 'checkmark-circle' : isReady ? 'cube' : 'time'}
                  size={13}
                  color={isCompleted ? '#274332' : isReady ? '#6d28d9' : isConfirmed ? '#0284c7' : '#b45309'}
                />
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    color: isCompleted ? '#274332' : isReady ? '#6d28d9' : isConfirmed ? '#0284c7' : '#b45309',
                  }}
                >
                  {statusStr.replace(/_/g, ' ')}
                </Text>
              </View>

              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a271f', marginTop: 8, letterSpacing: 0.5 }}>
                {reservationCode}
              </Text>
              <Text style={{ fontSize: 11, color: '#7a8e81', marginTop: 2 }}>
                Issued on {reservation.created_at ? new Date(reservation.created_at).toLocaleDateString() : 'Today'}
              </Text>
            </View>

            {/* QR Code Container */}
            <View style={{ alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e4ece0', marginVertical: 12 }}>
              <RenderSvgQrCode code={qrCodeValue} size={144} />
              <Text style={{ fontSize: 10, color: '#7a8e81', fontWeight: '500', marginTop: 10 }}>
                Scan or present this code at pickup hub
              </Text>
            </View>

            {/* Receipt Details Breakdown */}
            <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: '#edf1ea', gap: 9 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11.5, color: '#687e70' }}>Crop Variety</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#1a271f' }}>
                  {cropName}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11.5, color: '#687e70' }}>Reserved Quantity</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#274332' }}>
                  {quantity} {unit} @ ₱{pricePerUnit.toFixed(2)}
                </Text>
              </View>

              {reservation.actual_weighed_quantity && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderRadius: 10, backgroundColor: '#edf4e9', borderWidth: 1, borderColor: '#d7e4d2' }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#274332' }}>
                    Actual Scale Weight
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#274332' }}>
                    {reservation.actual_weighed_quantity} {unit}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11.5, color: '#687e70' }}>Pickup Hub</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#1a271f', textAlign: 'right', maxWidth: 180 }}>
                  {pickupLocation}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11.5, color: '#687e70' }}>Farmer</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#1a271f' }}>
                  {reservation.seller_name || 'Verified Farmer'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11.5, color: '#687e70' }}>Buyer</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '500', color: '#1a271f' }}>
                  {reservation.buyer_name || 'Registered Buyer'}
                </Text>
              </View>

              {/* Total Settlement */}
              <View style={{ paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: '#e3ece0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1a271f' }}>
                  {isCompleted ? 'Final Settled Price' : 'Estimated Total'}
                </Text>
                <Text style={{ fontSize: 19, fontWeight: '800', color: '#274332' }}>
                  ₱{totalAmount}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={handleCopyCode}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#dce5da', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={14} color="#45584b" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#324538' }}>
                  Copy Code
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShareReceipt}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#dce5da', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                activeOpacity={0.7}
              >
                <Ionicons name="share-social-outline" size={14} color="#45584b" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#324538' }}>
                  Share
                </Text>
              </TouchableOpacity>
            </View>

            {/* Seller Weigh-in Shortcut */}
            {isSeller && !isCompleted && onOpenWeighIn && (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onOpenWeighIn(reservation);
                }}
                style={{ width: '100%', marginTop: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: '#274332', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, shadowColor: '#274332', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3 }}
                activeOpacity={0.85}
              >
                <Ionicons name="scale-outline" size={16} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontSize: 12.5, fontWeight: '700' }}>
                  Weigh-In & Complete Order
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

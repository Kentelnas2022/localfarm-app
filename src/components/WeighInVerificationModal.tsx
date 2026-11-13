import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { verifyPickupApi, HarvestReservation } from '@/services/reservation-service';
import { useToast } from '@/context/toast-context';

interface WeighInVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  reservation: HarvestReservation | null;
  onSuccess: (receipt: HarvestReservation) => void;
}

export default function WeighInVerificationModal({
  visible,
  onClose,
  reservation,
  onSuccess,
}: WeighInVerificationModalProps) {
  const { showToast } = useToast();
  const [weighedQty, setWeighedQty] = useState<string>('');
  const [sellerNotes, setSellerNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (reservation) {
      setWeighedQty(String(reservation.quantity));
      setSellerNotes('');
    }
  }, [reservation]);

  if (!reservation) return null;

  const unitPrice = Number(reservation.price_per_unit) || 0;
  const parsedWeighed = parseFloat(weighedQty) || 0;
  const finalAmount = (parsedWeighed * unitPrice).toFixed(2);

  const handleVerify = async () => {
    if (parsedWeighed <= 0) {
      showToast('Please enter a valid scale weight.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyPickupApi({
        reservationCode: reservation.reservation_code,
        qrToken: reservation.qr_token,
        actualWeighedQuantity: parsedWeighed,
        sellerNotes: sellerNotes.trim(),
      });

      if (res.success) {
        showToast(
          `Weigh-In Verified! Order completed: ${parsedWeighed} ${reservation.unit} at ₱${finalAmount}`,
          'success'
        );
        onSuccess(res.receipt);
        onClose();
      } else {
        showToast(res.message || 'Could not verify weigh-in.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Server error occurred.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(18, 27, 21, 0.55)', justifyContent: 'flex-end' }}
      >
        <View style={{ backgroundColor: '#faf9f6', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, shadowColor: '#122017', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 14, borderWidth: 1, borderColor: '#e6ece2' }}>
          
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#edf1ea' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#274332', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="scale-outline" size={18} color="#ffffff" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a271f', letterSpacing: -0.3 }}>
                  Weigh-In Verification
                </Text>
                <Text style={{ fontSize: 11, color: '#687e70', marginTop: 1 }}>
                  {reservation.reservation_code} • {reservation.crop_name}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#eef2eb', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={18} color="#5e7264" />
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <View style={{ paddingVertical: 14, gap: 14 }}>
            
            {/* Reserved vs Actual */}
            <View style={{ padding: 12, borderRadius: 14, backgroundColor: '#f2f6ee', borderWidth: 1, borderColor: '#dce5da', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 9.5, color: '#62786a', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8 }}>Initial Reserved</Text>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#1a271f', marginTop: 1 }}>
                  {reservation.quantity} {reservation.unit}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 9.5, color: '#62786a', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8 }}>Agreed Unit Rate</Text>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#274332', marginTop: 1 }}>
                  ₱{unitPrice.toFixed(2)} / {reservation.unit}
                </Text>
              </View>
            </View>

            {/* Scale Input */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#2a3d31' }}>
                Actual Physical Scale Weight ({reservation.unit}) <Text style={{ color: '#b91c1c' }}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#d5dfd2', backgroundColor: '#ffffff', paddingHorizontal: 14 }}>
                <Ionicons name="speedometer-outline" size={18} color="#274332" />
                <TextInput
                  keyboardType="decimal-pad"
                  value={weighedQty}
                  onChangeText={setWeighedQty}
                  placeholder="0.00"
                  style={{ flex: 1, marginLeft: 10, fontSize: 16, fontWeight: '700', color: '#1a271f', paddingVertical: 0 }}
                />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#7a8e81' }}>{reservation.unit}</Text>
              </View>
            </View>

            {/* Weigh-in Notes */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#2a3d31' }}>
                Scale / Inspection Notes
              </Text>
              <TextInput
                placeholder="e.g. Certified scale #2, clean harvest crates..."
                placeholderTextColor="#9caea1"
                value={sellerNotes}
                onChangeText={setSellerNotes}
                style={{ width: '100%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#dce5da', backgroundColor: '#ffffff', fontSize: 12.5, color: '#1a271f' }}
              />
            </View>

            {/* Settlement Calculation */}
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: '#edf4e9', borderWidth: 1, borderColor: '#d7e4d2', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 9.5, textTransform: 'uppercase', fontWeight: '700', color: '#486852', letterSpacing: 1 }}>
                  Final Settled Amount
                </Text>
                <Text style={{ fontSize: 11, color: '#657e6f', marginTop: 2 }}>
                  {parsedWeighed} {reservation.unit} × ₱{unitPrice.toFixed(2)}
                </Text>
              </View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#233f2d', letterSpacing: -0.5 }}>
                ₱{finalAmount}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={{ paddingTop: 6, flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={onClose}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: '#dce5da', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#5b6f62' }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleVerify}
                disabled={isSubmitting}
                style={{ flex: 2, paddingVertical: 13, borderRadius: 14, backgroundColor: '#274332', alignItems: 'center', justifyContent: 'center', shadowColor: '#274332', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3, flexDirection: 'row', gap: 6 }}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done-circle" size={17} color="#ffffff" />
                    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>
                      Verify & Complete Order
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

import { useToast } from "@/context/toast-context";
import { useAuth } from "@/hooks/use-auth";
import { confirm2FASetupApi, resend2FAOtpApi } from "@/services/auth-service";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  TextInput as RNTextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG_IMAGE = require("../../../assets/images/background-blur.png");
export const TWO_FACTOR_STORAGE_KEY = "localfarm_2fa_settings_v1";

export default function TwoFactorOtpScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const params = useLocalSearchParams<{
    method?: string;
    target?: string;
  }>();

  const method = params.method || "email";
  const rawTarget =
    params.target ||
    user?.email ||
    user?.phoneNumber ||
    "your email address";

  // Mask email for clean privacy display: e.g. "sal••••••@gmail.com"
  const formatMaskedEmail = (str: string) => {
    if (!str) return "your email address";
    if (str.includes("@")) {
      const [name, domain] = str.split("@");
      if (name.length <= 3) {
        return `${name[0]}••••••@${domain}`;
      }
      return `${name.slice(0, 3)}••••••@${domain}`;
    }
    return str;
  };

  const maskedTarget = formatMaskedEmail(rawTarget);

  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // References for 6 input boxes
  const inputRefs = useRef<Array<RNTextInput | null>>([]);

  const handleChangeText = (text: string, index: number) => {
    // Clean non-numeric characters
    const cleanText = text.replace(/[^0-9]/g, "");
    const newOtp = [...otp];

    if (cleanText.length > 1) {
      // Handle pasted multi-digit OTP string
      const pastedDigits = cleanText.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedDigits[i] || "";
      }
      setOtp(newOtp);
      const nextIndex = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Handle single digit typing
      newOtp[index] = cleanText;
      setOtp(newOtp);

      if (cleanText && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    if (errorMsg) setErrorMsg("");
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullOtp = otp.join("").trim();
    if (fullOtp.length < 6) {
      setErrorMsg("Please enter all 6 digits of the OTP code.");
      return;
    }

    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const res = await confirm2FASetupApi(fullOtp, method);
      await updateUser({
        twoFactorEnabled: true,
        twoFactorMethod: res.twoFactorMethod || method,
      });

      // Persist 2FA as active in local storage cache
      await AsyncStorage.setItem(
        TWO_FACTOR_STORAGE_KEY,
        JSON.stringify({
          isEnabled: true,
          method: res.twoFactorMethod || method,
          target: rawTarget,
          updatedAt: new Date().toISOString(),
        }),
      );

      setIsSubmitting(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(
        err?.message || "Invalid or expired verification code. Please check your email and try again.",
      );
    }
  };

  const handleSuccessContinue = () => {
    setShowSuccessModal(false);
    showToast("Two-factor authentication enabled successfully!", "success");
    router.replace("/user/TwoFactorAuth" as any);
  };

  const handleResendCode = async () => {
    try {
      setResendSent(true);
      const res = await resend2FAOtpApi(rawTarget, "2fa_setup");
      showToast(res.message || `New code sent to ${maskedTarget}`, "info");
      setTimeout(() => setResendSent(false), 5000);
    } catch (err: any) {
      showToast(err?.message || "Failed to resend verification code.", "error");
      setResendSent(false);
    }
  };

  return (
    <ImageBackground source={BG_IMAGE} className="flex-1" resizeMode="cover">
      {/* Top Header Bar */}
      <View
        className="absolute top-0 left-0 right-0 px-4 z-20"
        style={{ paddingTop: Math.max(insets.top + 8, 16) }}
      >
        <TouchableOpacity
          className="p-2 self-start rounded-full active:opacity-70"
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back-outline" size={26} color="#4B5563" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center items-center px-5"
          contentContainerStyle={{
            paddingTop: Math.max(insets.top + 16, 24),
            paddingBottom: Math.max(insets.bottom + 16, 24),
          }}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Wrapper */}
          <View className="w-full max-w-[380px] items-center">
            {/* Centered Header Block */}
            <View className="items-center mb-6 w-full">
              <View className="w-16 h-16 rounded-full bg-[#E8F5E9] items-center justify-center mb-3">
                <Ionicons name="shield-checkmark" size={34} color="#72AF5B" />
              </View>

              <Text className="text-3xl font-extrabold text-neutral-900 text-center mb-2 tracking-tight">
                Two-Factor PIN
              </Text>
              <Text className="text-sm text-neutral-600 text-center leading-relaxed px-2">
                Enter the 6-digit verification code sent to{"\n"}
                <Text className="font-bold text-neutral-800">{maskedTarget}</Text>
              </Text>
            </View>

            {errorMsg ? (
              <View className="bg-[#FFEBEA] p-3.5 rounded-2xl mb-5 w-full border border-[#FFCCCC]">
                <Text className="text-[#FF3B30] text-sm text-center font-medium">
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {resendSent ? (
              <View className="bg-[#E8F5E9] p-3.5 rounded-2xl mb-5 w-full border border-[#C8E6C9]">
                <Text className="text-[#72AF5B] text-sm text-center font-medium">
                  A new verification code has been sent to your email!
                </Text>
              </View>
            ) : null}

            {/* 6-Digit OTP Inputs */}
            <View className="flex-row justify-between w-full mb-6">
              {otp.map((digit, index) => (
                <RNTextInput
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  className={`w-[48px] h-[54px] bg-white border ${
                    digit
                      ? "border-[#72AF5B]"
                      : errorMsg
                        ? "border-[#FF3B30] bg-[#FFF8F8]"
                        : "border-gray-200"
                  } rounded-2xl text-center text-2xl font-bold text-gray-900 shadow-sm`}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={digit}
                  onChangeText={(text) => handleChangeText(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  selectTextOnFocus
                />
              ))}
            </View>

            {/* Verify Button (Clean "Verify Code" text that never wraps or cuts off) */}
            <TouchableOpacity
              className="w-full h-[52px] bg-[#72AF5B] rounded-2xl items-center justify-center shadow-md active:opacity-90 mb-5"
              style={{
                shadowColor: "#72AF5B",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
              }}
              onPress={handleVerify}
              disabled={isSubmitting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Verify Code"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-white text-base font-bold tracking-wide">
                  Verify Code
                </Text>
              )}
            </TouchableOpacity>

            {/* Resend Code Link */}
            <View className="flex-row justify-center items-center py-2">
              <Text className="text-sm text-neutral-600">
                Didn't receive the code?{" "}
              </Text>
              <TouchableOpacity onPress={handleResendCode} activeOpacity={0.7}>
                <Text className="text-sm font-bold text-[#72AF5B]">
                  Resend Code
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Verification Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSuccessContinue}
      >
        <View
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        >
          <View className="w-full max-w-[340px] bg-white rounded-3xl p-6 items-center shadow-xl">
            {/* Green Badge Icon */}
            <View className="w-16 h-16 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
              <Ionicons name="shield-checkmark" size={44} color="#72AF5B" />
            </View>

            {/* Title */}
            <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
              2FA Activated!
            </Text>

            {/* Description Message */}
            <Text className="text-sm text-gray-600 text-center mb-6 leading-5">
              Two-factor authentication via email has been verified and enabled
              for your LocalFarm account.
            </Text>

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleSuccessContinue}
              className="w-full h-[50px] bg-[#72AF5B] rounded-2xl items-center justify-center active:opacity-90 shadow-sm"
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continue to Settings"
            >
              <Text className="text-white text-base font-bold">Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

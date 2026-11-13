import { useToast } from "@/context/toast-context";
import { useAuth } from "@/hooks/use-auth";
import {
  resetPasswordForEmailApi,
  sendSignupOtpApi,
  verifyOtpApi,
} from "@/services/auth-service";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  NativeSyntheticEvent,
  Platform,
  TextInput as RNTextInput,
  ScrollView,
  Text,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG_IMAGE = require("../../../assets/images/background-blur.png");

export default function OTPScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const { showToast } = useToast();

  const params = useLocalSearchParams<{
    email?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    phoneNumber?: string;
    password?: string;
    gender?: string;
  }>();

  const email = params.email || "";

  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // References for 6 input boxes
  const inputRefs = useRef<Array<RNTextInput | null>>([]);

  const handleChangeText = (text: string, index: number) => {
    // Clean non-numeric characters
    const cleanText = text.replace(/[^0-9]/g, "");

    const newOtp = [...otp];

    if (cleanText.length >= 4) {
      // Handle pasted multi-digit OTP string
      const pastedDigits = cleanText.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedDigits[i] || "";
      }
      setOtp(newOtp);
      const nextIndex = Math.min(pastedDigits.length - 1, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Handle single digit typing or overwriting existing digit
      const digit = cleanText.slice(-1);
      newOtp[index] = digit;
      setOtp(newOtp);

      if (digit && index < 5) {
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
    const fullOtp = otp.join("");
    if (fullOtp.length < 6) {
      setErrorMsg("Please enter all 6 digits of the OTP code.");
      return;
    }

    setErrorMsg("");
    setIsSubmitting(true);

    try {
      await verifyOtpApi(email.trim(), fullOtp);
      setIsSubmitting(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(
        err?.message || "Invalid or expired OTP code. Please try again.",
      );
    }
  };

  const handleSuccessContinue = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      if (params.password) {
        const fullName =
          `${params.firstName || ""} ${params.lastName || ""}`.trim() ||
          params.username ||
          params.email ||
          "";
        await signUp({
          name: fullName,
          email: email.trim(),
          password: params.password,
          firstName: params.firstName?.trim(),
          lastName: params.lastName?.trim(),
          username: params.username?.trim(),
          phoneNumber: params.phoneNumber?.trim(),
          gender: params.gender,
        });
        showToast(
          "Account created successfully! Welcome to Local Farm!",
          "success",
        );
      }
      setShowSuccessModal(false);
      router.replace("/user/NewsFeed" as any);
    } catch (err: any) {
      showToast(err?.message || "Failed to finalize account setup.", "error");
      setShowSuccessModal(false);
    } finally {
      setIsFinishing(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) return;
    try {
      if (params.password) {
        await sendSignupOtpApi({
          email: email.trim(),
          username: params.username?.trim(),
        });
      } else {
        await resetPasswordForEmailApi(email.trim());
      }
      setResendSent(true);
      setTimeout(() => setResendSent(false), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to resend verification code.");
    }
  };

  return (
    <ImageBackground source={BG_IMAGE} className="flex-1" resizeMode="cover">
      {/* Top Header Bar - Absolute overlay so it doesn't shift the centered form */}
      <View
        className="absolute top-0 left-0 right-0 px-4 z-20"
        style={{ paddingTop: Math.max(insets.top + 8, 16) }}
      >
        <TouchableOpacity
          className="p-2 self-start rounded-full active:opacity-70"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/auth/Signup");
            }
          }}
          activeOpacity={0.7}
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
              <Text className="text-3xl font-extrabold text-neutral-900 text-center mb-2 tracking-tight">
                One-time Pin
              </Text>
              <Text className="text-md text-neutral-600 text-center leading-relaxed px-2">
                {email
                  ? `Enter verification code sent to ${email}`
                  : "Enter verification code"}
              </Text>
            </View>

            {errorMsg ? (
              <View className="bg-[#FFEBEA] p-3.5 rounded-2xl mb-5 w-full border border-[#FF3B30]/30">
                <Text className="text-[#FF3B30] text-sm text-center font-medium">
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {resendSent ? (
              <View className="bg-[#E8F5E9] p-3.5 rounded-2xl mb-5 w-full border border-[#72AF5B]/30">
                <Text className="text-[#72AF5B] text-md text-center font-medium">
                  A new OTP code has been sent to your email!
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
                  className={`w-[48px] h-[54px] bg-white/95 border ${
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

            {/* Verify Button */}
            <TouchableOpacity
              className="w-full h-[52px] bg-[#72AF5B] rounded-2xl items-center justify-center shadow-md shadow-[#72AF5B]/30 active:opacity-90 mb-5"
              onPress={handleVerify}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Text className="text-white text-base font-bold tracking-wide">
                {isSubmitting ? "Verifying..." : "Verify Code"}
              </Text>
            </TouchableOpacity>

            {/* Resend Code Link */}
            <View className="flex-row justify-center items-center py-2">
              <TouchableOpacity onPress={handleResendCode} activeOpacity={0.7}>
                <Text className="text-mdfont-semibold text-[#72AF5B]">
                  Resend Verification Code
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
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View className="w-full max-w-[340px] bg-white rounded-3xl p-6 items-center shadow-xl">
            {/* Green Badge Icon */}
            <View className="w-16 h-16 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
              <Ionicons name="checkmark-circle" size={48} color="#72AF5B" />
            </View>

            {/* Title */}
            <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
              Verification Successful
            </Text>

            {/* Description Message */}
            <Text className="text-sm text-gray-600 text-center mb-6 leading-5">
              Your verification code has been confirmed successfully.
            </Text>

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleSuccessContinue}
              className="w-full h-[50px] bg-[#72AF5B] rounded-2xl items-center justify-center active:opacity-90 shadow-sm flex-row gap-2"
              activeOpacity={0.85}
              disabled={isFinishing}
            >
              {isFinishing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : null}
              <Text className="text-white text-base font-bold">
                {isFinishing ? "Entering..." : "Continue"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

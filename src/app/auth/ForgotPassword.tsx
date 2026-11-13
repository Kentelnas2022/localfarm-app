import { useToast } from "@/context/toast-context";
import { resetPasswordForEmailApi } from "@/services/auth-service";
import { validateEmail } from "@/utils/validation";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  TextInput as RNTextInput,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG_IMAGE = require("../../../assets/images/background-blur.png");

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleSendOtp = async () => {
    setGeneralError("");
    const emailVal = validateEmail(email);

    if (!emailVal.isValid) {
      setEmailError(emailVal.error || "Please enter a valid email address.");
      showToast(
        emailVal.error || "Please enter a valid email address.",
        "warning",
      );
      return;
    }

    setEmailError("");
    setIsLoading(true);

    try {
      await resetPasswordForEmailApi(email.trim());
      setIsLoading(false);
      setShowModal(true);
      showToast("OTP code sent successfully to your email!", "success");
    } catch (err: any) {
      setIsLoading(false);
      const msg =
        err?.message || "Failed to send reset code. Please try again.";
      setGeneralError(msg);
      showToast(msg, "error");
    }
  };

  const handleModalContinue = () => {
    setShowModal(false);
    router.push({
      pathname: "/auth/VerifyOtp",
      params: { email: email.trim() },
    } as any);
  };

  return (
    <ImageBackground
      source={BG_IMAGE}
      className="flex-1"
      resizeMode="cover"
      style={{ flex: 1, overflow: "hidden" }}
    >
      {/* Top Header Bar - Absolute overlay so it doesn't shift the centered form */}
      <View
        className="absolute top-0 left-0 right-0 px-4 z-20"
        style={{ paddingTop: Math.max(insets.top + 8, 16) }}
      ></View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center items-center px-5"
        style={{
          paddingTop: Math.max(insets.top + 16, 24),
          paddingBottom: Math.max(insets.bottom + 16, 24),
        }}
      >
        <View className="w-full max-w-[380px] items-center">
          {/* Centered Circular Vector Icon */}
          <View className="w-20 h-20 rounded-full bg-[#72AF5B] items-center justify-center self-center mb-6 shadow-md shadow-[#72AF5B]/30">
            <MaterialCommunityIcons
              name="lock-reset"
              size={40}
              color="#FFFFFF"
            />
          </View>

          {/* Centered Header Block */}
          <View className="items-center mb-6 w-full">
            <Text className="text-3xl font-extrabold text-neutral-900 text-center mb-2 tracking-tight">
              Forgot Password?
            </Text>
            <Text className="text-md text-neutral-600 text-center leading-relaxed px-2">
              Enter your registered email address and we will send a 6-digit OTP
              code to reset your password.
            </Text>
          </View>

          {/* Email Field */}
          <View className="w-full mb-6">
            <RNTextInput
              className={`w-full h-[52px] bg-white/95 border ${
                emailError ? "border-[#FF3B30] bg-[#FFF8F8]" : "border-gray-200"
              } rounded-2xl px-4 text-base text-gray-900 shadow-sm`}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(text: string) => {
                setEmail(text);
                if (emailError) setEmailError("");
                if (generalError) setGeneralError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailError ? (
              <Text className="text-[#FF3B30] text-xs mt-1.5 ml-1 font-medium">
                {emailError}
              </Text>
            ) : null}
          </View>

          {/* Send Code Button */}
          <TouchableOpacity
            className="w-full h-[52px] bg-[#72AF5B] rounded-2xl items-center justify-center shadow-md shadow-[#72AF5B]/30 active:opacity-90 mb-6"
            onPress={handleSendOtp}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Text className="text-white text-base font-bold tracking-wide">
              {isLoading ? "Sending..." : "Send Code"}
            </Text>
          </TouchableOpacity>

          {/* Footer / Back to Login Link */}
          <View className="flex-row justify-center items-center mt-2 w-full">
            <Text className="text-md text-neutral-600">
              Remember your password?{" "}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/auth/Login" as any)}
              activeOpacity={0.7}
              className="py-1"
            >
              <Text className="text-md font-bold text-[#72AF5B]">Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-3xl p-8 w-full max-w-[340px] items-center shadow-2xl">
            {/* Modal Icon */}
            <View className="w-16 h-16 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
              <MaterialCommunityIcons
                name="email-check-outline"
                size={36}
                color="#72AF5B"
              />
            </View>

            {/* Modal Title */}
            <Text className="text-2xl font-extrabold text-neutral-900 text-center mb-2">
              Check Your Email!
            </Text>

            {/* Modal Message */}
            <Text className="text-md text-neutral-600 text-center mb-1 leading-5">
              We've sent a 6-digit verification code to
            </Text>
            <Text className="text-md font-bold text-[#72AF5B] text-center mb-5">
              {email}
            </Text>

            {/* Divider */}
            <View className="w-full h-px bg-gray-100 mb-5" />

            {/* Note */}
            <View className="flex-row items-start mb-6 px-1">
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#888888"
                style={{ marginTop: 1, marginRight: 6 }}
              />
              <Text className="text-sm text-neutral-500 flex-1 leading-4">
                Didn't receive the email? Check your spam folder or wait a few
                minutes before requesting again.
              </Text>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              className="w-full h-[50px] bg-[#72AF5B] rounded-2xl items-center justify-center shadow-sm active:opacity-90 mb-3"
              onPress={handleModalContinue}
              activeOpacity={0.85}
            >
              <Text className="text-white text-base font-bold">
                Enter Verification Code
              </Text>
            </TouchableOpacity>

            {/* Close / Cancel Button */}
            <TouchableOpacity
              className="w-full h-[46px] border border-gray-200 rounded-2xl items-center justify-center active:opacity-70"
              onPress={() => setShowModal(false)}
            >
              <Text className="text-sm text-neutral-600 font-medium">Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

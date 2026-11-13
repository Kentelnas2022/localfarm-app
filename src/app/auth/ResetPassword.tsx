import { resetPasswordApi } from "@/services/auth-service";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  TextInput as RNTextInput,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { validatePassword } from "@/utils/validation";

const BG_IMAGE = require("../../../assets/images/background-blur.png");

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleResetPassword = async () => {
    setGeneralError("");
    let hasError = false;

    const passVal = validatePassword(password);
    if (!passVal.isValid) {
      setPasswordError(
        passVal.error || "Password must be at least 6 characters.",
      );
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      hasError = true;
    } else {
      setConfirmPasswordError("");
    }

    if (hasError) return;

    setIsLoading(true);

    try {
      await resetPasswordApi(email.trim(), password);
      setIsLoading(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      setIsLoading(false);
      setGeneralError(
        err?.message || "Failed to reset password. Please try again.",
      );
    }
  };

  const handleGoToLogin = () => {
    setShowSuccessModal(false);
    router.replace("/auth/Login" as any);
  };

  return (
    <ImageBackground source={BG_IMAGE} className="flex-1" resizeMode="cover">
      {/* Top Header Bar */}
      <View
        className="w-full px-4 z-20"
        style={{ paddingTop: Math.max(insets.top + 8, 16) }}
      >
        <TouchableOpacity
          className="p-2 self-start rounded-full active:opacity-70"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/auth/Login");
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
            paddingBottom: Math.max(insets.bottom + 16, 24),
          }}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-[380px]">
            {/* Header Block */}
            <View className="items-start mb-6 w-full">
              <Text className="text-3xl font-extrabold text-neutral-900 text-left mb-1 tracking-tight">
                Reset <Text className="text-[#72AF5B]">Password</Text>
              </Text>
              <Text className="text-sm text-neutral-600 text-left">
                Create a strong new password for your account.
              </Text>
            </View>

            {generalError ? (
              <View className="bg-[#FFEBEA] p-3.5 rounded-2xl mb-5 w-full border border-[#FF3B30]/30">
                <Text className="text-[#FF3B30] text-sm text-center font-medium">
                  {generalError}
                </Text>
              </View>
            ) : null}

            {/* New Password Field */}
            <View className="w-full mb-4">
              <View className="w-full relative justify-center">
                <RNTextInput
                  className={`w-full h-[52px] bg-white/95 border ${
                    passwordError ? "border-[#FF3B30] bg-[#FFF8F8]" : "border-gray-200"
                  } rounded-2xl pl-4 pr-12 text-base text-gray-900 shadow-sm`}
                  placeholder="Enter new password (min. 6 chars)"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text: string) => {
                    setPassword(text);
                    if (passwordError) setPasswordError("");
                  }}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  className="absolute right-0 top-0 bottom-0 px-4 justify-center items-center"
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#848484"
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <Text className="text-[#FF3B30] text-xs mt-1.5 ml-1 font-medium">
                  {passwordError}
                </Text>
              ) : null}
            </View>

            {/* Confirm Password Field */}
            <View className="w-full mb-6">
              <View className="w-full relative justify-center">
                <RNTextInput
                  className={`w-full h-[52px] bg-white/95 border ${
                    confirmPasswordError
                      ? "border-[#FF3B30] bg-[#FFF8F8]"
                      : "border-gray-200"
                  } rounded-2xl pl-4 pr-12 text-base text-gray-900 shadow-sm`}
                  placeholder="Re-enter your new password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(text: string) => {
                    setConfirmPassword(text);
                    if (confirmPasswordError) setConfirmPasswordError("");
                  }}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  className="absolute right-0 top-0 bottom-0 px-4 justify-center items-center"
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-off-outline" : "eye-outline"
                    }
                    size={22}
                    color="#848484"
                  />
                </TouchableOpacity>
              </View>
              {confirmPasswordError ? (
                <Text className="text-[#FF3B30] text-xs mt-1.5 ml-1 font-medium">
                  {confirmPasswordError}
                </Text>
              ) : null}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              className="w-full h-[52px] bg-[#72AF5B] rounded-2xl items-center justify-center shadow-md shadow-[#72AF5B]/30 active:opacity-90 mb-4"
              onPress={handleResetPassword}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text className="text-white text-base font-bold tracking-wide">
                {isLoading ? "Resetting..." : "Reset Password"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-3xl p-8 w-full max-w-[340px] items-center shadow-2xl">
            {/* Animated Check Icon */}
            <View className="w-16 h-16 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={40}
                color="#72AF5B"
              />
            </View>

            {/* Title */}
            <Text className="text-2xl font-extrabold text-neutral-900 text-center mb-2">
              Password Reset!
            </Text>

            {/* Message */}
            <Text className="text-sm text-neutral-600 text-center mb-2 leading-5">
              Your password has been successfully reset.
            </Text>
            <Text className="text-sm text-neutral-600 text-center mb-6 leading-5">
              You can now sign in with your new password.
            </Text>

            {/* Divider */}
            <View className="w-full h-px bg-gray-100 mb-5" />

            {/* Info Note */}
            <View className="flex-row items-start mb-6 px-1">
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color="#72AF5B"
                style={{ marginTop: 1, marginRight: 6 }}
              />
              <Text className="text-xs text-neutral-500 flex-1 leading-4">
                For your security, please do not share your password with
                anyone.
              </Text>
            </View>

            {/* Back to Sign In Button */}
            <TouchableOpacity
              className="w-full h-[50px] bg-[#72AF5B] rounded-2xl items-center justify-center shadow-sm active:opacity-90"
              onPress={handleGoToLogin}
              activeOpacity={0.85}
            >
              <Text className="text-white text-base font-bold">
                Back to Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

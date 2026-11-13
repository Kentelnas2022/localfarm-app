import { useToast } from "@/context/toast-context";
import { useAuth } from "@/hooks/use-auth";
import { resend2FAOtpApi } from "@/services/auth-service";
import { validateEmail, validatePassword } from "@/utils/validation";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  NativeSyntheticEvent,
  Platform,
  TextInput as RNTextInput,
  TextInputKeyPressEventData,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG_IMAGE = require("../../../assets/images/background-blur.png");
const LF3_IMAGE = require("../../../assets/images/LF3.png");
const LOGO2_IMAGE = require("../../../assets/images/logo2.png");

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, complete2FALogin } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  // 2FA Verification State
  const [is2FAModalVisible, setIs2FAModalVisible] = useState(false);
  const [pending2FAEmail, setPending2FAEmail] = useState("");
  const [twoFactorMethod, setTwoFactorMethod] = useState<string>("email");
  const [twoFactorCode, setTwoFactorCode] = useState(["", "", "", "", "", ""]);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<Array<RNTextInput | null>>([]);

  const handleLogin = async () => {
    setGeneralError("");
    const emailVal = validateEmail(email);
    const passVal = validatePassword(password);

    setEmailError(emailVal.error || "");
    setPasswordError(passVal.error || "");

    if (!emailVal.isValid) {
      showToast(
        emailVal.error || "Please enter a valid email address.",
        "warning",
      );
      return;
    }

    if (!passVal.isValid) {
      showToast(passVal.error || "Please enter your password.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn(email.trim(), password);
      if (res?.requires2FA) {
        setPending2FAEmail(res.email || email.trim());
        setTwoFactorMethod(res.method || "email");
        setTwoFactorCode(["", "", "", "", "", ""]);
        setTwoFactorError("");
        setIs2FAModalVisible(true);
        if (res.method === "authenticator") {
          showToast("Enter the 6-digit code from Google Authenticator.", "info");
        } else {
          showToast(
            res.message || "Enter the 6-digit code sent to your email.",
            "info",
          );
        }
        return;
      }
      showToast("Signed in successfully! Welcome back.", "success");
      router.replace("/user/NewsFeed" as any);
    } catch (err: any) {
      const msg =
        err?.message ||
        "Invalid email or password. Please check your credentials.";
      setGeneralError(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const cleanText = text.replace(/[^0-9]/g, "");
    const newOtp = [...twoFactorCode];

    if (cleanText.length > 1) {
      const pastedDigits = cleanText.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedDigits[i] || "";
      }
      setTwoFactorCode(newOtp);
      const nextIndex = Math.min(pastedDigits.length, 5);
      otpRefs.current[nextIndex]?.focus();
    } else {
      newOtp[index] = cleanText;
      setTwoFactorCode(newOtp);
      if (cleanText && index < 5) {
        otpRefs.current[index + 1]?.focus();
      }
    }

    if (twoFactorError) setTwoFactorError("");
  };

  const handleOtpKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === "Backspace" && !twoFactorCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify2FALogin = async () => {
    const fullCode = twoFactorCode.join("").trim();
    if (fullCode.length < 6) {
      setTwoFactorError("Please enter all 6 digits of the verification code.");
      return;
    }

    setTwoFactorError("");
    setIsVerifying2FA(true);
    try {
      await complete2FALogin(pending2FAEmail, fullCode);
      setIs2FAModalVisible(false);
      showToast("Signed in successfully! Welcome back.", "success");
      router.replace("/user/NewsFeed" as any);
    } catch (err: any) {
      setTwoFactorError(
        err?.message ||
          (twoFactorMethod === "authenticator"
            ? "Invalid code. Please check Google Authenticator and try again."
            : "Invalid or expired code. Please check your email."),
      );
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleResendLogin2FACode = async () => {
    if (resendCooldown > 0) return;
    try {
      const res = await resend2FAOtpApi(pending2FAEmail, "2fa_login");
      showToast(res.message || "New verification code sent to your email.", "info");
      setResendCooldown(30);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      showToast(err?.message || "Failed to resend code.", "error");
    }
  };

  return (
    <ImageBackground
      source={BG_IMAGE}
      className="flex-1"
      resizeMode="cover"
      style={{ flex: 1, overflow: "hidden" }}
    >
      {/* Top Banner Header */}
      <View
        className="w-full px-5 z-20"
        style={{ paddingTop: Math.max(insets.top + 8, 16) }}
      >
        <Image
          source={LF3_IMAGE}
          className="w-[135px] h-[40px]"
          style={{ width: 135, height: 40 }}
          resizeMode="contain"
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center items-center px-5"
        style={{
          paddingBottom: Math.max(insets.bottom + 16, 24),
        }}
      >
        {/* Centered Form Wrapper (Fixed Position, Non-Draggable) */}
        <View className="w-full max-w-[380px] items-center">
          {/* Centered Logo2 & Header */}
          <View className="items-center mb-6 w-full">
            <Image
              source={LOGO2_IMAGE}
              className="w-20 h-20 self-center mb-3"
              style={{ width: 80, height: 80 }}
              resizeMode="contain"
            />
            <Text className="text-3xl font-extrabold text-neutral-900 text-center tracking-tight">
              Welcome Back!
            </Text>
          </View>

          {/* Email Field */}
          <View className="w-full mb-3.5">
            <RNTextInput
              className={`w-full h-[52px] bg-white/95 border ${
                emailError ? "border-[#FF3B30] bg-[#FFF8F8]" : "border-gray-200"
              } rounded-2xl px-4 text-base text-gray-900 shadow-sm`}
              placeholder="farmer@example.com"
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

          {/* Password Field */}
          <View className="w-full mb-1">
            <View className="w-full relative justify-center">
              <RNTextInput
                className={`w-full h-[52px] bg-white/95 border ${
                  passwordError
                    ? "border-[#FF3B30] bg-[#FFF8F8]"
                    : "border-gray-200"
                } rounded-2xl pl-4 pr-12 text-base text-gray-900 shadow-sm`}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text: string) => {
                  setPassword(text);
                  if (passwordError) setPasswordError("");
                  if (generalError) setGeneralError("");
                }}
                autoCapitalize="none"
                autoCorrect={false}
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

          {/* Forgot Password Link */}
          <TouchableOpacity
            className="self-end mb-5 py-1.5 px-1"
            onPress={() => router.push("/auth/ForgotPassword" as any)}
            activeOpacity={0.7}
          >
            <Text className="text-md font-medium text-neutral-700">
              Forgot Password?
            </Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            className={`w-full h-[52px] ${
              isSubmitting ? "bg-[#72AF5B]/80" : "bg-[#72AF5B]"
            } rounded-2xl items-center justify-center shadow-md shadow-[#72AF5B]/30 active:opacity-90 flex-row gap-2`}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : null}
            <Text className="text-white text-base font-bold tracking-wide">
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Text>
          </TouchableOpacity>

          {/* Footer */}
          <View className="flex-row justify-center items-center mt-6 w-full">
            <Text className="text-md text-neutral-600">
              Don't have an account?{" "}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/auth/Signup" as any)}
              activeOpacity={0.7}
              className="py-1"
            >
              <Text className="text-md font-bold text-[#72AF5B]">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Two-Factor Authentication Modal */}
      <Modal
        visible={is2FAModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIs2FAModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-4">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="w-full max-w-sm"
          >
            <View className="bg-white rounded-3xl p-6 shadow-2xl items-center">
              {/* 2FA Method Icon */}
              <View className="w-16 h-16 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
                <Ionicons
                  name={
                    twoFactorMethod === "authenticator"
                      ? "phone-portrait-outline"
                      : "shield-checkmark"
                  }
                  size={32}
                  color="#72AF5B"
                />
              </View>

              <Text className="text-xl font-extrabold text-gray-900 text-center">
                {twoFactorMethod === "authenticator"
                  ? "Google Authenticator"
                  : "Two-Factor Verification"}
              </Text>
              <Text className="text-xs text-gray-500 text-center mt-1 mb-5 px-2 leading-relaxed">
                {twoFactorMethod === "authenticator" ? (
                  <>
                    Enter the 6-digit code currently generated in your{" "}
                    <Text className="font-bold text-gray-700">
                      Google Authenticator
                    </Text>{" "}
                    app.
                  </>
                ) : (
                  <>
                    A 6-digit security code was sent to{" "}
                    <Text className="font-bold text-gray-700">
                      {pending2FAEmail.includes("@")
                        ? `${pending2FAEmail.split("@")[0].slice(0, 3)}••••••@${pending2FAEmail.split("@")[1]}`
                        : pending2FAEmail}
                    </Text>
                  </>
                )}
              </Text>

              {/* 6 Digit OTP Inputs */}
              <View className="flex-row justify-center gap-2 mb-4 w-full">
                {twoFactorCode.map((digit, idx) => (
                  <RNTextInput
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, idx)}
                    onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                    keyboardType="number-pad"
                    maxLength={idx === 0 ? 6 : 1}
                    selectTextOnFocus
                    className={`w-11 h-13 text-center text-xl font-bold rounded-xl border ${
                      twoFactorCode[idx]
                        ? "border-[#72AF5B] bg-[#F0FDF4] text-[#15803D]"
                        : "border-gray-200 bg-gray-50 text-gray-900"
                    }`}
                  />
                ))}
              </View>

              {twoFactorError ? (
                <View className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4 w-full">
                  <Text className="text-xs text-red-600 text-center font-medium">
                    {twoFactorError}
                  </Text>
                </View>
              ) : null}

              {/* Verify Button */}
              <TouchableOpacity
                onPress={handleVerify2FALogin}
                disabled={isVerifying2FA}
                className="w-full h-12 bg-[#72AF5B] rounded-2xl items-center justify-center shadow-md active:opacity-90 flex-row gap-2 mt-1"
              >
                {isVerifying2FA ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : null}
                <Text className="text-white text-base font-bold">
                  {isVerifying2FA ? "Verifying..." : "Verify & Sign In"}
                </Text>
              </TouchableOpacity>

              {/* Action Hint / Resend */}
              {twoFactorMethod === "authenticator" ? (
                <View className="items-center justify-center mt-4 px-2">
                  <Text className="text-[11px] text-gray-400 text-center">
                    Google Authenticator codes refresh every 30 seconds.
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center justify-center mt-4">
                  <Text className="text-xs text-gray-500">Didn't get the code? </Text>
                  <TouchableOpacity
                    onPress={handleResendLogin2FACode}
                    disabled={resendCooldown > 0}
                    className="py-1"
                  >
                    <Text
                      className={`text-xs font-bold ${
                        resendCooldown > 0 ? "text-gray-400" : "text-[#72AF5B]"
                      }`}
                    >
                      {resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : "Resend Code"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Cancel Button */}
              <TouchableOpacity
                onPress={() => setIs2FAModalVisible(false)}
                className="mt-3 py-2 px-4"
              >
                <Text className="text-xs font-semibold text-gray-400">
                  Cancel & Return to Login
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ImageBackground>
  );
}

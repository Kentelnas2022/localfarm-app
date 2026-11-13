import { useToast } from "@/context/toast-context";
import { useAuth } from "@/hooks/use-auth";
import {
  confirmGoogleAuthSetupApi,
  getGoogleAuthSetupApi,
} from "@/services/auth-service";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  TextInput as RNTextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { TWO_FACTOR_STORAGE_KEY } from "./TwoFactorOtp";

export default function GoogleAuthSetupScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [secretKey, setSecretKey] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isLoadingSetup, setIsLoadingSetup] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // References for 6 input boxes
  const inputRefs = useRef<Array<RNTextInput | null>>([]);

  const loadSetupDetails = async () => {
    try {
      setIsLoadingSetup(true);
      setFetchError("");
      const res = await getGoogleAuthSetupApi();
      setSecretKey(res.secret || "");
      setAccountName(res.accountName || `Local Farm (${user?.email || "Account"})`);
    } catch (err: any) {
      setFetchError(
        err?.message || "Failed to generate Authenticator setup key. Please try again."
      );
    } finally {
      setIsLoadingSetup(false);
    }
  };

  useEffect(() => {
    loadSetupDetails();
  }, [user?.email]);

  const handleCopyKey = async () => {
    if (!secretKey) return;
    try {
      await Clipboard.setStringAsync(secretKey);
    } catch {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(secretKey);
      }
    }
    setCopied(true);
    showToast("Setup key copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleChangeText = (text: string, index: number) => {
    const cleanText = text.replace(/[^0-9]/g, "");
    const newOtp = [...otp];

    if (cleanText.length > 1) {
      // Pasted full code
      const pastedDigits = cleanText.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedDigits[i] || "";
      }
      setOtp(newOtp);
      const nextIndex = Math.min(pastedDigits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
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
    index: number
  ) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = otp.join("").trim();
    if (fullCode.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit code from Google Authenticator.");
      return;
    }

    if (!secretKey) {
      setErrorMsg("Secret key not generated yet. Please wait or reload.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await confirmGoogleAuthSetupApi(fullCode, secretKey);
      await updateUser({
        twoFactorEnabled: true,
        twoFactorMethod: "authenticator",
      });

      await AsyncStorage.setItem(
        TWO_FACTOR_STORAGE_KEY,
        JSON.stringify({
          isEnabled: true,
          method: "authenticator",
          updatedAt: new Date().toISOString(),
        })
      );

      setIsSubmitting(false);
      showToast("Google Authenticator enabled successfully!", "success");
      router.replace("/user/TwoFactorAuth" as any);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(
        err?.message ||
          "Invalid verification code. Please check the 6-digit code currently shown in Google Authenticator."
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Top Header */}
      <View className="relative items-center justify-center py-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute left-4 p-1 active:opacity-70"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-undo" size={26} color="#000000" />
        </TouchableOpacity>

        <Text className="text-base font-bold text-gray-900">
          Google Authenticator Setup
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40) }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Section */}
          <View className="items-center mt-6 mb-6">
            <View className="w-16 h-16 rounded-full bg-[#E8F5E9] items-center justify-center mb-3 shadow-sm shadow-[#77af5c]/20">
              <Ionicons name="shield-checkmark" size={32} color="#77af5c" />
            </View>

            <Text className="text-xl font-black text-gray-900 text-center mb-1">
              Set Up Authenticator
            </Text>

            <Text className="text-xs text-gray-500 text-center px-4 leading-relaxed">
              Pair your Local Farm account with Google Authenticator to generate time-based verification passcodes.
            </Text>
          </View>

          {/* Step 1: Open App */}
          <View className="bg-[#F9FAFB] rounded-2xl p-4 mb-4 border border-gray-200/80">
            <View className="flex-row items-center gap-2.5 mb-2">
              <View className="w-6 h-6 rounded-full bg-[#77af5c] items-center justify-center">
                <Text className="text-xs font-bold text-white">1</Text>
              </View>
              <Text className="text-sm font-bold text-gray-900">
                Open Google Authenticator
              </Text>
            </View>

            <Text className="text-xs text-gray-600 leading-relaxed pl-8 mb-3">
              Download Google Authenticator on your phone if you haven't yet, open the app, and tap the <Text className="font-bold text-gray-800">"+"</Text> button.
            </Text>

            <View className="ml-8 flex-row items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 self-start">
              <Ionicons name="logo-google" size={14} color="#4285F4" />
              <Text className="text-xs font-semibold text-gray-700">
                Google Authenticator
              </Text>
            </View>
          </View>

          {/* Step 2: Enter Key */}
          <View className="bg-[#F9FAFB] rounded-2xl p-4 mb-4 border border-gray-200/80">
            <View className="flex-row items-center gap-2.5 mb-2">
              <View className="w-6 h-6 rounded-full bg-[#77af5c] items-center justify-center">
                <Text className="text-xs font-bold text-white">2</Text>
              </View>
              <Text className="text-sm font-bold text-gray-900">
                Enter your Setup Key
              </Text>
            </View>

            <Text className="text-xs text-gray-600 leading-relaxed pl-8 mb-3">
              Choose <Text className="font-semibold text-gray-800">"Enter a setup key"</Text> in Google Authenticator and add this secret key:
            </Text>

            {/* Secret Key Display Box */}
            <View className="ml-8 bg-white border border-gray-300 rounded-xl p-3 flex-row items-center justify-between mb-2 shadow-sm">
              <View className="flex-1 pr-2">
                <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                  Your Secret Key
                </Text>
                {isLoadingSetup ? (
                  <View className="flex-row items-center py-1">
                    <ActivityIndicator size="small" color="#77af5c" />
                    <Text className="text-xs text-gray-400 ml-2">Generating secure key...</Text>
                  </View>
                ) : fetchError ? (
                  <View className="flex-row items-center py-1">
                    <Text className="text-xs text-red-500 mr-2">Failed to load key</Text>
                    <TouchableOpacity onPress={loadSetupDetails}>
                      <Text className="text-xs font-bold text-[#77af5c]">Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text
                    className="text-sm font-mono font-bold text-gray-900 tracking-wider"
                    selectable
                  >
                    {secretKey.match(/.{1,4}/g)?.join(" ") || secretKey}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleCopyKey}
                disabled={isLoadingSetup || !secretKey}
                className={`px-3 py-2 rounded-lg flex-row items-center gap-1.5 active:opacity-75 ${
                  copied ? "bg-[#77af5c]" : "bg-[#E8F5E9]"
                }`}
                accessibilityRole="button"
                accessibilityLabel="Copy setup key"
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={14}
                  color={copied ? "#FFFFFF" : "#77af5c"}
                />
                <Text
                  className={`text-xs font-bold ${
                    copied ? "text-white" : "text-[#77af5c]"
                  }`}
                >
                  {copied ? "Copied" : "Copy"}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="ml-8 bg-gray-50 rounded-lg p-2 border border-gray-200">
              <Text className="text-[11px] text-gray-500">
                Account name:{" "}
                <Text className="font-semibold text-gray-700">
                  {accountName || `Local Farm (${user?.email || "Account"})`}
                </Text>
              </Text>
              <Text className="text-[11px] text-gray-500 mt-0.5">
                Key type: <Text className="font-semibold text-gray-700">Time-based</Text>
              </Text>
            </View>
          </View>

          {/* Step 3: Verify 6-Digit Code */}
          <View className="bg-[#F9FAFB] rounded-2xl p-4 mb-6 border border-gray-200/80">
            <View className="flex-row items-center gap-2.5 mb-2">
              <View className="w-6 h-6 rounded-full bg-[#77af5c] items-center justify-center">
                <Text className="text-xs font-bold text-white">3</Text>
              </View>
              <Text className="text-sm font-bold text-gray-900">
                Enter the 6-Digit Code
              </Text>
            </View>

            <Text className="text-xs text-gray-600 leading-relaxed pl-8 mb-4">
              Enter the 6-digit code currently displayed in Google Authenticator:
            </Text>

            {/* Error Message */}
            {errorMsg ? (
              <View className="ml-8 bg-[#FFEBEA] p-2.5 rounded-xl mb-3 border border-[#FFCCCC]">
                <Text className="text-[#FF3B30] text-xs text-center font-medium">
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {/* 6 Digit Input Boxes */}
            <View className="ml-8 flex-row justify-between">
              {otp.map((digit, index) => (
                <RNTextInput
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  className={`w-[42px] h-[50px] bg-white border ${
                    digit
                      ? "border-[#77af5c]"
                      : errorMsg
                      ? "border-[#FF3B30] bg-[#FFF8F8]"
                      : "border-gray-300"
                  } rounded-xl text-center text-xl font-bold text-gray-900 shadow-sm`}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={digit}
                  onChangeText={(text) => handleChangeText(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  selectTextOnFocus
                />
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            onPress={handleVerify}
            disabled={isSubmitting}
            className="w-full h-[52px] bg-[#77af5c] rounded-2xl items-center justify-center shadow-md active:opacity-90 mb-3"
            style={{
              backgroundColor: "#77af5c",
              shadowColor: "#77af5c",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
            }}
            accessibilityRole="button"
            accessibilityLabel="Verify and Turn On Google Authenticator"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-base font-bold text-white">
                Verify & Turn On
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="w-full py-3 items-center justify-center active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text className="text-sm font-bold text-gray-400">Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
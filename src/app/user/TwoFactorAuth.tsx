import { useToast } from "@/context/toast-context";
import { useAuth } from "@/hooks/use-auth";
import {
  disable2FAApi,
  send2FASetupOtpApi,
} from "@/services/auth-service";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Navigation from "../../components/Navigation";
import { TWO_FACTOR_STORAGE_KEY } from "./TwoFactorOtp";

export default function TwoFactorAuth() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [isEmailEnabled, setIsEmailEnabled] = useState(
    Boolean(user?.twoFactorEnabled && user?.twoFactorMethod === "email")
  );
  const [isAppEnabled, setIsAppEnabled] = useState(
    Boolean(user?.twoFactorEnabled && user?.twoFactorMethod === "authenticator")
  );
  const [isSaving, setIsSaving] = useState(false);

  // Sync existing 2FA preference from user context and local storage fallback
  const syncSettings = useCallback(async () => {
    if (user?.twoFactorEnabled) {
      if (user.twoFactorMethod === "authenticator") {
        setIsAppEnabled(true);
        setIsEmailEnabled(false);
      } else {
        setIsEmailEnabled(true);
        setIsAppEnabled(false);
      }
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(TWO_FACTOR_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.method === "authenticator") {
          setIsAppEnabled(Boolean(parsed.isEnabled));
          setIsEmailEnabled(false);
        } else {
          setIsEmailEnabled(Boolean(parsed.isEnabled));
          setIsAppEnabled(false);
        }
      } else {
        setIsEmailEnabled(false);
        setIsAppEnabled(false);
      }
    } catch (err) {
      console.warn("Error loading 2FA status:", err);
    }
  }, [user?.twoFactorEnabled, user?.twoFactorMethod]);

  useEffect(() => {
    syncSettings();
  }, [syncSettings]);

  useFocusEffect(
    useCallback(() => {
      syncSettings();
    }, [syncSettings])
  );

  const handleBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/user/Security" as any);
      }
    } catch {
      router.push("/user/Security" as any);
    }
  };

  const handleOpenAppCard = () => {
    if (isAppEnabled) {
      Alert.alert(
        "Google Authenticator Active",
        "Google Authenticator is currently protecting your account. Do you want to disable it?",
        [
          { text: "Keep Active", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              try {
                setIsSaving(true);
                await disable2FAApi();
                await updateUser({
                  twoFactorEnabled: false,
                  twoFactorMethod: "none",
                });
                await AsyncStorage.setItem(
                  TWO_FACTOR_STORAGE_KEY,
                  JSON.stringify({
                    isEnabled: false,
                    method: "none",
                    updatedAt: new Date().toISOString(),
                  })
                );
                setIsAppEnabled(false);
                showToast("Google Authenticator disabled.", "info");
              } catch (err: any) {
                Alert.alert("Error", err?.message || "Could not disable authenticator.");
              } finally {
                setIsSaving(false);
              }
            },
          },
        ]
      );
    } else {
      router.push("/user/GoogleAuthSetup" as any);
    }
  };

  const handleEmailToggle = (value: boolean) => {
    setIsEmailEnabled(value);
    if (value && isAppEnabled) {
      setIsAppEnabled(false);
    }
  };

  const handleSave = async () => {
    if (isEmailEnabled) {
      if (user?.twoFactorEnabled && user?.twoFactorMethod === "email") {
        showToast("Email Two-Factor Authentication is already active.", "info");
        handleBack();
        return;
      }

      setIsSaving(true);
      try {
        const res = await send2FASetupOtpApi();
        showToast(res.message || `Verification code sent to ${user?.email}`, "success");
        router.push({
          pathname: "/user/TwoFactorOtp",
          params: {
            method: "email",
            target: user?.email || "",
          },
        } as any);
      } catch (err: any) {
        showToast(err?.message || "Failed to send 2FA verification code.", "error");
      } finally {
        setIsSaving(false);
      }
    } else if (isAppEnabled) {
      router.push("/user/GoogleAuthSetup" as any);
    } else {
      // Disabling 2FA
      if (!user?.twoFactorEnabled) {
        showToast("Two-factor authentication is already disabled.", "info");
        handleBack();
        return;
      }

      setIsSaving(true);
      try {
        const res = await disable2FAApi();
        await updateUser({
          twoFactorEnabled: false,
          twoFactorMethod: "none",
        });
        await AsyncStorage.setItem(
          TWO_FACTOR_STORAGE_KEY,
          JSON.stringify({
            isEnabled: false,
            method: "none",
            updatedAt: new Date().toISOString(),
          })
        );
        showToast(res.message || "Two-factor authentication disabled.", "info");
        handleBack();
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to update 2FA settings.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const userEmail = user?.email || "your registered email";

  return (
    <SafeAreaView
      className="flex-1 bg-white relative"
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
    >
      {/* Main Content ScrollView */}
      <ScrollView
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Top Header */}
        <View className="relative items-center justify-center py-4 mt-2">
          <TouchableOpacity
            onPress={handleBack}
            className="absolute left-4 p-1 active:opacity-70"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-undo" size={28} color="#000000" />
          </TouchableOpacity>

          <Text className="text-lg font-bold text-gray-900">
            Two Factor Authentication
          </Text>
        </View>

        {/* Hero Section */}
        <View className="bg-[#e6f4ea] w-20 h-20 rounded-full items-center justify-center mx-auto mt-6 mb-4 shadow-sm shadow-[#77af5c]/20">
          <Ionicons name="shield-checkmark" size={40} color="#77af5c" />
        </View>

        <Text className="text-xl font-black text-gray-800 text-center mb-1.5">
          Two-factor Authentication
        </Text>

        <Text className="text-xs text-gray-500 text-center px-8 mb-7 leading-5">
          Add an extra layer of defense to keep your farm listings, orders, and account secure.
        </Text>

        {/* Options Section */}
        <View className="px-5">
          {/* Section Header */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">
            Verification Methods
          </Text>

          {/* Option 1: Google Authenticator Card */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleOpenAppCard}
            className={`bg-white rounded-2xl p-4 mb-4 border ${
              isAppEnabled ? "border-[#77af5c] bg-[#F8FCF7]" : "border-gray-200"
            } shadow-sm`}
            accessibilityRole="button"
            accessibilityLabel="Google Authenticator option"
          >
            {/* Top Row: Icon + Title + Status/Recommended Badge */}
            <View className="flex-row items-center justify-between mb-2.5">
              <View className="flex-row items-center gap-3">
                <View
                  className={`w-11 h-11 rounded-xl items-center justify-center ${
                    isAppEnabled ? "bg-[#77af5c]" : "bg-[#E8F5E9]"
                  }`}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={22}
                    color={isAppEnabled ? "#FFFFFF" : "#77af5c"}
                  />
                </View>
                <View>
                  <Text className="text-base font-bold text-gray-900">
                    Authenticator App
                  </Text>
                  <Text className="text-[11px] text-gray-400">
                    Time-based security codes (TOTP)
                  </Text>
                </View>
              </View>

              {isAppEnabled ? (
                <View className="bg-[#E8F5E9] px-2.5 py-1 rounded-full border border-[#77af5c]/30 flex-row items-center gap-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-[#77af5c]" />
                  <Text className="text-[11px] font-bold text-[#4B8A38]">Active</Text>
                </View>
              ) : (
                <View className="bg-[#E8F5E9] px-2.5 py-1 rounded-full border border-[#77af5c]/20">
                  <Text className="text-[11px] font-bold text-[#4B8A38]">
                    Recommended
                  </Text>
                </View>
              )}
            </View>

            {/* Description - Google Authenticator only */}
            <Text className="text-xs text-gray-600 leading-relaxed mb-3">
              Use Google Authenticator to generate secure dynamic verification codes directly on your device.
            </Text>

            {/* Google Authenticator Tag */}
            <View className="flex-row items-center mb-3">
              <View className="flex-row items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200/80">
                <Ionicons name="logo-google" size={13} color="#4285F4" />
                <Text className="text-[11px] font-semibold text-gray-700">
                  Google Authenticator
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View className="h-[1px] bg-gray-100 mb-3" />

            {/* Footer: Status & Action Link */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <View
                  className={`w-2 h-2 rounded-full ${
                    isAppEnabled ? "bg-[#77af5c]" : "bg-gray-300"
                  }`}
                />
                <Text className="text-xs font-medium text-gray-500">
                  {isAppEnabled ? "Paired with your device" : "Not configured"}
                </Text>
              </View>

              <View className="flex-row items-center gap-1">
                <Text className="text-xs font-bold text-[#77af5c]">
                  {isAppEnabled ? "Manage" : "Set Up"}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#77af5c" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Option 2: Email Address Card */}
          <View
            className={`bg-white rounded-2xl p-4 mb-8 border ${
              isEmailEnabled ? "border-[#77af5c] bg-[#F8FCF7]" : "border-gray-200"
            } shadow-sm`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1 pr-3">
                <View
                  className={`w-11 h-11 rounded-xl items-center justify-center ${
                    isEmailEnabled ? "bg-[#77af5c]" : "bg-gray-100"
                  }`}
                >
                  <Ionicons
                    name="mail-outline"
                    size={22}
                    color={isEmailEnabled ? "#FFFFFF" : "#4B5563"}
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-gray-900">
                      Email Address
                    </Text>
                    {user?.twoFactorEnabled && user?.twoFactorMethod === "email" && (
                      <View className="bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#77af5c]/30 flex-row items-center gap-1">
                        <View className="w-1.5 h-1.5 rounded-full bg-[#77af5c]" />
                        <Text className="text-[10px] font-bold text-[#4B8A38]">Active</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                    Send one-time codes to {userEmail}
                  </Text>
                </View>
              </View>

              <Switch
                trackColor={{ false: "#d1d5db", true: "#77af5c" }}
                thumbColor="#FFFFFF"
                value={isEmailEnabled}
                onValueChange={handleEmailToggle}
                disabled={isSaving}
              />
            </View>
          </View>
        </View>

        {/* Bottom Action Buttons */}
        <View className="flex-row justify-between items-center border border-[#77af5c] rounded-full p-1.5 mx-5 mb-8">
          <TouchableOpacity
            onPress={handleBack}
            className="active:opacity-70 px-4 py-2"
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text className="text-sm font-bold text-gray-400">Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            className="bg-[#77af5c] rounded-full px-6 py-2.5 active:bg-[#66984e] flex-row items-center gap-2"
            style={{ backgroundColor: "#77af5c" }}
            activeOpacity={0.8}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save Changes"
          >
            {isSaving && <ActivityIndicator size="small" color="#FFFFFF" />}
            <Text className="text-sm font-bold text-white">
              {isSaving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <Navigation activeTab="Menu" showFab={false} />
    </SafeAreaView>
  );
}

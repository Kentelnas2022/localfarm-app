import { useAuth } from "@/hooks/use-auth";
import { router, Stack } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";

/**
 * User Route Group Middleware (_layout.tsx)
 * Ensures only authenticated users can access any screen inside /user/*
 */
export default function UserLayout() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/Login" as any);
    }
  }, [user, isLoading]);

  // Block rendering protected user screens until user is confirmed authenticated on cold boot
  if (isLoading && !user) {
    return <View className="flex-1 bg-white" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="NewsFeed" options={{ animation: "none" }} />
      <Stack.Screen name="People" options={{ animation: "none" }} />
      <Stack.Screen name="Chats" options={{ animation: "none" }} />
      <Stack.Screen name="ExploreMap" options={{ animation: "none" }} />
      <Stack.Screen name="MenuProfile" options={{ animation: "none" }} />
      <Stack.Screen name="Friends" options={{ animation: "none" }} />
      <Stack.Screen name="Suggestions" options={{ animation: "none" }} />
      <Stack.Screen name="NearbyUsers" options={{ animation: "none" }} />
      <Stack.Screen name="SentRequests" options={{ animation: "none" }} />
      <Stack.Screen name="MessageRequests" options={{ animation: "none" }} />
      <Stack.Screen name="SpamMessages" options={{ animation: "none" }} />
      <Stack.Screen name="ArchivedMessages" options={{ animation: "none" }} />
      <Stack.Screen name="RestrictedAccounts" options={{ animation: "none" }} />
    </Stack>
  );
}


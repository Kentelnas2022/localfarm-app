import "../global.css";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  DarkTheme,
  DefaultTheme,
  Slot,
  ThemeProvider,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, useColorScheme, View } from "react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { LoadingScreen } from "../components/LoadingScreen";
import { AnimatedSplashOverlay } from "../components/SplashScreen";
import { AuthProvider } from "@/context/auth-context";
import { useAuth } from "@/hooks/use-auth";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Ignore non-fatal development warnings from transient Metro/HMR WebSocket drops and React 19 Fabric unmounted fiber checks
LogBox.ignoreLogs([
  "Cannot connect to Expo CLI",
  "Can't perform a React state update on a component that hasn't mounted yet",
  "Failed to fetch",
  "Authentication required",
  "connect ECONNREFUSED",
  "Failed to connect to",
]);

import { useToast } from "@/context/toast-context";

// Module-scoped flag: persists in memory across hot reload and Fast Refresh cycles
let hasCompletedStartup = false;

function RootNavigation() {
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();

  // Startup phase states: 'splash' -> 'loading' -> 'ready'
  // On hot reload, skip straight to 'ready' if initial startup was already completed
  const [appPhase, setAppPhase] = useState<"splash" | "loading" | "ready">(
    hasCompletedStartup ? "ready" : "splash",
  );

  useEffect(() => {
    if (hasCompletedStartup) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }

    // 1. Hide native splash and stay on custom Splash Screen for 1.2s
    const splashTimer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setAppPhase("loading");
    }, 1200);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    if (hasCompletedStartup) return;

    // 2. Stay on Loading Screen until minimum 2.4s total time & auth session check finishes
    if (appPhase === "loading" && !isLoading) {
      const loadingTimer = setTimeout(() => {
        hasCompletedStartup = true;
        setAppPhase("ready");
      }, 1200);

      return () => clearTimeout(loadingTimer);
    }
  }, [appPhase, isLoading]);

  useEffect(() => {
    // 3. Security guards after splash/loading phase
    if (appPhase !== "ready") return;
    if (isLoading) return;

    const firstSegment = (segments[0] as string) || "";
    const inAuthGroup = firstSegment === "auth";

    // A. Unauthenticated user trying to access ANY protected route
    if (!user && !inAuthGroup) {
      router.replace("/auth/Login" as any);
      return;
    }

    // B. Authenticated user visiting auth pages (Login/Signup/ForgotPassword)
    if (user && inAuthGroup) {
      router.replace("/user/NewsFeed" as any);
    }
  }, [appPhase, user, isLoading, segments]);

  // Phase 1: Green Splash Screen
  if (appPhase === "splash") {
    return <AnimatedSplashOverlay />;
  }

  // Phase 2: White Loading Screen with animated running green border
  if (appPhase === "loading") {
    return <LoadingScreen />;
  }

  // Phase 3: Route security guard (Prevent rendering protected content before redirect)
  const firstSegment = (segments[0] as string) || "";
  const inAuthGroup = firstSegment === "auth";

  if (!user && !inAuthGroup) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Slot />
    </ThemeProvider>
  );
}

import { ToastProvider } from "@/context/toast-context";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthProvider>
            <RootNavigation />
          </AuthProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

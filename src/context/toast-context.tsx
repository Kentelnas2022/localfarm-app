import { Ionicons } from "@expo/vector-icons";
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  Animated,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(-20));

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [fadeAnim, translateY]);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Date.now().toString();
      setToast({ id, message, type });

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 3.5 seconds
      setTimeout(() => {
        hideToast();
      }, 3500);
    },
    [fadeAnim, translateY, hideToast],
  );

  const getToastStyle = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-[#10B981]",
          border: "border-[#059669]",
          icon: "checkmark-circle" as const,
        };
      case "error":
        return {
          bg: "bg-[#EF4444]",
          border: "border-[#DC2626]",
          icon: "alert-circle" as const,
        };
      case "warning":
        return {
          bg: "bg-[#F59E0B]",
          border: "border-[#D97706]",
          icon: "warning" as const,
        };
      default:
        return {
          bg: "bg-[#3B82F6]",
          border: "border-[#2563EB]",
          icon: "information-circle" as const,
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      <View style={{ flex: 1, width: "100%", height: "100%", position: "relative" }}>
        {children}
        {toast ? (
          <Animated.View
            pointerEvents="box-none"
            style={{
              position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
              top: Platform.OS === "web" ? 20 : Math.max(insets.top + 16, 24),
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999999,
              elevation: 999999,
              paddingHorizontal: 16,
              opacity: fadeAnim,
              transform: [{ translateY }],
            }}
          >
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={hideToast}
              className={`flex-row items-center max-w-[400px] w-full px-4 py-3.5 rounded-2xl shadow-2xl border border-white/20 ${
                getToastStyle(toast.type).bg
              }`}
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 14,
                elevation: 12,
              }}
            >
              <Ionicons
                name={getToastStyle(toast.type).icon}
                size={22}
                color="#FFFFFF"
              />
              <Text className="flex-1 ml-3 text-white text-sm font-bold tracking-wide leading-snug">
                {toast.message}
              </Text>
              <Ionicons
                name="close"
                size={18}
                color="#FFFFFF"
                style={{ opacity: 0.85, marginLeft: 8 }}
              />
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

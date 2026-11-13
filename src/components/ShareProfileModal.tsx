import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ShareProfileModalProps {
  visible: boolean;
  onClose: () => void;
  username?: string;
  onShowToast?: (message: string, type?: "success" | "error" | "info") => void;
}

interface ColorTheme {
  name: string;
  gradient: [string, string, ...string[]];
  qrColor: string;
}

interface EmojiTheme {
  emoji: string;
  name: string;
  bgColor: string;
  qrColor: string;
}

const COLOR_THEMES: ColorTheme[] = [
  {
    name: "Local Farm Green",
    gradient: ["#72AF5B", "#FFFFFF"], // Default requested: #72AF5B and white
    qrColor: "#72AF5B",
  },
  {
    name: "Deep Forest",
    gradient: ["#5CB85C", "#1F4E24"], // Deep green theme
    qrColor: "#5CB85C",
  },
  {
    name: "Purple Blossom",
    gradient: ["#8B5CF6", "#FFFFFF"], // Purple
    qrColor: "#8B5CF6",
  },
  {
    name: "Fresh Sky",
    gradient: ["#3B82F6", "#FFFFFF"], // Blue
    qrColor: "#3B82F6",
  },
  {
    name: "Berry Pink",
    gradient: ["#EC4899", "#FFFFFF"], // Pink
    qrColor: "#EC4899",
  },
  {
    name: "Sunrise Amber",
    gradient: ["#F59E0B", "#FFFFFF"], // Amber
    qrColor: "#D97706",
  },
  {
    name: "Midnight Monochrome",
    gradient: ["#1F2937", "#111827"], // Dark Monochrome
    qrColor: "#111827",
  },
];

const EMOJI_THEMES: EmojiTheme[] = [
  { emoji: "🌾", name: "Wheat", bgColor: "#FEF9C3", qrColor: "#CA8A04" },
  { emoji: "🌱", name: "Sprout", bgColor: "#DCFCE7", qrColor: "#16A34A" },
  { emoji: "🚜", name: "Tractor", bgColor: "#FFEDD5", qrColor: "#EA580C" },
  { emoji: "🌽", name: "Corn", bgColor: "#FEF08A", qrColor: "#CA8A04" },
  { emoji: "🍎", name: "Apple", bgColor: "#FEE2E2", qrColor: "#DC2626" },
  { emoji: "🥕", name: "Carrot", bgColor: "#FFEDD5", qrColor: "#EA580C" },
  { emoji: "🌻", name: "Sunflower", bgColor: "#FEF3C7", qrColor: "#D97706" },
  { emoji: "🍓", name: "Strawberry", bgColor: "#FCE7F3", qrColor: "#DB2777" },
  { emoji: "🥑", name: "Avocado", bgColor: "#ECFCCB", qrColor: "#65A30D" },
  { emoji: "🐮", name: "Cow", bgColor: "#F3F4F6", qrColor: "#4B5563" },
];

export default function ShareProfileModal({
  visible,
  onClose,
  username = "@NATHANSALVEDIA",
  onShowToast,
}: ShareProfileModalProps) {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<"colour" | "emoji">("colour");
  const [colorThemeIndex, setColorThemeIndex] = useState(0);
  const [emojiThemeIndex, setEmojiThemeIndex] = useState(0);

  // Compute square card size based on screen width
  const cardSize = Math.min(width - 64, 320);
  const qrImageSize = cardSize - 72;

  const currentColorTheme = COLOR_THEMES[colorThemeIndex];
  const currentEmojiTheme = EMOJI_THEMES[emojiThemeIndex];

  const activeQrColor =
    mode === "colour" ? currentColorTheme.qrColor : currentEmojiTheme.qrColor;

  const handleCycleColor = () => {
    setColorThemeIndex((prev) => (prev + 1) % COLOR_THEMES.length);
  };

  const handleCycleEmoji = () => {
    setEmojiThemeIndex((prev) => (prev + 1) % EMOJI_THEMES.length);
  };

  const handleScreenPress = () => {
    if (mode === "colour") {
      handleCycleColor();
    } else {
      handleCycleEmoji();
    }
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: `Check out ${username} on Local Farm! https://localfarm.app/u/${username.replace("@", "").toLowerCase()}`,
        title: `${username} on Local Farm`,
      });
    } catch {
      onShowToast?.("Could not share profile", "error");
    }
  };

  const handleCopyLink = () => {
    onShowToast?.("Link copied to clipboard!", "success");
  };

  const handleDownload = () => {
    onShowToast?.("QR code saved to gallery!", "success");
  };

  const handleScanQR = () => {
    Alert.alert("QR Scanner", "QR Code scanning feature will open camera scanner.");
  };

  const formattedUsername = username.startsWith("@")
    ? username.toUpperCase()
    : `@${username.toUpperCase()}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, position: "relative" }}>
        {/* Background Layer: Gradient (Colour mode) or Tiled Emojis (Emoji mode) */}
        {mode === "colour" ? (
          <LinearGradient
            colors={currentColorTheme.gradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: currentEmojiTheme.bgColor,
                overflow: "hidden",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-around",
                alignContent: "space-around",
                padding: 6,
              },
            ]}
          >
            {Array.from({ length: 60 }).map((_, idx) => (
              <View
                key={idx}
                style={{
                  width: "16.6%",
                  height: 60,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 26,
                    opacity: 0.78,
                    transform: [{ rotate: idx % 2 === 0 ? "-12deg" : "12deg" }],
                  }}
                >
                  {currentEmojiTheme.emoji}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Full Screen Tap Layer: Tapping anywhere on the background cycles color / emoji */}
        <TouchableWithoutFeedback onPress={handleScreenPress}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <StatusBar style={mode === "colour" ? "light" : "dark"} />

        <SafeAreaView
          edges={["top", "bottom", "left", "right"]}
          style={{ flex: 1, pointerEvents: "box-none" }}
        >
          {/* Top Navigation Bar */}
          <View className="flex-row items-center justify-between px-5 pt-3 pb-2 z-20">
            {/* Close ("X") Icon Button */}
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-10 h-10 items-center justify-center -ml-2 rounded-full bg-black/25 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Close share profile modal"
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Upper Mode Pill Button: Toggle & Cycle between COLOUR and EMOJI */}
            <View className="flex-row items-center bg-black/30 rounded-full p-1 border border-white/40 shadow-xs">
              {/* COLOUR Tab */}
              <TouchableOpacity
                onPress={() => {
                  if (mode === "colour") {
                    handleCycleColor();
                  } else {
                    setMode("colour");
                  }
                }}
                activeOpacity={0.8}
                className={`px-4 py-1.5 rounded-full flex-row items-center gap-1 ${
                  mode === "colour" ? "bg-white shadow-xs" : "bg-transparent"
                }`}
                accessibilityRole="button"
                accessibilityLabel="Switch to Colour mode or cycle color"
              >
                <Text
                  className={`font-bold text-xs tracking-wider uppercase ${
                    mode === "colour" ? "text-gray-900" : "text-white/90"
                  }`}
                >
                  COLOUR
                </Text>
              </TouchableOpacity>

              {/* EMOJI Tab */}
              <TouchableOpacity
                onPress={() => {
                  if (mode === "emoji") {
                    handleCycleEmoji();
                  } else {
                    setMode("emoji");
                  }
                }}
                activeOpacity={0.8}
                className={`px-4 py-1.5 rounded-full flex-row items-center gap-1.5 ${
                  mode === "emoji" ? "bg-white shadow-xs" : "bg-transparent"
                }`}
                accessibilityRole="button"
                accessibilityLabel="Switch to Emoji mode or cycle emoji"
              >
                <Text className="text-xs">{currentEmojiTheme.emoji}</Text>
                <Text
                  className={`font-bold text-xs tracking-wider uppercase ${
                    mode === "emoji" ? "text-gray-900" : "text-white/90"
                  }`}
                >
                  EMOJI
                </Text>
              </TouchableOpacity>
            </View>

            {/* QR Scanner Icon Button */}
            <TouchableOpacity
              onPress={handleScanQR}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-10 h-10 items-center justify-center -mr-2 rounded-full bg-black/25 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Scan QR code"
            >
              <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Main QR Card (Centered) */}
          <View className="flex-1 items-center justify-center px-6 z-10 pointer-events-box-none">
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleScreenPress}
              className="bg-white rounded-2xl items-center justify-center p-6 shadow-xl"
              style={{
                width: cardSize,
                elevation: 8,
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
              }}
              accessibilityRole="button"
              accessibilityLabel="Tap QR card to cycle theme"
            >
              {/* Static Placeholder QR Code Image with matching theme color */}
              <Image
                source={require("../../assets/images/qr-placeholder.png")}
                style={{
                  width: qrImageSize,
                  height: qrImageSize,
                  tintColor: activeQrColor,
                }}
                resizeMode="contain"
                accessibilityLabel="QR Code"
              />

              {/* Handle */}
              <Text
                className="font-extrabold text-base tracking-widest mt-4 uppercase text-center"
                style={{ color: "#7E22CE" }}
              >
                {formattedUsername}
              </Text>
            </TouchableOpacity>

            {/* Tap Screen Hint */}
            <TouchableOpacity
              onPress={handleScreenPress}
              activeOpacity={0.8}
              className="mt-3.5 bg-black/30 px-4 py-1.5 rounded-full border border-white/30 flex-row items-center gap-1.5"
            >
              <Text className="text-xs">
                {mode === "colour" ? "🎨" : currentEmojiTheme.emoji}
              </Text>
              <Text className="text-white font-medium text-xs">
                Tap screen to change {mode === "colour" ? "colour" : "emoji"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Actions Card */}
          <View
            className="bg-white rounded-2xl mx-6 mb-8 py-4 px-3 shadow-lg z-20"
            style={{
              elevation: 6,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
            }}
          >
            <View className="flex-row items-center justify-around">
              {/* 1. Share profile */}
              <TouchableOpacity
                onPress={handleNativeShare}
                activeOpacity={0.7}
                className="items-center justify-center flex-1 py-1"
                accessibilityRole="button"
                accessibilityLabel="Share profile"
              >
                <Ionicons name="share-social-outline" size={24} color="#1f2937" />
                <Text className="text-xs font-semibold text-gray-800 mt-2 text-center">
                  Share profile
                </Text>
              </TouchableOpacity>

              {/* 2. Copy link */}
              <TouchableOpacity
                onPress={handleCopyLink}
                activeOpacity={0.7}
                className="items-center justify-center flex-1 py-1"
                accessibilityRole="button"
                accessibilityLabel="Copy link"
              >
                <Ionicons name="link-outline" size={24} color="#1f2937" />
                <Text className="text-xs font-semibold text-gray-800 mt-2 text-center">
                  Copy link
                </Text>
              </TouchableOpacity>

              {/* 3. Download */}
              <TouchableOpacity
                onPress={handleDownload}
                activeOpacity={0.7}
                className="items-center justify-center flex-1 py-1"
                accessibilityRole="button"
                accessibilityLabel="Download QR code"
              >
                <Ionicons name="download-outline" size={24} color="#1f2937" />
                <Text className="text-xs font-semibold text-gray-800 mt-2 text-center">
                  Download
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

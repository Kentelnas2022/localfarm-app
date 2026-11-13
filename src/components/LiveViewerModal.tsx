import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/use-auth";

interface ViewerComment {
  id: string;
  sender: string;
  text: string;
  isSelf?: boolean;
}

interface FloatingHeart {
  id: string;
  emoji: string;
  animValue: Animated.Value;
  xOffset: number;
}

const SIMULATED_STREAM_COMMENTS = [
  { sender: "Ana Gomez", text: "Fresh na fresh po ang mga gulay! 🥬" },
  { sender: "Kuya Ben", text: "Available pa po ba ang sitaw at kalabasa?" },
  { sender: "Ditas Farm", text: "Gandang ani ngayong umaga! Congrats!" },
  { sender: "Mark Cruz", text: "Paki-reserve po ako 5 kilos para bukas." },
  { sender: "Liza Ramos", text: "Magkano po per bundle kuya Juan?" },
  { sender: "Tito Tony", text: "Support local Iligan farmers! Mabuhay!" },
];

export interface LiveViewerModalProps {
  isVisible: boolean;
  onClose: () => void;
  authorName?: string;
  authorAvatar?: string;
  streamTitle?: string;
  location?: string;
  isReplay?: boolean;
}

export default function LiveViewerModal({
  isVisible,
  onClose,
  authorName = "Juan Santos",
  authorAvatar = "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80",
  streamTitle = "Morning Farm Harvest at Tipanoy Valley 🌾",
  location = "Tipanoy, Iligan City",
  isReplay = false,
}: LiveViewerModalProps) {
  const { user } = useAuth();
  const [viewerCount, setViewerCount] = useState(28);
  const [likeCount, setLikeCount] = useState(64);
  const [secondsElapsed, setSecondsElapsed] = useState(42);
  const [comments, setComments] = useState<ViewerComment[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  // Pulsing live indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isVisible && !isReplay) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isVisible, isReplay, pulseAnim]);

  // Stream timer & fluctuating viewers
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isVisible) {
      setComments([
        {
          id: "init-1",
          sender: "System",
          text: "🌾 Welcome to the live farm broadcast! Feel free to ask questions about produce.",
        },
        {
          id: "init-2",
          sender: "Farmer Ramon",
          text: "Magandang umaga mga suki! Bagong pitas ang mga talong at kamatis.",
        },
      ]);
      setViewerCount(26);
      setLikeCount(64);

      timer = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
        if (Math.random() > 0.6) {
          setViewerCount((curr) => Math.max(15, curr + (Math.random() > 0.5 ? 1 : -1)));
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isVisible]);

  // Simulated live comments arriving from other viewers
  useEffect(() => {
    let commentTimer: ReturnType<typeof setInterval> | null = null;
    let idx = 0;

    if (isVisible) {
      commentTimer = setInterval(() => {
        const item = SIMULATED_STREAM_COMMENTS[idx % SIMULATED_STREAM_COMMENTS.length];
        idx++;
        setComments((prev) => [
          ...prev.slice(-15),
          { id: `${Date.now()}-${Math.random()}`, sender: item.sender, text: item.text },
        ]);
        triggerHeart(["❤️", "🌿", "🥕"][Math.floor(Math.random() * 3)]);
      }, 3500);
    }

    return () => {
      if (commentTimer) clearInterval(commentTimer);
    };
  }, [isVisible]);

  const triggerHeart = (emoji: string = "❤️") => {
    setLikeCount((c) => c + 1);
    const anim = new Animated.Value(0);
    const xOffset = Math.floor(Math.random() * 50) - 25;
    const id = `${Date.now()}-${Math.random()}`;

    setFloatingHearts((prev) => [...prev, { id, emoji, animValue: anim, xOffset }]);

    Animated.timing(anim, {
      toValue: 1,
      duration: 2200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    });
  };

  const handleSendComment = () => {
    const trimmed = inputMessage.trim();
    if (!trimmed) return;
    setComments((prev) => [
      ...prev.slice(-15),
      {
        id: `${Date.now()}`,
        sender: user?.name || user?.username || "You",
        text: trimmed,
        isSelf: true,
      },
    ]);
    setInputMessage("");
    triggerHeart("❤️");
  };

  const formatTimer = (total: number) => {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} animationType="fade" transparent={false}>
      <View className="flex-1 bg-black">
        {/* Farm Background Media Simulation */}
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?auto=format&fit=crop&w=1200&q=85",
          }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        {/* Ambient Overlay Vignette */}
        <View className="absolute inset-0 bg-black/40" />

        {/* Top Navigation & Broadcaster Profile */}
        <SafeAreaView className="absolute top-0 left-0 right-0 z-30 pt-2 px-4">
          <View className="flex-row items-center justify-between">
            {/* Broadcaster Info Badge */}
            <View className="flex-row items-center bg-black/60 rounded-full pl-1.5 pr-3 py-1 border border-white/20">
              <Image
                source={{ uri: authorAvatar }}
                className="w-8 h-8 rounded-full border border-green-500"
              />
              <View className="ml-2 mr-2">
                <View className="flex-row items-center gap-1">
                  <Text className="text-white font-bold text-xs" numberOfLines={1}>
                    {authorName}
                  </Text>
                  <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
                </View>
                <Text className="text-gray-300 text-[10px]" numberOfLines={1}>
                  📍 {location}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setIsFollowing((f) => !f)}
                className={`px-2.5 py-1 rounded-full ${
                  isFollowing ? "bg-white/30" : "bg-[#72AF5B]"
                }`}
              >
                <Text className="text-white text-[10px] font-bold">
                  {isFollowing ? "Joined" : "Join"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Right Status Controls */}
            <View className="flex-row items-center gap-2">
              {/* LIVE Badge */}
              <View
                className={`flex-row items-center px-2.5 py-1 rounded-full ${
                  isReplay ? "bg-red-700/80" : "bg-[#DC2626]"
                }`}
              >
                {!isReplay && (
                  <Animated.View
                    style={{ opacity: pulseAnim }}
                    className="w-2 h-2 rounded-full bg-white mr-1.5"
                  />
                )}
                <Text className="text-white font-extrabold text-[11px] tracking-wider">
                  {isReplay ? "REPLAY" : "LIVE"}
                </Text>
              </View>

              {/* Viewers */}
              <View className="flex-row items-center bg-black/60 px-2 py-1 rounded-full border border-white/20 gap-1">
                <Ionicons name="eye" size={12} color="#FFFFFF" />
                <Text className="text-white font-bold text-xs">{viewerCount}</Text>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-black/60 items-center justify-center border border-white/20 active:opacity-70"
                accessibilityLabel="Close Stream"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stream Title Bar */}
          <View className="mt-2.5 bg-black/40 self-start px-3 py-1 rounded-full border border-white/10 flex-row items-center gap-1.5">
            <Ionicons name="radio" size={12} color="#4ADE80" />
            <Text className="text-white text-xs font-semibold" numberOfLines={1}>
              {streamTitle}
            </Text>
            <Text className="text-gray-300 text-xs">• {formatTimer(secondsElapsed)}</Text>
          </View>
        </SafeAreaView>

        {/* Floating Reactions */}
        <View
          pointerEvents="none"
          className="absolute right-6 bottom-28 top-32 w-20 z-40 justify-end items-center"
        >
          {floatingHearts.map((item) => {
            const translateY = item.animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -280],
            });
            const opacity = item.animValue.interpolate({
              inputRange: [0, 0.2, 0.8, 1],
              outputRange: [0, 1, 1, 0],
            });
            const scale = item.animValue.interpolate({
              inputRange: [0, 0.2, 1],
              outputRange: [0.6, 1.4, 1],
            });

            return (
              <Animated.View
                key={item.id}
                style={{
                  position: "absolute",
                  transform: [{ translateY }, { translateX: item.xOffset }, { scale }],
                  opacity,
                }}
              >
                <Text className="text-3xl">{item.emoji}</Text>
              </Animated.View>
            );
          })}
        </View>

        {/* Bottom Comments Stream & Chat Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="absolute bottom-0 left-0 right-0 z-30 pb-4 px-4"
        >
          {/* Comments List */}
          <View className="max-h-48 mb-3">
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
            >
              {comments.map((c) => (
                <View
                  key={c.id}
                  className={`self-start max-w-[85%] rounded-2xl px-3 py-1.5 mb-1.5 border border-white/10 ${
                    c.isSelf ? "bg-[#72AF5B]/80" : "bg-black/60"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      c.isSelf ? "text-white" : "text-[#4ADE80]"
                    }`}
                  >
                    {c.sender}
                  </Text>
                  <Text className="text-white text-xs leading-4 mt-0.5">{c.text}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Action Row: Chat Input & Heart Reaction Button */}
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center bg-black/60 rounded-full px-3.5 py-1.5 border border-white/20">
              <TextInput
                value={inputMessage}
                onChangeText={setInputMessage}
                placeholder="Ask farmer a question or comment..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-white text-sm py-1"
                returnKeyType="send"
                onSubmitEditing={handleSendComment}
              />
              {inputMessage.trim() ? (
                <TouchableOpacity onPress={handleSendComment} className="p-1">
                  <Ionicons name="send" size={18} color="#72AF5B" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Floating Heart Button */}
            <TouchableOpacity
              onPress={() => triggerHeart("❤️")}
              className="w-11 h-11 rounded-full bg-rose-600/90 items-center justify-center shadow-lg active:scale-90"
              accessibilityLabel="Send Heart Reaction"
            >
              <Ionicons name="heart" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

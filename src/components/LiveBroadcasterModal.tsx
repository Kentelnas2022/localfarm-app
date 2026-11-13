import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useAuth } from "@/hooks/use-auth";
import { recordLiveStreamApi } from "@/services/post-service";

interface LiveComment {
  id: string;
  sender: string;
  text: string;
  avatarBg: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  animValue: Animated.Value;
  xOffset: number;
}

const SAMPLE_LOCAL_COMMENTS: Array<{ sender: string; text: string; bg: string }> = [
  { sender: "Maria Santos", text: "Good morning po! Freshly harvested po ba yan?", bg: "#10B981" },
  { sender: "Carlos Datu", text: "Available pa po ba ang dragonfruit sa Pala-o stall?", bg: "#3B82F6" },
  { sender: "Ana Reyes", text: "Wow, ang ganda ng ani! Magkano po per kilo?", bg: "#EC4899" },
  { sender: "Mang Juan", text: "Support local farmers! Ingat sa harvest!", bg: "#F59E0B" },
  { sender: "Elena Cruz", text: "Pareserve po ako ng 3 kilos bukas ng umaga! 🌿", bg: "#8B5CF6" },
  { sender: "Kiko Agri", text: "Gandang tanim! Anong variety yan kuya?", bg: "#06B6D4" },
];

export interface LiveBroadcasterModalProps {
  isVisible: boolean;
  onClose: () => void;
  onPublishReplay: (postData: {
    content: string;
    durationLabel: string;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    viewerCount?: number;
    durationSeconds?: number;
  }) => Promise<void>;
  initialLocation?: string | null;
  initialCoordinates?: { latitude: number; longitude: number } | null;
}

export default function LiveBroadcasterModal({
  isVisible,
  onClose,
  onPublishReplay,
  initialLocation,
  initialCoordinates,
}: LiveBroadcasterModalProps) {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  // Camera settings
  const [facing, setFacing] = useState<CameraType>("front");
  const [isMuted, setIsMuted] = useState(false);

  // Broadcast state
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [viewerCount, setViewerCount] = useState(6);
  const [peakViewers, setPeakViewers] = useState(6);
  const [reactionCount, setReactionCount] = useState(12);

  // Live chat state
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // End stream summary modal
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryTitle, setSummaryTitle] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  // Pulsing Live Badge animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isBroadcasting) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [isBroadcasting, pulseAnim]);

  // Handle stream timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isBroadcasting) {
      timer = setInterval(() => {
        setSecondsElapsed((prev) => {
          const next = prev + 1;
          // Random viewer fluctuations
          if (next % 4 === 0) {
            const change = Math.floor(Math.random() * 5) - 1;
            setViewerCount((curr) => {
              const updated = Math.max(3, curr + change);
              setPeakViewers((peak) => Math.max(peak, updated));
              return updated;
            });
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isBroadcasting]);

  // Automated simulated community comments and floating reactions
  useEffect(() => {
    let commentTimer: ReturnType<typeof setInterval> | null = null;
    let commentIndex = 0;

    if (isBroadcasting) {
      commentTimer = setInterval(() => {
        const template = SAMPLE_LOCAL_COMMENTS[commentIndex % SAMPLE_LOCAL_COMMENTS.length];
        commentIndex++;

        const newComment: LiveComment = {
          id: `${Date.now()}-${Math.random()}`,
          sender: template.sender,
          text: template.text,
          avatarBg: template.bg,
        };

        setComments((prev) => [...prev.slice(-15), newComment]);
        triggerReaction(["❤️", "🌿", "🥕", "👏"][Math.floor(Math.random() * 4)]);
      }, 4500);
    }

    return () => {
      if (commentTimer) clearInterval(commentTimer);
    };
  }, [isBroadcasting]);

  // Initialize broadcast on modal open
  useEffect(() => {
    if (isVisible) {
      setIsBroadcasting(true);
      setSecondsElapsed(0);
      setViewerCount(8);
      setPeakViewers(8);
      setReactionCount(14);
      setComments([
        {
          id: "sys-1",
          sender: "Local Farm System",
          text: "🌾 You are now broadcasting live to the local farm community!",
          avatarBg: "#72AF5B",
        },
      ]);
      setSummaryTitle(
        initialLocation
          ? `Live Farm Stream at ${initialLocation}`
          : "Live Farm Harvest & Produce Update",
      );
      setShowSummaryModal(false);
    } else {
      setIsBroadcasting(false);
      setShowSummaryModal(false);
    }
  }, [isVisible, initialLocation]);

  const triggerReaction = (emoji: string) => {
    setReactionCount((c) => c + 1);
    const anim = new Animated.Value(0);
    const xOffset = Math.floor(Math.random() * 60) - 30;
    const id = `${Date.now()}-${Math.random()}`;

    setFloatingReactions((prev) => [...prev, { id, emoji, animValue: anim, xOffset }]);

    Animated.timing(anim, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    });
  };

  const handleSendCustomMessage = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const newComment: LiveComment = {
      id: `${Date.now()}`,
      sender: user?.name || user?.username || "Broadcaster (You)",
      text: trimmed,
      avatarBg: "#72AF5B",
    };
    setComments((prev) => [...prev.slice(-15), newComment]);
    setChatInput("");
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleRequestEndStream = () => {
    Alert.alert(
      "End Live Broadcast?",
      "Are you sure you want to end this live stream?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Broadcast",
          style: "destructive",
          onPress: () => {
            setIsBroadcasting(false);
            setShowSummaryModal(true);
          },
        },
      ],
    );
  };

  const handlePublishReplay = async () => {
    setIsPublishing(true);
    try {
      const durationLabel = `${Math.max(1, Math.round(secondsElapsed / 60))} min stream`;
      const fullCaption = `🔴 [Live Replay] ${summaryTitle.trim() || "Live Farm Broadcast"}\n\nBroadcasted live with ${peakViewers} viewers and ${reactionCount} reactions. Watch the replay!`;

      await onPublishReplay({
        content: fullCaption,
        durationLabel,
        location: initialLocation,
        latitude: initialCoordinates?.latitude,
        longitude: initialCoordinates?.longitude,
        viewerCount: peakViewers,
        durationSeconds: secondsElapsed,
      });

      setShowSummaryModal(false);
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to publish replay.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscard = async () => {
    try {
      await recordLiveStreamApi({
        viewerCount: peakViewers,
        durationSeconds: secondsElapsed,
        status: "ended",
        postId: null,
      });
    } catch (e) {
      console.warn("Notice: could not record discarded stream session:", e);
    }
    setShowSummaryModal(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false}>
      <View className="flex-1 bg-black">
        {/* Real Camera View or Emulator Virtual Camera */}
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing={facing}
            mute={isMuted}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-gray-950 px-6">
            <View className="w-20 h-20 rounded-full bg-green-900/40 items-center justify-center mb-4 border border-green-500/30">
              <Ionicons name="videocam" size={40} color="#72AF5B" />
            </View>
            <Text className="text-white text-xl font-bold text-center mb-2">
              Camera Access Required
            </Text>
            <Text className="text-gray-400 text-sm text-center mb-6 leading-5">
              Enable your camera permissions to start casting your live farm stream.
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              className="bg-[#72AF5B] px-6 py-3 rounded-full active:opacity-85 shadow-md"
            >
              <Text className="text-white font-bold text-base">Grant Camera Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Top Header Controls Overlay */}
        <SafeAreaView className="absolute top-0 left-0 right-0 z-30 pt-2 px-4">
          <View className="flex-row items-center justify-between">
            {/* Live Indicator & Timer */}
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center bg-[#DC2626] px-2.5 py-1 rounded-full shadow-md">
                <Animated.View
                  style={{ opacity: pulseAnim }}
                  className="w-2 h-2 rounded-full bg-white mr-1.5"
                />
                <Text className="text-white font-extrabold text-xs tracking-wider">LIVE</Text>
              </View>

              <View className="bg-black/60 px-2.5 py-1 rounded-full border border-white/20">
                <Text className="text-white font-semibold text-xs">{formatTimer(secondsElapsed)}</Text>
              </View>

              {/* Viewers Counter */}
              <View className="flex-row items-center bg-black/60 px-2.5 py-1 rounded-full border border-white/20 gap-1">
                <Ionicons name="eye" size={13} color="#FFFFFF" />
                <Text className="text-white font-bold text-xs">{viewerCount}</Text>
              </View>
            </View>

            {/* Quick Action Controls */}
            <View className="flex-row items-center gap-2">
              {/* Flip Camera */}
              <TouchableOpacity
                onPress={() => setFacing((prev: any) => (prev === "back" ? "front" : "back"))}
                className="w-10 h-10 rounded-full bg-black/60 items-center justify-center border border-white/20 active:opacity-75"
                accessibilityLabel="Flip Camera"
              >
                <Ionicons name="camera-reverse" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Mute/Unmute Mic */}
              <TouchableOpacity
                onPress={() => setIsMuted((prev) => !prev)}
                className={`w-10 h-10 rounded-full items-center justify-center border border-white/20 active:opacity-75 ${
                  isMuted ? "bg-red-600/80" : "bg-black/60"
                }`}
                accessibilityLabel="Toggle Microphone"
              >
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={20} color="#FFFFFF" />
              </TouchableOpacity>

              {/* End Stream Button */}
              <TouchableOpacity
                onPress={handleRequestEndStream}
                className="bg-red-600 px-3.5 py-2 rounded-full active:bg-red-700 shadow-md"
                accessibilityLabel="End Live Stream"
              >
                <Text className="text-white font-bold text-xs">End</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Broadcaster Info Banner */}
          <View className="mt-2.5 bg-black/40 self-start px-3 py-1 rounded-full border border-white/10 flex-row items-center gap-1.5">
            <Ionicons name="shield-checkmark" size={13} color="#4ADE80" />
            <Text className="text-white text-xs font-medium">
              RSBSA Verified: {user?.name || "Farmer"}
            </Text>
            {initialLocation && (
              <Text className="text-gray-300 text-xs" numberOfLines={1}>
                • 📍 {initialLocation}
              </Text>
            )}
          </View>
        </SafeAreaView>

        {/* Floating Animated Reactions */}
        <View
          pointerEvents="none"
          className="absolute right-6 bottom-28 top-32 w-20 z-40 justify-end items-center"
        >
          {floatingReactions.map((reaction) => {
            const translateY = reaction.animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -260],
            });
            const opacity = reaction.animValue.interpolate({
              inputRange: [0, 0.2, 0.8, 1],
              outputRange: [0, 1, 1, 0],
            });
            const scale = reaction.animValue.interpolate({
              inputRange: [0, 0.2, 1],
              outputRange: [0.6, 1.3, 1],
            });

            return (
              <Animated.View
                key={reaction.id}
                style={{
                  position: "absolute",
                  transform: [{ translateY }, { translateX: reaction.xOffset }, { scale }],
                  opacity,
                }}
              >
                <Text className="text-3xl">{reaction.emoji}</Text>
              </Animated.View>
            );
          })}
        </View>

        {/* Bottom Live Comments & Interaction Overlay */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="absolute bottom-0 left-0 right-0 z-30 pb-4 px-4"
        >
          {/* Comments Stream */}
          <View className="max-h-48 mb-3">
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
            >
              {comments.map((c) => (
                <View
                  key={c.id}
                  className="bg-black/50 self-start max-w-[85%] rounded-2xl px-3 py-1.5 mb-1.5 border border-white/10 flex-row items-center gap-2"
                >
                  <View
                    style={{ backgroundColor: c.avatarBg }}
                    className="w-6 h-6 rounded-full items-center justify-center"
                  >
                    <Text className="text-white text-[10px] font-bold">
                      {c.sender.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white/80 text-[11px] font-bold">{c.sender}</Text>
                    <Text className="text-white text-xs leading-4">{c.text}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Chat Input & Emoji Quick Taps */}
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center bg-black/60 rounded-full px-3.5 py-1.5 border border-white/20">
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Say something to viewers..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-white text-sm py-1"
                returnKeyType="send"
                onSubmitEditing={handleSendCustomMessage}
              />
              {chatInput.trim() ? (
                <TouchableOpacity onPress={handleSendCustomMessage} className="p-1">
                  <Ionicons name="send" size={18} color="#72AF5B" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Quick Broadcaster Reactions */}
            <View className="flex-row items-center gap-1.5">
              {["❤️", "🌿", "🥕"].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => triggerReaction(emoji)}
                  className="w-10 h-10 rounded-full bg-black/60 items-center justify-center border border-white/20 active:scale-95"
                >
                  <Text className="text-lg">{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* End Stream Summary & Publish Modal */}
        {showSummaryModal && (
          <View className="absolute inset-0 z-50 bg-black/85 items-center justify-center px-5">
            <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100">
              {/* Finished Icon */}
              <View className="items-center mb-3">
                <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-2">
                  <Ionicons name="videocam-off" size={32} color="#DC2626" />
                </View>
                <Text className="text-xl font-bold text-gray-900">Broadcast Concluded</Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Great live session! Here is your stream summary.
                </Text>
              </View>

              {/* Statistics Card */}
              <View className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100 flex-row justify-around">
                <View className="items-center">
                  <Text className="text-xs text-gray-500 font-medium">Duration</Text>
                  <Text className="text-base font-bold text-gray-900 mt-0.5">
                    {formatTimer(secondsElapsed)}
                  </Text>
                </View>
                <View className="w-px h-8 bg-gray-200 self-center" />
                <View className="items-center">
                  <Text className="text-xs text-gray-500 font-medium">Peak Viewers</Text>
                  <Text className="text-base font-bold text-[#72AF5B] mt-0.5">
                    {peakViewers}
                  </Text>
                </View>
                <View className="w-px h-8 bg-gray-200 self-center" />
                <View className="items-center">
                  <Text className="text-xs text-gray-500 font-medium">Reactions</Text>
                  <Text className="text-base font-bold text-rose-500 mt-0.5">
                    {reactionCount}
                  </Text>
                </View>
              </View>

              {/* Title / Description Input */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-700 mb-1">
                  Replay Post Title
                </Text>
                <TextInput
                  value={summaryTitle}
                  onChangeText={setSummaryTitle}
                  placeholder="Give your live stream a title..."
                  placeholderTextColor="#9CA3AF"
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800"
                />
              </View>

              {/* Actions */}
              <TouchableOpacity
                onPress={handlePublishReplay}
                disabled={isPublishing}
                className="w-full bg-[#72AF5B] py-3.5 rounded-xl items-center justify-center shadow-sm mb-2.5 active:bg-[#5e944a]"
              >
                {isPublishing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-sm">
                    Share Replay to News Feed
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDiscard}
                disabled={isPublishing}
                className="w-full py-3 bg-gray-100 rounded-xl items-center justify-center active:bg-gray-200"
              >
                <Text className="text-gray-600 font-semibold text-sm">Discard Stream</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

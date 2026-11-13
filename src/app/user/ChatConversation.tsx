import { useAuth } from "@/hooks/use-auth";
import {
  acceptMessageRequestApi,
  archiveConversationApi,
  ChatFarmerInfo,
  ChatMessage,
  deleteConversationApi,
  getChatUserInfoApi,
  getMessagesApi,
  getSharedMediaApi,
  LocationPinData,
  restrictUserApi,
  sendMessageApi,
  sendTypingStatusApi,
  SharedLinkItem,
  SharedMediaItem,
  spamConversationApi,
  submitUserReportApi,
} from "@/services/chat-service";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LeafletMap from "../../components/LeafletMap";



const mergeMessages = (
  serverMsgs: ChatMessage[],
  currentMsgs: ChatMessage[],
): ChatMessage[] => {
  const combined = [...serverMsgs];
  currentMsgs.forEach((m) => {
    const mId = String(m.id || "");
    if (
      (mId.startsWith("msg-") ||
        mId.startsWith("temp-") ||
        mId.startsWith("auto-")) &&
      !combined.some((c) => String(c.id) === mId)
    ) {
      combined.push(m);
    }
  });
  return combined;
};

const SAVED_PLACES = [
  {
    id: "farm_gate",
    icon: "🚜",
    name: "Farm Gate",
    title: "Green Valley Farm - Main Gate",
    address: "National Highway, Brgy. Pala-o, Iligan City",
    lat: 8.228,
    lng: 124.2452,
  },
  {
    id: "market_stall",
    icon: "🏪",
    name: "Market Stall",
    title: "Iligan Wet & Dry Market - Stall 18",
    address: "Pala-o Public Market, Iligan City",
    lat: 8.2295,
    lng: 124.2415,
  },
  {
    id: "pickup_hub",
    icon: "📦",
    name: "Pickup Hub",
    title: "Central Agro Sorting & Pickup Hub",
    address: "Macapagal Ave, Tubod, Iligan City",
    lat: 8.2175,
    lng: 124.2389,
  },
  {
    id: "meetup_point",
    icon: "📍",
    name: "Meetup Point",
    title: "Rotonda Crossing Meetup Spot",
    address: "Tibanga Highway Rotonda, Iligan City",
    lat: 8.2392,
    lng: 124.2441,
  },
];

const openExternalMap = (lat: number, lng: number, label: string) => {
  const scheme = Platform.select({
    ios: `maps:0,0?q=${encodeURIComponent(label)}@${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(label)})`,
  });
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  if (scheme) {
    Linking.canOpenURL(scheme)
      .then((supported) => {
        if (supported) {
          Linking.openURL(scheme);
        } else {
          Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Linking.openURL(webUrl);
      });
  } else {
    Linking.openURL(webUrl);
  }
};

const generateUniqueId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

const REPORT_REASONS = [
  "Spam or scam messages",
  "Harassment or bullying",
  "Hate speech or discrimination",
  "Threats or violent content",
  "Sexual or explicit content",
  "Fake information or impersonation",
  "Sharing personal/private information",
  "Illegal activities",
  "Self-harm or dangerous behavior",
  "Offensive language",
  "Phishing or suspicious links",
  "Child exploitation or abuse",
  "Copyright infringement",
  "Other inappropriate behavior",
];

export default function ChatConversation() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    conversationId?: string;
    userId?: string;
    userName?: string;
    userAvatar?: string;
    name?: string;
    avatarUrl?: string;
    online?: string;
  }>();

  const otherUserName = params.name || (params as any).userName || "Farmer";
  const otherUserAvatar = params.avatarUrl || (params as any).userAvatar || "";
  const isOnline = params.online === "true";

  const effectiveUserId =
    params.userId ||
    (params as any).otherUserId ||
    (params as any).farmerId ||
    (params as any).recipientId ||
    undefined;

  const [conversationId, setConversationId] = useState<string | null>(
    params.conversationId || null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Location Pin States
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [locationTitle, setLocationTitle] = useState(SAVED_PLACES[0].title);
  const [locationAddress, setLocationAddress] = useState(
    SAVED_PLACES[0].address,
  );
  const [locationCoords, setLocationCoords] = useState({
    latitude: SAVED_PLACES[0].lat,
    longitude: SAVED_PLACES[0].lng,
  });
  // Swipe-to-dismiss gesture handling for Share Farm Location Pin modal
  const locationModalTranslateY = useRef(new Animated.Value(0)).current;
  const locationModalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          locationModalTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 70 || gestureState.vy > 0.5) {
          Animated.timing(locationModalTranslateY, {
            toValue: Dimensions.get("window").height,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            setIsLocationModalVisible(false);
            locationModalTranslateY.setValue(0);
          });
        } else {
          Animated.spring(locationModalTranslateY, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(locationModalTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const [previewMapLocation, setPreviewMapLocation] =
    useState<LocationPinData | null>(null);

  const [isFarmerTyping, setIsFarmerTyping] = useState(false);
  const [fullPreviewImage, setFullPreviewImage] = useState<string | null>(null);

  // Farmer Info & Conversation Details Modal States
  const SCREEN_WIDTH = Dimensions.get("window").width;
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [isInfoModalMounted, setIsInfoModalMounted] = useState(false);
  const infoSlideX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [farmerInfo, setFarmerInfo] = useState<ChatFarmerInfo | null>(null);
  const [sharedMedia, setSharedMedia] = useState<SharedMediaItem[]>([]);
  const [sharedLinks, setSharedLinks] = useState<SharedLinkItem[]>([]);
  const [activeMediaTab, setActiveMediaTab] = useState<"media" | "links">("media");
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [customNickname, setCustomNickname] = useState("");
  const [tempNickname, setTempNickname] = useState("");
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
  const [isFilesViewerOpen, setIsFilesViewerOpen] = useState(false);
  const [isSearchInChatOpen, setIsSearchInChatOpen] = useState(false);
  const [chatSearchText, setChatSearchText] = useState("");
  const [isRestricted, setIsRestricted] = useState(false);
  const [isMessageRequest, setIsMessageRequest] = useState(
    (params as any).isRequest === "true"
  );

  // Report User States
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState("");
  const [reportStatement, setReportStatement] = useState("");
  const [reportAttachmentUri, setReportAttachmentUri] = useState<string | null>(null);
  const [reportAttachmentName, setReportAttachmentName] = useState("");
  const [hasAgreedToGuidelines, setHasAgreedToGuidelines] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isReportSuccess, setIsReportSuccess] = useState(false);

  // Voice Call States
  const [isVoiceCallModalVisible, setIsVoiceCallModalVisible] = useState(false);
  const [voiceCallStatus, setVoiceCallStatus] = useState<"connecting" | "ringing" | "connected">("connecting");
  const [callSeconds, setCallSeconds] = useState(0);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Video Call States
  const [isVideoCallModalVisible, setIsVideoCallModalVisible] = useState(false);
  const [videoCallStatus, setVideoCallStatus] = useState<"calling" | "connected">("calling");
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<CameraType>("front");
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isVideoCameraOff, setIsVideoCameraOff] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Voice Note Recording States
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<any>(null);

  const getReceiverId = () =>
    effectiveUserId ||
    farmerInfo?.id ||
    messages.find((m) => m.sender === "other")?.senderId ||
    undefined;

  const fetchMessages = async () => {
    try {
      const data = await getMessagesApi({
        conversationId: conversationId || undefined,
        userId: effectiveUserId,
      });
      setMessages((prev) => mergeMessages(data.messages, prev));
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
      if (typeof data.isTyping === "boolean") {
        setIsFarmerTyping(data.isTyping);
      }
    } catch (err) {
      console.log("Failed to fetch messages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getMessagesApi({
      conversationId: conversationId || undefined,
      userId: effectiveUserId,
    })
      .then((data) => {
        if (isMounted) {
          setMessages((prev) => mergeMessages(data.messages, prev));
          if (data.conversationId) setConversationId(data.conversationId);
          if (typeof data.isTyping === "boolean") {
            setIsFarmerTyping(data.isTyping);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.log("Failed to fetch messages:", err);
          setMessages((prev) => mergeMessages([], prev));
          setIsLoading(false);
        }
      });

    // Polling interval for live incoming messages & typing every 3 seconds
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendTypingStatusApi({
        conversationId: conversationId || undefined,
        receiverId: effectiveUserId,
        isTyping: false,
      });
    };
  }, [params.conversationId, effectiveUserId]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages.length]);

  // Fetch farmer info for modal and profile
  useEffect(() => {
    if (effectiveUserId) {
      getChatUserInfoApi(effectiveUserId).then((info) => {
        if (info) {
          setFarmerInfo(info);
        }
      });
    }
  }, [effectiveUserId]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (showAttachmentMenu) setShowAttachmentMenu(false);

    const targetReceiverId = getReceiverId();
    if (!text.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendTypingStatusApi({
        conversationId: conversationId || undefined,
        receiverId: targetReceiverId,
        isTyping: false,
      });
      return;
    }

    sendTypingStatusApi({
      conversationId: conversationId || undefined,
      receiverId: targetReceiverId,
      isTyping: true,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatusApi({
        conversationId: conversationId || undefined,
        receiverId: targetReceiverId,
        isTyping: false,
      });
    }, 3000);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setInputText("");
    setIsSending(true);

    const targetReceiverId = getReceiverId();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStatusApi({
      conversationId: conversationId || undefined,
      receiverId: targetReceiverId,
      isTyping: false,
    });

    // Optimistic message preview
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender: "user",
      senderId: user?.id ? String(user.id) : undefined,
      receiverId: targetReceiverId,
      type: "text",
      text,
      time: "Just now",
      isDelivered: false,
      isSeen: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await sendMessageApi({
        receiverId: targetReceiverId,
        conversationId: conversationId || undefined,
        messageText: text,
      });

      if (res.data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.data : m)),
        );
        if (isMessageRequest) {
          setIsMessageRequest(false);
          const cid = conversationId || res.data.conversationId;
          if (cid) {
            acceptMessageRequestApi(cid).catch(() => {});
          }
        }
        if (res.data.id && !conversationId) {
          fetchMessages();
        }
      }
    } catch (err) {
      console.warn("Send message error:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Timer for Voice Call
  useEffect(() => {
    let timer: any = null;
    if (isVoiceCallModalVisible && voiceCallStatus === "connected") {
      timer = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isVoiceCallModalVisible, voiceCallStatus]);

  // Timer for Video Call
  useEffect(() => {
    let timer: any = null;
    if (isVideoCallModalVisible && videoCallStatus === "connected") {
      timer = setInterval(() => {
        setVideoSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isVideoCallModalVisible, videoCallStatus]);

  // Timer for Voice Memo Recording
  useEffect(() => {
    let timer: any = null;
    if (isRecordingVoice) {
      timer = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecordingVoice]);

  const handleOpenInfoModal = async () => {
    setIsInfoModalMounted(true);
    setIsInfoModalVisible(true);
    infoSlideX.setValue(SCREEN_WIDTH);
    Animated.timing(infoSlideX, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const targetId = effectiveUserId || getReceiverId();
    if (targetId) {
      setIsLoadingInfo(true);
      try {
        const infoPromise = farmerInfo ? Promise.resolve(farmerInfo) : getChatUserInfoApi(targetId);
        const mediaPromise = getSharedMediaApi({
          conversationId: conversationId || undefined,
          userId: targetId,
        });
        const [info, mediaRes] = await Promise.all([infoPromise, mediaPromise]);
        if (info) setFarmerInfo(info);
        if (mediaRes) {
          setSharedMedia(mediaRes.media || []);
          setSharedLinks(mediaRes.links || []);
        }
      } catch (e) {
        console.warn("Failed to load farmer info:", e);
      } finally {
        setIsLoadingInfo(false);
      }
    }
  };

  const handleCloseInfoModal = () => {
    Animated.timing(infoSlideX, {
      toValue: SCREEN_WIDTH,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsInfoModalMounted(false);
      setIsInfoModalVisible(false);
    });
  };

  useEffect(() => {
    if (!isInfoModalMounted) return;
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleCloseInfoModal();
      return true;
    });
    return () => backHandler.remove();
  }, [isInfoModalMounted]);

  const allMedia = [
    ...sharedMedia,
    ...messages
      .filter(
        (m) =>
          (m.type === "image" || m.imageUrl) &&
          !sharedMedia.some((sm) => sm.imageUrl === m.imageUrl),
      )
      .map((m) => ({
        id: String(m.id),
        imageUrl: m.imageUrl || "",
        createdAt: m.time || "Recent",
      })),
  ].filter((m) => Boolean(m.imageUrl));

  const allLinks: SharedLinkItem[] = [...sharedLinks];
  messages.forEach((m) => {
    if (m.type === "location" && m.location) {
      const locUrl = `https://www.google.com/maps/search/?api=1&query=${m.location.latitude},${m.location.longitude}`;
      if (!allLinks.some((l) => l.url === locUrl)) {
        allLinks.push({
          id: `loc-${m.id}`,
          url: locUrl,
          title: `📍 ${m.location.title || "Location Pin"}${m.location.address ? ` - ${m.location.address}` : ""}`,
          createdAt: m.time || "Recent",
        });
      }
    } else if (m.text) {
      const urlMatches = m.text.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);
      if (urlMatches) {
        urlMatches.forEach((u, i) => {
          const formatted = u.startsWith("http") ? u : `https://${u}`;
          if (!allLinks.some((l) => l.url === formatted)) {
            allLinks.push({
              id: `link-${m.id}-${i}`,
              url: formatted,
              title: u.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
              createdAt: m.time || "Recent",
            });
          }
        });
      }
    }
  });

  const executeDeleteChat = async () => {
    try {
      setIsDeletingChat(true);
      await deleteConversationApi({
        conversationId: conversationId || undefined,
        userId: effectiveUserId || params.userId,
      });
      setMessages([]);
      setIsInfoModalMounted(false);
      setIsInfoModalVisible(false);
      router.replace("/user/Chats" as any);
    } catch (err: any) {
      setIsDeletingChat(false);
      const errMsg = err?.message || "Failed to delete chat.";
      if (Platform.OS === "web") {
        window.alert(errMsg);
      } else {
        Alert.alert("Error", errMsg);
      }
    }
  };

  const handleDeleteChat = () => {
    const confirmMsg = `Are you sure you want to delete this conversation with ${otherUserName}? All messages will be permanently removed.`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(confirmMsg)) {
        executeDeleteChat();
      }
    } else {
      Alert.alert(
        "Delete Chat",
        confirmMsg,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: executeDeleteChat,
          },
        ]
      );
    }
  };

  const firstName = (otherUserName || "User").trim().split(" ")[0];

  const handleVisitProfile = () => {
    handleCloseInfoModal();
    const uid = effectiveUserId || (farmerInfo as any)?.id || params.userId || getReceiverId();
    if (uid || otherUserName) {
      router.push({
        pathname: "/user/UserProfile",
        params: {
          userId: uid ? String(uid) : undefined,
          userName: otherUserName,
          userAvatar: otherUserAvatar || "",
        },
      } as any);
    } else {
      Alert.alert("Profile", "User profile not available.");
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      const msg = next
        ? `Notifications muted for ${otherUserName}.`
        : `Notifications unmuted for ${otherUserName}.`;
      if (Platform.OS === "web") {
        window.alert(msg);
      } else {
        Alert.alert("Notifications", msg);
      }
      return next;
    });
  };

  const handleCreateGroup = () => {
    handleCloseInfoModal();
    router.push("/user/People" as any);
  };

  const handleSearchMessages = () => {
    handleCloseInfoModal();
    setIsSearchInChatOpen(true);
  };

  const handleReportUser = () => {
    setSelectedReportReason("");
    setReportStatement("");
    setReportAttachmentUri(null);
    setReportAttachmentName("");
    setHasAgreedToGuidelines(false);
    setIsReportSuccess(false);
    setIsReportModalVisible(true);
  };

  const handlePickReportAttachment = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setReportAttachmentUri(asset.uri);
        const name = asset.fileName || asset.uri.split("/").pop() || "evidence.jpg";
        setReportAttachmentName(name);
      }
    } catch (err) {
      console.warn("Attachment pick error:", err);
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedReportReason) {
      if (Platform.OS === "web") {
        window.alert("Please choose a reason for your report.");
      } else {
        Alert.alert("Reason Required", "Please choose a reason for your report.");
      }
      return;
    }

    if (!reportStatement.trim()) {
      if (Platform.OS === "web") {
        window.alert("Please state the scenario for your report.");
      } else {
        Alert.alert("Statement Required", "Please state the scenario for your report.");
      }
      return;
    }

    if (!hasAgreedToGuidelines) {
      if (Platform.OS === "web") {
        window.alert("Please confirm that you have read and understood our Community Guidelines.");
      } else {
        Alert.alert(
          "Community Guidelines",
          "Please confirm that you have read and understood our Community Guidelines before submitting."
        );
      }
      return;
    }

    try {
      setIsSubmittingReport(true);
      const targetUserId = effectiveUserId || (farmerInfo as any)?.id || params.userId;
      await submitUserReportApi({
        reportedUserId: targetUserId ? String(targetUserId) : undefined,
        conversationId: conversationId ? String(conversationId) : undefined,
        reason: selectedReportReason,
        statement: reportStatement.trim(),
        attachmentUrl: reportAttachmentUri || undefined,
      });

      setIsReportSuccess(true);
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to submit report. Please try again.";
      if (Platform.OS === "web") {
        window.alert(errorMsg);
      } else {
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleOpenCommunityGuidelines = () => {
    const msg =
      "Local Farm Community Guidelines:\n\n1. Respectful Communication: Harassment, bullying, and hate speech are strictly prohibited.\n2. Genuine Transactions: Scamming, fraudulent claims, or price gouging are not allowed.\n3. Safe Marketplace: No illegal goods, abusive media, or copyright violations.\n4. Violations: Reported violations result in account warning, restriction, or permanent suspension.";
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert("Community Guidelines", msg);
    }
  };

  const handleRestrictUser = () => {
    const restrictMsg = isRestricted
      ? `Unrestrict ${otherUserName}? They will see when you're online and read messages.`
      : `Restrict ${otherUserName}? They won't see when you're online or read messages.`;

    const toggleRestrict = async () => {
      const targetId = effectiveUserId || getReceiverId();
      const nextRestricted = !isRestricted;
      setIsRestricted(nextRestricted);
      if (targetId) {
        await restrictUserApi(String(targetId), nextRestricted).catch(() => {});
      }
      const doneMsg = `${otherUserName} has been ${nextRestricted ? "restricted" : "unrestricted"}.`;
      if (Platform.OS === "web") {
        window.alert(doneMsg);
      } else {
        Alert.alert("Updated", doneMsg);
      }
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(restrictMsg)) {
        toggleRestrict();
      }
    } else {
      Alert.alert(isRestricted ? "Unrestrict" : "Restrict", restrictMsg, [
        { text: "Cancel", style: "cancel" },
        {
          text: isRestricted ? "Unrestrict" : "Restrict",
          style: "destructive",
          onPress: toggleRestrict,
        },
      ]);
    }
  };

  const handleAcceptRequest = async () => {
    try {
      if (conversationId) {
        await acceptMessageRequestApi(conversationId);
      }
      setIsMessageRequest(false);
      if (Platform.OS === "web") {
        window.alert("Message request accepted.");
      } else {
        Alert.alert("Accepted", "You can now message back and forth freely.");
      }
    } catch (e) {
      console.warn("Accept request error:", e);
    }
  };

  const handleDeleteRequest = () => {
    handleDeleteChat();
  };

  const handleSpamRequest = async () => {
    try {
      if (conversationId) {
        await spamConversationApi(conversationId, true);
      }
      if (Platform.OS === "web") {
        window.alert("Conversation moved to Spam.");
      } else {
        Alert.alert("Spam", "Conversation moved to Spam folder.");
      }
      router.back();
    } catch (e) {
      console.warn("Spam request error:", e);
    }
  };

  const handleBlockUser = () => {
    const blockMsg = `Are you sure you want to block ${otherUserName}? You will not receive any more messages from this contact.`;
    const executeBlock = () => {
      handleCloseInfoModal();
      router.back();
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(blockMsg)) {
        executeBlock();
      }
    } else {
      Alert.alert("Block User", blockMsg, [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: executeBlock },
      ]);
    }
  };

  const handleStartVoiceCall = () => {
    setIsVoiceCallModalVisible(true);
    setVoiceCallStatus("connecting");
    setCallSeconds(0);
    setIsCallMuted(false);
    setIsSpeakerOn(false);

    setTimeout(() => {
      setVoiceCallStatus("ringing");
      setTimeout(() => {
        setVoiceCallStatus("connected");
      }, 2400);
    }, 1200);
  };

  const handleEndVoiceCall = () => {
    setIsVoiceCallModalVisible(false);
    setVoiceCallStatus("connecting");
    setCallSeconds(0);
  };

  const handleStartVideoCall = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert("Camera Permission Required", "Please allow camera access to start video calls with farmers.");
        return;
      }
    }

    setIsVideoCallModalVisible(true);
    setVideoCallStatus("calling");
    setVideoSeconds(0);
    setIsVideoMuted(false);
    setIsVideoCameraOff(false);

    setTimeout(() => {
      setVideoCallStatus("connected");
    }, 2200);
  };

  const handleEndVideoCall = () => {
    setIsVideoCallModalVisible(false);
    setVideoCallStatus("calling");
    setVideoSeconds(0);
  };

  const handleStartVoiceRecording = () => {
    setShowAttachmentMenu(false);
    setIsRecordingVoice(true);
    setRecordingSeconds(0);
  };

  const handleCancelVoiceRecording = () => {
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  const handleSendVoiceRecording = async () => {
    const duration = recordingSeconds || 3;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const timeFormatted = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    const voiceText = `🎤 Voice Message (${timeFormatted})`;

    setIsRecordingVoice(false);
    setRecordingSeconds(0);

    const tempId = `temp-audio-${Date.now()}`;
    const targetReceiverId = getReceiverId();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender: "user",
      senderId: user?.id ? String(user.id) : undefined,
      receiverId: targetReceiverId,
      type: "audio" as any,
      text: voiceText,
      time: "Just now",
      isDelivered: false,
      isSeen: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const res = await sendMessageApi({
        receiverId: targetReceiverId,
        conversationId: conversationId || undefined,
        messageText: voiceText,
        messageType: "audio",
      });
      if (res.data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.data : m)),
        );
        if (res.data.conversationId && !conversationId) {
          setConversationId(res.data.conversationId);
        }
      }
    } catch (err) {
      console.warn("Failed to send voice note:", err);
    }
  };

  const handleSendFlowerReaction = async () => {
    if (isSending) return;
    setIsSending(true);

    const tempId = `temp-sticker-${Date.now()}`;
    const targetReceiverId = getReceiverId();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender: "user",
      senderId: user?.id ? String(user.id) : undefined,
      receiverId: targetReceiverId,
      type: "sticker" as any,
      text: "🌸",
      time: "Just now",
      isDelivered: false,
      isSeen: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const res = await sendMessageApi({
        receiverId: targetReceiverId,
        conversationId: conversationId || undefined,
        messageText: "🌸",
        messageType: "sticker",
      });
      if (res.data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.data : m)),
        );
        if (res.data.conversationId && !conversationId) {
          setConversationId(res.data.conversationId);
        }
      }
    } catch (err) {
      console.warn("Failed to send flower sticker:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendLocation = async (locData: LocationPinData) => {
    setIsLocationModalVisible(false);
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const targetReceiverId = getReceiverId();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender: "user",
      senderId: user?.id ? String(user.id) : undefined,
      receiverId: targetReceiverId,
      type: "location",
      text: JSON.stringify(locData),
      location: locData,
      time: "Just now",
      isDelivered: false,
      isSeen: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await sendMessageApi({
        receiverId: targetReceiverId,
        conversationId: conversationId || undefined,
        messageText: JSON.stringify(locData),
        messageType: "location",
      });

      if (res.data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...res.data, location: locData } : m,
          ),
        );
        if (res.data.id && !conversationId) {
          fetchMessages();
        }
      }
    } catch (err) {
      console.warn("Send location error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendImage = async (imageUri: string) => {
    setIsSending(true);
    const tempId = `temp-${Date.now()}`;
    const targetReceiverId = getReceiverId();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender: "user",
      senderId: user?.id ? String(user.id) : undefined,
      receiverId: targetReceiverId,
      type: "image",
      imageUrl: imageUri,
      text: "[Photo]",
      time: "Just now",
      isDelivered: false,
      isSeen: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 60);

    try {
      const res = await sendMessageApi({
        receiverId: targetReceiverId,
        conversationId: conversationId || undefined,
        messageText: "[Photo]",
        messageType: "image",
        imageUrl: imageUri,
      });

      if (res.data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...res.data, imageUrl: imageUri } : m,
          ),
        );
        if (res.data.id && !conversationId) {
          fetchMessages();
        }
      }
    } catch (err) {
      console.warn("Send image error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handlePickFromGallery = async () => {
    setShowAttachmentMenu(false);
    try {
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow photo library access to share photos in chat.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        handleSendImage(uri);
      }
    } catch (error) {
      console.error("Gallery picker error:", error);
    }
  };

  const handlePickFromCamera = async () => {
    setShowAttachmentMenu(false);
    try {
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow camera access to take and send photos in chat.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        handleSendImage(uri);
      }
    } catch (error) {
      console.error("Camera picker error:", error);
    }
  };

  const handleBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/user/Chats" as any);
      }
    } catch {
      router.push("/user/Chats" as any);
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white relative"
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        style={{ flex: 1 }}
      >
        {/* Top Header */}
        <View className="flex-row items-center justify-between px-3 py-3 bg-white border-b border-gray-100 shadow-2xs z-10">
          {/* Left Section: Back, Avatar, Name & Status */}
          <View className="flex-row items-center flex-1 pr-1">
            <TouchableOpacity
              onPress={handleBack}
              className="p-1 -ml-1 mr-2 active:opacity-70 flex-row items-center"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={28} color="#000000" />
            </TouchableOpacity>

            {/* Profile Avatar */}
            <View className="w-11 h-11 rounded-full bg-gray-200 items-center justify-center overflow-hidden border border-gray-200 shadow-2xs">
              {otherUserAvatar ? (
                <Image
                  source={{ uri: otherUserAvatar }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="person" size={24} color="#34594A" />
              )}
            </View>

            {/* Name and Active Status */}
            <View className="flex-1 ml-3 justify-center">
              <Text
                className="font-bold text-base text-gray-900 leading-tight"
                numberOfLines={1}
              >
                {customNickname || otherUserName}
              </Text>
              <View className="flex-row items-center mt-0.5">
                {isOnline && (
                  <View className="w-2 h-2 rounded-full bg-[#34594A] mr-1.5" />
                )}
                <Text className="text-xs text-gray-500">
                  {isOnline ? "Active Now" : "Local Farmer"}
                </Text>
              </View>
            </View>
          </View>

          {/* Right Section: Call, Video, Info Icons */}
          <View className="flex-row items-center gap-3.5">
            <TouchableOpacity
              onPress={handleStartVoiceCall}
              className="p-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Voice Call"
            >
              <Ionicons name="call" size={22} color="#34594A" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleStartVideoCall}
              className="p-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Video Call"
            >
              <Ionicons name="videocam" size={24} color="#34594A" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleOpenInfoModal}
              className="p-1 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <Ionicons
                name="information-circle-outline"
                size={24}
                color="#34594A"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* In-Chat Message Search Bar */}
        {isSearchInChatOpen && (
          <View className="flex-row items-center px-4 py-2 bg-gray-50 border-b border-gray-200">
            <Ionicons name="search" size={18} color="#34594A" style={{ marginRight: 6 }} />
            <TextInput
              value={chatSearchText}
              onChangeText={setChatSearchText}
              placeholder="Search in conversation..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-sm text-gray-800 py-1 font-medium"
              autoFocus
            />
            {chatSearchText ? (
              <TouchableOpacity onPress={() => setChatSearchText("")} className="p-1 mr-1">
                <Ionicons name="close-circle" size={16} color="#34594A" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                setIsSearchInChatOpen(false);
                setChatSearchText("");
              }}
              className="p-1 ml-1"
            >
              <Text className="text-xs font-semibold text-[#34594A]">Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Messages List */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4 bg-white"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: messages.length === 0 ? "center" : "flex-end",
            paddingTop: 16,
            paddingBottom: 16,
          }}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() =>
            scrollViewRef.current?.scrollToEnd({ animated: false })
          }
        >
          {isLoading ? (
            <View className="py-16 items-center justify-center">
              <ActivityIndicator size="large" color="#34594A" />
              <Text className="text-xs text-gray-400 mt-2 font-medium">
                Loading messages...
              </Text>
            </View>
          ) : messages.length === 0 ? (
            <View className="py-20 items-center justify-center px-6">
              <View className="w-16 h-16 rounded-full bg-[#EDF3EE] items-center justify-center mb-3">
                <Ionicons
                  name="chatbubble-ellipses"
                  size={32}
                  color="#34594A"
                />
              </View>
              <Text className="text-base font-bold text-gray-800 mb-1">
                Say hello to {otherUserName}!
              </Text>
              <Text className="text-xs text-gray-400 text-center">
                Start your conversation about crops, seeds, or local farming.
              </Text>
            </View>
          ) : null}

          {!isLoading &&
            (chatSearchText.trim()
              ? messages.filter((m) =>
                  (m.text || "")
                    .toLowerCase()
                    .includes(chatSearchText.toLowerCase()),
                )
              : messages
            ).map((item, index) => {
              // Exact match: if sender is user or senderId equals logged in user's ID
              const isUser =
                item.sender === "user" ||
                (Boolean(user?.id) &&
                  (String(item.senderId) === String(user?.id) ||
                    Number(item.senderId) === Number(user?.id)));

              // Parse location pin data if present
              let locationData: LocationPinData | null = item.location || null;
              if (
                !locationData &&
                (item.type === "location" ||
                  (item.text &&
                    (item.text.trim().startsWith('{"type":"location"') ||
                      (item.text.includes('"latitude"') &&
                        item.text.includes('"longitude"')))))
              ) {
                try {
                  locationData = JSON.parse(item.text!);
                } catch {}
              }

              return (
                <View key={item.id || index} className="mb-3">
                  {/* Message Row */}
                  <View
                    className={`flex-row items-end ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Other User Avatar */}
                    {!isUser && (
                      <View className="mr-2 mb-0.5">
                        <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center overflow-hidden border border-gray-200">
                          {otherUserAvatar ? (
                            <Image
                              source={{ uri: otherUserAvatar }}
                              className="w-full h-full"
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons name="person" size={16} color="#34594A" />
                          )}
                        </View>
                      </View>
                    )}

                    {/* Message Content: Auto-Reply, Location Pin, Image, or Text Bubble */}
                    {(item.id && String(item.id).startsWith("auto-")) ||
                    item.type === "auto_reply" ||
                    (!isUser &&
                      Boolean(item.text) &&
                      (item.text!.includes("Salamat sa mensahe!") ||
                        item.text!.includes("Opo, available pa po!") ||
                        item.text!.includes("May wholesale discount") ||
                        item.text!.includes("Ang susunod na ani") ||
                        item.text!.includes("Sa Green Valley Farm Main Gate") ||
                        item.text!.includes("Puwede po kami mag-deliver") ||
                        item.text!.includes("Kaka-ani lang po"))) ? (
                      /* Auto-Reply Visual Card */
                      <View className="w-72 rounded-2xl overflow-hidden bg-white border border-[#34594A]/40 shadow-xs">
                        {/* Auto-Reply Card Header */}
                        <View className="px-3 py-1.5 bg-[#34594A]/10 border-b border-[#34594A]/20 flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5">
                            <View className="w-4 h-4 rounded-full bg-[#34594A] items-center justify-center">
                              <Ionicons name="flash" size={9} color="#FFFFFF" />
                            </View>
                            <Text className="text-[10px] font-bold text-[#2E5E20] uppercase tracking-wider">
                              Instant Auto-Reply
                            </Text>
                          </View>
                          <View className="px-2 py-0.5 rounded-full bg-[#34594A]/20 border border-[#34594A]/30">
                            <Text className="text-[8px] font-bold text-[#2E5E20] tracking-wide">
                              FARM BOT
                            </Text>
                          </View>
                        </View>

                        {/* Content */}
                        <View className="p-3 bg-white">
                          <Text className="text-sm text-gray-800 leading-snug font-medium mb-2">
                            {item.text}
                          </Text>

                          {/* Interactive Farm Location Action Buttons */}
                          {locationData ? (
                            <View className="pt-2 border-t border-[#34594A]/20 flex-row gap-2">
                              <TouchableOpacity
                                onPress={() =>
                                  setPreviewMapLocation(locationData)
                                }
                                className="flex-1 py-1.5 bg-[#34594A]/10 rounded-lg items-center justify-center flex-row gap-1 border border-[#34594A]/30 active:bg-[#34594A]/20"
                              >
                                <Ionicons
                                  name="map-outline"
                                  size={12}
                                  color="#34594A"
                                />
                                <Text className="text-[11px] font-semibold text-[#2E5E20]">
                                  View Map
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() =>
                                  openExternalMap(
                                    locationData.latitude,
                                    locationData.longitude,
                                    locationData.title,
                                  )
                                }
                                className="flex-1 py-1.5 bg-[#34594A] rounded-lg items-center justify-center flex-row gap-1 active:opacity-80"
                              >
                                <Ionicons
                                  name="navigate-outline"
                                  size={12}
                                  color="#FFFFFF"
                                />
                                <Text className="text-[11px] font-bold text-white">
                                  Directions
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    ) : locationData ? (
                      /* Location Pin Card */
                      <View
                        className={`w-64 rounded-2xl overflow-hidden shadow-xs border ${
                          isUser
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        {/* Map Header Preview Graphic */}
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => setPreviewMapLocation(locationData)}
                          className="h-24 w-full bg-emerald-100/70 relative items-center justify-center overflow-hidden"
                        >
                          {/* Map Grid Texture */}
                          <View className="absolute inset-0 bg-[#E8F5E9] items-center justify-center">
                            <View className="absolute w-full h-[1.5px] bg-emerald-300/60 top-6" />
                            <View className="absolute w-full h-[2px] bg-emerald-400/60 top-12" />
                            <View className="absolute h-full w-[2px] bg-emerald-400/60 left-16" />
                            <View className="absolute h-full w-[1.5px] bg-emerald-300/60 right-14" />
                            <View className="w-12 h-12 rounded-full bg-emerald-200/40 border border-emerald-300/50" />
                          </View>

                          {/* Center Pin Icon */}
                          <View className="items-center justify-center z-10">
                            <View className="w-9 h-9 rounded-full bg-red-500/20 items-center justify-center">
                              <Ionicons
                                name="location"
                                size={24}
                                color="#EF4444"
                              />
                            </View>
                          </View>

                          {/* Top-Right Badge */}
                          <View className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded-full flex-row items-center">
                            <Ionicons
                              name="navigate"
                              size={9}
                              color="#FFFFFF"
                            />
                            <Text className="text-[9px] font-bold text-white ml-1">
                              FARM PIN
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Location Details */}
                        <View className="p-3 bg-white">
                          <View className="flex-row items-center gap-1.5 mb-1">
                            <Ionicons
                              name="location-sharp"
                              size={14}
                              color="#15803D"
                            />
                            <Text
                              className="text-sm font-bold text-gray-900 flex-1"
                              numberOfLines={1}
                            >
                              {locationData.title}
                            </Text>
                          </View>

                          {locationData.address ? (
                            <Text
                              className="text-xs text-gray-500 leading-4 mb-1.5"
                              numberOfLines={2}
                            >
                              {locationData.address}
                            </Text>
                          ) : null}

                          <Text className="text-[10px] font-mono text-gray-400 mb-2.5">
                            {locationData.latitude.toFixed(4)}° N,{" "}
                            {locationData.longitude.toFixed(4)}° E
                          </Text>

                          {/* Action Buttons */}
                          <View className="flex-row gap-2 pt-2 border-t border-gray-100">
                            <TouchableOpacity
                              onPress={() =>
                                setPreviewMapLocation(locationData)
                              }
                              className="flex-1 py-1.5 bg-gray-100 rounded-lg items-center justify-center flex-row gap-1 active:bg-gray-200"
                            >
                              <Ionicons
                                name="map-outline"
                                size={12}
                                color="#34594A"
                              />
                              <Text className="text-[11px] font-semibold text-gray-700">
                                View Map
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() =>
                                openExternalMap(
                                  locationData!.latitude,
                                  locationData!.longitude,
                                  locationData!.title,
                                )
                              }
                              className="flex-1 py-1.5 bg-[#34594A] rounded-lg items-center justify-center flex-row gap-1 active:opacity-80"
                            >
                              <Ionicons
                                name="navigate-outline"
                                size={12}
                                color="#FFFFFF"
                              />
                              <Text className="text-[11px] font-bold text-white">
                                Directions
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ) : item.type === "image" && item.imageUrl ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setFullPreviewImage(item.imageUrl || null)}
                        className="w-56 h-44 rounded-2xl bg-gray-100 mb-1 items-center justify-center overflow-hidden border border-gray-200 shadow-2xs"
                      >
                        <Image
                          source={{ uri: item.imageUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : item.type === "sticker" || item.text === "🌸" ? (
                      <View className="p-1 items-center justify-center">
                        <Text className="text-5xl">🌸</Text>
                      </View>
                    ) : item.type === "audio" || (item.text && item.text.startsWith("🎤 Voice Message")) ? (
                      <View
                        className={`px-4 py-3 rounded-2xl flex-row items-center gap-3 max-w-[82%] shadow-2xs ${
                          isUser
                            ? "bg-[#34594A] rounded-br-xs"
                            : "bg-[#F3F4F6] rounded-bl-xs border border-gray-200"
                        }`}
                      >
                        <View
                          className={`w-9 h-9 rounded-full items-center justify-center ${
                            isUser ? "bg-white/25" : "bg-[#34594A]"
                          }`}
                        >
                          <Ionicons
                            name="play"
                            size={18}
                            color="#FFFFFF"
                          />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-1 mb-1">
                            <View className={`w-1 h-3 rounded-full ${isUser ? "bg-white" : "bg-[#34594A]"}`} />
                            <View className={`w-1 h-5 rounded-full ${isUser ? "bg-white/80" : "bg-[#34594A]/80"}`} />
                            <View className={`w-1 h-2 rounded-full ${isUser ? "bg-white/60" : "bg-[#34594A]/60"}`} />
                            <View className={`w-1 h-6 rounded-full ${isUser ? "bg-white" : "bg-[#34594A]"}`} />
                            <View className={`w-1 h-4 rounded-full ${isUser ? "bg-white/80" : "bg-[#34594A]/80"}`} />
                            <View className={`w-1 h-3 rounded-full ${isUser ? "bg-white/60" : "bg-[#34594A]/60"}`} />
                            <View className={`w-1 h-5 rounded-full ${isUser ? "bg-white" : "bg-[#34594A]"}`} />
                            <View className={`w-1 h-2 rounded-full ${isUser ? "bg-white/60" : "bg-[#34594A]/60"}`} />
                          </View>
                          <Text
                            className={`text-[11px] font-bold ${
                              isUser ? "text-white" : "text-gray-800"
                            }`}
                          >
                            {item.text || "Voice Note"}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View
                        className={`px-4 py-2.5 max-w-[76%] ${
                          isUser
                            ? "bg-[#34594A] rounded-2xl rounded-br-xs"
                            : "bg-[#F0F0F0] rounded-2xl rounded-bl-xs"
                        }`}
                      >
                        <Text
                          className={`text-sm leading-snug ${
                            isUser ? "text-white font-medium" : "text-gray-900"
                          }`}
                        >
                          {item.text}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Seen & Timestamp indicator */}
                  <View
                    className={`flex-row items-center mt-1 px-1 ${
                      isUser ? "justify-end" : "justify-start ml-10"
                    }`}
                  >
                    <Text className="text-[10px] text-gray-400 font-medium">
                      {item.time || "Now"}
                    </Text>
                    {isUser && (
                      <View className="flex-row items-center ml-1.5 gap-0.5">
                        {item.isSeen ? (
                          <>
                            <Ionicons
                              name="checkmark-done"
                              size={13}
                              color="#34594A"
                            />
                            <Text className="text-[10px] text-[#34594A] font-bold ml-0.5">
                              Seen
                            </Text>
                          </>
                        ) : item.isDelivered ? (
                          <>
                            <Ionicons
                              name="checkmark-done"
                              size={13}
                              color="#9CA3AF"
                            />
                            <Text className="text-[10px] text-gray-400 font-medium ml-0.5">
                              Delivered
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons
                              name="checkmark"
                              size={12}
                              color="#9CA3AF"
                            />
                            <Text className="text-[10px] text-gray-400 font-medium ml-0.5">
                              Sent
                            </Text>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

          {/* Farmer is Typing Bubble */}
          {isFarmerTyping && (
            <View className="flex-row items-end mb-3 mt-1">
              <View className="w-8 h-8 rounded-full bg-[#34594A]/15 items-center justify-center mr-2 border border-[#34594A]/30 overflow-hidden">
                {otherUserAvatar ? (
                  <Image
                    source={{ uri: otherUserAvatar }}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <Ionicons name="person" size={16} color="#34594A" />
                )}
              </View>
              <View className="px-3.5 py-2.5 bg-[#34594A]/10 rounded-2xl rounded-bl-xs flex-row items-center border border-[#34594A]/25">
                <View className="flex-row items-center gap-1 mr-2">
                  <View className="w-1.5 h-1.5 rounded-full bg-[#34594A]" />
                  <View className="w-1.5 h-1.5 rounded-full bg-[#34594A]/80" />
                  <View className="w-1.5 h-1.5 rounded-full bg-[#34594A]/60" />
                </View>
                <Text className="text-xs text-[#2E5E20] font-medium">
                  {otherUserName} is typing...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Attachment Menu */}
        {showAttachmentMenu && (
          <View
            className="absolute bottom-16 left-4 z-50 bg-white rounded-2xl p-2 shadow-2xl elevation-10 w-52 border border-gray-100"
            style={{
              position: "absolute",
              bottom: 64,
              left: 16,
              zIndex: 50,
            }}
          >
            {/* Camera Option */}
            <TouchableOpacity
              onPress={handlePickFromCamera}
              className="flex-row items-center px-2.5 py-2 rounded-xl active:bg-gray-100 gap-2.5"
            >
              <View className="w-7 h-7 rounded-full bg-[#3B82F6] items-center justify-center">
                <Ionicons name="camera" size={15} color="#FFFFFF" />
              </View>
              <Text className="text-sm font-semibold text-gray-800">Camera</Text>
            </TouchableOpacity>

            {/* Gallery Option */}
            <TouchableOpacity
              onPress={handlePickFromGallery}
              className="flex-row items-center px-2.5 py-2 rounded-xl active:bg-gray-100 gap-2.5"
            >
              <View className="w-7 h-7 rounded-full bg-[#8B5CF6] items-center justify-center">
                <Ionicons name="images" size={15} color="#FFFFFF" />
              </View>
              <Text className="text-sm font-semibold text-gray-800">Gallery</Text>
            </TouchableOpacity>

            {/* Location Pin Option */}
            <TouchableOpacity
              onPress={() => {
                setShowAttachmentMenu(false);
                setIsLocationModalVisible(true);
              }}
              className="flex-row items-center px-2.5 py-2 rounded-xl active:bg-gray-100 gap-2.5"
            >
              <View className="w-7 h-7 rounded-full bg-[#EF4444] items-center justify-center">
                <Ionicons name="location-sharp" size={15} color="#FFFFFF" />
              </View>
              <Text className="text-sm font-semibold text-gray-800">
                Location Pin
              </Text>
            </TouchableOpacity>

            {/* Voice Message Option */}
            <TouchableOpacity
              onPress={handleStartVoiceRecording}
              className="flex-row items-center px-2.5 py-2 rounded-xl active:bg-gray-100 gap-2.5"
            >
              <View className="w-7 h-7 rounded-full bg-[#34594A] items-center justify-center">
                <Ionicons name="mic" size={15} color="#FFFFFF" />
              </View>
              <Text className="text-sm font-semibold text-gray-800">Voice Note</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Message Request Action Banner */}
        {isMessageRequest && (
          <View className="bg-amber-50/95 border-t border-b border-amber-200/90 px-4 py-3">
            <Text className="text-xs font-semibold text-amber-900 text-center mb-2.5">
              {otherUserName} wants to send you a message. They won't know you've seen it until you accept.
            </Text>
            <View className="flex-row gap-2.5 justify-center">
              <TouchableOpacity
                onPress={handleDeleteRequest}
                className="px-4 py-2 rounded-xl bg-gray-200 active:bg-gray-300"
              >
                <Text className="text-xs font-bold text-gray-700">Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSpamRequest}
                className="px-4 py-2 rounded-xl bg-red-100 active:bg-red-200"
              >
                <Text className="text-xs font-bold text-red-700">Block / Spam</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAcceptRequest}
                className="px-5 py-2 rounded-xl bg-[#34594A] active:opacity-85"
              >
                <Text className="text-xs font-bold text-white">Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Input Bar or Voice Recording Bar */}
        {isRecordingVoice ? (
          <View className="flex-row items-center px-4 py-3 bg-red-50/90 border-t border-red-100">
            <TouchableOpacity
              onPress={handleCancelVoiceRecording}
              className="w-9 h-9 rounded-full bg-red-100 items-center justify-center mr-3 active:bg-red-200"
              accessibilityRole="button"
              accessibilityLabel="Cancel voice recording"
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </TouchableOpacity>

            <View className="flex-1 flex-row items-center justify-between bg-white rounded-full px-4 py-2 mr-3 border border-red-200">
              <View className="flex-row items-center gap-2">
                <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <Text className="text-xs font-mono font-bold text-red-600">
                  {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <View className="w-1 h-3 rounded-full bg-red-400" />
                <View className="w-1 h-5 rounded-full bg-red-500" />
                <View className="w-1 h-2 rounded-full bg-red-300" />
                <View className="w-1 h-4 rounded-full bg-red-400" />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSendVoiceRecording}
              className="w-9 h-9 rounded-full bg-[#34594A] items-center justify-center shadow-xs active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="Send voice message"
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row items-center px-4 py-3 bg-white border-t border-gray-100">
            <TouchableOpacity
              onPress={() => setShowAttachmentMenu((prev) => !prev)}
              className={`w-9 h-9 rounded-full items-center justify-center mr-3 active:opacity-80 shadow-2xs ${
                showAttachmentMenu ? "bg-gray-700" : "bg-[#34594A]"
              }`}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Attachments"
            >
              <Ionicons
                name={showAttachmentMenu ? "close" : "add"}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Text Input Pill */}
            <View className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-3 flex-row items-center border border-gray-200">
              <TextInput
                value={inputText}
                onChangeText={handleInputChange}
                placeholder="Aa"
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-base text-gray-800 p-0 font-medium"
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
            </View>

            {/* Send Button or Quick Flower Sticker */}
            <TouchableOpacity
              onPress={inputText.trim() ? handleSend : handleSendFlowerReaction}
              disabled={isSending}
              className="active:opacity-70 p-1"
              accessibilityRole="button"
              accessibilityLabel={inputText.trim() ? "Send message" : "Send flower reaction"}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#34594A" />
              ) : inputText.trim() ? (
                <Ionicons name="send" size={22} color="#34594A" />
              ) : (
                <MaterialCommunityIcons
                  name="flower-tulip"
                  size={24}
                  color="#EC4899"
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Share Farm Location Pin Modal */}
      <Modal
        visible={isLocationModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setIsLocationModalVisible(false);
          locationModalTranslateY.setValue(0);
        }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          {/* Backdrop */}
          <Pressable
            onPress={() => {
              setIsLocationModalVisible(false);
              locationModalTranslateY.setValue(0);
            }}
            className="absolute inset-0"
            accessibilityRole="button"
            accessibilityLabel="Close location modal backdrop"
          />

          <Animated.View
            style={{
              transform: [{ translateY: locationModalTranslateY }],
            }}
            className="bg-white rounded-t-3xl p-5 pb-8 shadow-2xl max-h-[85%]"
          >
            {/* Drag Handle Area (Swipe down to close) */}
            <View
              {...locationModalPanResponder.panHandlers}
              className="w-full py-2.5 items-center -mt-3 mb-1"
            >
              <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center" />
            </View>

            {/* Header (No X button, swipe down to dismiss) */}
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-full bg-[#34594A] items-center justify-center mr-2.5">
                <Ionicons name="location" size={19} color="#ffffff" />
              </View>
              <Text className="text-lg font-bold text-gray-900">
                Share Farm Location Pin
              </Text>
            </View>

            <Text className="text-sm text-gray-500 mb-4">
              Send your farm gate, pickup spot, or meetup coordinates so the
              other party can easily navigate to you.
            </Text>

            {/* Place Name Input */}
            <Text className="text-sm font-bold text-gray-700 mb-1">
              Location / Farm Name
            </Text>
            <TextInput
              value={locationTitle}
              onChangeText={setLocationTitle}
              placeholder="e.g. Green Valley Farm - Main Gate"
              placeholderTextColor="#9CA3AF"
              className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 mb-3"
            />

            {/* Address Input */}
            <Text className="text-sm font-bold text-gray-700 mb-1">
              Address / Landmark Instructions
            </Text>
            <TextInput
              value={locationAddress}
              onChangeText={setLocationAddress}
              placeholder="e.g. Near Pala-o Crossing, Iligan City"
              placeholderTextColor="#9CA3AF"
              className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 mb-3"
            />

            {/* GPS Coordinates Display */}
            <View className="flex-row items-center justify-between bg-gray-100 border border-gray-200 p-3 rounded-xl mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="navigate-circle" size={25} color="#34594A" />
                <View>
                  <Text className="text-sm font-bold text-[#000000]">
                    GPS Coordinates
                  </Text>
                  <Text className="text-sm font-mono text-[#34594A]">
                    {locationCoords.latitude.toFixed(4)}° N,{" "}
                    {locationCoords.longitude.toFixed(4)}° E
                  </Text>
                </View>
              </View>
              <View className="bg-[#34594A] px-3 py-1 rounded-md">
                <Text className="text-sm font-bold text-white">READY</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setIsLocationModalVisible(false);
                  locationModalTranslateY.setValue(0);
                }}
                className="flex-1 py-3 rounded-xl bg-gray-100 items-center justify-center active:bg-gray-200"
              >
                <Text className="text-sm font-semibold text-gray-700">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  handleSendLocation({
                    title: locationTitle.trim() || "Farm Location Pin",
                    address:
                      locationAddress.trim() || "Iligan City, Philippines",
                    latitude: locationCoords.latitude,
                    longitude: locationCoords.longitude,
                  })
                }
                disabled={isSending}
                className="flex-1 py-3 rounded-xl bg-[#34594A] items-center justify-center flex-row gap-2 active:opacity-85"
              >
                <Text className="text-sm font-bold text-white">
                  Send Location Pin
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* In-App Map Preview Modal */}
      <Modal
        visible={!!previewMapLocation}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setPreviewMapLocation(null)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-4 py-3 bg-white border-b border-gray-100 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => setPreviewMapLocation(null)}
              className="p-1 -ml-1 flex-row items-center gap-1"
            >
              <Ionicons name="chevron-back" size={24} color="#000000" />
              <Text className="text-sm font-medium text-gray-700">Back</Text>
            </TouchableOpacity>

            <Text
              className="text-base font-bold text-gray-900 max-w-[200px]"
              numberOfLines={1}
            >
              {previewMapLocation?.title || "Location Map"}
            </Text>

            <TouchableOpacity
              onPress={() => {
                if (previewMapLocation) {
                  openExternalMap(
                    previewMapLocation.latitude,
                    previewMapLocation.longitude,
                    previewMapLocation.title,
                  );
                }
              }}
              className="p-1"
            >
              <Ionicons name="open-outline" size={22} color="#15803D" />
            </TouchableOpacity>
          </View>

          {previewMapLocation && (
            <View className="flex-1 relative">
              <LeafletMap
                latitude={previewMapLocation.latitude}
                longitude={previewMapLocation.longitude}
                zoom={15}
              />

              {/* Floating Info Card on bottom of map */}
              <View className="absolute bottom-6 left-4 right-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-gray-200">
                <View className="flex-row items-start justify-between mb-1">
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-bold text-gray-900">
                      {previewMapLocation.title}
                    </Text>
                    {previewMapLocation.address && (
                      <Text className="text-xs text-gray-500 mt-0.5">
                        {previewMapLocation.address}
                      </Text>
                    )}
                  </View>
                  <View className="w-8 h-8 rounded-full bg-red-100 items-center justify-center">
                    <Ionicons name="location" size={18} color="#EF4444" />
                  </View>
                </View>

                <Text className="text-[10px] font-mono text-gray-400 mb-3">
                  {previewMapLocation.latitude.toFixed(4)}° N,{" "}
                  {previewMapLocation.longitude.toFixed(4)}° E
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    openExternalMap(
                      previewMapLocation.latitude,
                      previewMapLocation.longitude,
                      previewMapLocation.title,
                    )
                  }
                  className="w-full bg-[#34594A] py-2.5 rounded-xl flex-row items-center justify-center gap-2 active:opacity-85"
                >
                  <Ionicons name="navigate" size={16} color="#FFFFFF" />
                  <Text className="text-white font-bold text-sm">
                    Navigate in Google Maps
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Full-Screen Image Preview Modal */}
      <Modal
        visible={!!fullPreviewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullPreviewImage(null)}
      >
        <View className="flex-1 bg-black/95 items-center justify-center relative">
          <SafeAreaView className="absolute top-4 right-4 z-50">
            <TouchableOpacity
              onPress={() => setFullPreviewImage(null)}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center active:bg-white/30"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </SafeAreaView>
          {fullPreviewImage ? (
            <Image
              source={{ uri: fullPreviewImage }}
              className="w-full h-4/5"
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      {/* 1. In-App Voice Call Modal */}
      <Modal
        visible={isVoiceCallModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={handleEndVoiceCall}
      >
        <SafeAreaView className="flex-1 bg-[#1A3826]">
          <LinearGradient
            colors={["#1B4332", "#081C15"]}
            className="flex-1 px-6 py-8 justify-between items-center"
          >
            {/* Top Bar */}
            <View className="w-full flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="shield-checkmark" size={16} color="#34594A" />
                <Text className="text-xs font-semibold text-emerald-200">
                  End-to-End Encrypted
                </Text>
              </View>
              <View className="px-2.5 py-1 rounded-full bg-white/10">
                <Text className="text-xs font-mono text-white/80">
                  {voiceCallStatus === "connected"
                    ? `${Math.floor(callSeconds / 60)}:${(callSeconds % 60).toString().padStart(2, "0")}`
                    : voiceCallStatus === "ringing"
                    ? "Ringing..."
                    : "Connecting..."}
                </Text>
              </View>
            </View>

            {/* Middle Section: Avatar & Farmer Name */}
            <View className="items-center">
              <View className="relative mb-6">
                <View className="w-32 h-32 rounded-full bg-white/10 items-center justify-center p-1 border-2 border-emerald-400/40">
                  <View className="w-full h-full rounded-full overflow-hidden bg-emerald-800 items-center justify-center">
                    {otherUserAvatar ? (
                      <Image
                        source={{ uri: otherUserAvatar }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="person" size={60} color="#D1FAE5" />
                    )}
                  </View>
                </View>
              </View>

              <Text className="text-2xl font-bold text-white text-center mb-1">
                {otherUserName}
              </Text>
              <Text className="text-sm text-emerald-200 font-medium">
                {voiceCallStatus === "connected"
                  ? "Voice Call Connected"
                  : voiceCallStatus === "ringing"
                  ? "Ringing..."
                  : "Calling Local Farmer..."}
              </Text>
            </View>

            {/* Bottom Controls */}
            <View className="w-full items-center gap-8">
              {/* Audio Controls Dock */}
              <View className="flex-row items-center justify-center gap-8">
                {/* Mute Button */}
                <TouchableOpacity
                  onPress={() => setIsCallMuted((m) => !m)}
                  className={`w-14 h-14 rounded-full items-center justify-center ${
                    isCallMuted ? "bg-red-500/80" : "bg-white/15"
                  }`}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isCallMuted ? "mic-off" : "mic"}
                    size={26}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Speaker Button */}
                <TouchableOpacity
                  onPress={() => setIsSpeakerOn((s) => !s)}
                  className={`w-14 h-14 rounded-full items-center justify-center ${
                    isSpeakerOn ? "bg-emerald-500" : "bg-white/15"
                  }`}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isSpeakerOn ? "volume-high" : "volume-medium"}
                    size={26}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              {/* End Call Button */}
              <TouchableOpacity
                onPress={handleEndVoiceCall}
                className="w-16 h-16 rounded-full bg-red-600 items-center justify-center shadow-lg active:opacity-85"
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </SafeAreaView>
      </Modal>

      {/* 2. In-App Video Call Modal */}
      <Modal
        visible={isVideoCallModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={handleEndVideoCall}
      >
        <View className="flex-1 bg-black relative">
          {/* Main Remote View (Farmer Fullscreen Feed Simulation) */}
          <View className="flex-1 justify-center items-center bg-[#0B1E13]">
            {otherUserAvatar ? (
              <Image
                source={{ uri: otherUserAvatar }}
                className="w-full h-full opacity-40 absolute"
                resizeMode="cover"
                blurRadius={10}
              />
            ) : null}

            <View className="items-center z-10 px-6">
              <View className="w-28 h-28 rounded-full border-2 border-emerald-400/60 p-1 mb-4 bg-black/40">
                <View className="w-full h-full rounded-full overflow-hidden items-center justify-center bg-emerald-900">
                  {otherUserAvatar ? (
                    <Image
                      source={{ uri: otherUserAvatar }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={50} color="#A7F3D0" />
                  )}
                </View>
              </View>
              <Text className="text-xl font-bold text-white text-center mb-1">
                {otherUserName}
              </Text>
              <Text className="text-xs text-emerald-300 font-medium">
                {videoCallStatus === "connected"
                  ? `Live Video • ${Math.floor(videoSeconds / 60)}:${(videoSeconds % 60).toString().padStart(2, "0")}`
                  : "Connecting Video Feed..."}
              </Text>
            </View>
          </View>

          {/* Picture-in-Picture: Self Camera Feed */}
          {!isVideoCameraOff && cameraPermission?.granted && (
            <View
              className="absolute top-14 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/60 shadow-2xl z-20 bg-gray-900"
            >
              <CameraView
                style={{ flex: 1, width: "100%", height: "100%" }}
                facing={cameraFacing}
              />
              <View className="absolute bottom-1 right-1 bg-black/50 px-1.5 py-0.5 rounded-md">
                <Text className="text-[9px] text-white font-bold">YOU</Text>
              </View>
            </View>
          )}

          {/* Floating Controls Dock */}
          <SafeAreaView className="absolute bottom-8 left-4 right-4 z-30">
            <View className="flex-row items-center justify-around bg-black/60 backdrop-blur-md py-3.5 px-4 rounded-3xl border border-white/10">
              {/* Flip Camera */}
              <TouchableOpacity
                onPress={() => setCameraFacing((f: any) => (f === "front" ? "back" : "front"))}
                className="w-12 h-12 rounded-full bg-white/20 items-center justify-center active:bg-white/30"
              >
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Mute Mic */}
              <TouchableOpacity
                onPress={() => setIsVideoMuted((m) => !m)}
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  isVideoMuted ? "bg-red-500" : "bg-white/20"
                }`}
              >
                <Ionicons name={isVideoMuted ? "mic-off" : "mic"} size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Toggle Video Camera */}
              <TouchableOpacity
                onPress={() => setIsVideoCameraOff((c) => !c)}
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  isVideoCameraOff ? "bg-red-500" : "bg-white/20"
                }`}
              >
                <Ionicons
                  name={isVideoCameraOff ? "videocam-off" : "videocam"}
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              {/* End Call */}
              <TouchableOpacity
                onPress={handleEndVideoCall}
                className="w-13 h-13 rounded-full bg-red-600 items-center justify-center shadow-lg active:opacity-85"
              >
                <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* 3. Farmer Profile & Conversation Info Full Screen Page (Native Horizontal Push Transition) */}
      {isInfoModalMounted && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "#F9FAFB",
              zIndex: 999,
              elevation: 999,
              transform: [{ translateX: infoSlideX }],
            },
          ]}
        >
          <SafeAreaView className="flex-1 bg-[#F9FAFB]">
            {/* Top Navigation Bar with Chevron Back (no title, matching mockup) */}
            <View className="flex-row items-center px-4 py-2 bg-[#F9FAFB]">
              <TouchableOpacity
                onPress={handleCloseInfoModal}
                className="w-10 h-10 rounded-full items-center justify-center -ml-2 active:bg-gray-200"
                accessibilityRole="button"
                accessibilityLabel="Back to conversation"
              >
                <Ionicons name="chevron-back" size={28} color="#34594A" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
              {/* Centered Profile Avatar & Name */}
              <View className="items-center pt-1 pb-6">
                <View className="w-24 h-24 rounded-full bg-[#9CA3AF]/30 items-center justify-center overflow-hidden mb-3">
                  {otherUserAvatar ? (
                    <Image
                      source={{ uri: otherUserAvatar }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={56} color="#FFFFFF" />
                  )}
                </View>

                <Text className="text-xl font-bold text-gray-900 text-center">
                  {customNickname || otherUserName}
                </Text>
              </View>

              {/* 1. User info */}
              <Text className="text-[13px] font-semibold text-gray-500 mb-1.5 ml-1">
                User info
              </Text>
              <View className="bg-white rounded-2xl border border-gray-100 shadow-2xs mb-5 overflow-hidden">
                <TouchableOpacity
                  onPress={handleVisitProfile}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel={`Visit profile of ${otherUserName}`}
                >
                  <View className="w-7 items-center mr-3">
                    <Ionicons name="person" size={20} color="#34594A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-medium text-gray-900">
                      Visit profile
                    </Text>
                    <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                      {customNickname || otherUserName}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#34594A" />
                </TouchableOpacity>
              </View>

              {/* 2. Actions */}
              <Text className="text-[13px] font-semibold text-gray-500 mb-1.5 ml-1">
                Actions
              </Text>
              <View className="bg-white rounded-2xl border border-gray-100 shadow-2xs mb-5 overflow-hidden">
                <TouchableOpacity
                  onPress={handleToggleMute}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="Mute notifications"
                >
                  <View className="w-7 items-center mr-3">
                    <Ionicons
                      name={isMuted ? "notifications-off" : "notifications"}
                      size={20}
                      color="#34594A"
                    />
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    {isMuted ? `Unmute ${otherUserName}` : `Mute ${otherUserName}`}
                  </Text>
                </TouchableOpacity>

                <View className="h-px bg-gray-100 ml-14" />

                <TouchableOpacity
                  onPress={handleCreateGroup}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="Create group"
                >
                  <View className="w-7 items-center mr-3">
                    <Ionicons name="people" size={20} color="#34594A" />
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    Create group with {firstName}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 3. Message info */}
              <Text className="text-[13px] font-semibold text-gray-500 mb-1.5 ml-1">
                Message info
              </Text>
              <View className="bg-white rounded-2xl border border-gray-100 shadow-2xs mb-5 overflow-hidden">
                <TouchableOpacity
                  onPress={() => setIsMediaViewerOpen(true)}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="View media"
                >
                  <View className="w-7 items-center mr-3">
                    <Ionicons name="images" size={20} color="#34594A" />
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    View media
                  </Text>
                </TouchableOpacity>

                <View className="h-px bg-gray-100 ml-14" />

                <TouchableOpacity
                  onPress={() => setIsFilesViewerOpen(true)}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="View files"
                >
                  <View className="w-7 items-center mr-3">
                    <Ionicons name="folder" size={20} color="#34594A" />
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    View files
                  </Text>
                </TouchableOpacity>

                <View className="h-px bg-gray-100 ml-14" />

                <TouchableOpacity
                  onPress={() => {
                    setTempNickname(customNickname || otherUserName);
                    setIsNicknameModalOpen(true);
                  }}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="Nickname"
                >
                  <View className="w-7 items-center mr-3">
                    <Text className="text-[17px] font-bold text-[#1F2937] leading-none">
                      Aa
                    </Text>
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    Nickname
                  </Text>
                </TouchableOpacity>

                <View className="h-px bg-gray-100 ml-14" />

                <TouchableOpacity
                  onPress={handleSearchMessages}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="Search messages"
                >
                  <View className="w-7 items-center mr-3">
                    <Ionicons name="search" size={20} color="#34594A" />
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    Search messages
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 4. Privacy */}
              <Text className="text-[13px] font-semibold text-gray-500 mb-1.5 ml-1">
                Privacy
              </Text>
              <View className="bg-white rounded-2xl border border-gray-100 shadow-2xs mb-8 overflow-hidden">
                <TouchableOpacity
                  onPress={handleReportUser}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="Report"
                >
                  <View className="w-7 items-center mr-3">
                    <Ionicons name="warning" size={20} color="#34594A" />
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    Report
                  </Text>
                </TouchableOpacity>

                <View className="h-px bg-gray-100 ml-14" />

                <TouchableOpacity
                  onPress={handleRestrictUser}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="Restrict"
                >
                  <View className="w-7 items-center mr-3">
                    <Ionicons name="eye-off" size={20} color="#34594A" />
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    {isRestricted ? "Unrestrict" : "Restrict"}
                  </Text>
                </TouchableOpacity>

                <View className="h-px bg-gray-100 ml-14" />

                <TouchableOpacity
                  onPress={handleBlockUser}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="Block"
                >
                  <View className="w-7 items-center mr-3">
                    <Ionicons name="ban" size={20} color="#34594A" />
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    Block
                  </Text>
                </TouchableOpacity>

                <View className="h-px bg-gray-100 ml-14" />

                <TouchableOpacity
                  onPress={handleDeleteChat}
                  disabled={isDeletingChat}
                  className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
                  accessibilityRole="button"
                  accessibilityLabel="Delete all chat"
                >
                  <View className="w-7 items-center mr-3">
                    {isDeletingChat ? (
                      <ActivityIndicator size="small" color="#1F2937" />
                    ) : (
                      <Ionicons name="trash" size={20} color="#34594A" />
                    )}
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">
                    {isDeletingChat ? "Deleting all chat..." : "Delete all chat"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* View Media Sub-Modal */}
      <Modal
        visible={isMediaViewerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsMediaViewerOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <TouchableOpacity
              onPress={() => setIsMediaViewerOpen(false)}
              className="w-9 h-9 rounded-full items-center justify-center active:bg-gray-100"
              accessibilityRole="button"
              accessibilityLabel="Close media"
            >
              <Ionicons name="chevron-back" size={24} color="#34594A" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-gray-900">
              Shared Media ({allMedia.length})
            </Text>
            <View className="w-9" />
          </View>

          {allMedia.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
                <Ionicons name="images-outline" size={32} color="#34594A" />
              </View>
              <Text className="text-base font-semibold text-gray-700">No media yet</Text>
              <Text className="text-xs text-gray-400 text-center mt-1">
                Photos shared in this conversation will appear here.
              </Text>
            </View>
          ) : (
            <ScrollView className="flex-1 p-3" showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap gap-2">
                {allMedia.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setFullPreviewImage(m.imageUrl)}
                    className="w-[31.5%] aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 active:opacity-80"
                  >
                    <Image source={{ uri: m.imageUrl }} className="w-full h-full" resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* View Files & Links Sub-Modal */}
      <Modal
        visible={isFilesViewerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsFilesViewerOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <TouchableOpacity
              onPress={() => setIsFilesViewerOpen(false)}
              className="w-9 h-9 rounded-full items-center justify-center active:bg-gray-100"
              accessibilityRole="button"
              accessibilityLabel="Close files"
            >
              <Ionicons name="chevron-back" size={24} color="#34594A" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-gray-900">
              Shared Files & Links ({allLinks.length})
            </Text>
            <View className="w-9" />
          </View>

          {allLinks.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
                <Ionicons name="folder-outline" size={32} color="#34594A" />
              </View>
              <Text className="text-base font-semibold text-gray-700">No files or links yet</Text>
              <Text className="text-xs text-gray-400 text-center mt-1">
                Links, pins, and attachments shared in this conversation will appear here.
              </Text>
            </View>
          ) : (
            <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
              <View className="gap-2.5">
                {allLinks.map((link) => (
                  <TouchableOpacity
                    key={link.id}
                    onPress={() => Linking.openURL(link.url).catch(() => {})}
                    className="flex-row items-center p-3 bg-gray-50 rounded-xl border border-gray-100 active:bg-gray-100"
                  >
                    <View className="w-9 h-9 rounded-lg bg-[#34594A]/15 items-center justify-center mr-3">
                      <Ionicons
                        name={link.url.includes("maps") ? "location" : "link"}
                        size={18}
                        color="#34594A"
                      />
                    </View>
                    <View className="flex-1 pr-2">
                      <Text numberOfLines={1} className="text-sm font-semibold text-gray-800">
                        {link.title}
                      </Text>
                      <Text numberOfLines={1} className="text-xs text-blue-600 underline mt-0.5">
                        {link.url}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color="#34594A" />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Set Nickname Sub-Modal */}
      <Modal
        visible={isNicknameModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNicknameModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-center items-center bg-black/50 px-6"
        >
          <View className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl">
            <Text className="text-lg font-bold text-gray-900 mb-1">
              Edit Nickname
            </Text>
            <Text className="text-xs text-gray-500 mb-4">
              Set a nickname only you will see in this conversation.
            </Text>

            <TextInput
              value={tempNickname}
              onChangeText={setTempNickname}
              placeholder={otherUserName}
              placeholderTextColor="#9CA3AF"
              className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 font-medium mb-4"
              autoFocus
              selectTextOnFocus
            />

            <View className="flex-row justify-end gap-2.5">
              <TouchableOpacity
                onPress={() => setIsNicknameModalOpen(false)}
                className="px-4 py-2 rounded-xl active:bg-gray-100"
              >
                <Text className="text-sm font-semibold text-gray-600">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setCustomNickname(tempNickname.trim());
                  setIsNicknameModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#34594A] active:opacity-85"
              >
                <Text className="text-sm font-bold text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 8. Full Report Screen Modal (Mockup Accurate) */}
      <Modal
        visible={isReportModalVisible}
        animationType="slide"
        onRequestClose={() => setIsReportModalVisible(false)}
        statusBarTranslucent={true}
      >
        <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom", "left", "right"]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 bg-white"
          >
            {/* Header: < Report */}
            <View className="px-5 pt-2 pb-2 bg-white border-b border-gray-100 flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => {
                  setIsReportModalVisible(false);
                  setIsReportSuccess(false);
                }}
                className="flex-row items-center -ml-2 py-1 active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={26} color="#34594A" />
                <Text className="text-xl font-bold text-gray-900 ml-1">Report</Text>
              </TouchableOpacity>
            </View>

            {isReportSuccess ? (
              /* Successfully Report View (Mockup-Accurate Completion) */
              <ScrollView
                className="flex-1 px-5 pt-8"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
              >
                <View className="w-20 h-20 rounded-full bg-[#EDF3EE] items-center justify-center mb-4 border-2 border-[#E3ECE5]">
                  <Ionicons name="checkmark-circle" size={54} color="#34594A" />
                </View>

                <Text className="text-2xl font-bold text-gray-900 mb-1.5 text-center">
                  Successfully Reported
                </Text>
                <Text className="text-xs text-gray-500 mb-6 text-center">
                  Your report has been received and logged for moderation review.
                </Text>

                {/* Notice Card matching Figma text */}
                <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-5 w-full">
                  <Text className="text-[13px] text-gray-700 leading-relaxed text-center">
                    You have reported this user for{" "}
                    <Text className="font-bold text-gray-900">
                      violating community guidelines
                    </Text>
                    . Our moderation team will review the report and take appropriate action if necessary.
                  </Text>
                </View>

                {/* User info Card */}
                <View className="w-full mb-4">
                  <Text className="text-sm font-semibold text-gray-700 mb-1.5">User info</Text>
                  <View className="bg-white border border-gray-300 rounded-xl px-4 py-3.5 shadow-2xs">
                    <Text className="text-base font-bold text-gray-900 leading-tight">
                      {otherUserName}
                    </Text>
                  </View>
                </View>

                {/* Report Details Summary Card */}
                <View className="bg-white border border-gray-200 rounded-2xl p-4 w-full mb-8 shadow-2xs">
                  <View className="flex-row justify-between py-2 border-b border-gray-100">
                    <Text className="text-xs font-medium text-gray-500">Reason</Text>
                    <Text className="text-xs font-semibold text-gray-800 flex-1 text-right ml-4" numberOfLines={1}>
                      {selectedReportReason}
                    </Text>
                  </View>
                  <View className="flex-row justify-between py-2">
                    <Text className="text-xs font-medium text-gray-500">Status</Text>
                    <View className="flex-row items-center gap-1.5">
                      <View className="w-2 h-2 rounded-full bg-amber-500" />
                      <Text className="text-xs font-bold text-amber-600">Pending Review</Text>
                    </View>
                  </View>
                </View>

                {/* Done Button */}
                <TouchableOpacity
                  onPress={() => {
                    setIsReportModalVisible(false);
                    setIsReportSuccess(false);
                  }}
                  activeOpacity={0.85}
                  className="w-full py-3.5 rounded-xl bg-[#34594A] items-center justify-center shadow-xs active:bg-[#2A4F3E]"
                >
                  <Text className="text-white font-bold text-base">Done</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* Report Submission Form */
              <ScrollView
                className="flex-1 px-5 pt-3"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                {/* Notice Card from Figma: "You are about to report this user..." */}
                <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
                  <Text className="text-[13px] text-gray-700 leading-relaxed">
                    You are about to report this user for{" "}
                    <Text className="font-bold text-gray-900">
                      violating community guidelines
                    </Text>
                    . Our moderation team will review the report and take appropriate action
                    if necessary. Please choose the reason for your report below.
                  </Text>
                </View>

                {/* User info */}
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-700 mb-1.5">User info</Text>
                  <View className="bg-white border border-gray-300 rounded-xl px-4 py-3.5 shadow-2xs">
                    <Text className="text-base font-bold text-gray-900 leading-tight">
                      {otherUserName}
                    </Text>
                  </View>
                </View>

                {/* Reason for reporting * */}
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-700 mb-1.5">
                    Reason for reporting <Text className="text-red-500">*</Text>
                  </Text>
                  <View className="bg-white border border-gray-300 rounded-xl px-4 py-1.5 shadow-2xs">
                    {REPORT_REASONS.map((reason, idx) => {
                      const isSelected = selectedReportReason === reason;
                      return (
                        <TouchableOpacity
                          key={reason}
                          onPress={() => setSelectedReportReason(reason)}
                          activeOpacity={0.7}
                          className={`flex-row items-center py-2.5 ${
                            idx < REPORT_REASONS.length - 1 ? "border-b border-gray-100" : ""
                          }`}
                        >
                          <View
                            className={`w-5 h-5 rounded-full border items-center justify-center mr-3 ${
                              isSelected ? "border-[#34594A]" : "border-gray-400"
                            }`}
                          >
                            {isSelected && (
                              <View className="w-2.5 h-2.5 rounded-full bg-[#34594A]" />
                            )}
                          </View>
                          <Text
                            className={`text-[13.5px] flex-1 ${
                              isSelected ? "text-gray-900 font-semibold" : "text-gray-700 font-normal"
                            }`}
                          >
                            {reason}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Statement * */}
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-700 mb-1.5">
                    Statement <Text className="text-red-500">*</Text>
                  </Text>
                  <View className="bg-white border border-gray-300 rounded-xl p-3.5 shadow-2xs">
                    <TextInput
                      multiline
                      numberOfLines={4}
                      value={reportStatement}
                      onChangeText={setReportStatement}
                      placeholder="Please state scenario."
                      placeholderTextColor="#9CA3AF"
                      className="text-sm text-gray-900 min-h-[90px] font-normal"
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                {/* Attachment (optional but recommended) */}
                <View className="mb-5">
                  <Text className="text-sm font-semibold text-gray-700 mb-1.5">
                    Attachment (optional but recommended)
                  </Text>
                  <TouchableOpacity
                    onPress={handlePickReportAttachment}
                    activeOpacity={0.8}
                    className="bg-white border border-gray-300 rounded-xl px-3.5 py-3 flex-row items-center shadow-2xs mb-1"
                  >
                    <View className="w-7 h-7 rounded-lg bg-gray-100 items-center justify-center mr-2.5">
                      <Ionicons name="attach" size={18} color="#34594A" />
                    </View>
                    <Text
                      className={`text-sm flex-1 ${
                        reportAttachmentName ? "text-gray-900 font-medium" : "text-gray-400"
                      }`}
                      numberOfLines={1}
                    >
                      {reportAttachmentName || "Choose a file"}
                    </Text>
                    {reportAttachmentUri && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setReportAttachmentUri(null);
                          setReportAttachmentName("");
                        }}
                        className="p-1"
                      >
                        <Ionicons name="close-circle" size={18} color="#34594A" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                  <Text className="text-[11px] text-gray-400 ml-0.5">
                    Supported file types may include JPG, PNG, PDF.
                  </Text>
                </View>

                {/* Green Report Button */}
                <TouchableOpacity
                  onPress={handleSubmitReport}
                  disabled={isSubmittingReport}
                  activeOpacity={0.85}
                  className={`w-full py-3.5 rounded-xl items-center justify-center mb-3 shadow-xs ${
                    isSubmittingReport ? "bg-[#34594A]/70" : "bg-[#34594A] active:bg-[#2A4F3E]"
                  }`}
                >
                  {isSubmittingReport ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text className="text-white font-bold text-base">Report</Text>
                  )}
                </TouchableOpacity>

                {/* Guidelines Checkbox */}
                <TouchableOpacity
                  onPress={() => setHasAgreedToGuidelines(!hasAgreedToGuidelines)}
                  activeOpacity={0.8}
                  className="flex-row items-center justify-center pt-1 pb-4"
                >
                  <View
                    className={`w-4.5 h-4.5 rounded-full border items-center justify-center mr-2 ${
                      hasAgreedToGuidelines ? "border-[#34594A]" : "border-gray-400"
                    }`}
                    style={{ width: 18, height: 18 }}
                  >
                    {hasAgreedToGuidelines && (
                      <View className="w-2.5 h-2.5 rounded-full bg-[#34594A]" />
                    )}
                  </View>
                  <Text className="text-xs text-gray-600">
                    I have read and understood our{" "}
                    <Text
                      onPress={handleOpenCommunityGuidelines}
                      className="underline text-[#34594A] font-medium"
                    >
                      Community Guidelines.
                    </Text>
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Navigation from "../../components/Navigation";

const DEFAULT_AVATAR = "";

export default function ChangePicture() {
  const router = useRouter();
  const [avatarUri, setAvatarUri] = useState<string>(DEFAULT_AVATAR);
  const [sliderProgress, setSliderProgress] = useState<number>(0.15);
  const [trackWidth, setTrackWidth] = useState<number>(280);

  const updateSliderProgress = (locationX: number) => {
    if (trackWidth <= 0) return;
    const clampedX = Math.max(0, Math.min(locationX, trackWidth));
    setSliderProgress(clampedX / trackWidth);
  };

  const handleBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push("/user/PersonalInformation" as any);
      }
    } catch {
      router.push("/user/PersonalInformation" as any);
    }
  };

  const handleSave = () => {
    Alert.alert("Success", "Profile picture updated successfully!", [
      { text: "OK", onPress: handleBack },
    ]);
  };

  const pickImageFromGallery = async () => {
    try {
      if (Platform.OS !== "web") {
        const permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert(
            "Permission Required",
            "Permission to access your gallery is required to choose a profile picture.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
        setSliderProgress(0.15);
        return;
      }
    } catch (error) {
      console.error("Error picking image from gallery:", error);
    }

    // Direct Web fallback if running on web browser
    if (Platform.OS === "web" && typeof document !== "undefined") {
      try {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const res = event.target?.result;
              if (typeof res === "string") {
                setAvatarUri(res);
                setSliderProgress(0.15);
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } catch (webErr) {
        console.error("Web file picker error:", webErr);
      }
    }
  };

  const thumbLeft = Math.max(
    0,
    Math.min(
      sliderProgress * (trackWidth || 280) - 12,
      (trackWidth || 280) - 24,
    ),
  );

  return (
    <SafeAreaView
      className="flex-1 bg-white relative"
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
    >
      <ScrollView
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Top Header Row */}
        <View className="flex-row items-center justify-center px-4 pt-4 pb-3 relative bg-white">
          <TouchableOpacity
            onPress={handleBack}
            className="absolute left-4 top-4 p-1 active:opacity-70"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-undo" size={28} color="#000000" />
          </TouchableOpacity>

          <Text className="text-xl font-bold text-gray-900">
            Change picture
          </Text>
        </View>

        {/* Large Circular Profile Picture Crop Preview */}
        <View className="items-center justify-center mt-10 mb-6">
          <TouchableOpacity
            onPress={pickImageFromGallery}
            activeOpacity={0.9}
            className="relative"
            accessibilityRole="button"
            accessibilityLabel="Choose photo from gallery"
          >
            <View className="w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden bg-[#E5E7EB] items-center justify-center shadow-lg border border-gray-100">
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{
                    width: "100%",
                    height: "100%",
                    transform: [{ scale: 1 + sliderProgress * 1.2 }],
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full bg-[#E5E7EB] items-center justify-center">
                  <Ionicons name="person" size={130} color="#9CA3AF" />
                </View>
              )}
            </View>

            {/* Gallery Icon Badge */}
            <View className="absolute bottom-2 right-4 bg-[#72AF5B] p-2.5 rounded-full border-2 border-white shadow-md">
              <Ionicons name="images" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={pickImageFromGallery}
            className="mt-3 flex-row items-center gap-1.5 active:opacity-70"
          >
            <Ionicons name="image-outline" size={18} color="#72AF5B" />
            <Text className="text-sm font-semibold text-[#72AF5B]">
              Choose from gallery
            </Text>
          </TouchableOpacity>
        </View>

        {/* Slider & Actions Container */}
        <View className="px-8 w-full max-w-[360px] self-center">
          {/* Horizontal Slider Track */}
          <View
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(evt) =>
              updateSliderProgress(evt.nativeEvent.locationX)
            }
            onResponderMove={(evt) =>
              updateSliderProgress(evt.nativeEvent.locationX)
            }
            className="h-8 justify-center relative"
          >
            {/* Gray Bar */}
            <View className="h-2 bg-[#D1D5DB] rounded-full w-full" />

            {/* Slider Thumb Handle */}
            <View
              style={{
                position: "absolute",
                left: thumbLeft,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#CBD5E1",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.25,
                shadowRadius: 2,
                elevation: 3,
              }}
            />
          </View>

          {/* Action Buttons: Cancel and Save */}
          <View className="flex-row justify-end gap-3 mt-4">
            <TouchableOpacity
              onPress={handleBack}
              className="bg-[#A0A8B0] px-6 py-2.5 rounded-lg active:bg-[#8e969e] shadow-xs"
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text className="text-white text-base font-bold">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              className="bg-[#72AF5B] px-7 py-2.5 rounded-lg active:bg-[#60964c] shadow-xs"
              style={{ backgroundColor: "#72AF5B" }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Save"
            >
              <Text className="text-white text-base font-bold">Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Navigation activeTab="Menu" showFab={false} />
    </SafeAreaView>
  );
}

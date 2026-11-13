import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_RSBSA_STATE,
  RSBSAApplication,
  getRSBSAApplication,
  setRSBSAStatus,
  submitRSBSAApplication,
} from "@/services/rsbsa-service";
import { syncRSBSASupportTicket } from "@/services/support-service";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RSBSAVerificationScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [rsbsaApp, setRsbsaApp] =
    useState<RSBSAApplication>(DEFAULT_RSBSA_STATE);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [rsbsaNumber, setRsbsaNumber] = useState("");
  const [farmName, setFarmName] = useState("");
  const [location, setLocation] = useState("");
  const [crops, setCrops] = useState("");
  const [documentUri, setDocumentUri] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getRSBSAApplication();
      setRsbsaApp(data);
      if (data.fullName) setFullName(data.fullName);
      else if (user?.name) setFullName(user.name);

      if (data.rsbsaNumber) setRsbsaNumber(data.rsbsaNumber);
      if (data.farmName) setFarmName(data.farmName);
      if (data.location) setLocation(data.location);
      if (data.crops) setCrops(data.crops);
      if (data.documentUri) setDocumentUri(data.documentUri);
    } catch (err) {
      console.warn("Failed to load RSBSA application:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handlePickDocument = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow photo library access to upload a photo of your RSBSA certificate.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setDocumentUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn("Error picking document:", err);
    }
  };

  const handleSubmit = async () => {
    if (
      !fullName.trim() ||
      !rsbsaNumber.trim() ||
      !farmName.trim() ||
      !location.trim()
    ) {
      Alert.alert(
        "Incomplete Information",
        "Please provide your full legal name, RSBSA reference number, farm name, and location.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await submitRSBSAApplication({
        fullName: fullName.trim(),
        rsbsaNumber: rsbsaNumber.trim(),
        farmName: farmName.trim(),
        location: location.trim(),
        crops: crops.trim() || "Various Fruits & Vegetables",
        documentUri,
      });

      setRsbsaApp(updated);
      try {
        await syncRSBSASupportTicket("Under Review", updated);
      } catch (ticketErr) {
        console.warn("Could not sync ticket:", ticketErr);
      }

      Alert.alert(
        "Application Submitted",
        "Your RSBSA application has been submitted for review. Municipal agricultural verification typically takes 24–48 hours. You can track this in your Support Inbox.",
      );
    } catch {
      Alert.alert("Error", "Could not submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateApproval = async () => {
    const updated = await setRSBSAStatus("verified");
    setRsbsaApp(updated);
    try {
      await syncRSBSASupportTicket("Approved / Verified", updated);
    } catch (ticketErr) {
      console.warn("Could not sync ticket:", ticketErr);
    }
    Alert.alert(
      "Farmer Verified! ✓",
      "Your RSBSA application is now Approved. The green verified checkmark badge is active across your profile, newsfeed, and comments.",
    );
  };

  const handleReset = async () => {
    Alert.alert(
      "Reset Application",
      "Do you want to reset your verification status and submit a new RSBSA number?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            const updated = await setRSBSAStatus("unverified");
            setRsbsaApp(updated);
          },
        },
      ],
    );
  };

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

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      edges={["top", "left", "right"]}
    >
      {/* Top Header matching Reservations & Saved */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#EDF1EB",
        }}
      >
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: "#F5F7F5",
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color="#293E33" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              letterSpacing: -0.4,
              color: "#293E33",
              textAlign: "center",
            }}
          >
            RSBSA Verification
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-4 pt-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {loading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#77af5c" />
              <Text className="text-xs text-gray-400 mt-2">
                Loading verification record...
              </Text>
            </View>
          ) : (
            <>
              {/* Hero Status Banner */}
              <View
                style={{
                  backgroundColor: "#34594A",
                  borderRadius: 20,
                  padding: 18,
                  marginBottom: 16,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {/* Background Icon */}
                <View className="absolute -right-4 -bottom-4 opacity-15">
                  <Ionicons
                    name="shield-checkmark"
                    size={130}
                    color="#FFFFFF"
                  />
                </View>

                <View className="flex-row items-center gap-2 mb-2">
                  <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
                    <Ionicons
                      name="shield-checkmark"
                      size={18}
                      color="#A7F3D0"
                    />
                  </View>
                  <Text className="text-xs uppercase tracking-wider font-bold text-green-200">
                    Official Grower Registry
                  </Text>
                </View>

                <Text className="text-xl font-extrabold text-white leading-tight mb-1">
                  Department of Agriculture RSBSA
                </Text>
                <Text className="text-xs text-gray-200 leading-5 pr-6">
                  Earn the official green verified checkmark badge and gain
                  immediate buyer trust across the Local Farm network.
                </Text>
              </View>

              {/* Real-World Guidance Box */}
              <View
                style={{
                  backgroundColor: "#F4F7F3",
                  borderWidth: 1,
                  borderColor: "#E5ECE6",
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 18,
                }}
              >
                <View className="flex-row items-center gap-2 mb-1.5">
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color="#34594A"
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 0.8,
                      color: "#34594A",
                      textTransform: "uppercase",
                    }}
                  >
                    Where to apply in real life?
                  </Text>
                </View>
                <Text style={{ fontSize: 12, lineHeight: 18, color: "#607267" }}>
                  Visit your local{" "}
                  <Text style={{ fontWeight: "700", color: "#293E33" }}>
                    Municipal Agriculture Office (MAO)
                  </Text>{" "}
                  or{" "}
                  <Text style={{ fontWeight: "700", color: "#293E33" }}>
                    City Agriculture Office (CAO)
                  </Text>{" "}
                  at your municipal or city hall. Enrollment with the Department
                  of Agriculture is{" "}
                  <Text style={{ fontWeight: "700", color: "#34594A" }}>100% FREE</Text>
                  .
                </Text>
              </View>

              {/* STATE 1: ALREADY VERIFIED */}
              {rsbsaApp.status === "verified" && (
                <View className="bg-white rounded-2xl border border-emerald-200 p-5 mb-5 shadow-xs items-center">
                  <View className="w-16 h-16 bg-emerald-100 rounded-full items-center justify-center mb-3">
                    <Ionicons
                      name="checkmark-circle"
                      size={42}
                      color="#059669"
                    />
                  </View>
                  <Text className="text-xl font-extrabold text-gray-900 mb-1 text-center">
                    You Are a Verified Local Grower!
                  </Text>
                  <Text className="text-xs text-gray-500 text-center mb-4 leading-5 px-2">
                    Your account has active RSBSA credentials. Your verified
                    badge is displayed on your posts, profile, and direct order
                    chats.
                  </Text>

                  {/* Credentials Card */}
                  <View className="w-full bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100 space-y-2.5">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-gray-500">
                        RSBSA Number:
                      </Text>
                      <Text className="text-xs font-bold text-gray-900">
                        {rsbsaApp.rsbsaNumber}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-gray-500">
                        Farmer Name:
                      </Text>
                      <Text className="text-xs font-semibold text-gray-800">
                        {rsbsaApp.fullName}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-gray-500">
                        Farm Location:
                      </Text>
                      <Text className="text-xs font-semibold text-gray-800">
                        {rsbsaApp.location}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-gray-500">
                        Verified Since:
                      </Text>
                      <Text className="text-xs font-semibold text-emerald-700">
                        {rsbsaApp.verifiedAt || "September 2026"}
                      </Text>
                    </View>
                  </View>

                  {/* Attached Document Preview */}
                  {rsbsaApp.documentUri && (
                    <View className="w-full mb-4">
                      <Text className="text-xs font-bold text-gray-500 mb-2">
                        Attached Document:
                      </Text>
                      <Image
                        source={{ uri: rsbsaApp.documentUri }}
                        className="w-full h-44 rounded-xl bg-gray-100"
                        resizeMode="cover"
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={handleReset}
                    className="py-2.5 px-4"
                  >
                    <Text className="text-xs text-gray-400 font-medium">
                      Reset &amp; Submit New RSBSA Number
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STATE 2: UNDER REVIEW */}
              {rsbsaApp.status === "pending" && (
                <View className="bg-white rounded-2xl border border-amber-200 p-5 mb-5 shadow-xs items-center">
                  <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center mb-3">
                    <Ionicons name="time" size={38} color="#D97706" />
                  </View>
                  <Text className="text-xl font-bold text-gray-900 mb-1 text-center">
                    Application Under Review
                  </Text>
                  <Text className="text-xs text-gray-500 text-center mb-4 leading-5 px-2">
                    We received your submission for Reference No.{" "}
                    <Text className="font-bold text-gray-900">
                      {rsbsaApp.rsbsaNumber}
                    </Text>
                    . Our municipal agricultural coordinator is reviewing your
                    record.
                  </Text>

                  <View className="w-full bg-amber-50/60 rounded-xl p-4 mb-4 border border-amber-100 space-y-2">
                    <Text className="text-xs text-amber-900 font-bold">
                      Submission Details:
                    </Text>
                    <Text className="text-xs text-amber-800">
                      • Grower: {rsbsaApp.fullName}
                    </Text>
                    <Text className="text-xs text-amber-800">
                      • Farm: {rsbsaApp.farmName} ({rsbsaApp.location})
                    </Text>
                    <Text className="text-xs text-amber-800">
                      • Primary Crops: {rsbsaApp.crops || "Not specified"}
                    </Text>
                    <Text className="text-xs text-amber-800">
                      • Submitted Date: {rsbsaApp.submittedAt || "Just now"}
                    </Text>
                  </View>

                  {/* Demo Helper to Simulate Approval */}
                  <TouchableOpacity
                    onPress={handleSimulateApproval}
                    activeOpacity={0.8}
                    className="w-full bg-[#72AF5B] py-3.5 rounded-xl items-center justify-center mb-2 active:bg-[#62974e]"
                  >
                    <Text className="text-sm font-bold text-white">
                      [Demo Mode] Simulate Admin Approval ✓
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleReset} className="py-2 px-4">
                    <Text className="text-xs text-gray-400 font-medium">
                      Cancel &amp; Edit Application
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STATE 3: APPLICATION FORM (UNVERIFIED) */}
              {rsbsaApp.status === "unverified" && (
                <View className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <Text className="text-lg font-bold text-gray-900 mb-1">
                    Grower Verification Form
                  </Text>
                  <Text className="text-xs text-gray-500 mb-5 leading-4">
                    Please provide accurate details matching your official DA
                    records.
                  </Text>

                  {/* Field 1: Full Legal Name */}
                  <View className="mb-5">
                    <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                      Farmer Full Legal Name *
                    </Text>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="e.g., Juan Santos Dela Cruz"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-900"
                    />
                    <Text className="text-[11px] text-gray-400 mt-2">
                      Must match the name on your RSBSA stub and government ID.
                    </Text>
                  </View>

                  {/* Field 2: RSBSA Reference Number */}
                  <View className="mb-5">
                    <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                      RSBSA Reference Number *
                    </Text>
                    <TextInput
                      value={rsbsaNumber}
                      onChangeText={setRsbsaNumber}
                      placeholder="e.g., 10-22-01-001-000456"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-900"
                    />
                    <Text className="text-[11px] text-gray-400 mt-2">
                      Your unique number issued by the DA / MAO.
                    </Text>
                  </View>

                  {/* Field 3: Farm Name */}
                  <View className="mb-5">
                    <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                      Farm Name / Brand *
                    </Text>
                    <TextInput
                      value={farmName}
                      onChangeText={setFarmName}
                      placeholder="e.g., Green Valley Organic Farm"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-900"
                    />
                  </View>

                  {/* Field 4: Farm Location */}
                  <View className="mb-5">
                    <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                      Farm Location (Barangay &amp; City) *
                    </Text>
                    <TextInput
                      value={location}
                      onChangeText={setLocation}
                      placeholder="e.g., Brgy. Hinaplanon, Iligan City"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-900"
                    />
                  </View>

                  {/* Field 5: Primary Crops */}
                  <View className="mb-5">
                    <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                      Primary Crops Grown
                    </Text>
                    <TextInput
                      value={crops}
                      onChangeText={setCrops}
                      placeholder="e.g., Tomatoes, Lettuce, Durian, Mangoes, Rice"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-900"
                    />
                  </View>

                  {/* Field 6: Certificate Photo Upload */}
                  <View className="mb-6">
                    <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                      Attach Photo of RSBSA Certificate or Stub
                    </Text>
                    <TouchableOpacity
                      onPress={handlePickDocument}
                      activeOpacity={0.8}
                      className="border-2 border-dashed border-gray-200 rounded-2xl p-5 items-center justify-center bg-gray-50"
                    >
                      {documentUri ? (
                        <View className="items-center">
                          <Image
                            source={{ uri: documentUri }}
                            className="w-40 h-40 rounded-xl mb-2.5"
                            resizeMode="cover"
                          />
                          <Text className="text-xs font-bold text-[#72AF5B]">
                            Change Attached Photo
                          </Text>
                        </View>
                      ) : (
                        <View className="items-center py-3">
                          <Ionicons
                            name="cloud-upload-outline"
                            size={36}
                            color="#9CA3AF"
                          />
                          <Text className="text-sm font-bold text-gray-700 mt-1.5">
                            Upload RSBSA Certificate Photo
                          </Text>
                          <Text className="text-xs text-gray-400 mt-0.5">
                            JPEG or PNG photo of your official stub
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                    style={{
                      width: "100%",
                      backgroundColor: "#34594A",
                      paddingVertical: 14,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
                      {isSubmitting
                        ? "Submitting Application..."
                        : "Submit RSBSA Verification"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

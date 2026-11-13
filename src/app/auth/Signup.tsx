import { useToast } from "@/context/toast-context";
import { sendSignupOtpApi } from "@/services/auth-service";
import {
  validateConfirmPassword,
  validateEmail,
  validateGender,
  validateName,
  validatePassword,
  validatePhoneNumber,
  validateUsername,
} from "@/utils/validation";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG_IMAGE = require("../../../assets/images/background-blur.png");
const LF3_IMAGE = require("../../../assets/images/LF3.png");
const LOGO2_IMAGE = require("../../../assets/images/logo2.png");

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

export default function SignUpScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState("");
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [phoneNumberError, setPhoneNumberError] = useState("");
  const [genderError, setGenderError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const handleSignUp = async () => {
    let firstError = "";

    const fnVal = validateName(firstName, "First name");
    if (!fnVal.isValid) {
      setFirstNameError(fnVal.error || "");
      if (!firstError) firstError = fnVal.error || "";
    } else {
      setFirstNameError("");
    }

    const lnVal = validateName(lastName, "Last name");
    if (!lnVal.isValid) {
      setLastNameError(lnVal.error || "");
      if (!firstError) firstError = lnVal.error || "";
    } else {
      setLastNameError("");
    }

    const unVal = validateUsername(username);
    if (!unVal.isValid) {
      setUsernameError(unVal.error || "");
      if (!firstError) firstError = unVal.error || "";
    } else {
      setUsernameError("");
    }

    const phoneVal = validatePhoneNumber(phoneNumber);
    if (!phoneVal.isValid) {
      setPhoneNumberError(phoneVal.error || "");
      if (!firstError) firstError = phoneVal.error || "";
    } else {
      setPhoneNumberError("");
    }

    const genVal = validateGender(gender);
    if (!genVal.isValid) {
      setGenderError(genVal.error || "");
      if (!firstError) firstError = genVal.error || "";
    } else {
      setGenderError("");
    }

    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      setEmailError(emailVal.error || "");
      if (!firstError) firstError = emailVal.error || "";
    } else {
      setEmailError("");
    }

    const passVal = validatePassword(password);
    if (!passVal.isValid) {
      setPasswordError(passVal.error || "");
      if (!firstError) firstError = passVal.error || "";
    } else {
      setPasswordError("");
    }

    const confirmVal = validateConfirmPassword(password, confirmPassword);
    if (!confirmVal.isValid) {
      setConfirmPasswordError(confirmVal.error || "");
      if (!firstError) firstError = confirmVal.error || "";
    } else {
      setConfirmPasswordError("");
    }

    if (firstError) {
      showToast(firstError, "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      // Send verification OTP to the user's email
      await sendSignupOtpApi({
        email: email.trim(),
        username: username.trim(),
      });

      showToast("Verification code sent to your email!", "success");

      router.push({
        pathname: "/auth/Otp",
        params: {
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          phoneNumber: phoneNumber.trim(),
          gender,
          password,
        },
      });
    } catch (err: any) {
      const msg =
        err?.message || "Failed to send verification code. Please try again.";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ImageBackground
      source={BG_IMAGE}
      className="flex-1"
      resizeMode="cover"
      style={{ flex: 1, overflow: "hidden" }}
    >
      {/* Top Banner Header: Logo in the top-left corner */}
      <View
        className="w-full px-5 z-20"
        style={{ paddingTop: Math.max(insets.top + 8, 16) }}
      >
        <Image
          source={LF3_IMAGE}
          className="w-[135px] h-[40px]"
          style={{ width: 135, height: 40 }}
          resizeMode="contain"
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center items-center px-5"
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom + 24, 32),
          }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode="never"
          alwaysBounceHorizontal={false}
          alwaysBounceVertical={false}
          directionalLockEnabled={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Form Wrapper */}
          <View className="w-full max-w-[380px]">
            {/* Header Block: Left-Aligned */}
            <View className="items-start mb-5 w-full">
              <Text className="text-3xl font-extrabold text-neutral-900 tracking-tight mb-1 text-left">
                Join Us
              </Text>
              <Text className="text-sm font-medium text-neutral-500 text-left">
                Create an account to get started
              </Text>
            </View>

            {/* 2-Column Grid: First Name & Last Name */}
            <View className="w-full flex-row gap-2.5 mb-3">
              {/* First Name */}
              <View className="flex-1">
                <RNTextInput
                  className={`w-full h-[48px] bg-white/95 border ${
                    firstNameError
                      ? "border-[#FF3B30] bg-[#FFF8F8]"
                      : "border-gray-200"
                  } rounded-2xl px-3.5 text-[15px] text-gray-900 shadow-sm`}
                  placeholder="First Name"
                  placeholderTextColor="#9CA3AF"
                  value={firstName}
                  onChangeText={(text: string) => {
                    setFirstName(text);
                    if (firstNameError) setFirstNameError("");
                  }}
                />
                {firstNameError ? (
                  <Text className="text-[#FF3B30] text-xs mt-1 ml-1 font-medium">
                    {firstNameError}
                  </Text>
                ) : null}
              </View>

              {/* Last Name */}
              <View className="flex-1">
                <RNTextInput
                  className={`w-full h-[48px] bg-white/95 border ${
                    lastNameError
                      ? "border-[#FF3B30] bg-[#FFF8F8]"
                      : "border-gray-200"
                  } rounded-2xl px-3.5 text-[15px] text-gray-900 shadow-sm`}
                  placeholder="Last Name"
                  placeholderTextColor="#9CA3AF"
                  value={lastName}
                  onChangeText={(text: string) => {
                    setLastName(text);
                    if (lastNameError) setLastNameError("");
                  }}
                />
                {lastNameError ? (
                  <Text className="text-[#FF3B30] text-xs mt-1 ml-1 font-medium">
                    {lastNameError}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Username Field */}
            <View className="w-full mb-3">
              <RNTextInput
                className={`w-full h-[48px] bg-white/95 border ${
                  usernameError
                    ? "border-[#FF3B30] bg-[#FFF8F8]"
                    : "border-gray-200"
                } rounded-2xl px-3.5 text-[15px] text-gray-900 shadow-sm`}
                placeholder="Username"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={(text: string) => {
                  setUsername(text);
                  if (usernameError) setUsernameError("");
                }}
                autoCapitalize="none"
              />
              {usernameError ? (
                <Text className="text-[#FF3B30] text-xs mt-1 ml-1 font-medium">
                  {usernameError}
                </Text>
              ) : null}
            </View>

            {/* Phone Number Field */}
            <View className="w-full mb-3">
              <RNTextInput
                className={`w-full h-[48px] bg-white/95 border ${
                  phoneNumberError
                    ? "border-[#FF3B30] bg-[#FFF8F8]"
                    : "border-gray-200"
                } rounded-2xl px-3.5 text-[15px] text-gray-900 shadow-sm`}
                placeholder="Phone Number"
                placeholderTextColor="#9CA3AF"
                value={phoneNumber}
                onChangeText={(text: string) => {
                  setPhoneNumber(text);
                  if (phoneNumberError) setPhoneNumberError("");
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              {phoneNumberError ? (
                <Text className="text-[#FF3B30] text-xs mt-1 ml-1 font-medium">
                  {phoneNumberError}
                </Text>
              ) : null}
            </View>

            {/* Gender Dropdown Field */}
            <View className="w-full mb-3 z-30 relative">
              <TouchableOpacity
                className={`w-full h-[48px] bg-white/95 border ${
                  genderError
                    ? "border-[#FF3B30] bg-[#FFF8F8]"
                    : "border-gray-200"
                } rounded-2xl px-3.5 flex-row items-center justify-between shadow-sm`}
                onPress={() => setShowGenderDropdown((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Text
                  className={`text-[15px] ${
                    gender ? "text-gray-900 font-medium" : "text-[#9CA3AF]"
                  }`}
                  numberOfLines={1}
                >
                  {gender || "Select Gender"}
                </Text>
                <Ionicons
                  name={
                    showGenderDropdown
                      ? "chevron-up-outline"
                      : "chevron-down-outline"
                  }
                  size={18}
                  color="#72AF5B"
                />
              </TouchableOpacity>

              {/* Dropdown Options */}
              {showGenderDropdown ? (
                <View className="absolute top-[54px] left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  {GENDER_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      className="px-4 py-3 border-b border-gray-100 active:bg-gray-50 flex-row items-center justify-between"
                      onPress={() => {
                        setGender(option);
                        setShowGenderDropdown(false);
                        if (genderError) setGenderError("");
                      }}
                    >
                      <Text className="text-sm text-gray-800 font-medium">
                        {option}
                      </Text>
                      {gender === option ? (
                        <Ionicons
                          name="checkmark-outline"
                          size={18}
                          color="#72AF5B"
                        />
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {genderError ? (
                <Text className="text-[#FF3B30] text-xs mt-1 ml-1 font-medium">
                  {genderError}
                </Text>
              ) : null}
            </View>

            {/* Email Field */}
            <View className="w-full mb-3 z-10">
              <RNTextInput
                className={`w-full h-[48px] bg-white/95 border ${
                  emailError
                    ? "border-[#FF3B30] bg-[#FFF8F8]"
                    : "border-gray-200"
                } rounded-2xl px-3.5 text-[15px] text-gray-900 shadow-sm`}
                placeholder="Email address"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={(text: string) => {
                  setEmail(text);
                  if (emailError) setEmailError("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {emailError ? (
                <Text className="text-[#FF3B30] text-xs mt-1 ml-1 font-medium">
                  {emailError}
                </Text>
              ) : null}
            </View>

            {/* Password Field */}
            <View className="w-full mb-3 z-10">
              <View className="w-full relative justify-center">
                <RNTextInput
                  className={`w-full h-[48px] bg-white/95 border ${
                    passwordError
                      ? "border-[#FF3B30] bg-[#FFF8F8]"
                      : "border-gray-200"
                  } rounded-2xl pl-3.5 pr-12 text-[15px] text-gray-900 shadow-sm`}
                  placeholder="Create a password (min. 6 chars)"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text: string) => {
                    setPassword(text);
                    if (passwordError) setPasswordError("");
                  }}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  className="absolute right-0 top-0 bottom-0 px-3.5 justify-center items-center"
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#848484"
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <Text className="text-[#FF3B30] text-xs mt-1 ml-1 font-medium">
                  {passwordError}
                </Text>
              ) : null}
            </View>

            {/* Confirm Password Field */}
            <View className="w-full mb-5 z-10">
              <View className="w-full relative justify-center">
                <RNTextInput
                  className={`w-full h-[48px] bg-white/95 border ${
                    confirmPasswordError
                      ? "border-[#FF3B30] bg-[#FFF8F8]"
                      : "border-gray-200"
                  } rounded-2xl pl-3.5 pr-12 text-[15px] text-gray-900 shadow-sm`}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(text: string) => {
                    setConfirmPassword(text);
                    if (confirmPasswordError) setConfirmPasswordError("");
                  }}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  className="absolute right-0 top-0 bottom-0 px-3.5 justify-center items-center"
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-off-outline" : "eye-outline"
                    }
                    size={20}
                    color="#848484"
                  />
                </TouchableOpacity>
              </View>
              {confirmPasswordError ? (
                <Text className="text-[#FF3B30] text-xs mt-1 ml-1 font-medium">
                  {confirmPasswordError}
                </Text>
              ) : null}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              className={`w-full h-[52px] ${
                isSubmitting ? "bg-[#72AF5B]/80" : "bg-[#72AF5B]"
              } rounded-2xl items-center justify-center shadow-md shadow-[#72AF5B]/30 active:opacity-90 mb-2 flex-row gap-2`}
              onPress={handleSignUp}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : null}
              <Text className="text-white text-base font-bold tracking-wide">
                {isSubmitting ? "Sending OTP..." : "Sign Up"}
              </Text>
            </TouchableOpacity>

            {/* Footer */}
            <View className="flex-row justify-center items-center mt-4 mb-2 w-full">
              <Text className="text-md text-neutral-600">
                Already have an account?{" "}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/auth/Login" as any)}
                activeOpacity={0.7}
                className="py-1"
              >
                <Text className="text-md font-bold text-[#72AF5B]">
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

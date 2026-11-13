import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="Login" />
      <Stack.Screen name="Signup" />
      <Stack.Screen name="ForgotPassword" />
      <Stack.Screen name="Otp" />
      <Stack.Screen name="VerifyOtp" />
      <Stack.Screen name="ResetPassword" />
    </Stack>
  );
}

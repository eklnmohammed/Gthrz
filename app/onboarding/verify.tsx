import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../../src/components/Screen";
import { AppButton } from "../../src/components/AppButton";
import { StackScreenTopBar } from "../../src/components/StackScreenTopBar";
import { useKeyboardInset } from "../../src/hooks/useKeyboardInset";
import { onboardingStore } from "../../src/state/onboardingStore";
import { Ionicons } from "@expo/vector-icons";
import { verifyOtp, sendOtp, setDevMode, setDevPhone, syncCurrentProfileFromServer } from "../../src/lib/auth";
import { areSamePhone } from "../../src/utils/phone";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = (params.phone ?? "").trim();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const inputRef = useRef<TextInput>(null);
  const keyboardInset = useKeyboardInset();

  // Auto-focus the hidden input
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (!phone) {
      Alert.alert("Session expired", "Please enter your phone number again.", [
        { text: "OK", onPress: () => router.replace("/onboarding/phone") },
      ]);
    }
  }, [phone]);

  const handleVerify = async () => {
    if (!phone) return;
    if (code.length < CODE_LENGTH) return;
    setLoading(true);
    setError(null);

    const result = await verifyOtp(phone, code);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Auth succeeded. Save phone locally and sync profile from server (server wins).
    await onboardingStore.savePhone(phone);
    await syncCurrentProfileFromServer();

    const p = await onboardingStore.getProfile();
    if (areSamePhone(p?.phone, phone) && (p?.firstName || p?.avatarUri)) {
      await onboardingStore.setOnboarded(true);
      router.replace("/");
    } else {
      const localProfile = await onboardingStore.getProfileForPhone(phone);
      if (localProfile) {
        await onboardingStore.saveProfile({ ...localProfile, phone });
        await onboardingStore.setOnboarded(true);
        router.replace("/");
      } else {
        router.replace("/onboarding/profile");
      }
    }

    setLoading(false);
  };

  const handleResend = async () => {
    if (!phone) return;
    if (resendTimer > 0) return;
    setResendTimer(RESEND_COOLDOWN);
    const result = await sendOtp(phone);
    if (result.error) {
      Alert.alert("Error", result.error);
    } else {
      Alert.alert("Code sent", "A new code has been sent to your phone.");
    }
  };

  const handleDemoSkip = async () => {
    if (!phone) return;
    setLoading(true);
    await setDevMode(true);
    await setDevPhone(phone);
    await onboardingStore.savePhone(phone);
    await syncCurrentProfileFromServer();

    const p = await onboardingStore.getProfile();
    if (areSamePhone(p?.phone, phone) && (p?.firstName || p?.avatarUri)) {
      await onboardingStore.setOnboarded(true);
      setLoading(false);
      router.replace("/");
      return;
    }

    const localProfile = await onboardingStore.getProfileForPhone(phone);
    if (localProfile) {
      await onboardingStore.saveProfile({ ...localProfile, phone });
      await onboardingStore.setOnboarded(true);
      setLoading(false);
      router.replace("/");
      return;
    }

    setLoading(false);
    router.replace("/onboarding/profile");
  };

  // Masked phone display
  const maskedPhone =
    phone.length > 4
      ? phone.slice(0, phone.length - 4).replace(/\d/g, "*") + phone.slice(-4)
      : phone;

  return (
    <Screen padding={false} topPadding={0}>
      <Stack.Screen options={{ headerShown: false }} />
      <StackScreenTopBar title="" onBack={() => router.back()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingVertical: spacing.xxxxl,
          paddingHorizontal: spacing.xxl,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: spacing.xxl + keyboardInset,
        }}
      >
        {/* Icon */}
        <LinearGradient
          colors={[...colors.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.xxl,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: spacing.xxl,
          }}
        >
          <Ionicons name="phone-portrait-outline" size={36} color="#fff" />
        </LinearGradient>

        <Text
          style={{
            fontSize: typography.sizes.xxl,
            fontWeight: typography.weights.bold,
            color: colors.text,
            textAlign: "center",
            marginBottom: spacing.sm,
          }}
        >
          Verify your number
        </Text>
        <Text
          style={{
            fontSize: typography.sizes.md,
            color: colors.textMuted,
            textAlign: "center",
            lineHeight: 22,
            marginBottom: spacing.xxl,
          }}
        >
          Enter the 6-digit code sent to {maskedPhone}
        </Text>

        {/* Hidden input + visual code boxes */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={{ width: "100%", maxWidth: 340, marginBottom: spacing.lg }}
        >
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
              setCode(digits);
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            style={{ position: "absolute", opacity: 0, height: 0 }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: 44,
                  height: 54,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceLight,
                  borderWidth: 1.5,
                  borderColor:
                    i === code.length
                      ? colors.primary
                      : code[i]
                        ? colors.border
                        : colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: typography.sizes.xl,
                    fontWeight: typography.weights.bold,
                    color: colors.text,
                  }}
                >
                  {code[i] ?? ""}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>

        {/* Error */}
        {error && (
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: colors.error,
              textAlign: "center",
              marginBottom: spacing.lg,
            }}
          >
            {error}
          </Text>
        )}

        {/* Verify button */}
        <View style={{ width: "100%", maxWidth: 340, marginBottom: spacing.xl }}>
          <AppButton
            title={loading ? "Verifying..." : "Verify"}
            onPress={handleVerify}
            variant="coral"
            size="lg"
            fullWidth
            disabled={code.length < CODE_LENGTH || loading}
          />
        </View>

        {/* Resend */}
        <Pressable
          onPress={handleResend}
          disabled={resendTimer > 0}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: resendTimer > 0 ? colors.textDim : colors.primary,
              fontWeight: typography.weights.medium,
            }}
          >
            {resendTimer > 0
              ? `Resend code in ${resendTimer}s`
              : "Resend code"}
          </Text>
        </Pressable>

        {/* Demo bypass — visible skip for prototype testing */}
        <Pressable
          onPress={handleDemoSkip}
          disabled={loading}
          style={({ pressed }) => ({
            marginTop: spacing.xl,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed || loading ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: colors.textMuted,
              fontWeight: typography.weights.medium,
            }}
          >
            Skip OTP — demo mode
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

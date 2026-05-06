import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../../src/components/Screen";
import { AppButton } from "../../src/components/AppButton";
import { StackScreenTopBar } from "../../src/components/StackScreenTopBar";
import { useKeyboardInset } from "../../src/hooks/useKeyboardInset";
import { onboardingStore } from "../../src/state/onboardingStore";
import { Ionicons } from "@expo/vector-icons";
import { sendOtp } from "../../src/lib/auth";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";

interface Country {
  flag: string;
  code: string;
  name: string;
}

const COUNTRIES: Country[] = [
  { flag: "🇬🇧", code: "+44", name: "United Kingdom" },
  { flag: "🇺🇸", code: "+1", name: "United States" },
  { flag: "🇨🇦", code: "+1", name: "Canada" },
  { flag: "🇸🇦", code: "+966", name: "Saudi Arabia" },
  { flag: "🇦🇪", code: "+971", name: "United Arab Emirates" },
  { flag: "🇪🇬", code: "+20", name: "Egypt" },
];

export default function PhoneLoginScreen() {
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const keyboardInset = useKeyboardInset();

  // Validate: at least 10 digits for US/Canada, else at least 8
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  const minLength = selectedCountry.code === "+1" ? 10 : 8;
  const isValid = digitsOnly.length >= minLength;

  const handleSendCode = async () => {
    if (!isValid) return;
    setLoading(true);

    const fullPhone = `${selectedCountry.code}${digitsOnly}`;

    // Real OTP mode: attempt to send code, then navigate regardless.
    // If OTP send fails the verify screen has a visible demo bypass.
    await sendOtp(fullPhone);
    await onboardingStore.savePhone(fullPhone);
    setLoading(false);

    router.push({
      pathname: "/onboarding/verify",
      params: { phone: fullPhone },
    });
  };

  return (
    <Screen padding={false} topPadding={0}>
      <Stack.Screen options={{ headerShown: false }} />
      <StackScreenTopBar title="" onBack={() => router.back()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingVertical: spacing.xxxxl,
          paddingHorizontal: spacing.xxl,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: spacing.xxxxl + keyboardInset,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Centered hero: gradient icon + title + subtitle */}
        <View style={{ alignItems: "center", marginBottom: spacing.xxxxl }}>
          <View style={{ marginBottom: spacing.xxl }}>
            <LinearGradient
              colors={[...colors.coralGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 80,
                height: 80,
                borderRadius: radius.xxl,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="call-outline" size={36} color="#fff" />
            </LinearGradient>
          </View>
          <Text
            style={{
              fontSize: typography.sizes.xxl,
              fontWeight: typography.weights.bold,
              color: colors.text,
              textAlign: "center",
              marginBottom: spacing.sm,
            }}
          >
            Enter your number
          </Text>
          <Text
            style={{
              fontSize: typography.sizes.md,
              color: colors.textMuted,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            Used to continue to verification.
          </Text>
        </View>

        {/* Phone input card - full width, styled like the theme */}
        <View style={{ width: "100%", maxWidth: 400, gap: spacing.sm, marginBottom: spacing.xxl }}>
          <Text
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.medium,
              color: colors.textMuted,
            }}
          >
            Phone number
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceLight,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.lg,
              paddingLeft: spacing.lg,
              paddingRight: spacing.sm,
              overflow: "hidden",
            }}
          >
            <Pressable
              onPress={() => setShowCountryPicker(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginRight: spacing.md,
                paddingRight: spacing.md,
                borderRightWidth: 1,
                borderRightColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 20, marginRight: spacing.sm }}>
                {selectedCountry.flag}
              </Text>
              <Text
                style={{
                  fontSize: typography.sizes.md,
                  color: colors.text,
                  fontWeight: typography.weights.medium,
                }}
              >
                {selectedCountry.code}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textMuted,
                  marginLeft: spacing.xs,
                }}
              >
                ▼
              </Text>
            </Pressable>
            <TextInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Your number"
              placeholderTextColor={colors.textDim}
              keyboardType="phone-pad"
              style={{
                flex: 1,
                fontSize: typography.sizes.md,
                color: colors.text,
                paddingVertical: 0,
                paddingHorizontal: spacing.sm,
                letterSpacing: 0,
              }}
            />
          </View>
        </View>

        {/* Send code button */}
        <View style={{ width: "100%", maxWidth: 400 }}>
          <AppButton
            title={loading ? "Please wait…" : "Continue"}
            onPress={handleSendCode}
            variant="coral"
            size="lg"
            fullWidth
            disabled={!isValid || loading}
          />
        </View>

      </ScrollView>
      </KeyboardAvoidingView>

      {/* Country picker modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: "flex-end",
          }}
          onPress={() => setShowCountryPicker(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: spacing.xxxxl,
              maxHeight: "60%",
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                padding: spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.semibold,
                  color: colors.text,
                }}
              >
                Select country
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {COUNTRIES.map((country) => (
                <Pressable
                  key={country.code + country.name}
                  onPress={() => {
                    setSelectedCountry(country);
                    setShowCountryPicker(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.lg,
                    backgroundColor:
                      selectedCountry.name === country.name
                        ? colors.surfaceLight
                        : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: spacing.md }}>
                    {country.flag}
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.sizes.md,
                      color: colors.text,
                      flex: 1,
                    }}
                  >
                    {country.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.sizes.md,
                      color: colors.textMuted,
                    }}
                  >
                    {country.code}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

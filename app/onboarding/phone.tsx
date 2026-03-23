import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../../src/components/Screen";
import { AppButton } from "../../src/components/AppButton";
import { onboardingStore } from "../../src/state/onboardingStore";
import { isDevMode, setDevMode, setDevPhone, sendOtp, syncCurrentProfileFromServer } from "../../src/lib/auth";
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
  const params = useLocalSearchParams<{ mode?: string }>();
  const isLogin = params.mode === "login";

  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devModeOn, setDevModeOn] = useState(false);
  const [showDevSheet, setShowDevSheet] = useState(false);

  const showDevLink = __DEV__ || process.env.EXPO_PUBLIC_DEV_MENU === "true";

  // Validate: at least 10 digits for US/Canada, else at least 8
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  const minLength = selectedCountry.code === "+1" ? 10 : 8;
  const isValid = digitsOnly.length >= minLength;

  useEffect(() => {
    isDevMode().then(setDevModeOn);
  }, []);

  /** Dev flow: set dev identity, save phone, sync from server, navigate. */
  const continueInDevMode = async (fullPhone: string) => {
    await setDevPhone(fullPhone);
    await onboardingStore.savePhone(fullPhone);
    await syncCurrentProfileFromServer();

    const p = await onboardingStore.getProfile();
    if (p?.firstName || p?.avatarUri) {
      await onboardingStore.setOnboarded(true);
      setLoading(false);
      router.replace("/");
      return;
    }

    const localProfile = await onboardingStore.getProfileForPhone(fullPhone);
    if (localProfile) {
      await onboardingStore.saveProfile({ ...localProfile, phone: fullPhone });
      await onboardingStore.setOnboarded(true);
      setLoading(false);
      router.replace("/");
      return;
    }

    setLoading(false);
    if (isLogin) {
      Alert.alert(
        "No account found",
        "Get started by creating your profile.",
        [{ text: "Get started", onPress: () => router.push("/onboarding/profile") }]
      );
    } else {
      router.push("/onboarding/profile");
    }
  };

  const handleSendCode = async () => {
    if (!isValid) return;
    setLoading(true);
    setError(null);

    const fullPhone = `${selectedCountry.code}${phoneNumber}`;

    const devMode = await isDevMode();

    if (devMode) {
      await continueInDevMode(fullPhone);
      return;
    }

    // Real OTP mode: send code via Supabase Auth
    const result = await sendOtp(fullPhone);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Save phone for the verify screen
    await onboardingStore.savePhone(fullPhone);

    // Navigate to OTP verification
    router.push({
      pathname: "/onboarding/verify",
      params: { phone: fullPhone },
    });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingVertical: spacing.xxxxl,
          paddingHorizontal: spacing.xxl,
          alignItems: "center",
          justifyContent: "center",
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Centered hero: gradient icon + title + subtitle */}
        <View style={{ alignItems: "center", marginBottom: spacing.xxxxl }}>
          <Pressable
            onLongPress={() => {
              if (!showDevLink) setShowDevSheet(true);
            }}
            delayLongPress={2000}
            style={{ marginBottom: spacing.xxl }}
          >
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
              <Text style={{ fontSize: 40 }}>🥳</Text>
            </LinearGradient>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
            <Text
              style={{
                fontSize: typography.sizes.xxl,
                fontWeight: typography.weights.bold,
                color: colors.text,
                textAlign: "center",
              }}
            >
              Ready to host?
            </Text>
            {devModeOn && (
              <Text
                style={{
                  fontSize: typography.sizes.xs,
                  color: colors.textDim,
                  fontWeight: typography.weights.medium,
                  letterSpacing: 0.5,
                }}
              >
                DEV
              </Text>
            )}
          </View>
          <Text
            style={{
              fontSize: typography.sizes.md,
              color: colors.textMuted,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            Your number stays private. Event invites only.
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
          <Text
            style={{
              fontSize: typography.sizes.xs,
              color: colors.textDim,
              textAlign: "center",
            }}
          >
            Message & data rates may apply.
          </Text>
        </View>

        {/* Consent - centered */}
        <Text
          style={{
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            lineHeight: 18,
            textAlign: "center",
            marginBottom: spacing.xxl,
            paddingHorizontal: spacing.lg,
          }}
        >
          By tapping Send code, you consent to receive text messages from us or
          event hosts. Text HELP for help, STOP to cancel.
        </Text>

        {/* Error message */}
        {error && (
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: colors.error,
              textAlign: "center",
              marginBottom: spacing.md,
            }}
          >
            {error}
          </Text>
        )}

        {/* Send code button */}
        <View style={{ width: "100%", maxWidth: 400 }}>
          <AppButton
            title={loading ? "Sending..." : "Send code"}
            onPress={handleSendCode}
            variant="coral"
            size="lg"
            fullWidth
            disabled={!isValid || loading}
          />
        </View>

        {/* Dev options link (dev builds only; production: long-press logo 2s) */}
        {showDevLink && (
          <Pressable
            onPress={() => setShowDevSheet(true)}
            style={{ marginTop: spacing.lg }}
          >
            <Text
              style={{
                fontSize: typography.sizes.xs,
                color: colors.textDim,
              }}
            >
              Dev options
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Developer options bottom sheet */}
      <Modal
        visible={showDevSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDevSheet(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: "flex-end",
          }}
          onPress={() => setShowDevSheet(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: spacing.xxxxl,
              paddingHorizontal: spacing.lg,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                paddingVertical: spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                marginBottom: spacing.lg,
              }}
            >
              <Text
                style={{
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.semibold,
                  color: colors.text,
                }}
              >
                Developer options
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.sm,
              }}
            >
              <Text
                style={{
                  fontSize: typography.sizes.md,
                  color: colors.text,
                  fontWeight: typography.weights.medium,
                }}
              >
                Skip OTP
              </Text>
              <Switch
                value={devModeOn}
                onValueChange={async (v) => {
                  await setDevMode(v);
                  setDevModeOn(v);
                }}
                trackColor={{ false: colors.border, true: colors.coral }}
                thumbColor={colors.surface}
              />
            </View>
            <Text
              style={{
                fontSize: typography.sizes.xs,
                color: colors.textMuted,
                marginBottom: spacing.xl,
              }}
            >
              Bypass SMS OTP on this device.
            </Text>
            <AppButton
              title="Done"
              onPress={() => setShowDevSheet(false)}
              variant="secondary"
              size="md"
              fullWidth
            />
          </Pressable>
        </Pressable>
      </Modal>

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

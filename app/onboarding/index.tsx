import { View, Text } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../../src/components/Screen";
import { AppButton } from "../../src/components/AppButton";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";

export default function WelcomeScreen() {
  return (
    <Screen>
      <View
        style={{
          flex: 1,
          justifyContent: "space-between",
          paddingVertical: spacing.xxxxl,
        }}
      >
        {/* Logo and branding */}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          {/* Logo with gradient border */}
          <LinearGradient
            colors={[...colors.primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 100,
              height: 100,
              borderRadius: radius.xl,
              padding: 3,
              marginBottom: spacing.xxl,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: radius.xl - 2,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: typography.sizes.display,
                  fontWeight: typography.weights.bold,
                  color: colors.text,
                }}
              >
                G
              </Text>
            </View>
          </LinearGradient>

          {/* Brand name */}
          <Text
            style={{
              fontSize: typography.sizes.display,
              fontWeight: typography.weights.bold,
              color: colors.text,
              marginBottom: spacing.md,
            }}
          >
            Gthrz
          </Text>

          {/* Tagline */}
          <Text
            style={{
              fontSize: typography.sizes.md,
              color: colors.textMuted,
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            Social gatherings, simplified.{"\n"}The new way to host and hang.
          </Text>
        </View>

        {/* Get started and Log in buttons */}
        <View style={{ gap: spacing.md }}>
          <AppButton
            title="Get started"
            onPress={() => router.push("/onboarding/value-props")}
            variant="primary"
            size="lg"
            fullWidth
          />

          <AppButton
            title="Log in"
            onPress={() => router.push({ pathname: "/onboarding/phone", params: { mode: "login" } })}
            variant="ghost"
            size="lg"
            fullWidth
          />

          <Text
            style={{
              fontSize: typography.sizes.xs,
              color: colors.textDim,
              textAlign: "center",
            }}
          >
            #GTHRZ
          </Text>
        </View>
      </View>
    </Screen>
  );
}

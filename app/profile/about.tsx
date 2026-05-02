import { View, Text } from "react-native";
import { router, Stack } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { StackScreenTopBar } from "../../src/components/StackScreenTopBar";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";

export default function AboutScreen() {
  return (
    <Screen padding={false} topPadding={0}>
      <Stack.Screen options={{ headerShown: false }} />
      <StackScreenTopBar title="About" onBack={() => router.back()} />

      <View
        style={{
          marginTop: spacing.xl,
          marginHorizontal: spacing.xxl,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 0.5,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.lg,
        }}
      >
        <Text
          style={{
            fontSize: typography.sizes.xxl,
            fontWeight: typography.weights.bold,
            color: colors.text,
            letterSpacing: -0.3,
          }}
        >
          Gthrz
        </Text>

        <Text
          style={{
            fontSize: typography.sizes.md,
            color: colors.textMuted,
            lineHeight: 22,
          }}
        >
          Plan events on your terms. Gthrz is built for hosts who want more control over privacy, guest access, and event setup.
        </Text>

        <View
          style={{
            borderTopWidth: 0.5,
            borderTopColor: colors.border,
            paddingTop: spacing.md,
            gap: spacing.xs,
          }}
        >
          <Text style={{ fontSize: typography.sizes.sm, color: colors.textDim }}>
            Built with React Native, Expo, and Supabase.
          </Text>
          <Text style={{ fontSize: typography.sizes.sm, color: colors.textDim }}>
            Final-year project prototype, 2026.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

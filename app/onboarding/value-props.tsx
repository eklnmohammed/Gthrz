import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../../src/components";
import { AppButton } from "../../src/components/AppButton";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";

interface ValueProp {
  icon: string;
  gradient: readonly [string, string, ...string[]];
  title: string;
  description: string;
}

const VALUE_PROPS: ValueProp[] = [
  {
    icon: "✨",
    gradient: colors.primaryGradient,
    title: "Beautiful invites",
    description:
      "Create a polished event page for any occasion — from an istiraha night to an engagement dinner.",
  },
  {
    icon: "📋",
    gradient: colors.coralGradient,
    title: "Easy guest management",
    description:
      "Approve guests, set a capacity, and always know who's coming before the night starts.",
  },
  {
    icon: "🎉",
    gradient: ["#11998E", "#38EF7D"] as const,
    title: "Host with confidence",
    description:
      "Share invite links, collect RSVPs, and keep your guest list exactly as you planned.",
  },
];

export default function ValuePropsScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleContinue = () => {
    if (currentIndex < VALUE_PROPS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.push("/onboarding/phone");
    }
  };

  const currentProp = VALUE_PROPS[currentIndex];

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          paddingVertical: spacing.xxl,
        }}
      >
        {/* Main content block - centered slightly above middle */}
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingBottom: spacing.xxl,
          }}
        >
          {/* Value prop card (no floating G logo) */}
          <View style={{ alignItems: "center", paddingHorizontal: spacing.lg }}>
            {/* Gradient icon container */}
            <LinearGradient
              colors={[...currentProp.gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 100,
                height: 100,
                borderRadius: radius.xxl,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.xxl,
              }}
            >
              <Text style={{ fontSize: 48 }}>{currentProp.icon}</Text>
            </LinearGradient>

            {/* Title */}
            <Text
              style={{
                fontSize: typography.sizes.xxl,
                fontWeight: typography.weights.bold,
                color: colors.text,
                textAlign: "center",
                marginBottom: spacing.lg,
              }}
            >
              {currentProp.title}
            </Text>

            {/* Description */}
            <Text
              style={{
                fontSize: typography.sizes.md,
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 24,
                marginBottom: spacing.xxl,
              }}
            >
              {currentProp.description}
            </Text>
          </View>
        </View>

        {/* Bottom section - dots + Continue (Screen handles safe area) */}
        <View
          style={{
            gap: spacing.md,
            paddingBottom: spacing.lg,
            alignItems: "center",
          }}
        >
          {/* Pagination dots - uniform circles, no pill */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            {VALUE_PROPS.map((_, index) => (
              <Pressable key={index} onPress={() => setCurrentIndex(index)}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      index === currentIndex
                        ? colors.primary
                        : colors.surfaceLight,
                  }}
                />
              </Pressable>
            ))}
          </View>

          {/* Continue button - same styling as phone Send code */}
          <View style={{ width: "100%", maxWidth: 400 }}>
            <AppButton
              title="Continue"
              onPress={handleContinue}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

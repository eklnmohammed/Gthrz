import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { EVENT_FORM_HERO_PADDING_H } from "./eventFormTokens";

/** Lifecycle of the Smart Planner card on the Create Event screen. */
export type SmartPlannerCardState = "idle" | "generating" | "ready" | "error";

const COPY: Record<SmartPlannerCardState, { description: string; action: string }> = {
  idle: {
    description: "Describe your event and Smart Planner prepares the first draft.",
    action: "Generate Event Plan",
  },
  generating: {
    description: "Preparing your first draft…",
    action: "Generating…",
  },
  ready: {
    description: "Draft ready. Review and edit anything before creating the event.",
    action: "Generate again",
  },
  error: {
    description: "Smart Planner couldn't prepare a draft.",
    action: "Try again",
  },
};

/**
 * Smart Planner entry point on the Create Event screen.
 * Opens the prompt modal; the host still reviews every generated value.
 */
export function EventFormSmartPlannerCard({
  onPress,
  state = "idle",
}: {
  onPress: () => void;
  state?: SmartPlannerCardState;
}) {
  const { description, action } = COPY[state];
  const isGenerating = state === "generating";
  const accent = state === "error" ? colors.error : colors.primary;

  return (
    <View
      style={{
        marginHorizontal: EVENT_FORM_HERO_PADDING_H,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: state === "error" ? "rgba(255,71,87,0.35)" : "rgba(123,104,238,0.35)",
        shadowColor: accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      }}
    >
      <LinearGradient
        colors={
          state === "error"
            ? ["rgba(255,71,87,0.10)", "transparent"]
            : ["rgba(123,104,238,0.14)", "transparent"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={{ fontSize: typography.sizes.md }}>✨</Text>
          <Text
            style={{
              fontSize: typography.sizes.md,
              fontWeight: typography.weights.semibold,
              color: colors.text,
            }}
          >
            Smart Planner
          </Text>
        </View>

        <Text
          style={{
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            lineHeight: typography.lineHeightPx.normal,
          }}
        >
          {description}
        </Text>

        <Pressable
          onPress={onPress}
          disabled={isGenerating}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            height: spacing.buttonHeightMd,
            borderRadius: radius.md,
            backgroundColor: isGenerating
              ? colors.surfaceLight
              : pressed
                ? colors.primaryDark
                : colors.primary,
            borderWidth: 0.5,
            borderColor: isGenerating ? colors.border : colors.primary,
          })}
        >
          {isGenerating ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          <Text
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.semibold,
              color: isGenerating ? colors.textMuted : colors.text,
            }}
          >
            {action}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

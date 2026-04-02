import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { EVENT_FORM_HERO_PADDING_H } from "./eventFormTokens";

/**
 * Shared section shell for event Create/Edit: uppercase title bar + padded body.
 * Single place to change card spacing and borders for both flows.
 */
export function EventFormSectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View
      style={{
        marginHorizontal: EVENT_FORM_HERO_PADDING_H,
        marginBottom: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={{
            fontSize: typography.sizes.xs,
            fontWeight: typography.weights.semibold,
            color: colors.textMuted,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          {title}
        </Text>
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>{children}</View>
    </View>
  );
}

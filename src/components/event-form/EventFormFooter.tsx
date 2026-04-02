import type { ReactNode } from "react";
import { View } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { EVENT_FORM_HERO_PADDING_H } from "./eventFormTokens";

/** Sticky bottom bar shell — same border, padding, and background for Create + Edit CTAs. */
export function EventFormFooter({ bottomInset, children }: { bottomInset: number; children: ReactNode }) {
  return (
    <View
      style={{
        paddingHorizontal: EVENT_FORM_HERO_PADDING_H,
        paddingTop: spacing.lg,
        paddingBottom: bottomInset,
        backgroundColor: colors.background,
        borderTopWidth: 0.5,
        borderTopColor: colors.border,
      }}
    >
      {children}
    </View>
  );
}

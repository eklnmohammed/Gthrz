import type { ReactNode } from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderBackTextButton } from "./HeaderBackTextButton";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

/**
 * In-screen top bar aligned with event detail top controls (see app/events/[id].tsx):
 * safe-area top + `spacing.sm`, horizontal `spacing.xxl`, row min height 44.
 */
export const STACK_TOP_BAR_GAP_BELOW_SAFE = spacing.sm;
export const STACK_TOP_BAR_INSET_H = spacing.xxl;
export const STACK_TOP_BAR_ROW_MIN_HEIGHT = 44;

export type StackScreenTopBarProps = {
  title: string;
  onBack: () => void;
  backLabel?: string;
  right?: ReactNode;
};

export function StackScreenTopBar({ title, onBack, backLabel = "Back", right }: StackScreenTopBarProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + STACK_TOP_BAR_GAP_BELOW_SAFE;

  return (
    <View
      pointerEvents="box-none"
      style={{
        backgroundColor: colors.background,
        paddingTop,
        paddingHorizontal: STACK_TOP_BAR_INSET_H,
        paddingBottom: spacing.sm,
      }}
    >
      <View style={{ minHeight: STACK_TOP_BAR_ROW_MIN_HEIGHT, justifyContent: "center" }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.xxxl,
          }}
        >
          <Text
            style={{
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.semibold,
              color: colors.text,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <View
          pointerEvents="box-none"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: STACK_TOP_BAR_ROW_MIN_HEIGHT,
          }}
        >
          <HeaderBackTextButton label={backLabel} onPress={onBack} applyScreenEdgeInset={false} />
          <View style={{ flexShrink: 0, alignItems: "flex-end", justifyContent: "center" }}>
            {right != null ? right : <View style={{ minWidth: 1 }} />}
          </View>
        </View>
      </View>
    </View>
  );
}

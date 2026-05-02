import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

/**
 * Single-layer pill back button: chevron + label.
 * No border, shadow, or elevation. Pressed state = opacity only.
 * Wrapped with horizontal inset so the control stays inside screen bounds on edge-to-edge layouts.
 */
export function HeaderBackTextButton({
  label = "Back",
  onPress,
  /** When false, skip outer inset (e.g. event detail overlay already pads with safe area). Default true. */
  applyScreenEdgeInset = true,
}: {
  label?: string;
  onPress: () => void;
  applyScreenEdgeInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const padLeft = applyScreenEdgeInset ? Math.max(insets.left, spacing.xxl) : 0;

  return (
    <View collapsable={false} style={{ marginLeft: padLeft }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.surfaceLight,
          borderRadius: radius.full,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          overflow: "hidden",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.normal,
            color: colors.text,
          }}
        >
          ‹
        </Text>
        <Text
          style={{
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.normal,
            color: colors.text,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

/**
 * Single-layer pill header button for Stack headerRight/headerLeft.
 * No border, shadow, or elevation. Pressed state = opacity only.
 * Wrapped with horizontal inset so the control stays inside screen bounds on edge-to-edge layouts.
 */
export function HeaderTextButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const padRight = Math.max(insets.right, spacing.xxl);

  return (
    <View collapsable={false} style={{ marginRight: padRight }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: colors.surfaceLight,
          borderRadius: radius.full,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          overflow: "hidden",
          justifyContent: "center",
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
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

import { Pressable, Text } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

/**
 * Single-layer pill back button: chevron + label.
 * No border, shadow, or elevation. Pressed state = opacity only.
 */
export function HeaderBackTextButton({
  label = "Back",
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  return (
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
  );
}

import { Pressable, Text } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

/**
 * Single-layer pill header button for Stack headerRight/headerLeft.
 * No border, shadow, or elevation. Pressed state = opacity only.
 */
export function HeaderTextButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
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
  );
}

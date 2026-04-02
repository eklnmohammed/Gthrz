import { Text } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { typography } from "@/src/theme/typography";

export function EventFormEssentialsHeading() {
  return (
    <Text
      style={{
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.semibold,
        color: colors.textMuted,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        marginBottom: spacing.lg,
      }}
    >
      Essentials
    </Text>
  );
}

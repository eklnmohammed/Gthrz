import { View, Text } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

interface BadgeProps {
  label: string;
  variant?: "default" | "primary" | "secondary" | "coral" | "mint";
}

export function Badge({ label, variant = "default" }: BadgeProps) {
  const getStyles = () => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: colors.primary + "30",
          textColor: colors.primaryLight,
        };
      case "coral":
        return {
          backgroundColor: colors.coral + "30",
          textColor: colors.coralLight,
        };
      case "mint":
        return {
          backgroundColor: colors.mint + "30",
          textColor: colors.mintLight,
        };
      case "secondary":
        return {
          backgroundColor: colors.surfaceLight,
          textColor: colors.textMuted,
        };
      default:
        return {
          backgroundColor: colors.surfaceLight,
          textColor: colors.textMuted,
        };
    }
  };

  const styles = getStyles();

  return (
    <View
      style={{
        backgroundColor: styles.backgroundColor,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
      }}
    >
      <Text
        style={{
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          color: styles.textColor,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

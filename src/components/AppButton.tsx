import { Pressable, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "coral";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function AppButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = false,
  style,
}: AppButtonProps) {
  const getHeight = () => {
    switch (size) {
      case "sm":
        return spacing.buttonHeightSm;
      case "lg":
        return spacing.buttonHeightLg;
      default:
        return spacing.buttonHeightMd;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "sm":
        return typography.sizes.sm;
      case "lg":
        return typography.sizes.lg;
      default:
        return typography.sizes.md;
    }
  };

  const baseStyle: ViewStyle = {
    height: getHeight(),
    borderRadius: radius.full,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    ...(fullWidth && { width: "100%" }),
  };

  const textColor = disabled
    ? (variant === "primary" || variant === "coral" ? colors.textMuted : colors.textDim)
    : variant === "ghost"
    ? colors.primary
    : colors.text;

  // For gradient buttons (primary, coral) when not disabled
  if ((variant === "primary" || variant === "coral") && !disabled) {
    const gradientColors =
      variant === "coral" ? colors.coralGradient : colors.primaryGradient;

    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          { opacity: pressed ? 0.85 : 1 },
          fullWidth && { width: "100%" },
          style,
        ]}
      >
        <LinearGradient
          colors={[...gradientColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={baseStyle}
        >
          <Text
            style={{
              color: textColor,
              fontSize: getFontSize(),
              fontWeight: typography.weights.semibold,
            }}
          >
            {title}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }

  // For secondary, ghost, or disabled buttons (including disabled primary/coral)
  const backgroundColor = disabled
    ? colors.surfaceLight
    : variant === "secondary"
    ? colors.surfaceLight
    : "transparent";

  const borderStyle =
    variant === "ghost"
      ? { borderWidth: 1, borderColor: colors.border }
      : (variant === "primary" || variant === "coral") && disabled
      ? { borderWidth: 1, borderColor: colors.primaryLight20 }
      : {};

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        baseStyle,
        { backgroundColor, opacity: pressed ? 0.85 : 1 },
        borderStyle,
        style,
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontSize: getFontSize(),
          fontWeight: typography.weights.semibold,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

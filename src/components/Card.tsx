import { Pressable, View, ViewStyle } from "react-native";
import { ReactNode } from "react";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: "default" | "highlight";
  style?: ViewStyle;
}

export function Card({
  children,
  onPress,
  variant = "default",
  style,
}: CardProps) {
  const backgroundColor =
    variant === "highlight" ? colors.surfaceLighter : colors.surface;
  const borderColor =
    variant === "highlight" ? colors.primary : colors.border;

  const content = (
    <View
      style={[
        {
          backgroundColor,
          padding: spacing.lg,
          borderRadius: radius.lg,
          gap: spacing.md,
          borderWidth: 1,
          borderColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

import { View, Text, Pressable } from "react-native";
import { colors } from "../theme/colors";
import { radius } from "../theme/radius";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

interface HomeSectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function HomeSectionHeader({ title, action }: HomeSectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.lg,
      }}
    >
      <Text
        style={{
          fontSize: typography.sizes.lg,
          fontWeight: typography.weights.bold,
          color: colors.text,
          letterSpacing: -0.2,
        }}
      >
        {title}
      </Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          style={({ pressed }) => ({
            backgroundColor: colors.surfaceLight,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.medium,
              color: colors.text,
            }}
          >
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

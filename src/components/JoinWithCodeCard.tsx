import { View, Text, Pressable } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { radius } from "../theme/radius";

export interface JoinWithCodeCardProps {
  onPress: () => void;
  /** Optional subtitle; default: "Have an invite code?" */
  subtitle?: string;
}

export function JoinWithCodeCard({ onPress, subtitle = "Have an invite code?" }: JoinWithCodeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceLight,
        borderRadius: radius.lg,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontSize: typography.sizes.xl, color: colors.textMuted, marginRight: spacing.md }}>
        ➕
      </Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: typography.sizes.md,
            fontWeight: typography.weights.semibold,
            color: colors.text,
          }}
        >
          Join with code
        </Text>
        <Text
          style={{
            fontSize: typography.sizes.xs,
            color: colors.textMuted,
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <Text style={{ fontSize: typography.sizes.lg, color: colors.textMuted }}>›</Text>
    </Pressable>
  );
}

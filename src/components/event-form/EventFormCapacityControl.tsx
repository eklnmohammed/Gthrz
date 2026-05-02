import { View, Text, Pressable } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { getEventCapacityFormErrorMessage } from "@/src/utils/capacityInput";

type EventFormCapacityControlProps = {
  mode: "unlimited" | "set";
  value: string;
  onSelectUnlimited: () => void;
  onOpenSheet: () => void;
  showValidationError?: boolean;
};

export function EventFormCapacityControl({
  mode,
  value,
  onSelectUnlimited,
  onOpenSheet,
  showValidationError,
}: EventFormCapacityControlProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
        Capacity
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          onPress={onSelectUnlimited}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: mode === "unlimited" ? colors.primary : colors.surfaceLight,
            borderWidth: 0.5,
            borderColor: mode === "unlimited" ? colors.primary : colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: mode === "unlimited" ? colors.text : colors.textMuted }}>
            Unlimited
          </Text>
        </Pressable>
        <Pressable
          onPress={onOpenSheet}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: mode === "set" ? colors.primary : colors.surfaceLight,
            borderWidth: 0.5,
            borderColor: mode === "set" ? colors.primary : colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: mode === "set" ? colors.text : colors.textMuted }}>
            {mode === "set" && value !== "" ? `${value} guests` : "Set limit"}
          </Text>
        </Pressable>
      </View>
      {mode === "set" && value !== "" && (
        <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
          Max {value} guests
        </Text>
      )}
      {showValidationError && (
        <Text style={{ fontSize: typography.sizes.xs, color: colors.error, marginTop: 2 }}>
          {getEventCapacityFormErrorMessage(value) ?? "Enter a whole number from 1 to 999."}
        </Text>
      )}
    </View>
  );
}

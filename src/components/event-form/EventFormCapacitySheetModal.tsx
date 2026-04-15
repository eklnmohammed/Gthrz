import { View, Text, Pressable } from "react-native";
import { AppInput } from "@/src/components/AppInput";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { isValidPositiveWholeCapacityString } from "@/src/utils/capacityInput";
import { EventFormBottomSheet } from "./EventFormBottomSheet";

type EventFormCapacitySheetModalProps = {
  visible: boolean;
  onClose: () => void;
  keyboardInset: number;
  bottomSafeInset: number;
  capacitySheetTemp: string;
  onCapacitySheetTempChange: (value: string) => void;
  onApply: (trimmedValue: string) => void;
};

export function EventFormCapacitySheetModal({
  visible,
  onClose,
  keyboardInset,
  bottomSafeInset,
  capacitySheetTemp,
  onCapacitySheetTempChange,
  onApply,
}: EventFormCapacitySheetModalProps) {
  const v = capacitySheetTemp.trim();
  const capacityApplyValid = isValidPositiveWholeCapacityString(capacitySheetTemp);

  return (
    <EventFormBottomSheet
      visible={visible}
      onRequestClose={onClose}
      keyboardInset={keyboardInset}
      bottomSafeInset={bottomSafeInset}
    >
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text }}>
          Guest limit
        </Text>
        <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim }}>
          Choose a preset or enter a custom number
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "center" }}>
        {[10, 20, 50, 100].map((n) => {
          const val = String(n);
          const selected = capacitySheetTemp === val;
          return (
            <Pressable
              key={n}
              onPress={() => onCapacitySheetTempChange(val)}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                backgroundColor: selected ? colors.primary : colors.surfaceLight,
                borderWidth: 0.5,
                borderColor: selected ? colors.primary : colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <AppInput
        label="Custom number"
        value={capacitySheetTemp}
        onChangeText={(t) => onCapacitySheetTempChange(t.replace(/\D/g, "").slice(0, 5))}
        placeholder="e.g. 75"
        keyboardType="numeric"
      />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceLight,
            borderWidth: 0.5,
            borderColor: colors.border,
            alignItems: "center",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textMuted }}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (capacityApplyValid) {
              onApply(v);
            }
          }}
          disabled={!capacityApplyValid}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: capacityApplyValid ? colors.primary : colors.surfaceLight,
            alignItems: "center",
            opacity: pressed && capacityApplyValid ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: capacityApplyValid ? colors.text : colors.textMuted }}>
            Apply
          </Text>
        </Pressable>
      </View>
    </EventFormBottomSheet>
  );
}

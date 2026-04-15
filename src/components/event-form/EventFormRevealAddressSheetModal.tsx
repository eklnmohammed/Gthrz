import { View, Text, Pressable } from "react-native";
import { AppInput } from "@/src/components/AppInput";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { EventFormBottomSheet } from "./EventFormBottomSheet";

type EventFormRevealAddressSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  keyboardInset: number;
  bottomSafeInset: number;
  revealSheetTemp: number;
  onRevealSheetTempChange: (hours: number) => void;
  revealSheetCustom: string;
  onRevealSheetCustomChange: (value: string) => void;
  onApply: (hours: number) => void;
};

export function EventFormRevealAddressSheetModal({
  visible,
  onClose,
  keyboardInset,
  bottomSafeInset,
  revealSheetTemp,
  onRevealSheetTempChange,
  revealSheetCustom,
  onRevealSheetCustomChange,
  onApply,
}: EventFormRevealAddressSheetModalProps) {
  return (
    <EventFormBottomSheet
      visible={visible}
      onRequestClose={onClose}
      keyboardInset={keyboardInset}
      bottomSafeInset={bottomSafeInset}
    >
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text }}>
          When to reveal address
        </Text>
        <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim }}>
          Hours before the event starts
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "center" }}>
        {([1, 2, 5, 24] as const).map((hours) => {
          const selected = revealSheetCustom === "" && revealSheetTemp === hours;
          return (
            <Pressable
              key={hours}
              onPress={() => {
                onRevealSheetTempChange(hours);
                onRevealSheetCustomChange("");
              }}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                backgroundColor: selected ? colors.primary : colors.surfaceLight,
                borderWidth: 0.5,
                borderColor: selected ? colors.primary : colors.border,
                alignItems: "center",
                gap: 2,
              }}
            >
              <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                {hours}
              </Text>
              <Text style={{ fontSize: 10, color: selected ? "rgba(255,255,255,0.65)" : colors.textDim }}>
                hours
              </Text>
            </Pressable>
          );
        })}
      </View>
      <AppInput
        label="Custom hours"
        value={revealSheetCustom}
        onChangeText={(t) => {
          onRevealSheetCustomChange(t.replace(/\D/g, "").slice(0, 3));
          const n = parseInt(t.replace(/\D/g, ""), 10);
          if (!Number.isNaN(n) && n >= 1) onRevealSheetTempChange(n);
        }}
        placeholder="e.g. 12"
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
            const hours = revealSheetCustom.trim() ? parseInt(revealSheetCustom, 10) : revealSheetTemp;
            if (hours >= 1) {
              onApply(hours);
            }
          }}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            alignItems: "center",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>
            Apply
          </Text>
        </Pressable>
      </View>
    </EventFormBottomSheet>
  );
}

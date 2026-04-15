import { View, Text, Pressable } from "react-native";
import { AppInput } from "@/src/components/AppInput";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { EVENT_FORM_DRESS_CODE_CUSTOM, EVENT_FORM_DRESS_CODE_PRESETS } from "./eventFormDressCode";
import { EventFormBottomSheet } from "./EventFormBottomSheet";

type EventFormDressCodeSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  keyboardInset: number;
  bottomSafeInset: number;
  dressCodeSheetTemp: string;
  onDressCodeSheetTempChange: (value: string) => void;
  dressCodeSheetCustom: string;
  onDressCodeSheetCustomChange: (value: string) => void;
  onApply: (preset: string, customTrimmed: string) => void;
};

export function EventFormDressCodeSheetModal({
  visible,
  onClose,
  keyboardInset,
  bottomSafeInset,
  dressCodeSheetTemp,
  onDressCodeSheetTempChange,
  dressCodeSheetCustom,
  onDressCodeSheetCustomChange,
  onApply,
}: EventFormDressCodeSheetModalProps) {
  const applyValid =
    dressCodeSheetTemp !== "" &&
    (dressCodeSheetTemp !== EVENT_FORM_DRESS_CODE_CUSTOM || dressCodeSheetCustom.trim() !== "");

  return (
    <EventFormBottomSheet
      visible={visible}
      onRequestClose={onClose}
      keyboardInset={keyboardInset}
      bottomSafeInset={bottomSafeInset}
    >
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text }}>
          Dress code
        </Text>
        <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim }}>
          Choose a preset or enter a custom style
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" }}>
        {EVENT_FORM_DRESS_CODE_PRESETS.filter((p) => p !== EVENT_FORM_DRESS_CODE_CUSTOM).map((preset) => {
          const selected = dressCodeSheetTemp === preset;
          return (
            <Pressable
              key={preset}
              onPress={() => {
                onDressCodeSheetTempChange(preset);
                onDressCodeSheetCustomChange("");
              }}
              style={{
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.md,
                backgroundColor: selected ? colors.primary : colors.surfaceLight,
                borderWidth: 0.5,
                borderColor: selected ? colors.primary : colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                {preset}
              </Text>
            </Pressable>
          );
        })}
        {(() => {
          const selected = dressCodeSheetTemp === EVENT_FORM_DRESS_CODE_CUSTOM;
          return (
            <Pressable
              onPress={() => onDressCodeSheetTempChange(EVENT_FORM_DRESS_CODE_CUSTOM)}
              style={{
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.md,
                backgroundColor: selected ? colors.primary : colors.surfaceLight,
                borderWidth: 0.5,
                borderColor: selected ? colors.primary : colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                {EVENT_FORM_DRESS_CODE_CUSTOM}
              </Text>
            </Pressable>
          );
        })()}
      </View>
      {dressCodeSheetTemp === EVENT_FORM_DRESS_CODE_CUSTOM && (
        <AppInput
          placeholder="e.g. Thobe, Abaya, All black"
          value={dressCodeSheetCustom}
          onChangeText={onDressCodeSheetCustomChange}
          maxLength={60}
        />
      )}
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
            if (applyValid) {
              onApply(
                dressCodeSheetTemp,
                dressCodeSheetTemp === EVENT_FORM_DRESS_CODE_CUSTOM ? dressCodeSheetCustom.trim() : "",
              );
            }
          }}
          disabled={!applyValid}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: applyValid ? colors.primary : colors.surfaceLight,
            alignItems: "center",
            opacity: pressed && applyValid ? 0.9 : 1,
          })}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: applyValid ? colors.text : colors.textMuted }}>
            Apply
          </Text>
        </Pressable>
      </View>
    </EventFormBottomSheet>
  );
}

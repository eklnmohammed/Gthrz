import { View, Text, Pressable, TextInput } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { EventFormBottomSheet } from "./EventFormBottomSheet";

/** Upper bound for the Smart Planner prompt. */
export const SMART_PLANNER_PROMPT_MAX_LENGTH = 300;

type EventFormSmartPlannerModalProps = {
  visible: boolean;
  onClose: () => void;
  keyboardInset: number;
  bottomSafeInset: number;
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: (trimmedPrompt: string) => void;
};

export function EventFormSmartPlannerModal({
  visible,
  onClose,
  keyboardInset,
  bottomSafeInset,
  prompt,
  onPromptChange,
  onGenerate,
}: EventFormSmartPlannerModalProps) {
  const trimmed = prompt.trim();
  const canGenerate = trimmed.length > 0;

  return (
    <EventFormBottomSheet
      visible={visible}
      onRequestClose={onClose}
      keyboardInset={keyboardInset}
      bottomSafeInset={bottomSafeInset}
      extraBottomPadding={spacing.md}
    >
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text
          style={{
            fontSize: typography.sizes.md,
            fontWeight: typography.weights.semibold,
            color: colors.text,
          }}
        >
          Smart Planner
        </Text>
        <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, textAlign: "center" }}>
          Describe your event and Smart Planner prepares the first draft.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <TextInput
          value={prompt}
          onChangeText={onPromptChange}
          placeholder="e.g. Birthday party for 20 friends. Pizza and games. Indoor. Budget 1,200 SAR."
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={SMART_PLANNER_PROMPT_MAX_LENGTH}
          style={{
            backgroundColor: colors.surfaceLight,
            borderRadius: radius.md,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.lg,
            fontSize: typography.sizes.md,
            color: colors.text,
            minHeight: 140,
            textAlignVertical: "top",
            borderWidth: 0.5,
            borderColor: colors.border,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
          <Text style={{ flex: 1, fontSize: typography.sizes.xs, color: colors.textDim }}>
            The more details you provide, the better Smart Planner can personalize your event plan.
          </Text>
          <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim }}>
            {prompt.length} / {SMART_PLANNER_PROMPT_MAX_LENGTH}
          </Text>
        </View>
      </View>

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
          <Text
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.semibold,
              color: colors.textMuted,
            }}
          >
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (canGenerate) onGenerate(trimmed);
          }}
          disabled={!canGenerate}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: canGenerate ? colors.primary : colors.surfaceLight,
            alignItems: "center",
            opacity: pressed && canGenerate ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.semibold,
              color: canGenerate ? colors.text : colors.textMuted,
            }}
          >
            Generate Event Plan
          </Text>
        </Pressable>
      </View>
    </EventFormBottomSheet>
  );
}

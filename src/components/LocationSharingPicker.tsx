import {
  View,
  Text,
  Pressable,
  TextInput,
} from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

/** Preset options for "reveal later"; custom handled via Other + input. */
const REVEAL_PRESETS = [2, 12, 24] as const;

function formatRevealLabel(hours: number): string {
  if (hours === 24) return "24h";
  return `${hours}h`;
}

export interface LocationSharingPickerProps {
  visibility: "now" | "reveal";
  revealHoursBefore: number | null;
  onChange: (visibility: "now" | "reveal", revealHoursBefore: number | null) => void;
  /** Label on the left of the row; default "Location sharing". Omit for parent-provided heading. */
  rowLabel?: string;
}

/**
 * Simplified: Show now | Reveal later. When Reveal later, show compact timing:
 * small preset row (2h, 12h, 24h) + Other; only show number input when Other is selected.
 */
export function LocationSharingPicker({
  visibility,
  revealHoursBefore,
  onChange,
  rowLabel = "Location sharing",
}: LocationSharingPickerProps) {
  const isReveal = visibility === "reveal";
  const isPreset =
    isReveal &&
    revealHoursBefore != null &&
    revealHoursBefore > 0 &&
    (REVEAL_PRESETS as readonly number[]).includes(revealHoursBefore);
  const isOther = isReveal && (revealHoursBefore == null || revealHoursBefore < 1 || !(REVEAL_PRESETS as readonly number[]).includes(revealHoursBefore));

  const chipStyle = (selected: boolean) => ({
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: selected ? colors.primary : colors.surfaceLight,
    borderWidth: 0.5,
    borderColor: selected ? colors.primary : colors.border,
  } as const);

  const chipTextStyle = (selected: boolean) => ({
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: selected ? colors.text : colors.textMuted,
  } as const);

  const handleOtherInput = (text: string) => {
    const num = parseInt(text.trim(), 10);
    if (!Number.isNaN(num) && num >= 1) {
      onChange("reveal", num);
    } else if (text.trim() === "") {
      onChange("reveal", -1);
    }
  };

  const otherDisplayValue =
    isOther && revealHoursBefore != null && revealHoursBefore > 0
      ? String(revealHoursBefore)
      : "";

  return (
    <View style={{ gap: spacing.sm }}>
      {rowLabel ? (
        <Text
          style={{
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.medium,
            color: colors.textMuted,
          }}
        >
          {rowLabel}
        </Text>
      ) : null}

      {/* Step 1: Show now | Reveal later only */}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          onPress={() => onChange("now", null)}
          style={{ flex: 1, ...chipStyle(visibility === "now"), alignItems: "center" }}
        >
          <Text style={chipTextStyle(visibility === "now")}>Show now</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange("reveal", revealHoursBefore ?? 24)}
          style={{ flex: 1, ...chipStyle(visibility === "reveal"), alignItems: "center" }}
        >
          <Text style={chipTextStyle(visibility === "reveal")}>Reveal later</Text>
        </Pressable>
      </View>

      {/* Step 2: Timing — only when Reveal later; compact presets + Other, input only when Other */}
      {isReveal && (
        <View style={{ gap: spacing.xs }}>
          <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim }}>
            When to reveal
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
            {REVEAL_PRESETS.map((hours) => {
              const selected = revealHoursBefore === hours;
              return (
                <Pressable
                  key={hours}
                  onPress={() => onChange("reveal", hours)}
                  style={chipStyle(selected)}
                >
                  <Text style={chipTextStyle(selected)}>{formatRevealLabel(hours)} before</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                const isCustom = revealHoursBefore != null && revealHoursBefore > 0 && !(REVEAL_PRESETS as readonly number[]).includes(revealHoursBefore);
                onChange("reveal", isCustom ? revealHoursBefore : -1);
              }}
              style={chipStyle(isOther)}
            >
              <Text style={chipTextStyle(isOther)}>Other</Text>
            </Pressable>
          </View>
          {isOther && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surfaceLight,
                borderRadius: radius.md,
                borderWidth: 0.5,
                borderColor: colors.border,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                gap: spacing.sm,
              }}
            >
              <TextInput
                placeholder="Hours before (e.g. 6)"
                placeholderTextColor={colors.textDim}
                value={otherDisplayValue}
                onChangeText={handleOtherInput}
                keyboardType="number-pad"
                style={{
                  flex: 1,
                  fontSize: typography.sizes.sm,
                  color: colors.text,
                }}
              />
              <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted }}>
                hours before
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

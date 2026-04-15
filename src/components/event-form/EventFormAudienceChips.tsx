import { View, Text, Pressable } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";

const AUDIENCE_OPTIONS = ["Men only", "Mixed", "Women only"] as const;
export type AudienceOption = (typeof AUDIENCE_OPTIONS)[number] | "";

type EventFormAudienceChipsProps = {
  /** Stored as plain string on Create/Edit screens; must be one of the options or "". */
  value: string;
  onChange: (value: string) => void;
};

export function EventFormAudienceChips({ value, onChange }: EventFormAudienceChipsProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
        Guest type
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {AUDIENCE_OPTIONS.map((opt) => {
          const selected = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(selected ? "" : opt)}
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
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

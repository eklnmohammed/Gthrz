import { View, Text, Pressable } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";

export type ToggleOption<T extends string> = {
  value: T;
  label: string;
};

type EventFormTogglePairProps<T extends string> = {
  label: string;
  options: [ToggleOption<T>, ToggleOption<T>];
  value: T;
  onChange: (value: T) => void;
  helperText?: string | ((value: T) => string);
};

export function EventFormTogglePair<T extends string>({
  label,
  options,
  value,
  onChange,
  helperText,
}: EventFormTogglePairProps<T>) {
  const helper = typeof helperText === "function" ? helperText(value) : helperText;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{
                flex: 1,
                backgroundColor: selected ? colors.primary : colors.surfaceLight,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                alignItems: "center",
                borderWidth: 0.5,
                borderColor: selected ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: selected ? colors.text : colors.textMuted }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {helper ? (
        <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

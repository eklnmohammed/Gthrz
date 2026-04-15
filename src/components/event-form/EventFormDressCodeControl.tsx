import { View, Text, Pressable } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";

type EventFormDressCodeControlProps = {
  dressCode: string;
  dressCodeValue: string;
  onClear: () => void;
  onOpenSheet: () => void;
};

export function EventFormDressCodeControl({
  dressCode,
  dressCodeValue,
  onClear,
  onOpenSheet,
}: EventFormDressCodeControlProps) {
  const hasValue = dressCode !== "";

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
        Dress code
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          onPress={onClear}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: !hasValue ? colors.primary : colors.surfaceLight,
            borderWidth: 0.5,
            borderColor: !hasValue ? colors.primary : colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: !hasValue ? colors.text : colors.textMuted }}>
            None
          </Text>
        </Pressable>
        <Pressable
          onPress={onOpenSheet}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: hasValue ? colors.primary : colors.surfaceLight,
            borderWidth: 0.5,
            borderColor: hasValue ? colors.primary : colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: hasValue ? colors.text : colors.textMuted }} numberOfLines={1}>
            {dressCodeValue !== "" ? dressCodeValue : "Set dress code"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

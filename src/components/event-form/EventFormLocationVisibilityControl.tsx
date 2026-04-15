import { View, Text, Pressable } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";

type EventFormLocationVisibilityControlProps = {
  visibility: "now" | "reveal";
  revealHoursBefore: number | null;
  onSelectNow: () => void;
  onOpenSheet: () => void;
};

export function EventFormLocationVisibilityControl({
  visibility,
  revealHoursBefore,
  onSelectNow,
  onOpenSheet,
}: EventFormLocationVisibilityControlProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
        When do guests see the address?
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Pressable
          onPress={onSelectNow}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: visibility === "now" ? colors.primary : colors.surfaceLight,
            borderWidth: 0.5,
            borderColor: visibility === "now" ? colors.primary : colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: visibility === "now" ? colors.text : colors.textMuted }}>
            Visible now
          </Text>
        </Pressable>
        <Pressable
          onPress={onOpenSheet}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: visibility === "reveal" ? colors.primary : colors.surfaceLight,
            borderWidth: 0.5,
            borderColor: visibility === "reveal" ? colors.primary : colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: visibility === "reveal" ? colors.text : colors.textMuted }} numberOfLines={1}>
            {visibility === "reveal" && revealHoursBefore != null && revealHoursBefore > 0
              ? `${revealHoursBefore}h before`
              : "Reveal later"}
          </Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
        {visibility === "reveal" ? "Address is hidden until the reveal time" : "Address is visible to all guests"}
      </Text>
    </View>
  );
}

import { View, Text, ScrollView, Pressable } from "react-native";
import type { EventType } from "@/src/lib/supabase";
import { getEventTypeLabel } from "@/src/utils/eventTypeBadge";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { EVENT_FORM_HERO_PADDING_H } from "./eventFormTokens";
import { EVENT_TYPE_OPTIONS } from "@/src/constants/eventFormOptions";

export type EventFormEventTypeChipsProps = {
  eventType: EventType;
  onSelect: (type: EventType) => void;
};

export function EventFormEventTypeChips({ eventType, onSelect }: EventFormEventTypeChipsProps) {
  return (
    <View style={{ paddingHorizontal: EVENT_FORM_HERO_PADDING_H, marginBottom: spacing.xl }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: EVENT_FORM_HERO_PADDING_H }}
      >
        {EVENT_TYPE_OPTIONS.map((option) => {
          const selected = eventType === option.value;
          const label = getEventTypeLabel(option.value).label;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                backgroundColor: selected ? colors.primaryLight20 : pressed ? colors.surfaceLighter : colors.surfaceLight,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
              })}
            >
              <Text style={{ fontSize: 13 }}>{option.emoji}</Text>
              <Text
                style={{
                  fontSize: typography.sizes.xs,
                  fontWeight: selected ? typography.weights.semibold : typography.weights.medium,
                  color: selected ? colors.text : colors.textMuted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

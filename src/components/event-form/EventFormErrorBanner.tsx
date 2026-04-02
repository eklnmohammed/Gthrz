import { View, Text } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";
import { EVENT_FORM_HERO_PADDING_H } from "./eventFormTokens";

export function EventFormErrorBanner({ message }: { message: string }) {
  return (
    <View
      style={{
        marginHorizontal: EVENT_FORM_HERO_PADDING_H,
        marginBottom: spacing.lg,
        backgroundColor: "rgba(255,71,87,0.12)",
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 0.5,
        borderColor: colors.error,
      }}
    >
      <Text style={{ fontSize: typography.sizes.sm, color: colors.error, textAlign: "center" }}>{message}</Text>
    </View>
  );
}

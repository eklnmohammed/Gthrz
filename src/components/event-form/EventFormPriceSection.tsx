import { View, Text, Pressable, TextInput } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";
import { typography } from "@/src/theme/typography";

type EventFormPriceSectionProps = {
  priceMode: "free" | "paid";
  priceAmount: string;
  priceCurrency: string;
  entryFeePreviewLine: string | null;
  showValidationError?: boolean;
  onSelectFree: () => void;
  onSelectPaid: () => void;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
};

const CURRENCY_OPTIONS = ["SAR", "$", "£"] as const;

export function EventFormPriceSection({
  priceMode,
  priceAmount,
  priceCurrency,
  entryFeePreviewLine,
  showValidationError,
  onSelectFree,
  onSelectPaid,
  onAmountChange,
  onCurrencyChange,
}: EventFormPriceSectionProps) {
  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
          Entry fee
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable
            onPress={onSelectFree}
            style={{
              flex: 1,
              backgroundColor: priceMode === "free" ? colors.primary : colors.surfaceLight,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              alignItems: "center",
              borderWidth: 0.5,
              borderColor: priceMode === "free" ? colors.primary : colors.border,
            }}
          >
            <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: priceMode === "free" ? colors.text : colors.textMuted }}>
              Free
            </Text>
          </Pressable>
          <Pressable
            onPress={onSelectPaid}
            style={{
              flex: 1,
              backgroundColor: priceMode === "paid" ? colors.primary : colors.surfaceLight,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              alignItems: "center",
              borderWidth: 0.5,
              borderColor: priceMode === "paid" ? colors.primary : colors.border,
            }}
          >
            <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: priceMode === "paid" ? colors.text : colors.textMuted }}>
              Paid
            </Text>
          </Pressable>
        </View>
      </View>
      {priceMode === "paid" && (
        <View style={{ gap: spacing.sm }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
              Amount *
            </Text>
            <TextInput
              value={priceAmount}
              onChangeText={onAmountChange}
              placeholder="0"
              placeholderTextColor={colors.textDim}
              keyboardType="decimal-pad"
              style={{
                backgroundColor: colors.surfaceLight,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                fontSize: typography.sizes.md,
                color: colors.text,
                borderWidth: 0.5,
                borderColor: showValidationError ? colors.error : colors.border,
              }}
            />
            {showValidationError && (
              <Text style={{ fontSize: typography.sizes.xs, color: colors.error }}>
                Enter a valid amount greater than 0
              </Text>
            )}
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>
              Currency
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {CURRENCY_OPTIONS.map((cur) => (
                <Pressable
                  key={cur}
                  onPress={() => onCurrencyChange(cur)}
                  style={{
                    flex: 1,
                    backgroundColor: priceCurrency === cur ? colors.primary : colors.surfaceLight,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    alignItems: "center",
                    borderWidth: 0.5,
                    borderColor: priceCurrency === cur ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: priceCurrency === cur ? colors.text : colors.textMuted }}>
                    {cur}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {entryFeePreviewLine ? (
            <Text
              style={{
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
                color: colors.text,
                marginTop: spacing.xs,
              }}
            >
              {entryFeePreviewLine}
            </Text>
          ) : null}
          <Text style={{ fontSize: typography.sizes.xs, color: colors.textDim, marginTop: 2 }}>
            Display only — no payments are processed
          </Text>
        </View>
      )}
    </>
  );
}

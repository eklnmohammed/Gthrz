import { View, Text, TextInput, TextInputProps } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function AppInput({
  label,
  error,
  multiline = false,
  ...textInputProps
}: AppInputProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      {label && (
        <Text
          style={{
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.medium,
            color: colors.textMuted,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        {...textInputProps}
        multiline={multiline}
        placeholderTextColor={colors.textDim}
        style={[
          {
            backgroundColor: colors.surfaceLight,
            borderRadius: radius.md,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.lg,
            fontSize: typography.sizes.md,
            color: colors.text,
            letterSpacing: 0,
            minHeight: multiline ? 100 : 52,
            textAlignVertical: multiline ? "top" : "center",
            borderWidth: 1,
            borderColor: error ? colors.error : colors.border,
          },
          textInputProps.style,
        ]}
      />
      {error && (
        <Text
          style={{
            fontSize: typography.sizes.xs,
            color: colors.error,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

import { View, ViewStyle, StatusBar } from "react-native";
import { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

interface ScreenProps {
  children: ReactNode;
  padding?: boolean;
  /** When true, reduces top padding (useful under nav headers) */
  compactTop?: boolean;
  /** Override top padding (space between nav header and content) */
  topPadding?: number;
  style?: ViewStyle;
}

export function Screen({ children, padding = true, compactTop = false, topPadding, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const topPad =
    topPadding !== undefined
      ? topPadding
      : compactTop
        ? Math.max(insets.top, spacing.md)
        : Math.max(insets.top, spacing.md) + spacing.md;

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: topPad,
          paddingBottom: insets.bottom,
          paddingLeft: padding ? spacing.xxl + insets.left : insets.left,
          paddingRight: padding ? spacing.xxl + insets.right : insets.right,
        },
        style,
      ]}
    >
      <StatusBar barStyle="light-content" />
      {children}
    </View>
  );
}

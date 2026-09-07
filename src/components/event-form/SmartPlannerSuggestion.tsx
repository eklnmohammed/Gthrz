import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  type ViewStyle,
} from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { typography } from "@/src/theme/typography";
import { radius } from "@/src/theme/radius";

const EXIT_MS = 240;
const HIGHLIGHT_MS = 280;

export type SmartPlannerSuggestionProps = {
  /** The suggested value to display */
  value: string;
  /** Called immediately when the user accepts (fill the field). */
  onAccept: () => void;
  /** Called after the exit animation finishes (remove from UI). */
  onDismiss?: () => void;
  /** Optional: render as a list of items (for bring items, etc.) */
  items?: string[];
  /** Optional: called when user taps a specific item from the list */
  onAcceptItem?: (item: string) => void;
};

/**
 * Inline AI suggestion that appears below a form field.
 * Lightweight, purple-accented — fades out when accepted.
 *
 * Future-proof: same interaction for covers, locations, lineups, schedules.
 */
export function SmartPlannerSuggestion({
  value,
  onAccept,
  onDismiss,
  items,
  onAcceptItem,
}: SmartPlannerSuggestionProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const maxHeight = useRef(new Animated.Value(160)).current;
  const [exiting, setExiting] = useState(false);
  const [localItems, setLocalItems] = useState(items ?? []);

  const runExit = () => {
    if (exiting) return;
    setExiting(true);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_MS,
        useNativeDriver: false,
      }),
      Animated.timing(maxHeight, {
        toValue: 0,
        duration: EXIT_MS,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) onDismiss?.();
    });
  };

  const handleAccept = () => {
    if (exiting) return;
    onAccept();
    runExit();
  };

  const handleAcceptItem = (item: string) => {
    if (exiting || !onAcceptItem) return;
    onAcceptItem(item);
    const next = localItems.filter((i) => i !== item);
    setLocalItems(next);
    if (next.length === 0) runExit();
  };

  // List mode: show tappable items
  if (items && onAcceptItem) {
    if (localItems.length === 0 && !exiting) return null;
    return (
      <Animated.View
        pointerEvents={exiting ? "none" : "auto"}
        style={[styles.animatedWrap, { opacity, maxHeight }]}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.sparkle}>✨</Text>
            <Text style={styles.label}>Suggested:</Text>
          </View>
          <View style={styles.itemList}>
            {localItems.map((item, index) => (
              <Pressable
                key={`${item}-${index}`}
                onPress={() => handleAcceptItem(item)}
                style={({ pressed }) => [
                  styles.itemChip,
                  pressed && styles.itemChipPressed,
                ]}
              >
                <Text style={styles.itemText}>{item}</Text>
                <Text style={styles.addIcon}>+</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>Tap an item to add it</Text>
        </View>
      </Animated.View>
    );
  }

  // Single value mode
  return (
    <Animated.View
      pointerEvents={exiting ? "none" : "auto"}
      style={[styles.animatedWrap, { opacity, maxHeight }]}
    >
      <Pressable
        onPress={handleAccept}
        style={({ pressed }) => [
          styles.container,
          pressed && styles.containerPressed,
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.sparkle}>✨</Text>
          <Text style={styles.label}>Suggested:</Text>
        </View>
        <Text style={styles.value} numberOfLines={2}>
          {value}
        </Text>
        <Text style={styles.hint}>Tap to use</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Brief purple pulse around a field after a suggestion is accepted.
 */
export function SmartPlannerFieldHighlight({
  active,
  children,
  style,
}: {
  active: boolean;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    pulse.setValue(1);
    Animated.timing(pulse, {
      toValue: 0,
      duration: HIGHLIGHT_MS,
      useNativeDriver: false,
    }).start();
  }, [active, pulse]);

  const borderColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", "rgba(123, 104, 238, 0.55)"],
  });
  const backgroundColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", "rgba(123, 104, 238, 0.10)"],
  });

  return (
    <Animated.View
      style={[
        {
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor,
          backgroundColor,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedWrap: {
    overflow: "hidden",
  },
  container: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    backgroundColor: "rgba(123, 104, 238, 0.06)",
    borderRadius: 4,
  },
  containerPressed: {
    backgroundColor: "rgba(123, 104, 238, 0.12)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  sparkle: {
    fontSize: 10,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  value: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: typography.lineHeightPx.tight,
  },
  hint: {
    fontSize: 10,
    color: colors.textDim,
    marginTop: 4,
  },
  itemList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  itemChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: "rgba(123, 104, 238, 0.12)",
    borderRadius: 12,
  },
  itemChipPressed: {
    backgroundColor: "rgba(123, 104, 238, 0.24)",
  },
  itemText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  addIcon: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});

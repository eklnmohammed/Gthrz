import { Modal, Pressable, Text } from "react-native";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

export type SortOption = "soonest" | "newest" | "cancelled";

export interface SortSheetProps {
  visible: boolean;
  onClose: () => void;
  value: SortOption;
  onSelect: (value: SortOption) => void;
  /** When true, show "Cancelled only" filter option (e.g. Hosting screen). */
  showCancelledOption?: boolean;
}

/**
 * Bottom-sheet style modal for sort options (Soonest / Newest).
 * Matches Discover screen style.
 */
export function SortSheet({ visible, onClose, value, onSelect, showCancelledOption }: SortSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            paddingHorizontal: spacing.xxxl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxl + 24,
            borderWidth: 1,
            borderColor: colors.border,
            borderBottomWidth: 0,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={{
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              color: colors.textMuted,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: spacing.md,
            }}
          >
            SORT LIST BY
          </Text>
          <Pressable
            onPress={() => {
              onSelect("soonest");
              onClose();
            }}
            style={{
              width: "100%",
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: value === "soonest" ? colors.surfaceLight : "transparent",
              marginBottom: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: typography.sizes.md,
                color: value === "soonest" ? colors.primary : colors.text,
                fontWeight: typography.weights.medium,
              }}
            >
              Soonest
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onSelect("newest");
              onClose();
            }}
            style={{
              width: "100%",
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: value === "newest" ? colors.surfaceLight : "transparent",
              marginBottom: showCancelledOption ? spacing.sm : 0,
            }}
          >
            <Text
              style={{
                fontSize: typography.sizes.md,
                color: value === "newest" ? colors.primary : colors.text,
                fontWeight: typography.weights.medium,
              }}
            >
              Newest
            </Text>
          </Pressable>
          {showCancelledOption && (
            <Pressable
              onPress={() => {
                onSelect("cancelled");
                onClose();
              }}
              style={{
                width: "100%",
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: value === "cancelled" ? colors.surfaceLight : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: typography.sizes.md,
                  color: value === "cancelled" ? colors.primary : colors.text,
                  fontWeight: typography.weights.medium,
                }}
              >
                Cancelled
              </Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

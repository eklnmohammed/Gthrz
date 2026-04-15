import type { ReactNode } from "react";
import { Modal, Pressable } from "react-native";
import { colors } from "@/src/theme/colors";
import { spacing } from "@/src/theme/spacing";
import { radius } from "@/src/theme/radius";

/**
 * Shared bottom sheet shell for event Create/Edit modals (capacity, reveal address, dress code).
 * Matches the Create screen sheet: padding, gap, border, and safe-area behaviour.
 */
export function EventFormBottomSheet({
  visible,
  onRequestClose,
  keyboardInset,
  bottomSafeInset,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  keyboardInset: number;
  bottomSafeInset: number;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onRequestClose}>
      <Pressable
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
        onPress={onRequestClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: keyboardInset > 0 ? spacing.lg : spacing.xxl + bottomSafeInset,
            marginBottom: keyboardInset,
            borderWidth: 0.5,
            borderColor: "rgba(255,255,255,0.08)",
            gap: spacing.xl,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

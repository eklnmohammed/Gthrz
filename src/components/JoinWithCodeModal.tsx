import { useState, useEffect } from "react";
import { View, Text, TextInput, Modal, Pressable, ActivityIndicator } from "react-native";
import { useEvents } from "../state/eventsStore";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { radius } from "../theme/radius";

export interface JoinWithCodeModalProps {
  visible: boolean;
  onClose: () => void;
  onJoined?: (eventId: string, eventType?: string) => void;
}

export function JoinWithCodeModal({ visible, onClose, onJoined }: JoinWithCodeModalProps) {
  const { fetchEventByInviteCode } = useEvents();
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [joiningWithCode, setJoiningWithCode] = useState(false);

  useEffect(() => {
    if (!visible) {
      setInviteCode("");
      setInviteError("");
    }
  }, [visible]);

  const handleJoin = async () => {
    if (inviteCode.length !== 6) return;
    setJoiningWithCode(true);
    setInviteError("");
    const event = await fetchEventByInviteCode(inviteCode);
    setJoiningWithCode(false);
    if (event) {
      onClose();
      onJoined?.(event.id, event.eventType);
    } else {
      setInviteError("Invalid code");
    }
  };

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
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            paddingHorizontal: spacing.xxl,
            paddingTop: spacing.xl,
            paddingBottom: spacing.xxl,
            borderWidth: 0.5,
            borderColor: "rgba(255, 255, 255, 0.06)",
            borderBottomWidth: 0,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={{
              fontSize: typography.sizes.xl,
              fontWeight: typography.weights.bold,
              color: colors.text,
              marginBottom: spacing.xs,
            }}
          >
            Join with code
          </Text>
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: colors.textMuted,
              marginBottom: spacing.lg,
            }}
          >
            Enter the 6-character invite code from the host
          </Text>
          <TextInput
            placeholder="XXXXXX"
            placeholderTextColor={colors.textDim}
            value={inviteCode}
            onChangeText={(text) => {
              setInviteCode(text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
              setInviteError("");
            }}
            autoCapitalize="characters"
            maxLength={6}
            editable={!joiningWithCode}
            style={{
              backgroundColor: colors.surfaceLight,
              borderRadius: radius.lg,
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing.lg,
              fontSize: typography.sizes.xl,
              color: colors.text,
              letterSpacing: 6,
              textAlign: "center",
              textAlignVertical: "center",
              borderWidth: 1,
              borderColor: inviteError ? colors.error : colors.border,
              marginBottom: spacing.sm,
            }}
          />
          {inviteError ? (
            <Text
              style={{
                fontSize: typography.sizes.xs,
                color: colors.error,
                marginBottom: spacing.md,
              }}
            >
              {inviteError}
            </Text>
          ) : null}
          <Pressable
            onPress={handleJoin}
            disabled={inviteCode.length !== 6 || joiningWithCode}
            style={{
              backgroundColor: inviteCode.length === 6 ? colors.primary : colors.border,
              paddingVertical: spacing.lg,
              borderRadius: radius.lg,
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            {joiningWithCode ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <ActivityIndicator size="small" color={colors.background} />
                <Text
                  style={{
                    fontSize: typography.sizes.md,
                    fontWeight: typography.weights.semibold,
                    color: colors.background,
                  }}
                >
                  Joining…
                </Text>
              </View>
            ) : (
              <Text
                style={{
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.semibold,
                  color: inviteCode.length === 6 ? colors.background : colors.textMuted,
                }}
              >
                Join
              </Text>
            )}
          </Pressable>
          <Pressable onPress={onClose} style={{ alignItems: "center", paddingVertical: spacing.sm }}>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

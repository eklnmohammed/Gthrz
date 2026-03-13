import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";
import { getRecentLocations, addRecentLocation } from "../utils/recentLocations";
import {
  LocationPickerModal,
  type LocationSelection,
} from "./LocationPickerModal";

export type { LocationSelection };

export interface LocationCardWithPickerProps {
  value: LocationSelection;
  onChange: (value: LocationSelection) => void;
  userPhone: string | null;
}

export function LocationCardWithPicker({
  value,
  onChange,
  userPhone,
}: LocationCardWithPickerProps) {
  const [showModal, setShowModal] = useState(false);
  const [recentList, setRecentList] = useState<string[]>([]);

  const loadRecents = useCallback(async () => {
    const list = await getRecentLocations(userPhone);
    setRecentList(list);
  }, [userPhone]);

  useEffect(() => {
    if (showModal) loadRecents();
  }, [showModal, loadRecents]);

  const handleSelect = async (selection: LocationSelection) => {
    if (selection.name.trim()) {
      await addRecentLocation(selection.name.trim(), userPhone);
    }
    onChange(selection);
    setShowModal(false);
  };

  const handleClear = () => {
    onChange({ name: "" });
  };

  const hasValue = value.name.trim().length > 0;

  return (
    <>
      <View style={{ gap: spacing.sm }}>
        <Text
          style={{
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.medium,
            color: colors.textMuted,
          }}
        >
          Location
        </Text>
        <Pressable
          onPress={() => setShowModal(true)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            backgroundColor: colors.surfaceLight,
            borderRadius: radius.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            minHeight: 44,
            borderWidth: 0.5,
            borderColor: "rgba(255,255,255,0.08)",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Ionicons
            name="location-outline"
            size={18}
            color={hasValue ? colors.primary : colors.textDim}
          />
          <View style={{ flex: 1 }}>
            {hasValue ? (
              <View>
                <Text
                  style={{
                    fontSize: typography.sizes.md,
                    color: colors.text,
                    fontWeight: typography.weights.medium,
                  }}
                  numberOfLines={1}
                >
                  {value.name}
                </Text>
                {value.address ? (
                  <Text
                    style={{
                      fontSize: typography.sizes.xs,
                      color: colors.textMuted,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {value.address}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={{ fontSize: typography.sizes.md, color: colors.textDim }}>
                Pick a location (optional)
              </Text>
            )}
          </View>
          {hasValue ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                padding: spacing.xs,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : (
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                backgroundColor: colors.primary,
              }}
            >
              <Text
                style={{
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.semibold,
                  color: "#fff",
                }}
              >
                Pick
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <LocationPickerModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handleSelect}
        recentLocations={recentList}
      />
    </>
  );
}

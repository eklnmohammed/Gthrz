import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";

export interface LocationSelection {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: LocationSelection) => void;
  recentLocations?: string[];
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LEN = 2;

function parseResult(r: NominatimResult): { title: string; subtitle: string } {
  const parts = r.display_name.split(",").map((s) => s.trim());
  if (r.name && r.name.trim()) {
    const subtitle = parts
      .filter((p) => p.toLowerCase() !== r.name!.toLowerCase())
      .slice(0, 3)
      .join(", ");
    return { title: r.name.trim(), subtitle: subtitle || parts.slice(1, 4).join(", ") };
  }
  return { title: parts[0] || r.display_name, subtitle: parts.slice(1, 4).join(", ") };
}

export function LocationPickerModal({
  visible,
  onClose,
  onSelect,
  recentLocations = [],
}: LocationPickerModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setQuery("");
      setResults([]);
      setError(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Cleanup on close
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [visible]);

  const fetchResults = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=8`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "X-Requested-With": "gthrz-university-project",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: NominatimResult[] = await res.json();
      if (!controller.signal.aborted) {
        setResults(data);
        setLoading(false);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setError("Couldn't load results. Try again.");
        setLoading(false);
      }
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setResults([]);
      setLoading(false);
      setError(null);
      abortRef.current?.abort();
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(() => fetchResults(trimmed), DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, fetchResults]);

  const handleSelectResult = (r: NominatimResult) => {
    const parsed = parseResult(r);
    Keyboard.dismiss();
    onSelect({
      name: parsed.title,
      address: parsed.subtitle || undefined,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    });
  };

  const handleManualEntry = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    onSelect({ name: trimmed });
  };

  const handleRecentSelect = (loc: string) => {
    Keyboard.dismiss();
    onSelect({ name: loc });
  };

  const trimmed = query.trim();
  const showManualOption = trimmed.length >= MIN_QUERY_LEN;
  const showRecents = trimmed.length < MIN_QUERY_LEN && recentLocations.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxxxl,
            borderWidth: 1,
            borderColor: colors.border,
            borderBottomWidth: 0,
            maxHeight: "80%",
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View style={{ alignItems: "center", marginBottom: spacing.md }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.surfaceLighter,
              }}
            />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.semibold,
              color: colors.text,
              paddingHorizontal: spacing.xxl,
              marginBottom: spacing.lg,
            }}
          >
            Location
          </Text>

          {/* Search input */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceLight,
              borderRadius: radius.md,
              marginHorizontal: spacing.xxl,
              paddingHorizontal: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            <Ionicons name="search" size={16} color={colors.textDim} />
            <TextInput
              ref={inputRef}
              placeholder="Search for a place..."
              placeholderTextColor={colors.textDim}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.sm,
                fontSize: typography.sizes.md,
                color: colors.text,
              }}
            />
            {trimmed.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textDim} />
              </Pressable>
            )}
          </View>

          {/* Loading indicator */}
          {loading && (
            <View style={{ paddingVertical: spacing.sm, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}

          {/* Error */}
          {error && !loading && (
            <Text
              style={{
                fontSize: typography.sizes.sm,
                color: colors.error,
                paddingHorizontal: spacing.xxl,
                paddingVertical: spacing.sm,
              }}
            >
              {error}
            </Text>
          )}

          <ScrollView
            style={{ maxHeight: 400 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Manual entry option */}
            {showManualOption && (
              <Pressable
                onPress={handleManualEntry}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.xxl,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.primaryLight20,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="pencil" size={14} color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: typography.sizes.md,
                    color: colors.primary,
                    fontWeight: typography.weights.medium,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  Use "{trimmed}"
                </Text>
              </Pressable>
            )}

            {/* Nominatim results */}
            {!loading &&
              results.map((r) => {
                const { title, subtitle } = parseResult(r);
                return (
                  <Pressable
                    key={r.place_id}
                    onPress={() => handleSelectResult(r)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.xxl,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.surfaceLight,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="location" size={14} color={colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: typography.sizes.md,
                          color: colors.text,
                          fontWeight: typography.weights.medium,
                        }}
                        numberOfLines={1}
                      >
                        {title}
                      </Text>
                      {subtitle ? (
                        <Text
                          style={{
                            fontSize: typography.sizes.sm,
                            color: colors.textMuted,
                            marginTop: 1,
                          }}
                          numberOfLines={1}
                        >
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}

            {/* Empty search state + no results */}
            {!loading && !error && trimmed.length >= MIN_QUERY_LEN && results.length === 0 && (
              <Text
                style={{
                  fontSize: typography.sizes.sm,
                  color: colors.textMuted,
                  paddingHorizontal: spacing.xxl,
                  paddingVertical: spacing.lg,
                  textAlign: "center",
                }}
              >
                No places found. Use the manual entry above.
              </Text>
            )}

            {/* Recent locations (when not searching) */}
            {showRecents && (
              <View style={{ paddingHorizontal: spacing.xxl, paddingTop: spacing.sm }}>
                <Text
                  style={{
                    fontSize: typography.sizes.xs,
                    fontWeight: typography.weights.semibold,
                    color: colors.textDim,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: spacing.sm,
                  }}
                >
                  Recent
                </Text>
                {recentLocations.map((loc, i) => (
                  <Pressable
                    key={`${loc}-${i}`}
                    onPress={() => handleRecentSelect(loc)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      paddingVertical: spacing.md,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons name="time-outline" size={16} color={colors.textDim} />
                    <Text
                      style={{
                        fontSize: typography.sizes.md,
                        color: colors.text,
                      }}
                      numberOfLines={1}
                    >
                      {loc}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

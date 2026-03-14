import { View, Text, Pressable, ImageBackground, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { radius } from "../theme/radius";
import { typography } from "../theme/typography";
import { getEventGradient } from "../utils/eventGradient";
import { getEventTypeLabel } from "../utils/eventTypeBadge";
import { getCoverSource } from "../utils/covers";
import { isValidCoverUrl } from "../utils/coverUrl";
import { useFavorites } from "../state/favoritesStore";
import { recordFavorite } from "../utils/preferences";
import { onboardingStore } from "../state/onboardingStore";
import { EventType } from "../lib/supabase";

const DEFAULT_POSTER_HEIGHT = 260;

/**
 * Poster-style event card: full-bleed image with type chip, favorite heart, title + date overlay.
 * No attendee avatars on cards; avatars only in Event Details / Guests modal.
 */
interface EventCardProps {
  title: string;
  dateTime: string;
  eventType?: string;
  coverKey?: string;
  coverUrl?: string;
  onPress: () => void;
  showPendingStatus?: boolean;
  statusPill?: { label: string; color: string; bg: string };
  width?: number | string;
  posterHeight?: number;
  compact?: boolean;
  /** For favorite toggle; when set, heart is shown (unless isHost). */
  eventId?: string;
  /** When true, show "You're hosting" instead of favorite heart. */
  isHost?: boolean;
  /** When false, event type chip is hidden. Default true. */
  showTypeChip?: boolean;
  /** Hide the type chip entirely (e.g. Profile square tiles). */
  hideTypeChip?: boolean;
  /** When true, shows a "Cancelled" badge on the card. */
  cancelled?: boolean;
}

export function EventCard({
  title,
  dateTime,
  eventType,
  coverKey,
  coverUrl,
  onPress,
  showPendingStatus,
  statusPill,
  width = "100%",
  posterHeight = DEFAULT_POSTER_HEIGHT,
  compact = false,
  eventId,
  isHost = false,
  showTypeChip = true,
  hideTypeChip = false,
  cancelled = false,
}: EventCardProps) {
  const { isFavorited, toggleFavorite } = useFavorites();
  const typeLabel = getEventTypeLabel(eventType as any);
  const cardWidth = width as ViewStyle["width"];
  const scrimHeight = Math.min(120, Math.floor(posterHeight * 0.5));
  const favorited = eventId ? isFavorited(eventId) : false;

  const handleFavoritePress = (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (!eventId) return;
    toggleFavorite(eventId);
    if (!favorited && eventType) {
      onboardingStore.getPhone().then((phone) => {
        if (phone) recordFavorite(eventType as EventType, phone);
      });
    }
  };

  const overlay = (
    <>
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: scrimHeight }}
      />

      {/* Top-right: "You're hosting" when isHost, otherwise favorite heart */}
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          minWidth: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isHost ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing.xs,
              paddingVertical: 4,
              backgroundColor: "rgba(0,0,0,0.4)",
              borderRadius: radius.full,
              gap: 4,
            }}
          >
            <Ionicons name="person" size={14} color="rgba(255,255,255,0.95)" />
            <Text
              style={{
                fontSize: 11,
                fontWeight: typography.weights.semibold,
                color: "rgba(255,255,255,0.95)",
              }}
              numberOfLines={1}
            >
              You're hosting
            </Text>
          </View>
        ) : eventId != null ? (
          <Pressable
            onPress={handleFavoritePress}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons
              name={favorited ? "heart" : "heart-outline"}
              size={22}
              color={favorited ? colors.coral : "rgba(255,255,255,0.9)"}
            />
          </Pressable>
        ) : null}
      </View>

      {/* Event type chip — top-left (optional) */}
      {showTypeChip && !hideTypeChip && (
        <View
          style={{
            position: "absolute",
            top: compact ? 6 : 10,
            left: compact ? 6 : 10,
            backgroundColor: "rgba(0,0,0,0.35)",
            paddingHorizontal: compact ? 4 : spacing.xs,
            paddingVertical: compact ? 2 : 4,
            borderRadius: radius.full,
          }}
        >
          <Text
            style={{
              fontSize: compact ? 9 : 10,
              fontWeight: typography.weights.semibold,
              color: "rgba(255, 255, 255, 0.95)",
            }}
          >
            {typeLabel.emoji} {typeLabel.label}
          </Text>
        </View>
      )}

      {/* Title + date overlay */}
      <View
        style={{
          position: "absolute",
          bottom: spacing.lg,
          left: spacing.md,
          right: spacing.md,
        }}
      >
        <Text
          style={{
            fontSize: compact ? typography.sizes.sm : typography.sizes.lg,
            fontWeight: typography.weights.bold,
            color: "#fff",
            marginBottom: 2,
            lineHeight: compact ? 18 : 22,
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: typography.sizes.xs,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          {dateTime}
        </Text>
        {(statusPill || showPendingStatus || cancelled) && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 6 }}>
            {cancelled ? (
              <View
                style={{
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                  borderRadius: radius.full,
                  backgroundColor: "rgba(255,71,87,0.2)",
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: typography.weights.semibold, color: colors.error }}>
                  Cancelled
                </Text>
              </View>
            ) : (
              <>
                {statusPill && (
                  <View
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: radius.full,
                      backgroundColor: statusPill.bg,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: typography.weights.semibold, color: statusPill.color }}>
                      {statusPill.label}
                    </Text>
                  </View>
                )}
                {showPendingStatus && (
                  <View
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: radius.full,
                      backgroundColor: "rgba(78,205,196,0.18)",
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: typography.weights.semibold, color: colors.mint }}>
                      Pending approval
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }): ViewStyle => ({
        width: cardWidth,
        opacity: pressed ? 0.92 : 1,
        borderRadius: radius.lg,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 14,
        elevation: 6,
      })}
    >
      {(isValidCoverUrl(coverUrl) || (coverKey != null && coverKey.trim() !== "")) ? (
        <ImageBackground
          source={isValidCoverUrl(coverUrl) ? { uri: coverUrl! } : getCoverSource(coverKey!, eventType as any)}
          style={{ width: "100%", height: posterHeight }}
          resizeMode="cover"
        >
          {overlay}
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={[...getEventGradient(eventType as any)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: "100%", height: posterHeight }}
        >
          {overlay}
        </LinearGradient>
      )}
    </Pressable>
  );
}

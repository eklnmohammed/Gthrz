import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Pressable,
  Dimensions,
} from "react-native";
import { router, useFocusEffect, Stack } from "expo-router";
import { Screen } from "../src/components/Screen";
import { HeaderBackTextButton } from "../src/components/HeaderBackTextButton";
import { HeaderTextButton } from "../src/components/HeaderTextButton";
import { EventCard } from "../src/components/EventCard";
import { HomeSectionHeader } from "../src/components/HomeSectionHeader";
import { onboardingStore, UserProfile } from "../src/state/onboardingStore";
import { useEvents, type Event } from "../src/state/eventsStore";
import { useFavorites } from "../src/state/favoritesStore";
import { signOut as authSignOut, syncCurrentProfileFromServer } from "../src/lib/auth";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { radius } from "../src/theme/radius";
import { typography } from "../src/theme/typography";
import { formatEventDateForCards } from "../src/utils/formatEventDate";
import { getEventStatusPill } from "../src/utils/eventStatusPill";
import { clearPreferencesForPhone, clearPreferences } from "../src/utils/preferences";
import { compareEventsDefaultChronological } from "../src/utils/eventListOrdering";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Square tile: ~2 visible with a peek of the next
const TILE_SIZE = Math.min(220, Math.floor(SCREEN_WIDTH * 0.58));
const SECTION_GAP = spacing.xxl;

/** Compare stored phones regardless of + prefix / formatting (must match host_phone vs PHONE_KEY). */
function samePhoneIdentity(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  const digits = (s: string) => s.replace(/\D/g, "");
  const da = digits(a);
  const db = digits(b);
  if (da.length === 0 || db.length === 0) return false;
  return da === db;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const { events, loading, fetchEvents, fetchPublicEvents } = useEvents();
  const { favoriteIds, reloadFavorites } = useFavorites();

  const nowMs = Date.now();
  const createdEvents =
    phone != null && String(phone).trim() !== ""
      ? events
          .filter(
            (e) =>
              e.hostPhone != null &&
              String(e.hostPhone).trim() !== "" &&
              samePhoneIdentity(e.hostPhone, phone)
          )
          .sort((a, b) => compareEventsDefaultChronological(a, b, nowMs))
      : [];
  const eventsById = new Map<string, Event>([...publicEvents, ...events].map((e) => [e.id, e]));
  const savedEvents = [...eventsById.values()]
    .filter((e) => favoriteIds.has(e.id))
    .sort((a, b) => compareEventsDefaultChronological(a, b, nowMs));

  const loadProfile = useCallback(async () => {
    const [p, ph] = await Promise.all([
      onboardingStore.getProfile(),
      onboardingStore.getPhone(),
    ]);
    setProfile(p);
    setPhone(ph);
  }, []);

  useFocusEffect(
    useCallback(() => {
      syncCurrentProfileFromServer().then(loadProfile);
      fetchEvents();
      fetchPublicEvents().then(setPublicEvents);
    }, [loadProfile, fetchEvents, fetchPublicEvents])
  );

  const fullName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—"
    : "—";
  const displayPhone = phone || profile?.phone || "—";

  const handleEventPress = (event: { id: string }) => {
    router.push({
      pathname: "/events/[id]",
      params: { id: event.id },
    });
  };

  const handleSignOut = async () => {
    const currentPhone = phone ?? (await onboardingStore.getPhone()) ?? "";
    await clearPreferencesForPhone(currentPhone);
    await authSignOut();
    await onboardingStore.reset();
    await reloadFavorites();
    await fetchEvents();
    await onboardingStore.setOnboarded(false);
    router.replace("/onboarding");
  };

  const handleResetRecommendations = async () => {
    const currentPhone = phone ?? (await onboardingStore.getPhone()) ?? "";
    await clearPreferences(currentPhone);
    Alert.alert("Done", "Event preferences reset.");
  };

  return (
    <Screen padding={false} topPadding={spacing.sm}>
      <Stack.Screen
        options={{
          headerTitle: "Profile",
          headerBackVisible: false,
          headerLeft: () => <HeaderBackTextButton label="Back" onPress={() => router.back()} />,
          headerRight: () => (
            <HeaderTextButton
              label="Edit"
              onPress={() => router.push("/profile/edit")}
            />
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: spacing.xl,
          paddingHorizontal: spacing.xxl,
          paddingBottom: spacing.xxxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity block: avatar + name + phone */}
        <View style={{ alignItems: "center", marginBottom: spacing.xxxl }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.surfaceLight,
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              marginBottom: spacing.md,
            }}
          >
            {profile?.avatarUri ? (
              <Image
                source={{ uri: profile.avatarUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ fontSize: 28, color: colors.textMuted }}>
                {profile?.firstName?.charAt(0)?.toUpperCase() || "👤"}
              </Text>
            )}
          </View>
          <Text
            style={{
              fontSize: typography.sizes.xxl,
              fontWeight: typography.weights.bold,
              color: colors.text,
              letterSpacing: -0.4,
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            {fullName}
          </Text>
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: colors.textMuted,
            }}
          >
            {displayPhone}
          </Text>
        </View>

        {/* Saved */}
        <View style={{ marginBottom: SECTION_GAP }}>
          <HomeSectionHeader
            title="Saved"
            action={
              savedEvents.length > 0
                ? { label: "See all", onPress: () => router.push("/profile/saved") }
                : undefined
            }
          />
          {savedEvents.length === 0 ? (
            <View
              style={{
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 0.5,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>
                No saved events yet.
              </Text>
              <Pressable
                onPress={() => router.push("/discover")}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text
                  style={{
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.medium,
                    color: colors.primary,
                  }}
                >
                  Explore
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={TILE_SIZE + spacing.md}
              decelerationRate="fast"
              contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xxl }}
            >
              {savedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  eventId={event.id}
                  title={event.title}
                  dateTime={formatEventDateForCards(event.dateTime)}
                  eventType={event.eventType}
                  coverKey={event.coverKey}
                  coverUrl={event.coverUrl}
                  onPress={() => handleEventPress(event)}
                  statusPill={phone ? getEventStatusPill(event, phone) : undefined}
                  cancelled={event.status === "cancelled"}
                  isHost={phone != null ? samePhoneIdentity(event.hostPhone, phone) : false}
                  width={TILE_SIZE}
                  posterHeight={TILE_SIZE}
                  hideTypeChip
                  pendingRsvpCount={event.pendingRsvpCount}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Events you created */}
        <View style={{ marginBottom: SECTION_GAP }}>
          <HomeSectionHeader
            title="Events you created"
            action={
              createdEvents.length > 3
                ? { label: "See all", onPress: () => router.push("/events/hosting") }
                : undefined
            }
          />
          {loading && (
            <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
          {!loading && createdEvents.length === 0 && (
            <View
              style={{
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: 0.5,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>
                No events yet.
              </Text>
              <Pressable
                onPress={() => router.push("/events/create")}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text
                  style={{
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.medium,
                    color: colors.primary,
                  }}
                >
                  Create one
                </Text>
              </Pressable>
            </View>
          )}
          {!loading && createdEvents.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={TILE_SIZE + spacing.md}
              decelerationRate="fast"
              contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xxl }}
            >
              {createdEvents.slice(0, 3).map((event) => (
                <EventCard
                  key={event.id}
                  eventId={event.id}
                  title={event.title}
                  dateTime={formatEventDateForCards(event.dateTime)}
                  eventType={event.eventType}
                  coverKey={event.coverKey}
                  coverUrl={event.coverUrl}
                  onPress={() => handleEventPress(event)}
                  statusPill={phone ? getEventStatusPill(event, phone) : undefined}
                  cancelled={event.status === "cancelled"}
                  width={TILE_SIZE}
                  posterHeight={TILE_SIZE}
                  hideTypeChip
                  isHost
                  pendingRsvpCount={event.pendingRsvpCount}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Settings */}
        <View style={{ marginBottom: SECTION_GAP }}>
          <Text
            style={{
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              color: colors.textDim,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: spacing.sm,
            }}
          >
            Preferences
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 0.5,
              borderColor: colors.border,
              overflow: "hidden",
              marginBottom: spacing.md,
            }}
          >
            <Pressable
              onPress={handleResetRecommendations}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.lg,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: typography.sizes.md, color: colors.text }}>
                Reset event preferences
              </Text>
              <Text style={{ fontSize: typography.sizes.lg, color: colors.textDim }}>›</Text>
            </Pressable>
          </View>

          <Text
            style={{
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              color: colors.textDim,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: spacing.sm,
            }}
          >
            Account
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 0.5,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            <Pressable
              onPress={() => router.push("/profile/about")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.lg,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: typography.sizes.md, color: colors.text }}>
                About
              </Text>
              <Text style={{ fontSize: typography.sizes.lg, color: colors.textDim }}>›</Text>
            </Pressable>
            <View style={{ height: 0.5, backgroundColor: colors.border, marginHorizontal: spacing.lg }} />
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.lg,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: typography.sizes.md, color: colors.error }}>
                Sign out
              </Text>
              <Text style={{ fontSize: typography.sizes.lg, color: colors.textDim }}>›</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

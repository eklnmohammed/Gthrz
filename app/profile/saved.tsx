import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useEvents, type Event } from "../../src/state/eventsStore";
import { useFavorites } from "../../src/state/favoritesStore";
import { onboardingStore } from "../../src/state/onboardingStore";
import { EventCard } from "../../src/components/EventCard";
import { SortSheet, type SortOption } from "../../src/components/SortSheet";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";
import { formatEventDate } from "../../src/utils/formatEventDate";
import { getEventStatusPill } from "../../src/utils/eventStatusPill";

export default function SavedScreen() {
  const { favoriteIds } = useFavorites();
  const { events, fetchEvents, fetchPublicEvents } = useEvents();
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const [userPhone, setUserPhone] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("soonest");
  const [showSortModal, setShowSortModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      (async () => {
        const phone = (await onboardingStore.getPhone()) || "";
        if (!active) return;
        setUserPhone(phone);
        await fetchEvents();
        const publics = await fetchPublicEvents();
        if (active) {
          setPublicEvents(publics);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [fetchEvents, fetchPublicEvents])
  );

  const eventsById = new Map<string, Event>([...publicEvents, ...events].map((e) => [e.id, e]));
  const savedEvents = [...eventsById.values()].filter((e) => favoriteIds.has(e.id));

  const bySearch = searchQuery.trim()
    ? savedEvents.filter((e) =>
        e.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : savedEvents;

  const sorted = [...bySearch].sort((a, b) => {
    if (sortBy === "soonest") {
      return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
    }
    const tA =
      a.createdAt && a.createdAt !== ""
        ? new Date(a.createdAt).getTime()
        : new Date(a.dateTime).getTime();
    const tB =
      b.createdAt && b.createdAt !== ""
        ? new Date(b.createdAt).getTime()
        : new Date(b.dateTime).getTime();
    return tB - tA;
  });

  const handleEventPress = (event: Event) => {
    const isHost = event.hostPhone === userPhone;
    router.push({
      pathname: "/events/[id]",
      params: { id: event.id, mode: isHost ? "host" : "guest" },
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: "Saved", headerBackTitle: "Profile" }} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: spacing.lg,
          paddingHorizontal: spacing.xxl,
          paddingBottom: spacing.xxxxl,
        }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        {/* Search + Sort row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "stretch",
            gap: spacing.md,
            marginBottom: spacing.xl,
          }}
        >
          <View style={{ flex: 1, minHeight: 44 }}>
            <TextInput
              placeholder="Search by title..."
              placeholderTextColor={colors.textDim}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                backgroundColor: colors.surfaceLight,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                fontSize: typography.sizes.md,
                color: colors.text,
                minHeight: 44,
                borderWidth: 0,
              }}
            />
          </View>
          <Pressable
            onPress={() => setShowSortModal(true)}
            style={({ pressed }) => ({
              width: 44,
              minWidth: 44,
              height: 44,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceLight,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <Text style={{ fontSize: 18, color: colors.textMuted }}>⇅</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={{ paddingVertical: spacing.xxxxl, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!loading && sorted.length === 0 && (
          <View
            style={{
              marginTop: spacing.xxl,
              paddingVertical: spacing.xxl,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.lg,
              borderWidth: 0.5,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.semibold,
                color: colors.text,
                marginBottom: spacing.sm,
              }}
            >
              No saved events yet
            </Text>
            <Text
              style={{
                fontSize: typography.sizes.sm,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              Tap the heart on an event to save it.
            </Text>
          </View>
        )}

        {!loading &&
          sorted.map((event) => (
            <View key={event.id} style={{ marginBottom: spacing.lg }}>
              <EventCard
                eventId={event.id}
                title={event.title}
                dateTime={formatEventDate(event.dateTime)}
                eventType={event.eventType}
                coverKey={event.coverKey}
                coverUrl={event.coverUrl}
                onPress={() => handleEventPress(event)}
                statusPill={userPhone ? getEventStatusPill(event, userPhone) : undefined}
                cancelled={event.status === "cancelled"}
                isHost={event.hostPhone === userPhone}
                width="100%"
              />
            </View>
          ))}
      </ScrollView>

      <SortSheet
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        value={sortBy}
        onSelect={setSortBy}
      />
    </>
  );
}

import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput, useWindowDimensions } from "react-native";
import { router, useFocusEffect, Stack } from "expo-router";
import { useCallback, useState, useMemo, useEffect } from "react";
import { useEvents, Event } from "../src/state/eventsStore";
import { Screen } from "../src/components/Screen";
import { StackScreenTopBar } from "../src/components/StackScreenTopBar";
import { Card } from "../src/components/Card";
import { EventCard } from "../src/components/EventCard";
import { JoinWithCodeModal } from "../src/components/JoinWithCodeModal";
import { SortSheet, type SortOption } from "../src/components/SortSheet";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";
import { radius } from "../src/theme/radius";
import { EventType } from "../src/lib/supabase";
import { recordEventView, recordJoinWithCode } from "../src/utils/preferences";
import { onboardingStore } from "../src/state/onboardingStore";
import { formatEventDateForCards } from "../src/utils/formatEventDate";
import { getEventStatusPill } from "../src/utils/eventStatusPill";
import { areSamePhone } from "../src/utils/phone";

const LIST_PADDING_H = 16;
const GRID_GAP = 12;

/** Main feed: first batch + each scroll load */
const DISCOVER_INITIAL_COUNT = 12;
const DISCOVER_PAGE_SIZE = 12;

function compareDiscoverSoonest(a: Event, b: Event, goingCounts: Record<string, number>): number {
  const da = new Date(a.dateTime).getTime();
  const db = new Date(b.dateTime).getTime();
  if (da !== db) return da - db;
  const ca = goingCounts[a.id] ?? 0;
  const cb = goingCounts[b.id] ?? 0;
  if (ca !== cb) return cb - ca;
  const ta = new Date(a.createdAt || a.dateTime).getTime();
  const tb = new Date(b.createdAt || b.dateTime).getTime();
  return tb - ta;
}

function compareDiscoverNewest(a: Event, b: Event, goingCounts: Record<string, number>): number {
  const ta = new Date(a.createdAt || a.dateTime).getTime();
  const tb = new Date(b.createdAt || b.dateTime).getTime();
  if (ta !== tb) return tb - ta;
  const da = new Date(a.dateTime).getTime();
  const db = new Date(b.dateTime).getTime();
  if (da !== db) return da - db;
  const ca = goingCounts[a.id] ?? 0;
  const cb = goingCounts[b.id] ?? 0;
  return cb - ca;
}

export default function DiscoverScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const gridCardWidth = (screenWidth - LIST_PADDING_H * 2 - GRID_GAP) / 2;

  const { fetchPublicEvents, getGoingCountsForEventIds, events: userEvents, fetchEvents } = useEvents();
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const [goingCounts, setGoingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [listVisibleCount, setListVisibleCount] = useState(DISCOVER_INITIAL_COUNT);
  const userEventsById = new Map((userEvents ?? []).map((e) => [e.id, e]));

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("soonest");

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      (async () => {
        const phone = (await onboardingStore.getPhone()) ?? "";
        if (!active) return;
        setUserPhone(phone);
        const [events] = await Promise.all([fetchPublicEvents(), fetchEvents()]);
        if (!active) return;
        const ids = events.map((e) => e.id);
        const counts = await getGoingCountsForEventIds(ids);
        if (active) {
          setPublicEvents(events);
          setGoingCounts(counts);
          setListVisibleCount(DISCOVER_INITIAL_COUNT);
          setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [fetchPublicEvents, fetchEvents, getGoingCountsForEventIds])
  );

  useEffect(() => {
    setListVisibleCount(DISCOVER_INITIAL_COUNT);
  }, [searchQuery, sortBy]);

  const handleEventPress = (event: Event) => {
    if (event.eventType) recordEventView(event.eventType, userPhone);
    router.push({
      pathname: "/events/[id]",
      params: { id: event.id },
    });
  };

  /** Public, upcoming, active (not cancelled), not hosted by current user; search; sorted for Discover */
  const discoverSortedEvents = useMemo(() => {
    const nowMs = Date.now();
    let filtered = publicEvents.filter((e) => e.visibility === "public");
    filtered = filtered.filter((e) => e.status !== "cancelled");
    filtered = filtered.filter((e) => new Date(e.dateTime).getTime() >= nowMs);
    if (userPhone.length > 0) {
      filtered = filtered.filter((e) => !areSamePhone(e.hostPhone, userPhone));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((event) => {
        const title = event.title.toLowerCase();
        const location = (event.location || "").toLowerCase();
        return title.includes(query) || location.includes(query);
      });
    }
    const cmp =
      sortBy === "soonest"
        ? (a: Event, b: Event) => compareDiscoverSoonest(a, b, goingCounts)
        : (a: Event, b: Event) => compareDiscoverNewest(a, b, goingCounts);
    return [...filtered].sort(cmp);
  }, [publicEvents, userPhone, searchQuery, sortBy, goingCounts]);

  const totalMatching = discoverSortedEvents.length;

  const displayedEvents = useMemo(() => {
    return discoverSortedEvents.slice(0, listVisibleCount);
  }, [discoverSortedEvents, listVisibleCount]);

  const showShowMore = !loading && totalMatching > displayedEvents.length;

  const handleShowMore = useCallback(() => {
    const nextCount = Math.min(listVisibleCount + DISCOVER_PAGE_SIZE, discoverSortedEvents.length);
    setListVisibleCount(nextCount);
  }, [listVisibleCount, discoverSortedEvents.length]);

  return (
    <Screen padding={false} topPadding={0}>
      <Stack.Screen options={{ headerShown: false }} />
      <StackScreenTopBar
        title="Discover"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => setShowJoinModal(true)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              backgroundColor: colors.surfaceLight,
              borderRadius: radius.full,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              overflow: "hidden",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.medium,
                color: colors.text,
              }}
              numberOfLines={1}
            >
              Join +
            </Text>
          </Pressable>
        }
      />
      <FlatList
        data={loading ? [] : displayedEvents}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ marginBottom: GRID_GAP, gap: GRID_GAP }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingHorizontal: LIST_PADDING_H,
          paddingBottom: spacing.xxl,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <>
            <Text
              style={{
                fontSize: typography.sizes.xs,
                color: colors.textMuted,
                letterSpacing: 0.5,
                marginBottom: spacing.lg,
              }}
            >
              Browse public events
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "stretch",
                gap: spacing.md,
                marginBottom: spacing.xl,
              }}
            >
              <View style={{ flex: 1, position: "relative", minHeight: 44 }}>
                <TextInput
                  placeholder="Search by title or location..."
                  placeholderTextColor={colors.textDim}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{
                    backgroundColor: colors.surfaceLight,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    paddingRight: searchQuery.length > 0 ? 44 : spacing.lg,
                    fontSize: typography.sizes.md,
                    color: colors.text,
                    minHeight: 44,
                    height: 44,
                    textAlignVertical: "center",
                    borderWidth: 0,
                  }}
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    hitSlop={8}
                    style={{
                      position: "absolute",
                      right: spacing.md,
                      top: 0,
                      bottom: 0,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, color: colors.textMuted }}>×</Text>
                  </Pressable>
                )}
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
          </>
        }
        ListFooterComponent={
          showShowMore ? (
            <View style={{ width: "100%" }}>
              <Pressable
                onPress={handleShowMore}
                style={{
                  paddingVertical: spacing.lg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.semibold,
                    color: colors.primary,
                  }}
                >
                  Show more
                </Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: spacing.md, fontSize: typography.sizes.sm, color: colors.textMuted }}>
                Loading public events...
              </Text>
            </View>
          ) : (
            <Card>
              <Text
                style={{
                  fontSize: typography.sizes.sm,
                  color: colors.textMuted,
                  textAlign: "center",
                }}
              >
                {searchQuery.trim()
                  ? "No events match your search."
                  : "No public events available right now. Check back later!"}
              </Text>
            </Card>
          )
        }
        renderItem={({ item: event }) => {
          const eventForCard = userEventsById.get(event.id) ?? event;
          return (
            <View style={{ width: gridCardWidth }}>
              <EventCard
                eventId={event.id}
                title={event.title}
                dateTime={formatEventDateForCards(event.dateTime)}
                eventType={event.eventType}
                coverKey={event.coverKey}
                coverUrl={event.coverUrl}
                onPress={() => handleEventPress(event)}
                statusPill={userPhone ? getEventStatusPill(eventForCard, userPhone) : undefined}
                cancelled={eventForCard.status === "cancelled"}
                isHost={areSamePhone(eventForCard.hostPhone, userPhone)}
                width={gridCardWidth}
                posterHeight={215}
                compact
                pendingRsvpCount={eventForCard.pendingRsvpCount}
              />
            </View>
          );
        }}
      />

      <JoinWithCodeModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={(id, eventType) => {
          if (eventType && userPhone) recordJoinWithCode(eventType as EventType, userPhone);
          router.push({ pathname: "/events/[id]", params: { id } });
        }}
      />

      <SortSheet
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        value={sortBy}
        onSelect={setSortBy}
      />
    </Screen>
  );
}

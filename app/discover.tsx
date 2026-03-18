import { View, Text, ScrollView, FlatList, ActivityIndicator, Pressable, TextInput, useWindowDimensions } from "react-native";
import { router, useFocusEffect, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { useEvents, Event } from "../src/state/eventsStore";
import { Screen } from "../src/components/Screen";
import { HeaderBackTextButton } from "../src/components/HeaderBackTextButton";
import { Card } from "../src/components/Card";
import { EventCard } from "../src/components/EventCard";
import { JoinWithCodeModal } from "../src/components/JoinWithCodeModal";
import { SortSheet, type SortOption } from "../src/components/SortSheet";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";
import { radius } from "../src/theme/radius";
import { EventType } from "../src/lib/supabase";
import { recordEventView, recordJoinWithCode, getPreferenceScores, getTopEventTypes } from "../src/utils/preferences";
import { onboardingStore } from "../src/state/onboardingStore";
import { formatEventDateForCards } from "../src/utils/formatEventDate";
import { getEventStatusPill } from "../src/utils/eventStatusPill";

const LIST_PADDING_H = 16;
const GRID_GAP = 12;

/** Tab order for Discover: All + event types (Open-style). */
const DISCOVER_TABS: Array<{ value: EventType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "party", label: "Party" },
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "graduation", label: "Graduation" },
  { value: "majlis", label: "Majlis" },
  { value: "istiraha", label: "Istiraha" },
  { value: "ramadan", label: "Ramadan" },
];

const VALID_EVENT_TYPES = new Set<EventType | "all">([
  "all",
  "party",
  "birthday",
  "wedding",
  "graduation",
  "majlis",
  "istiraha",
  "ramadan",
]);

export default function DiscoverScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const gridCardWidth = (screenWidth - LIST_PADDING_H * 2 - GRID_GAP) / 2;

  const { fetchPublicEvents, events: userEvents, fetchEvents } = useEvents();
  const params = useLocalSearchParams<{ type?: string }>();
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const userEventsById = new Map((userEvents ?? []).map((e) => [e.id, e]));

  const initialType =
    params.type && VALID_EVENT_TYPES.has(params.type as EventType) && params.type !== "all"
      ? (params.type as EventType)
      : "all";

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<EventType | "all">(initialType);
  const [sortBy, setSortBy] = useState<SortOption>("soonest");
  const appliedParamRef = useRef(params.type ?? null);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("");
  const [prefScores, setPrefScores] = useState<Partial<Record<EventType, number>>>({});
  const [topEventTypes, setTopEventTypes] = useState<Array<{ type: EventType; score: number }>>([]);

  useFocusEffect(
    useCallback(() => {
      // Apply type param if it changed since last focus (e.g. navigated from Home vibe chip)
      if (params.type && params.type !== appliedParamRef.current) {
        if (VALID_EVENT_TYPES.has(params.type as EventType) && params.type !== "all") {
          setSelectedType(params.type as EventType);
        }
        appliedParamRef.current = params.type;
      }

      let active = true;
      setLoading(true);

      (async () => {
        const phone = (await onboardingStore.getPhone()) ?? "";
        if (!active) return;
        setUserPhone(phone);
        const [events, scores, topTypes] = await Promise.all([
          fetchPublicEvents(),
          getPreferenceScores(phone),
          getTopEventTypes(phone, 3),
          fetchEvents(),
        ]);
        if (active) {
          setPublicEvents(events);
          setPrefScores(scores);
          setTopEventTypes(topTypes);
          setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [fetchPublicEvents, params.type])
  );

  const handleEventPress = (event: Event) => {
    if (event.eventType) recordEventView(event.eventType, userPhone);
    router.push({
      pathname: "/events/[id]",
      params: { id: event.id },
    });
  };

  // Filter and sort logic
  const getFilteredAndSortedEvents = (): Event[] => {
    let filtered = publicEvents;

    // 1. Apply search filter (title or location)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event) => {
        const title = event.title.toLowerCase();
        const location = (event.location || "").toLowerCase();
        return title.includes(query) || location.includes(query);
      });
    }

    // 2. Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((event) => event.eventType === selectedType);
    }

    // 3. Filter out past events only when sorting by "Soonest" (not for Newest)
    if (sortBy === "soonest") {
      const now = new Date();
      filtered = filtered.filter((event) => new Date(event.dateTime) >= now);
    }

    // 4. Sort: Soonest = by dateTime ascending; Newest = by createdAt descending (fallback to dateTime if no createdAt)
    const sorted = [...filtered].sort((a, b) => {
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

    return sorted;
  };

  const filteredEvents = getFilteredAndSortedEvents();

  /**
   * Blended recommendations: only when selectedType === "All". Show 2 from T1, then 2 from T2
   * (if T2 exists and score >= 3), then the rest in normal order. No duplicates. Types only count
   * as preferred if score >= 3.
   */
  function applyPreferenceOrder(
    events: Event[],
    topTypes: Array<{ type: EventType; score: number }>,
    typeFilter: EventType | "all",
    search: string
  ): Event[] {
    if (typeFilter !== "all" || search.trim() !== "") return events;

    const preferred = topTypes.filter((t) => t.score >= 3);
    const t1 = preferred[0];
    if (!t1) return events;
    const t2 = preferred[1]; // may be undefined

    const buckets = new Map<EventType, Event[]>();
    for (const e of events) {
      const t = e.eventType ?? "party";
      if (!buckets.has(t)) buckets.set(t, []);
      buckets.get(t)!.push(e);
    }

    const picked: Event[] = [];
    const take = (type: EventType, n: number) => {
      const list = buckets.get(type) ?? [];
      for (let i = 0; i < n && i < list.length; i++) picked.push(list[i]);
    };
    take(t1.type, 2);
    if (t2) take(t2.type, 2);

    const pickedIds = new Set(picked.map((e) => e.id));
    const remaining = events.filter((e) => !pickedIds.has(e.id));
    return [...picked, ...remaining];
  }

  const displayedEvents = applyPreferenceOrder(
    filteredEvents,
    topEventTypes,
    selectedType,
    searchQuery
  );

  return (
    <Screen padding={false} topPadding={spacing.sm}>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: () => (
            <HeaderBackTextButton label="Back" onPress={() => router.back()} />
          ),
          headerRight: () => (
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
          ),
        }}
      />
      <FlatList
        data={loading ? [] : displayedEvents}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ marginBottom: GRID_GAP, gap: GRID_GAP }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: LIST_PADDING_H,
          paddingBottom: spacing.xxl,
        }}
        ListHeaderComponent={
          <>
            <Text
              style={{
                fontSize: typography.sizes.xl,
                fontWeight: typography.weights.bold,
                color: colors.text,
                marginBottom: spacing.xs,
              }}
            >
              Discover
            </Text>
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

            <View style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.lg, paddingHorizontal: spacing.sm }}
              >
                {DISCOVER_TABS.map((tab) => {
                  const isSelected = selectedType === tab.value;
                  return (
                    <Pressable
                      key={tab.value}
                      onPress={() => setSelectedType(tab.value)}
                      style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.xs }}
                    >
                      <View
                        style={{
                          alignSelf: "flex-start",
                          borderBottomWidth: 3,
                          borderBottomColor: isSelected ? colors.text : "transparent",
                          paddingBottom: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: typography.sizes.sm,
                            color: isSelected ? colors.text : colors.textMuted,
                            fontWeight: isSelected ? typography.weights.semibold : typography.weights.medium,
                          }}
                        >
                          {tab.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </>
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
                  : selectedType !== "all"
                    ? `No ${DISCOVER_TABS.find((o) => o.value === selectedType)?.label ?? selectedType} events available.`
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
                isHost={eventForCard.hostPhone === userPhone}
                width={gridCardWidth}
                posterHeight={215}
                compact
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

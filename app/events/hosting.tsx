import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams, Stack, useFocusEffect } from "expo-router";
import { useEvents, type Event } from "../../src/state/eventsStore";
import { onboardingStore } from "../../src/state/onboardingStore";
import { EventCard } from "../../src/components/EventCard";
import { SortSheet, type SortOption } from "../../src/components/SortSheet";
import { AppButton } from "../../src/components/AppButton";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";
import { formatEventDate } from "../../src/utils/formatEventDate";

type Segment = "upcoming" | "past";

type StatusPill = { label: string; color: string; bg: string };

function getStatusPill(event: Event, userPhone: string): StatusPill {
  if (event.hostPhone === userPhone) {
    return { label: "Host", color: colors.primary, bg: colors.primaryLight20 };
  }
  switch (event.attendingStatus) {
    case "going":
      return { label: "Going", color: colors.mint, bg: "rgba(78,205,196,0.15)" };
    case "pending":
      return { label: "Pending", color: colors.warning, bg: "rgba(255,165,2,0.15)" };
    default:
      return { label: "Host", color: colors.primary, bg: colors.primaryLight20 };
  }
}

export default function HostingScreen() {
  const { segment } = useLocalSearchParams<{ segment?: Segment }>();
  const segmentVal = (segment ?? "upcoming") as Segment;
  const isPast = segmentVal === "past";
  const defaultSort: SortOption = isPast ? "newest" : "soonest";

  const { events: eventsFromStore, loading, fetchEvents } = useEvents();
  const events = eventsFromStore ?? [];
  const [userPhone, setUserPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>(defaultSort);
  const [showSortModal, setShowSortModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      onboardingStore.getPhone().then((ph) => setUserPhone(ph || ""));
      fetchEvents();
    }, [fetchEvents])
  );

  useEffect(() => {
    setSortBy(segmentVal === "past" ? "newest" : "soonest");
  }, [segmentVal]);

  const nowMs = Date.now();
  const valid = events.filter((e): e is Event => Boolean(e?.id && e?.dateTime));
  const bySegment = valid.filter((e) => {
    const ms = new Date(e.dateTime).getTime();
    return isPast ? ms < nowMs : ms >= nowMs;
  });
  const hosting = bySegment.filter((e) => e.hostPhone === userPhone);
  const bySearch = searchQuery.trim()
    ? hosting.filter((e) =>
        e.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : hosting;
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

  const countLabel =
    segmentVal === "upcoming"
      ? `${sorted.length} upcoming event${sorted.length === 1 ? "" : "s"}`
      : `${sorted.length} event${sorted.length === 1 ? "" : "s"}`;

  const handleEventPress = (event: Event) => {
    const isHost = event.hostPhone === userPhone;
    router.push({
      pathname: "/events/[id]",
      params: {
        id: event.id,
        mode: isHost ? "host" : "guest",
        title: event.title,
        dateTime: event.dateTime,
        location: event.location || "",
        details: event.details || "",
        capacity: event.capacity || "",
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: "Hosting", headerBackTitle: "Events" }} />
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
        {/* Count under title */}
        {!loading && (
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: colors.textMuted,
              marginBottom: spacing.lg,
            }}
          >
            {countLabel}
          </Text>
        )}

        {/* Search + Sort row (same as Saved) */}
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
              No hosted events yet
            </Text>
            <AppButton
              title="Create an event"
              onPress={() => router.push("/events/create")}
              variant="coral"
              size="md"
              style={{ marginTop: spacing.sm }}
            />
          </View>
        )}

        {!loading &&
          sorted.map((event) => (
            <View key={event.id} style={{ marginBottom: spacing.lg, opacity: isPast ? 0.55 : 1 }}>
              <EventCard
                eventId={event.id}
                title={event.title}
                dateTime={formatEventDate(event.dateTime)}
                eventType={event.eventType}
                coverKey={event.coverKey}
                coverUrl={event.coverUrl}
                onPress={() => handleEventPress(event)}
                statusPill={userPhone ? getStatusPill(event, userPhone) : undefined}
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

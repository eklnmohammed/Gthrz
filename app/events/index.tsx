import { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { router, useFocusEffect, Stack } from "expo-router";
import { useEvents, type Event } from "../../src/state/eventsStore";
import { onboardingStore } from "../../src/state/onboardingStore";
import { Screen } from "../../src/components/Screen";
import { HeaderBackTextButton } from "../../src/components/HeaderBackTextButton";
import { HeaderTextButton } from "../../src/components/HeaderTextButton";
import { AppButton } from "../../src/components/AppButton";
import { Card } from "../../src/components/Card";
import { EventCard } from "../../src/components/EventCard";
import { HomeSectionHeader } from "../../src/components/HomeSectionHeader";
import { JoinWithCodeModal } from "../../src/components/JoinWithCodeModal";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";
import { formatEventDateForCards } from "../../src/utils/formatEventDate";
import { getEventStatusPill } from "../../src/utils/eventStatusPill";
import { areSamePhone } from "../../src/utils/phone";

type Segment = "upcoming" | "past";

export default function EventsScreen() {
  const { events: eventsFromStore, loading, error, fetchEvents } = useEvents();
  const events = eventsFromStore ?? [];
  const [userPhone, setUserPhone] = useState<string>("");
  const [segment, setSegment] = useState<Segment>("upcoming");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const phone = (await onboardingStore.getPhone()) || "";
        setUserPhone(phone);
        fetchEvents();
      };
      load();
    }, [fetchEvents])
  );

  const nowMs = Date.now();

  const validEvents = events.filter((e): e is Event => Boolean(e?.id && e?.dateTime));

  const sortUpcoming = (a: Event, b: Event) => {
    const aActive = a.status !== "cancelled";
    const bActive = b.status !== "cancelled";
    if (aActive !== bActive) return aActive ? -1 : 1;
    return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
  };

  const hasAnyUpcomingHosting = validEvents.some((e) => {
    const isFuture = new Date(e.dateTime).getTime() >= nowMs;
    return isFuture && areSamePhone(e.hostPhone, userPhone);
  });

  const upcomingHosting = validEvents
    .filter((e) => {
      const isFuture = new Date(e.dateTime).getTime() >= nowMs;
      return isFuture && areSamePhone(e.hostPhone, userPhone) && e.status !== "cancelled";
    })
    .sort(sortUpcoming);

  const hasAnyUpcomingGoingOrPending = validEvents.some((e) => {
    const isFuture = new Date(e.dateTime).getTime() >= nowMs;
    const isGuest = !areSamePhone(e.hostPhone, userPhone);
    const rsvp = e.attendingStatus === "going" || e.attendingStatus === "pending";
    return isFuture && isGuest && rsvp;
  });

  const upcomingGoingOrPending = validEvents
    .filter((e) => {
      const isFuture = new Date(e.dateTime).getTime() >= nowMs;
      const isGuest = !areSamePhone(e.hostPhone, userPhone);
      const rsvp = e.attendingStatus === "going" || e.attendingStatus === "pending";
      return isFuture && isGuest && rsvp && e.status !== "cancelled";
    })
    .sort(sortUpcoming);

  const past = validEvents
    .filter((e) => new Date(e.dateTime).getTime() < nowMs)
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  const handleEventPress = (event: Event) => {
    router.push({
      pathname: "/events/[id]",
      params: {
        id: event.id,
        title: event.title,
        dateTime: event.dateTime,
        location: event.location || "",
        details: event.details || "",
        capacity: event.capacity || "",
      },
    });
  };

  return (
    <Screen padding={false} topPadding={spacing.sm}>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: () => (
            <HeaderBackTextButton label="Back" onPress={() => router.back()} />
          ),
          headerRight: () => (
            <HeaderTextButton label="Create" onPress={() => router.push("/events/create")} />
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: spacing.sm,
          paddingHorizontal: spacing.xxl,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading */}
        {loading && (
          <View style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: spacing.md, fontSize: typography.sizes.sm, color: colors.textMuted }}>
              Loading events...
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <Card>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.error, textAlign: "center" }}>
              Error: {error}
            </Text>
          </Card>
        )}

        {/* Segmented control: Upcoming | Past */}
        {!loading && !error && (
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surfaceLight,
              borderRadius: radius.lg,
              padding: 4,
              marginBottom: spacing.lg,
            }}
          >
            <Pressable
              onPress={() => setSegment("upcoming")}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: segment === "upcoming" ? colors.surface : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: typography.sizes.sm,
                  fontWeight: segment === "upcoming" ? typography.weights.semibold : typography.weights.medium,
                  color: segment === "upcoming" ? colors.text : colors.textMuted,
                }}
              >
                Upcoming
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSegment("past")}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: segment === "past" ? colors.surface : "transparent",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: typography.sizes.sm,
                  fontWeight: segment === "past" ? typography.weights.semibold : typography.weights.medium,
                  color: segment === "past" ? colors.text : colors.textMuted,
                }}
              >
                Past
              </Text>
            </Pressable>
          </View>
        )}

        {/* Content: Upcoming (carousels) or Past (vertical list) */}
        {!loading && !error && segment === "upcoming" && (
          <>
            {/* Hosting */}
            <View style={{ marginBottom: spacing.lg }}>
              <HomeSectionHeader
                title="Hosting"
                action={
                  hasAnyUpcomingHosting
                    ? { label: "See all", onPress: () => router.push({ pathname: "/events/hosting", params: { segment } }) }
                    : undefined
                }
              />
              {upcomingHosting.length === 0 ? (
                <Card
                  style={{
                    paddingVertical: spacing.xl,
                    paddingHorizontal: spacing.lg,
                    alignItems: "center",
                    borderWidth: 0.5,
                    borderColor: colors.border,
                  }}
                >
                  {hasAnyUpcomingHosting ? (
                    <>
                      <Text
                        style={{
                          fontSize: typography.sizes.lg,
                          fontWeight: typography.weights.semibold,
                          color: colors.text,
                          marginBottom: spacing.xs,
                        }}
                      >
                        No active events
                      </Text>
                      <Text
                        style={{
                          fontSize: typography.sizes.sm,
                          color: colors.textMuted,
                          marginBottom: spacing.lg,
                          textAlign: "center",
                        }}
                      >
                        View your cancelled events in See all.
                      </Text>
                      <AppButton
                        title="See all"
                        onPress={() => router.push({ pathname: "/events/hosting", params: { segment } })}
                        variant="coral"
                        size="md"
                      />
                    </>
                  ) : (
                    <>
                      <Text
                        style={{
                          fontSize: typography.sizes.lg,
                          fontWeight: typography.weights.semibold,
                          color: colors.text,
                          marginBottom: spacing.xs,
                        }}
                      >
                        No events yet
                      </Text>
                      <Text
                        style={{
                          fontSize: typography.sizes.sm,
                          color: colors.textMuted,
                          marginBottom: spacing.lg,
                          textAlign: "center",
                        }}
                      >
                        Create your first event to start inviting people.
                      </Text>
                      <AppButton
                        title="Create event"
                        onPress={() => router.push("/events/create")}
                        variant="coral"
                        size="md"
                      />
                    </>
                  )}
                </Card>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.md }}
                >
                  {[...upcomingHosting].slice(0, 3).map((event) => (
                    <EventCard
                      key={event.id}
                      eventId={event.id}
                      title={event.title}
                      dateTime={formatEventDateForCards(event.dateTime)}
                      eventType={event.eventType}
                      coverKey={event.coverKey}
                      coverUrl={event.coverUrl}
                      onPress={() => handleEventPress(event)}
                      statusPill={userPhone ? getEventStatusPill(event, userPhone) : undefined}
                      cancelled={event.status === "cancelled"}
                      width={260}
                      isHost
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Going / Pending */}
            <View style={{ marginBottom: spacing.lg }}>
              <HomeSectionHeader
                title="Going / Pending"
                action={
                  hasAnyUpcomingGoingOrPending
                    ? { label: "See all", onPress: () => router.push({ pathname: "/events/going", params: { segment } }) }
                    : undefined
                }
              />
              {upcomingGoingOrPending.length === 0 ? (
                <Card
                  style={{
                    paddingVertical: spacing.xl,
                    paddingHorizontal: spacing.lg,
                    alignItems: "center",
                    borderWidth: 0.5,
                    borderColor: colors.border,
                  }}
                >
                  {hasAnyUpcomingGoingOrPending ? (
                    <>
                      <Text
                        style={{
                          fontSize: typography.sizes.lg,
                          fontWeight: typography.weights.semibold,
                          color: colors.text,
                          marginBottom: spacing.xs,
                        }}
                      >
                        No active events
                      </Text>
                      <Text
                        style={{
                          fontSize: typography.sizes.sm,
                          color: colors.textMuted,
                          marginBottom: spacing.lg,
                          textAlign: "center",
                        }}
                      >
                        View your cancelled events in See all.
                      </Text>
                      <AppButton
                        title="See all"
                        onPress={() => router.push({ pathname: "/events/going", params: { segment } })}
                        variant="coral"
                        size="md"
                      />
                    </>
                  ) : (
                    <>
                      <Text
                        style={{
                          fontSize: typography.sizes.lg,
                          fontWeight: typography.weights.semibold,
                          color: colors.text,
                          marginBottom: spacing.xs,
                        }}
                      >
                        No invites yet
                      </Text>
                      <Text
                        style={{
                          fontSize: typography.sizes.sm,
                          color: colors.textMuted,
                          marginBottom: spacing.lg,
                          textAlign: "center",
                        }}
                      >
                        Join with a code or discover public events.
                      </Text>
                      <AppButton
                        title="Join with code"
                        onPress={() => setShowJoinModal(true)}
                        variant="coral"
                        size="md"
                      />
                    </>
                  )}
                </Card>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.md }}
                >
                  {[...upcomingGoingOrPending].slice(0, 3).map((event) => (
                    <EventCard
                      key={event.id}
                      eventId={event.id}
                      title={event.title}
                      dateTime={formatEventDateForCards(event.dateTime)}
                      eventType={event.eventType}
                      coverKey={event.coverKey}
                      coverUrl={event.coverUrl}
                      onPress={() => handleEventPress(event)}
                      statusPill={userPhone ? getEventStatusPill(event, userPhone) : undefined}
                      cancelled={event.status === "cancelled"}
                      width={260}
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          </>
        )}

        {!loading && !error && segment === "past" && (
          <>
            {past.length === 0 ? (
              <View
                style={{
                  paddingVertical: spacing.xl,
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>
                  No past events.
                </Text>
              </View>
            ) : (
              past.map((event) => (
                <View key={event.id} style={{ opacity: 0.55, marginBottom: spacing.md }}>
                  <EventCard
                    eventId={event.id}
                    title={event.title}
                    dateTime={formatEventDateForCards(event.dateTime)}
                    eventType={event.eventType}
                    coverKey={event.coverKey}
                    coverUrl={event.coverUrl}
                    onPress={() => handleEventPress(event)}
                    statusPill={userPhone ? getEventStatusPill(event, userPhone) : undefined}
                    cancelled={event.status === "cancelled"}
                    isHost={areSamePhone(event.hostPhone, userPhone)}
                  />
                </View>
              ))
            )}
          </>
        )}

        {/* Create Event CTA (only when Upcoming is selected) */}
        {segment === "upcoming" && (
          <AppButton
            title="Create Event +"
            onPress={() => router.push("/events/create")}
            variant="coral"
            size="lg"
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        )}
      </ScrollView>
      <JoinWithCodeModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={(id) => {
          setShowJoinModal(false);
          fetchEvents();
          router.push({ pathname: "/events/[id]", params: { id } });
        }}
      />
    </Screen>
  );
}

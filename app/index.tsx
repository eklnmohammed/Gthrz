import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { BottomNavBar } from "../src/components/BottomNavBar";
import { EventCard } from "../src/components/EventCard";
import { HomeSectionHeader } from "../src/components/HomeSectionHeader";
import { JoinWithCodeModal } from "../src/components/JoinWithCodeModal";
import { onboardingStore } from "../src/state/onboardingStore";
import { syncCurrentProfileFromServer } from "../src/lib/auth";
import { useEvents, type Event } from "../src/state/eventsStore";
import { getTopPreferencedTypes, recordEventView, recordJoinWithCode } from "../src/utils/preferences";
import { EventType } from "../src/lib/supabase";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { radius } from "../src/theme/radius";
import { typography } from "../src/theme/typography";
import { formatEventDateForCards } from "../src/utils/formatEventDate";
import { getEventStatusPill } from "../src/utils/eventStatusPill";
import { compareEventsDefaultChronological } from "../src/utils/eventListOrdering";
import { areSamePhone } from "../src/utils/phone";

const CARD_WIDTH = 260;
const CTA_HEIGHT = 56;
const SECTION_GAP = spacing.xxl; // 24px

export default function Home() {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState<string>("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string>("");
  const { events: upNextEvents, fetchEvents, fetchPublicEvents } = useEvents();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const [topPreferencedTypes, setTopPreferencedTypes] = useState<EventType[]>([]);

  useFocusEffect(
    useCallback(() => {
      syncCurrentProfileFromServer().then(() =>
        onboardingStore.getProfile().then((p) => {
          setFirstName(p?.firstName?.trim() || "");
          setAvatarUri(p?.avatarUri ?? null);
        })
      );
      fetchEvents();
      onboardingStore.getPhone().then((ph) => {
        const phone = ph || "";
        setUserPhone(phone);
        Promise.all([fetchPublicEvents(), getTopPreferencedTypes(phone, 5)]).then(([events, types]) => {
          setPublicEvents(events);
          setTopPreferencedTypes(types);
        });
      });
    }, [fetchEvents, fetchPublicEvents])
  );

  const now = Date.now();
  const userEventsById = new Map(upNextEvents.map((e) => [e.id, e]));

  const upNextFiltered = upNextEvents.filter((e) => {
    const startMs = new Date(e.dateTime).getTime();
    if (Number.isNaN(startMs) || startMs < now) return false;
    return (
      e.status !== "cancelled" &&
      (areSamePhone(e.hostPhone, userPhone) ||
        e.attendingStatus === "going" ||
        e.attendingStatus === "pending" ||
        (e.attendingStatus === "cant" && e.declinedByHost))
    );
  });

  const upNextIds = new Set(upNextFiltered.map((e) => e.id));
  const upNextSorted = [...upNextFiltered].sort((a, b) => compareEventsDefaultChronological(a, b, now));

  const recommendedEvents = (() => {
    if (topPreferencedTypes.length === 0) return [];
    const futurePublic = publicEvents.filter((e) => {
      const t = new Date(e.dateTime).getTime();
      return (
        !Number.isNaN(t) &&
        t >= now &&
        e.status !== "cancelled" &&
        !upNextIds.has(e.id)
      );
    });
    const pickFromType = (type: EventType, count: number): Event[] =>
      futurePublic
        .filter((e) => e.eventType === type)
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
        .slice(0, count);
    const seen = new Set<string>();
    const result: Event[] = [];
    const add = (picks: Event[]) => {
      for (const e of picks) {
        if (!seen.has(e.id)) { seen.add(e.id); result.push(e); }
      }
    };
    if (topPreferencedTypes.length >= 2) {
      add(pickFromType(topPreferencedTypes[0], 2));
      add(pickFromType(topPreferencedTypes[1], 1));
    } else {
      add(pickFromType(topPreferencedTypes[0], 3));
    }
    return result;
  })();

  const featuredEvents = publicEvents
    .filter((e) => {
      const t = new Date(e.dateTime).getTime();
      return !Number.isNaN(t) && t >= now && e.status !== "cancelled" && !upNextIds.has(e.id);
    })
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(0, 3);

  const greeting = firstName ? `Hey, ${firstName}.` : "Hey there.";

  const handleEventPress = (event: {
    id: string;
    title: string;
    dateTime: string;
    location?: string;
    details?: string;
    capacity?: string;
    hostPhone?: string;
    attendingStatus?: "going" | "pending" | "maybe" | "cant";
  }) => {
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

  /** True when user has no upcoming relevant events (same basis as Up Next), not raw store count. */
  const hasNoEvents = upNextFiltered.length === 0;
  const showRecommended = recommendedEvents.length > 0;

  const goToFeaturedDiscover = () => {
    // Discover currently has no dedicated "featured" filter param.
    router.push("/discover");
  };

  const goToRecommendedDiscover = () => {
    router.push("/discover");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.xxl,
          paddingTop: Math.max(insets.top, 12) + spacing.xxl,
          paddingBottom: spacing.xxxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header (avatar + greeting) */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: SECTION_GAP,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.surfaceLight,
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text
                style={{
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                  color: colors.primary,
                }}
              >
                {firstName ? firstName.charAt(0).toUpperCase() : "👤"}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text
              style={{
                fontSize: typography.sizes.xl,
                fontWeight: typography.weights.bold,
                color: colors.text,
                letterSpacing: -0.3,
              }}
            >
              {greeting}
            </Text>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 2 }}>
              Ready to plan something?
            </Text>
          </View>
        </View>

        {/* 2. Primary CTA: Create Event (solid, height 56, large radius) */}
        <Pressable
          onPress={() => router.push("/events/create")}
          style={({ pressed }) => ({
            height: CTA_HEIGHT,
            borderRadius: radius.xl,
            backgroundColor: colors.primary,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: spacing.sm,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.semibold,
              color: colors.text,
            }}
          >
            Create Event +
          </Text>
        </Pressable>

        {/* 3. Secondary CTA: Join with code (outline, same size) */}
        <Pressable
          onPress={() => setShowJoinModal(true)}
          style={({ pressed }) => ({
            height: CTA_HEIGHT,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "transparent",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: SECTION_GAP,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.semibold,
              color: colors.primary,
            }}
          >
            Join with code
          </Text>
        </Pressable>

        {/* 4. New users: Featured this week. Returning users: Up Next + (Recommended OR Featured) only */}
        {hasNoEvents ? (
          featuredEvents.length > 0 && (
            <View style={{ marginBottom: SECTION_GAP }}>
              <HomeSectionHeader
                title="Featured this week"
                action={{ label: "See all", onPress: goToFeaturedDiscover }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + spacing.lg}
                decelerationRate="fast"
                contentContainerStyle={{ gap: spacing.lg, paddingRight: spacing.xxl }}
              >
                {featuredEvents.map((event) => {
                  const eventForCard = userEventsById.get(event.id) ?? event;
                  return (
                    <EventCard
                      key={event.id}
                      eventId={event.id}
                      title={event.title}
                      dateTime={formatEventDateForCards(event.dateTime)}
                      eventType={event.eventType}
                      coverKey={event.coverKey}
                      coverUrl={event.coverUrl}
                      onPress={() => {
                        if (event.eventType) recordEventView(event.eventType, userPhone);
                        router.push({ pathname: "/events/[id]", params: { id: event.id } });
                      }}
                      statusPill={userPhone ? getEventStatusPill(eventForCard, userPhone) : undefined}
                      cancelled={eventForCard.status === "cancelled"}
                      isHost={areSamePhone(eventForCard.hostPhone, userPhone)}
                      width={CARD_WIDTH}
                    />
                  );
                })}
              </ScrollView>
            </View>
          )
        ) : (
          <>
            {/* Returning: section 1 — Up Next */}
            <View style={{ marginBottom: SECTION_GAP }}>
              <HomeSectionHeader
                title="Up Next"
                action={{ label: "See all", onPress: () => router.push("/events") }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + spacing.lg}
                decelerationRate="fast"
                contentContainerStyle={{ gap: spacing.lg, paddingRight: spacing.xxl }}
              >
                {upNextSorted.slice(0, 3).map((event) => (
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
                    width={CARD_WIDTH}
                    isHost={areSamePhone(event.hostPhone, userPhone)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Returning: section 2 — Recommended if we have prefs, otherwise Featured this week */}
            {showRecommended ? (
              <View style={{ marginBottom: SECTION_GAP }}>
                <HomeSectionHeader
                  title="Recommended for you"
                  action={{ label: "See all", onPress: goToRecommendedDiscover }}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={CARD_WIDTH + spacing.lg}
                  decelerationRate="fast"
                  contentContainerStyle={{ gap: spacing.lg, paddingRight: spacing.xxl }}
                >
                  {recommendedEvents.slice(0, 3).map((event) => {
                    const eventForCard = userEventsById.get(event.id) ?? event;
                    return (
                      <EventCard
                        key={event.id}
                        eventId={event.id}
                        title={event.title}
                        dateTime={formatEventDateForCards(event.dateTime)}
                        eventType={event.eventType}
                        coverKey={event.coverKey}
                        coverUrl={event.coverUrl}
                        onPress={() => {
                          if (event.eventType) recordEventView(event.eventType, userPhone);
                          router.push({ pathname: "/events/[id]", params: { id: event.id } });
                        }}
                        statusPill={userPhone ? getEventStatusPill(eventForCard, userPhone) : undefined}
                        cancelled={eventForCard.status === "cancelled"}
                        isHost={areSamePhone(eventForCard.hostPhone, userPhone)}
                        width={CARD_WIDTH}
                      />
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              featuredEvents.length > 0 && (
                <View style={{ marginBottom: SECTION_GAP }}>
                  <HomeSectionHeader
                    title="Featured this week"
                    action={{ label: "See all", onPress: goToFeaturedDiscover }}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={CARD_WIDTH + spacing.lg}
                    decelerationRate="fast"
                    contentContainerStyle={{ gap: spacing.lg, paddingRight: spacing.xxl }}
                  >
                    {featuredEvents.map((event) => {
                      const eventForCard = userEventsById.get(event.id) ?? event;
                      return (
                        <EventCard
                          key={event.id}
                          eventId={event.id}
                          title={event.title}
                          dateTime={formatEventDateForCards(event.dateTime)}
                          eventType={event.eventType}
                          coverKey={event.coverKey}
                          coverUrl={event.coverUrl}
                          onPress={() => {
                            if (event.eventType) recordEventView(event.eventType, userPhone);
                            router.push({ pathname: "/events/[id]", params: { id: event.id } });
                          }}
                          statusPill={userPhone ? getEventStatusPill(eventForCard, userPhone) : undefined}
                          cancelled={eventForCard.status === "cancelled"}
                          isHost={areSamePhone(eventForCard.hostPhone, userPhone)}
                          width={CARD_WIDTH}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              )
            )}
          </>
        )}
      </ScrollView>

      <JoinWithCodeModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={(id, eventType) => {
          if (eventType && userPhone) recordJoinWithCode(eventType as EventType, userPhone);
          router.push({ pathname: "/events/[id]", params: { id } });
        }}
      />

      <BottomNavBar
        activeLabel="Home"
        onCreatePress={() => router.push("/events/create")}
        onEventsPress={() => router.push("/events")}
        onProfilePress={() => router.push("/profile")}
        onDiscoverPress={() => router.push("/discover")}
      />
    </View>
  );
}

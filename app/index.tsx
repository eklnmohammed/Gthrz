import { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, Image, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { AppButton } from "../src/components/AppButton";
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
import { formatEventDate } from "../src/utils/formatEventDate";

const CARD_WIDTH = 260;
const POSTER_HEIGHT = 260;
const CTA_HEIGHT = 56;
const SECTION_GAP = spacing.xxl; // 24px

const VIBE_CHIPS = [
  { type: "party", emoji: "🎉", label: "Party" },
  { type: "birthday", emoji: "🎂", label: "Birthday" },
  { type: "wedding", emoji: "💍", label: "Wedding" },
  { type: "graduation", emoji: "🎓", label: "Graduation" },
  { type: "majlis", emoji: "☕", label: "Majlis" },
  { type: "istiraha", emoji: "🏕️", label: "Istiraha" },
  { type: "ramadan", emoji: "🌙", label: "Ramadan" },
] as const;

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

  const upNextFiltered = upNextEvents.filter(
    (e) =>
      e.status !== "cancelled" &&
      (e.hostPhone === userPhone ||
        e.attendingStatus === "going" ||
        e.attendingStatus === "pending")
  );

  const recommendedEvents = (() => {
    if (topPreferencedTypes.length === 0) return [];
    const futurePublic = publicEvents.filter((e) => new Date(e.dateTime).getTime() >= now);
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
    .filter((e) => new Date(e.dateTime).getTime() >= now)
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

  const discoverScale = useRef(new Animated.Value(1)).current;

  const hasNoEvents = upNextEvents.length === 0;
  const showRecommended = recommendedEvents.length > 0;

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

        {/* 4. Browse by vibe (above Featured) */}
        <View style={{ marginBottom: SECTION_GAP }}>
          <HomeSectionHeader title="Browse by vibe" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {VIBE_CHIPS.map((vibe) => (
              <Pressable
                key={vibe.type}
                onPress={() => router.push({ pathname: "/discover", params: { type: vibe.type } })}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  backgroundColor: colors.surfaceLight,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: typography.sizes.md }}>{vibe.emoji}</Text>
                <Text
                  style={{
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.medium,
                    color: colors.text,
                  }}
                >
                  {vibe.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* 5. New users: Featured this week. Returning users: Up Next + (Recommended OR Featured) only */}
        {hasNoEvents ? (
          featuredEvents.length > 0 && (
            <View style={{ marginBottom: SECTION_GAP }}>
              <HomeSectionHeader
                title="Featured this week"
                action={{ label: "See all", onPress: () => router.push("/discover") }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + spacing.lg}
                decelerationRate="fast"
                contentContainerStyle={{ gap: spacing.lg, paddingRight: spacing.xxl }}
              >
                {featuredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    eventId={event.id}
                    title={event.title}
                    dateTime={formatEventDate(event.dateTime)}
                    eventType={event.eventType}
                    coverKey={event.coverKey}
                    coverUrl={event.coverUrl}
                    onPress={() => {
                      if (event.eventType) recordEventView(event.eventType, userPhone);
                      router.push({ pathname: "/events/[id]", params: { id: event.id, mode: "guest" } });
                    }}
                    width={CARD_WIDTH}
                  />
                ))}
                {featuredEvents.length > 0 && (
                  <Animated.View
                    style={{
                      width: CARD_WIDTH,
                      transform: [{ scale: discoverScale }],
                      borderRadius: radius.lg,
                      overflow: "hidden",
                      shadowColor: "#6B3FFF",
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.35,
                      shadowRadius: 18,
                      elevation: 8,
                    }}
                  >
                    <Pressable
                      onPress={() => router.push("/discover")}
                      onPressIn={() =>
                        Animated.spring(discoverScale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 20 }).start()
                      }
                      onPressOut={() =>
                        Animated.spring(discoverScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }).start()
                      }
                    >
                      <LinearGradient
                        colors={["#1c1a2e", "#1e1640", "#2d1b52"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: "100%", height: POSTER_HEIGHT }}
                      >
                        <LinearGradient
                          colors={["rgba(110,70,255,0.28)", "transparent"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0.7 }}
                          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120 }}
                        />
                        <Text
                          style={{
                            position: "absolute",
                            top: spacing.md,
                            right: spacing.md,
                            fontSize: 64,
                            opacity: 0.08,
                          }}
                        >
                          ✦
                        </Text>
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.88)"]}
                          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160 }}
                        />
                        <View style={{ position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg }}>
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: typography.weights.semibold,
                              color: "rgba(180,150,255,0.85)",
                              letterSpacing: 1.5,
                              marginBottom: 6,
                            }}
                          >
                            DISCOVER
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                            <Text
                              style={{
                                fontSize: typography.sizes.lg,
                                fontWeight: typography.weights.bold,
                                color: "#fff",
                                flex: 1,
                              }}
                              numberOfLines={1}
                            >
                              Discover more
                            </Text>
                            <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.45)", marginLeft: spacing.sm }}>›</Text>
                          </View>
                          <Text
                            style={{
                              fontSize: typography.sizes.sm,
                              color: "rgba(255,255,255,0.5)",
                            }}
                            numberOfLines={1}
                          >
                            Browse public events
                          </Text>
                        </View>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                )}
              </ScrollView>
            </View>
          )
        ) : (
          <>
            {/* Returning: section 1 — Up Next + Discover CTA card */}
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
                {upNextFiltered.slice(0, 3).map((event) => (
                  <EventCard
                    key={event.id}
                    eventId={event.id}
                    title={event.title}
                    dateTime={formatEventDate(event.dateTime)}
                    eventType={event.eventType}
                    coverKey={event.coverKey}
                    coverUrl={event.coverUrl}
                    onPress={() => handleEventPress(event)}
                    showPendingStatus={event.attendingStatus === "pending"}
                    cancelled={event.status === "cancelled"}
                    width={CARD_WIDTH}
                    isHost={event.hostPhone === userPhone}
                  />
                ))}
                {upNextFiltered.length > 0 && (
                  <Animated.View
                    style={{
                      width: CARD_WIDTH,
                      transform: [{ scale: discoverScale }],
                      borderRadius: radius.lg,
                      overflow: "hidden",
                      shadowColor: "#6B3FFF",
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.35,
                      shadowRadius: 18,
                      elevation: 8,
                    }}
                  >
                    <Pressable
                      onPress={() => router.push("/events")}
                      onPressIn={() =>
                        Animated.spring(discoverScale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 20 }).start()
                      }
                      onPressOut={() =>
                        Animated.spring(discoverScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }).start()
                      }
                    >
                      <LinearGradient
                        colors={["#1c1a2e", "#1e1640", "#2d1b52"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: "100%", height: POSTER_HEIGHT }}
                      >
                        {/* Purple highlight sweep — top */}
                        <LinearGradient
                          colors={["rgba(110,70,255,0.28)", "transparent"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0.7 }}
                          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120 }}
                        />

                        {/* Watermark — top-right, very faint */}
                        <Text
                          style={{
                            position: "absolute",
                            top: spacing.md,
                            right: spacing.md,
                            fontSize: 64,
                            opacity: 0.08,
                          }}
                        >
                          ✦
                        </Text>

                        {/* Bottom scrim */}
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.88)"]}
                          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160 }}
                        />

                        {/* Text block — Your events CTA (hosting & going) */}
                        <View style={{ position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg }}>
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: typography.weights.semibold,
                              color: "rgba(180,150,255,0.85)",
                              letterSpacing: 1.5,
                              marginBottom: 6,
                            }}
                          >
                            YOUR EVENTS
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                            <Text
                              style={{
                                fontSize: typography.sizes.lg,
                                fontWeight: typography.weights.bold,
                                color: "#fff",
                                flex: 1,
                              }}
                              numberOfLines={1}
                            >
                              Your events
                            </Text>
                            <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.45)", marginLeft: spacing.sm }}>›</Text>
                          </View>
                          <Text
                            style={{
                              fontSize: typography.sizes.sm,
                              color: "rgba(255,255,255,0.5)",
                            }}
                            numberOfLines={1}
                          >
                            Hosting & going
                          </Text>
                        </View>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                )}
              </ScrollView>
            </View>

            {/* Returning: section 2 — Recommended if we have prefs, otherwise Featured this week */}
            {showRecommended ? (
              <View style={{ marginBottom: SECTION_GAP }}>
                <HomeSectionHeader title="Recommended for you" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={CARD_WIDTH + spacing.lg}
                  decelerationRate="fast"
                  contentContainerStyle={{ gap: spacing.lg, paddingRight: spacing.xxl }}
                >
                  {recommendedEvents.slice(0, 3).map((event) => (
                    <EventCard
                      key={event.id}
                      eventId={event.id}
                      title={event.title}
                      dateTime={formatEventDate(event.dateTime)}
                      eventType={event.eventType}
                      coverKey={event.coverKey}
                      coverUrl={event.coverUrl}
                      onPress={() => {
                        if (event.eventType) recordEventView(event.eventType, userPhone);
                        router.push({ pathname: "/events/[id]", params: { id: event.id, mode: "guest" } });
                      }}
                      width={CARD_WIDTH}
                    />
                  ))}
                  {recommendedEvents.length > 0 && (
                  <Animated.View
                    style={{
                      width: CARD_WIDTH,
                      transform: [{ scale: discoverScale }],
                      borderRadius: radius.lg,
                      overflow: "hidden",
                      shadowColor: "#6B3FFF",
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.35,
                      shadowRadius: 18,
                      elevation: 8,
                    }}
                  >
                    <Pressable
                      onPress={() => router.push("/discover")}
                      onPressIn={() =>
                        Animated.spring(discoverScale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 20 }).start()
                      }
                      onPressOut={() =>
                        Animated.spring(discoverScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }).start()
                      }
                    >
                      <LinearGradient
                        colors={["#1c1a2e", "#1e1640", "#2d1b52"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: "100%", height: POSTER_HEIGHT }}
                      >
                        <LinearGradient
                          colors={["rgba(110,70,255,0.28)", "transparent"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0.7 }}
                          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120 }}
                        />
                        <Text
                          style={{
                            position: "absolute",
                            top: spacing.md,
                            right: spacing.md,
                            fontSize: 64,
                            opacity: 0.08,
                          }}
                        >
                          ✦
                        </Text>
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.88)"]}
                          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160 }}
                        />
                        <View style={{ position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg }}>
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: typography.weights.semibold,
                              color: "rgba(180,150,255,0.85)",
                              letterSpacing: 1.5,
                              marginBottom: 6,
                            }}
                          >
                            DISCOVER
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                            <Text
                              style={{
                                fontSize: typography.sizes.lg,
                                fontWeight: typography.weights.bold,
                                color: "#fff",
                                flex: 1,
                              }}
                              numberOfLines={1}
                            >
                              Discover more
                            </Text>
                            <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.45)", marginLeft: spacing.sm }}>›</Text>
                          </View>
                          <Text
                            style={{
                              fontSize: typography.sizes.sm,
                              color: "rgba(255,255,255,0.5)",
                            }}
                            numberOfLines={1}
                          >
                            Browse public events
                          </Text>
                        </View>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                  )}
                </ScrollView>
              </View>
            ) : (
              featuredEvents.length > 0 && (
                <View style={{ marginBottom: SECTION_GAP }}>
                  <HomeSectionHeader
                    title="Featured this week"
                    action={{ label: "See all", onPress: () => router.push("/discover") }}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={CARD_WIDTH + spacing.lg}
                    decelerationRate="fast"
                    contentContainerStyle={{ gap: spacing.lg, paddingRight: spacing.xxl }}
                  >
                    {featuredEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        eventId={event.id}
                        title={event.title}
                        dateTime={formatEventDate(event.dateTime)}
                        eventType={event.eventType}
                        coverKey={event.coverKey}
                        coverUrl={event.coverUrl}
                        onPress={() => {
                          if (event.eventType) recordEventView(event.eventType, userPhone);
                          router.push({ pathname: "/events/[id]", params: { id: event.id, mode: "guest" } });
                        }}
                        width={CARD_WIDTH}
                      />
                    ))}
                    {featuredEvents.length > 0 && (
                      <Animated.View
                        style={{
                          width: CARD_WIDTH,
                          transform: [{ scale: discoverScale }],
                          borderRadius: radius.lg,
                          overflow: "hidden",
                          shadowColor: "#6B3FFF",
                          shadowOffset: { width: 0, height: 8 },
                          shadowOpacity: 0.35,
                          shadowRadius: 18,
                          elevation: 8,
                        }}
                      >
                        <Pressable
                          onPress={() => router.push("/discover")}
                          onPressIn={() =>
                            Animated.spring(discoverScale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 20 }).start()
                          }
                          onPressOut={() =>
                            Animated.spring(discoverScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }).start()
                          }
                        >
                          <LinearGradient
                            colors={["#1c1a2e", "#1e1640", "#2d1b52"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ width: "100%", height: POSTER_HEIGHT }}
                          >
                            <LinearGradient
                              colors={["rgba(110,70,255,0.28)", "transparent"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0.7 }}
                              style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120 }}
                            />
                            <Text
                              style={{
                                position: "absolute",
                                top: spacing.md,
                                right: spacing.md,
                                fontSize: 64,
                                opacity: 0.08,
                              }}
                            >
                              ✦
                            </Text>
                            <LinearGradient
                              colors={["transparent", "rgba(0,0,0,0.88)"]}
                              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160 }}
                            />
                            <View style={{ position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg }}>
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: typography.weights.semibold,
                                  color: "rgba(180,150,255,0.85)",
                                  letterSpacing: 1.5,
                                  marginBottom: 6,
                                }}
                              >
                                DISCOVER
                              </Text>
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                                <Text
                                  style={{
                                    fontSize: typography.sizes.lg,
                                    fontWeight: typography.weights.bold,
                                    color: "#fff",
                                    flex: 1,
                                  }}
                                  numberOfLines={1}
                                >
                                  Discover more
                                </Text>
                                <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.45)", marginLeft: spacing.sm }}>›</Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: typography.sizes.sm,
                                  color: "rgba(255,255,255,0.5)",
                                }}
                                numberOfLines={1}
                              >
                                Browse public events
                              </Text>
                            </View>
                          </LinearGradient>
                        </Pressable>
                      </Animated.View>
                    )}
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
          router.push({ pathname: "/events/[id]", params: { id, mode: "guest" } });
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

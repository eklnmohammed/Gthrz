import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ImageBackground,
  Image,
  Dimensions,
  Linking,
  TextInput,
  Share,
  Platform,
  Modal,
} from "react-native";
import { useLocalSearchParams, router, Stack, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../../src/components/AppButton";
import { Badge } from "../../src/components/Badge";
import { HeaderBackTextButton } from "../../src/components/HeaderBackTextButton";
import { HeaderTextButton } from "../../src/components/HeaderTextButton";
import { useEvents } from "../../src/state/eventsStore";
import { useFavorites } from "../../src/state/favoritesStore";
import { supabase, EventType } from "../../src/lib/supabase";
import { recordRsvp } from "../../src/utils/preferences";
import { fetchProfile } from "../../src/lib/auth";
import { onboardingStore, type UserProfile } from "../../src/state/onboardingStore";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { radius } from "../../src/theme/radius";
import { typography } from "../../src/theme/typography";
import { getEventGradient } from "../../src/utils/eventGradient";
import { getEventTypeLabel } from "../../src/utils/eventTypeBadge";
import { formatEventDate } from "../../src/utils/formatEventDate";
import { getCoverSource } from "../../src/utils/covers";
import { isValidCoverUrl } from "../../src/utils/coverUrl";
import { formatLineupTimeRange } from "../../src/utils/lineupTime";

const RSVP_BAR_HEIGHT = spacing.buttonHeightMd + spacing.sm * 2;
const SHEET_RADIUS = 24;
const POSTER_ASPECT = 1;

function getDisplayInitial(profile: UserProfile | null | undefined, phone: string): string {
  if (profile?.firstName) return profile.firstName.trim().slice(0, 1).toUpperCase();
  if (profile?.lastName) return profile.lastName.trim().slice(0, 1).toUpperCase();
  const digits = phone.replace(/\D/g, "");
  return digits ? digits.slice(-1) : "?";
}

function getDisplayName(profile: UserProfile | null | undefined, phone: string): string {
  if (profile?.firstName) return profile.firstName.trim();
  if (profile?.lastName) return profile.lastName.trim();
  return phone;
}

type RsvpStatus = "cant" | "maybe" | "going" | "pending" | null;

export default function EventDetailScreen() {
  // Host vs guest rendering is derived from `eventData.hostPhone === userPhone` (DB source of truth).
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    dateTime?: string;
    location?: string;
    details?: string;
    capacity?: string;
  }>();

  const { submitRsvp, setPlusOne, removeRsvp, getRsvp, getRsvpsForEvent, approveRsvp, declineRsvp,
    getContributions, addContribution, removeContribution,
    assignContribution, toggleContributionStatus, cancelEvent, fetchEvents } = useEvents();
  const { isFavorited, toggleFavorite } = useFavorites();
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>(null);
  const [userDeclinedByHost, setUserDeclinedByHost] = useState(false);
  const [showRsvpOptions, setShowRsvpOptions] = useState(true);
  const [userPlusOne, setUserPlusOne] = useState(false);
  const [userPhone, setUserPhone] = useState<string>("guest");

  // Event data state - fetched from Supabase
  const [eventData, setEventData] = useState({
    title: params.title || "Untitled Event",
    dateTime: params.dateTime || "—",
    location: "",
    details: params.details || "",
    capacity: params.capacity || "",
    hostPhone: "" as string | undefined,
    hostName: "" as string | undefined,
    eventType: "party" as string | undefined,
    inviteCode: "" as string | undefined,
    visibility: "private" as "public" | "private",
    coverKey: "" as string | undefined,
    coverUrl: "" as string | undefined,
    lineup: [] as { name: string; startTime?: string; endTime?: string; note?: string }[],
    locationVisibility: "now" as "now" | "reveal",
    revealHoursBefore: null as number | null,
    locationAddress: "" as string,
    locationLat: null as number | null,
    locationLng: null as number | null,
    approvalRequired: false as boolean,
    hideGuestNames: false as boolean,
    hideGuestAvatars: false as boolean,
    status: "active" as "active" | "cancelled",
    cancellationReason: null as string | null,
    dressCode: "" as string,
    audience: "" as string,
    allowPlusOne: false as boolean,
  });
  const [goingCount, setGoingCount] = useState<number>(0);
  const [rsvpsByStatus, setRsvpsByStatus] = useState<{
    going: { user_phone: string; plus_one?: boolean }[];
    pending: { user_phone: string; plus_one?: boolean }[];
    maybe: { user_phone: string; plus_one?: boolean }[];
    cant: { user_phone: string; plus_one?: boolean; declined_by_host?: boolean }[];
  }>({ going: [], pending: [], maybe: [], cant: [] });
  const plusOneCount = rsvpsByStatus.going.filter((r) => r.plus_one).length;
  const plusOneCountLabel =
    plusOneCount > 0 ? ` · ${plusOneCount} ${plusOneCount === 1 ? "guest" : "guests"}` : "";
  const [showManageSheet, setShowManageSheet] = useState(false);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [showGuestsModal, setShowGuestsModal] = useState(false);
  const [showContribManageSheet, setShowContribManageSheet] = useState(false);
  const [selectedContribId, setSelectedContribId] = useState<string | null>(null);
  const [selectedGuestPhone, setSelectedGuestPhone] = useState<string | null>(null);
  const [selectedGuestSection, setSelectedGuestSection] = useState<"going" | "pending" | "maybe" | "cant" | null>(null);
  const [contributions, setContributions] = useState<{ id: string; title: string; assigned_user_phone: string | null; status: "open" | "done" }[]>([]);
  const [newContribTitle, setNewContribTitle] = useState("");
  const CONTRIB_SUGGESTIONS = ["Drinks", "Chips", "Chocolate", "Coffee", "Water"];
  const [bringToast, setBringToast] = useState<null | { contribId: string; itemTitle: string }>(null);
  const bringToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [goingProfiles, setGoingProfiles] = useState<Record<string, UserProfile | null>>({});
  const [guestProfiles, setGuestProfiles] = useState<Record<string, UserProfile | null>>({});
  const [avatarRowWidth, setAvatarRowWidth] = useState<number>(280);
  const rsvpChangeGenerationRef = useRef(0);

  // Host mode: user owns the event (host_phone matches current user)
  const isHostMode =
    eventData.hostPhone &&
    userPhone &&
    userPhone !== "guest" &&
    eventData.hostPhone === userPhone;
  const eventTitle = eventData.title;
  const eventDateTime = eventData.dateTime;

  // Location reveal: if "reveal later", hide location until reveal time (revealHoursBefore event start)
  const isLocationRevealed = (() => {
    if (eventData.locationVisibility !== "reveal") return true;
    // Reveal enabled but no hours configured → keep hidden (safe default)
    if (eventData.revealHoursBefore == null || eventData.revealHoursBefore <= 0) return false;
    const eventMs = typeof eventData.dateTime === "string" && eventData.dateTime !== "—"
      ? new Date(eventData.dateTime).getTime()
      : 0;
    // Can't determine event time → keep hidden
    if (!eventMs) return false;
    const revealAt = eventMs - eventData.revealHoursBefore * 60 * 60 * 1000;
    return Date.now() >= revealAt;
  })();
  const showLocationText = eventData.location && (isHostMode || isLocationRevealed);

  const revealTimeLabel = (hours: number) => {
    if (hours >= 24 && hours % 24 === 0) {
      const d = hours / 24;
      return d === 1 ? "1 day before" : `${d} days before`;
    }
    return `${hours}h before`;
  };

  const insets = useSafeAreaInsets();

  // Fetch latest event data and going count when screen comes into focus.
  // If the user just did an RSVP change (set/undo), don't overwrite with stale focus-fetch data.
  useFocusEffect(
    useCallback(() => {
      const fetchEventData = async () => {
        if (!params.id) return;
        const focusGeneration = rsvpChangeGenerationRef.current;

        try {
          const [{ data, error }, { count }] = await Promise.all([
            supabase.from("events").select("*").eq("id", params.id).single(),
            supabase
              .from("rsvps")
              .select("*", { count: "exact", head: true })
              .eq("event_id", params.id)
              .eq("status", "going"),
          ]);

          if (!error && data) {
            setEventData({
              title: data.title || "Untitled Event",
              dateTime: data.date_time || "—",
              location: data.location_name || data.location || "",
              details: data.details || "",
              capacity: data.capacity?.toString() || "",
              hostPhone: data.host_phone || undefined,
              hostName: data.host_name || undefined,
              eventType: data.event_type || "party",
              inviteCode: data.invite_code || undefined,
              visibility: data.visibility || "private",
              coverKey: data.cover_key ?? undefined,
              coverUrl: isValidCoverUrl(data.cover_url) ? data.cover_url ?? undefined : undefined,
              lineup: Array.isArray(data.lineup) ? data.lineup : [],
              locationVisibility: data.location_visibility === "reveal" ? "reveal" : "now",
              revealHoursBefore:
                typeof data.reveal_hours_before === "number" ? data.reveal_hours_before : null,
              locationAddress: data.location_address || "",
              locationLat: data.location_lat ?? null,
              locationLng: data.location_lng ?? null,
              approvalRequired: data.approval_required ?? false,
              hideGuestNames: data.hide_guest_names ?? false,
              hideGuestAvatars: data.hide_guest_avatars ?? false,
              status: data.status === "cancelled" ? "cancelled" : "active",
              cancellationReason: data.cancellation_reason ?? null,
              dressCode: data.dress_code ?? "",
              audience: data.audience ?? "",
              allowPlusOne: data.allow_plus_one ?? false,
            });
          }

          const [rsvps, fetchedContribs] = await Promise.all([
            getRsvpsForEvent(params.id!),
            getContributions(params.id!),
          ]);

          if (rsvpChangeGenerationRef.current === focusGeneration) {
            setGoingCount(count ?? 0);
            setRsvpsByStatus({ going: rsvps.going, pending: rsvps.pending, maybe: rsvps.maybe, cant: rsvps.cant });
          }

          setContributions(fetchedContribs.map((c) => ({
            id: c.id, title: c.title, assigned_user_phone: c.assigned_user_phone, status: c.status,
          })));

          const phone = (await onboardingStore.getPhone()) || (await onboardingStore.getProfile())?.phone || "guest";
          setUserPhone(phone);
          if (rsvpChangeGenerationRef.current === focusGeneration) {
            const savedRsvp = await getRsvp(params.id!, phone);
            setRsvpStatus(savedRsvp ?? null);
            if (savedRsvp) setShowRsvpOptions(false);
            const myGoingEntry = rsvps.going.find((r) => r.user_phone === phone);
            setUserPlusOne(myGoingEntry?.plus_one ?? false);
            const myCantEntry = rsvps.cant.find((r) => r.user_phone === phone);
            setUserDeclinedByHost(myCantEntry?.declined_by_host ?? false);
          }
        } catch (err) {
          console.error("Failed to fetch event:", err);
        }
      };

      fetchEventData();
    }, [params.id, getRsvpsForEvent, getContributions, getRsvp])
  );

  // Load user phone and existing RSVP on mount / params.id change (fallback when focus effect hasn't run yet)
  useEffect(() => {
    if (!params.id) return;

    const loadUserAndRsvp = async () => {
      const phone = (await onboardingStore.getPhone()) || (await onboardingStore.getProfile())?.phone || "guest";
      setUserPhone(phone);

      const existingStatus = await getRsvp(params.id!, phone);
      setRsvpStatus(existingStatus ?? null);
      if (existingStatus) setShowRsvpOptions(false);
    };
    loadUserAndRsvp();
  }, [params.id, getRsvp]);

  const goingPhoneKey = rsvpsByStatus.going.map((r) => r.user_phone).sort().join(",");
  useEffect(() => {
    const phones = rsvpsByStatus.going.map((r) => r.user_phone);
    if (phones.length === 0) {
      setGoingProfiles({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map: Record<string, UserProfile | null> = {};
      await Promise.all(
        phones.map(async (phone) => {
          if (cancelled) return;
          let profile = await onboardingStore.getProfileForPhone(phone);
          if (!profile) {
            const server = await fetchProfile(phone);
            if (server && !cancelled) {
              const parts = (server.full_name || "").trim().split(/\s+/);
              profile = {
                firstName: parts[0] || "",
                lastName: parts.slice(1).join(" ") || "",
                avatarUri: server.avatar_url ?? undefined,
              };
              await onboardingStore.saveProfileForPhone(phone, profile);
            }
          }
          if (!cancelled) map[phone] = profile ?? null;
        })
      );
      if (!cancelled) setGoingProfiles(map);
    })();
    return () => { cancelled = true; };
  }, [goingPhoneKey]);

  // Fetch profiles for all guests (going + pending + maybe + cant) for modal avatars
  const allGuestPhoneKey = [
    ...rsvpsByStatus.going,
    ...rsvpsByStatus.pending,
    ...rsvpsByStatus.maybe,
    ...rsvpsByStatus.cant,
  ]
    .map((r) => r.user_phone)
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .sort()
    .join(",");
  useEffect(() => {
    const phones = allGuestPhoneKey ? allGuestPhoneKey.split(",") : [];
    if (phones.length === 0) {
      setGuestProfiles({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map: Record<string, UserProfile | null> = {};
      await Promise.all(
        phones.map(async (phone) => {
          if (cancelled) return;
          let profile = await onboardingStore.getProfileForPhone(phone);
          if (!profile) {
            const server = await fetchProfile(phone);
            if (server && !cancelled) {
              const parts = (server.full_name || "").trim().split(/\s+/);
              profile = {
                firstName: parts[0] || "",
                lastName: parts.slice(1).join(" ") || "",
                avatarUri: server.avatar_url ?? undefined,
              };
              await onboardingStore.saveProfileForPhone(phone, profile);
            }
          }
          if (!cancelled) map[phone] = profile ?? null;
        })
      );
      if (!cancelled) setGuestProfiles(map);
    })();
    return () => { cancelled = true; };
  }, [allGuestPhoneKey]);

  // Refetch going count and RSVPs (e.g. after RSVP change or host approval)
  const refetchGoingCount = useCallback(async () => {
    if (!params.id) return;
    const [{ count }, rsvps] = await Promise.all([
      supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", params.id).eq("status", "going"),
      getRsvpsForEvent(params.id!),
    ]);
    setGoingCount(count ?? 0);
    setRsvpsByStatus({ going: rsvps.going, pending: rsvps.pending, maybe: rsvps.maybe, cant: rsvps.cant });
  }, [params.id, getRsvpsForEvent]);

  const refetchContribs = useCallback(async () => {
    if (!params.id) return;
    const fetchedContribs = await getContributions(params.id!);
    setContributions(fetchedContribs.map((c) => ({
      id: c.id, title: c.title, assigned_user_phone: c.assigned_user_phone, status: c.status,
    })));
  }, [params.id, getContributions]);

  const clearBringToast = () => {
    if (bringToastTimeoutRef.current) {
      clearTimeout(bringToastTimeoutRef.current);
      bringToastTimeoutRef.current = null;
    }
    setBringToast(null);
  };

  const showBringToast = (contribId: string, itemTitle: string) => {
    clearBringToast();
    setBringToast({ contribId, itemTitle });
    bringToastTimeoutRef.current = setTimeout(() => {
      setBringToast(null);
      bringToastTimeoutRef.current = null;
    }, 5000);
  };

  const undoBringToast = async () => {
    if (!bringToast) return;
    const contribId = bringToast.contribId;
    clearBringToast();
    await assignContribution(contribId, null);
    await refetchContribs();
  };

  const performRemoveRsvp = useCallback(async () => {
    if (!params.id) return;
    rsvpChangeGenerationRef.current += 1;
    try {
      await removeRsvp(params.id, userPhone);
      setRsvpStatus(null);
      setShowRsvpOptions(true);
      setUserPlusOne(false);
      await refetchGoingCount();
      await fetchEvents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear RSVP";
      Alert.alert("RSVP", message);
    }
  }, [params.id, userPhone, removeRsvp, refetchGoingCount, fetchEvents]);

  // Persist RSVP when status changes (guest mode only). Tapping same state again = undo with confirmation.
  // Source of truth: DB (rsvps table). We refetch and sync store so all UI stays correct.
  const handleRsvpChange = async (status: RsvpStatus) => {
    if (!status || !params.id) return;
    const isSameState =
      rsvpStatus === status || (status === "going" && rsvpStatus === "pending");
    if (isSameState) {
      if (rsvpStatus === "pending") {
        Alert.alert(
          "Cancel your request?",
          "Your pending request will be removed.",
          [
            { text: "Keep request", style: "cancel" },
            { text: "Cancel request", style: "destructive", onPress: performRemoveRsvp },
          ]
        );
      } else {
        Alert.alert(
          "Leave this event?",
          "You'll be removed from the going list.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Leave", style: "destructive", onPress: performRemoveRsvp },
          ]
        );
      }
      return;
    }
    rsvpChangeGenerationRef.current += 1;
    try {
      await submitRsvp(params.id, userPhone, status);
      const savedStatus = await getRsvp(params.id, userPhone);
      setRsvpStatus(savedStatus ?? status);
      setUserDeclinedByHost(false);
      setShowRsvpOptions(false);
      if (savedStatus !== "going") setUserPlusOne(false);
      await refetchGoingCount();
      await fetchEvents();
      if (status === "going" && savedStatus === "pending") {
        Alert.alert("Waiting for approval", "You need to wait for the host to approve you.");
      }
      if ((status === "going" || status === "maybe") && eventData.eventType) {
        recordRsvp(eventData.eventType as EventType, status as "going" | "maybe", userPhone);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save RSVP";
      Alert.alert("RSVP", message);
    }
  };

  const handlePreviewAsGuest = () => {
    router.push({
      pathname: "/events/[id]",
      params: {
        id: params.id,
        title: eventData.title,
        dateTime: eventData.dateTime,
        location: eventData.location,
        details: eventData.details,
        capacity: eventData.capacity,
      },
    });
  };

  const isCancelled = eventData.status === "cancelled";
  const typeLabel = getEventTypeLabel(eventData.eventType as any);
  const hasCover = isValidCoverUrl(eventData.coverUrl) || (eventData.coverKey != null && eventData.coverKey.trim() !== "");
  const eventId = params.id ?? "";
  const favorited = eventId ? isFavorited(eventId) : false;

  /** Lineup / Bring / +1 — shared section rhythm (labels, rows, dividers) */
  const lowerSectionLabel = {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  };
  const lowerSubsectionWrap = {
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.overlayWhite10,
  };
  const lowerRowBase = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  };
  const lowerRowPrimary = {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  };
  const lowerRowSecondary = {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  };

  const handleShare = async () => {
    const lines: string[] = [];
    const title = eventData.title || "Untitled Event";
    const dateTime = eventData.dateTime && eventData.dateTime !== "—" ? eventData.dateTime : "";

    lines.push(title);

    if (dateTime) {
      lines.push(formatEventDate(dateTime));
    }

    const locationVisible = isHostMode || isLocationRevealed;
    if (locationVisible && eventData.location) {
      lines.push(`📍 ${eventData.location}`);
      const mapQuery =
        eventData.locationLat != null && eventData.locationLng != null
          ? `${eventData.locationLat},${eventData.locationLng}`
          : encodeURIComponent(eventData.location);
      lines.push(`https://maps.google.com/?q=${mapQuery}`);
    } else {
      lines.push("📍 Location will be revealed later");
    }

    const inviteCode = eventData.inviteCode?.trim();
    if (inviteCode) {
      lines.push("");
      lines.push(`Join link: gthrz.app/join/${inviteCode}`);
      lines.push(`Invite code: ${inviteCode}`);
    }

    lines.push("");
    lines.push("Sent via Gthrz");

    const message = lines.join("\n").trim();

    // Try WhatsApp first, fallback to system share sheet
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        return;
      }
    } catch {}
    try {
      await Share.share({ message });
    } catch {}
  };

  const posterScrim = (
    <LinearGradient
      colors={["transparent", "rgba(0,0,0,0.7)"]}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "35%" }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Transparent header so hero bleeds behind it */}
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerStyle: {
            backgroundColor: "transparent",
            paddingTop: (insets.top || 0) + spacing.xl + 10,
          } as Record<string, unknown>,
          headerShadowVisible: false,
          headerLeft: () => (
            <HeaderBackTextButton label="Back" onPress={() => router.back()} />
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={handleShare}
                hitSlop={10}
                style={({ pressed }) => ({
                  backgroundColor: colors.surfaceLight,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="share-outline" size={22} color="#fff" />
              </Pressable>
            </View>
          ),
        }}
      />

      {bringToast && (
        <View
          style={{
            position: "absolute",
            left: spacing.xxl,
            right: spacing.xxl,
            bottom: isHostMode || isCancelled ? insets.bottom + spacing.xl : RSVP_BAR_HEIGHT + insets.bottom + spacing.md,
            zIndex: 80,
          }}
          pointerEvents="box-none"
        >
          <View
            style={{
              backgroundColor: colors.surfaceLight,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderWidth: 0.5,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <Text style={{ flex: 1, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }} numberOfLines={1}>
              You'll bring {bringToast.itemTitle}
            </Text>
            <Pressable
              onPress={() => { undoBringToast(); }}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.primary }}>
                Undo
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: isHostMode || isCancelled
            ? insets.bottom + spacing.xxl
            : RSVP_BAR_HEIGHT + insets.bottom + spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── POSTER CARD (Open-style) ───────────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.xxl, paddingTop: (insets.top || 0) + spacing.xl + 10 }}>
          <View
            style={{
              position: "relative",
              borderRadius: radius.xl,
              overflow: "hidden",
              borderWidth: 0.5,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 6,
              aspectRatio: POSTER_ASPECT,
              alignSelf: "stretch",
            }}
          >
            {hasCover ? (
              <ImageBackground
                source={
                  isValidCoverUrl(eventData.coverUrl)
                    ? { uri: eventData.coverUrl! }
                    : getCoverSource(eventData.coverKey!, eventData.eventType as any)
                }
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              >
                {posterScrim}
              </ImageBackground>
            ) : (
              <LinearGradient
                colors={[...getEventGradient(eventData.eventType as any)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: "100%", height: "100%" }}
              >
                {posterScrim}
              </LinearGradient>
            )}

            {!isHostMode && eventId ? (
              <BlurView
                intensity={80}
                tint="dark"
                style={{
                  position: "absolute",
                  top: spacing.md,
                  right: spacing.md,
                  borderRadius: radius.full,
                  overflow: "hidden",
                  backgroundColor: "rgba(0,0,0,0.22)",
                  zIndex: 20,
                  elevation: 20,
                }}
              >
                <Pressable
                  onPress={() => toggleFavorite(eventId)}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                    backgroundColor: "transparent",
                  })}
                >
                  <Ionicons
                    name={favorited ? "heart" : "heart-outline"}
                    size={22}
                    color={favorited ? colors.coral : "rgba(255,255,255,0.9)"}
                  />
                </Pressable>
              </BlurView>
            ) : null}
          </View>
        </View>

        {/* ── TAGS ROW (directly under cover) ─────────────────────────────── */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            marginTop: -SHEET_RADIUS,
            paddingHorizontal: spacing.xxl,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.sm,
          }}
        >
          {eventData.location ? (
            showLocationText ? (
              <Pressable
                onPress={async () => {
                  const mapQuery = eventData.locationLat != null && eventData.locationLng != null
                    ? `${eventData.locationLat},${eventData.locationLng}`
                    : encodeURIComponent(eventData.location);
                  const url = `https://maps.google.com/maps/search/?api=1&query=${mapQuery}`;
                  try {
                    const canOpen = await Linking.canOpenURL(url);
                    if (canOpen) await Linking.openURL(url);
                    else Alert.alert("Can't open Maps", "Unable to open the location in Maps.");
                  } catch {
                    Alert.alert("Can't open Maps", "Unable to open the location in Maps.");
                  }
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: eventData.locationAddress ? "flex-start" : "center",
                  gap: spacing.xs,
                  backgroundColor: colors.surfaceLight,
                  paddingVertical: eventData.locationAddress ? spacing.sm : spacing.xs,
                  paddingHorizontal: spacing.md,
                  borderRadius: eventData.locationAddress ? radius.lg : radius.full,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="location-outline" size={12} color={colors.primary} />
                <View style={{ flexShrink: 1 }}>
                  <Text
                    style={{
                      fontSize: typography.sizes.sm,
                      color: colors.primary,
                      fontWeight: typography.weights.medium,
                    }}
                    numberOfLines={1}
                  >
                    {eventData.location}
                  </Text>
                  {eventData.locationAddress ? (
                    <Text
                      style={{
                        fontSize: typography.sizes.xs,
                        color: colors.textMuted,
                        marginTop: 1,
                      }}
                      numberOfLines={1}
                    >
                      {eventData.locationAddress}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  backgroundColor: colors.surfaceLight,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.full,
                }}
              >
                <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                <Text
                  style={{
                    fontSize: typography.sizes.sm,
                    color: colors.textMuted,
                    fontWeight: typography.weights.medium,
                  }}
                >
                  Location revealed {revealTimeLabel(eventData.revealHoursBefore ?? 0)}
                </Text>
              </View>
            )
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              backgroundColor: colors.surfaceLight,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.full,
            }}
          >
            <Ionicons name="person-outline" size={12} color={colors.textMuted} />
            <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>
              {isHostMode ? "You're hosting" : `Hosted by ${eventData.hostName || "Host"}`}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              backgroundColor: colors.surfaceLight,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.full,
            }}
          >
            <Ionicons
              name={eventData.visibility === "public" ? "globe-outline" : "lock-closed-outline"}
              size={12}
              color={colors.textMuted}
            />
            <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>
              {eventData.visibility === "public" ? "Public" : "Private"}
            </Text>
          </View>

          {isHostMode && eventData.approvalRequired && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                backgroundColor: colors.surfaceLight,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
              }}
            >
              <Ionicons name="person-add-outline" size={12} color={colors.textMuted} />
              <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>
                Approval required
              </Text>
            </View>
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              backgroundColor: colors.surfaceLight,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.full,
            }}
          >
            <Ionicons name="people-outline" size={12} color={colors.textMuted} />
            <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>
              {goingCount === 0
                ? "Be the first to RSVP"
                : eventData.capacity
                  ? `${goingCount} going${plusOneCountLabel} · ${goingCount + plusOneCount}/${eventData.capacity}`
                  : `${goingCount} going${plusOneCountLabel}`}
            </Text>
          </View>
        </View>

        {/* ── SHEET (title, date, who's coming, about, details accordion) ─── */}
        <View
          style={{
            backgroundColor: colors.surface,
            paddingTop: spacing.xl,
            paddingHorizontal: spacing.xxl,
            paddingBottom: spacing.xl,
          }}
        >
          {/* Event name + date */}
          <Text
            style={{
              fontSize: 24,
              fontWeight: typography.weights.bold,
              color: colors.text,
              letterSpacing: -0.3,
              marginBottom: spacing.xs,
            }}
            numberOfLines={2}
          >
            {eventTitle}
          </Text>
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: colors.textMuted,
              marginBottom: 0,
            }}
          >
            {typeLabel.emoji} {typeLabel.label} · {formatEventDate(eventDateTime)}
          </Text>

          {/* Guests: single divider above, label + avatars (same order as before) */}
          <View style={{ marginBottom: spacing.lg }}>
            <View
              style={{
                height: 1,
                backgroundColor: colors.overlayWhite10,
                marginTop: spacing.lg,
                marginBottom: spacing.md,
              }}
            />
            <Text
              style={{
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
                color: colors.textMuted,
                marginBottom: spacing.xs,
              }}
            >
              Guests
            </Text>
            {/* Who's coming — as many avatars as fit before "See all" (right-aligned) */}
            <Pressable
              onPress={() => setShowGuestsModal(true)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 0,
                paddingVertical: spacing.md,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0) setAvatarRowWidth(w);
                }}
              >
                {(() => {
                  const AVATAR_SIZE = 36;
                  const AVATAR_OVERLAP = 10;
                  const effectivePerAvatar = AVATAR_SIZE - AVATAR_OVERLAP;
                  const maxVisible =
                    avatarRowWidth >= AVATAR_SIZE
                      ? Math.max(1, 1 + Math.floor((avatarRowWidth - AVATAR_SIZE) / effectivePerAvatar))
                      : 1;
                  if (goingCount === 0) {
                    return [1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={{
                          width: AVATAR_SIZE,
                          height: AVATAR_SIZE,
                          borderRadius: AVATAR_SIZE / 2,
                          backgroundColor: colors.surfaceLight,
                          borderWidth: 1,
                          borderColor: colors.border,
                          justifyContent: "center",
                          alignItems: "center",
                          marginLeft: i === 1 ? 0 : -AVATAR_OVERLAP,
                        }}
                      >
                        <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                      </View>
                    ));
                  }
                  const toShow = rsvpsByStatus.going.slice(0, maxVisible);
                  const overflow = goingCount > maxVisible ? goingCount - maxVisible : 0;
                  return (
                    <>
                      {toShow.map((r, i) => {
                        const profile = goingProfiles[r.user_phone];
                        const initial = getDisplayInitial(profile ?? null, r.user_phone);
                        const avatarUri = profile?.avatarUri;
                        const hideAvatarOnly = !isHostMode && eventData.hideGuestAvatars && r.user_phone !== userPhone;
                        return (
                          <View
                            key={r.user_phone}
                            style={{
                              width: AVATAR_SIZE,
                              height: AVATAR_SIZE,
                              borderRadius: AVATAR_SIZE / 2,
                              backgroundColor: colors.surfaceLight,
                              borderWidth: 2,
                              borderColor: colors.surface,
                              marginLeft: i === 0 ? 0 : -AVATAR_OVERLAP,
                              overflow: "hidden",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            {hideAvatarOnly ? (
                              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                            ) : avatarUri ? (
                              <Image source={{ uri: avatarUri }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} resizeMode="cover" />
                            ) : (
                              <Text
                                style={{
                                  fontSize: typography.sizes.xs,
                                  fontWeight: typography.weights.semibold,
                                  color: colors.textMuted,
                                }}
                              >
                                {initial}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                      {overflow > 0 && (
                        <View
                          style={{
                            width: AVATAR_SIZE,
                            height: AVATAR_SIZE,
                            borderRadius: AVATAR_SIZE / 2,
                            backgroundColor: colors.surfaceLight,
                            borderWidth: 2,
                            borderColor: colors.surface,
                            marginLeft: -AVATAR_OVERLAP,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted }}>
                            +{overflow}
                          </Text>
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>
              <Text
                style={{
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.medium,
                  color: colors.primary,
                  marginLeft: spacing.sm,
                }}
              >
                See all
              </Text>
            </Pressable>
          </View>

          {/* Cancelled banner */}
          {isCancelled && (
            <View
              style={{
                backgroundColor: "rgba(255,90,90,0.1)",
                borderRadius: radius.md,
                borderWidth: 0.5,
                borderColor: "rgba(255,90,90,0.3)",
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                marginBottom: spacing.lg,
                gap: spacing.xs,
              }}
            >
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.error }}>
                This event has been cancelled.
              </Text>
              {eventData.cancellationReason && eventData.cancellationReason.trim() && (
                <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, lineHeight: 20 }}>
                  {eventData.cancellationReason.trim()}
                </Text>
              )}
            </View>
          )}

          {/* About, then dress / audience / lineup / bring / +1 — RSVP bar sticky below */}
          {/* About (top-level, always visible) */}
          <View style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
            <Text
              style={{
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
                color: colors.textMuted,
                marginBottom: spacing.xs,
              }}
            >
              About
            </Text>
            <Text
              style={{
                fontSize: typography.sizes.md,
                color: colors.text,
                lineHeight: 24,
              }}
            >
              {eventData.details || "Looking forward to seeing you there. Come enjoy the evening with us."}
            </Text>
          </View>

          {/* Secondary blocks below About (shared top border; no "Details" heading) */}
          <View
            style={{
              marginTop: spacing.md,
              paddingTop: spacing.lg,
              borderTopWidth: 0.5,
              borderTopColor: colors.overlayWhite10,
            }}
          >
          {/* Dress code — only shown if set */}
          {eventData.dressCode ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textMuted, marginBottom: spacing.xs }}>
                Dress code
              </Text>
              <Text style={{ fontSize: typography.sizes.md, color: colors.text }}>
                {eventData.dressCode}
              </Text>
              {!eventData.audience ? (
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.overlayWhite10,
                    marginTop: spacing.md,
                    marginBottom: spacing.lg,
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {/* Audience — only shown if set */}
          {eventData.audience ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textMuted, marginBottom: spacing.xs }}>
                Audience
              </Text>
              <Text style={{ fontSize: typography.sizes.md, color: colors.text }}>
                {eventData.audience}
              </Text>
              {!(eventData.lineup && eventData.lineup.length > 0) ? (
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.overlayWhite10,
                    marginTop: spacing.md,
                    marginBottom: 0,
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {/* Lineup — only when schedule has entries; rows match Bring row rhythm */}
          {eventData.lineup && eventData.lineup.length > 0 ? (
            <View style={lowerSubsectionWrap}>
              <Text style={lowerSectionLabel}>Lineup</Text>
              {eventData.lineup.map((entry, i) => {
                /* No "(next day)" / (+1) on details for now — plain "start → end" only */
                const timeRange = formatLineupTimeRange(entry.startTime, entry.endTime, 0) || null;
                const isLast = i === eventData.lineup.length - 1;
                return (
                  <View
                    key={i}
                    style={[lowerRowBase, isLast && { borderBottomWidth: 0 }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={lowerRowPrimary} numberOfLines={2}>
                        {entry.name}
                      </Text>
                      {timeRange ? (
                        <Text style={[lowerRowSecondary, { fontVariant: ["tabular-nums"] }]}>{timeRange}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Bring — own section; only when there are items and user may interact (host or Going) */}
          {contributions.length > 0 &&
          (isHostMode || rsvpsByStatus.going.some((r) => r.user_phone === userPhone)) ? (
            <View style={lowerSubsectionWrap}>
              <Text style={lowerSectionLabel}>Bring</Text>
              {contributions.map((c, idx) => {
                const isLastContrib = idx === contributions.length - 1;
                const assigneeName = c.assigned_user_phone
                  ? (goingProfiles[c.assigned_user_phone] ? getDisplayName(goingProfiles[c.assigned_user_phone] ?? null, c.assigned_user_phone) : c.assigned_user_phone)
                  : null;
                const statusText = c.status === "done"
                  ? "Done"
                  : assigneeName
                    ? `Assigned to ${assigneeName}`
                    : "No one yet";

                const openContribSheet = () => {
                  setSelectedContribId(c.id);
                  setShowContribManageSheet(true);
                };

                /** Shared Bring row action pill (host Manage + guest Claim / Claimed). */
                const bringActionPillStyle = {
                  minHeight: 28,
                  minWidth: 88,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surfaceLight,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                  alignItems: "center" as const,
                  justifyContent: "center" as const,
                  alignSelf: "center" as const,
                };

                const bringActionPillTextStyle = {
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.medium,
                  color: colors.textMuted,
                  textAlign: "center" as const,
                  includeFontPadding: false,
                };

                const rowContent = (
                  <>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          lowerRowPrimary,
                          {
                            color: c.status === "done" ? colors.textMuted : colors.text,
                            textDecorationLine: c.status === "done" ? "line-through" : "none",
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {c.title}
                      </Text>
                      <Text style={[lowerRowSecondary]} numberOfLines={1}>
                        {statusText}
                      </Text>
                    </View>

                    {!isHostMode && (
                      <View style={{ alignItems: "flex-end", justifyContent: "center", minWidth: 84 }}>
                        {!c.assigned_user_phone && c.status === "open" ? (
                          <Pressable
                            onPress={openContribSheet}
                            style={({ pressed }) => [bringActionPillStyle, { opacity: pressed ? 0.8 : 1 }]}
                          >
                            <Text style={bringActionPillTextStyle}>Claim</Text>
                          </Pressable>
                        ) : c.assigned_user_phone === userPhone && c.status === "open" ? (
                          <Pressable
                            onPress={openContribSheet}
                            style={({ pressed }) => [bringActionPillStyle, { opacity: pressed ? 0.8 : 1 }]}
                          >
                            <Text style={bringActionPillTextStyle}>Claimed</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}

                    {isHostMode && (
                      <View style={{ alignItems: "flex-end", justifyContent: "center", minWidth: 84 }}>
                        <Pressable
                          onPress={openContribSheet}
                          style={({ pressed }) => [bringActionPillStyle, { opacity: pressed ? 0.8 : 1 }]}
                        >
                          <Text style={bringActionPillTextStyle}>Manage</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                );

                // Guests: tap the whole row to open the same sheet (which shows "Claim").
                // Hosts: keep the explicit "Manage" button to avoid tap+button duplication.
                const rowShellStyle = [
                  lowerRowBase,
                  isLastContrib && !isHostMode ? { borderBottomWidth: 0 } : null,
                ];

                if (!isHostMode) {
                  return (
                    <Pressable
                      key={c.id}
                      onPress={openContribSheet}
                      style={({ pressed }) => [
                        ...rowShellStyle,
                        {
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      {rowContent}
                    </Pressable>
                  );
                }

                return (
                  <View key={c.id} style={rowShellStyle}>
                    {rowContent}
                  </View>
                );
              })}
              {isHostMode && (
                <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing.xs, paddingVertical: spacing.xs }}
                  >
                    {CONTRIB_SUGGESTIONS.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setNewContribTitle(s)}
                        style={({ pressed }) => ({
                          paddingVertical: spacing.xs,
                          paddingHorizontal: spacing.sm,
                          borderRadius: 999,
                          backgroundColor: newContribTitle === s ? colors.primary : (pressed ? colors.surfaceLight : colors.surfaceLight),
                          borderWidth: 0.5,
                          borderColor: newContribTitle === s ? colors.primary : colors.border,
                        })}
                      >
                        <Text style={{ fontSize: typography.sizes.xs, color: newContribTitle === s ? colors.text : colors.textMuted }}>{s}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <TextInput
                    value={newContribTitle}
                    onChangeText={setNewContribTitle}
                    placeholder="Add item (e.g., Drinks)"
                    placeholderTextColor={colors.textDim}
                    style={{
                      flex: 1,
                      backgroundColor: colors.surfaceLight,
                      borderRadius: radius.md,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      fontSize: typography.sizes.sm,
                      color: colors.text,
                      borderWidth: 0.5,
                      borderColor: colors.border,
                    }}
                  />
                  <Pressable
                    onPress={async () => {
                      const t = newContribTitle.trim();
                      if (!t) return;
                      try {
                        await addContribution(params.id!, t);
                        setNewContribTitle("");
                        refetchContribs();
                      } catch (err) {
                        Alert.alert("Error", err instanceof Error ? err.message : "Failed to add item");
                      }
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: pressed ? colors.primaryDark : colors.primary,
                      justifyContent: "center",
                    })}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>Add</Text>
                  </Pressable>
                </View>
                </View>
              )}
            </View>
          ) : null}

          {/* Bring a guest (+1) — same section system as Lineup / Bring */}
          {eventData.allowPlusOne && !isHostMode && !isCancelled && rsvpStatus === "going" ? (
            <View style={lowerSubsectionWrap}>
              <Text style={lowerSectionLabel}>Bring a guest</Text>
              <View style={[lowerRowBase, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
                  <Text style={lowerRowPrimary}>
                    {userPlusOne ? "Guest added" : "No guest added"}
                  </Text>
                  <Text style={lowerRowSecondary}>
                    {userPlusOne ? "Included with your RSVP" : "Optional"}
                  </Text>
                </View>
                <Pressable
                  onPress={async () => {
                    if (!params.id) return;
                    if (!userPlusOne) {
                      setUserPlusOne(true);
                      try {
                        await setPlusOne(params.id, userPhone, true);
                        await refetchGoingCount();
                      } catch (err) {
                        setUserPlusOne(false);
                        Alert.alert("Event is full", "There isn't enough space to add a guest.");
                      }
                      return;
                    }
                    Alert.alert("Remove guest?", "This will update your RSVP.", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: async () => {
                          setUserPlusOne(false);
                          try {
                            await setPlusOne(params.id!, userPhone, false);
                            await refetchGoingCount();
                          } catch {
                            setUserPlusOne(true);
                          }
                        },
                      },
                    ]);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 28,
                    minWidth: 88,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surfaceLight,
                    borderWidth: 0.5,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    alignSelf: "center",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: typography.sizes.xs,
                      fontWeight: typography.weights.medium,
                      color: colors.textMuted,
                      textAlign: "center",
                      includeFontPadding: false,
                    }}
                  >
                    {userPlusOne ? "Guest added" : "Bring guest"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          </View>

          {/* Manage event (host only) — at bottom so event page feels first, manage second */}
          {isHostMode && (
            <View style={{ marginTop: spacing.xxl, marginBottom: spacing.xl }}>
              <AppButton
                title="Manage event"
                onPress={() => setShowManageSheet(true)}
                variant="primary"
                size="lg"
                fullWidth
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky RSVP bar - guest only; public = Going only, private = Going / Maybe / Not going */}
      {!isHostMode && !isCancelled && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {rsvpStatus === "pending" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginHorizontal: spacing.lg,
                marginTop: spacing.sm,
                marginBottom: spacing.xs,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: "rgba(255,165,2,0.12)",
                borderWidth: 1,
                borderColor: "rgba(255,165,2,0.25)",
              }}
            >
              <Text style={{ fontSize: 16 }}>⏳</Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.medium,
                  color: colors.text,
                }}
              >
                Pending approval — waiting for host approval.
              </Text>
            </View>
          )}
          {rsvpStatus === "cant" && userDeclinedByHost && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginHorizontal: spacing.lg,
                marginTop: spacing.sm,
                marginBottom: spacing.xs,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: "rgba(255,69,58,0.10)",
                borderWidth: 1,
                borderColor: "rgba(255,69,58,0.25)",
              }}
            >
              <Ionicons name="close-circle-outline" size={18} color={colors.error} />
              <Text
                style={{
                  flex: 1,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.medium,
                  color: colors.text,
                }}
              >
                Request declined — the host didn't approve your RSVP.
              </Text>
            </View>
          )}
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={{ paddingTop: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom }}
            >
              {rsvpStatus && !showRsvpOptions ? (
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  <Pressable
                    onPress={() => {
                      if (userDeclinedByHost) {
                        Alert.alert(
                          "Request again?",
                          "This will send a new RSVP request to the host.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Send request",
                              onPress: () => handleRsvpChange("going"),
                            },
                          ]
                        );
                      } else {
                        handleRsvpChange(rsvpStatus);
                      }
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: spacing.buttonHeightMd,
                      borderRadius: radius.lg,
                      backgroundColor:
                        rsvpStatus === "pending" ? colors.warning
                          : (rsvpStatus === "cant" && userDeclinedByHost) ? "rgba(255,69,58,0.14)"
                            : (eventData.visibility === "public" || rsvpStatus === "going") ? colors.surfaceLight
                              : colors.surfaceLighter,
                      borderWidth: 1,
                      borderColor:
                        rsvpStatus === "pending" ? colors.warning
                          : (rsvpStatus === "cant" && userDeclinedByHost) ? "rgba(255,69,58,0.45)"
                            : (eventData.visibility === "public" || rsvpStatus === "going") ? colors.border
                              : colors.textMuted,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: spacing.xs,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    {rsvpStatus !== "pending" && !(rsvpStatus === "cant" && userDeclinedByHost) && (
                      <Ionicons name="checkmark" size={18} color={colors.text} />
                    )}
                    <Text
                      style={{
                        fontSize: typography.sizes.sm,
                        fontWeight: typography.weights.semibold,
                        color: colors.text,
                      }}
                    >
                      {rsvpStatus === "pending" ? "Pending"
                        : eventData.visibility === "public" ? "Going"
                          : rsvpStatus === "going" ? "Going"
                            : rsvpStatus === "maybe" ? "Maybe"
                              : userDeclinedByHost ? "Request again"
                                : "Not going"}
                    </Text>
                  </Pressable>
                  {rsvpStatus !== "pending" && !userDeclinedByHost && eventData.visibility !== "public" && (
                    <Pressable
                      onPress={() => setShowRsvpOptions(true)}
                      style={({ pressed }) => ({
                        height: spacing.buttonHeightMd,
                        paddingHorizontal: spacing.lg,
                        borderRadius: radius.lg,
                        backgroundColor: colors.surfaceLight,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: typography.sizes.sm,
                          fontWeight: typography.weights.semibold,
                          color: colors.textMuted,
                        }}
                      >
                        Change
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  <Pressable
                    onPress={() => handleRsvpChange("going")}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: spacing.buttonHeightMd,
                      borderRadius: radius.lg,
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Text
                      style={{
                        fontSize: typography.sizes.sm,
                        fontWeight: typography.weights.semibold,
                        color: colors.text,
                      }}
                    >
                      Going
                    </Text>
                  </Pressable>
                  {eventData.visibility !== "public" && (
                    <>
                      <Pressable
                        onPress={() => handleRsvpChange("maybe")}
                        style={({ pressed }) => ({
                          flex: 1,
                          height: spacing.buttonHeightMd,
                          borderRadius: radius.lg,
                          backgroundColor: colors.surfaceLight,
                          opacity: pressed ? 0.85 : 1,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                      >
                        <Text
                          style={{
                            fontSize: typography.sizes.sm,
                            fontWeight: typography.weights.semibold,
                            color: colors.textMuted,
                          }}
                        >
                          Maybe
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRsvpChange("cant")}
                        style={({ pressed }) => ({
                          flex: 1,
                          height: spacing.buttonHeightMd,
                          borderRadius: radius.lg,
                          backgroundColor: colors.surfaceLight,
                          opacity: pressed ? 0.85 : 1,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                      >
                        <Text
                          style={{
                            fontSize: typography.sizes.sm,
                            fontWeight: typography.weights.semibold,
                            color: colors.textMuted,
                          }}
                        >
                          Not going
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </BlurView>
          ) : (
            <View
              style={{
                paddingTop: spacing.sm,
                paddingHorizontal: spacing.lg,
                paddingBottom: insets.bottom,
                backgroundColor: colors.surface,
              }}
            >
              {rsvpStatus && !showRsvpOptions ? (
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  <Pressable
                    onPress={() => {
                      if (userDeclinedByHost) {
                        Alert.alert(
                          "Request again?",
                          "This will send a new RSVP request to the host.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Send request",
                              onPress: () => handleRsvpChange("going"),
                            },
                          ]
                        );
                      } else {
                        handleRsvpChange(rsvpStatus);
                      }
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: spacing.buttonHeightMd,
                      borderRadius: radius.lg,
                      backgroundColor:
                        rsvpStatus === "pending" ? colors.warning
                          : (rsvpStatus === "cant" && userDeclinedByHost) ? "rgba(255,69,58,0.14)"
                            : (eventData.visibility === "public" || rsvpStatus === "going") ? colors.surfaceLight
                              : colors.surfaceLighter,
                      borderWidth: 1,
                      borderColor:
                        rsvpStatus === "pending" ? colors.warning
                          : (rsvpStatus === "cant" && userDeclinedByHost) ? "rgba(255,69,58,0.45)"
                            : (eventData.visibility === "public" || rsvpStatus === "going") ? colors.border
                              : colors.textMuted,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: spacing.xs,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    {rsvpStatus !== "pending" && !(rsvpStatus === "cant" && userDeclinedByHost) && (
                      <Ionicons name="checkmark" size={18} color={colors.text} />
                    )}
                    <Text
                      style={{
                        fontSize: typography.sizes.sm,
                        fontWeight: typography.weights.semibold,
                        color: colors.text,
                      }}
                    >
                      {rsvpStatus === "pending" ? "Pending"
                        : eventData.visibility === "public" ? "Going"
                          : rsvpStatus === "going" ? "Going"
                            : rsvpStatus === "maybe" ? "Maybe"
                              : userDeclinedByHost ? "Request again"
                                : "Not going"}
                    </Text>
                  </Pressable>
                  {rsvpStatus !== "pending" && !userDeclinedByHost && eventData.visibility !== "public" && (
                    <Pressable
                      onPress={() => setShowRsvpOptions(true)}
                      style={({ pressed }) => ({
                        height: spacing.buttonHeightMd,
                        paddingHorizontal: spacing.lg,
                        borderRadius: radius.lg,
                        backgroundColor: colors.surfaceLight,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: typography.sizes.sm,
                          fontWeight: typography.weights.semibold,
                          color: colors.textMuted,
                        }}
                      >
                        Change
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  <Pressable
                    onPress={() => handleRsvpChange("going")}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: spacing.buttonHeightMd,
                      borderRadius: radius.lg,
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Text
                      style={{
                        fontSize: typography.sizes.sm,
                        fontWeight: typography.weights.semibold,
                        color: colors.text,
                      }}
                    >
                      Going
                    </Text>
                  </Pressable>
                  {eventData.visibility !== "public" && (
                    <>
                      <Pressable
                        onPress={() => handleRsvpChange("maybe")}
                        style={({ pressed }) => ({
                          flex: 1,
                          height: spacing.buttonHeightMd,
                          borderRadius: radius.lg,
                          backgroundColor: colors.surfaceLight,
                          opacity: pressed ? 0.85 : 1,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                      >
                        <Text
                          style={{
                            fontSize: typography.sizes.sm,
                            fontWeight: typography.weights.semibold,
                            color: colors.textMuted,
                          }}
                        >
                          Maybe
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRsvpChange("cant")}
                        style={({ pressed }) => ({
                          flex: 1,
                          height: spacing.buttonHeightMd,
                          borderRadius: radius.lg,
                          backgroundColor: colors.surfaceLight,
                          opacity: pressed ? 0.85 : 1,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                      >
                        <Text
                          style={{
                            fontSize: typography.sizes.sm,
                            fontWeight: typography.weights.semibold,
                            color: colors.textMuted,
                          }}
                        >
                          Not going
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Manage event sheet (host only) */}
      <Modal
        visible={showManageSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManageSheet(false)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay }}
          onPress={() => setShowManageSheet(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg }} />
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text, marginBottom: spacing.xl }}>
              Manage event
            </Text>
            <View style={{ gap: spacing.md }}>
              {eventData.inviteCode && (
                <View
                  style={{
                    backgroundColor: colors.surfaceLight,
                    borderRadius: radius.lg,
                    borderWidth: 0.5,
                    borderColor: colors.border,
                    padding: spacing.lg,
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
                    Share Code
                  </Text>
                  <Text style={{ fontSize: 32, fontWeight: typography.weights.bold, color: colors.text, letterSpacing: 6 }}>
                    {eventData.inviteCode}
                  </Text>
                  <Pressable
                    onPress={async () => {
                      if (eventData.inviteCode) {
                        await Clipboard.setStringAsync(eventData.inviteCode);
                        Alert.alert("Copied", "Code copied to clipboard");
                      }
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: colors.primary,
                      paddingHorizontal: spacing.xxl,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.full,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.background }}>
                      Copy code
                    </Text>
                  </Pressable>
                </View>
              )}
              <AppButton title="Preview as guest" onPress={() => { setShowManageSheet(false); handlePreviewAsGuest(); }} variant="secondary" fullWidth />
              {!isCancelled && (
                <AppButton title="Edit event" onPress={() => { setShowManageSheet(false); router.push(`/events/edit/${params.id}`); }} variant="secondary" fullWidth />
              )}
              {isCancelled ? (
                <View
                  style={{
                    paddingVertical: spacing.md,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.error, fontWeight: typography.weights.medium }}>
                    This event has been cancelled
                  </Text>
                </View>
              ) : (
                <AppButton
                  title="Mark as cancelled"
                  variant="coral"
                  onPress={() => {
                    setShowManageSheet(false);
                    setCancelReasonInput("");
                    setShowCancelReasonModal(true);
                  }}
                  fullWidth
                />
              )}
            </View>
            <AppButton title="Done" onPress={() => setShowManageSheet(false)} variant="secondary" fullWidth style={{ marginTop: spacing.xl }} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Cancel reason modal (host): optional reason before marking as cancelled */}
      <Modal
        visible={showCancelReasonModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelReasonModal(false)}
      >
        <Pressable style={{ flex: 1, justifyContent: "center", backgroundColor: colors.overlay, paddingHorizontal: spacing.xl }} onPress={() => setShowCancelReasonModal(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xl,
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text, marginBottom: spacing.xs }}>
              Mark as cancelled
            </Text>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginBottom: spacing.lg }}>
              Guests will see this event as cancelled. Add a reason so they know why (optional).
            </Text>
            <TextInput
              value={cancelReasonInput}
              onChangeText={setCancelReasonInput}
              placeholder="e.g., Schedule conflict"
              placeholderTextColor={colors.textDim}
              multiline
              numberOfLines={2}
              style={{
                backgroundColor: colors.surfaceLight,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                fontSize: typography.sizes.md,
                color: colors.text,
                borderWidth: 0.5,
                borderColor: colors.border,
                minHeight: 72,
                textAlignVertical: "top",
                marginBottom: spacing.lg,
              }}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowCancelReasonModal(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceLight,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>Keep event</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    await cancelEvent(params.id!, cancelReasonInput.trim() || null);
                    setEventData((prev) => ({ ...prev, status: "cancelled", cancellationReason: cancelReasonInput.trim() || null }));
                    setShowCancelReasonModal(false);
                    setCancelReasonInput("");
                  } catch {
                    Alert.alert("Error", "Failed to cancel the event.");
                  }
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.coral,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>Mark as cancelled</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Guests list modal */}
      <Modal
        visible={showGuestsModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (selectedGuestPhone !== null) {
            setSelectedGuestPhone(null);
            setSelectedGuestSection(null);
          } else {
            setShowGuestsModal(false);
          }
        }}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          {/* Backdrop — closes action sheet first, then modal */}
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}
            onPress={() => {
              if (selectedGuestPhone !== null) {
                setSelectedGuestPhone(null);
                setSelectedGuestSection(null);
              } else {
                setShowGuestsModal(false);
              }
            }}
          />
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              maxHeight: "80%",
              paddingBottom: insets.bottom + spacing.xl,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text }}>Guests</Text>
              <Pressable onPress={() => setShowGuestsModal(false)}>
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.primary }}>Done</Text>
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: spacing.lg }} showsVerticalScrollIndicator={false}>
              {rsvpsByStatus.going.length > 0 && (
                <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 0.5, marginBottom: spacing.sm }}>
                    {rsvpsByStatus.going.length} going
                    {plusOneCount > 0
                      ? ` · ${plusOneCount} ${plusOneCount === 1 ? "guest" : "guests"}`
                      : ""}
                  </Text>
                  {rsvpsByStatus.going.map((r) => {
                    const profile = guestProfiles[r.user_phone] ?? goingProfiles[r.user_phone];
                    const displayName = getDisplayName(profile ?? null, r.user_phone);
                    const hideNameOnly = !isHostMode && eventData.hideGuestNames && r.user_phone !== userPhone;
                    const hideAvatarOnly = !isHostMode && eventData.hideGuestAvatars && r.user_phone !== userPhone;
                    const nameToShow = hideNameOnly ? "Guest" : displayName;
                    const avatarUri = profile?.avatarUri;
                    const initial = getDisplayInitial(profile ?? null, r.user_phone);
                    const isHost = r.user_phone === eventData.hostPhone;
                    const canManage = isHostMode && !isHost;
                    return (
                      <Pressable
                        key={r.user_phone}
                        onPress={() => {
                          if (!canManage) return;
                          setSelectedGuestPhone(r.user_phone);
                          setSelectedGuestSection("going");
                        }}
                        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.border, opacity: pressed && canManage ? 0.7 : 1 })}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, overflow: "hidden", justifyContent: "center", alignItems: "center" }}>
                            {hideAvatarOnly ? (
                              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                            ) : avatarUri ? (
                              <Image source={{ uri: avatarUri }} style={{ width: 36, height: 36 }} resizeMode="cover" />
                            ) : (
                              <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted }}>{initial}</Text>
                            )}
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.text }} numberOfLines={1}>
                              {nameToShow}
                            </Text>
                            {r.plus_one ? (
                              <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                                Bringing 1 guest
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        {isHostMode && isHost && <Badge label="Host" variant="primary" />}
                        {canManage && <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />}
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {rsvpsByStatus.pending.length > 0 && (
                <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 0.5, marginBottom: spacing.sm }}>PENDING ({rsvpsByStatus.pending.length})</Text>
                  {rsvpsByStatus.pending.map((r) => {
                    const profile = guestProfiles[r.user_phone];
                    const displayName = profile ? getDisplayName(profile, r.user_phone) : r.user_phone;
                    const hideNameOnly = !isHostMode && eventData.hideGuestNames && r.user_phone !== userPhone;
                    const hideAvatarOnly = !isHostMode && eventData.hideGuestAvatars && r.user_phone !== userPhone;
                    const nameToShow = hideNameOnly ? "Guest" : displayName;
                    const avatarUri = profile?.avatarUri;
                    const initial = getDisplayInitial(profile ?? null, r.user_phone);
                    return (
                      <Pressable
                        key={r.user_phone}
                        onPress={() => {
                          if (!isHostMode) return;
                          setSelectedGuestPhone(r.user_phone);
                          setSelectedGuestSection("pending");
                        }}
                        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.border, opacity: pressed && isHostMode ? 0.7 : 1 })}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, overflow: "hidden", justifyContent: "center", alignItems: "center" }}>
                            {hideAvatarOnly ? (
                              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                            ) : avatarUri ? (
                              <Image source={{ uri: avatarUri }} style={{ width: 36, height: 36 }} resizeMode="cover" />
                            ) : (
                              <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted }}>{initial}</Text>
                            )}
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.text }} numberOfLines={1}>{nameToShow}</Text>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.warning, marginTop: 2 }}>Waiting for approval</Text>
                          </View>
                        </View>
                        {isHostMode && <Ionicons name="ellipsis-horizontal" size={16} color={colors.warning} />}
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {rsvpsByStatus.maybe.length > 0 && (
                <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 0.5, marginBottom: spacing.sm }}>MAYBE ({rsvpsByStatus.maybe.length})</Text>
                  {rsvpsByStatus.maybe.map((r) => {
                    const profile = guestProfiles[r.user_phone];
                    const displayName = profile ? getDisplayName(profile, r.user_phone) : r.user_phone;
                    const hideNameOnly = !isHostMode && eventData.hideGuestNames && r.user_phone !== userPhone;
                    const hideAvatarOnly = !isHostMode && eventData.hideGuestAvatars && r.user_phone !== userPhone;
                    const nameToShow = hideNameOnly ? "Guest" : displayName;
                    const avatarUri = profile?.avatarUri;
                    const initial = getDisplayInitial(profile ?? null, r.user_phone);
                    return (
                      <View key={r.user_phone} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, overflow: "hidden", justifyContent: "center", alignItems: "center", marginRight: spacing.sm }}>
                          {hideAvatarOnly ? (
                            <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                          ) : avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={{ width: 36, height: 36 }} resizeMode="cover" />
                          ) : (
                            <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted }}>{initial}</Text>
                          )}
                        </View>
                        <Text style={{ fontSize: typography.sizes.sm, color: colors.text, flex: 1 }} numberOfLines={1}>{nameToShow}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              {(() => {
                // Guests who voluntarily declined (not declined by host) — always visible to all
                // Declined-by-host rows are only visible to host
                const visibleCant = isHostMode
                  ? rsvpsByStatus.cant
                  : rsvpsByStatus.cant.filter((r) => !r.declined_by_host);
                if (visibleCant.length === 0) return null;
                return (
                  <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                    <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, letterSpacing: 0.5, marginBottom: spacing.sm }}>NOT GOING ({visibleCant.length})</Text>
                    {visibleCant.map((r) => {
                      const profile = guestProfiles[r.user_phone];
                      const displayName = profile ? getDisplayName(profile, r.user_phone) : r.user_phone;
                      const hideNameOnly = !isHostMode && eventData.hideGuestNames && r.user_phone !== userPhone;
                      const hideAvatarOnly = !isHostMode && eventData.hideGuestAvatars && r.user_phone !== userPhone;
                      const nameToShow = hideNameOnly ? "Guest" : displayName;
                      const avatarUri = profile?.avatarUri;
                      const initial = getDisplayInitial(profile ?? null, r.user_phone);
                      const wasDeclined = isHostMode && r.declined_by_host === true;
                      return (
                        <View key={r.user_phone} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, overflow: "hidden", justifyContent: "center", alignItems: "center", marginRight: spacing.sm }}>
                            {hideAvatarOnly ? (
                              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                            ) : avatarUri ? (
                              <Image source={{ uri: avatarUri }} style={{ width: 36, height: 36 }} resizeMode="cover" />
                            ) : (
                              <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted }}>{initial}</Text>
                            )}
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted }} numberOfLines={1}>{nameToShow}</Text>
                            {wasDeclined && (
                              <Text style={{ fontSize: typography.sizes.xs, color: colors.error, marginTop: 2 }}>Declined by host</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
              {(rsvpsByStatus.going.length + rsvpsByStatus.pending.length + rsvpsByStatus.maybe.length + rsvpsByStatus.cant.length) === 0 && (
                <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.xl, textAlign: "center" }}>No guests yet</Text>
              )}
            </ScrollView>
          </View>

          {/* Guest manage action panel — absolute overlay inside the same Modal */}
          {selectedGuestPhone !== null && (() => {
            const phone = selectedGuestPhone;
            const section = selectedGuestSection;
            const profile = guestProfiles[phone] ?? goingProfiles[phone];
            const name = getDisplayName(profile ?? null, phone);
            const rsvpEntry = [...rsvpsByStatus.going, ...rsvpsByStatus.pending].find((r) => r.user_phone === phone);
            const hasPlusOne = rsvpEntry?.plus_one ?? false;

            const closeSheet = () => { setSelectedGuestPhone(null); setSelectedGuestSection(null); };

            const doApprove = async () => {
              try {
                await approveRsvp(params.id!, phone);
                const rsvps = await getRsvpsForEvent(params.id!);
                setRsvpsByStatus({ going: rsvps.going, pending: rsvps.pending, maybe: rsvps.maybe, cant: rsvps.cant });
                setGoingCount(rsvps.going.length);
                closeSheet();
              } catch (err) {
                const msg = err instanceof Error ? err.message : "";
                closeSheet();
                if (msg.includes("capacity")) {
                  Alert.alert("Event is full", "This event is at capacity. You can't approve more guests.");
                } else {
                  Alert.alert("Error", msg || "Failed to approve");
                }
              }
            };

            const doDecline = () => {
              Alert.alert("Decline request?", `${name} will be removed from the pending list.`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Decline",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await declineRsvp(params.id!, phone);
                      const rsvps = await getRsvpsForEvent(params.id!);
                      setRsvpsByStatus({ going: rsvps.going, pending: rsvps.pending, maybe: rsvps.maybe, cant: rsvps.cant });
                      closeSheet();
                    } catch (err) {
                      Alert.alert("Error", err instanceof Error ? err.message : "Failed to decline");
                    }
                  },
                },
              ]);
            };

            const doRemoveGuest = () => {
              Alert.alert("Remove guest?", `${name} will be removed from the event.`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await removeRsvp(params.id!, phone);
                      const rsvps = await getRsvpsForEvent(params.id!);
                      setRsvpsByStatus({ going: rsvps.going, pending: rsvps.pending, maybe: rsvps.maybe, cant: rsvps.cant });
                      setGoingCount(rsvps.going.length);
                      closeSheet();
                    } catch (err) {
                      Alert.alert("Error", err instanceof Error ? err.message : "Failed to remove guest");
                    }
                  },
                },
              ]);
            };

            const doRemovePlusOne = () => {
              Alert.alert("Remove +1?", `This will remove ${name}'s guest.`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await setPlusOne(params.id!, phone, false);
                      await refetchGoingCount();
                      closeSheet();
                    } catch (err) {
                      Alert.alert("Error", err instanceof Error ? err.message : "Failed to remove guest");
                    }
                  },
                },
              ]);
            };

            return (
              <View
                key="guest-action-sheet"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                  padding: spacing.xl,
                  paddingBottom: insets.bottom + spacing.xl,
                }}
              >
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg }} />
                <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text, marginBottom: spacing.xs }}>{name}</Text>
                <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing.lg }}>
                  {section === "pending" ? "Pending approval" : hasPlusOne ? "Going · bringing 1 guest" : "Going"}
                </Text>
                <View style={{ gap: spacing.sm }}>
                  {section === "pending" && (
                    <Pressable
                      onPress={doApprove}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primary }}
                    >
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>Approve</Text>
                    </Pressable>
                  )}
                  {section === "pending" && (
                    <Pressable
                      onPress={doDecline}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLight, borderWidth: 0.5, borderColor: colors.border }}
                    >
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.error }}>Decline request</Text>
                    </Pressable>
                  )}
                  {section === "going" && hasPlusOne && (
                    <Pressable
                      onPress={doRemovePlusOne}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLight, borderWidth: 0.5, borderColor: colors.border }}
                    >
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.warning }}>Remove +1</Text>
                    </Pressable>
                  )}
                  {section === "going" && (
                    <Pressable
                      onPress={doRemoveGuest}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLight, borderWidth: 0.5, borderColor: colors.border }}
                    >
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.error }}>Remove guest</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={closeSheet}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLight, borderWidth: 0.5, borderColor: colors.border, marginTop: spacing.xs }}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textMuted }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* Contribution manage sheet */}
      <Modal
        visible={showContribManageSheet && selectedContribId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowContribManageSheet(false); setSelectedContribId(null); }}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay }}
          onPress={() => { setShowContribManageSheet(false); setSelectedContribId(null); }}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedContribId && (() => {
              const c = contributions.find((x) => x.id === selectedContribId);
              if (!c) {
                return (
                  <>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg }} />
                    <Text style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginBottom: spacing.lg }}>Item not found</Text>
                    <AppButton title="Done" onPress={() => { setShowContribManageSheet(false); setSelectedContribId(null); }} variant="secondary" fullWidth />
                  </>
                );
              }
              const isOpen = c.status === "open";
              const isAssignedToMe = c.assigned_user_phone === userPhone;
              const assigneeName = c.assigned_user_phone
                ? (goingProfiles[c.assigned_user_phone] ? getDisplayName(goingProfiles[c.assigned_user_phone] ?? null, c.assigned_user_phone) : c.assigned_user_phone)
                : null;
              return (
                <>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg }} />
                  <Text style={{ fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, color: colors.text, marginBottom: spacing.sm }} numberOfLines={2}>{c.title}</Text>
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing.lg }}>
                    {c.status === "done" ? "Done" : assigneeName ? `Assigned to ${assigneeName}` : "No one yet"}
                  </Text>
                  <View style={{ gap: spacing.sm }}>
                    {isHostMode && (
                      <Pressable
                        onPress={() => {
                          const options = rsvpsByStatus.going.map((g) => ({
                            text: g.user_phone === userPhone ? "You" : (goingProfiles[g.user_phone] ? getDisplayName(goingProfiles[g.user_phone] ?? null, g.user_phone) : g.user_phone),
                            onPress: () => assignContribution(c.id, g.user_phone).then(() => { refetchContribs(); setShowContribManageSheet(false); setSelectedContribId(null); }),
                          }));
                          Alert.alert("Assign to", c.title, [
                            ...options,
                            { text: "Unassign", onPress: () => assignContribution(c.id, null).then(() => { refetchContribs(); setShowContribManageSheet(false); setSelectedContribId(null); }) },
                            { text: "Cancel", style: "cancel" },
                          ]);
                        }}
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLight, borderWidth: 0.5, borderColor: colors.border }}
                      >
                        <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.text }}>Assign</Text>
                      </Pressable>
                    )}
                    {(isHostMode || isAssignedToMe) && (
                      <Pressable
                        onPress={() => toggleContributionStatus(c.id, isOpen ? "done" : "open").then(() => { refetchContribs(); setShowContribManageSheet(false); setSelectedContribId(null); })}
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLight, borderWidth: 0.5, borderColor: colors.border }}
                      >
                        <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: isOpen ? colors.mint : colors.textMuted }}>
                          {isOpen ? "Mark done" : "Undo"}
                        </Text>
                      </Pressable>
                    )}
                    {!isHostMode && isOpen && !c.assigned_user_phone && (
                      <Pressable
                        onPress={() =>
                          assignContribution(c.id, userPhone).then(() => {
                            refetchContribs();
                            showBringToast(c.id, c.title);
                            setShowContribManageSheet(false);
                            setSelectedContribId(null);
                          })
                        }
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primary }}
                      >
                        <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>Claim</Text>
                      </Pressable>
                    )}
                    {!isHostMode && isAssignedToMe && (
                      <Pressable
                        onPress={() =>
                          assignContribution(c.id, null).then(() => {
                            refetchContribs();
                            clearBringToast();
                            setShowContribManageSheet(false);
                            setSelectedContribId(null);
                          })
                        }
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLight, borderWidth: 0.5, borderColor: colors.border }}
                      >
                        <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textMuted }}>Unclaim</Text>
                      </Pressable>
                    )}
                    {isHostMode && (
                      <Pressable
                        onPress={() => {
                          Alert.alert("Remove item", `Remove "${c.title}"?`, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Remove", style: "destructive", onPress: () => removeContribution(c.id).then(() => { refetchContribs(); setShowContribManageSheet(false); setSelectedContribId(null); }) },
                          ]);
                        }}
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceLight, borderWidth: 0.5, borderColor: colors.border }}
                      >
                        <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.error }}>Remove</Text>
                      </Pressable>
                    )}
                  </View>
                  <AppButton title="Done" onPress={() => { setShowContribManageSheet(false); setSelectedContribId(null); }} variant="secondary" fullWidth style={{ marginTop: spacing.xl }} />
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import {
  supabase,
  Event as SupabaseEvent,
  EventType,
  EventContribution,
  LineupEntry,
  normalizeEventType,
} from "../lib/supabase";
export type { LineupEntry };
import { onboardingStore } from "../state/onboardingStore";
import { generateInviteCode } from "../utils/inviteCode";
import { getDefaultCoverKey } from "../utils/covers";
import { isValidCoverUrl } from "../utils/coverUrl";
import { compareEventsDefaultChronological } from "../utils/eventListOrdering";
import { areSamePhone, normalizePhoneForCompare } from "../utils/phone";

export interface Event {
  id: string;
  title: string;
  dateTime: string;
  location?: string;
  details?: string;
  capacity?: string;
  visibility: "public" | "private";
  approvalRequired?: boolean;
  hostPhone?: string;
  hostName?: string;
  eventType?: EventType;
  inviteCode?: string;
  coverKey?: string;
  coverUrl?: string;
  lineup?: LineupEntry[];
  attendingStatus?: "going" | "pending" | "maybe" | "cant";
  /** Populated for events the user hosts: guests awaiting approval (status pending). */
  pendingRsvpCount?: number;
  declinedByHost?: boolean;
  createdAt: string;
  locationVisibility?: "now" | "reveal";
  revealHoursBefore?: number | null;
  locationName?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  hideGuestNames?: boolean;
  hideGuestAvatars?: boolean;
  status?: "active" | "cancelled";
  cancellationReason?: string | null;
  dressCode?: string;
  audience?: string;
  allowPlusOne?: boolean;
  priceMode?: "free" | "paid";
  priceAmount?: number | null;
  priceCurrency?: string;
  locationExactAudience?: "all_viewers" | "going_only";
}

/** Result of resolving an invite code — distinguishes wrong code vs connectivity vs server errors. */
export type FetchEventByInviteCodeResult =
  | { kind: "ok"; event: Event }
  | { kind: "invalid_code" }
  | { kind: "network" }
  | { kind: "server" };

/** True when the failure is likely connectivity (not invalid code or HTTP/API semantics). */
function isNetworkLikeFetchError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg =
    err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : String(err ?? "");
  const m = msg.toLowerCase();
  return (
    m.includes("network request failed") ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    m.includes("internet connection appears to be offline") ||
    m.includes("networkerror") ||
    m.includes("could not connect") ||
    m.includes("connection refused") ||
    m.includes("timed out") ||
    m.includes("timeout")
  );
}

function classifyInviteCodeFetchFailure(err: unknown): "network" | "server" {
  return isNetworkLikeFetchError(err) ? "network" : "server";
}

export interface RsvpByStatus {
  going: { user_phone: string; plus_one?: boolean }[];
  pending: { user_phone: string; plus_one?: boolean }[];
  maybe: { user_phone: string; plus_one?: boolean }[];
  cant: { user_phone: string; plus_one?: boolean; declined_by_host?: boolean }[];
}

/**
 * Expected RSVP outcome shown to the user (e.g. event full). Not treated as an app defect:
 * {@link submitRsvp} does not console.error these, avoiding RN LogBox/redbox noise.
 */
export class RsvpUserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RsvpUserFacingError";
  }
}

function rsvpRowsSeatSum(rows: { plus_one?: boolean }[]): number {
  return rows.reduce((sum, r) => sum + 1 + (r.plus_one ? 1 : 0), 0);
}

/** Stricter of DB vs unsaved form capacity when both are set (positive integers). */
export function resolveCapacityLimitForAutoApproval(formCap: number | null, dbCap: number | null): number | null {
  const db = typeof dbCap === "number" && !Number.isNaN(dbCap) && dbCap > 0 ? dbCap : null;
  const fm = typeof formCap === "number" && !Number.isNaN(formCap) && formCap > 0 ? formCap : null;
  if (fm != null && db != null) return Math.min(fm, db);
  return fm ?? db ?? null;
}

/**
 * If switching to auto approval would accept all pending as Going, returns null (OK).
 * Otherwise returns a short message for Alert (capacity would be exceeded).
 * `capacityLimit` null / non-positive means unlimited for this check.
 */
export function getAutoApprovalPendingCapacityBlockReason(
  capacityLimit: number | null | undefined,
  rsvps: RsvpByStatus,
): string | null {
  if (!rsvps.pending.length) return null;
  const cap =
    typeof capacityLimit === "number" && !Number.isNaN(capacityLimit) && capacityLimit > 0
      ? capacityLimit
      : null;
  if (cap == null) return null;
  const goingSeats = rsvpRowsSeatSum(rsvps.going);
  const pendingSeats = rsvpRowsSeatSum(rsvps.pending);
  if (goingSeats + pendingSeats > cap) {
    return "There is not enough capacity to accept every pending request. Review or decline pending guests first, or raise the capacity, then try again.";
  }
  return null;
}

interface EventsContextType {
  events: Event[];
  loading: boolean;
  error: string | null;
  fetchEvents: () => Promise<void>;
  createEvent: (event: {
    title: string;
    dateTime: string;
    location?: string;
    locationName?: string;
    locationAddress?: string;
    locationLat?: number;
    locationLng?: number;
    details?: string;
    capacity?: string;
    visibility?: "public" | "private";
    approvalRequired?: boolean;
    eventType?: EventType;
    coverKey?: string;
    coverUrl?: string;
    lineup?: LineupEntry[];
    locationVisibility?: "now" | "reveal";
    revealHoursBefore?: number | null;
    hideGuestNames?: boolean;
    hideGuestAvatars?: boolean;
    dressCode?: string;
    audience?: string;
    allowPlusOne?: boolean;
    priceMode?: "free" | "paid";
    priceAmount?: number | null;
    priceCurrency?: string;
    locationExactAudience?: "all_viewers" | "going_only";
  }) => Promise<string | undefined>;
  updateEvent: (
    id: string,
    event: {
      title: string;
      dateTime: string;
      location?: string;
      locationName?: string;
      locationAddress?: string;
      locationLat?: number;
      locationLng?: number;
      details?: string;
      capacity?: string;
      visibility?: "public" | "private";
      approvalRequired?: boolean;
      eventType?: EventType;
      coverKey?: string;
      coverUrl?: string;
      lineup?: LineupEntry[];
      locationVisibility?: "now" | "reveal";
      revealHoursBefore?: number | null;
      hideGuestNames?: boolean;
      hideGuestAvatars?: boolean;
      dressCode?: string;
      audience?: string;
      allowPlusOne?: boolean;
      priceMode?: "free" | "paid";
      priceAmount?: number | null;
      priceCurrency?: string;
      locationExactAudience?: "all_viewers" | "going_only";
    }
  ) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  cancelEvent: (id: string, cancellationReason?: string | null) => Promise<void>;
  fetchPublicEvents: () => Promise<Event[]>;
  /** Going RSVP counts per event id (for Discover popularity sort). */
  getGoingCountsForEventIds: (eventIds: string[]) => Promise<Record<string, number>>;
  submitRsvp: (eventId: string, userPhone: string, status: "going" | "maybe" | "cant" | "pending") => Promise<void>;
  setPlusOne: (eventId: string, userPhone: string, plusOne: boolean) => Promise<void>;
  removeRsvp: (eventId: string, userPhone: string) => Promise<void>;
  getRsvp: (eventId: string, userPhone: string) => Promise<"going" | "maybe" | "cant" | "pending" | null>;
  getRsvpsForEvent: (eventId: string) => Promise<RsvpByStatus>;
  approveRsvp: (eventId: string, userPhone: string) => Promise<void>;
  /**
   * Approves all pending RSVPs as Going, then sets approval_required false.
   * Use when the host switches from manual to auto approval with pending requests.
   * `formCapacityLimit` is the capacity from the edit form (null = unlimited); combined with DB capacity using the stricter limit.
   */
  finalizeManualToAutoApproval: (eventId: string, formCapacityLimit: number | null) => Promise<void>;
  declineRsvp: (eventId: string, userPhone: string) => Promise<void>;
  fetchEventByInviteCode: (code: string) => Promise<FetchEventByInviteCodeResult>;
  getContributions: (eventId: string) => Promise<EventContribution[]>;
  addContribution: (eventId: string, title: string) => Promise<void>;
  removeContribution: (id: string) => Promise<void>;
  assignContribution: (id: string, userPhone: string | null) => Promise<void>;
  unassignContributionsForUser: (eventId: string, userPhone: string) => Promise<void>;
  /** Clears assignments whose assignee is not in the current going list (e.g. left or removed). */
  clearContributionAssigneesNotGoing: (eventId: string, goingPhones: readonly string[]) => Promise<void>;
  toggleContributionStatus: (id: string, status: "open" | "done") => Promise<void>;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

// Convert Supabase event to app event format (cover_key -> coverKey, event_type -> eventType)
function convertSupabaseEvent(dbEvent: SupabaseEvent): Event {
  const normalizedType = normalizeEventType(dbEvent.event_type);
  const coverKey = dbEvent.cover_key != null ? String(dbEvent.cover_key) : undefined;
  const locVis = dbEvent.location_visibility;
  const locationName = dbEvent.location_name || undefined;
  const locationAddress = dbEvent.location_address || undefined;
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    dateTime: dbEvent.date_time,
    // Prefer location_name, fall back to legacy location column
    location: locationName || dbEvent.location || undefined,
    details: dbEvent.details || undefined,
    capacity: dbEvent.capacity?.toString() || undefined,
    visibility: dbEvent.visibility,
    approvalRequired: dbEvent.approval_required ?? false,
    hostPhone: dbEvent.host_phone || undefined,
    hostName: dbEvent.host_name || undefined,
    ...(normalizedType != null ? { eventType: normalizedType } : {}),
    inviteCode: dbEvent.invite_code || undefined,
    coverKey,
    coverUrl: isValidCoverUrl(dbEvent.cover_url) ? (dbEvent.cover_url ?? undefined) : undefined,
    lineup: dbEvent.lineup ?? undefined,
    createdAt: dbEvent.created_at ?? "",
    locationVisibility: locVis === "now" || locVis === "reveal" ? locVis : undefined,
    revealHoursBefore: dbEvent.reveal_hours_before ?? undefined,
    locationName,
    locationAddress,
    locationLat: dbEvent.location_lat ?? undefined,
    locationLng: dbEvent.location_lng ?? undefined,
    hideGuestNames: dbEvent.hide_guest_names ?? false,
    hideGuestAvatars: dbEvent.hide_guest_avatars ?? false,
    status: dbEvent.status === "cancelled" ? "cancelled" : "active",
    cancellationReason: dbEvent.cancellation_reason ?? undefined,
    dressCode: dbEvent.dress_code ?? undefined,
    audience: dbEvent.audience ?? undefined,
    allowPlusOne: dbEvent.allow_plus_one ?? false,
    priceMode: dbEvent.price_mode === "paid" ? "paid" : "free",
    priceAmount: dbEvent.price_amount ?? null,
    priceCurrency: dbEvent.price_currency ?? "SAR",
    locationExactAudience: dbEvent.location_exact_audience === "all_viewers" ? "all_viewers" : "going_only",
  };
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPhoneOrThrow = useCallback(async (): Promise<string> => {
    const phone = await onboardingStore.getPhone();
    if (!phone) throw new Error("You must complete onboarding first");
    return phone;
  }, []);

  const assertCurrentUserCanManageEventRsvp = useCallback(
    async (eventId: string, targetUserPhone: string): Promise<{ isHost: boolean }> => {
      const currentPhone = await getCurrentPhoneOrThrow();
      const currentNorm = normalizePhoneForCompare(currentPhone);
      const targetNorm = normalizePhoneForCompare(targetUserPhone);
      if (!currentNorm || !targetNorm) {
        throw new Error("Invalid user identity");
      }
      const { data: eventRow, error: eventErr } = await supabase
        .from("events")
        .select("host_phone")
        .eq("id", eventId)
        .single();
      if (eventErr) throw eventErr;
      const isHost = areSamePhone(eventRow?.host_phone, currentPhone);
      const isSelf = currentNorm === targetNorm;
      if (!isHost && !isSelf) {
        throw new Error("You are not allowed to modify this RSVP.");
      }
      return { isHost };
    },
    [getCurrentPhoneOrThrow]
  );

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const phone = await onboardingStore.getPhone();
      if (!phone) {
        setEvents([]);
        return;
      }
      // Drop previous user's merged list immediately so UI cannot briefly show wrong events after sign-in / switch.
      setEvents([]);

      // 1) Events user created (host)
      const { data: createdData, error: createdErr } = await supabase
        .from("events")
        .select("*")
        .eq("host_phone", phone)
        .order("date_time", { ascending: true });

      if (createdErr) throw createdErr;

      const createdIds = new Set((createdData || []).map((e) => e.id));

      // 2) Event IDs and RSVP status for "going" or "pending" (as guest)
      const { data: rsvpData } = await supabase
        .from("rsvps")
        .select("event_id, status, declined_by_host")
        .eq("user_phone", phone)
        .in("status", ["going", "pending", "maybe", "cant"]);

      const attendingMap = new Map<string, "going" | "pending" | "maybe" | "cant">();
      const declinedMap = new Map<string, boolean>();
      (rsvpData || []).forEach((r) => {
        if (!createdIds.has(r.event_id)) {
          attendingMap.set(r.event_id, r.status as "going" | "pending" | "maybe" | "cant");
          if (r.declined_by_host) declinedMap.set(r.event_id, true);
        }
      });
      const attendingIds = Array.from(attendingMap.keys());

      // 3) Fetch full event data for attending events
      let attendingEvents: Event[] = [];
      if (attendingIds.length > 0) {
        const { data: attendingData } = await supabase
          .from("events")
          .select("*")
          .in("id", attendingIds);
        attendingEvents = (attendingData || []).map(convertSupabaseEvent);
      }

      const created = (createdData || []).map(convertSupabaseEvent);
      const hostedIds = created.map((e) => e.id);
      const pendingCountByEventId = new Map<string, number>();
      if (hostedIds.length > 0) {
        const { data: pendingRows, error: pendingErr } = await supabase
          .from("rsvps")
          .select("event_id")
          .eq("status", "pending")
          .in("event_id", hostedIds);
        if (pendingErr) throw pendingErr;
        (pendingRows || []).forEach((row) => {
          const evId = row.event_id as string;
          pendingCountByEventId.set(evId, (pendingCountByEventId.get(evId) ?? 0) + 1);
        });
      }
      const createdWithPending = created.map((e) => ({
        ...e,
        pendingRsvpCount: pendingCountByEventId.get(e.id) ?? 0,
      }));
      const attendingWithStatus = attendingEvents.map((e) => ({
        ...e,
        attendingStatus: attendingMap.get(e.id),
        declinedByHost: declinedMap.get(e.id) ?? false,
      }));
      const merged = [...createdWithPending, ...attendingWithStatus].sort((a, b) =>
        compareEventsDefaultChronological(a, b, Date.now())
      );
      setEvents(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch events");
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createEvent = useCallback(
    async (event: {
      title: string;
      dateTime: string;
      location?: string;
      locationName?: string;
      locationAddress?: string;
      locationLat?: number;
      locationLng?: number;
      details?: string;
      capacity?: string;
      visibility?: "public" | "private";
      approvalRequired?: boolean;
      eventType?: EventType;
      coverKey?: string;
      coverUrl?: string;
      lineup?: LineupEntry[];
      locationVisibility?: "now" | "reveal";
      revealHoursBefore?: number | null;
      hideGuestNames?: boolean;
      hideGuestAvatars?: boolean;
      dressCode?: string;
      audience?: string;
      allowPlusOne?: boolean;
      priceMode?: "free" | "paid";
      priceAmount?: number | null;
      priceCurrency?: string;
      locationExactAudience?: "all_viewers" | "going_only";
    }) => {
      setError(null);
      try {
        const phone = await onboardingStore.getPhone();
        if (!phone) throw new Error("You must complete onboarding first");

        const profile = await onboardingStore.getProfile();
        const hostName = profile
          ? [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || null
          : null;

        const visibility = event.visibility || "private";
        const resolvedType = event.eventType ?? null;
        const coverKey = event.coverKey ?? getDefaultCoverKey(resolvedType);

        // Retry up to 3 times if invite_code collision
        const maxRetries = 3;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const inviteCode = generateInviteCode();

          const locationName = event.locationName || event.location || null;
          const { data, error: insertError } = await supabase
            .from("events")
            .insert({
              title: event.title,
              date_time: event.dateTime,
              location: locationName,
              location_name: locationName,
              location_address: event.locationAddress || null,
              location_lat: event.locationLat ?? null,
              location_lng: event.locationLng ?? null,
              details: event.details || null,
              capacity: event.capacity ? parseInt(event.capacity, 10) : null,
              visibility,
              approval_required: event.approvalRequired ?? false,
              host_phone: phone,
              host_name: hostName,
              event_type: resolvedType,
              invite_code: inviteCode,
              cover_key: coverKey,
              cover_url: isValidCoverUrl(event.coverUrl) ? event.coverUrl : null,
              lineup: event.lineup && event.lineup.length > 0 ? event.lineup : null,
              location_visibility: event.locationVisibility ?? null,
              reveal_hours_before: event.revealHoursBefore ?? null,
              hide_guest_names: event.hideGuestNames ?? false,
              hide_guest_avatars: event.hideGuestAvatars ?? false,
              dress_code: event.dressCode || null,
              audience: event.audience || null,
              allow_plus_one: event.allowPlusOne ?? false,
              price_mode: event.priceMode ?? "free",
              price_amount: event.priceMode === "paid" ? (event.priceAmount ?? null) : null,
              price_currency: event.priceMode === "paid" ? (event.priceCurrency ?? "SAR") : null,
              location_exact_audience: event.locationExactAudience ?? "going_only",
            })
            .select("*")
            .single();

          if (!insertError && data) {
            const newEvent: Event = { ...convertSupabaseEvent(data), pendingRsvpCount: 0 };
            setEvents((prev) => [newEvent, ...prev]);
            return data.id as string;
          }

          // Check if error is unique constraint violation on invite_code
          const isUniqueViolation =
            insertError?.code === "23505" &&
            insertError?.message?.includes("invite_code");

          if (!isUniqueViolation) {
            throw insertError;
          }

          lastError = insertError;
        }

        throw lastError || new Error("Failed to create event after retries");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create event");
        console.error("Error creating event:", err);
        throw err;
      }
    },
    []
  );

  const updateEvent = useCallback(
    async (
      id: string,
      event: {
        title: string;
        dateTime: string;
        location?: string;
        locationName?: string;
        locationAddress?: string;
        locationLat?: number;
        locationLng?: number;
        details?: string;
        capacity?: string;
        visibility?: "public" | "private";
        approvalRequired?: boolean;
        eventType?: EventType;
        coverKey?: string;
        coverUrl?: string;
        lineup?: LineupEntry[];
        locationVisibility?: "now" | "reveal";
        revealHoursBefore?: number | null;
        hideGuestNames?: boolean;
        hideGuestAvatars?: boolean;
        dressCode?: string;
        audience?: string;
        allowPlusOne?: boolean;
        priceMode?: "free" | "paid";
        priceAmount?: number | null;
        priceCurrency?: string;
        locationExactAudience?: "all_viewers" | "going_only";
      }
    ) => {
      setError(null);
      try {
        const phone = await onboardingStore.getPhone();
        if (!phone) throw new Error("You must complete onboarding first");

        const { data: existing } = await supabase
          .from("events")
          .select("host_phone")
          .eq("id", id)
          .single();
        if (!existing || !areSamePhone(existing.host_phone, phone)) {
          throw new Error("You can only edit events you created");
        }

        const locationName = event.locationName || event.location || null;
        const visibility = event.visibility || "private";
        const updatePayload: Record<string, unknown> = {
          title: event.title,
          date_time: event.dateTime,
          location: locationName,
          location_name: locationName,
          location_address: event.locationAddress || null,
          location_lat: event.locationLat ?? null,
          location_lng: event.locationLng ?? null,
          details: event.details || null,
          capacity: event.capacity ? parseInt(event.capacity, 10) : null,
          visibility,
          approval_required: event.approvalRequired ?? false,
          event_type: event.eventType ?? null,
          cover_key: event.coverKey ?? null,
          cover_url: isValidCoverUrl(event.coverUrl) ? event.coverUrl : null,
          lineup: event.lineup && event.lineup.length > 0 ? event.lineup : null,
          location_visibility: event.locationVisibility ?? null,
          reveal_hours_before: event.revealHoursBefore ?? null,
          hide_guest_names: event.hideGuestNames ?? false,
          hide_guest_avatars: event.hideGuestAvatars ?? false,
          dress_code: event.dressCode || null,
          audience: event.audience || null,
          allow_plus_one: event.allowPlusOne ?? false,
          price_mode: event.priceMode ?? "free",
          price_amount: event.priceMode === "paid" ? (event.priceAmount ?? null) : null,
          price_currency: event.priceMode === "paid" ? (event.priceCurrency ?? "SAR") : null,
          location_exact_audience: event.locationExactAudience ?? "going_only",
        };
        const { data, error: updateError } = await supabase
          .from("events")
          .update(updatePayload)
          .eq("id", id)
          .select("*")
          .single();

        if (updateError) throw updateError;

        if (data) {
          const updatedEvent = convertSupabaseEvent(data);
          setEvents((prev) =>
            prev.map((e) =>
              e.id === id ? { ...updatedEvent, pendingRsvpCount: e.pendingRsvpCount } : e
            )
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update event");
        console.error("Error updating event:", err);
        throw err;
      }
    },
    []
  );

  const deleteEvent = useCallback(async (id: string) => {
    setError(null);
    try {
      const phone = await onboardingStore.getPhone();
      if (!phone) throw new Error("You must complete onboarding first");

      const { data: existing } = await supabase
        .from("events")
        .select("host_phone")
        .eq("id", id)
        .single();
      if (!existing || !areSamePhone(existing.host_phone, phone)) {
        throw new Error("You can only delete events you created");
      }

      const { error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
      console.error("Error deleting event:", err);
      throw err;
    }
  }, []);

  const cancelEvent = useCallback(async (id: string, cancellationReason?: string | null) => {
    setError(null);
    try {
      const phone = await onboardingStore.getPhone();
      if (!phone) throw new Error("You must complete onboarding first");

      const { data: existing } = await supabase
        .from("events")
        .select("host_phone")
        .eq("id", id)
        .single();
      if (!existing || !areSamePhone(existing.host_phone, phone)) {
        throw new Error("You can only cancel events you created");
      }

      const { error: updateError } = await supabase
        .from("events")
        .update({ status: "cancelled", cancellation_reason: cancellationReason?.trim() || null })
        .eq("id", id);

      if (updateError) throw updateError;

      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, status: "cancelled" as const, cancellationReason: cancellationReason?.trim() || undefined } : e));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel event");
      throw err;
    }
  }, []);

  const fetchPublicEvents = useCallback(async (): Promise<Event[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("visibility", "public")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      return (data || []).map(convertSupabaseEvent);
    } catch (err) {
      console.error("Error fetching public events:", err);
      return [];
    }
  }, []);

  const getGoingCountsForEventIds = useCallback(async (eventIds: string[]): Promise<Record<string, number>> => {
    if (eventIds.length === 0) return {};
    try {
      const { data, error } = await supabase
        .from("rsvps")
        .select("event_id")
        .eq("status", "going")
        .in("event_id", eventIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const id = (row as { event_id: string }).event_id;
        counts[id] = (counts[id] ?? 0) + 1;
      }
      return counts;
    } catch (err) {
      console.error("Error fetching going counts:", err);
      return {};
    }
  }, []);

  const setPlusOne = useCallback(async (eventId: string, userPhone: string, plusOne: boolean) => {
    const { isHost } = await assertCurrentUserCanManageEventRsvp(eventId, userPhone);
    const { data: currentRsvp, error: rsvpErr } = await supabase
      .from("rsvps")
      .select("status")
      .eq("event_id", eventId)
      .eq("user_phone", userPhone)
      .maybeSingle();
    if (rsvpErr) throw rsvpErr;
    if (!isHost && currentRsvp?.status !== "going") {
      throw new Error("Only going guests can manage extra guests.");
    }
    const { data: eventInfo, error: eventInfoErr } = await supabase
      .from("events")
      .select("allow_plus_one, status, date_time, capacity")
      .eq("id", eventId)
      .single();
    if (eventInfoErr) throw eventInfoErr;
    if (!eventInfo || eventInfo.status === "cancelled") {
      throw new Error("This event is no longer available.");
    }
    const eventMs = new Date(eventInfo.date_time).getTime();
    if (!Number.isNaN(eventMs) && eventMs < Date.now()) {
      throw new Error("This event has already passed.");
    }
    if (plusOne && !eventInfo.allow_plus_one) {
      throw new Error("Extra guests are not allowed for this event.");
    }
    if (plusOne) {
      const { data: eventRow } = await supabase
        .from("events")
        .select("capacity")
        .eq("id", eventId)
        .single();
      const capacity = eventRow?.capacity;
      if (capacity != null && capacity > 0) {
        const { data: goingRsvps } = await supabase
          .from("rsvps")
          .select("plus_one")
          .eq("event_id", eventId)
          .eq("status", "going");
        const totalAttending = (goingRsvps || []).reduce(
          (sum, r) => sum + 1 + (r.plus_one ? 1 : 0), 0
        );
        if (totalAttending >= capacity) {
          throw new Error("Event is full. Cannot add a guest.");
        }
      }
    }
    const { error } = await supabase
      .from("rsvps")
      .update({ plus_one: plusOne })
      .eq("event_id", eventId)
      .eq("user_phone", userPhone);
    if (error) throw error;
  }, []);

  const submitRsvp = useCallback(
    async (eventId: string, userPhone: string, status: "going" | "maybe" | "cant" | "pending") => {
      try {
        const currentPhone = await getCurrentPhoneOrThrow();
        if (!areSamePhone(currentPhone, userPhone)) {
          throw new Error("You can only update your own RSVP.");
        }
        const { data: eventRow } = await supabase
          .from("events")
          .select("capacity, approval_required, visibility, status, date_time")
          .eq("id", eventId)
          .single();
        if (eventRow?.status === "cancelled") {
          throw new RsvpUserFacingError("This event has been cancelled.");
        }
        const eventMs = new Date(eventRow?.date_time ?? "").getTime();
        if (!Number.isNaN(eventMs) && eventMs < Date.now()) {
          throw new RsvpUserFacingError("This event has already passed.");
        }

        const approvalRequired = eventRow?.approval_required ?? false;
        const isPublic = eventRow?.visibility === "public";
        const effectiveStatus: "going" | "maybe" | "cant" | "pending" =
          status === "going" && approvalRequired ? "pending" : status;

        // Capacity applies only to confirmed Going (auto approval). Manual-approval Going
        // requests are stored as pending and do not consume a going slot here.
        if (status === "going" && !approvalRequired) {
          const capacity = eventRow?.capacity;
          if (capacity != null && capacity > 0) {
            const { data: existingRsvp } = await supabase
              .from("rsvps")
              .select("status")
              .eq("event_id", eventId)
              .eq("user_phone", userPhone)
              .maybeSingle();

            const userAlreadyGoing = existingRsvp?.status === "going";
            if (!userAlreadyGoing) {
              const { data: goingRsvps, error: countErr } = await supabase
                .from("rsvps")
                .select("plus_one")
                .eq("event_id", eventId)
                .eq("status", "going");
              if (countErr) throw countErr;
              const goingCount = (goingRsvps || []).reduce(
                (sum, r) => sum + 1 + (r.plus_one ? 1 : 0), 0
              );
              if (goingCount >= capacity) {
                throw new RsvpUserFacingError(
                  isPublic
                    ? "This event is full."
                    : "This event is full. You can RSVP as Maybe to stay updated."
                );
              }
            }
          }
        }

        const upsertPayload: Record<string, unknown> = {
          event_id: eventId,
          user_phone: userPhone,
          status: effectiveStatus,
          declined_by_host: false,
        };
        // Reset plus_one when not going
        if (effectiveStatus !== "going") {
          upsertPayload.plus_one = false;
        }
        const { error: upsertError } = await supabase
          .from("rsvps")
          .upsert(upsertPayload, { onConflict: "event_id,user_phone" });
        if (upsertError) throw upsertError;
      } catch (err) {
        if (!(err instanceof RsvpUserFacingError)) {
          console.error("Error submitting RSVP:", err);
        }
        throw err;
      }
    },
    []
  );

  const getRsvp = useCallback(
    async (eventId: string, userPhone: string): Promise<"going" | "maybe" | "cant" | "pending" | null> => {
      try {
        const { data, error: fetchError } = await supabase
          .from("rsvps")
          .select("status")
          .eq("event_id", eventId)
          .eq("user_phone", userPhone)
          .maybeSingle();

        if (fetchError) throw fetchError;
        return data?.status || null;
      } catch (err) {
        console.error("Error fetching RSVP:", err);
        return null;
      }
    },
    []
  );

  const getRsvpsForEvent = useCallback(async (eventId: string): Promise<RsvpByStatus> => {
    const { data } = await supabase
      .from("rsvps")
      .select("status, user_phone, plus_one, declined_by_host")
      .eq("event_id", eventId);
    const going: { user_phone: string; plus_one?: boolean }[] = [];
    const pending: { user_phone: string; plus_one?: boolean }[] = [];
    const maybe: { user_phone: string; plus_one?: boolean }[] = [];
    const cant: { user_phone: string; plus_one?: boolean; declined_by_host?: boolean }[] = [];
    (data || []).forEach((r) => {
      if (r.status === "going") going.push({ user_phone: r.user_phone, plus_one: r.plus_one ?? false });
      else if (r.status === "pending") pending.push({ user_phone: r.user_phone, plus_one: r.plus_one ?? false });
      else if (r.status === "maybe") maybe.push({ user_phone: r.user_phone, plus_one: r.plus_one ?? false });
      else cant.push({ user_phone: r.user_phone, plus_one: r.plus_one ?? false, declined_by_host: r.declined_by_host ?? false });
    });
    return { going, pending, maybe, cant };
  }, []);

  const approveRsvp = useCallback(async (eventId: string, userPhone: string) => {
    const { isHost } = await assertCurrentUserCanManageEventRsvp(eventId, userPhone);
    if (!isHost) throw new Error("Only the host can approve guests.");
    const { data: eventRow } = await supabase
      .from("events")
      .select("capacity")
      .eq("id", eventId)
      .single();
    const capacity = eventRow?.capacity;
    if (capacity != null && capacity > 0) {
      const { data: goingRsvps } = await supabase
        .from("rsvps")
        .select("plus_one")
        .eq("event_id", eventId)
        .eq("status", "going");
      const totalGoing = (goingRsvps || []).reduce(
        (sum, r) => sum + 1 + (r.plus_one ? 1 : 0), 0
      );
      if (totalGoing >= capacity) {
        throw new RsvpUserFacingError(
          "The event is at capacity. You can't approve this guest right now.",
        );
      }
    }
    const { error } = await supabase
      .from("rsvps")
      .update({ status: "going" })
      .eq("event_id", eventId)
      .eq("user_phone", userPhone);
    if (error) throw error;
  }, [assertCurrentUserCanManageEventRsvp]);

  const finalizeManualToAutoApproval = useCallback(
    async (eventId: string, formCapacityLimit: number | null) => {
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("capacity")
        .eq("id", eventId)
        .single();
      if (evErr) throw evErr;
      const rsvps = await getRsvpsForEvent(eventId);
      const capNum = ev?.capacity != null ? Number(ev.capacity) : NaN;
      const dbCap = !Number.isNaN(capNum) && capNum > 0 ? capNum : null;
      const cap = resolveCapacityLimitForAutoApproval(formCapacityLimit, dbCap);
      const block = getAutoApprovalPendingCapacityBlockReason(cap, rsvps);
      if (block) throw new Error(block);
      for (const p of rsvps.pending) {
        await approveRsvp(eventId, p.user_phone);
      }
      const { data: updated, error: upErr } = await supabase
        .from("events")
        .update({ approval_required: false })
        .eq("id", eventId)
        .select("*")
        .single();
      if (upErr) throw upErr;
      if (updated) {
        const updatedEvent = convertSupabaseEvent(updated);
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...updatedEvent, pendingRsvpCount: 0 } : e))
        );
      }
    },
    [getRsvpsForEvent, approveRsvp],
  );

  const declineRsvp = useCallback(async (eventId: string, userPhone: string) => {
    const { isHost } = await assertCurrentUserCanManageEventRsvp(eventId, userPhone);
    if (!isHost) throw new Error("Only the host can decline guests.");
    const { error } = await supabase
      .from("rsvps")
      .update({ status: "cant", declined_by_host: true })
      .eq("event_id", eventId)
      .eq("user_phone", userPhone);
    if (error) throw error;
  }, [assertCurrentUserCanManageEventRsvp]);

  const removeRsvp = useCallback(async (eventId: string, userPhone: string) => {
    await assertCurrentUserCanManageEventRsvp(eventId, userPhone);
    const { data, error } = await supabase
      .from("rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_phone", userPhone)
      .select("event_id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("RSVP could not be removed.");
    }
  }, [assertCurrentUserCanManageEventRsvp]);

  const fetchEventByInviteCode = useCallback(
    async (code: string): Promise<FetchEventByInviteCodeResult> => {
      const normalized = code.toUpperCase().trim();
      try {
        const { data, error: fetchError } = await supabase
          .from("events")
          .select("*")
          .eq("invite_code", normalized)
          .maybeSingle();

        if (fetchError) {
          const kind = classifyInviteCodeFetchFailure(fetchError);
          return { kind };
        }
        if (!data) {
          return { kind: "invalid_code" };
        }
        return { kind: "ok", event: convertSupabaseEvent(data) };
      } catch (e) {
        const kind = classifyInviteCodeFetchFailure(e);
        return { kind };
      }
    },
    []
  );

  const getContributions = useCallback(async (eventId: string): Promise<EventContribution[]> => {
    const { data } = await supabase
      .from("event_contributions")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    return (data || []) as EventContribution[];
  }, []);

  const addContribution = useCallback(async (eventId: string, title: string) => {
    const { error } = await supabase
      .from("event_contributions")
      .insert({ event_id: eventId, title, status: "open" });
    if (error) throw error;
  }, []);

  const removeContribution = useCallback(async (id: string) => {
    const { error } = await supabase.from("event_contributions").delete().eq("id", id);
    if (error) throw error;
  }, []);

  const assignContribution = useCallback(async (id: string, userPhone: string | null) => {
    const { error } = await supabase
      .from("event_contributions")
      .update({ assigned_user_phone: userPhone })
      .eq("id", id);
    if (error) throw error;
  }, []);

  const unassignContributionsForUser = useCallback(async (eventId: string, userPhone: string) => {
    const { error } = await supabase
      .from("event_contributions")
      .update({ assigned_user_phone: null })
      .eq("event_id", eventId)
      .eq("assigned_user_phone", userPhone);
    if (error) throw error;
  }, []);

  const clearContributionAssigneesNotGoing = useCallback(async (eventId: string, goingPhones: readonly string[]) => {
    const { data, error } = await supabase
      .from("event_contributions")
      .select("id, assigned_user_phone")
      .eq("event_id", eventId);
    if (error) throw error;
    const valid = new Set(goingPhones);
    const staleIds = (data || [])
      .filter((r) => r.assigned_user_phone && !valid.has(r.assigned_user_phone))
      .map((r) => r.id);
    if (staleIds.length === 0) return;
    const { error: uerr } = await supabase
      .from("event_contributions")
      .update({ assigned_user_phone: null })
      .in("id", staleIds);
    if (uerr) throw uerr;
  }, []);

  const toggleContributionStatus = useCallback(async (id: string, status: "open" | "done") => {
    const { error } = await supabase.from("event_contributions").update({ status }).eq("id", id);
    if (error) throw error;
  }, []);

  return (
    <EventsContext.Provider
      value={{
        events,
        loading,
        error,
        fetchEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        cancelEvent,
        fetchPublicEvents,
        getGoingCountsForEventIds,
        submitRsvp,
        setPlusOne,
        removeRsvp,
        getRsvp,
        getRsvpsForEvent,
        approveRsvp,
        finalizeManualToAutoApproval,
        declineRsvp,
        fetchEventByInviteCode,
        getContributions,
        addContribution,
        removeContribution,
        assignContribution,
        unassignContributionsForUser,
        clearContributionAssigneesNotGoing,
        toggleContributionStatus,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  const context = useContext(EventsContext);
  if (!context) {
    throw new Error("useEvents must be used within EventsProvider");
  }
  return context;
}

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { supabase, Event as SupabaseEvent, EventType, EventContribution, LineupEntry } from "../lib/supabase";
export type { LineupEntry };
import { onboardingStore } from "../state/onboardingStore";
import { generateInviteCode } from "../utils/inviteCode";
import { getDefaultCoverKey } from "../utils/covers";
import { isValidCoverUrl } from "../utils/coverUrl";

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
}

export interface RsvpByStatus {
  going: { user_phone: string; plus_one?: boolean }[];
  pending: { user_phone: string; plus_one?: boolean }[];
  maybe: { user_phone: string; plus_one?: boolean }[];
  cant: { user_phone: string; plus_one?: boolean }[];
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
  declineRsvp: (eventId: string, userPhone: string) => Promise<void>;
  fetchEventByInviteCode: (code: string) => Promise<Event | null>;
  getContributions: (eventId: string) => Promise<EventContribution[]>;
  addContribution: (eventId: string, title: string) => Promise<void>;
  removeContribution: (id: string) => Promise<void>;
  assignContribution: (id: string, userPhone: string | null) => Promise<void>;
  toggleContributionStatus: (id: string, status: "open" | "done") => Promise<void>;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

// Convert Supabase event to app event format (cover_key -> coverKey, event_type -> eventType)
function convertSupabaseEvent(dbEvent: SupabaseEvent): Event {
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
    eventType: dbEvent.event_type || "party",
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
  };
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const phone = await onboardingStore.getPhone();
      if (!phone) {
        setEvents([]);
        return;
      }

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
        .select("event_id, status")
        .eq("user_phone", phone)
        .in("status", ["going", "pending", "maybe", "cant"]);

      const attendingMap = new Map<string, "going" | "pending" | "maybe" | "cant">();
      (rsvpData || []).forEach((r) => {
        if (!createdIds.has(r.event_id)) {
          attendingMap.set(r.event_id, r.status as "going" | "pending" | "maybe" | "cant");
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
      const attendingWithStatus = attendingEvents.map((e) => ({
        ...e,
        attendingStatus: attendingMap.get(e.id),
      }));
      const merged = [...created, ...attendingWithStatus].sort(
        (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
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
        const isPrivate = visibility === "private";
        const eventType = event.eventType || "party";
        const coverKey = event.coverKey ?? getDefaultCoverKey(eventType);

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
              event_type: eventType,
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
            })
            .select("*")
            .single();

          if (!insertError && data) {
            const newEvent = convertSupabaseEvent(data);
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
        if (!existing || existing.host_phone !== phone) {
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
          event_type: event.eventType || "party",
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
            prev.map((e) => (e.id === id ? updatedEvent : e))
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
      if (!existing || existing.host_phone !== phone) {
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
      if (!existing || existing.host_phone !== phone) {
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
        const { data: eventRow } = await supabase
          .from("events")
          .select("capacity, approval_required, visibility")
          .eq("id", eventId)
          .single();

        const approvalRequired = eventRow?.approval_required ?? false;
        const isPublic = eventRow?.visibility === "public";
        const effectiveStatus: "going" | "maybe" | "cant" | "pending" =
          status === "going" && approvalRequired ? "pending" : status;

        // Capacity: only "going" counts; "pending" does not
        if (effectiveStatus === "going") {
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
                throw new Error(
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
        console.error("Error submitting RSVP:", err);
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
      .select("status, user_phone, plus_one")
      .eq("event_id", eventId);
    const going: { user_phone: string; plus_one?: boolean }[] = [];
    const pending: { user_phone: string; plus_one?: boolean }[] = [];
    const maybe: { user_phone: string; plus_one?: boolean }[] = [];
    const cant: { user_phone: string; plus_one?: boolean }[] = [];
    (data || []).forEach((r) => {
      const row = { user_phone: r.user_phone, plus_one: r.plus_one ?? false };
      if (r.status === "going") going.push(row);
      else if (r.status === "pending") pending.push(row);
      else if (r.status === "maybe") maybe.push(row);
      else cant.push(row);
    });
    return { going, pending, maybe, cant };
  }, []);

  const approveRsvp = useCallback(async (eventId: string, userPhone: string) => {
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
        throw new Error("Event is at capacity. Cannot approve more guests.");
      }
    }
    const { error } = await supabase
      .from("rsvps")
      .update({ status: "going" })
      .eq("event_id", eventId)
      .eq("user_phone", userPhone);
    if (error) throw error;
  }, []);

  const declineRsvp = useCallback(async (eventId: string, userPhone: string) => {
    const { error } = await supabase
      .from("rsvps")
      .update({ status: "cant" })
      .eq("event_id", eventId)
      .eq("user_phone", userPhone);
    if (error) throw error;
  }, []);

  const removeRsvp = useCallback(async (eventId: string, userPhone: string) => {
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
  }, []);

  const fetchEventByInviteCode = useCallback(
    async (code: string): Promise<Event | null> => {
      try {
        const { data, error: fetchError } = await supabase
          .from("events")
          .select("*")
          .eq("invite_code", code.toUpperCase())
          .single();

        if (fetchError || !data) return null;
        return convertSupabaseEvent(data);
      } catch {
        return null;
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
        declineRsvp,
        fetchEventByInviteCode,
        getContributions,
        addContribution,
        removeContribution,
        assignContribution,
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

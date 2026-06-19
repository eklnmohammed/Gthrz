import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Called whenever any row related to the event changes. Keep it cheap — it may fire in bursts. */
type RealtimeRefresh = () => void;

/**
 * Subscribe to realtime changes for a single event and its guests/bring items.
 *
 * Listens to Postgres changes on:
 *  - `events`               (event edited or cancelled)            id = eventId
 *  - `rsvps`                (RSVP submitted / approved / declined)  event_id = eventId
 *  - `event_contributions`  (bring item added / claimed / done)     event_id = eventId
 *
 * `onChange` is invoked on every relevant change (insert / update / delete) so the
 * caller can re-fetch. Returns a cleanup function that removes the channel.
 */
export function subscribeToEventRealtime(eventId: string, onChange: RealtimeRefresh): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`event-detail:${eventId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rsvps", filter: `event_id=eq.${eventId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "event_contributions", filter: `event_id=eq.${eventId}` },
      onChange,
    )
    // Log subscription lifecycle only (not every update) to avoid log spam.
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        console.log(`[realtime] subscribed to event ${eventId}`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn(`[realtime] event ${eventId} status: ${status}`, err ?? "");
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

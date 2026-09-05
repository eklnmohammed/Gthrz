// send-event-notification
//
// Sends Expo push messages after an event action.
// The client sends { type, eventId, targetPhone? }. Recipients and copy are decided here
// (JWT phone check, then service-role lookup). Notification text is generic: no location,
// names, or invite codes.
//
// Deploy: supabase functions deploy send-event-notification
// Env (injected by Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

type NotificationType =
  | "join_request_created"
  | "join_request_approved"
  | "join_request_declined"
  | "event_cancelled"
  | "rsvp_changed"
  | "bring_item_claimed";

interface RequestBody {
  type?: NotificationType;
  eventId?: string;
  targetPhone?: string;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const OPTIONAL_EXPO_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Keep titles/bodies generic: no location, names, or invite codes.
function textFor(type: NotificationType): { title: string; body: string } {
  switch (type) {
    case "join_request_created":
      return { title: "New join request", body: "A guest requested to join your event." };
    case "join_request_approved":
      return { title: "Join request approved", body: "You have been approved for this event." };
    case "join_request_declined":
      return { title: "Join request declined", body: "Your request to join this event was declined." };
    case "event_cancelled":
      return { title: "Event cancelled", body: "An event you joined has been cancelled." };
    case "rsvp_changed":
      return { title: "RSVP updated", body: "A guest updated their RSVP." };
    case "bring_item_claimed":
      return { title: "Bring item updated", body: "A bring item was claimed." };
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // --- Verify the caller from their JWT (phone claim). ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "unauthorized" }, 401);

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
  const callerPhone = userData?.user?.phone ?? "";
  if (userErr || !callerPhone) return json({ error: "unauthorized" }, 401);

  // --- Parse and validate the request. ---
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { type, eventId, targetPhone } = body;
  if (!type || !eventId) return json({ error: "missing_fields" }, 400);

  // Service-role client bypasses RLS to resolve recipients + read tokens.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: event, error: eventErr } = await admin
    .from("events")
    .select("id, host_phone, visibility, status")
    .eq("id", eventId)
    .maybeSingle();
  if (eventErr) return json({ error: "event_lookup_failed" }, 500);
  if (!event) return json({ error: "event_not_found" }, 404);

  const hostPhone: string | null = event.host_phone;
  const isCallerHost = !!hostPhone && hostPhone === callerPhone;

  // --- Decide recipients server-side, enforcing per-type permissions. ---
  let recipientPhones: string[] = [];

  if (type === "join_request_created" || type === "rsvp_changed") {
    // Caller is the guest acting on their own RSVP; notify the host (not the caller).
    const { data: ownRsvp } = await admin
      .from("rsvps")
      .select("event_id")
      .eq("event_id", eventId)
      .eq("user_phone", callerPhone)
      .maybeSingle();
    if (!ownRsvp) return json({ error: "forbidden" }, 403);
    if (hostPhone && hostPhone !== callerPhone) recipientPhones = [hostPhone];
  } else if (type === "bring_item_claimed") {
    // Only guest self-claims notify the host. Host assigning to a guest is a no-op.
    if (isCallerHost) return json({ ok: true, sent: 0, skipped: "host_claim" });
    if (hostPhone) recipientPhones = [hostPhone];
  } else if (type === "join_request_approved" || type === "join_request_declined") {
    // Host-only action; notify the targeted guest.
    if (!isCallerHost) return json({ error: "forbidden" }, 403);
    if (!targetPhone) return json({ error: "missing_target" }, 400);
    const { data: targetRsvp } = await admin
      .from("rsvps")
      .select("event_id")
      .eq("event_id", eventId)
      .eq("user_phone", targetPhone)
      .maybeSingle();
    if (!targetRsvp) return json({ error: "target_not_found" }, 404);
    recipientPhones = [targetPhone];
  } else if (type === "event_cancelled") {
    // Host-only; notify guests who still have access (going/pending/maybe), never declined.
    if (!isCallerHost) return json({ error: "forbidden" }, 403);
    const { data: rsvps } = await admin
      .from("rsvps")
      .select("user_phone, status")
      .eq("event_id", eventId)
      .in("status", ["going", "pending", "maybe"]);
    recipientPhones = (rsvps ?? [])
      .map((r: { user_phone: string }) => r.user_phone)
      .filter((p: string) => p && p !== hostPhone);
  } else {
    return json({ error: "unknown_type" }, 400);
  }

  // De-duplicate recipients.
  recipientPhones = Array.from(new Set(recipientPhones.filter(Boolean)));
  if (recipientPhones.length === 0) return json({ ok: true, sent: 0 });

  // --- Fetch active Expo tokens for recipients. ---
  const { data: tokenRows, error: tokenErr } = await admin
    .from("user_push_tokens")
    .select("expo_push_token, user_phone")
    .in("user_phone", recipientPhones)
    .eq("is_active", true);
  if (tokenErr) return json({ error: "token_lookup_failed" }, 500);

  const tokens = (tokenRows ?? [])
    .map((r: { expo_push_token: string }) => r.expo_push_token)
    .filter((t: string) => typeof t === "string" && t.startsWith("ExponentPushToken"));
  if (tokens.length === 0) return json({ ok: true, sent: 0 });

  const { title, body: text } = textFor(type);
  const messages: ExpoMessage[] = tokens.map((to) => ({
    to,
    title,
    body: text,
    data: { type, eventId },
  }));

  // --- Send to Expo in batches and collect tokens to deactivate. ---
  const deactivate: string[] = [];
  let sent = 0;

  for (const batch of chunk(messages, 100)) {
    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(OPTIONAL_EXPO_TOKEN ? { Authorization: `Bearer ${OPTIONAL_EXPO_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      const result = await resp.json().catch(() => null);
      const tickets: Array<{ status?: string; details?: { error?: string } }> = result?.data ?? [];
      tickets.forEach((ticket, i) => {
        if (ticket?.status === "ok") {
          sent += 1;
        } else if (ticket?.details?.error === "DeviceNotRegistered") {
          deactivate.push(batch[i].to);
        }
      });
    } catch (_err) {
      // Network/Expo failure for this batch — skip silently, do not fail the whole request.
    }
  }

  // Clean up tokens Expo says are dead so we stop sending to them.
  if (deactivate.length > 0) {
    await admin
      .from("user_push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("expo_push_token", deactivate);
  }

  return json({ ok: true, sent, recipients: recipientPhones.length, deactivated: deactivate.length });
});

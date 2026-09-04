/**
 * Push notifications for Gthrz (Expo).
 *
 * This module is intentionally defensive: every public function fails gracefully
 * (returns null / no-ops) and NEVER throws into app flows. Notification setup must
 * never block startup, sign-in, or sign-out.
 *
 * Identity model: the app keys users by phone (see profiles / rsvps / events), so push
 * tokens are stored in `user_push_tokens.user_phone`. Token registration only works for
 * real (OTP) sessions because RLS requires the phone claim in the JWT; dev-mode (skip OTP)
 * has no session and simply no-ops here.
 *
 * Public API:
 *  - registerForPushNotificationsAsync(): get permission + Expo token (or null)
 *  - savePushTokenForUser(userPhone): register + upsert token into Supabase (best effort)
 *  - deactivatePushTokenForCurrentDevice(): best-effort sign-out cleanup
 *  - triggerEventNotification(payload): fire-and-forget call to the send-event-notification Edge Function
 */
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";

export type PushPlatform = "ios" | "android" | "web" | "unknown";

export interface PushRegistration {
  token: string;
  platform: PushPlatform;
}

/** Notification types the closed-beta backend understands. */
export type EventNotificationType =
  | "join_request_created"
  | "join_request_approved"
  | "join_request_declined"
  | "event_cancelled"
  | "rsvp_changed"
  | "bring_item_claimed";

export interface EventNotificationPayload {
  type: EventNotificationType;
  eventId: string;
  /** Required for approve/decline so the server knows which guest to notify. */
  targetPhone?: string;
}

function devLog(...args: unknown[]): void {
  if (__DEV__) console.log("[notifications]", ...args);
}

function currentPlatform(): PushPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "web") return "web";
  return "unknown";
}

/** Read the EAS projectId from app config; required by getExpoPushTokenAsync in builds. */
function getProjectId(): string | undefined {
  const fromExtra = Constants?.expoConfig?.extra?.eas?.projectId;
  const fromEasConfig = (Constants as { easConfig?: { projectId?: string } })?.easConfig?.projectId;
  const id = fromExtra ?? fromEasConfig;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

// Show alerts/banners while the app is foregrounded. Safe to set at module load
// (does not request permission and cannot crash).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Android requires a channel for notifications to display. Best effort, never throws. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch (err) {
    devLog("failed to set android channel", err);
  }
}

/**
 * Request permission (only if not already decided) and return an Expo push token.
 * Returns null on simulators/emulators, when permission is denied, when the projectId
 * is missing, or on any failure. Never throws.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistration | null> {
  try {
    if (!Device.isDevice) {
      devLog("skipping: not a physical device");
      return null;
    }

    await ensureAndroidChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Only prompt when the user has not decided yet (avoids re-prompt spam).
    if (existingStatus === "undetermined") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      devLog("permission not granted:", finalStatus);
      return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      devLog("missing EAS projectId; cannot fetch push token");
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse?.data;
    if (!token) {
      devLog("no token returned");
      return null;
    }

    return { token, platform: currentPlatform() };
  } catch (err) {
    devLog("registerForPushNotificationsAsync failed", err);
    return null;
  }
}

/**
 * Register for push and upsert the token for the given user phone. Best effort:
 * if permission is denied or the save fails, the app continues normally.
 * No-ops when there is no authenticated Supabase session (e.g. dev/skip-OTP mode),
 * because RLS would reject the write anyway.
 */
export async function savePushTokenForUser(userPhone: string): Promise<void> {
  try {
    const phone = userPhone?.trim();
    if (!phone) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      devLog("no Supabase session; skipping token save");
      return;
    }

    const registration = await registerForPushNotificationsAsync();
    if (!registration) return;

    const { error } = await supabase.from("user_push_tokens").upsert(
      {
        user_phone: phone,
        expo_push_token: registration.token,
        platform: registration.platform,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "expo_push_token" },
    );

    if (error) {
      devLog("token upsert failed", error.message);
      return;
    }
    devLog("token saved");
  } catch (err) {
    devLog("savePushTokenForUser failed", err);
  }
}

/**
 * Best-effort sign-out cleanup: deactivate this device's token so the user stops
 * receiving pushes after signing out. Must run BEFORE supabase.auth.signOut() while
 * the session (and RLS phone claim) is still valid. Never throws.
 */
export async function deactivatePushTokenForCurrentDevice(): Promise<void> {
  try {
    if (!Device.isDevice) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      devLog("no Supabase session; skipping token deactivation");
      return;
    }

    const projectId = getProjectId();
    if (!projectId) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse?.data;
    if (!token) return;

    const { error } = await supabase
      .from("user_push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("expo_push_token", token);
    if (error) devLog("token deactivation failed", error.message);
  } catch (err) {
    devLog("deactivatePushTokenForCurrentDevice failed", err);
  }
}

/**
 * Fire-and-forget trigger to the send-event-notification Edge Function.
 * Call AFTER the related database mutation has succeeded. Never throws and never
 * blocks the caller: notification delivery is best-effort and must not affect app flows.
 */
export function triggerEventNotification(payload: EventNotificationPayload): void {
  void (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        devLog("no Supabase session; skipping notification trigger");
        return;
      }
      const { error } = await supabase.functions.invoke("send-event-notification", {
        body: payload,
      });
      if (error) devLog("trigger failed", payload.type, error.message);
    } catch (err) {
      devLog("trigger threw", payload.type, err);
    }
  })();
}

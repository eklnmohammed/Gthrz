/**
 * Auth layer for Gthrz: login, current user, sign out, and profile sync with Supabase.
 *
 * ## Dev mode (skip OTP)
 * When dev mode is ON (AsyncStorage key `gthrz_dev_skip_otp` = "true" or env EXPO_PUBLIC_DEV_SKIP_OTP=true):
 * - sendOtp() is a no-op; verifyOtp() stores the phone as dev identity and returns success.
 * - getCurrentUser() reads from AsyncStorage (gthrz_dev_phone) instead of Supabase Auth.
 * - signOut() clears only the dev phone; upsertProfile() does not require a Supabase user id.
 * This lets the app run without an SMS provider (Supabase Phone OTP needs Twilio/etc.).
 *
 * ## Real OTP (production)
 * When dev mode is OFF:
 * - sendOtp() calls supabase.auth.signInWithOtp({ phone }); verifyOtp() calls verifyOtp({ phone, token, type: 'sms' }).
 * - Supabase must have an SMS provider configured or OTP will fail (e.g. "Unsupported phone provider").
 *
 * ## Public API (use these from app code)
 * - isDevMode(), setDevMode(), setDevPhone() — dev toggle and identity.
 * - sendOtp(phone), verifyOtp(phone, code) — OTP flow (no-op / stub in dev).
 * - getCurrentUser() — { id, phone } or null.
 * - signOut() — clear session or dev identity.
 * - upsertProfile({ phone, fullName?, avatarUrl? }), fetchProfile(phone) — Supabase profiles by phone.
 * - syncCurrentProfileFromServer() — refresh current user profile from Supabase into local cache (server wins).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { onboardingStore } from "../state/onboardingStore";

const DEV_SKIP_OTP_KEY = "gthrz_dev_skip_otp";
const DEV_PHONE_KEY = "gthrz_dev_phone";

/**
 * Check if dev mode (skip OTP) is enabled.
 * Returns true when the user has explicitly toggled dev mode ON,
 * or when EXPO_PUBLIC_DEV_SKIP_OTP=true is set and the user hasn't toggled it OFF.
 */
export async function isDevMode(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(DEV_SKIP_OTP_KEY);
    if (stored !== null) return stored === "true";
    // Fall back to env var (handy for fresh installs during development)
    return process.env.EXPO_PUBLIC_DEV_SKIP_OTP === "true";
  } catch {
    return false;
  }
}

export async function setDevMode(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DEV_SKIP_OTP_KEY, String(enabled));
}

/** Set the dev identity phone when skipping OTP (so getCurrentUser() works). */
export async function setDevPhone(phone: string): Promise<void> {
  await AsyncStorage.setItem(DEV_PHONE_KEY, phone);
}

/**
 * Send OTP to phone number.
 * In dev mode this is a no-op.
 */
export async function sendOtp(phone: string): Promise<{ error?: string }> {
  if (await isDevMode()) {
    return {};
  }
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { error: error.message };
  return {};
}

/**
 * Verify OTP code.
 * In dev mode: stores phone as dev identity and returns success.
 */
export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ error?: string; userId?: string }> {
  if (await isDevMode()) {
    await AsyncStorage.setItem(DEV_PHONE_KEY, phone);
    return { userId: `dev-${phone}` };
  }
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  });
  if (error) return { error: error.message };
  return { userId: data.user?.id };
}

/**
 * Get current authenticated user.
 * Returns { id, phone } from Supabase Auth, or from dev storage in dev mode.
 */
export async function getCurrentUser(): Promise<{
  id: string;
  phone: string;
} | null> {
  if (await isDevMode()) {
    const phone = await AsyncStorage.getItem(DEV_PHONE_KEY);
    if (phone) return { id: `dev-${phone}`, phone };
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { id: user.id, phone: user.phone ?? "" };
  return null;
}

/**
 * Sign out. Clears Supabase session or dev phone storage.
 */
export async function signOut(): Promise<void> {
  if (await isDevMode()) {
    await AsyncStorage.removeItem(DEV_PHONE_KEY);
    return;
  }
  await supabase.auth.signOut();
}

/**
 * Upsert profile to Supabase `profiles` table.
 * Works in both real auth and dev mode (dev mode generates a deterministic UUID from phone).
 */
export async function upsertProfile(opts: {
  phone: string;
  fullName?: string;
  avatarUrl?: string;
}): Promise<{ error?: string }> {
  const { phone, fullName, avatarUrl } = opts;
  if (__DEV__ && avatarUrl) console.log("[upsertProfile] Writing avatar_url to profiles:", avatarUrl);

  // Build the row
  const row: Record<string, unknown> = {
    phone,
    full_name: fullName ?? null,
    avatar_url: avatarUrl ?? null,
    updated_at: new Date().toISOString(),
  };

  // Try to set id from auth user (real OTP) or skip for dev mode
  if (!(await isDevMode())) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) row.id = user.id;
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "phone" });
  if (error) return { error: error.message };
  return {};
}

/**
 * Fetch profile from Supabase by phone number.
 */
export async function fetchProfile(
  phone: string
): Promise<{
  id: string;
  phone: string;
  full_name: string | null;
  avatar_url: string | null;
} | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone, full_name, avatar_url")
    .eq("phone", phone)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Sync the current user's profile from Supabase into local cache.
 * Server data (especially avatar_url) overrides stale local cache so the same account
 * shows the same profile across devices. Call after login, on app launch, and when
 * Profile/Home screens focus.
 */
export async function syncCurrentProfileFromServer(): Promise<void> {
  const user = await getCurrentUser();
  const phone = user?.phone ?? (await onboardingStore.getPhone());
  const normalizedPhone = phone?.trim() || null;
  if (!normalizedPhone) {
    if (__DEV__) console.log("[syncCurrentProfile] No phone/identity, skip sync");
    return;
  }
  if (__DEV__) console.log("[syncCurrentProfile] Fetching profile for phone:", normalizedPhone);

  const server = await fetchProfile(normalizedPhone);
  if (!server) {
    if (__DEV__) console.log("[syncCurrentProfile] No server row, keep local fallback");
    return;
  }

  const parts = (server.full_name || "").trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") ?? "";
  const avatarUri = server.avatar_url ?? undefined;
  const profile = {
    firstName,
    lastName,
    phone: normalizedPhone,
    avatarUri,
  };
  await onboardingStore.saveProfile(profile);
  await onboardingStore.saveProfileForPhone(normalizedPhone, profile);

  if (__DEV__) {
    console.log("[syncCurrentProfile] Updated local cache from server", {
      full_name: server.full_name,
      avatar_url: server.avatar_url,
      finalAvatarUri: avatarUri,
    });
  }
}

/**
 * Upload avatar image to Supabase Storage and return the public URL.
 * Uses the `avatars` public bucket. File path: avatars/{sanitizedPhone}.jpg
 * If the URI is already a remote URL (https://), returns it as-is.
 * Does NOT swallow errors: callers must show an error and keep avatar_url unchanged on failure.
 */
export async function uploadAvatar(
  localUri: string,
  phone: string
): Promise<{ url: string } | { error: string }> {
  if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
    if (__DEV__) console.log("[uploadAvatar] Already remote URL:", localUri);
    return { url: localUri };
  }

  const sanitizedPhone = phone.replace(/\D/g, "") || "unknown";
  const filePath = `${sanitizedPhone}.jpg`;
  if (__DEV__) console.log("[uploadAvatar] Storage path:", filePath);

  try {
    const FileSystem = await import("expo-file-system/legacy");
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: "base64",
    } as { encoding: "base64" });

    const { Buffer } = await import("buffer");
    const buf = Buffer.from(base64, "base64");
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, bytes, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      if (__DEV__) console.warn("[uploadAvatar] Upload error:", error.message);
      return { error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // Cache-bust avatar URL so updated image appears immediately on current screen
    // even when uploading to the same storage path (upsert true).
    const url = `${urlData.publicUrl}?v=${Date.now()}`;
    if (__DEV__) console.log("[uploadAvatar] Resolved avatarUrl saved to profiles:", url);
    return { url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    if (__DEV__) console.warn("[uploadAvatar] Exception:", message);
    return { error: message };
  }
}

/**
 * Auth layer for Gthrz: login, current user, sign out, and profile sync with Supabase.
 *
 * ## Dev mode (skip OTP)
 * When the user taps “Skip OTP — demo mode”, `setDevMode(true)` + `setDevPhone` store a local identity.
 * getCurrentUser() / signOut() / upsertProfile() then use that identity (no JWT).
 * sendOtp() and verifyOtp() ALWAYS call Supabase — demo never fakes SMS or accepts random codes.
 *
 * ## Real OTP
 * sendOtp() → supabase.auth.signInWithOtp({ phone }); verifyOtp() → verifyOtp({ phone, token, type: 'sms' }).
 * Needs an SMS provider on the Supabase project or send fails (e.g. "Unsupported phone provider").
 *
 * ## Public API (use these from app code)
 * - isDevMode(), setDevMode(), setDevPhone() — demo identity after Skip OTP only.
 * - completeDemoSkipLogin(phone) — Skip OTP only; no session.
 * - getCurrentUser() — { id, phone } or null.
 * - signOut() — clear session or dev identity.
 * - upsertProfile({ phone, fullName?, avatarUrl? }), fetchProfile(phone) — Supabase profiles by phone.
 * - syncCurrentProfileFromServer() — refresh current user profile from Supabase into local cache (server wins).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { onboardingStore } from "../state/onboardingStore";
import { areSamePhone } from "../utils/phone";

const DEV_SKIP_OTP_KEY = "gthrz_dev_skip_otp";
const DEV_PHONE_KEY = "gthrz_dev_phone";

/**
 * Check if dev mode (skip OTP) is enabled.
 * Returns true when the user has explicitly toggled dev mode ON,
 * or when EXPO_PUBLIC_DEV_SKIP_OTP=true is set and the user hasn't toggled it OFF.
 */
export async function isDevMode(): Promise<boolean> {
  // Release builds never use Skip OTP, even if a leftover AsyncStorage flag exists.
  if (!__DEV__) return false;
  try {
    const stored = await AsyncStorage.getItem(DEV_SKIP_OTP_KEY);
    if (stored !== null) return stored === "true";
    // Fall back to env var (handy for fresh installs during development)
    return process.env.EXPO_PUBLIC_DEV_SKIP_OTP === "true";
  } catch {
    return false;
  }
}

/** Short user-facing copy for common Supabase Phone OTP errors. */
export function friendlyAuthError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (
    m.includes("unsupported phone provider") ||
    m.includes("phone provider") ||
    (m.includes("sms") && m.includes("provider"))
  ) {
    return "SMS login is not configured yet.";
  }
  if (m.includes("rate") || m.includes("too many") || m.includes("429")) {
    return "Too many attempts. Please wait and try again.";
  }
  if (m.includes("invalid") && m.includes("phone")) {
    return "Please enter a valid phone number.";
  }
  const trimmed = message?.trim();
  return trimmed || "Something went wrong. Please try again.";
}

export async function setDevMode(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DEV_SKIP_OTP_KEY, String(enabled));
}

/** Set the dev identity phone when skipping OTP (so getCurrentUser() works). */
export async function setDevPhone(phone: string): Promise<void> {
  await AsyncStorage.setItem(DEV_PHONE_KEY, phone);
}

/**
 * Explicit Skip OTP login. No SMS, no JWT, no push registration.
 * Returns where the UI should go after local identity is stored.
 */
export async function completeDemoSkipLogin(phone: string): Promise<"home" | "profile"> {
  const trimmed = phone.trim();
  await setDevMode(true);
  await setDevPhone(trimmed);
  await onboardingStore.savePhone(trimmed);
  await syncCurrentProfileFromServer();

  const p = await onboardingStore.getProfile();
  if (areSamePhone(p?.phone, trimmed) && (p?.firstName || p?.avatarUri)) {
    await onboardingStore.setOnboarded(true);
    return "home";
  }
  const localProfile = await onboardingStore.getProfileForPhone(trimmed);
  if (localProfile) {
    await onboardingStore.saveProfile({ ...localProfile, phone: trimmed });
    await onboardingStore.setOnboarded(true);
    return "home";
  }
  return "profile";
}

/**
 * Send a real SMS OTP via Supabase. Never short-circuits for demo mode.
 * Demo login is only `handleDemoSkip` on the verify screen.
 */
export async function sendOtp(phone: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { error: error.message };
  return {};
}

/**
 * Verify a real SMS OTP via Supabase. Never accepts a random code because demo mode is on.
 */
export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ error?: string; userId?: string }> {
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
  if (!normalizedPhone) return;

  const server = await fetchProfile(normalizedPhone);
  if (!server) return;

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
    return { url: localUri };
  }

  const sanitizedPhone = phone.replace(/\D/g, "") || "unknown";
  const filePath = `${sanitizedPhone}.jpg`;

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
    return { url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    if (__DEV__) console.warn("[uploadAvatar] Exception:", message);
    return { error: message };
  }
}

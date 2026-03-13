import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";

const BUCKET = "event-covers";

/**
 * Upload a local image (file:// URI) to Supabase Storage event-covers bucket
 * and return the public URL. Uses FileSystem (base64) + ArrayBuffer only—no Blob.
 * Blob creation is unreliable in React Native/Expo and can throw "Creating blobs" errors.
 */
export async function uploadEventCover(localUri: string, eventId?: string): Promise<string | null> {
  if (!localUri || typeof localUri !== "string") {
    console.error("[uploadEventCover] Invalid localUri:", localUri);
    return null;
  }

  const ext = localUri.toLowerCase().includes(".png") ? "png" : "jpg";
  const path = eventId
    ? `${eventId}-${Date.now()}.${ext}`
    : `cover-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  try {
    // 1. Read file as base64 (Expo/RN-safe)
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64 || base64.length === 0) {
      console.error("[uploadEventCover] File read empty. uri:", localUri?.slice?.(0, 80));
      return null;
    }

    // 2. Decode to ArrayBuffer (no Blob—Blob is unreliable in RN and throws "Creating blobs")
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const arrayBuffer = bytes.buffer;

    // 3. Upload to Supabase Storage (accepts ArrayBuffer)
    const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error("[uploadEventCover] Storage upload error:", {
        message: error.message,
        name: (error as { name?: string }).name,
        path,
        bucket: BUCKET,
      });
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      console.error("[uploadEventCover] getPublicUrl returned no URL for path:", path);
      return null;
    }
    return data.publicUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Error";
    console.error("[uploadEventCover] Exception:", { name, message, localUri: localUri?.slice?.(0, 80) });
    if (err instanceof Error && err.stack) console.error("[uploadEventCover] stack:", err.stack);
    return null;
  }
}

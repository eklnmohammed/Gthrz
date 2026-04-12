import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSegments } from "expo-router";
import { onboardingStore } from "./onboardingStore";

/** Unscoped legacy key and prefix for per-user keys: `gthrz_favorites:${digits}`. */
const FAVORITES_STORAGE_ROOT = "gthrz_favorites";

interface FavoritesContextType {
  favoriteIds: Set<string>;
  isFavorited: (eventId: string) => boolean;
  toggleFavorite: (eventId: string) => void;
  isLoading: boolean;
  /** Re-read phone from storage and reload favorites (sign-out, new login, switch user). */
  reloadFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

function favoritesStorageKey(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `${FAVORITES_STORAGE_ROOT}:${digits}`;
}

async function loadFavorites(phone: string | null): Promise<Set<string>> {
  const key = favoritesStorageKey(phone);
  if (!key) {
    return new Set();
  }
  try {
    const raw = await AsyncStorage.getItem(key);
    // Drop legacy global key on any load with a known identity so it cannot attach to the wrong user.
    await AsyncStorage.removeItem(FAVORITES_STORAGE_ROOT).catch(() => {});
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function saveFavorites(phone: string | null, ids: Set<string>): Promise<void> {
  const key = favoritesStorageKey(phone);
  if (!key) return;
  await AsyncStorage.setItem(key, JSON.stringify([...ids])).catch(() => {});
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const segmentsKey = segments.join("/");

  const reloadFavorites = useCallback(async () => {
    const p = await onboardingStore.getPhone();
    setPhone(p);
    const ids = await loadFavorites(p);
    setFavoriteIds(ids);
    setIsLoading(false);
  }, []);

  // Initial load + whenever routes change (onboarding complete, sign-out, etc.)
  useEffect(() => {
    void reloadFavorites();
  }, [segmentsKey, reloadFavorites]);

  const toggleFavorite = useCallback(
    (eventId: string) => {
      setFavoriteIds((prev) => {
        if (!favoritesStorageKey(phone)) return prev;
        const next = new Set(prev);
        if (next.has(eventId)) next.delete(eventId);
        else next.add(eventId);
        void saveFavorites(phone, next);
        return next;
      });
    },
    [phone]
  );

  const isFavorited = useCallback(
    (eventId: string) => favoriteIds.has(eventId),
    [favoriteIds]
  );

  return (
    <FavoritesContext.Provider
      value={{ favoriteIds, isFavorited, toggleFavorite, isLoading, reloadFavorites }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextType {
  const ctx = useContext(FavoritesContext);
  if (ctx === undefined) {
    return {
      favoriteIds: new Set(),
      isFavorited: () => false,
      toggleFavorite: () => {},
      isLoading: false,
      reloadFavorites: async () => {},
    };
  }
  return ctx;
}

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onboardingStore } from "./onboardingStore";

const FAVORITES_KEY = "gthrz_favorites";

interface FavoritesContextType {
  favoriteIds: Set<string>;
  isFavorited: (eventId: string) => boolean;
  toggleFavorite: (eventId: string) => void;
  isLoading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

async function loadFavorites(phone: string | null): Promise<Set<string>> {
  const key = phone ? `${FAVORITES_KEY}:${phone.replace(/\D/g, "")}` : FAVORITES_KEY;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function saveFavorites(phone: string | null, ids: Set<string>): Promise<void> {
  const key = phone ? `${FAVORITES_KEY}:${phone.replace(/\D/g, "")}` : FAVORITES_KEY;
  await AsyncStorage.setItem(key, JSON.stringify([...ids])).catch(() => {});
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const p = await onboardingStore.getPhone();
      if (!mounted) return;
      setPhone(p);
      const ids = await loadFavorites(p);
      if (mounted) setFavoriteIds(ids);
      if (mounted) setIsLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const toggleFavorite = useCallback(
    (eventId: string) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(eventId)) next.delete(eventId);
        else next.add(eventId);
        saveFavorites(phone, next);
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
    <FavoritesContext.Provider value={{ favoriteIds, isFavorited, toggleFavorite, isLoading }}>
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
    };
  }
  return ctx;
}

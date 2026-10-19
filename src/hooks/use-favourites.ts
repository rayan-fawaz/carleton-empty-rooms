"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Starred room ids, kept in this browser only. Storage can be unavailable (private mode, blocked
// site data), so every access is guarded and an in-memory copy keeps the UI working regardless.
const KEY = "empty-rooms:favourites";
const listeners = new Set<() => void>();
let memory = "[]";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useFavourites() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const favourites = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }, [raw]);

  const toggle = useCallback(
    (id: string) => {
      const next = favourites.includes(id) ? favourites.filter((x) => x !== id) : [...favourites, id];
      memory = JSON.stringify(next);
      try {
        localStorage.setItem(KEY, memory);
      } catch {
        // Not persisted; the in-memory copy still updates the UI for this visit.
      }
      listeners.forEach((l) => l());
    },
    [favourites],
  );

  return { favourites, toggle };
}

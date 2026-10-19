"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ottawaNow } from "@/lib/time";
import type { Minute } from "@/lib/types";

const TICK_MS = 30_000;
const REFRESH_MS = 10 * 60_000;

/**
 * The current Ottawa minute, ticking every 30 seconds. It starts from the server's value so the
 * first render matches the HTML. Bookings are re-fetched every 10 minutes while the tab is visible,
 * and straight away once the date rolls over, so a tab left open overnight never shows yesterday.
 */
export function useNowMinute(serverMinute: Minute, today: string): Minute {
  const router = useRouter();
  const [minute, setMinute] = useState(serverMinute);

  useEffect(() => {
    let lastRefresh = Date.now();
    const tick = () => {
      const now = ottawaNow();
      setMinute(now.minute);
      const stale = Date.now() - lastRefresh > REFRESH_MS && document.visibilityState === "visible";
      if (now.date !== today || stale) {
        lastRefresh = Date.now();
        router.refresh();
      }
    };
    const id = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, today]);

  return minute;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ottawaNow } from "@/lib/time";
import type { Minute } from "@/lib/types";

/**
 * The current Ottawa minute, ticking every 30s. Starts from the server's value so the first
 * render matches the HTML. While live, booking data is also refreshed every 10 minutes.
 */
export function useNowMinute(initial: Minute, live: boolean): Minute {
  const [minute, setMinute] = useState(initial);
  const router = useRouter();

  useEffect(() => {
    const tick = () => setMinute(ottawaNow().minute);
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!live) return;
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 10 * 60_000) return;
      last = Date.now();
      router.refresh();
    };
    const id = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [live, router]);

  return minute;
}

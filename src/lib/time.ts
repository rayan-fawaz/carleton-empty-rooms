import type { Minute } from "./types";

export const TIME_ZONE = "America/Toronto";

const clock = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Current Ottawa date ("YYYY-MM-DD") and minute of day. */
export function ottawaNow(now = new Date()): { date: string; minute: Minute } {
  const p = Object.fromEntries(clock.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) };
}

/** The booking site identifies a day by the unix time of its UTC midnight. */
export function dateStamp(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 1000;
}

export function isValidDate(date: string | undefined): date is string {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(dateStamp(date));
}

export function addDays(date: string, days: number): string {
  return new Date((dateStamp(date) + days * 86400) * 1000).toISOString().slice(0, 10);
}

/** "HH:MM" → minutes, or null if malformed. */
export function parseTime(time: string | undefined): Minute | null {
  const m = time?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const minute = Number(m[1]) * 60 + Number(m[2]);
  return minute < 24 * 60 ? minute : null;
}

export function toTimeInput(minute: Minute): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function formatTime(minute: Minute): string {
  if (minute >= 24 * 60) return "midnight";
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function formatHour(hour: number): string {
  return `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(date: string): string {
  return new Date(dateStamp(date) * 1000).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// What the user is looking at. It lives in the URL, so every view is a shareable link.
import { DAY_END } from "./availability";
import { FEATURES, type FeatureKey } from "./rooms";
import { addDays, dayLabel, formatTime, isValidDate, parseTime, toTimeInput } from "./time";
import type { Minute } from "./types";

/** "now" follows the clock, "in" is relative to now, "at" is a fixed time of day. */
export type When = { kind: "now" } | { kind: "in"; minutes: number } | { kind: "at"; minute: Minute };

export type ViewState = {
  date: string;
  when: When;
  /** Selected building code, ALL_BUILDINGS, or null for the building directory. */
  building: string | null;
  /** Minimum minutes a room must stay free. */
  need: number;
  features: FeatureKey[];
  /** Include lounges, lobbies and other non-classroom spaces. */
  all: boolean;
  view: "list" | "schedule";
  /** Id of the room whose details are open. */
  room: string | null;
};

export const ALL_BUILDINGS = "ALL";
export const NEEDS = [0, 60, 120, 180] as const;
export const OFFSETS = [60, 120] as const;
/** Days you can look ahead, including today. */
export const DAYS_AHEAD = 7;
/** Time shown for a future day until the user picks one. */
export const DEFAULT_FUTURE_MINUTE: Minute = 9 * 60;

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isFeature = (f: string): f is FeatureKey => Object.hasOwn(FEATURES, f);

export function bookableDays(today: string): string[] {
  return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
}

export function readViewState(params: Params, today: string): ViewState {
  const requested = first(params.date);
  const date = isValidDate(requested) && bookableDays(today).includes(requested) ? requested : today;
  const at = parseTime(first(params.time));
  const offset = Number(first(params.in));
  const need = Number(first(params.need));

  let when: When = { kind: "now" };
  if (at !== null) when = { kind: "at", minute: at };
  else if (date !== today) when = { kind: "at", minute: DEFAULT_FUTURE_MINUTE };
  else if ((OFFSETS as readonly number[]).includes(offset)) when = { kind: "in", minutes: offset };

  return {
    date,
    when,
    building: first(params.b)?.toUpperCase() || null,
    need: (NEEDS as readonly number[]).includes(need) ? need : 0,
    features: [...new Set((first(params.f) ?? "").split(",").filter(isFeature))],
    all: first(params.all) === "1",
    view: first(params.view) === "schedule" ? "schedule" : "list",
    room: first(params.room) || null,
  };
}

/** The query string for a state, leaving out defaults so links stay short. */
export function queryFor(s: ViewState, today: string): string {
  const q = new URLSearchParams();
  if (s.date !== today) q.set("date", s.date);
  if (s.when.kind === "in") q.set("in", String(s.when.minutes));
  if (s.when.kind === "at" && (s.date === today || s.when.minute !== DEFAULT_FUTURE_MINUTE)) {
    q.set("time", toTimeInput(s.when.minute));
  }
  if (s.building) q.set("b", s.building);
  if (s.need) q.set("need", String(s.need));
  if (s.features.length) q.set("f", s.features.join(","));
  if (s.all) q.set("all", "1");
  if (s.view !== "list") q.set("view", s.view);
  if (s.room) q.set("room", s.room);
  const qs = q.toString().replace(/%2C/g, ",").replace(/%3A/g, ":");
  return qs ? `?${qs}` : "";
}

export function sameWhen(a: When, b: When): boolean {
  switch (a.kind) {
    case "now":
      return b.kind === "now";
    case "in":
      return b.kind === "in" && b.minutes === a.minutes;
    case "at":
      return b.kind === "at" && b.minute === a.minute;
  }
}

export function resolveMinute(when: When, nowMinute: Minute): Minute {
  if (when.kind === "at") return when.minute;
  if (when.kind === "in") return Math.min(nowMinute + when.minutes, DAY_END - 1);
  return nowMinute;
}

/** The moment being looked at, as it reads after "free": "right now", "in 2 hours", "tomorrow at 9:00 AM". */
export function describeWhen(s: ViewState, minute: Minute, today: string): string {
  if (s.date === today && s.when.kind === "now") return "right now";
  if (s.when.kind === "in") return s.when.minutes === 60 ? "in 1 hour" : `in ${s.when.minutes / 60} hours`;
  if (s.date === today) return `at ${formatTime(minute)}`;
  const day = dayLabel(s.date, today);
  return `${day === "Tomorrow" ? "tomorrow" : `on ${day}`} at ${formatTime(minute)}`;
}

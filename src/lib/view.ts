// Finder state and the pure logic behind it. State lives in the URL so any view is shareable.
import { DAY_END, statusAt } from "./availability";
import { roomKey } from "./parse-tls";
import { isValidDate, parseTime, toTimeInput } from "./time";
import type { Booking, Minute, Room, RoomInfo, RoomStatus } from "./types";

export type FinderRoom = Room & { buildingName: string; bookings: Booking[]; info: RoomInfo | null };

/** "now" follows the clock; "in" is relative to now; "at" is a fixed time of day. */
export type When = { kind: "now" } | { kind: "in"; minutes: number } | { kind: "at"; minute: Minute };

export type ViewState = {
  date: string;
  when: When;
  building: string | null;
  /** Minimum free minutes the room must have. */
  need: number;
  features: FeatureKey[];
  /** Include lobbies, lounges and other non-classroom spaces. */
  all: boolean;
  view: "list" | "schedule";
  /** Room detail open, by room id. */
  room: string | null;
};

export const NEEDS = [0, 60, 120, 180] as const;

export const FEATURES = {
  outlets: {
    label: "Outlets at desks",
    test: (i: RoomInfo) => [...i.accessibility, ...i.equipment].some((x) => /power outlets/i.test(x)),
  },
  whiteboard: { label: "Whiteboard", test: (i: RoomInfo) => i.equipment.some((x) => /whiteboard/i.test(x)) },
  movable: {
    label: "Movable seats",
    test: (i: RoomInfo) =>
      i.equipment.some((x) => /moveable furniture|node chairs/i.test(x)) ||
      i.accessibility.some((x) => /flexible seating/i.test(x)),
  },
  big: { label: "30+ seats", test: (i: RoomInfo) => (i.capacity ?? 0) >= 30 },
} satisfies Record<string, { label: string; test: (i: RoomInfo) => boolean }>;

export type FeatureKey = keyof typeof FEATURES;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function readViewState(params: Params, today: string): ViewState {
  const rawDate = one(params.date);
  const date = isValidDate(rawDate) ? rawDate : today;
  const at = parseTime(one(params.time));
  const inMinutes = Number(one(params.in));

  let when: When = { kind: "now" };
  if (at !== null) when = { kind: "at", minute: at };
  else if (date !== today) when = { kind: "at", minute: 9 * 60 };
  else if ([60, 120, 180].includes(inMinutes)) when = { kind: "in", minutes: inMinutes };

  const need = Number(one(params.need));
  return {
    date,
    when,
    building: one(params.b)?.toUpperCase() || null,
    need: (NEEDS as readonly number[]).includes(need) ? need : 0,
    features: (one(params.f) ?? "").split(",").filter((f): f is FeatureKey => f in FEATURES),
    all: one(params.all) === "1",
    view: one(params.view) === "schedule" ? "schedule" : "list",
    room: one(params.room) || null,
  };
}

/** Query string for a state, leaving out defaults so links stay short. */
export function queryFor(s: ViewState, today: string): string {
  const q = new URLSearchParams();
  if (s.date !== today) q.set("date", s.date);
  if (s.when.kind === "in") q.set("in", String(s.when.minutes));
  if (s.when.kind === "at" && !(s.date !== today && s.when.minute === 9 * 60)) q.set("time", toTimeInput(s.when.minute));
  if (s.building) q.set("b", s.building);
  if (s.need) q.set("need", String(s.need));
  if (s.features.length) q.set("f", s.features.join(","));
  if (s.all) q.set("all", "1");
  if (s.view !== "list") q.set("view", s.view);
  if (s.room) q.set("room", s.room);
  const qs = q.toString().replace(/%2C/g, ",").replace(/%3A/g, ":");
  return qs ? `?${qs}` : "";
}

export function resolveMinute(when: When, nowMinute: Minute): Minute {
  if (when.kind === "at") return when.minute;
  if (when.kind === "in") return Math.min(nowMinute + when.minutes, DAY_END - 1);
  return nowMinute;
}

export const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/** Real classrooms look like "TB 238" or "LA A204"; lobbies and lounges don't. */
export const isClassroom = (name: string) => /^[A-Z]{2} [A-Z]?\d+[A-Z]?\d*$/.test(name);

/** Rooms that pass the classroom and feature filters (building and search are applied separately). */
export function baseFilter(rooms: FinderRoom[], s: Pick<ViewState, "all" | "features">): FinderRoom[] {
  return rooms.filter((r) => {
    if (!s.all && !isClassroom(r.name)) return false;
    if (s.features.length) return !!r.info && s.features.every((f) => FEATURES[f].test(r.info!));
    return true;
  });
}

const squash = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** "sa 5", "SA513", "southam", "tory 4" all match the way people type them. */
export function matchesSearch(r: FinderRoom, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [squash(r.name), squash(r.buildingName), squash(r.info?.title ?? "")];
  const q = squash(query);
  if (haystack.some((h) => h.includes(q))) return true;
  // "tory 4" → building word + room-number prefix
  const number = r.name.split(" ").slice(1).join("").toLowerCase();
  const nameWords = words.filter((w) => !/\d/.test(w));
  const numberWords = words.filter((w) => /\d/.test(w));
  return (
    nameWords.every((w) => haystack.some((h) => h.includes(squash(w)))) &&
    numberWords.every((w) => number.startsWith(w.toLowerCase()))
  );
}

export type Placed = { room: FinderRoom; status: RoomStatus; usable: boolean };

/** Status at `minute`; usable = free for at least `need` minutes. */
export function place(rooms: FinderRoom[], minute: Minute, need: number): Placed[] {
  return rooms.map((room) => {
    const status = statusAt(room.bookings, minute);
    return { room, status, usable: status.free && status.minutesLeft >= Math.max(need, 1) };
  });
}

const byName = (a: Placed, b: Placed) => a.room.name.localeCompare(b.room.name, "en", { numeric: true });

/** Usable rooms first (longest free first), then the rest by when they free up. */
export function sortPlaced(list: Placed[]): Placed[] {
  return [...list].sort((a, b) => {
    if (a.usable !== b.usable) return a.usable ? -1 : 1;
    if (a.status.free && b.status.free) return b.status.minutesLeft - a.status.minutesLeft || byName(a, b);
    if (a.status.free !== b.status.free) return a.status.free ? -1 : 1;
    return a.status.until - b.status.until || byName(a, b);
  });
}

export type BuildingSummary = { code: string; name: string; free: number; total: number };

/** One row per building with how many rooms are usable, most free first. */
export function summarizeBuildings(placed: Placed[]): BuildingSummary[] {
  const map = new Map<string, BuildingSummary>();
  for (const p of placed) {
    const b = map.get(p.room.building) ?? { code: p.room.building, name: p.room.buildingName, free: 0, total: 0 };
    b.total++;
    if (p.usable) b.free++;
    map.set(p.room.building, b);
  }
  return [...map.values()].sort((a, b) => b.free - a.free || a.name.localeCompare(b.name));
}

export const infoFor = (info: Record<string, RoomInfo>, name: string) => info[roomKey(name)] ?? null;

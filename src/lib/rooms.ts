// Filtering, searching and ranking rooms for a moment in the day.
import { statusAt } from "./availability";
import type { DayRoom, Minute, RoomInfo, RoomStatus } from "./types";

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

/** Real classrooms look like "TB 238" or "LA A204"; lobbies and lounges don't. */
export const isClassroom = (name: string) => /^[A-Z]{2} [A-Z]?\d+[A-Z]?\d*$/.test(name);

/** "Nideyinàn (formerly University Centre)" → "Nideyinàn · University Centre". */
export const shortBuildingName = (name: string) => name.replace(/\s*\(formerly (.*)\)/, " · $1");

export function filterRooms(rooms: DayRoom[], { all, features }: { all: boolean; features: FeatureKey[] }): DayRoom[] {
  return rooms.filter((r) => {
    if (!all && !isClassroom(r.name)) return false;
    return features.every((f) => r.info !== null && FEATURES[f].test(r.info));
  });
}

const squash = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Matches the way people type rooms: "sa 5", "SA513", "southam", "tory 4". */
export function matchesSearch(room: DayRoom, query: string): boolean {
  const q = squash(query);
  if (!q) return true;
  const fields = [squash(room.name), squash(room.buildingName)];
  if (fields.some((f) => f.includes(q))) return true;

  // "tory 4": every word must match the building, and every number must start the room number.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const number = squash(room.name.slice(room.building.length));
  return words.every((w) => (/\d/.test(w) ? number.startsWith(squash(w)) : fields.some((f) => f.includes(squash(w)))));
}

export type Placed = { room: DayRoom; status: RoomStatus; usable: boolean };

/** Each room's status at `minute`; usable means free for at least `need` minutes. */
export function place(rooms: DayRoom[], minute: Minute, need: number): Placed[] {
  return rooms.map((room) => {
    const status = statusAt(room.bookings, minute);
    return { room, status, usable: status.free && status.minutesLeft >= Math.max(need, 1) };
  });
}

/** Natural room order: "TB 238" before "TB 1004". */
export const byName = (a: Placed, b: Placed) => a.room.name.localeCompare(b.room.name, "en", { numeric: true });

/** Usable rooms first (longest free first), then short gaps, then booked rooms by when they free up. */
export function sortPlaced(list: Placed[]): Placed[] {
  return [...list].sort((a, b) => {
    if (a.usable !== b.usable) return a.usable ? -1 : 1;
    if (a.status.free !== b.status.free) return a.status.free ? -1 : 1;
    if (a.status.free && b.status.free) return b.status.minutesLeft - a.status.minutesLeft || byName(a, b);
    return a.status.until - b.status.until || byName(a, b);
  });
}

export type BuildingSummary = { code: string; name: string; free: number; total: number };

/** One entry per building with its count of usable rooms, most free first. */
export function summarizeBuildings(placed: Placed[]): BuildingSummary[] {
  const map = new Map<string, BuildingSummary>();
  for (const { room, usable } of placed) {
    const b = map.get(room.building) ?? { code: room.building, name: room.buildingName, free: 0, total: 0 };
    b.total++;
    if (usable) b.free++;
    map.set(room.building, b);
  }
  return [...map.values()].sort((a, b) => b.free - a.free || a.name.localeCompare(b.name));
}

export const toggle = <T>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/** The booking system hides most titles behind "Occupied". */
export const bookingLabel = (title: string) => (title === "Occupied" ? "Class or booking" : title);

export const countRooms = (n: number) => `${n} ${n === 1 ? "room" : "rooms"}`;

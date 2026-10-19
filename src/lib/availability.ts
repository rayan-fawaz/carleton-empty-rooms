import type { Booking, Minute, RoomStatus } from "./types";

export const DAY_END: Minute = 24 * 60;

/** The part of the day shown in schedules: 7 AM to 11 PM. */
export const SCHEDULE_START: Minute = 7 * 60;
export const SCHEDULE_END: Minute = 23 * 60;

/** Whether a room is free at minute `t`, and until when that lasts. */
export function statusAt(bookings: Booking[], t: Minute): RoomStatus {
  const sorted = [...bookings].sort((a, b) => a.start - b.start);
  const current = sorted.find((b) => b.start <= t && t < b.end);

  if (!current) {
    const next = sorted.find((b) => b.start > t);
    const until = next?.start ?? DAY_END;
    return { free: true, until, minutesLeft: until - t, restOfDay: !next };
  }

  // Walk forward through bookings that touch or overlap the busy stretch.
  let until = current.end;
  for (const b of sorted) {
    if (b.start <= until && b.end > until) until = b.end;
  }
  return { free: false, until };
}

export type Segment = { start: Minute; end: Minute } & ({ free: true } | { free: false; title: string });

/** The day between `from` and `to` as alternating free / booked stretches, for schedules. */
export function daySegments(bookings: Booking[], from: Minute, to: Minute): Segment[] {
  const out: Segment[] = [];
  let cursor = from;
  for (const b of [...bookings].sort((x, y) => x.start - y.start)) {
    if (b.start >= to) break;
    const start = Math.max(b.start, from);
    const end = Math.min(b.end, to);
    if (end <= cursor) continue;
    if (start > cursor) out.push({ start: cursor, end: start, free: true });
    const last = out.at(-1);
    if (last && !last.free && start < last.end) last.end = Math.max(last.end, end);
    else out.push({ start: Math.max(start, cursor), end, free: false, title: b.title });
    cursor = Math.max(cursor, end);
  }
  if (cursor < to) out.push({ start: cursor, end: to, free: true });
  return out;
}

// Parsers for Carleton Central's public class schedule (Banner's bwysched pages, student view).
// Used only while the booking site is down: it lists each class section's room and times, but not
// exams, events or other one-off bookings.
import { decodeEntities } from "./html";
import type { Booking, Minute, Room } from "./types";

/** One weekly class meeting, e.g. COMP 1005 A in Minto Centre 2000, Mon/Wed 8:35–9:55, Sep 9 – Dec 11. */
export type ClassMeeting = {
  course: string;
  /** Building name as Banner spells it, e.g. "Minto Centre". */
  building: string;
  room: string;
  /** Days of the week, 0 = Sunday. */
  days: number[];
  start: Minute;
  end: Minute;
  /** First and last day of the meeting pattern, "YYYY-MM-DD". */
  from: string;
  to: string;
};

/** Banner term code for a date: 10 = Winter, 20 = Summer, 30 = Fall. */
export function termFor(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return `${year}${month <= 4 ? 10 : month <= 8 ? 20 : 30}`;
}

export const parseSessionId = (html: string) => html.match(/name="session_id" value="(\d*)"/)?.[1] ?? "";

/** Subject codes from the search page's subject picker. */
export function parseSubjects(html: string): string[] {
  const select = html.match(/<select[^>]*name="sel_subj"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  if (!select) throw new Error("Class schedule subject list not found; the page format may have changed");
  return [...select.matchAll(/<option value="([A-Z]+)"/g)].map((m) => m[1]);
}

/** Banner refuses searches that match more than 300 sections. */
export const isTooBroad = (html: string) => html.includes("exceeds 300 courses");

const DAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A section row links its course code, then lists the section letter in the next cell.
const SECTION = /<font color="blue">([A-Z]{3,4} \d{4}[A-Z]?)<\/font><\/a>\s*<\/td>\s*<td[^>]*>([A-Z0-9]+)<\/td>/;
// Meeting rows follow their section; online and unscheduled ones leave days, time and room blank.
const MEETING =
  /<b>Meeting Date:<\/b>\s*(\w{3} \d\d, \d{4}) to (\w{3} \d\d, \d{4})\s*<b>Days:<\/b>\s*([A-Za-z ]+?)\s*<b>Time:<\/b>\s*(\d\d):(\d\d) - (\d\d):(\d\d)\s*<b>Building:<\/b>\s*([^<]+?)\s*<b>Room:<\/b>\s*([^<]+?)\s*</;
const TOKEN = new RegExp(`${SECTION.source}|${MEETING.source}`, "g");

/** "Sep 09, 2026" → "2026-09-09". */
function isoDate(s: string): string {
  const [month, day, year] = s.replace(",", "").split(" ");
  return `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}-${day}`;
}

/** Every in-person class meeting on a search results page. */
export function parseClasses(html: string): ClassMeeting[] {
  const out: ClassMeeting[] = [];
  let course = "";
  for (const m of html.matchAll(TOKEN)) {
    if (m[1]) {
      course = `${m[1]} ${m[2]}`;
      continue;
    }
    const [, , , from, to, days, sh, sm, eh, em, building, room] = m;
    out.push({
      course,
      building: decodeEntities(building).replace(/\s+/g, " "),
      room: decodeEntities(room),
      days: days.split(" ").flatMap((d) => DAYS[d] ?? []),
      start: Number(sh) * 60 + Number(sm),
      end: Number(eh) * 60 + Number(em),
      from: isoDate(from),
      to: isoDate(to),
    });
  }
  return out;
}

// Banner and the booking site mostly agree on building names; these are the ones that don't.
const BUILDING_ALIASES: Record<string, string> = { "Health Science Building": "HS" };
const baseName = (name: string) => name.replace(/\s*\(.*$/, "").trim();

/** Banner building name → booking-site building code, e.g. "Nideyinàn (former UC)" → "NN". */
function buildingCodes(buildings: Record<string, string>): (name: string) => string | undefined {
  const byName = new Map(Object.entries(buildings).map(([code, name]) => [baseName(name), code]));
  return (name) => BUILDING_ALIASES[name] ?? byName.get(baseName(name));
}

/**
 * A day's classes as bookings, keyed by room id, plus every room that has any class this term. Rooms
 * outside that set (lounges, meeting rooms) are booked some other way, so classes alone can't say
 * whether they are free.
 */
export function bookingsFromClasses(
  meetings: ClassMeeting[],
  date: string,
  rooms: Room[],
  buildings: Record<string, string>,
): { bookings: Record<string, Booking[]>; taught: Set<string> } {
  const codeOf = buildingCodes(buildings);
  const ids = new Map(rooms.map((r) => [r.name, r.id]));
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const bookings: Record<string, Booking[]> = {};
  const taught = new Set<string>();

  for (const m of meetings) {
    const id = ids.get(`${codeOf(m.building)} ${m.room}`);
    if (!id) continue;
    taught.add(id);
    if (date < m.from || date > m.to || !m.days.includes(weekday)) continue;
    const day = (bookings[id] ??= []);
    // Cross-listed sections share one slot; show it once with every course code.
    const same = day.find((b) => b.start === m.start && b.end === m.end);
    if (same) same.title += ` / ${m.course}`;
    else day.push({ start: m.start, end: m.end, title: m.course });
  }
  for (const list of Object.values(bookings)) list.sort((a, b) => a.start - b.start);
  return { bookings, taught };
}

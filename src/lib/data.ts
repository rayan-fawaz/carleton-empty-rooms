// Cached fetchers for booking.carleton.ca, the TLS room API and Carleton Central's class schedule.
// Cache lifetimes keep the load on Carleton's servers to a handful of requests per hour. "remote" shares
// entries across serverless instances when deployed; locally it falls back to an in-memory cache.
// Every successful answer is also kept as a backup, so when Carleton is down the finder shows the last
// bookings it saw instead of an error. If it never saw that day, the finder falls back to class times
// from the public timetable.
import { getCache } from "@vercel/functions";
import { cacheLife } from "next/cache";
import { type Fetched, MaintenanceError, type Outage, withBackup } from "./backup";
import { parseBookings, parseBuildings, parseRoomList } from "./parse-booking";
import {
  bookingsFromClasses,
  type ClassMeeting,
  isTooBroad,
  parseClasses,
  parseSessionId,
  parseSubjects,
  termFor,
} from "./parse-central";
import { parseSpaces, pickImages, roomKey, type TlsMedia, type TlsSpace } from "./parse-tls";
import { dateStamp } from "./time";
import snapshot from "./room-snapshot.json";
import type { Booking, DayRoom, Room, RoomInfo } from "./types";

const BOOKING = "https://booking.carleton.ca/Portal/Services";
const TLS = "https://carleton.ca/tls/wp-json/wp/v2";
const CENTRAL = "https://central.carleton.ca/prod";
const USER_AGENT = "Mozilla/5.0 (compatible; EmptyRooms/1.0)";
/** WordPress caps per_page at 100. */
const PAGE_SIZE = 100;
const DAY = 86_400;
/** While Carleton is down, ask it again at most every couple of minutes. */
const OUTAGE_LIFE = { stale: 30, revalidate: 120, expire: 600 };
/** Class schedule searches run in this many sessions at once, each working through subjects in turn. */
const CENTRAL_SESSIONS = 3;

const backup = getCache({ namespace: "backup" });

async function request(url: string, init: RequestInit & { timeout: number }): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...init.headers },
    signal: AbortSignal.timeout(init.timeout),
  });
  // While Carleton's sites are down, their load balancer redirects every request to /maintenance.
  if (res.redirected && new URL(res.url).pathname.startsWith("/maintenance")) throw new MaintenanceError(url);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res;
}

async function booking(path: string, body?: string): Promise<string> {
  const res = await request(`${BOOKING}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    body,
    headers: body === undefined ? {} : { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15_000,
  });
  return res.text();
}

async function tls<T>(path: string): Promise<{ data: T; totalPages: number }> {
  const res = await request(`${TLS}/${path}`, { timeout: 8_000 });
  return { data: (await res.json()) as T, totalPages: Number(res.headers.get("X-WP-TotalPages")) || 1 };
}

type RoomList = { rooms: Room[]; buildings: Record<string, string> };
type Backed<T> = Fetched<T> | { data: null; outage: Outage };

/**
 * Every bookable room plus building names. Rooms rarely change, so if the booking site has never been
 * reachable since the backup started, the list saved with the code (same room ids) stands in.
 */
export async function getRooms(): Promise<Fetched<RoomList>> {
  "use cache: remote";
  const result = await withBackup(backup, "rooms", 30 * DAY, async () => {
    const [view, combo] = await Promise.all([booking("RoomTimelineView.php", ""), booking("LocationCombo.php")]);
    return { rooms: parseRoomList(view), buildings: parseBuildings(combo) };
  });
  if (result.outage) cacheLife(OUTAGE_LIFE);
  else cacheLife("days");
  return result.data ? result : { data: snapshot, fetchedAt: Date.parse(snapshot.takenAt), outage: result.outage };
}

/** All bookings for one day ("YYYY-MM-DD"), keyed by room id. */
export async function getBookings(date: string): Promise<Backed<Record<string, Booking[]>>> {
  "use cache: remote";
  const result = await withBackup(backup, `bookings:${date}`, 3 * DAY, async () => {
    const { data } = await getRooms();
    const body = `rooms=${data.rooms.map((r) => r.id).join(",")}&date=${dateStamp(date)}`;
    return parseBookings(await booking("RoomTimelineViewData.php", body));
  });
  cacheLife(result.outage ? OUTAGE_LIFE : { stale: 300, revalidate: 900, expire: DAY });
  return result;
}

/**
 * TLS photos and details keyed by room number ("SA513"). They are optional, so when TLS is unreachable
 * and there is no backup the finder shows rooms without them rather than failing.
 */
export async function getRoomInfo(): Promise<Record<string, RoomInfo>> {
  "use cache: remote";
  const result = await withBackup(backup, "room-info", 30 * DAY, loadRoomInfo);
  if (result.outage) cacheLife("minutes");
  else cacheLife("days");
  return result.data ?? {};
}

async function loadRoomInfo(): Promise<Record<string, RoomInfo>> {
  const fields = "_fields=link,featured_media,acf,cu_space_type,cu_space_accessibility,cu_space_equipment";
  const spacesPage = (page: number) => tls<TlsSpace[]>(`cu_space?per_page=${PAGE_SIZE}&page=${page}&${fields}`);
  const taxonomy = (name: string) =>
    tls<{ id: number; name: string }[]>(`${name}?per_page=${PAGE_SIZE}&_fields=id,name`);

  const [first, ...taxonomies] = await Promise.all([
    spacesPage(1),
    taxonomy("cu_space_type"),
    taxonomy("cu_space_accessibility"),
    taxonomy("cu_space_equipment"),
  ]);
  const rest = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, i) => spacesPage(i + 2)));
  const spaces = [first, ...rest].flatMap((p) => p.data);
  const terms = Object.fromEntries(taxonomies.flatMap((t) => t.data).map((t) => [t.id, t.name]));

  const mediaIds = spaces.map((s) => s.featured_media).filter((id): id is number => !!id);
  const media = await Promise.all(
    Array.from({ length: Math.ceil(mediaIds.length / PAGE_SIZE) }, (_, i) => {
      const ids = mediaIds.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE).join(",");
      return tls<TlsMedia[]>(`media?per_page=${PAGE_SIZE}&include=${ids}&_fields=id,source_url,media_details`);
    }),
  );
  return parseSpaces(spaces, terms, pickImages(media.flatMap((m) => m.data)));
}

/** The term's in-person classes from Carleton Central. Only fetched while the booking site is down. */
export async function getClassSchedule(term: string): Promise<Backed<ClassMeeting[]>> {
  "use cache: remote";
  const result = await withBackup(backup, `classes:${term}`, 30 * DAY, () => crawlClasses(term));
  if (result.outage) cacheLife(OUTAGE_LIFE);
  else cacheLife({ stale: 3600, revalidate: DAY, expire: 7 * DAY });
  return result;
}

/** Searches every subject (about 140 requests, spread over a few sessions) and collects the meetings. */
async function crawlClasses(term: string): Promise<ClassMeeting[]> {
  const sessions = await Promise.all(Array.from({ length: CENTRAL_SESSIONS }, () => centralSession(term)));
  const queue = [...sessions[0].subjects];
  const pages: string[] = [];
  await Promise.all(
    sessions.map(async ({ search }) => {
      for (let subject = queue.shift(); subject; subject = queue.shift()) {
        const page = await search(subject);
        if (isTooBroad(page)) pages.push(await search(subject, "UG"), await search(subject, "GR"));
        else pages.push(page);
      }
    }),
  );
  return pages.flatMap(parseClasses);
}

/** A search session on Carleton Central. Banner keeps search state per session, tied to its cookies. */
async function centralSession(term: string) {
  const cookies = new Map<string, string>();
  async function call(path: string, form?: [string, string][]): Promise<string> {
    const res = await request(`${CENTRAL}/${path}`, {
      method: form ? "POST" : "GET",
      body: form && new URLSearchParams(form),
      headers: cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {},
      timeout: 30_000,
    });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const eq = pair.indexOf("=");
      cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    return res.text();
  }

  const start = await call("bwysched.p_select_term?wsea_code=INT");
  const page = await call("bwysched.p_search_fields", [
    ["wsea_code", "INT"],
    ["session_id", parseSessionId(start)],
    ["term_code", term],
  ]);
  const session = parseSessionId(page);
  return {
    subjects: parseSubjects(page),
    search: (subject: string, level = "") =>
      call("bwysched.p_course_search", searchForm(term, session, subject, level)),
  };
}

// Banner's search form posts every field once as "dummy" and then again with its real value.
const SEARCH_FIELDS = [
  "sel_aud",
  "sel_subj",
  "sel_camp",
  "sel_sess",
  "sel_attr",
  "sel_levl",
  "sel_schd",
  "sel_insm",
  "sel_link",
  "sel_wait",
  "sel_day",
  "sel_begin_hh",
  "sel_begin_mi",
  "sel_begin_am_pm",
  "sel_end_hh",
  "sel_end_mi",
  "sel_end_am_pm",
  "sel_instruct",
  "sel_special",
  "sel_resd",
  "sel_breadth",
];

/** The search form as a browser submits it for one subject, any time, any day. */
function searchForm(term: string, session: string, subject: string, level: string): [string, string][] {
  return [
    ["wsea_code", "INT"],
    ["term_code", term],
    ["session_id", session],
    ["ws_numb", ""],
    ...SEARCH_FIELDS.map((name): [string, string] => [name, "dummy"]),
    ["sel_levl", level],
    ["sel_subj", subject],
    ["sel_number", ""],
    ["sel_crn", ""],
    ["sel_special", "N"],
    ["sel_sess", ""],
    ["sel_schd", ""],
    ["sel_instruct", ""],
    ["sel_begin_hh", "0"],
    ["sel_begin_mi", "0"],
    ["sel_begin_am_pm", "a"],
    ["sel_end_hh", "0"],
    ["sel_end_mi", "0"],
    ["sel_end_am_pm", "a"],
    ...["m", "t", "w", "r", "f", "s", "u"].map((day): [string, string] => ["sel_day", day]),
    ["block_button", ""],
  ];
}

/** Where a day's schedule came from: the booking site (fresh or saved), or the class timetable. */
export type Source = "bookings" | "classes";

/**
 * Everything the finder needs for one day: fresh bookings, or the last ones saved before Carleton went
 * down (`outage` says which). If that day was never saved, class times from the public timetable stand
 * in, covering only rooms that hold classes. Just the outage when even that is unavailable.
 */
export type Day =
  { rooms: DayRoom[]; fetchedAt: number; outage: Outage | null; source: Source } | { rooms: null; outage: Outage };

export async function getDay(date: string): Promise<Day> {
  const [list, day, info] = await Promise.all([getRooms(), getBookings(date), getRoomInfo()]);
  const { rooms, buildings } = list.data;
  const withDay = (r: Room, bookings: Booking[] = []): DayRoom => ({
    ...r,
    buildingName: buildings[r.building] ?? r.building,
    bookings,
    info: info[roomKey(r.name)] ?? null,
  });

  if (day.data !== null) {
    const bookings = day.data;
    return {
      source: "bookings",
      fetchedAt: day.fetchedAt,
      outage: day.outage,
      rooms: rooms.map((r) => withDay(r, bookings[r.id])),
    };
  }

  const classes = await getClassSchedule(termFor(date));
  if (classes.data === null) return { rooms: null, outage: day.outage };
  const { bookings, taught } = bookingsFromClasses(classes.data, date, rooms, buildings);
  return {
    source: "classes",
    fetchedAt: classes.fetchedAt,
    outage: day.outage,
    rooms: rooms.filter((r) => taught.has(r.id)).map((r) => withDay(r, bookings[r.id])),
  };
}

// Cached fetchers for booking.carleton.ca and the TLS room API.
// Cache lifetimes keep the load on Carleton's servers to a handful of requests per hour. "remote" shares
// entries across serverless instances when deployed; locally it falls back to an in-memory cache.
// Every successful answer is also kept as a backup, so when Carleton is down the finder shows the last
// bookings it saw instead of an error.
import { getCache } from "@vercel/functions";
import { cacheLife } from "next/cache";
import { type Fetched, MaintenanceError, type Outage, withBackup } from "./backup";
import { parseBookings, parseBuildings, parseRoomList } from "./parse-booking";
import { parseSpaces, pickImages, roomKey, type TlsMedia, type TlsSpace } from "./parse-tls";
import { dateStamp } from "./time";
import type { Booking, DayRoom, Room, RoomInfo } from "./types";

const BOOKING = "https://booking.carleton.ca/Portal/Services";
const TLS = "https://carleton.ca/tls/wp-json/wp/v2";
const USER_AGENT = "Mozilla/5.0 (compatible; EmptyRooms/1.0)";
/** WordPress caps per_page at 100. */
const PAGE_SIZE = 100;
const DAY = 86_400;
/** While Carleton is down, ask it again at most every couple of minutes. */
const OUTAGE_LIFE = { stale: 30, revalidate: 120, expire: 600 };

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

/** Every bookable room plus building names. Rooms rarely change. */
export async function getRooms(): Promise<Backed<RoomList>> {
  "use cache: remote";
  const result = await withBackup(backup, "rooms", 30 * DAY, async () => {
    const [view, combo] = await Promise.all([booking("RoomTimelineView.php", ""), booking("LocationCombo.php")]);
    return { rooms: parseRoomList(view), buildings: parseBuildings(combo) };
  });
  if (result.outage) cacheLife(OUTAGE_LIFE);
  else cacheLife("days");
  return result;
}

/** All bookings for one day ("YYYY-MM-DD"), keyed by room id. */
export async function getBookings(date: string): Promise<Backed<Record<string, Booking[]>>> {
  "use cache: remote";
  const result = await withBackup(backup, `bookings:${date}`, 3 * DAY, async () => {
    const { data, outage } = await getRooms();
    if (!data)
      throw outage === "maintenance" ? new MaintenanceError(BOOKING) : new Error("Booking site room list unavailable");
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

/**
 * Everything the finder needs for one day: fresh, or the last bookings saved before Carleton went down
 * (`outage` says which), or just the outage when that day was never saved.
 */
export type Day = { rooms: DayRoom[]; fetchedAt: number; outage: Outage | null } | { rooms: null; outage: Outage };

export async function getDay(date: string): Promise<Day> {
  const [list, day, info] = await Promise.all([getRooms(), getBookings(date), getRoomInfo()]);
  if (list.data === null) return { rooms: null, outage: list.outage };
  if (day.data === null) return { rooms: null, outage: day.outage };
  const { rooms, buildings } = list.data;
  const bookings = day.data;
  return {
    fetchedAt: day.fetchedAt,
    outage: day.outage,
    rooms: rooms.map((r) => ({
      ...r,
      buildingName: buildings[r.building] ?? r.building,
      bookings: bookings[r.id] ?? [],
      info: info[roomKey(r.name)] ?? null,
    })),
  };
}

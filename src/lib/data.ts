// Cached fetchers for booking.carleton.ca and the TLS room API.
// Cache lifetimes keep the load on Carleton's servers to a handful of requests per hour. "remote" shares
// entries across serverless instances when deployed; locally it falls back to an in-memory cache.
import { cacheLife } from "next/cache";
import { parseBookings, parseBuildings, parseRoomList } from "./parse-booking";
import { parseSpaces, pickImages, roomKey, type TlsMedia, type TlsSpace } from "./parse-tls";
import { dateStamp } from "./time";
import type { Booking, DayRoom, Room, RoomInfo } from "./types";

const BOOKING = "https://booking.carleton.ca/Portal/Services";
const TLS = "https://carleton.ca/tls/wp-json/wp/v2";
const USER_AGENT = "Mozilla/5.0 (compatible; EmptyRooms/1.0)";
/** WordPress caps per_page at 100. */
const PAGE_SIZE = 100;

async function request(url: string, init: RequestInit & { timeout: number }): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...init.headers },
    signal: AbortSignal.timeout(init.timeout),
  });
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

/** Every bookable room plus building names. Rooms rarely change. */
export async function getRooms(): Promise<{ rooms: Room[]; buildings: Record<string, string> }> {
  "use cache: remote";
  cacheLife("days");
  const [view, combo] = await Promise.all([booking("RoomTimelineView.php", ""), booking("LocationCombo.php")]);
  return { rooms: parseRoomList(view), buildings: parseBuildings(combo) };
}

/** All bookings for one day ("YYYY-MM-DD"), keyed by room id. */
export async function getBookings(date: string): Promise<{ bookings: Record<string, Booking[]>; fetchedAt: number }> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });
  const { rooms } = await getRooms();
  const body = `rooms=${rooms.map((r) => r.id).join(",")}&date=${dateStamp(date)}`;
  return { bookings: parseBookings(await booking("RoomTimelineViewData.php", body)), fetchedAt: Date.now() };
}

/**
 * TLS photos and details keyed by room number ("SA513"). They are optional, so a failure is cached
 * briefly as "no details" rather than slowing every page down while TLS is unreachable.
 */
export async function getRoomInfo(): Promise<Record<string, RoomInfo>> {
  "use cache: remote";
  try {
    const info = await loadRoomInfo();
    cacheLife("days");
    return info;
  } catch (err) {
    console.error("TLS room details unavailable", err);
    cacheLife("minutes");
    return {};
  }
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

/** Everything the finder needs for one day. Throws if the booking site is unreachable. */
export async function getDay(date: string): Promise<{ rooms: DayRoom[]; fetchedAt: number }> {
  const [{ rooms, buildings }, { bookings, fetchedAt }, info] = await Promise.all([
    getRooms(),
    getBookings(date),
    getRoomInfo(),
  ]);
  return {
    fetchedAt,
    rooms: rooms.map((r) => ({
      ...r,
      buildingName: buildings[r.building] ?? r.building,
      bookings: bookings[r.id] ?? [],
      info: info[roomKey(r.name)] ?? null,
    })),
  };
}

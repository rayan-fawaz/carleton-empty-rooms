// Cached fetchers for booking.carleton.ca and the TLS room API.
// Cache lifetimes keep load on Carleton's servers to a handful of requests per hour. "remote" shares
// entries across serverless instances when deployed; locally it falls back to an in-memory cache.
import { cacheLife } from "next/cache";
import { parseBookings, parseBuildings, parseRoomList } from "./parse-booking";
import { parseSpaces, pickImages, type TlsMedia, type TlsSpace } from "./parse-tls";
import { dateStamp } from "./time";
import type { Booking, Room, RoomInfo } from "./types";

const BOOKING = "https://booking.carleton.ca/Portal/Services";
const TLS = "https://carleton.ca/tls/wp-json/wp/v2";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; CarletonEmptyRooms/0.1; student project)" };

async function text(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...init?.headers }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.text();
}

const post = (path: string, body: string) =>
  text(`${BOOKING}/${path}`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

/** Every bookable room plus building names. Rooms rarely change. */
export async function getRooms(): Promise<{ rooms: Room[]; buildings: Record<string, string> }> {
  "use cache: remote";
  cacheLife("days");
  const [view, combo] = await Promise.all([post("RoomTimelineView.php", ""), text(`${BOOKING}/LocationCombo.php?`)]);
  return { rooms: parseRoomList(view), buildings: parseBuildings(combo) };
}

/** All bookings for one day ("YYYY-MM-DD"), keyed by room id. */
export async function getBookings(date: string): Promise<{ bookings: Record<string, Booking[]>; fetchedAt: number }> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });
  const { rooms } = await getRooms();
  const body = `rooms=${rooms.map((r) => r.id).join(",")}&date=${dateStamp(date)}`;
  return { bookings: parseBookings(await post("RoomTimelineViewData.php", body)), fetchedAt: Date.now() };
}

/** TLS classroom details keyed by room number ("SA513"). Optional: callers should tolerate failure. */
export async function getRoomInfo(): Promise<Record<string, RoomInfo>> {
  "use cache: remote";
  cacheLife("days");
  const json = async <T,>(url: string): Promise<T> => JSON.parse(await text(url));
  const fields = "_fields=title,link,featured_media,acf,cu_space_type,cu_space_accessibility,cu_space_equipment";

  const [p1, p2, ...taxonomies] = await Promise.all([
    json<TlsSpace[]>(`${TLS}/cu_space?per_page=100&page=1&${fields}`),
    json<TlsSpace[]>(`${TLS}/cu_space?per_page=100&page=2&${fields}`),
    ...["cu_space_type", "cu_space_accessibility", "cu_space_equipment"].map((t) =>
      json<{ id: number; name: string }[]>(`${TLS}/${t}?per_page=100&_fields=id,name`),
    ),
  ]);
  const spaces = [...p1, ...p2];
  const terms = Object.fromEntries(taxonomies.flat().map((t) => [t.id, t.name]));

  // Room photos: the media endpoint takes at most 100 ids per request.
  const mediaIds = spaces.map((s) => s.featured_media).filter((id): id is number => !!id);
  const batches = Array.from({ length: Math.ceil(mediaIds.length / 100) }, (_, i) => mediaIds.slice(i * 100, i * 100 + 100));
  const media = await Promise.all(
    batches.map((ids) =>
      json<TlsMedia[]>(`${TLS}/media?per_page=100&include=${ids.join(",")}&_fields=id,source_url,media_details`).catch(
        () => [],
      ),
    ),
  );
  return parseSpaces(spaces, terms, pickImages(media.flat()));
}

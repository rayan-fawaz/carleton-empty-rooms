// Parser for the TLS "cu_space" WordPress API (carleton.ca/tls/wp-json/wp/v2/cu_space).
import { decodeEntities } from "./html";
import type { RoomImage, RoomInfo } from "./types";

export type TlsSpace = {
  link: string;
  featured_media?: number;
  acf?: { cu_space_room_number?: string; cu_space_room_capacity?: string } | null;
  cu_space_type?: number[];
  cu_space_accessibility?: number[];
  cu_space_equipment?: number[];
};

/** Booking room names ("SA 513") and TLS room numbers ("SA513") share this key. */
export const roomKey = (name: string) => name.replace(/\s+/g, "").toUpperCase();

export type TlsMedia = {
  id: number;
  source_url: string;
  media_details?: { sizes?: Record<string, { source_url: string }> };
};

/** Pick a small card crop and a larger detail crop from WordPress's generated sizes. */
export function pickImages(media: TlsMedia[]): Record<number, RoomImage> {
  const out: Record<number, RoomImage> = {};
  for (const m of media) {
    const sizes = m.media_details?.sizes ?? {};
    const url = (...keys: string[]) => keys.map((k) => sizes[k]?.source_url).find(Boolean) ?? m.source_url;
    out[m.id] = {
      thumb: url("horizontal-card-sm", "gallery-thumb", "medium"),
      large: url("rotator-image", "medium_large", "horizontal-card-lg", "large"),
    };
  }
  return out;
}

export function parseSpaces(
  spaces: TlsSpace[],
  terms: Record<number, string>,
  images: Record<number, RoomImage> = {},
): Record<string, RoomInfo> {
  const names = (ids: number[] = []) =>
    ids
      .map((id) => terms[id])
      .filter(Boolean)
      .map(decodeEntities);
  const out: Record<string, RoomInfo> = {};

  for (const s of spaces) {
    const number = s.acf?.cu_space_room_number;
    if (!number) continue;
    const capacity = Number.parseInt(s.acf?.cu_space_room_capacity ?? "", 10);
    out[roomKey(number)] = {
      url: s.link,
      capacity: Number.isFinite(capacity) ? capacity : null,
      types: names(s.cu_space_type),
      accessibility: names(s.cu_space_accessibility),
      equipment: names(s.cu_space_equipment),
      image: (s.featured_media && images[s.featured_media]) || null,
    };
  }
  return out;
}

// Parsers for booking.carleton.ca (Infosilem Campus Portal) responses.
// The portal returns HTML and inline <script> snippets; we regex the data out and never execute it.
import type { Booking, Room } from "./types";

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** From RoomTimelineView.php: room ids (hidden input) zipped with names (inline script). */
export function parseRoomList(html: string): Room[] {
  const ids = html.match(/id="roomList" value="([^"]*)"/)?.[1].split(",");
  const names = html.match(/RoomList = (\[[^\]]*\])/)?.[1];
  if (!ids || !names) throw new Error("Booking site room list not found; the page format may have changed");

  const parsed: string[] = JSON.parse(names);
  if (parsed.length !== ids.length) throw new Error("Booking site room list ids and names don't line up");
  return ids.map((id, i) => ({ id, name: parsed[i], building: parsed[i].split(" ")[0] }));
}

/** From LocationCombo.php: options like `B_<guid>` → "TB - Tory Building". */
export function parseBuildings(html: string): Record<string, string> {
  const buildings: Record<string, string> = {};
  for (const [, label] of html.matchAll(/value="B_[^"]*"\s*>([^<]*)/g)) {
    const m = decodeEntities(label).trim().match(/^(\S+) - (.+)$/);
    if (m) buildings[m[1]] = m[2].trim();
  }
  return buildings;
}

// tb['<room id>'][n]=[startMinute,duration,_,_,_,_,'<tooltip html>',...]
const BLOCK = /tb\['([0-9a-f-]+)'\]\[\d+\]=\[(\d+),(\d+),[^,]*,[^,]*,[^,]*,[^,]*,'((?:[^'\\]|\\.)*)'/g;

/** From RoomTimelineViewData.php: every booked block per room for one day. */
export function parseBookings(js: string): Record<string, Booking[]> {
  const out: Record<string, Booking[]> = {};
  for (const [, roomId, start, duration, tooltip] of js.matchAll(BLOCK)) {
    const title = tooltip.match(/<b>(.*?)<\/b>/)?.[1] ?? "Occupied";
    (out[roomId] ??= []).push({
      start: Number(start),
      end: Number(start) + Number(duration),
      title: decodeEntities(title.replace(/\\'/g, "'")).trim(),
    });
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.start - b.start);
  return out;
}

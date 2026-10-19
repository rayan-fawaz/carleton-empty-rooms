import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBookings, parseBuildings, parseRoomList } from "./parse-booking";
import { parseSpaces, pickImages } from "./parse-tls";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

describe("parseRoomList", () => {
  const rooms = parseRoomList(fixture("timeline-view.html"));

  it("zips room ids with names", () => {
    expect(rooms).toHaveLength(231);
    expect(rooms[0]).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), name: "AP 132", building: "AP" });
  });

  it("throws when the page shape changes", () => {
    expect(() => parseRoomList("<html></html>")).toThrow(/room list/i);
  });
});

describe("parseBuildings", () => {
  it("maps building codes to names", () => {
    const buildings = parseBuildings(fixture("location-combo.html"));
    expect(buildings.TB).toBe("Tory Building");
    expect(buildings.NN).toBe("Nideyinàn (formerly University Centre)");
    expect(Object.keys(buildings)).not.toContain("M");
  });
});

describe("parseBookings", () => {
  const bookings = parseBookings(fixture("timeline-data.txt"));

  it("parses every time block, keyed by room id", () => {
    expect(Object.keys(bookings)).toHaveLength(191);
    expect(Object.values(bookings).flat()).toHaveLength(430);
  });

  it("converts start + duration to a minute range and pulls the title", () => {
    const blocks = Object.values(bookings).flat();
    expect(blocks).toContainEqual({ start: 870, end: 960, title: "Occupied" });
    expect(blocks).toContainEqual({ start: 540, end: 720, title: "Self-Service: Study Desks" });
  });

  it("sorts each room's bookings by start time", () => {
    for (const list of Object.values(bookings)) {
      expect(list.map((b) => b.start)).toEqual([...list.map((b) => b.start)].sort((a, b) => a - b));
    }
  });

  it("returns nothing for a day with no bookings", () => {
    expect(parseBookings("<script>var tb = {};</script>")).toEqual({});
  });
});

describe("parseSpaces", () => {
  it("keys TLS rooms by booking room number and resolves taxonomy names", () => {
    const info = parseSpaces(JSON.parse(fixture("tls-spaces.json")), {
      776: "Computer Lab",
      790: "Power Outlets at Every Student Desk",
      74: "Whiteboard",
    });
    expect(info.SA513).toMatchObject({
      capacity: 30,
      types: ["Computer Lab"],
      url: "https://carleton.ca/tls/space/southam-hall-513/",
    });
    expect(info.SA513.accessibility).toContain("Power Outlets at Every Student Desk");
    expect(info.SA513.equipment).toContain("Whiteboard");
    expect(info.SA513.image).toBeNull();
  });

  it("attaches the room photo in card and detail sizes", () => {
    const images = pickImages(JSON.parse(fixture("tls-media.json")));
    const info = parseSpaces(JSON.parse(fixture("tls-spaces.json")), {}, images);
    expect(info.SA513.image).toEqual({
      thumb: "https://carleton.ca/tls/wp-content/uploads/sites/258/SA513-preview-300x200.jpeg",
      large: "https://carleton.ca/tls/wp-content/uploads/sites/258/SA513-preview-800x600.jpeg",
    });
    expect(info.SA507.image).toBeNull();
  });

  it("falls back to the original upload when no crops exist", () => {
    expect(pickImages([{ id: 1, source_url: "https://x/full.jpg" }])[1]).toEqual({
      thumb: "https://x/full.jpg",
      large: "https://x/full.jpg",
    });
  });
});

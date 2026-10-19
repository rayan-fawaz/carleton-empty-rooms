import { describe, expect, it } from "vitest";
import {
  countRooms,
  filterRooms,
  isClassroom,
  matchesSearch,
  place,
  shortBuildingName,
  sortPlaced,
  summarizeBuildings,
} from "./rooms";
import type { DayRoom, RoomInfo } from "./types";

const room = (
  name: string,
  buildingName: string,
  bookings: [number, number][] = [],
  info: RoomInfo | null = null,
): DayRoom => ({
  id: name,
  name,
  building: name.split(" ")[0],
  buildingName,
  bookings: bookings.map(([start, end]) => ({ start, end, title: "Occupied" })),
  info,
});

const info = (patch: Partial<RoomInfo>): RoomInfo => ({
  url: "",
  capacity: null,
  types: [],
  accessibility: [],
  equipment: [],
  image: null,
  ...patch,
});

describe("matchesSearch", () => {
  const sa = room("SA 513", "Southam Hall");

  it.each(["", "  ", "sa 5", "SA513", "sa513", "southam", "Southam 51", "513"])("matches %j", (q) => {
    expect(matchesSearch(sa, q)).toBe(true);
  });

  it.each(["tory", "sa 6", "southam 4", "south 6"])("rejects %j", (q) => {
    expect(matchesSearch(sa, q)).toBe(false);
  });

  it("ignores accents and letter-prefixed room numbers", () => {
    expect(matchesSearch(room("NN 280", "Nideyinàn (formerly University Centre)"), "nideyinan")).toBe(true);
    expect(matchesSearch(room("LA A204", "Loeb Building"), "loeb a2")).toBe(true);
  });
});

describe("place / sortPlaced / summarizeBuildings", () => {
  const rooms = [
    room("SA 1", "Southam Hall", [[660, 720]]), // at 10:00, free for 60m
    room("SA 2", "Southam Hall"), // free all day
    room("SA 3", "Southam Hall", [[540, 700]]), // booked until 11:40
    room("TB 1", "Tory Building", [[630, 700]]), // free for 30m
  ];

  it("marks rooms usable only when free for at least the needed time", () => {
    expect(place(rooms, 600, 60).map((p) => [p.room.name, p.usable])).toEqual([
      ["SA 1", true],
      ["SA 2", true],
      ["SA 3", false],
      ["TB 1", false],
    ]);
  });

  it("ranks longest free first, then short gaps, then booked rooms by when they free up", () => {
    expect(sortPlaced(place(rooms, 600, 60)).map((p) => p.room.name)).toEqual(["SA 2", "SA 1", "TB 1", "SA 3"]);
  });

  it("counts usable rooms per building, most free first", () => {
    expect(summarizeBuildings(place(rooms, 600, 0))).toEqual([
      { code: "SA", name: "Southam Hall", free: 2, total: 3 },
      { code: "TB", name: "Tory Building", free: 1, total: 1 },
    ]);
  });
});

describe("filterRooms", () => {
  const rooms = [
    room("TB 238", "Tory Building"),
    room("TB Lobby", "Tory Building"),
    room("SA 513", "Southam Hall", [], info({ capacity: 40, equipment: ["Whiteboard"] })),
  ];

  it("hides non-classrooms unless asked", () => {
    expect(isClassroom("AP 230N1")).toBe(true);
    expect(isClassroom("FR FRONTENAC MPR")).toBe(false);
    expect(filterRooms(rooms, { all: false, features: [] }).map((r) => r.name)).toEqual(["TB 238", "SA 513"]);
    expect(filterRooms(rooms, { all: true, features: [] })).toHaveLength(3);
  });

  it("requires TLS details for feature filters", () => {
    expect(filterRooms(rooms, { all: false, features: ["whiteboard", "big"] }).map((r) => r.name)).toEqual(["SA 513"]);
    expect(filterRooms(rooms, { all: false, features: ["outlets"] })).toEqual([]);
  });
});

describe("shortBuildingName", () => {
  it("folds former names into a short suffix", () => {
    expect(shortBuildingName("Nideyinàn (formerly University Centre)")).toBe("Nideyinàn · University Centre");
    expect(shortBuildingName("Tory Building")).toBe("Tory Building");
  });
});

describe("countRooms", () => {
  it("pluralizes", () => {
    expect(countRooms(1)).toBe("1 room");
    expect(countRooms(0)).toBe("0 rooms");
    expect(countRooms(12)).toBe("12 rooms");
  });
});

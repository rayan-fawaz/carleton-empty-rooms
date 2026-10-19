import { describe, expect, it } from "vitest";
import {
  baseFilter,
  type FinderRoom,
  isClassroom,
  matchesSearch,
  place,
  queryFor,
  readViewState,
  resolveMinute,
  sortPlaced,
  summarizeBuildings,
} from "./view";

const TODAY = "2026-10-19";

const room = (name: string, buildingName: string, bookings: [number, number][] = [], info: FinderRoom["info"] = null) => ({
  id: name,
  name,
  building: name.split(" ")[0],
  buildingName,
  bookings: bookings.map(([start, end]) => ({ start, end, title: "Occupied" })),
  info,
});

describe("readViewState / queryFor", () => {
  it("defaults to live now, all buildings, any duration", () => {
    expect(readViewState({}, TODAY)).toEqual({
      date: TODAY,
      when: { kind: "now" },
      building: null,
      need: 0,
      features: [],
      all: false,
      view: "list",
      room: null,
    });
    expect(queryFor(readViewState({}, TODAY), TODAY)).toBe("");
  });

  it("round-trips every field", () => {
    const params = { date: "2026-10-21", time: "14:30", b: "sa", need: "120", f: "outlets,bogus", view: "schedule", room: "x" };
    const s = readViewState(params, TODAY);
    expect(s).toMatchObject({ building: "SA", need: 120, features: ["outlets"], when: { kind: "at", minute: 870 } });
    const qs = queryFor(s, TODAY);
    expect(qs).toBe("?date=2026-10-21&time=14:30&b=SA&need=120&f=outlets&view=schedule&room=x");
    expect(readViewState(Object.fromEntries(new URLSearchParams(qs)), TODAY)).toEqual(s);
  });

  it("supports 'in 1h' today, and defaults other days to 9 AM", () => {
    expect(readViewState({ in: "60" }, TODAY).when).toEqual({ kind: "in", minutes: 60 });
    expect(readViewState({ date: "2026-10-22" }, TODAY).when).toEqual({ kind: "at", minute: 540 });
    expect(queryFor(readViewState({ date: "2026-10-22" }, TODAY), TODAY)).toBe("?date=2026-10-22");
  });

  it("ignores garbage", () => {
    expect(readViewState({ date: "nope", time: "25:00", need: "7", in: "5" }, TODAY)).toMatchObject({
      date: TODAY,
      when: { kind: "now" },
      need: 0,
    });
  });
});

describe("resolveMinute", () => {
  it("follows the clock, offsets from it, or pins a time", () => {
    expect(resolveMinute({ kind: "now" }, 600)).toBe(600);
    expect(resolveMinute({ kind: "in", minutes: 120 }, 600)).toBe(720);
    expect(resolveMinute({ kind: "in", minutes: 120 }, 1400)).toBe(1439);
    expect(resolveMinute({ kind: "at", minute: 900 }, 600)).toBe(900);
  });
});

describe("matchesSearch", () => {
  const r = room("SA 513", "Southam Hall");
  it.each(["", "sa 5", "SA513", "sa513", "southam", "Southam 51", "513"])("matches %j", (q) => {
    expect(matchesSearch(r, q)).toBe(true);
  });
  it.each(["tory", "sa 6", "southam 4"])("rejects %j", (q) => {
    expect(matchesSearch(r, q)).toBe(false);
  });
  it("ignores accents", () => {
    expect(matchesSearch(room("NN 280", "Nideyinàn (formerly University Centre)"), "nideyinan")).toBe(true);
  });
});

describe("place / sortPlaced / summarizeBuildings", () => {
  const rooms = [
    room("SA 1", "Southam Hall", [[660, 720]]), // free 10:00 for 60m
    room("SA 2", "Southam Hall"), // free rest of day
    room("SA 3", "Southam Hall", [[540, 700]]), // busy until 11:40
    room("TB 1", "Tory Building", [[630, 700]]), // free 30m
  ];

  it("marks rooms usable only when free for at least the needed time", () => {
    const placed = place(rooms, 600, 60);
    expect(placed.map((p) => [p.room.name, p.usable])).toEqual([
      ["SA 1", true],
      ["SA 2", true],
      ["SA 3", false],
      ["TB 1", false],
    ]);
  });

  it("sorts usable rooms by longest free, then short gaps, then busy by soonest free", () => {
    expect(sortPlaced(place(rooms, 600, 60)).map((p) => p.room.name)).toEqual(["SA 2", "SA 1", "TB 1", "SA 3"]);
  });

  it("counts usable rooms per building, most free first", () => {
    expect(summarizeBuildings(place(rooms, 600, 0))).toEqual([
      { code: "SA", name: "Southam Hall", free: 2, total: 3 },
      { code: "TB", name: "Tory Building", free: 1, total: 1 },
    ]);
  });
});

describe("baseFilter", () => {
  const info = { title: "", url: "", capacity: 40, types: [], accessibility: [], equipment: ["Whiteboard"], image: null };
  const rooms = [room("TB 238", "Tory"), room("TB Lobby", "Tory"), room("SA 513", "Southam", [], info)];

  it("hides non-classrooms unless asked", () => {
    expect(isClassroom("AP 230N1")).toBe(true);
    expect(baseFilter(rooms, { all: false, features: [] }).map((r) => r.name)).toEqual(["TB 238", "SA 513"]);
    expect(baseFilter(rooms, { all: true, features: [] })).toHaveLength(3);
  });

  it("requires TLS info for feature filters", () => {
    expect(baseFilter(rooms, { all: false, features: ["whiteboard", "big"] }).map((r) => r.name)).toEqual(["SA 513"]);
    expect(baseFilter(rooms, { all: false, features: ["outlets"] })).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { describeWhen, queryFor, readViewState, resolveMinute, sameWhen } from "./state";

const TODAY = "2026-10-19";

describe("readViewState / queryFor", () => {
  it("defaults to the live clock on the building directory", () => {
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
    const params = {
      date: "2026-10-21",
      time: "14:30",
      b: "sa",
      need: "120",
      f: "outlets",
      view: "schedule",
      room: "x",
    };
    const s = readViewState(params, TODAY);
    expect(s).toMatchObject({ building: "SA", need: 120, features: ["outlets"], when: { kind: "at", minute: 870 } });
    const qs = queryFor(s, TODAY);
    expect(qs).toBe("?date=2026-10-21&time=14:30&b=SA&need=120&f=outlets&view=schedule&room=x");
    expect(readViewState(Object.fromEntries(new URLSearchParams(qs)), TODAY)).toEqual(s);
  });

  it("supports 'in 1 hour' today and defaults other days to 9 AM", () => {
    expect(readViewState({ in: "60" }, TODAY).when).toEqual({ kind: "in", minutes: 60 });
    expect(readViewState({ date: "2026-10-22" }, TODAY).when).toEqual({ kind: "at", minute: 540 });
    expect(queryFor(readViewState({ date: "2026-10-22" }, TODAY), TODAY)).toBe("?date=2026-10-22");
  });

  it("only allows dates from today through the next six days", () => {
    expect(readViewState({ date: "2026-10-25" }, TODAY).date).toBe("2026-10-25");
    expect(readViewState({ date: "2026-10-26" }, TODAY).date).toBe(TODAY);
    expect(readViewState({ date: "2026-10-18" }, TODAY).date).toBe(TODAY);
    expect(readViewState({ date: "2026-02-31" }, TODAY).date).toBe(TODAY);
  });

  it("ignores unknown values, including inherited object keys", () => {
    expect(
      readViewState({ time: "25:00", need: "7", in: "5", f: "toString,constructor,outlets,outlets" }, TODAY),
    ).toMatchObject({ when: { kind: "now" }, need: 0, features: ["outlets"] });
  });

  it("takes the first value when a parameter repeats", () => {
    expect(readViewState({ b: ["tb", "sa"] }, TODAY).building).toBe("TB");
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

describe("sameWhen", () => {
  it("compares kind and value", () => {
    expect(sameWhen({ kind: "now" }, { kind: "now" })).toBe(true);
    expect(sameWhen({ kind: "in", minutes: 60 }, { kind: "in", minutes: 60 })).toBe(true);
    expect(sameWhen({ kind: "in", minutes: 60 }, { kind: "in", minutes: 120 })).toBe(false);
    expect(sameWhen({ kind: "at", minute: 600 }, { kind: "in", minutes: 600 })).toBe(false);
  });
});

describe("describeWhen", () => {
  const at = (params: Record<string, string>, minute: number) =>
    describeWhen(readViewState(params, TODAY), minute, TODAY);

  it("reads naturally after 'free'", () => {
    expect(at({}, 600)).toBe("right now");
    expect(at({ in: "60" }, 660)).toBe("in 1 hour");
    expect(at({ in: "120" }, 720)).toBe("in 2 hours");
    expect(at({ time: "18:00" }, 1080)).toBe("at 6:00 PM");
    expect(at({ date: "2026-10-20" }, 540)).toBe("tomorrow at 9:00 AM");
    expect(at({ date: "2026-10-22", time: "13:00" }, 780)).toBe("on Thu, Oct 22 at 1:00 PM");
  });
});

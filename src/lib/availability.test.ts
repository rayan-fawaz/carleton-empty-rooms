import { describe, expect, it } from "vitest";
import { DAY_END, daySegments, statusAt } from "./availability";
import { addDays, dateStamp, formatClock, formatDuration, formatTime, isValidDate, ottawaNow } from "./time";

const b = (start: number, end: number, title = "Occupied") => ({ start, end, title });

describe("statusAt", () => {
  it("is free until the end of the day when nothing is booked", () => {
    expect(statusAt([], 600)).toEqual({ free: true, until: DAY_END, minutesLeft: DAY_END - 600, restOfDay: true });
  });

  it("is free until the next booking starts", () => {
    expect(statusAt([b(480, 540), b(780, 900, "COMP 1405")], 600)).toEqual({
      free: true,
      until: 780,
      minutesLeft: 180,
      restOfDay: false,
    });
  });

  it("treats a booking's end minute as free and its start minute as busy", () => {
    expect(statusAt([b(600, 660)], 660).free).toBe(true);
    expect(statusAt([b(600, 660)], 600).free).toBe(false);
  });

  it("is busy until the end of back-to-back or overlapping bookings", () => {
    const list = [b(600, 690, "First"), b(690, 780), b(750, 840), b(900, 960)];
    expect(statusAt(list, 620)).toEqual({ free: false, until: 840 });
  });

  it("ignores unsorted input", () => {
    expect(statusAt([b(900, 960), b(700, 760)], 600)).toMatchObject({ free: true, until: 700 });
  });
});

describe("time helpers", () => {
  it("stamps a date as UTC midnight, which is what the booking site expects", () => {
    expect(dateStamp("2026-10-19")).toBe(1792368000);
  });

  it("reads the Ottawa wall clock regardless of server timezone", () => {
    // 2026-10-19 22:15 UTC is 18:15 in Ottawa (EDT, UTC-4)
    expect(ottawaNow(new Date("2026-10-19T22:15:00Z"))).toEqual({ date: "2026-10-19", minute: 18 * 60 + 15 });
    // 03:30 UTC on the 20th is still the 19th in Ottawa
    expect(ottawaNow(new Date("2026-10-20T03:30:00Z")).date).toBe("2026-10-19");
  });

  it("validates real calendar dates", () => {
    expect(isValidDate("2026-10-19")).toBe(true);
    expect(isValidDate("2026-02-31")).toBe(false);
    expect(isValidDate("2026-1-5")).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formats a timestamp as Ottawa clock time", () => {
    expect(formatClock(Date.parse("2026-10-19T22:42:00Z"))).toBe("6:42 PM");
  });

  it("formats minutes for humans", () => {
    expect(formatTime(0)).toBe("12:00 AM");
    expect(formatTime(810)).toBe("1:30 PM");
    expect(formatTime(DAY_END)).toBe("midnight");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(150)).toBe("2h 30m");
    expect(formatDuration(120)).toBe("2h");
  });
});

describe("daySegments", () => {
  it("splits a day window into alternating free and booked stretches", () => {
    expect(daySegments([b(540, 600, "A"), b(600, 660, "B"), b(800, 900, "C")], 480, 960)).toEqual([
      { start: 480, end: 540, free: true },
      { start: 540, end: 600, free: false, title: "A" },
      { start: 600, end: 660, free: false, title: "B" },
      { start: 660, end: 800, free: true },
      { start: 800, end: 900, free: false, title: "C" },
      { start: 900, end: 960, free: true },
    ]);
  });

  it("clips bookings to the window and merges overlaps into one booked stretch", () => {
    expect(daySegments([b(400, 500, "Early"), b(520, 600, "X"), b(560, 620, "Y")], 480, 700)).toEqual([
      { start: 480, end: 500, free: false, title: "Early" },
      { start: 500, end: 520, free: true },
      { start: 520, end: 620, free: false, title: "X" },
      { start: 620, end: 700, free: true },
    ]);
  });

  it("ignores bookings that start at or after the window ends", () => {
    expect(daySegments([b(540, 600, "A"), b(960, 1000, "Edge"), b(1410, 1440, "Late")], 480, 960)).toEqual([
      { start: 480, end: 540, free: true },
      { start: 540, end: 600, free: false, title: "A" },
      { start: 600, end: 960, free: true },
    ]);
  });

  it("is one free stretch on an empty day", () => {
    expect(daySegments([], 480, 960)).toEqual([{ start: 480, end: 960, free: true }]);
  });
});

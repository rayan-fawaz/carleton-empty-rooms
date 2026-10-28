import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bookingsFromClasses, isTooBroad, parseClasses, parseSessionId, parseSubjects, termFor } from "./parse-central";
import snapshot from "./room-snapshot.json";

const page = readFileSync(join(__dirname, "__fixtures__", "class-search.html"), "utf8");
const idOf = (name: string) => snapshot.rooms.find((r) => r.name === name)!.id;

describe("parseClasses", () => {
  const classes = parseClasses(page);

  it("reads each in-person meeting with its course and section", () => {
    expect(classes[0]).toEqual({
      course: "COMP 1005 A",
      building: "Minto Centre",
      room: "2000",
      days: [1, 3],
      start: 8 * 60 + 35,
      end: 9 * 60 + 55,
      from: "2026-09-09",
      to: "2026-12-11",
    });
  });

  it("skips online and unscheduled meetings", () => {
    expect(classes.some((c) => c.room === "LINE" || c.days.length === 0)).toBe(false);
  });

  it("keeps every meeting pattern of a section and normalizes building names", () => {
    expect(classes.filter((c) => c.course === "ACCT 5128 P").length).toBeGreaterThan(1);
    expect(classes.find((c) => c.course === "ANTH 1001 B")?.building).toBe("Nideyinàn (former UC)");
  });
});

describe("bookingsFromClasses", () => {
  const classes = parseClasses(page);
  const day = (date: string) => bookingsFromClasses(classes, date, snapshot.rooms, snapshot.buildings);

  it("books a room on the class's weekdays within its dates", () => {
    expect(day("2026-10-28").bookings[idOf("MC 2000")]).toEqual([
      { start: 8 * 60 + 35, end: 9 * 60 + 55, title: "COMP 1005 A" },
    ]);
    expect(day("2026-10-27").bookings[idOf("MC 2000")]).toBeUndefined(); // a Tuesday
    expect(day("2026-12-14").bookings[idOf("MC 2000")]).toBeUndefined(); // after classes end
  });

  it("matches Banner building names to booking-site codes", () => {
    const { taught } = day("2026-10-28");
    for (const name of ["MC 2000", "NN 231", "HS 1301", "NI 4030"]) expect(taught.has(idOf(name))).toBe(true);
  });

  it("only counts rooms that hold classes as taught", () => {
    expect(day("2026-10-28").taught.size).toBe(4);
  });

  it("shows cross-listed sections in one slot", () => {
    const twin = { ...classes[0], course: "COMP 1005 B" };
    const { bookings } = bookingsFromClasses([classes[0], twin], "2026-10-28", snapshot.rooms, snapshot.buildings);
    expect(bookings[idOf("MC 2000")]).toEqual([expect.objectContaining({ title: "COMP 1005 A / COMP 1005 B" })]);
  });
});

describe("search pages", () => {
  it("maps dates to Banner terms", () => {
    expect(termFor("2026-01-15")).toBe("202610");
    expect(termFor("2026-06-01")).toBe("202620");
    expect(termFor("2026-10-28")).toBe("202630");
  });

  it("reads the subject list, session and the too-many-results notice", () => {
    const html = `<input type="hidden" name="session_id" value="26572302" />
      <select name="sel_subj" multiple><option value="">All Subjects</option><option value="ACCT">Accounting (ACCT)</option>
      <option value="COMP">Computer Science (COMP)</option></select>`;
    expect(parseSubjects(html)).toEqual(["ACCT", "COMP"]);
    expect(parseSessionId(html)).toBe("26572302");
    expect(isTooBroad("Unable to display your search results as it exceeds 300 courses")).toBe(true);
    expect(() => parseSubjects("<html></html>")).toThrow(/subject list/);
  });
});

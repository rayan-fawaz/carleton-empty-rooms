import { describe, expect, it, vi } from "vitest";
import { MaintenanceError, type Store, withBackup } from "./backup";

function memoryStore(): Store & { saved: Map<string, { value: unknown; ttl: number }> } {
  const saved = new Map<string, { value: unknown; ttl: number }>();
  return {
    saved,
    get: async (key) => saved.get(key)?.value ?? null,
    set: async (key, value, { ttl }) => void saved.set(key, { value, ttl }),
  };
}

const at = (ms: number) => () => ms;

describe("withBackup", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  it("returns fresh data and keeps a copy", async () => {
    const store = memoryStore();
    const result = await withBackup(store, "k", 60, async () => ["a"], at(1000));
    expect(result).toEqual({ data: ["a"], fetchedAt: 1000, outage: null });
    expect(store.saved.get("k")).toEqual({ value: { data: ["a"], fetchedAt: 1000 }, ttl: 60 });
  });

  it("falls back to the last copy, marked with the outage", async () => {
    const store = memoryStore();
    await withBackup(store, "k", 60, async () => ["a"], at(1000));
    const down = await withBackup(store, "k", 60, () => Promise.reject(new MaintenanceError("x")), at(2000));
    expect(down).toEqual({ data: ["a"], fetchedAt: 1000, outage: "maintenance" });
    const broken = await withBackup(store, "k", 60, () => Promise.reject(new Error("timeout")), at(3000));
    expect(broken).toEqual({ data: ["a"], fetchedAt: 1000, outage: "unreachable" });
  });

  it("reports the outage alone when there is no copy", async () => {
    const result = await withBackup(memoryStore(), "k", 60, () => Promise.reject(new MaintenanceError("x")));
    expect(result).toEqual({ data: null, outage: "maintenance" });
  });

  it("never fails because the backup store does", async () => {
    const broken: Store = {
      get: () => Promise.reject(new Error("down")),
      set: () => Promise.reject(new Error("down")),
    };
    expect(await withBackup(broken, "k", 60, async () => 1, at(5))).toEqual({ data: 1, fetchedAt: 5, outage: null });
    expect(await withBackup(broken, "k", 60, () => Promise.reject(new Error("x")))).toEqual({
      data: null,
      outage: "unreachable",
    });
  });
});

// Last successful answer from Carleton, kept outside the page cache so it survives outages and redeploys.

/** Why Carleton's data couldn't be loaded: its sites redirect to a maintenance page, or they failed outright. */
export type Outage = "maintenance" | "unreachable";

/** Thrown when a Carleton site redirects to its maintenance page instead of answering. */
export class MaintenanceError extends Error {
  constructor(url: string) {
    super(`${url} is down for maintenance`);
    this.name = "MaintenanceError";
  }
}

export const outageOf = (err: unknown): Outage => (err instanceof MaintenanceError ? "maintenance" : "unreachable");

/** Data stamped with when Carleton gave it to us, and the outage (if any) that stopped a fresher copy. */
export type Fetched<T> = { data: T; fetchedAt: number; outage: Outage | null };

/** The subset of the runtime cache this module uses, so tests can pass a plain map. */
export type Store = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, options: { ttl: number }) => Promise<void>;
};

/**
 * Loads fresh data and keeps a copy for `ttl` seconds. If loading fails, returns that copy marked with the
 * outage, or `outage` alone when there is no copy. Saving and reading the copy never fail the request.
 */
export async function withBackup<T>(
  store: Store,
  key: string,
  ttl: number,
  load: () => Promise<T>,
  now = Date.now,
): Promise<Fetched<T> | { data: null; outage: Outage }> {
  try {
    const fresh = { data: await load(), fetchedAt: now() };
    await store.set(key, fresh, { ttl }).catch((err) => console.error(`Couldn't save backup ${key}`, err));
    return { ...fresh, outage: null };
  } catch (err) {
    const outage = outageOf(err);
    console.error(`Carleton ${outage}; using backup ${key}`, err);
    const saved = (await store.get(key).catch(() => null)) as { data: T; fetchedAt: number } | null | undefined;
    return saved ? { ...saved, outage } : { data: null, outage };
  }
}

import { formatHour, formatTime } from "@/lib/time";
import type { Minute } from "@/lib/types";
import type { Placed } from "@/lib/view";

const FROM = 8 * 60;
const TO = 22 * 60;
const HOURS = Array.from({ length: (TO - FROM) / 60 + 1 }, (_, i) => FROM / 60 + i);
const pct = (m: Minute) => `${((Math.min(Math.max(m, FROM), TO) - FROM) / (TO - FROM)) * 100}%`;

/** A building's whole day at a glance: one row per room, booked time shaded. */
export function Schedule({ list, minute, onOpen }: { list: Placed[]; minute: Minute; onOpen: (id: string) => void }) {
  const rows = [...list].sort((a, b) => a.room.name.localeCompare(b.room.name, "en", { numeric: true }));
  const showNow = minute >= FROM && minute <= TO;

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[680px] rounded-2xl bg-surface p-3 shadow-card">
        <div className="mb-3 flex items-center gap-4 px-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="booked h-3 w-5 rounded" aria-hidden /> Booked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-brand" aria-hidden /> {formatTime(minute)}
          </span>
        </div>

        <div className="grid grid-cols-[5.5rem_1fr] border-b border-line pb-1">
          <div />
          <div className="relative h-5 text-[11px] text-muted">
            {HOURS.map((h) => (
              <span key={h} className="tabular absolute -translate-x-1/2" style={{ left: pct(h * 60) }}>
                {formatHour(h)}
              </span>
            ))}
          </div>
        </div>

        <ul>
          {rows.map((p) => (
            <li key={p.room.id}>
              <button
                type="button"
                onClick={() => onOpen(p.room.id)}
                className="grid w-full grid-cols-[5.5rem_1fr] items-center rounded-lg text-left hover:bg-surface-2"
              >
                <span className="flex items-center gap-2 px-1 py-2 text-sm font-semibold">
                  <span className={`h-2 w-2 rounded-full ${p.usable ? "bg-free" : p.status.free ? "bg-short" : "bg-busy"}`} aria-hidden />
                  {p.room.name}
                </span>
                <span className="relative h-7">
                  {HOURS.map((h) => (
                    <span key={h} className="absolute inset-y-0 w-px bg-line" style={{ left: pct(h * 60) }} aria-hidden />
                  ))}
                  {p.room.bookings
                    .filter((b) => b.end > FROM && b.start < TO)
                    .map((b) => (
                      <span
                        key={`${b.start}-${b.title}`}
                        title={`${formatTime(b.start)}–${formatTime(b.end)} · ${b.title === "Occupied" ? "Class or booking" : b.title}`}
                        className="booked absolute inset-y-1 rounded-md"
                        style={{ left: pct(b.start), width: `calc(${pct(b.end)} - ${pct(b.start)})` }}
                      />
                    ))}
                  {showNow && <span className="absolute -inset-y-0.5 w-0.5 rounded bg-brand" style={{ left: pct(minute) }} aria-hidden />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

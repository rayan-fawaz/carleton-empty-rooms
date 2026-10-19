import { SCHEDULE_END, SCHEDULE_START } from "@/lib/availability";
import { bookingLabel, byName, type Placed } from "@/lib/rooms";
import { formatHour, formatTime } from "@/lib/time";
import type { Minute } from "@/lib/types";
import { statusTone, toneBar } from "./Status";

const HOURS = Array.from({ length: (SCHEDULE_END - SCHEDULE_START) / 60 + 1 }, (_, i) => SCHEDULE_START / 60 + i);

/** Horizontal position of a minute within the schedule, as a CSS percentage. */
const at = (m: Minute) =>
  `${((Math.min(Math.max(m, SCHEDULE_START), SCHEDULE_END) - SCHEDULE_START) / (SCHEDULE_END - SCHEDULE_START)) * 100}%`;
const span = (from: Minute, to: Minute) => ({ left: at(from), width: `calc(${at(to)} - ${at(from)})` });

/** A building's whole day at a glance: one row per room, booked time shaded. */
export function Schedule({ list, minute, onOpen }: { list: Placed[]; minute: Minute; onOpen: (id: string) => void }) {
  const rows = [...list].sort(byName);
  const showNow = minute >= SCHEDULE_START && minute <= SCHEDULE_END;

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[720px] rounded-2xl bg-surface p-3 shadow-card">
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
              <span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{ left: at(h * 60) }}>
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
                  <span className={`h-2 w-2 rounded-full ${toneBar[statusTone(p)]}`} aria-hidden />
                  {p.room.name}
                </span>
                <span className="relative h-7">
                  {HOURS.map((h) => (
                    <span
                      key={h}
                      className="absolute inset-y-0 w-px bg-line"
                      style={{ left: at(h * 60) }}
                      aria-hidden
                    />
                  ))}
                  {p.room.bookings
                    .filter((b) => b.end > SCHEDULE_START && b.start < SCHEDULE_END)
                    .map((b, i) => (
                      <span
                        key={i}
                        title={`${formatTime(b.start)}–${formatTime(b.end)} · ${bookingLabel(b.title)}`}
                        className="booked absolute inset-y-1 rounded-md"
                        style={span(b.start, b.end)}
                      />
                    ))}
                  {showNow && (
                    <span
                      className="absolute -inset-y-0.5 w-0.5 rounded bg-brand"
                      style={{ left: at(minute) }}
                      aria-hidden
                    />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

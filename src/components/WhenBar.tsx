"use client";

import { CalendarDays, ChevronDown, Clock, SlidersHorizontal } from "lucide-react";
import { SCHEDULE_END, SCHEDULE_START } from "@/lib/availability";
import { bookableDays, DEFAULT_FUTURE_MINUTE, NEEDS, sameWhen, type ViewState, type When } from "@/lib/state";
import { dayLabel, formatDuration, formatTime, parseTime, toTimeInput } from "@/lib/time";
import type { Minute } from "@/lib/types";

/** Every half hour across the schedule window. */
const TIME_SLOTS = Array.from({ length: (SCHEDULE_END - SCHEDULE_START) / 30 }, (_, i) => SCHEDULE_START + i * 30);

const chip = (active: boolean) =>
  `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    active ? "bg-ink text-bg" : "bg-surface text-ink shadow-card hover:bg-surface-2"
  }`;

type Preset = { label: string; when: When; available: boolean };

function presetsFor(isToday: boolean, nowMinute: Minute): Preset[] {
  if (!isToday) {
    return [
      { label: "Morning", when: { kind: "at", minute: DEFAULT_FUTURE_MINUTE }, available: true },
      { label: "Midday", when: { kind: "at", minute: 12 * 60 }, available: true },
      { label: "Afternoon", when: { kind: "at", minute: 15 * 60 }, available: true },
      { label: "Evening", when: { kind: "at", minute: 18 * 60 }, available: true },
    ];
  }
  return [
    { label: "Now", when: { kind: "now" }, available: true },
    { label: "In 1 hour", when: { kind: "in", minutes: 60 }, available: nowMinute + 60 < SCHEDULE_END },
    { label: "In 2 hours", when: { kind: "in", minutes: 120 }, available: nowMinute + 120 < SCHEDULE_END },
    { label: "Tonight", when: { kind: "at", minute: 18 * 60 }, available: nowMinute < 18 * 60 },
  ];
}

export function WhenBar({
  state,
  today,
  nowMinute,
  filterCount,
  onChange,
  onOpenFilters,
}: {
  state: ViewState;
  today: string;
  nowMinute: Minute;
  filterCount: number;
  onChange: (patch: Partial<ViewState>) => void;
  onOpenFilters: () => void;
}) {
  const isToday = state.date === today;
  // Keep the active preset visible even once it's no longer offered, so something is always selected.
  const presets = presetsFor(isToday, nowMinute).filter((p) => p.available || sameWhen(p.when, state.when));
  const custom = !presets.some((p) => sameWhen(p.when, state.when));
  const customMinute = custom && state.when.kind === "at" ? state.when.minute : null;

  function pickDay(date: string) {
    onChange({ date, when: date === today ? { kind: "now" } : { kind: "at", minute: DEFAULT_FUTURE_MINUTE } });
  }

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <label className={`${chip(false)} relative pr-8`}>
          <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
          {dayLabel(state.date, today)}
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" aria-hidden />
          <select
            aria-label="Day"
            value={state.date}
            onChange={(e) => pickDay(e.target.value)}
            className="absolute inset-0 cursor-pointer text-base opacity-0"
          >
            {bookableDays(today).map((d) => (
              <option key={d} value={d}>
                {dayLabel(d, today)}
              </option>
            ))}
          </select>
        </label>

        <span className="h-6 w-px shrink-0 bg-line" aria-hidden />

        {presets.map((p) => {
          const active = sameWhen(p.when, state.when);
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ when: p.when })}
              className={chip(active)}
            >
              {p.when.kind === "now" && <span className="live-dot h-2 w-2 rounded-full bg-free" aria-hidden />}
              {p.label}
            </button>
          );
        })}

        <label className={`${chip(customMinute !== null)} relative pr-8`}>
          <Clock className="h-4 w-4" aria-hidden />
          {customMinute !== null ? formatTime(customMinute) : "Pick time"}
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" aria-hidden />
          <select
            aria-label="Time"
            value={customMinute !== null ? toTimeInput(customMinute) : ""}
            onChange={(e) => {
              const minute = parseTime(e.target.value);
              if (minute !== null) onChange({ when: { kind: "at", minute } });
            }}
            className="absolute inset-0 cursor-pointer text-base opacity-0"
          >
            <option value="" disabled>
              Pick a time
            </option>
            {TIME_SLOTS.map((m) => (
              <option key={m} value={toTimeInput(m)}>
                {formatTime(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-surface p-1 shadow-card sm:flex-none"
          role="group"
          aria-label="How long you need the room"
        >
          <span className="hidden pr-1 pl-2.5 text-[13px] font-medium whitespace-nowrap text-muted min-[400px]:inline">
            Need it for
          </span>
          {NEEDS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={state.need === n}
              onClick={() => onChange({ need: n })}
              className={`h-9 flex-1 rounded-full px-2 text-sm font-semibold whitespace-nowrap transition sm:w-16 sm:flex-none ${
                state.need === n ? "bg-brand text-brand-ink" : "text-ink hover:bg-surface-2"
              }`}
            >
              {n === 0 ? "Any" : `${formatDuration(n)}+`}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          className={chip(filterCount > 0)}
          aria-label={filterCount ? `Filters, ${filterCount} on` : "Filters"}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {filterCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] text-brand-ink">
              {filterCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

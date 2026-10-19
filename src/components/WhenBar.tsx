"use client";

import { CalendarDays, ChevronDown, Clock, SlidersHorizontal } from "lucide-react";
import { addDays, formatDate, formatTime, toTimeInput, parseTime } from "@/lib/time";
import type { Minute } from "@/lib/types";
import { NEEDS, type ViewState, type When } from "@/lib/view";

const TIME_SLOTS = Array.from({ length: 32 }, (_, i) => 7 * 60 + i * 30); // 7:00 AM – 10:30 PM

const chip = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    active ? "bg-ink text-bg" : "bg-surface text-ink shadow-card hover:bg-surface-2"
  }`;

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
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const sameWhen = (w: When) => JSON.stringify(w) === JSON.stringify(state.when);

  const presets: { label: string; when: When; hide?: boolean }[] = isToday
    ? [
        { label: "Now", when: { kind: "now" } },
        { label: "In 1 hour", when: { kind: "in", minutes: 60 }, hide: nowMinute >= 22 * 60 },
        { label: "In 2 hours", when: { kind: "in", minutes: 120 }, hide: nowMinute >= 21 * 60 },
        { label: "Tonight", when: { kind: "at", minute: 18 * 60 }, hide: nowMinute >= 18 * 60 },
      ]
    : [
        { label: "Morning", when: { kind: "at", minute: 9 * 60 } },
        { label: "Midday", when: { kind: "at", minute: 12 * 60 } },
        { label: "Afternoon", when: { kind: "at", minute: 15 * 60 } },
        { label: "Evening", when: { kind: "at", minute: 18 * 60 } },
      ];
  const visible = presets.filter((p) => !p.hide);
  const custom = !visible.some((p) => sameWhen(p.when));
  const customMinute = state.when.kind === "at" ? state.when.minute : null;

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <label className={`${chip(false)} relative pr-8`}>
          <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
          <span>{isToday ? "Today" : state.date === addDays(today, 1) ? "Tomorrow" : formatDate(state.date)}</span>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" aria-hidden />
          <select
            aria-label="Day"
            value={state.date}
            onChange={(e) => onChange({ date: e.target.value, when: e.target.value === today ? { kind: "now" } : { kind: "at", minute: 9 * 60 } })}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {days.map((d, i) => (
              <option key={d} value={d}>
                {i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDate(d)}
              </option>
            ))}
          </select>
        </label>

        <span className="h-6 w-px shrink-0 bg-line" aria-hidden />

        {visible.map((p) => (
          <button key={p.label} type="button" aria-pressed={sameWhen(p.when)} onClick={() => onChange({ when: p.when })} className={chip(sameWhen(p.when))}>
            {p.when.kind === "now" && <span className="live-dot h-2 w-2 rounded-full bg-free" aria-hidden />}
            {p.label}
          </button>
        ))}

        <label className={`${chip(custom)} relative pr-8`}>
          <Clock className="h-4 w-4" aria-hidden />
          <span>{custom && customMinute !== null ? formatTime(customMinute) : "Pick time"}</span>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" aria-hidden />
          <select
            aria-label="Time"
            value={custom && customMinute !== null ? toTimeInput(customMinute) : ""}
            onChange={(e) => {
              const m = parseTime(e.target.value);
              if (m !== null) onChange({ when: { kind: "at", minute: m } });
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
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

      <div className="flex items-center gap-2 sm:justify-start">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-surface p-1 shadow-card sm:flex-none" role="group" aria-label="How long you need the room">
          <span className="hidden pr-1 pl-2.5 text-[13px] font-medium whitespace-nowrap text-muted min-[400px]:inline">Need it for</span>
          {NEEDS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={state.need === n}
              onClick={() => onChange({ need: n })}
              className={`flex-1 rounded-full px-2 py-1.5 text-sm font-semibold whitespace-nowrap transition sm:w-16 sm:flex-none ${
                state.need === n ? "bg-brand text-brand-ink" : "text-ink hover:bg-surface-2"
              }`}
            >
              {n === 0 ? "Any" : `${n / 60}h+`}
            </button>
          ))}
        </div>
        <button type="button" onClick={onOpenFilters} className={`${chip(filterCount > 0)} py-2.5`} aria-label={`Filters${filterCount ? `, ${filterCount} on` : ""}`}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {filterCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] text-brand-ink">{filterCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}

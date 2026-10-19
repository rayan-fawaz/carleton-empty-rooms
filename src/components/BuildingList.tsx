"use client";

import { ChevronRight, MapPin } from "lucide-react";
import { useState } from "react";
import { type BuildingSummary, countRooms, shortBuildingName } from "@/lib/rooms";
import { ALL_BUILDINGS } from "@/lib/state";

/** The building directory: the main way into the app. */
export function BuildingList({
  summaries,
  selected,
  onSelect,
  totalFree,
  totalRooms,
}: {
  summaries: BuildingSummary[];
  selected: string | null;
  onSelect: (code: string) => void;
  totalFree: number;
  totalRooms: number;
}) {
  const [order, setOrder] = useState<"free" | "az">("free");
  const list = order === "az" ? [...summaries].sort((a, b) => a.name.localeCompare(b.name)) : summaries;

  return (
    <nav aria-label="Buildings">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Buildings</h2>
        <div
          className="flex rounded-full bg-surface-2 p-0.5 text-xs font-medium"
          role="group"
          aria-label="Sort buildings"
        >
          {(["free", "az"] as const).map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={order === o}
              onClick={() => setOrder(o)}
              className={`rounded-full px-2.5 py-1 transition ${order === o ? "bg-surface shadow-card" : "text-muted"}`}
            >
              {o === "free" ? "Most free" : "A–Z"}
            </button>
          ))}
        </div>
      </div>

      <ul className="overflow-hidden rounded-2xl bg-surface shadow-card">
        <Row
          active={selected === ALL_BUILDINGS}
          onClick={() => onSelect(ALL_BUILDINGS)}
          badge={<MapPin className="h-4 w-4" aria-hidden />}
          name="All buildings"
          free={totalFree}
          total={totalRooms}
        />
        {list.map((b) => (
          <Row
            key={b.code}
            active={selected === b.code}
            onClick={() => onSelect(b.code)}
            badge={<span className="text-[11px] font-bold">{b.code}</span>}
            name={b.name}
            free={b.free}
            total={b.total}
          />
        ))}
      </ul>
    </nav>
  );
}

function Row({
  active,
  onClick,
  badge,
  name,
  free,
  total,
}: {
  active: boolean;
  onClick: () => void;
  badge: React.ReactNode;
  name: string;
  free: number;
  total: number;
}) {
  return (
    <li className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
          active ? "bg-free-soft" : "hover:bg-surface-2"
        }`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink"}`}
        >
          {badge}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{shortBuildingName(name)}</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span
                className="block h-full rounded-full bg-free"
                style={{ width: `${total ? (free / total) * 100 : 0}%` }}
              />
            </span>
            <span className="text-xs whitespace-nowrap text-muted">{countRooms(total)}</span>
          </span>
        </span>
        <span className={`shrink-0 text-sm font-semibold tabular-nums ${free ? "text-free" : "text-muted"}`}>
          {free ? `${free} free` : "None free"}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );
}

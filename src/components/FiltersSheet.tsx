"use client";

import { Check, X } from "lucide-react";
import { countRooms, FEATURES, type FeatureKey, toggle } from "@/lib/rooms";
import type { ViewState } from "@/lib/state";

export function FiltersSheet({
  state,
  resultCount,
  onChange,
  onClose,
}: {
  state: ViewState;
  resultCount: number;
  onChange: (patch: Partial<ViewState>) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex max-h-[inherit] flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-lg font-bold">Filters</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="overflow-y-auto px-5 py-4">
        <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Room has</h3>
        <p className="mt-0.5 text-xs text-muted">
          Based on Carleton TLS room details. Rooms without details are hidden when these are on.
        </p>
        <ul className="mt-3 space-y-2">
          {(Object.keys(FEATURES) as FeatureKey[]).map((f) => (
            <li key={f}>
              <Toggle
                label={FEATURES[f].label}
                checked={state.features.includes(f)}
                onChange={() => onChange({ features: toggle(state.features, f) })}
              />
            </li>
          ))}
        </ul>

        <h3 className="mt-6 text-[13px] font-semibold tracking-wide text-muted uppercase">Other spaces</h3>
        <div className="mt-3">
          <Toggle
            label="Include lounges, lobbies & study desks"
            checked={state.all}
            onChange={() => onChange({ all: !state.all })}
          />
        </div>
      </div>

      <div className="flex gap-2 border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={() => onChange({ features: [], all: false })}
          className="rounded-xl px-4 py-3 text-sm font-semibold text-muted hover:bg-surface-2"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-bg transition hover:opacity-90"
        >
          Show {countRooms(resultCount)}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-[15px] font-medium transition ${
        checked ? "border-brand bg-free-soft" : "border-line hover:bg-surface-2"
      }`}
    >
      {label}
      <span
        className={`grid h-5 w-5 place-items-center rounded-md border transition ${
          checked ? "border-brand bg-brand text-brand-ink" : "border-line"
        }`}
        aria-hidden
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

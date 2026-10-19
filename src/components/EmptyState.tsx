import { SearchX } from "lucide-react";

export type EmptyReason = "search" | "duration" | "booked" | "filtered" | "unknown-building";

const COPY: Record<EmptyReason, { title: string; hint: string; action: string | null }> = {
  search: {
    title: "No rooms match that search",
    hint: "Try a building name or a room number like “TB 2”.",
    action: "Clear search",
  },
  duration: {
    title: "No rooms free for that long",
    hint: "Try a shorter time, another building, or a different time of day.",
    action: "Show any free room",
  },
  booked: {
    title: "Every room here is booked",
    hint: "Try another building or a different time of day.",
    action: null,
  },
  filtered: {
    title: "No rooms here match your filters",
    hint: "This building has rooms, but your filters hide all of them.",
    action: "Show all rooms here",
  },
  "unknown-building": {
    title: "We couldn't find that building",
    hint: "The link may be out of date.",
    action: "See all buildings",
  },
};

export function EmptyState({ reason, onAction }: { reason: EmptyReason; onAction: () => void }) {
  const { title, hint, action } = COPY[reason];
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <SearchX className="h-8 w-8 text-muted" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg"
        >
          {action}
        </button>
      )}
    </div>
  );
}

import { SearchX } from "lucide-react";

const COPY = {
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
  none: {
    title: "Every room here is booked",
    hint: "Try another building or a different time of day.",
    action: null,
  },
} as const;

export function EmptyState({ reason, onReset }: { reason: keyof typeof COPY; onReset: () => void }) {
  const { title, hint, action } = COPY[reason];
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <SearchX className="h-8 w-8 text-muted" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {action && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg"
        >
          {action}
        </button>
      )}
    </div>
  );
}

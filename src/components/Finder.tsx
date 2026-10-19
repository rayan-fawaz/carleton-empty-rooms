"use client";

import { ArrowLeft, LayoutList, Search, SearchX, Star, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { useFavourites } from "@/hooks/use-favourites";
import { useNowMinute } from "@/hooks/use-now";
import { addDays, formatDate, formatDuration, formatTime } from "@/lib/time";
import type { Minute } from "@/lib/types";
import {
  baseFilter,
  type FinderRoom,
  matchesSearch,
  place,
  queryFor,
  readViewState,
  resolveMinute,
  sortPlaced,
  summarizeBuildings,
  type ViewState,
} from "@/lib/view";
import { ALL, BuildingList } from "./BuildingList";
import { FiltersSheet } from "./FiltersSheet";
import { RoomCard } from "./RoomCard";
import { RoomSheet } from "./RoomSheet";
import { Schedule } from "./Schedule";
import { Sheet } from "./Sheet";
import { WhenBar } from "./WhenBar";

export function Finder({
  rooms,
  today,
  serverMinute,
  fetchedAt,
}: {
  rooms: FinderRoom[];
  today: string;
  serverMinute: Minute;
  fetchedAt: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const state = useMemo(() => readViewState(Object.fromEntries(params), today), [params, today]);
  const isToday = state.date === today;
  const nowMinute = useNowMinute(serverMinute, isToday && state.when.kind !== "at");
  const minute = resolveMinute(state.when, nowMinute);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loadingDay, startDayChange] = useTransition();
  // Whether we added the current history entry, so "close"/"back" can pop it instead of stacking more.
  const pushedRoom = useRef(false);
  const pushedBuilding = useRef(false);
  const { favourites, toggle: toggleFavourite } = useFavourites();

  /** Same-day changes are instant (URL only); a new day fetches that day's bookings from the server. */
  function update(patch: Partial<ViewState>, mode: "push" | "replace" = "replace") {
    const next = { ...state, ...patch };
    const url = `/${queryFor(next, today)}`;
    if (next.date !== state.date) {
      startDayChange(() => router.push(url, { scroll: false }));
    } else if (mode === "push") {
      window.history.pushState(null, "", url);
    } else {
      window.history.replaceState(null, "", url);
    }
  }

  const base = useMemo(() => baseFilter(rooms, state), [rooms, state]);
  const placed = useMemo(() => place(base, minute, state.need), [base, minute, state.need]);
  const summaries = useMemo(() => summarizeBuildings(placed), [placed]);
  const totalFree = placed.filter((p) => p.usable).length;

  const building = state.building && state.building !== ALL ? state.building : null;
  const buildingName = building ? (rooms.find((r) => r.building === building)?.buildingName ?? building) : null;
  const scoped = building ? placed.filter((p) => p.room.building === building) : placed;
  const searched = query ? scoped.filter((p) => matchesSearch(p.room, query)) : scoped;
  const sorted = sortPlaced(searched);
  const usable = sorted.filter((p) => p.usable);
  const others = sorted.filter((p) => !p.usable);
  const saved = sortPlaced(placed.filter((p) => favourites.includes(p.room.id)));
  const openRoom = state.room ? placed.find((p) => p.room.id === state.room) ?? null : null;

  // Phones start on the building directory; desktops always show it in the sidebar.
  const home = !state.building && !query;
  const filterCount = state.features.length + (state.all ? 1 : 0);
  const dayLabel = isToday ? "Today" : state.date === addDays(today, 1) ? "Tomorrow" : formatDate(state.date);
  const whenLabel =
    state.when.kind === "now" && isToday
      ? "right now"
      : state.when.kind === "in"
        ? `in ${state.when.minutes / 60} hour${state.when.minutes > 60 ? "s" : ""}`
        : `${isToday ? "" : `${dayLabel.replace(/^Tomorrow$/, "tomorrow")} `}at ${formatTime(minute)}`;
  const needLabel = state.need ? ` for ${formatDuration(state.need)}+` : "";

  const selectBuilding = (code: string) => {
    setQuery("");
    pushedBuilding.current = !state.building;
    update({ building: code, view: "list" }, state.building ? "replace" : "push");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const open = (id: string) => {
    pushedRoom.current = true;
    update({ room: id }, "push");
  };
  const closeRoom = () => {
    if (pushedRoom.current) {
      pushedRoom.current = false;
      window.history.back();
    } else {
      update({ room: null });
    }
  };

  const cards = (list: typeof sorted, offset = 0) => (
    <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {list.map((p, i) => (
        <RoomCard
          key={p.room.id}
          placed={p}
          index={i + offset}
          starred={favourites.includes(p.room.id)}
          onOpen={() => open(p.room.id)}
          onStar={() => toggleFavourite(p.room.id)}
          showBuilding={!building}
        />
      ))}
    </ul>
  );

  return (
    <div className={`transition-opacity ${loadingDay ? "pointer-events-none opacity-50" : ""}`} aria-busy={loadingDay}>
      {/* Search + when */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={building ? `Search ${buildingName}…` : "Search a room or building, e.g. “SA 5” or “Loeb”"}
            aria-label="Search rooms"
            className="w-full rounded-2xl bg-surface py-3.5 pr-11 pl-12 text-base shadow-card outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <WhenBar
          state={state}
          today={today}
          nowMinute={nowMinute}
          filterCount={filterCount}
          onChange={(patch) => update(patch)}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[19rem_1fr] lg:items-start lg:gap-8">
        {/* Building directory: phone home screen, desktop sidebar */}
        <aside className={`${home ? "" : "hidden"} lg:sticky lg:top-4 lg:block`}>
          {saved.length > 0 && (
            <section className="mb-6 lg:hidden">
              <SavedRooms saved={saved} onOpen={open} />
            </section>
          )}
          <p className="mb-4 px-1 text-[15px] lg:hidden">
            <b className="text-free">{totalFree} rooms</b> free {whenLabel}
            {needLabel}. Pick a building:
          </p>
          <BuildingList
            summaries={summaries}
            selected={state.building ?? (home ? null : ALL)}
            onSelect={selectBuilding}
            totalFree={totalFree}
            totalRooms={placed.length}
          />
        </aside>

        {/* Results */}
        <main className={home ? "hidden lg:block" : ""}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {state.building && (
                <button
                  type="button"
                  onClick={() => {
                    if (pushedBuilding.current) {
                      pushedBuilding.current = false;
                      window.history.back();
                    } else update({ building: null });
                  }}
                  className="-ml-1 mb-1 inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-sm font-semibold text-muted hover:text-ink lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" /> All buildings
                </button>
              )}
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                {query ? `Results for “${query}”` : (buildingName ?? "All buildings")}
              </h1>
              <p className="mt-1 text-sm text-muted">
                <b className="text-free">{usable.length}</b> of {searched.length} rooms free {whenLabel}
                {needLabel}
              </p>
            </div>
            {building && !query && (
              <div className="flex shrink-0 rounded-full bg-surface p-1 text-sm font-semibold shadow-card" role="group" aria-label="View">
                {(["list", "schedule"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={state.view === v}
                    onClick={() => update({ view: v })}
                    className={`rounded-full px-3 py-1.5 transition ${state.view === v ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                  >
                    {v === "list" ? "Rooms" : "Schedule"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!state.building && !query && saved.length > 0 && (
            <section className="mb-8 hidden lg:block">
              <SavedRooms saved={saved} onOpen={open} />
            </section>
          )}

          {building && state.view === "schedule" && !query ? (
            <Schedule list={scoped} minute={minute} onOpen={open} />
          ) : (
            <>
              {usable.length > 0 ? (
                cards(usable)
              ) : (
                <Empty query={query} need={state.need} onClear={() => (query ? setQuery("") : update({ need: 0 }))} />
              )}
              {others.length > 0 && (
                <details className="group mt-8" open={building !== null || usable.length === 0}>
                  <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
                    <LayoutList className="h-4 w-4" aria-hidden />
                    Not available {whenLabel}
                    {needLabel} · {others.length}
                    <span className="ml-auto text-xs normal-case group-open:hidden">Show</span>
                  </summary>
                  {cards(others, usable.length)}
                </details>
              )}
            </>
          )}
        </main>
      </div>

      <p className="mt-10 text-center text-xs text-muted">
        Bookings checked {new Date(fetchedAt).toLocaleTimeString("en-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" })}
      </p>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} label="Filters">
        <FiltersSheet state={state} resultCount={usable.length} onChange={(p) => update(p)} onClose={() => setFiltersOpen(false)} />
      </Sheet>
      <Sheet open={!!openRoom} onClose={closeRoom} label={openRoom ? `${openRoom.room.name} details` : "Room details"}>
        {openRoom && (
          <RoomSheet
            placed={openRoom}
            minute={minute}
            dayLabel={dayLabel}
            starred={favourites.includes(openRoom.room.id)}
            onStar={() => toggleFavourite(openRoom.room.id)}
            onClose={closeRoom}
          />
        )}
      </Sheet>
    </div>
  );
}

function SavedRooms({ saved, onOpen }: { saved: ReturnType<typeof sortPlaced>; onOpen: (id: string) => void }) {
  return (
    <>
      <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden /> Your saved rooms
      </h2>
      <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {saved.map((p) => (
          <li key={p.room.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(p.room.id)}
              className="flex items-center gap-2.5 rounded-2xl bg-surface py-2 pr-3.5 pl-2 text-left shadow-card hover:bg-surface-2"
            >
              <span className={`h-8 w-1 rounded-full ${p.usable ? "bg-free" : p.status.free ? "bg-short" : "bg-busy"}`} aria-hidden />
              <span>
                <span className="block text-sm font-bold">{p.room.name}</span>
                <span className="block text-xs text-muted">
                  {p.status.free ? (p.status.nextTitle ? `Free until ${formatTime(p.status.until)}` : "Free rest of day") : `In use until ${formatTime(p.status.until)}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Empty({ query, need, onClear }: { query: string; need: number; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <SearchX className="h-8 w-8 text-muted" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-lg font-semibold">{query ? "No rooms match that search" : "No rooms free for that long"}</p>
      <p className="mt-1 text-sm text-muted">
        {query ? "Try a building name or a room number like “TB 2”." : "Try a shorter time, a different building, or later today."}
      </p>
      {(query || need > 0) && (
        <button type="button" onClick={onClear} className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
          {query ? "Clear search" : "Show any free room"}
        </button>
      )}
    </div>
  );
}

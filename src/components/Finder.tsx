"use client";

import { ArrowLeft, LayoutList, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { useFavourites } from "@/hooks/use-favourites";
import { useNowMinute } from "@/hooks/use-now";
import {
  countRooms,
  filterRooms,
  matchesSearch,
  place,
  type Placed,
  shortBuildingName,
  sortPlaced,
  summarizeBuildings,
} from "@/lib/rooms";
import { ALL_BUILDINGS, describeWhen, queryFor, readViewState, resolveMinute, type ViewState } from "@/lib/state";
import { dayLabel, formatClock, formatDuration } from "@/lib/time";
import type { DayRoom, Minute } from "@/lib/types";
import { BuildingList } from "./BuildingList";
import { EmptyState, type EmptyReason } from "./EmptyState";
import { FiltersSheet } from "./FiltersSheet";
import { RoomCard } from "./RoomCard";
import { RoomSheet } from "./RoomSheet";
import { SavedRooms } from "./SavedRooms";
import { Schedule } from "./Schedule";
import { Sheet } from "./Sheet";
import { WhenBar } from "./WhenBar";

export function Finder({
  rooms,
  today,
  serverMinute,
  fetchedAt,
}: {
  rooms: DayRoom[];
  today: string;
  serverMinute: Minute;
  fetchedAt: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const state = useMemo(() => readViewState(Object.fromEntries(params), today), [params, today]);
  const nowMinute = useNowMinute(serverMinute, today);
  const minute = resolveMinute(state.when, nowMinute);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loadingDay, startDayChange] = useTransition();
  const { favourites, toggle: toggleFavourite } = useFavourites();
  // Whether we pushed the current history entry, so closing can pop it instead of stacking another.
  const pushedRoom = useRef(false);
  const pushedBuilding = useRef(false);

  /** Changes within a day only touch the URL; switching days loads that day's bookings from the server. */
  function update(patch: Partial<ViewState>, mode: "push" | "replace" = "replace") {
    const next = { ...state, ...patch };
    const url = `/${queryFor(next, today)}`;
    if (next.date !== state.date) {
      // A day change is its own history entry, so "back" must no longer undo our earlier pushes.
      pushedRoom.current = pushedBuilding.current = false;
      startDayChange(() => router.push(url, { scroll: false }));
    } else if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  const placed = useMemo(() => place(filterRooms(rooms, state), minute, state.need), [rooms, state, minute]);
  const summaries = useMemo(() => summarizeBuildings(placed), [placed]);
  const totalFree = placed.filter((p) => p.usable).length;

  const building = state.building !== ALL_BUILDINGS ? state.building : null;
  const buildingName =
    building && shortBuildingName(rooms.find((r) => r.building === building)?.buildingName ?? building);
  const scoped = building ? placed.filter((p) => p.room.building === building) : placed;
  const searched = sortPlaced(query ? scoped.filter((p) => matchesSearch(p.room, query)) : scoped);
  const usable = searched.filter((p) => p.usable);
  const emptyReason: EmptyReason = query
    ? "search"
    : building && !rooms.some((r) => r.building === building)
      ? "unknown-building"
      : scoped.length === 0
        ? "filtered"
        : state.need
          ? "duration"
          : "booked";
  const others = searched.filter((p) => !p.usable);
  const saved = sortPlaced(
    place(
      rooms.filter((r) => favourites.includes(r.id)),
      minute,
      state.need,
    ),
  );
  // Look the open room up among all rooms so shared links work whatever the viewer's filters are.
  const openRoom = useMemo(() => {
    const room = rooms.find((r) => r.id === state.room);
    return room ? place([room], minute, state.need)[0] : null;
  }, [rooms, state.room, minute, state.need]);

  // Phones start on the building directory; larger screens always show it in the sidebar.
  const home = !state.building && !query;
  const filterCount = state.features.length + (state.all ? 1 : 0);
  const moment = describeWhen(state, minute, today) + (state.need ? ` for ${formatDuration(state.need)}+` : "");

  function selectBuilding(code: string) {
    setQuery("");
    pushedBuilding.current = !state.building;
    update({ building: code, view: "list" }, state.building ? "replace" : "push");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToBuildings() {
    if (pushedBuilding.current) {
      pushedBuilding.current = false;
      window.history.back();
    } else {
      update({ building: null });
    }
  }

  function openDetails(id: string) {
    pushedRoom.current = true;
    update({ room: id }, "push");
  }

  function closeDetails() {
    if (pushedRoom.current) {
      pushedRoom.current = false;
      window.history.back();
    } else {
      update({ room: null });
    }
  }

  const cards = (list: Placed[], offset = 0) => (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {list.map((p, i) => (
        <RoomCard
          key={p.room.id}
          placed={p}
          index={i + offset}
          starred={favourites.includes(p.room.id)}
          showBuilding={!building}
          onOpen={() => openDetails(p.room.id)}
          onStar={() => toggleFavourite(p.room.id)}
        />
      ))}
    </ul>
  );

  return (
    <div className={`transition-opacity ${loadingDay ? "pointer-events-none opacity-50" : ""}`} aria-busy={loadingDay}>
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            placeholder={buildingName ? `Search ${buildingName}…` : "Search rooms or buildings"}
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
          onChange={update}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[19rem_1fr] lg:items-start lg:gap-8">
        <aside
          className={`${home ? "" : "hidden"} lg:sticky lg:top-4 lg:-m-2 lg:block lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:p-2`}
        >
          {saved.length > 0 && (
            <section className="mb-6 lg:hidden">
              <SavedRooms saved={saved} onOpen={openDetails} />
            </section>
          )}
          <p className="mb-4 px-1 text-[15px] lg:hidden">
            <b className="text-free">{countRooms(totalFree)}</b> free {moment}. Pick a building:
          </p>
          <BuildingList
            summaries={summaries}
            selected={state.building ?? (home ? null : ALL_BUILDINGS)}
            totalFree={totalFree}
            totalRooms={placed.length}
            onSelect={selectBuilding}
          />
        </aside>

        <main className={home ? "hidden lg:block" : ""}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {state.building && (
                <button
                  type="button"
                  onClick={backToBuildings}
                  className="-ml-2 inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted hover:text-ink lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" /> All buildings
                </button>
              )}
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                {query ? `Results for “${query}”` : (buildingName ?? "All buildings")}
              </h1>
              <p className="mt-1 text-sm text-muted">
                <b className="text-free">{usable.length}</b> of {countRooms(searched.length)} free {moment}
              </p>
            </div>
            {building && !query && scoped.length > 0 && (
              <div
                className="flex shrink-0 rounded-full bg-surface p-1 text-sm font-semibold shadow-card"
                role="group"
                aria-label="View"
              >
                {(["list", "schedule"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={state.view === v}
                    onClick={() => update({ view: v })}
                    className={`h-9 rounded-full px-3 transition ${state.view === v ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
                  >
                    {v === "list" ? "Rooms" : "Schedule"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {home && saved.length > 0 && (
            <section className="mb-8 hidden lg:block">
              <SavedRooms saved={saved} onOpen={openDetails} />
            </section>
          )}

          {building && !query && state.view === "schedule" ? (
            <Schedule list={scoped} minute={minute} onOpen={openDetails} />
          ) : (
            <>
              {usable.length > 0 ? (
                cards(usable)
              ) : (
                <EmptyState
                  reason={emptyReason}
                  onAction={() => {
                    if (emptyReason === "search") setQuery("");
                    else if (emptyReason === "duration") update({ need: 0 });
                    else if (emptyReason === "filtered") update({ features: [], all: true });
                    else backToBuildings();
                  }}
                />
              )}
              {others.length > 0 && (
                <details className="group mt-8" open={building !== null || usable.length === 0}>
                  <summary className="mb-3 flex cursor-pointer items-center gap-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
                    <LayoutList className="h-4 w-4" aria-hidden />
                    Not free {moment} · {others.length}
                    <span className="ml-auto text-xs normal-case group-open:hidden">Show</span>
                  </summary>
                  {cards(others, usable.length)}
                </details>
              )}
            </>
          )}
        </main>
      </div>

      <p className="mt-10 text-center text-xs text-muted">Bookings checked at {formatClock(fetchedAt)}</p>

      <Sheet open={filtersOpen} label="Filters" onClose={() => setFiltersOpen(false)}>
        <FiltersSheet
          state={state}
          resultCount={usable.length}
          onChange={update}
          onClose={() => setFiltersOpen(false)}
        />
      </Sheet>
      <Sheet open={openRoom !== null} label={`${openRoom?.room.name ?? "Room"} details`} onClose={closeDetails}>
        {openRoom && (
          <RoomSheet
            placed={openRoom}
            minute={minute}
            dayLabel={dayLabel(state.date, today)}
            starred={favourites.includes(openRoom.room.id)}
            onStar={() => toggleFavourite(openRoom.room.id)}
            onClose={closeDetails}
          />
        )}
      </Sheet>
    </div>
  );
}

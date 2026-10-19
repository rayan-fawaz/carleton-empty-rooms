"use client";

import { Check, ExternalLink, Share2, Star, Users, X } from "lucide-react";
import { useState } from "react";
import { daySegments } from "@/lib/availability";
import { formatDuration, formatTime } from "@/lib/time";
import type { Minute } from "@/lib/types";
import type { Placed } from "@/lib/view";
import { RoomPhoto } from "./RoomPhoto";
import { StatusBadge } from "./Status";

const DAY_FROM = 7 * 60;
const DAY_TO = 23 * 60;

export function RoomSheet({
  placed,
  minute,
  dayLabel,
  starred,
  onStar,
  onClose,
}: {
  placed: Placed;
  minute: Minute;
  dayLabel: string;
  starred: boolean;
  onStar: () => void;
  onClose: () => void;
}) {
  const { room } = placed;
  const info = room.info;
  const [copied, setCopied] = useState(false);
  const [allTags, setAllTags] = useState(false);
  const segments = daySegments(room.bookings, DAY_FROM, DAY_TO);
  const tags = info ? [...new Set([...info.types, ...info.equipment, ...info.accessibility])] : [];

  async function share() {
    const url = window.location.href;
    const title = `${room.name} · ${room.buildingName}`;
    try {
      if (navigator.share) return await navigator.share({ title, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Share sheet dismissed or clipboard blocked; nothing to do.
    }
  }

  return (
    <div className="flex max-h-[inherit] flex-col">
      <div className="relative shrink-0">
        <RoomPhoto room={room} size="large" priority className="aspect-[16/10] w-full sm:aspect-[4/3]" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          autoFocus
          className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/70"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/70 sm:hidden" aria-hidden />
      </div>

      <div className="overflow-y-auto overscroll-contain px-5 pt-4 pb-6">
        <h2 className="text-2xl font-bold tracking-tight">{room.name}</h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>{room.buildingName}</span>
          {info?.capacity ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden /> {info.capacity} seats
              </span>
            </>
          ) : null}
        </p>

        <div className="mt-3">
          <StatusBadge placed={placed} size="lg" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <ActionButton onClick={onStar} active={starred}>
            <Star className={`h-4 w-4 ${starred ? "fill-amber-400 text-amber-500" : ""}`} />
            {starred ? "Saved" : "Save"}
          </ActionButton>
          <ActionButton onClick={share}>
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? "Copied" : "Share"}
          </ActionButton>
          {info ? (
            <a
              href={info.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-semibold transition hover:bg-line"
            >
              <ExternalLink className="h-4 w-4" /> Photos
            </a>
          ) : (
            <span />
          )}
        </div>

        <section className="mt-6">
          <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{dayLabel}&apos;s schedule</h3>
          <ol className="mt-2 overflow-hidden rounded-2xl border border-line">
            {segments.map((s) => {
              const current = s.start <= minute && minute < s.end;
              return (
                <li
                  key={s.start}
                  className={`flex items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-0 ${
                    current ? (s.free ? "bg-free-soft" : "bg-busy-soft") : ""
                  }`}
                >
                  <span className={`h-8 w-1 shrink-0 rounded-full ${s.free ? "bg-free" : "booked"}`} aria-hidden />
                  <span className="tabular w-36 shrink-0 text-sm">
                    {formatTime(s.start)} – {formatTime(s.end)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    {s.free ? (
                      <span className="font-semibold text-free">Free · {formatDuration(s.end - s.start)}</span>
                    ) : (
                      <span className="block truncate text-muted">{s.title === "Occupied" ? "Class or booking" : s.title}</span>
                    )}
                  </span>
                  {current && <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-bg">Now</span>}
                </li>
              );
            })}
          </ol>
        </section>

        {tags.length > 0 && (
          <section className="mt-6">
            <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">In this room</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {(allTags ? tags : tags.slice(0, 8)).map((t) => (
                <li key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                  {t}
                </li>
              ))}
              {!allTags && tags.length > 8 && (
                <li>
                  <button
                    type="button"
                    onClick={() => setAllTags(true)}
                    className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold hover:bg-surface-2"
                  >
                    +{tags.length - 8} more
                  </button>
                </li>
              )}
            </ul>
          </section>
        )}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          &ldquo;Free&rdquo; means nothing is booked in Carleton&apos;s system. The door may still be locked, and bookings can
          change.
        </p>
      </div>
    </div>
  );
}

function ActionButton({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-semibold transition hover:bg-line"
    >
      {children}
    </button>
  );
}

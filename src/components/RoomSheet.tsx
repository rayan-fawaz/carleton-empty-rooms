"use client";

import { Check, ExternalLink, Share2, Star, Users, X } from "lucide-react";
import { useState } from "react";
import { daySegments, SCHEDULE_END, SCHEDULE_START } from "@/lib/availability";
import { bookingLabel, type Placed, shortBuildingName } from "@/lib/rooms";
import { formatDuration, formatTime } from "@/lib/time";
import type { Minute } from "@/lib/types";
import { RoomPhoto } from "./RoomPhoto";
import { StatusBadge } from "./Status";

const VISIBLE_TAGS = 8;

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
  const { info } = room;
  const [copied, setCopied] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const segments = daySegments(room.bookings, SCHEDULE_START, SCHEDULE_END);
  const tags = info ? [...new Set([...info.types, ...info.equipment, ...info.accessibility])] : [];

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${room.name} · ${shortBuildingName(room.buildingName)}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // The share sheet was dismissed or the clipboard is blocked; nothing to do.
    }
  }

  return (
    <div>
      {/* Zero-height sticky layer: the close button stays in reach while the photo scrolls away. */}
      <div className="sticky top-0 z-10 h-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          autoFocus
          className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/70"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative">
        <RoomPhoto room={room} size="large" eager className="aspect-[16/10] w-full sm:aspect-[4/3]" />
        <div
          className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/70 sm:hidden"
          aria-hidden
        />
      </div>

      <div className="px-5 pt-4 pb-6">
        <h2 className="text-2xl font-bold tracking-tight">{room.name}</h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>{shortBuildingName(room.buildingName)}</span>
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
          <ActionButton onClick={onStar} pressed={starred}>
            <Star className={`h-4 w-4 ${starred ? "fill-amber-400 text-amber-500" : ""}`} />
            {starred ? "Saved" : "Save"}
          </ActionButton>
          <ActionButton onClick={share}>
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? "Copied" : "Share"}
          </ActionButton>
          {info && (
            <a href={info.url} target="_blank" rel="noreferrer" className={ACTION}>
              <ExternalLink className="h-4 w-4" /> Photos
            </a>
          )}
        </div>

        <section className="mt-6">
          <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Schedule · {dayLabel}</h3>
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
                  <span className="w-36 shrink-0 text-sm tabular-nums">
                    {formatTime(s.start)} – {formatTime(s.end)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {s.free ? (
                      <span className="font-semibold text-free">Free · {formatDuration(s.end - s.start)}</span>
                    ) : (
                      <span className="text-muted">{bookingLabel(s.title)}</span>
                    )}
                  </span>
                  {current && (
                    <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-bg">
                      Now
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {tags.length > 0 && (
          <section className="mt-6">
            <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">In this room</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {(showAllTags ? tags : tags.slice(0, VISIBLE_TAGS)).map((t) => (
                <li key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                  {t}
                </li>
              ))}
              {!showAllTags && tags.length > VISIBLE_TAGS && (
                <li>
                  <button
                    type="button"
                    onClick={() => setShowAllTags(true)}
                    className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold hover:bg-surface-2"
                  >
                    +{tags.length - VISIBLE_TAGS} more
                  </button>
                </li>
              )}
            </ul>
          </section>
        )}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          &ldquo;Free&rdquo; means nothing is booked in Carleton&apos;s system. The door may still be locked, and
          bookings can change.
        </p>
      </div>
    </div>
  );
}

const ACTION =
  "flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-semibold transition hover:bg-line";

function ActionButton({
  onClick,
  pressed,
  children,
}: {
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={ACTION}>
      {children}
    </button>
  );
}

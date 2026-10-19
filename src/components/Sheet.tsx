"use client";

import { useEffect, useRef } from "react";

/** How far a sheet must be dragged down before letting go closes it. */
const DISMISS_DISTANCE = 110;

/**
 * A native <dialog>: a bottom sheet on phones and a centred card on larger screens.
 * `open` drives it; Esc, a backdrop tap, or dragging it down from the top ask the owner to close via `onClose`.
 */
export function Sheet({
  open,
  label,
  onClose,
  children,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ startY: number; offset: number } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.style.transform = "";
      dialog.showModal();
      dialog.scrollTop = 0;
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function onTouchStart(e: React.TouchEvent<HTMLDialogElement>) {
    // Only a drag that starts with the sheet scrolled to the top can pull it down.
    drag.current = e.currentTarget.scrollTop <= 0 ? { startY: e.touches[0].clientY, offset: 0 } : null;
    e.currentTarget.style.transition = "";
  }

  function onTouchMove(e: React.TouchEvent<HTMLDialogElement>) {
    const d = drag.current;
    if (!d) return;
    d.offset = Math.max(0, e.touches[0].clientY - d.startY);
    e.currentTarget.style.transform = d.offset ? `translateY(${d.offset}px)` : "";
  }

  function onTouchEnd(e: React.TouchEvent<HTMLDialogElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d?.offset) return;
    if (d.offset > DISMISS_DISTANCE) {
      onClose();
    } else {
      e.currentTarget.style.transition = "transform 0.2s ease-out";
      e.currentTarget.style.transform = "";
    }
  }

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {open && children}
    </dialog>
  );
}

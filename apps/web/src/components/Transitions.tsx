"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Delayed-unmount helper for exit transitions.
 *
 * While `open` is true renders normally. When it flips to false, keeps
 * `mounted` for `ms` more with `closing: true` so the *-out animation can
 * play, then unmounts. Durations must match the trell-*-out CSS animations.
 *
 * Usage:
 *   const t = useMounted(open, 150);
 *   ...
 *   {t.mounted && <div className={t.closing ? "trell-pop-out" : "trell-pop-in"}>…</div>}
 */
export function useMounted(
  open: boolean,
  ms = 150,
): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      if (timer.current) window.clearTimeout(timer.current);
      setMounted(true);
      setClosing(false);
      return;
    }
    if (mounted) {
      setClosing(true);
      timer.current = window.setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, ms);
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ms]);

  return { mounted, closing };
}

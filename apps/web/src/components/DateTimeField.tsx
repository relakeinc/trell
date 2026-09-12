"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useMounted } from "@/components/Transitions";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function pad(n: number): string {
  return n < 10 ? "0" + n : "" + n;
}

/** "YYYY-MM-DDTHH:mm" (datetime-local format, local time). */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalInput(v: string): Date | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pretty(v: string): string {
  const d = parseLocalInput(v);
  if (!d) return "Select date…";
  const date = d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

export function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const t = useMounted(open, 150);
  const ref = useRef<HTMLDivElement>(null);

  const current = parseLocalInput(value) ?? new Date();
  const [viewYear, setViewYear] = useState(current.getFullYear());
  const [viewMonth, setViewMonth] = useState(current.getMonth());

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Sync the visible month when opened with a value from elsewhere.
  useEffect(() => {
    if (open) {
      const d = parseLocalInput(value);
      if (d) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(d);
    return out;
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function pickDay(day: number) {
    const d = parseLocalInput(value) ?? new Date();
    d.setFullYear(viewYear, viewMonth, day);
    onChange(toLocalInput(d));
  }

  function shiftMonth(dir: -1 | 1) {
    const d = new Date(viewYear, viewMonth + dir, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function setTime(part: "h" | "m", v: number) {
    const d = parseLocalInput(value) ?? new Date();
    if (part === "h") d.setHours(v);
    else d.setMinutes(v);
    onChange(toLocalInput(d));
  }

  const selDay = current.getFullYear() === viewYear && current.getMonth() === viewMonth ? current.getDate() : null;
  const today = new Date();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-xs transition-colors ${
          open ? "border-neutral-400" : "border-trell-line hover:border-neutral-300"
        }`}
      >
        <span className="truncate text-trell-ink">{pretty(value)}</span>
        <Icon name="calendar-2" size={15} className="shrink-0 text-neutral-400" />
      </button>

      {t.mounted && (
        <div
          className={`absolute inset-x-0 z-30 mt-1 rounded-xl border border-trell-line bg-white p-3 shadow-xl sm:left-auto sm:w-72 ${t.closing ? "trell-pop-out" : "trell-pop-in"}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100 hover:text-trell-ink"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-xs font-semibold capitalize text-trell-ink">{monthLabel}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-100 hover:text-trell-ink"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-neutral-400">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-0.5">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day == null) return <span key={`b-${i}`} />;
              const isSel = day === selDay;
              const isToday =
                day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={`flex h-8 items-center justify-center rounded-lg text-xs tabular-nums transition-colors ${
                    isSel ? "bg-black font-semibold text-white" : "text-neutral-700 hover:bg-neutral-100"
                  } ${!isSel && isToday ? "ring-1 ring-inset ring-neutral-300" : ""}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-1.5 border-t border-trell-line pt-3">
            <span className="shrink-0 text-[11px] text-neutral-500">Time</span>
            <MiniSelect
              value={pad(current.getHours())}
              options={Array.from({ length: 24 }, (_, h) => pad(h))}
              onChange={(v) => setTime("h", Number(v))}
              ariaLabel="Hour"
            />
            <span className="shrink-0 text-neutral-400">:</span>
            <MiniSelect
              value={pad(current.getMinutes())}
              options={Array.from({ length: 60 }, (_, m) => pad(m))}
              onChange={(v) => setTime("m", Number(v))}
              ariaLabel="Minute"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="trell-btn-accent h-8 min-w-0 flex-1 px-3 text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact custom dropdown (hour/minute) — the native select popup can't be styled. */
function MiniSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useMounted(open, 150);
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  return (
    <div ref={ref} className="relative w-[68px] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`flex h-8 w-full items-center justify-between gap-1 rounded-lg border bg-white px-2 text-xs tabular-nums transition-colors ${
          open ? "border-neutral-400" : "border-trell-line hover:border-neutral-300"
        }`}
      >
        <span className="text-trell-ink">{value}</span>
        <Icon
          name="arrow-down-01"
          size={12}
          className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {t.mounted && (
        <div
          className={`absolute inset-x-0 bottom-full z-40 mb-1 max-h-44 overflow-auto rounded-xl border border-trell-line bg-white py-1 shadow-xl ${t.closing ? "trell-pop-up-out" : "trell-pop-up-in"}`}
        >
          {options.map((opt) => (
            <button
              key={opt}
              ref={opt === value ? activeRef : undefined}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`block w-full px-2 py-1.5 text-center text-xs tabular-nums transition-colors hover:bg-neutral-100 ${
                opt === value ? "bg-neutral-50 font-semibold text-trell-ink" : "text-neutral-600"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

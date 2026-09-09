"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useMounted } from "@/components/Transitions";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

/** Generic custom dropdown — the native select popup can't be styled. */
export function SelectField({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useMounted(open, 150);
  const ref = useRef<HTMLDivElement>(null);

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
  }, [open ]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-xs transition-colors ${
          open ? "border-neutral-400" : "border-trell-line hover:border-neutral-300"
        }`}
      >
        <span className="truncate text-trell-ink">{current?.label ?? value}</span>
        <Icon name="arrow-down-01" size={14} className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {t.mounted && (
        <div className={`absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-xl border border-trell-line bg-white py-1 shadow-xl ${t.closing ? "trell-pop-out" : "trell-pop-in"}`}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-neutral-100 ${
                o.value === value ? "bg-neutral-50" : ""
              }`}
            >
              <span>
                <span className={`block text-xs ${o.value === value ? "font-semibold text-trell-ink" : "text-neutral-700"}`}>
                  {o.label}
                </span>
                {o.hint && <span className="block text-[11px] font-normal text-neutral-400">{o.hint}</span>}
              </span>
              {o.value === value && <Icon name="check" size={14} className="shrink-0 text-trell-ink" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

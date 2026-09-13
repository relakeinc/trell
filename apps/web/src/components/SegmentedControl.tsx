"use client";

import type { ReactNode } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
  hint?: string;
}

const SIZES = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-xs",
  lg: "h-9 w-11 text-lg",
} as const;

// Colours come from the `.trell-seg` rules in globals.css: the app-wide dark
// overrides there target utility classes (`.bg-white` and friends) with
// !important, so class-based theme colours would be hijacked.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "sm",
  scrollable = false,
  className,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: keyof typeof SIZES;
  scrollable?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`trell-seg flex items-center gap-0.5 rounded-lg p-0.5 ${
        scrollable ? "scrollbar-hide max-w-full overflow-x-auto whitespace-nowrap" : ""
      } ${className ?? ""}`}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <div key={o.value} className="group relative shrink-0">
            <button
              type="button"
              onClick={() => onChange(o.value)}
              title={o.title}
              aria-pressed={selected}
              className={`trell-seg-btn whitespace-nowrap rounded-md font-medium transition-colors ${SIZES[size]}`}
            >
              {o.label}
            </button>
            {o.hint && (
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {o.hint}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

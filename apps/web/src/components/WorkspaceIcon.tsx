"use client";

import type { JSX } from "react";

const COLORS = [
  { bg: "#7a66ff", light: "#b1a7ff", mid: "#9580ff", dark: "#5a3de6" },
  { bg: "#2563eb", light: "#93c5fd", mid: "#60a5fa", dark: "#1d4ed8" },
  { bg: "#059669", light: "#6ee7b7", mid: "#34d399", dark: "#047857" },
  { bg: "#d97706", light: "#fcd34d", mid: "#fbbf24", dark: "#b45309" },
  { bg: "#dc2626", light: "#fca5a5", mid: "#f87171", dark: "#b91c1c" },
  { bg: "#7c3aed", light: "#c4b5fd", mid: "#a78bfa", dark: "#6d28d9" },
  { bg: "#0891b2", light: "#67e8f9", mid: "#22d3ee", dark: "#0e7490" },
  { bg: "#db2777", light: "#f9a8d4", mid: "#f472b6", dark: "#be185d" },
];

type PatternFn = (c: typeof COLORS[0]) => JSX.Element;

const PATTERNS: PatternFn[] = [
  // 0: Original - two rects
  (c) => (
    <>
      <rect x="14" y="14" width="22" height="22" rx="4" fill={c.light} />
      <rect x="14" y="38" width="22" height="12" rx="4" fill={c.dark} />
    </>
  ),
  // 1: Circle + small square
  (c) => (
    <>
      <circle cx="28" cy="28" r="14" fill={c.light} />
      <rect x="34" y="38" width="16" height="12" rx="3" fill={c.dark} />
    </>
  ),
  // 2: Diagonal split
  (c) => (
    <>
      <path d="M10 10H54V32H10V10Z" fill={c.light} />
      <path d="M10 38H54V54H10V38Z" fill={c.dark} />
      <circle cx="44" cy="44" r="6" fill={c.mid} />
    </>
  ),
  // 3: Grid of dots
  (c) => (
    <>
      <rect x="12" y="12" width="18" height="18" rx="4" fill={c.light} />
      <rect x="34" y="12" width="18" height="18" rx="4" fill={c.mid} />
      <rect x="12" y="34" width="18" height="18" rx="4" fill={c.mid} />
      <rect x="34" y="34" width="18" height="18" rx="4" fill={c.dark} />
    </>
  ),
  // 4: Stacked bars
  (c) => (
    <>
      <rect x="12" y="14" width="40" height="8" rx="4" fill={c.light} />
      <rect x="12" y="26" width="30" height="8" rx="4" fill={c.mid} />
      <rect x="12" y="38" width="20" height="8" rx="4" fill={c.dark} />
    </>
  ),
  // 5: Triangle play
  (c) => (
    <>
      <rect x="12" y="12" width="40" height="40" rx="8" fill={c.light} />
      <path d="M28 22L42 32L28 42V22Z" fill={c.dark} />
    </>
  ),
  // 6: Overlapping circles
  (c) => (
    <>
      <circle cx="24" cy="24" r="12" fill={c.light} />
      <circle cx="36" cy="36" r="12" fill={c.mid} />
      <circle cx="36" cy="24" r="8" fill={c.dark} opacity="0.6" />
    </>
  ),
  // 7: Pill rows
  (c) => (
    <>
      <rect x="12" y="12" width="28" height="10" rx="5" fill={c.light} />
      <rect x="12" y="27" width="40" height="10" rx="5" fill={c.mid} />
      <rect x="12" y="42" width="20" height="10" rx="5" fill={c.dark} />
    </>
  ),
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export interface WorkspaceIconProps {
  name: string;
  variant?: number;
  size?: number;
  className?: string;
}

export function WorkspaceIcon({ name, variant, size = 64, className = "" }: WorkspaceIconProps) {
  const colorIdx = hashCode(name) % COLORS.length;
  const patternIdx = variant ?? hashCode(name + "shape") % PATTERNS.length;
  const color = COLORS[colorIdx]!;
  const pattern = PATTERNS[patternIdx % PATTERNS.length]!;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M12 0H52C58.6274 0 64 5.37258 64 12V52C64 58.6274 58.6274 64 52 64H12C5.37258 64 0 58.6274 0 52V12C0 5.37258 5.37258 0 12 0Z"
        fill={color.bg}
        fillOpacity="0.3"
      />
      {pattern(color)}
    </svg>
  );
}

export const WORKSPACE_ICON_COUNT = PATTERNS.length;

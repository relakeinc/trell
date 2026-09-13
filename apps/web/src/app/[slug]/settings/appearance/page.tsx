"use client";

import { Check } from "lucide-react";
import { useTheme, type FontStyle } from "@/lib/useTheme";
import { SegmentedControl } from "@/components/SegmentedControl";

const ACCENTS = [
  { id: "blue", label: "Blue", dot: "#2563eb" },
  { id: "sky", label: "Sky", dot: "#06b6d4" },
  { id: "lavender", label: "Lavender", dot: "#a855f7" },
  { id: "mint", label: "Mint", dot: "#10b981" },
  { id: "netflix", label: "Netflix", dot: "#dc2626" },
  { id: "spotify", label: "Spotify", dot: "#22c55e" },
  { id: "coinbase", label: "Coinbase", dot: "#3b82f6" },
  { id: "airbnb", label: "Airbnb", dot: "#ec4899" },
  { id: "discord", label: "Discord", dot: "#6366f1" },
  { id: "rabbit", label: "Rabbit", dot: "#f97316" },
] as const;

const FONTS: { id: FontStyle; label: string; className: string }[] = [
  { id: "default", label: "Default text", className: "" },
  { id: "display", label: "Display text", className: "[font-family:var(--font-figtree)]" },
  { id: "system", label: "System text", className: "[font-family:ui-sans-serif,system-ui,sans-serif]" },
];

function TrafficLights() {
  return (
    <div className="flex gap-1">
      <span className="size-1.5 rounded-full bg-[#ff5f57]" />
      <span className="size-1.5 rounded-full bg-[#febc2e]" />
      <span className="size-1.5 rounded-full bg-[#28c840]" />
    </div>
  );
}

function MockBars({ dark }: { dark?: boolean }) {
  const bar = dark ? "bg-neutral-700" : "bg-neutral-200";
  const widths = ["w-3/4", "w-full", "w-5/6", "w-2/3", "w-4/5", "w-3/5", "w-11/12"];
  return (
    <div className="mt-3 space-y-2">
      {widths.map((w) => (
        <div key={w} className={`h-1.5 rounded-full ${bar} ${w}`} />
      ))}
    </div>
  );
}

function MockAvatar({ dark }: { dark?: boolean }) {
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      <span className={`size-4 shrink-0 rounded-full ${dark ? "bg-neutral-600" : "bg-neutral-300"}`} />
      <div className={`h-1.5 rounded-full ${dark ? "bg-neutral-600" : "bg-neutral-300"} w-1/3`} />
    </div>
  );
}

function MockSpark({ dark }: { dark?: boolean }) {
  const heights = [38, 62, 45, 78, 58, 88, 66, 96, 72, 84];
  const bar = dark ? "bg-neutral-600" : "bg-neutral-300";
  return (
    <div className="mt-auto flex h-20 items-end gap-1.5 pt-4">
      {heights.map((h, i) => (
        <div key={i} className={`flex-1 rounded-sm ${bar}`} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function ThemeMock({ mode }: { mode: "light" | "dark" | "system" }) {
  if (mode === "system") {
    return (
      <div className="flex h-72 overflow-hidden rounded-md">
        <div className="flex w-1/2 flex-col bg-white p-2.5">
          <TrafficLights />
          <MockAvatar />
          <MockBars />
          <MockSpark />
        </div>
        <div className="flex w-1/2 flex-col bg-[#111111] p-2.5">
          <TrafficLights />
          <MockAvatar dark />
          <MockBars dark />
          <MockSpark dark />
        </div>
      </div>
    );
  }
  const dark = mode === "dark";
  return (
    <div className={`flex h-72 flex-col rounded-md p-2.5 ${dark ? "bg-[#111111]" : "bg-white"}`}>
      <TrafficLights />
      <MockAvatar dark={dark} />
      <MockBars dark={dark} />
      <MockSpark dark={dark} />
    </div>
  );
}

const MODES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
] as const;

export default function AppearanceSettingsPage() {
  const { theme, accent, font, setTheme, setAccent, setFont, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Appearance</h1>
        <p className="mt-1 text-sm text-trell-ink-muted">Customize how Trell looks on your device.</p>
      </div>

      <div
        className={`overflow-hidden rounded-xl border ${isDark ? "border-[#2a2a29] bg-[#191918]" : "border-trell-line bg-white"}`}
      >
        <div className="p-5">
          <div className={`text-sm font-semibold ${isDark ? "text-[#CDCCCC]" : "text-trell-ink"}`}>Theme</div>
          <div className={`mt-1 text-sm ${isDark ? "text-[#656565]" : "text-trell-ink-muted"}`}>
            Customize your UI theme
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {MODES.map((m) => {
              const selected = theme === m.id;
              return (
                <button key={m.id} onClick={() => setTheme(m.id)} className="group flex flex-col gap-2">
                  <span
                    className={`relative block overflow-hidden rounded-lg border-2 transition-colors ${
                      selected ? "border-blue-600" : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <ThemeMock mode={m.id} />
                    {selected && (
                      <span className="absolute bottom-1.5 left-1.5 flex size-4 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className={`text-xs ${selected ? "font-medium text-trell-ink" : "text-neutral-500"}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`mx-5 border-t ${isDark ? "border-[#2a2a29]" : "border-trell-line"}`} />

        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className={`text-sm font-semibold ${isDark ? "text-[#CDCCCC]" : "text-trell-ink"}`}>
                Accent color
              </div>
              <div className={`mt-1 text-sm ${isDark ? "text-[#656565]" : "text-trell-ink-muted"}`}>
                Choose your accent color
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {ACCENTS.map((a) => {
                const selected = accent === a.id;
                return (
                  <button
                    key={a.id}
                    title={a.label}
                    aria-label={`${a.label} accent`}
                    onClick={() => setAccent(a.id)}
                    className={`size-5 rounded-full transition-transform hover:scale-110 ${
                      selected ? "ring-2 ring-blue-600 ring-offset-2" : ""
                    }`}
                    style={{ backgroundColor: a.dot }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className={`mx-5 border-t ${isDark ? "border-[#2a2a29]" : "border-trell-line"}`} />

        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className={`text-sm font-semibold ${isDark ? "text-[#CDCCCC]" : "text-trell-ink"}`}>Font style</div>
              <div className={`mt-1 text-sm ${isDark ? "text-[#656565]" : "text-trell-ink-muted"}`}>
                Choose your font style
              </div>
            </div>
            <SegmentedControl<FontStyle>
              size="lg"
              ariaLabel="Font style"
              value={font}
              onChange={setFont}
              options={FONTS.map((f) => ({
                value: f.id,
                label: <span className={f.className}>Ag</span>,
                title: `${f.label} font`,
                hint: f.label,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

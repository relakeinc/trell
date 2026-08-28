"use client";

import { useTheme } from "@/lib/useTheme";
import { Icon } from "@/components/Icon";

const THEMES = [
  { id: "light", label: "White", dot: "from-white to-neutral-300", ring: "#e4e4e7", text: "text-neutral-700" },
  { id: "dark", label: "Dark", dot: "from-[#111111] to-[#262626]", ring: "#111111", text: "text-neutral-300" },
  { id: "blue", label: "Blue", dot: "from-blue-500 to-blue-600", ring: "#2563eb", text: "text-neutral-600" },
  { id: "sky", label: "Sky", dot: "from-cyan-400 to-blue-500", ring: "#06b6d4", text: "text-neutral-600" },
  { id: "lavender", label: "Lavender", dot: "from-purple-400 to-pink-400", ring: "#a855f7", text: "text-neutral-600" },
  { id: "mint", label: "Mint", dot: "from-emerald-400 to-teal-400", ring: "#10b981", text: "text-neutral-600" },
  { id: "netflix", label: "Netflix", dot: "from-red-500 to-red-600", ring: "#dc2626", text: "text-neutral-600" },
  { id: "spotify", label: "Spotify", dot: "from-green-400 to-green-600", ring: "#22c55e", text: "text-neutral-600" },
  { id: "coinbase", label: "Coinbase", dot: "from-blue-400 to-blue-600", ring: "#3b82f6", text: "text-neutral-600" },
  { id: "airbnb", label: "Airbnb", dot: "from-pink-400 to-rose-500", ring: "#ec4899", text: "text-neutral-600" },
  { id: "discord", label: "Discord", dot: "from-indigo-400 to-indigo-600", ring: "#6366f1", text: "text-neutral-600" },
  { id: "rabbit", label: "Rabbit", dot: "from-orange-400 to-amber-500", ring: "#f97316", text: "text-neutral-600" },
] as const;

const SECTIONS = [
  { label: "Modes", ids: ["light", "dark"] },
  { label: "Accents", ids: ["blue", "sky", "lavender", "mint", "netflix", "spotify", "coinbase", "airbnb", "discord", "rabbit"] },
];

export default function AppearanceSettingsPage() {
  const { theme, accent, setTheme, setAccent } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Appearance</h1>
        <p className="mt-1 text-sm text-trell-ink-muted">Customize how Trell looks on your device.</p>
      </div>

      {/* Color Theme */}
      <div className={`overflow-hidden rounded-xl border ${isDark ? "border-[#2a2a29] bg-[#191918]" : "border-trell-line bg-white"}`}>
        <div className="p-5">
          <div className={`text-sm font-semibold ${isDark ? "text-[#CDCCCC]" : "text-trell-ink"}`}>Color Theme</div>
          <div className={`mt-1 text-sm ${isDark ? "text-[#656565]" : "text-trell-ink-muted"}`}>Choose your accent color for the interface.</div>

          {SECTIONS.map((section) => (
            <div key={section.label} className="mt-6">
              <div className={`mb-3 text-xs font-medium uppercase tracking-wider ${isDark ? "text-[#656565]" : "text-neutral-400"}`}>
                {section.label}
              </div>
              <div className="grid grid-cols-6 gap-x-2 gap-y-4">
                {section.ids.map((id) => {
                  const t = THEMES.find((x) => x.id === id)!;
                  const isSelected = section.label === "Modes" ? theme === id : accent === id;
                  const isMode = section.label === "Modes";
                  return (
                    <button
                      key={id}
                      onClick={() => (isMode ? setTheme(id as "light" | "dark") : setAccent(id))}
                      className="group flex flex-col items-center gap-2"
                    >
                      <div
                        className={`size-10 transition-all duration-200 ${
                          isMode ? "rounded-xl shadow-sm" : "rounded-full bg-gradient-to-br"
                        } ${isMode ? "" : t.dot} ${
                          isSelected
                            ? "ring-2 ring-offset-2 ring-offset-[#191918]"
                            : "hover:scale-110"
                        } ${isMode ? (id === "light" ? "bg-gradient-to-br from-white to-neutral-300" : "bg-gradient-to-br from-[#111111] to-[#262626]") : ""}`}
                        style={isSelected ? { boxShadow: `0 0 0 2px ${t.ring}` } : undefined}
                      />
                      <span className={`text-xs ${isSelected ? "font-medium" : isDark ? "text-[#656565]" : "text-neutral-500"}`}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className={`overflow-hidden rounded-xl border ${isDark ? "border-[#2a2a29] bg-[#191918]" : "border-trell-line bg-white"}`}>
        <div className="p-5">
          <div className={`text-sm font-semibold ${isDark ? "text-[#CDCCCC]" : "text-trell-ink"}`}>Preview</div>
          <div className={`mt-1 text-sm ${isDark ? "text-[#656565]" : "text-trell-ink-muted"}`}>See how your theme looks with sample content.</div>
          <div className={`mt-4 rounded-lg border p-4 ${
            isDark
              ? "border-[#2a2a29] bg-[#111111] text-[#CDCCCC]"
              : "border-neutral-200 bg-neutral-50 text-neutral-900"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-xl ${isDark ? "bg-[#1e1e1d]" : "bg-white shadow-sm"}`}>
                <Icon name="chart-2" size={20} className={isDark ? "text-[#CDCCCC]" : "text-neutral-400"} />
              </div>
              <div>
                <div className="text-sm font-medium">Sample Card</div>
                <div className={`text-xs ${isDark ? "text-[#656565]" : "text-neutral-500"}`}>
                  This is how content will appear in {isDark ? "dark" : "light"} mode.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

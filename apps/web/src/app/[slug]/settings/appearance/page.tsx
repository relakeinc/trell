"use client";

import { useState } from "react";
import { useTheme } from "@/lib/useTheme";

const COLOR_THEMES = [
  { id: "default", label: "Default", gradient: "from-blue-500 to-blue-600" },
  { id: "sky", label: "Sky", gradient: "from-cyan-400 to-blue-500" },
  { id: "lavender", label: "Lavender", gradient: "from-purple-400 to-pink-400" },
  { id: "mint", label: "Mint", gradient: "from-emerald-400 to-teal-400" },
  { id: "netflix", label: "Netflix", gradient: "from-red-500 to-red-600" },
  { id: "uber", label: "Uber", gradient: "from-neutral-500 to-neutral-600" },
  { id: "spotify", label: "Spotify", gradient: "from-green-400 to-green-600" },
  { id: "coinbase", label: "Coinbase", gradient: "from-blue-400 to-blue-600" },
  { id: "airbnb", label: "Airbnb", gradient: "from-pink-400 to-rose-500" },
  { id: "discord", label: "Discord", gradient: "from-indigo-400 to-indigo-600" },
  { id: "rabbit", label: "Rabbit", gradient: "from-orange-400 to-amber-500" },
];

const APPEARANCE_MODES = [
  { id: "light", label: "Light", icon: "☀️" },
  { id: "dark", label: "Dark", icon: "🌙" },
  { id: "system", label: "System", icon: "💻" },
] as const;

export default function AppearanceSettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeColor, setActiveColor] = useState("default");
  const isDark = resolvedTheme === "dark";

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
          <div className="mt-4 grid grid-cols-6 gap-3">
            {COLOR_THEMES.map((color) => (
              <button
                key={color.id}
                onClick={() => setActiveColor(color.id)}
                className="flex flex-col items-center gap-2"
              >
                <div className={`size-10 rounded-full bg-gradient-to-br ${color.gradient} transition-all ${
                  activeColor === color.id
                    ? "ring-2 ring-offset-2 ring-[#CDCCCC] ring-offset-white"
                    : "hover:scale-110"
                } ${isDark && activeColor !== color.id ? "ring-offset-[#191918]" : ""}`} />
                <span className={`text-xs ${activeColor === color.id ? "font-medium text-[#CDCCCC]" : isDark ? "text-[#656565]" : "text-neutral-500"}`}>
                  {color.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance Mode */}
      <div className={`overflow-hidden rounded-xl border ${isDark ? "border-[#2a2a29] bg-[#191918]" : "border-trell-line bg-white"}`}>
        <div className="p-5">
          <div className={`text-sm font-semibold ${isDark ? "text-[#CDCCCC]" : "text-trell-ink"}`}>Appearance</div>
          <div className={`mt-1 text-sm ${isDark ? "text-[#656565]" : "text-trell-ink-muted"}`}>Select your preferred color scheme.</div>
          <div className="mt-4 flex gap-3">
            {APPEARANCE_MODES.map((mode) => {
              const isActive = theme === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setTheme(mode.id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    isActive
                      ? "border-[#CDCCCC] bg-[#CDCCCC]/10 shadow-sm"
                      : isDark
                        ? "border-[#2a2a29] bg-[#191918] hover:border-[#656565] hover:bg-[#1e1e1d]"
                        : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <span className="text-2xl">{mode.icon}</span>
                  <span className={`text-sm font-medium ${isActive ? "text-[#CDCCCC]" : isDark ? "text-[#CDCCCC]" : "text-neutral-600"}`}>
                    {mode.label}
                  </span>
                </button>
              );
            })}
          </div>
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
              <div className={`size-8 rounded-full bg-gradient-to-br ${
                COLOR_THEMES.find(c => c.id === activeColor)?.gradient || "from-blue-500 to-blue-600"
              }`} />
              <div>
                <div className="text-sm font-medium">Sample Card</div>
                <div className={`text-xs ${isDark ? "text-[#656565]" : "text-neutral-500"}`}>
                  This is how content will appear in {resolvedTheme} mode.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

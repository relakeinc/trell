"use client";

import { useTheme } from "@/lib/useTheme";
import { Icon } from "@/components/Icon";

const THEMES = [
  { value: "light" as const, label: "Light", icon: "sun" },
  { value: "dark" as const, label: "Dark", icon: "moon" },
  { value: "system" as const, label: "System", icon: "setting-2" },
] as const;

export default function AppearanceSettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Appearance</h1>
        <p className="mt-1 text-sm text-trell-ink-muted">Customize how Trell looks on your device.</p>
      </div>

      {/* Theme Picker */}
      <div className={`overflow-hidden rounded-xl border ${isDark ? "border-[#363940] bg-[#2a2d33]" : "border-trell-line bg-white"}`}>
        <div className="p-5">
          <div className={`text-sm font-semibold ${isDark ? "text-[#e4e4e7]" : "text-trell-ink"}`}>Theme</div>
          <div className={`mt-1 text-sm ${isDark ? "text-[#a0a4ad]" : "text-trell-ink-muted"}`}>Select your preferred color theme.</div>
          <div className="mt-4 flex gap-3">
            {THEMES.map((t) => {
              const isActive = theme === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    isActive
                      ? "border-blue-500 bg-blue-500/10 shadow-sm"
                      : isDark
                        ? "border-[#363940] bg-[#22252a] hover:border-[#595d66] hover:bg-[#2a2d33]"
                        : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <div className={`flex size-10 items-center justify-center rounded-full ${
                    isActive ? "bg-blue-500/20 text-blue-500" : isDark ? "bg-[#363940] text-[#a0a4ad]" : "bg-neutral-100 text-neutral-500"
                  }`}>
                    <Icon name={t.icon} size={20} />
                  </div>
                  <span className={`text-sm font-medium ${isActive ? "text-blue-500" : isDark ? "text-[#e4e4e7]" : "text-neutral-600"}`}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className={`overflow-hidden rounded-xl border ${isDark ? "border-[#363940] bg-[#2a2d33]" : "border-trell-line bg-white"}`}>
        <div className="p-5">
          <div className={`text-sm font-semibold ${isDark ? "text-[#e4e4e7]" : "text-trell-ink"}`}>Preview</div>
          <div className={`mt-1 text-sm ${isDark ? "text-[#a0a4ad]" : "text-trell-ink-muted"}`}>See how your theme looks with sample content.</div>
          <div className={`mt-4 rounded-lg border p-4 ${
            isDark
              ? "border-[#363940] bg-[#22252a] text-[#e4e4e7]"
              : "border-neutral-200 bg-neutral-50 text-neutral-900"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`size-8 rounded-full ${
                isDark ? "bg-[#595d66]" : "bg-neutral-200"
              }`} />
              <div>
                <div className="text-sm font-medium">Sample Card</div>
                <div className={`text-xs ${isDark ? "text-[#a0a4ad]" : "text-neutral-500"}`}>
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

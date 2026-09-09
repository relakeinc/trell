"use client";

import { Loader2 } from "lucide-react";

/** Full-screen loader shown while the browser hands off to an external
 *  provider (Polar checkout / customer portal) so the page never looks frozen. */
export function RedirectOverlay({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/85 backdrop-blur-sm">
      <div className="trell-modal-in flex flex-col items-center gap-3 rounded-2xl border border-trell-line bg-white px-8 py-6 shadow-xl">
        <Loader2 className="size-6 animate-spin text-[#2563eb]" />
        <p className="text-sm font-semibold text-trell-ink">{title}</p>
        {subtitle && <p className="text-xs text-trell-ink-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

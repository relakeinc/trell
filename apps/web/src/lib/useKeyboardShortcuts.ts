"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

/**
 * Global keyboard shortcuts:
 *  g + a  → Analytics
 *  g + e  → Events
 *  g + s  → Submissions
 *  g + f  → Funnels
 *  g + c  → Comparison
 *  g + t  → Tracking settings
 *  g + w  → Webhooks settings
 *  /      → Focus search (if exists)
 *  ?      → Show shortcuts help
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return;

      // g + <key> navigation
      if (e.key === "g") {
        gPressed = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 500);
        return;
      }

      if (gPressed) {
        gPressed = false;
        if (gTimer) clearTimeout(gTimer);

        const routes: Record<string, string> = {
          a: "analytics",
          e: "events",
          s: "submissions",
          f: "funnels",
          c: "comparison",
          t: "settings/tracking",
          w: "settings/webhooks",
          d: "settings/domains",
          b: "settings/billing",
          n: "settings/general",
        };

        const target = routes[e.key];
        if (target) {
          e.preventDefault();
          router.push(`/${slug}/${target}`);
        }
        return;
      }

      // / to focus search
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('[data-trell-search]');
        if (searchInput) searchInput.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [router, slug]);
}

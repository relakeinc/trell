"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { TrellLogo } from "@/components/TrellLogo";
import { useMounted } from "@/components/Transitions";

const DISMISS_KEY = "trell:pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(max-width: 767px)").matches ?? false;
}

/**
 * Native-style "Add to Home Screen" prompt.
 *
 * - Android/Chrome: uses the captured beforeinstallprompt event.
 * - iOS Safari: shows the Share → Add to Home Screen hint (no event API).
 * - Never renders on desktop, in standalone mode, or after dismissal.
 */
export function PWAInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const t = useMounted(visible, 220);

  useEffect(() => {
    if (!isMobileViewport() || isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* private mode */
    }

    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const iosSafari = ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS never fires the event, so fall back to a delayed hint.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (iosSafari) {
      setIsIos(true);
      timer = setTimeout(() => setVisible(true), 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setVisible(false);
    else dismiss();
  }

  if (!t.mounted) return null;

  return (
    <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Install Trell">
      <div
        className={`absolute inset-0 bg-black/40 ${t.closing ? "trell-fade-out" : "trell-fade-in"}`}
        onClick={dismiss}
      />
      <div
        className={`absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-neutral-200 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 shadow-2xl ${
          t.closing ? "trell-modal-out" : "trell-modal-in"
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200" />

        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/pwa/icon-192.png" alt="" width={48} height={48} className="size-12 rounded-xl shadow-sm" />
          <div className="min-w-0 flex-1">
            <TrellLogo className="h-5 w-auto" />
            <p className="mt-0.5 text-[13px] leading-snug text-neutral-500">Install for a faster, full-screen app.</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
          >
            <Icon name="close-circle" size={18} />
          </button>
        </div>

        {isIos ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-neutral-50 px-3 py-3 text-[13px] leading-relaxed text-neutral-600">
            <span className="mt-0.5 shrink-0 text-neutral-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" strokeLinecap="round" />
                <path d="M12 3v12" strokeLinecap="round" />
                <path d="m8 7 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              Tap <strong className="font-medium text-neutral-800">Share</strong>, then{" "}
              <strong className="font-medium text-neutral-800">Add to Home Screen</strong>.
            </span>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={dismiss} className="trell-btn-secondary h-11 flex-1 justify-center text-sm">
              Not now
            </button>
            <button
              type="button"
              onClick={() => void install()}
              disabled={!deferred}
              className="trell-btn-accent h-11 flex-1 justify-center text-sm"
            >
              Install
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

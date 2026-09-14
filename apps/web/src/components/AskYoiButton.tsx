"use client";

import { useChat } from "./ChatProvider";

/** Sparkle mark (Phosphor Sparkle, ISC) for the Ask Yoi trigger. */
function SparkleMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      className="-translate-y-px text-neutral-500"
    >
      <path d="M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z" />
    </svg>
  );
}

/**
 * Ghost trigger that opens the Yoi side panel. Lives in page headers,
 * rightmost — matching sibling `trell-btn-outline h-9` controls.
 */
export function AskYoiButton() {
  const { openChat, setAskHover } = useChat();
  return (
    <button
      type="button"
      onClick={openChat}
      onMouseEnter={() => setAskHover(true)}
      onMouseLeave={() => setAskHover(false)}
      onFocus={() => setAskHover(true)}
      onBlur={() => setAskHover(false)}
      className="trell-btn-outline trell-mobile-hidden h-9 gap-1.5"
      title="Ask Yoi"
    >
      <SparkleMark />
      <span className="hidden sm:inline">Ask Yoi</span>
    </button>
  );
}

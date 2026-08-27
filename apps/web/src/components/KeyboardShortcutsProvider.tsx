"use client";

import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts();
  return <>{children}</>;
}

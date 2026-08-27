"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Icon } from "./Icon";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const commands: Command[] = useMemo(() => [
    { id: "analytics", label: "Analytics", hint: "g a", icon: "analytics", action: () => router.push(`/${slug}/analytics`) },
    { id: "events", label: "Events", hint: "g e", icon: "events", action: () => router.push(`/${slug}/events`) },
    { id: "submissions", label: "Submissions", hint: "g s", icon: "send", action: () => router.push(`/${slug}/submissions`) },
    { id: "funnels", label: "Funnels", hint: "g f", icon: "funnels", action: () => router.push(`/${slug}/funnels`) },
    { id: "comparison", label: "Comparison", hint: "g c", icon: "comparison", action: () => router.push(`/${slug}/comparison`) },
    { id: "tracking", label: "Tracking Settings", hint: "g t", icon: "setting-2", action: () => router.push(`/${slug}/settings/tracking`) },
    { id: "webhooks", label: "Webhooks", hint: "g w", icon: "webhooks", action: () => router.push(`/${slug}/settings/webhooks`) },
    { id: "domains", label: "Domains", hint: "g d", icon: "globe", action: () => router.push(`/${slug}/settings/domains`) },
    { id: "billing", label: "Billing", hint: "g b", icon: "setting-2", action: () => router.push(`/${slug}/settings/billing`) },
    { id: "general", label: "General Settings", hint: "g n", icon: "setting-2", action: () => router.push(`/${slug}/settings/general`) },
  ], [router, slug]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      e.preventDefault();
      filtered[selectedIdx]!.action();
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-800">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-700">
          <Icon name="search" size={18} className="shrink-0 text-neutral-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            className="h-12 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder-neutral-400 dark:text-neutral-100"
          />
          <kbd className="hidden shrink-0 rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-2xs text-neutral-500 sm:inline dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-neutral-400">No results found</p>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => { cmd.action(); setOpen(false); }}
              onMouseEnter={() => setSelectedIdx(i)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                i === selectedIdx
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              <Icon name={cmd.icon} size={16} className={i === selectedIdx ? "text-blue-500" : "text-neutral-400"} />
              <span className="flex-1">{cmd.label}</span>
              {cmd.hint && (
                <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-2xs text-neutral-400 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-500">
                  {cmd.hint}
                </kbd>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-neutral-200 px-4 py-2 text-2xs text-neutral-400 dark:border-neutral-700">
          <span className="flex items-center gap-1"><kbd className="rounded border border-neutral-200 bg-neutral-100 px-1 py-0.5 dark:border-neutral-600 dark:bg-neutral-700">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-neutral-200 bg-neutral-100 px-1 py-0.5 dark:border-neutral-600 dark:bg-neutral-700">↵</kbd> select</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-neutral-200 bg-neutral-100 px-1 py-0.5 dark:border-neutral-600 dark:bg-neutral-700">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

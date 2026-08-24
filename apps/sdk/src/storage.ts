import type { TrellConfig } from "@trell/shared";
import { COOKIE_VISITOR } from "@trell/shared";

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** In-memory store (used in strict/cookieless or without consent). */
export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

function safeLocalStorage(win: Window): Storage | null {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}

function safeSessionStorage(win: Window): Storage | null {
  try {
    return win.sessionStorage;
  } catch {
    return null;
  }
}

export function createBrowserStore(
  win: Window,
  opts: { sessionOnly: boolean },
): KeyValueStore {
  const storage = opts.sessionOnly ? safeSessionStorage(win) : safeLocalStorage(win);
  return {
    get: (k) => {
      try {
        return storage?.getItem(k) ?? null;
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        storage?.setItem(k, v);
      } catch {
        /* full quota / private mode */
      }
    },
    remove: (k) => {
      try {
        storage?.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Decide whether persistent identifiers are allowed based on privacy mode,
 * DNT/GPC signals and consent. Returns the store plus whether it persists.
 */
export function resolveStore(
  win: Window,
  config: TrellConfig,
): { store: KeyValueStore; persistent: boolean } {
  const { privacy } = config;

  const respectsDoNotTrack =
    typeof navigator !== "undefined" &&
    (navigator.doNotTrack === "1" ||
      (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

  const mayPersist =
    privacy !== "strict" && !respectsDoNotTrack && (privacy !== "consent" || config.consent !== false);

  if (mayPersist) {
    return { store: createBrowserStore(win, { sessionOnly: false }), persistent: true };
  }
  return { store: createMemoryStore(), persistent: false };
}

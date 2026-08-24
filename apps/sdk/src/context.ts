import type { Device, Utm } from "@trell/shared";
import {
  COOKIE_VISITOR,
  SESSION_IDLE_MS,
  STORAGE_SESSION,
  STORAGE_UTM,
} from "@trell/shared";
import type { KeyValueStore } from "./storage";
import { randomUUID } from "./rng";

const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;

function readCookie(doc: Document, name: string): string | null {
  const m = doc.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function writeCookie(doc: Document, name: string, value: string, maxAgeSeconds: number): void {
  try {
    doc.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; samesite=lax`;
  } catch {
    /* ignore */
  }
}

/** Persistent anonymous visitor id (1 year) via cookie, mirrored to store. */
export function getOrCreateVisitorId(win: Window, store: KeyValueStore, persistent: boolean): string {
  const doc = win.document;

  if (persistent) {
    const fromCookie = readCookie(doc, COOKIE_VISITOR);
    if (fromCookie) return fromCookie;
    const fromStore = store.get(COOKIE_VISITOR);
    if (fromStore) {
      writeCookie(doc, COOKIE_VISITOR, fromStore, 60 * 60 * 24 * 365);
      return fromStore;
    }
  }

  const id = randomUUID();
  store.set(COOKIE_VISITOR, id);
  if (persistent) writeCookie(doc, COOKIE_VISITOR, id, 60 * 60 * 24 * 365);
  return id;
}

/** Session id (per tab), regenerated after idle. */
export function getOrCreateSessionId(win: Window, store: KeyValueStore): string {
  const existing = store.get(STORAGE_SESSION);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { id: string; at: number };
      if (Date.now() - parsed.at < SESSION_IDLE_MS) return parsed.id;
    } catch {
      /* ignore */
    }
  }
  const next = { id: randomUUID(), at: Date.now() };
  store.set(STORAGE_SESSION, JSON.stringify(next));
  return next.id;
}

export function getOrCreateUtm(
  win: Window,
  store: KeyValueStore,
  persistent: boolean,
): Utm | null {
  const existing = persistent ? store.get(STORAGE_UTM) : null;
  if (existing) {
    try {
      return JSON.parse(existing) as Utm;
    } catch {
      /* ignore */
    }
  }

  const params = new URLSearchParams(win.location.search);
  const utm: Utm = {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    term: params.get("utm_term"),
    content: params.get("utm_content"),
  };

  const hasAny = UTM_KEYS.some((k) => utm[k] != null);
  if (!hasAny) return null;

  if (persistent) store.set(STORAGE_UTM, JSON.stringify(utm));
  return utm;
}

export function getUrlContext(win: Window): { url: string; referrer: string; page: { path: string; title: string } } {
  return {
    url: win.location.href,
    referrer: win.document.referrer,
    page: { path: win.location.pathname, title: win.document.title },
  };
}

export function detectDevice(win: Window): Device {
  const nav = win.navigator;
  const ua = nav.userAgent || "";
  const uaData = (nav as unknown as { userAgentData?: { platform?: string; mobile?: boolean; brands?: { brand?: string; version?: string }[] } }).userAgentData;

  const width = win.innerWidth || win.document.documentElement.clientWidth || 0;
  const height = win.innerHeight || win.document.documentElement.clientHeight || 0;

  const isMobile =
    uaData?.mobile === true || /Mobile|Android|iPhone|iPod/i.test(ua);

  let type: Device["type"] = "desktop";
  if (isMobile) type = "mobile";
  else if (/iPad|Tablet/i.test(ua) || (width >= 768 && width <= 1180 && /Tablet|iPad/i.test(ua))) {
    type = "tablet";
  }

  const platform = uaData?.platform;

  let os: string | null = null;
  if (/windows/i.test(ua)) os = "windows";
  else if (/mac os x|macintosh|iphone|ipad|ipod/i.test(ua)) os = "macos";
  else if (/android/i.test(ua)) os = "android";
  else if (/linux/i.test(ua)) os = "linux";
  else if (platform) os = platform.toLowerCase();
  else os = null;

  let browser: string | null = null;
  if (/edg\//i.test(ua)) browser = "edge";
  else if (/opr\/|opera/i.test(ua)) browser = "opera";
  else if (/chrome|crios\//i.test(ua)) browser = "chrome";
  else if (/safari/i.test(ua)) browser = "safari";
  else if (/firefox|fxios/i.test(ua)) browser = "firefox";
  else browser = null;

  return { type, os, browser, viewport: [width, height] };
}

export interface Context {
  visitorId: string;
  sessionId: string;
  utm: Utm | null;
  device: Device;
}

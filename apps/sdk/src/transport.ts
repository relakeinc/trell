import { MAX_BATCH, MAX_BATCH_INTERVAL_MS, MAX_PAYLOAD_BYTES, MAX_QUEUE } from "@trell/shared";
import type { EventPayload } from "@trell/shared";

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;
type BeaconFn = (url: string, data: BodyInit) => boolean;

const CRITICAL_TYPES = new Set(["form_submit", "form_success"]);
const encoder = new TextEncoder();

function contentLength(value: string): number {
  return encoder.encode(value).byteLength;
}

function backoffMs(attempt: number): number {
  const base = Math.min(4_000, 300 * 2 ** attempt);
  return base + Math.floor(Math.random() * base * 0.3);
}

export class Transport {
  private endpoint: string;
  private project: string;
  private fetchFn: FetchFn;
  private beaconFn: BeaconFn | undefined;
  private pending: EventPayload[] = [];
  private offline: EventPayload[] = [];
  private inFlight: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private destroyed = false;
  private onOfflineResume: (() => void) | undefined;
  private addEventListener: Window["addEventListener"];
  private removeEventListener: Window["removeEventListener"];

  constructor(opts: {
    endpoint: string;
    project: string;
    fetchFn: FetchFn;
    beaconFn?: BeaconFn;
    addEventListener: Window["addEventListener"];
    removeEventListener: Window["removeEventListener"];
  }) {
    this.endpoint = opts.endpoint;
    this.project = opts.project;
    this.fetchFn = opts.fetchFn;
    this.beaconFn = opts.beaconFn;
    this.addEventListener = opts.addEventListener;
    this.removeEventListener = opts.removeEventListener;

    this.onPageHide = this.onPageHide.bind(this);
    this.onOnline = this.onOnline.bind(this);
    this.addEventListener("pagehide", this.onPageHide);
    this.addEventListener("online", this.onOnline);

    this.intervalId = setInterval(() => void this.flushNow(), MAX_BATCH_INTERVAL_MS);
  }

  enqueue(event: EventPayload): void {
    if (this.pending.length >= MAX_QUEUE) this.pending.shift();
    this.pending.push(event);
    if (CRITICAL_TYPES.has(event.type)) void this.flushNow();
  }

  enqueueOffline(event: EventPayload): void {
    if (this.offline.length >= MAX_QUEUE) this.offline.shift();
    this.offline.push(event);
  }

  async flushNow(): Promise<void> {
    if (this.inFlight || this.destroyed) return;
    if (this.pending.length === 0) return;
    if (navigator.onLine === false) {
      this.offline.push(...this.pending);
      this.pending = [];
      return;
    }

    this.inFlight = true;
    try {
      const batch = this.pending;
      this.pending = [];

      let body = JSON.stringify(batch);
      const chunks: EventPayload[][] = [];
      if (contentLength(body) > MAX_PAYLOAD_BYTES) {
        let current: EventPayload[] = [];
        let size = 0;
        for (const ev of batch) {
          const s = JSON.stringify(ev);
          if (size + contentLength(s) > MAX_PAYLOAD_BYTES && current.length > 0) {
            chunks.push(current);
            current = [];
            size = 0;
          }
          current.push(ev);
          size += contentLength(s);
        }
        if (current.length > 0) chunks.push(current);
      } else {
        chunks.push(batch);
      }

      for (const chunk of chunks) {
        await this.sendChunk(chunk);
      }
    } finally {
      this.inFlight = false;
    }
  }

  private async sendChunk(chunk: EventPayload[]): Promise<void> {
    const body = JSON.stringify(chunk);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.fetchFn(this.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${this.project}` },
          body,
          keepalive: true,
        });

        if (res.ok) return;

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after") ?? 2_000) || 2_000;
          await sleep(retryAfter);
          continue;
        }
        if (res.status >= 500) {
          await sleep(backoffMs(attempt));
          continue;
        }
        // 4xx (except 429): permanent — drop.
        return;
      } catch {
        await sleep(backoffMs(attempt));
      }
    }
    // Exhausted retries: move to offline queue.
    this.offline.push(...chunk);
    if (this.offline.length > MAX_QUEUE) this.offline.splice(0, this.offline.length - MAX_QUEUE);
  }

  /** Flush the remaining buffer via sendBeacon (pagehide / visibility hidden). */
  flushOnHidden(): void {
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    const body = JSON.stringify(batch);
    let ok = false;
    if (this.beaconFn) {
      try {
        ok = this.beaconFn(this.endpoint, new Blob([body], { type: "application/json" }));
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      this.offline.push(...batch);
      if (this.offline.length > MAX_QUEUE) this.offline.splice(0, this.offline.length - MAX_QUEUE);
    }
  }

  private onPageHide(): void {
    this.flushOnHidden();
  }

  private onOnline(): void {
    const queued = this.offline;
    this.offline = [];
    for (const ev of queued) this.pending.push(ev);
    void this.flushNow();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.intervalId) clearInterval(this.intervalId);
    this.removeEventListener("pagehide", this.onPageHide);
    this.removeEventListener("online", this.onOnline);
    this.flushOnHidden();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

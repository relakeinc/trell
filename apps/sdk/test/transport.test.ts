import { describe, it, expect, vi } from "vitest";
import { Transport } from "../src/transport";
import { MAX_PAYLOAD_BYTES } from "@trell/shared";
import type { EventPayload } from "@trell/shared";

function fakeRes(status: number, retryAfter?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k === "retry-after" ? (retryAfter ?? null) : null) },
  } as unknown as Response;
}

function ev(over: Record<string, unknown> = {}): EventPayload {
  return {
    v: 1,
    event_id: "11111111-1111-4111-8111-111111111111",
    project: "pk_test",
    type: "form_start",
    ts: Date.now(),
    session_id: "sid",
    visitor_id: "vid",
    url: "https://x.com/a",
    page: { path: "/a", title: "A" },
    referrer: "",
    utm: null,
    device: { type: "desktop", os: "linux", browser: "chrome", viewport: [800, 600] },
    properties: {},
    form: { id: "c" },
    ...over,
  } as unknown as EventPayload;
}

function makeTransport(fetchFn: typeof fetch, beaconFn?: (url: string, data: BodyInit) => boolean) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const transport = new Transport({
    endpoint: "https://api.trell.dev/v1/events",
    project: "pk_test",
    fetchFn: fetchFn as unknown as typeof fetch,
    beaconFn: beaconFn as unknown as ((url: string, data: BodyInit) => boolean) | undefined,
    addEventListener: ((type: string, fn: unknown) => {
      handlers[type] = fn as (e: unknown) => void;
    }) as unknown as Window["addEventListener"],
    removeEventListener: (() => undefined) as unknown as Window["removeEventListener"],
  });
  return { transport, handlers };
}

describe("Transport", () => {
  it("batches non-critical events into a single request", async () => {
    const fetchFn = vi.fn(async (_i: string, _init: RequestInit) => fakeRes(204));
    const { transport } = makeTransport(fetchFn as unknown as typeof fetch);

    transport.enqueue(ev({ type: "form_view" }));
    transport.enqueue(ev());
    transport.enqueue(ev());

    await transport.flushNow();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchFn.mock.calls[0]![1]!.body as string) as unknown[];
    expect(body).toHaveLength(3);
  });

  it("flushes immediately for critical events", async () => {
    const fetchFn = vi.fn(async (_i: string, _init: RequestInit) => fakeRes(204));
    const { transport } = makeTransport(fetchFn as unknown as typeof fetch);
    transport.enqueue(ev({ type: "form_success" }));
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchFn.mock.calls[0]![1]!.body as string) as { type: string }[];
    expect(body[0]!.type).toBe("form_success");
  });

  it("sends the publishable key in the Authorization header", async () => {
    const fetchFn = vi.fn(async (_i: string, _init: RequestInit) => fakeRes(204));
    const { transport } = makeTransport(fetchFn as unknown as typeof fetch);
    transport.enqueue(ev({ type: "form_success" }));
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer pk_test");
    expect(headers["content-type"]).toBe("application/json");
  });

  it("splits payloads exceeding MAX_PAYLOAD_BYTES", async () => {
    const fetchFn = vi.fn(async (_i: string, _init: RequestInit) => fakeRes(204));
    const { transport } = makeTransport(fetchFn as unknown as typeof fetch);

    const big = "x".repeat(2000);
    const total = 60;
    const one = ev({ type: "form_view", properties: { p: big } });
    expect(JSON.stringify(Array.from({ length: total }, () => one)).length).toBeGreaterThan(MAX_PAYLOAD_BYTES);

    for (let i = 0; i < total; i++) transport.enqueue(one);
    await transport.flushNow();

    expect(fetchFn.mock.calls.length).toBeGreaterThan(1);
    const sum = fetchFn.mock.calls.reduce((acc, call) => {
      const body = JSON.parse((call[1]!.body as string)) as unknown[];
      return acc + body.length;
    }, 0);
    expect(sum).toBe(total);
  });

  it("retries on 5xx with backoff", async () => {
    vi.useFakeTimers();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(fakeRes(500))
      .mockResolvedValueOnce(fakeRes(500))
      .mockResolvedValue(fakeRes(204));
    const { transport } = makeTransport(fetchFn as unknown as typeof fetch);
    transport.enqueue(ev());
    const p = transport.flushNow();
    await vi.advanceTimersByTimeAsync(5000);
    await p;
    expect(fetchFn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("respects Retry-After on 429", async () => {
    vi.useFakeTimers();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(fakeRes(429, "50"))
      .mockResolvedValue(fakeRes(204));
    const { transport } = makeTransport(fetchFn as unknown as typeof fetch);
    transport.enqueue(ev());
    const p = transport.flushNow();
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(fetchFn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("drops events on permanent 4xx without retrying", async () => {
    const fetchFn = vi.fn(async (_i: string, _init: RequestInit) => fakeRes(400));
    const { transport } = makeTransport(fetchFn as unknown as typeof fetch);
    transport.enqueue(ev());
    await transport.flushNow();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("queues events offline on network failure, then flushes on online", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("network"));
    const { transport, handlers } = makeTransport(fetchFn as unknown as typeof fetch);
    transport.enqueue(ev());
    const p = transport.flushNow();
    await vi.advanceTimersByTimeAsync(5000);
    await p;
    expect(fetchFn).toHaveBeenCalledTimes(3); // exhausted retries -> offline

    fetchFn.mockResolvedValue(fakeRes(204));
    handlers.online?.({} as unknown as Event);
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();
    expect(fetchFn).toHaveBeenCalledTimes(4); // re-sent from offline queue
  });
});

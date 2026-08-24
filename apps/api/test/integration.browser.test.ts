import { describe, it, expect } from "vitest";
import { init } from "@trell/sdk";
import { TrellEngine } from "@trell/sdk";
import { createApp } from "../src/app";
import { MemoryRepo } from "../src/repositories/memory";
import { configFromEnv } from "../src/config";
import type { Repo } from "../src/repositories/types";

const PK = "pk_live_123";

async function makeApp(_env: NodeJS.ProcessEnv = {}): Promise<{ app: ReturnType<typeof createApp>; repo: Repo }> {
  const repo = new MemoryRepo();
  await repo.createOrganizationAndProject({
    name: "Site",
    slug: "site",
    organizationName: "Site",
    pk: PK,
    skHash: "sk_hash",
    domains: "example.com,*.example.com",
  });
  const config = configFromEnv({ TRELL_ADMIN_KEY: "admin", ..._env } as NodeJS.ProcessEnv);
  return { app: createApp({ repo, config }), repo };
}

function makeSDK(): { trell: TrellEngine; batches: unknown[][] } {
  const batches: unknown[][] = [];
  const fetchFn = async (_input: string, init: RequestInit) => {
    batches.push(JSON.parse(init.body as string) as unknown[]);
    return { ok: true, status: 204, headers: { get: () => null } } as unknown as Response;
  };
  const trell = init(
    { project: PK, endpoint: "https://t.test/v1/events", autoDetect: false },
    { win: window as unknown as Window, fetchFn: fetchFn as unknown as typeof fetch, beaconFn: (() => true) as unknown as (url: string, data: BodyInit) => boolean },
  ) as TrellEngine;
  return { trell, batches };
}

async function post(app: ReturnType<typeof createApp>, body: unknown, extraHeaders: Record<string, string> = {}) {
  return app.request("/v1/events", {
    method: "POST",
    headers: { authorization: `Bearer ${PK}`, origin: "https://example.com", "content-type": "application/json", ...extraHeaders },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("SDK → API (integration)", () => {
  it("the SDK envelope is accepted by the ingestion endpoint", async () => {
    const { app } = await makeApp();
    const { trell, batches } = makeSDK();

    trell.track("form_success", { form: "c", properties: { plan: "pro" } });
    await trell.flushNow();

    expect(batches).toHaveLength(1);
    const res = await post(app, batches[0]!);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ inserted: 1, duplicates: 0 });
    void app;
  });

  it("deduplicates when the same event_id is sent twice", async () => {
    const { app } = await makeApp();
    const { trell, batches } = makeSDK();
    trell.track("form_success", { form: "c" });
    await trell.flushNow();

    const body = batches[0]!;
    expect((await post(app, body)).status).toBe(202);
    const second = await post(app, body);
    expect(second.status).toBe(202);
    expect(await second.json()).toEqual({ inserted: 0, duplicates: 1 });
  });

  it("rejects an origin not in the allowlist", async () => {
    const { app } = await makeApp();
    const { trell, batches } = makeSDK();
    trell.track("form_success", { form: "c" });
    await trell.flushNow();

    const res = await post(app, batches[0]!, { origin: "https://evil.com" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("origin_not_allowed");
  });

  it("rate-limits after the threshold (429)", async () => {
    const { app } = await makeApp({ TRELL_RATE_LIMIT_MAX: "2" });
    const { trell, batches } = makeSDK();
    trell.track("form_success", { form: "c" });
    await trell.flushNow();
    const body = batches[0]!;

    await post(app, body);
    await post(app, body);
    const third = await post(app, body);
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
  });

  it("responds with CORS headers for an allowed origin", async () => {
    const { app } = await makeApp();
    const { trell, batches } = makeSDK();
    trell.track("form_success", { form: "c" });
    await trell.flushNow();

    const res = await post(app, batches[0]!);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://example.com");
  });
});

import { describe, it, expect } from "vitest";
import { createApp } from "../src/app";
import { MemoryRepo } from "../src/repositories/memory";
import { configFromEnv, type ApiConfig } from "../src/config";
import type { Repo } from "../src/repositories/types";

const PK = "pk_live_123";
const ADMIN = "TEST_ADMIN_KEY";

async function makeApp(seed = true): Promise<{ app: ReturnType<typeof createApp>; repo: Repo; config: ApiConfig }> {
  const config = configFromEnv({ TRELL_ADMIN_KEY: ADMIN } as NodeJS.ProcessEnv);
  const repo = new MemoryRepo();
  const app = createApp({ repo, config });
  if (seed) {
    await repo.createOrganizationAndProject({
      name: "Site",
      slug: "site",
      organizationName: "Site",
      pk: PK,
      skHash: "sk_hash",
      domains: "example.com,*.example.com",
    });
  }
  return { app, repo, config };
}

function validEvent(): string {
  return JSON.stringify({
    v: 1,
    event_id: "11111111-1111-4111-8111-111111111111",
    project: PK,
    type: "form_submit",
    ts: 1_700_000_000_000,
    session_id: "sid",
    visitor_id: "vid",
    url: "https://example.com/a",
    page: { path: "/a", title: "A" },
    referrer: "https://google.com",
    utm: null,
    device: { type: "desktop", os: "linux", browser: "chrome", viewport: [800, 600] },
    properties: {},
    form: { id: "c" },
    valid: true,
  });
}

async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  return { authorization: `Bearer ${PK}`, origin: "https://example.com", "content-type": "application/json", ...extra };
}

describe("API auth + ingestion", () => {
  it("GET /health returns ok", async () => {
    const { app } = await makeApp(false);
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("accepts a valid event from an allowed origin", async () => {
    const { app } = await makeApp();
    const res = await app.request("/v1/events", { method: "POST", headers: await headers(), body: validEvent() });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ inserted: 1, duplicates: 0 });
  });

  it("returns 401 when the API key is missing", async () => {
    const { app } = await makeApp();
    const res = await app.request("/v1/events", { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: validEvent() });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("missing_api_key");
  });

  it("returns 401 when the API key is invalid", async () => {
    const { app } = await makeApp();
    const res = await app.request("/v1/events", { method: "POST", headers: { authorization: "Bearer pk_bogus", origin: "https://example.com", "content-type": "application/json" }, body: validEvent() });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("invalid_api_key");
  });

  it("returns 403 for a domain not in the allowlist", async () => {
    const { app } = await makeApp();
    const res = await app.request("/v1/events", { method: "POST", headers: await headers({ origin: "https://evil.com" }), body: validEvent() });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("origin_not_allowed");
  });

  it("returns 400 for an invalid event payload", async () => {
    const { app } = await makeApp();
    const bad = JSON.parse(validEvent());
    delete bad.project;
    const res = await app.request("/v1/events", { method: "POST", headers: await headers(), body: JSON.stringify(bad) });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_event");
  });

  it("deduplicates by event_id", async () => {
    const { app } = await makeApp();
    await app.request("/v1/events", { method: "POST", headers: await headers(), body: validEvent() });
    const res = await app.request("/v1/events", { method: "POST", headers: await headers(), body: validEvent() });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ inserted: 0, duplicates: 1 });
  });
});

describe("bootstrap (admin) endpoint", () => {
  it("creates a project and returns pk + sk once (sk stored hashed)", async () => {
    const { app, repo } = await makeApp(false);
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { authorization: `Bearer ${ADMIN}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "My Site", domains: ["example.com"] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.keys.pk).toMatch(/^pk_/);
    expect(body.keys.sk).toMatch(/^sk_/);
    const project = await repo.findProjectByPublishableKey(body.keys.pk);
    expect(project?.apiKeyHash).not.toBe(body.keys.sk);
    expect(project?.domains).toBe("example.com");
  });

  it("rejects without the admin key", async () => {
    const { app } = await makeApp(false);
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Site" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 503 when the admin key is not configured", async () => {
    const { app } = await makeApp(false);
    const config = configFromEnv({} as NodeJS.ProcessEnv);
    const bypass = createApp({ repo: app.repo as Repo, config });
    const res = await bypass.request("/v1/projects", {
      method: "POST",
      headers: { authorization: `Bearer anything`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Site" }),
    });
    expect(res.status).toBe(503);
  });
});

import { describe, it, expect } from "vitest";
import { createApp } from "../src/app";
import { MemoryRepo } from "../src/repositories/memory";
import { configFromEnv } from "../src/config";
import { hashSk } from "../src/lib/crypto";
import type { Repo, StoredEvent } from "../src/repositories/types";

const SK = "sk_secret_test";
const PK = "pk_live_123";

async function makeApp() {
  const repo = new MemoryRepo();
  const project = await repo.createOrganizationAndProject({
    name: "Site",
    slug: "site",
    organizationName: "Site",
    pk: PK,
    skHash: hashSk(SK),
    domains: "example.com",
  });
  const app = createApp({
    repo,
    config: configFromEnv({ TRELL_ADMIN_KEY: "admin" } as NodeJS.ProcessEnv),
  });
  return { app, repo, projectId: project.id };
}

function events(): StoredEvent[] {
  return [
    { eventId: "e1", type: "form_view", ts: new Date("2026-01-05T10:00:00Z"), sessionId: "s", visitorId: "v", url: "https://example.com/a", referrer: "https://google.com", pagePath: "/a", pageTitle: "A", utmSource: "google", utmMedium: "cpc", utmCampaign: null, utmTerm: null, utmContent: null, deviceType: "mobile", os: "ios", browser: "safari", viewportWidth: 390, viewportHeight: 844, formId: null, formName: null, properties: null, raw: null },
    { eventId: "e2", type: "form_start", ts: new Date("2026-01-05T10:00:01Z"), sessionId: "s", visitorId: "v", url: "https://example.com/a", referrer: "https://google.com", pagePath: "/a", pageTitle: "A", utmSource: "google", utmMedium: "cpc", utmCampaign: null, utmTerm: null, utmContent: null, deviceType: "mobile", os: "ios", browser: "safari", viewportWidth: 390, viewportHeight: 844, formId: "c", formName: "Contacto", properties: null, raw: null },
    { eventId: "e3", type: "form_success", ts: new Date("2026-01-05T10:00:11Z"), sessionId: "s", visitorId: "v", url: "https://example.com/a", referrer: "https://google.com", pagePath: "/a", pageTitle: "A", utmSource: "google", utmMedium: "cpc", utmCampaign: null, utmTerm: null, utmContent: null, deviceType: "mobile", os: "ios", browser: "safari", viewportWidth: 390, viewportHeight: 844, formId: "c", formName: "Contacto", properties: null, raw: null },
  ];
}

async function seedEvents(repo: Repo, projectId: string) {
  await repo.insertEvents({ projectId, events: events() });
}

const headers = () => ({ authorization: `Bearer ${SK}`, "content-type": "application/json" });

describe("analytics routes (sk auth)", () => {
  it("rejects a request with the publishable key (pk)", async () => {
    const { app, projectId } = await makeApp();
    const res = await app.request(`/v1/projects/${projectId}/stats`, {
      headers: { authorization: `Bearer ${PK}` },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid secret key", async () => {
    const { app, projectId } = await makeApp();
    const res = await app.request(`/v1/projects/${projectId}/stats`, { headers: { authorization: "Bearer wrong" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown project", async () => {
    const { app } = await makeApp();
    const res = await app.request("/v1/projects/nope/stats", { headers: headers() });
    expect(res.status).toBe(404);
  });

  it("GET /stats returns the metric summary", async () => {
    const { app, repo, projectId } = await makeApp();
    await seedEvents(repo, projectId);
    const res = await app.request(`/v1/projects/${projectId}/stats`, { headers: headers() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics.views).toBe(1);
    expect(body.metrics.starts).toBe(1);
    expect(body.metrics.successes).toBe(1);
    expect(body.metrics.conversionRate).toBe(1);
    expect(body.metrics.avgTimeToCompleteMs).toBeCloseTo(10_000);
    expect(body.projectId).toBe(projectId);
  });

  it("GET /series groups the events", async () => {
    const { app, repo, projectId } = await makeApp();
    await seedEvents(repo, projectId);
    const res = await app.request(`/v1/projects/${projectId}/series?interval=day`, { headers: headers() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.interval).toBe("day");
    expect(body.series).toHaveLength(1);
    expect(body.series[0]).toMatchObject({ views: 1, starts: 1, successes: 1 });
  });

  it("GET /breakdown groups by a dimension", async () => {
    const { app, repo, projectId } = await makeApp();
    await seedEvents(repo, projectId);
    const res = await app.request(`/v1/projects/${projectId}/breakdown?dimension=utm_source`, { headers: headers() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dimension).toBe("utm_source");
    expect(body.rows[0]).toMatchObject({ key: "google", count: 3 });
  });

  it("GET /forms lists the tracked forms", async () => {
    const { app, repo, projectId } = await makeApp();
    await seedEvents(repo, projectId);
    const res = await app.request(`/v1/projects/${projectId}/forms`, { headers: headers() });
    const body = await res.json();
    expect(body.forms[0]).toMatchObject({ id: "c", name: "Contacto", events: 2, successes: 1 });
  });

  it("returns 400 for an invalid dimension", async () => {
    const { app, repo, projectId } = await makeApp();
    await seedEvents(repo, projectId);
    const res = await app.request(`/v1/projects/${projectId}/breakdown?dimension=not_a_dim`, { headers: headers() });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_dimension");
  });

  it("returns 400 for an invalid interval", async () => {
    const { app, repo, projectId } = await makeApp();
    await seedEvents(repo, projectId);
    const res = await app.request(`/v1/projects/${projectId}/series?interval=decade`, { headers: headers() });
    expect(res.status).toBe(400);
  });
});

import { describe, it, expect } from "vitest";
import { createApp } from "../src/app";
import { MemoryRepo } from "../src/repositories/memory";
import { configFromEnv } from "../src/config";
import { hashSk } from "../src/lib/crypto";
import { computeSeries } from "../src/analytics/metrics";
import type { Repo, StoredEvent } from "../src/repositories/types";

const SK = "sk_test";
const PK = "pk_test";
const auth = { authorization: `Bearer ${SK}`, "content-type": "application/json" };

async function makeEnv(): Promise<{ app: ReturnType<typeof createApp>; repo: Repo; projectId: string }> {
  const repo = new MemoryRepo();
  const project = await repo.createOrganizationAndProject({
    name: "Test",
    slug: "test",
    organizationName: "Test",
    pk: PK,
    skHash: hashSk(SK),
    domains: "example.com",
  });
  const app = createApp({ repo, config: configFromEnv({ TRELL_ADMIN_KEY: "admin" } as NodeJS.ProcessEnv) });
  return { app, repo, projectId: project.id };
}

async function stats(app: ReturnType<typeof createApp>, projectId: string, qs = ""): Promise<Record<string, number | null>> {
  const res = await app.request(`/v1/projects/${projectId}/stats${qs}`, { headers: auth });
  expect(res.status).toBe(200);
  return (await res.json()).metrics as Record<string, number | null>;
}

let seq = 0;
function ev(over: Partial<StoredEvent> = {}): StoredEvent {
  seq++;
  return {
    eventId: "test-" + seq,
    type: "form_view",
    ts: new Date(Date.now() - 3 * 86_400_000),
    sessionId: "s" + (seq % 50),
    visitorId: "v" + (seq % 30),
    url: "https://example.com/a",
    referrer: "https://google.com",
    pagePath: "/a",
    pageTitle: "A",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    deviceType: "desktop",
    os: "linux",
    browser: "chrome",
    viewportWidth: 1280,
    viewportHeight: 800,
    formId: "form-a",
    formName: "Formulario A",
    properties: null,
    raw: null,
    ...over,
  };
}

describe("Form A scenario (exact numbers)", () => {
  it("shows conversion 25% and start conversion ≈ 41.67%", async () => {
    const { app, repo, projectId } = await makeEnv();
    const formA = { formId: "form-a", formName: "Formulario A" };
    const events: StoredEvent[] = [];

    // 25 matched start/success pairs (10s each) => avg 10_000
    for (let i = 0; i < 25; i++) {
      const s = new Date(Date.now() - (i + 1) * 60_000);
      events.push(ev({ type: "form_start", formId: "form-a", formName: "Formulario A", sessionId: "sp" + i, visitorId: "vp" + i, ts: s }));
      events.push(ev({ type: "form_success", formId: "form-a", formName: "Formulario A", sessionId: "sp" + i, visitorId: "vp" + i, ts: new Date(s.getTime() + 10_000) }));
    }
    for (let i = 25; i < 60; i++) events.push(ev({ type: "form_start", ...formA, sessionId: "si" + i, visitorId: "vi" + i }));
    for (let i = 0; i < 100; i++) events.push(ev({ type: "form_view", ...formA }));
    for (let i = 0; i < 40; i++) events.push(ev({ type: "form_submit", ...formA }));
    for (let i = 0; i < 15; i++) events.push(ev({ type: "form_abandon", ...formA }));

    await repo.insertEvents({ projectId, events });

    const m = await stats(app, projectId);
    expect(m.views).toBe(100);
    expect(m.starts).toBe(60);
    expect(m.submits).toBe(40);
    expect(m.successes).toBe(25);
    expect(m.abandons).toBe(15);
    expect(m.conversionRate!).toBeCloseTo(0.25, 5); // 25%
    expect(m.startConversionRate!).toBeCloseTo(25 / 60, 5); // 41.67%
    expect(m.avgTimeToCompleteMs!).toBeCloseTo(10_000, 0);
  });
});

describe("metric edge cases", () => {
  it("repeated sessions do not inflate visitors", async () => {
    const { app, repo, projectId } = await makeEnv();
    await repo.insertEvents({
      projectId,
      events: [
        ev({ sessionId: "a", visitorId: "v1", type: "form_view", formId: "form-a" }),
        ev({ sessionId: "b", visitorId: "v1", type: "form_view", formId: "form-a" }),
        ev({ sessionId: "c", visitorId: "v1", type: "form_view", formId: "form-a" }),
      ],
    });
    const m = await stats(app, projectId);
    expect(m.visitors).toBe(1);
    expect(m.sessions).toBe(3);
  });

  it("a repeated event_id is not double counted", async () => {
    const { app, repo, projectId } = await makeEnv();
    const e = ev({ type: "form_success", formId: "form-a" });
    await repo.insertEvents({ projectId, events: [e] });
    await repo.insertEvents({ projectId, events: [{ ...e }] }); // same event_id
    const m = await stats(app, projectId);
    expect(m.successes).toBe(1);
  });

  it("events outside the date range are excluded", async () => {
    const { app, repo, projectId } = await makeEnv();
    const inRange = ev({ type: "form_success", formId: "form-a" });
    const out = ev({ type: "form_success", formId: "form-a", eventId: "out", ts: new Date(Date.now() - 200 * 86_400_000) });
    await repo.insertEvents({ projectId, events: [inRange, out] });
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const m = await stats(app, projectId, `?from=${encodeURIComponent(from)}`);
    expect(m.successes).toBe(1);
  });

  it("a form with no successes does not break metrics", async () => {
    const { app, repo, projectId } = await makeEnv();
    await repo.insertEvents({
      projectId,
      events: [
        ev({ type: "form_view", formId: "form-b", formName: "B" }),
        ev({ type: "form_start", formId: "form-b", formName: "B", sessionId: "sb1", visitorId: "vb1" }),
      ],
    });
    const m = await stats(app, projectId);
    expect(m.successes).toBe(0);
    expect(m.conversionRate).toBe(0); // 0 views-success / 1 view
    expect(m.startConversionRate).toBe(0);
  });

  it("avgTimeToCompleteMs ignores incomplete sessions", async () => {
    const { app, repo, projectId } = await makeEnv();
    await repo.insertEvents({
      projectId,
      events: [ev({ type: "form_start", formId: "form-a", sessionId: "ss", visitorId: "vs" })],
    });
    const m = await stats(app, projectId);
    expect(m.avgTimeToCompleteMs).toBeNull();
  });

  it("week produces consistent groupings", async () => {
    const weekOf = new Date(Date.now());
    const one = ev({ type: "form_view", formId: "form-a", ts: weekOf });
    const earlierWeek = new Date(weekOf.getTime() - 8 * 86_400_000); // previous week
    const two = ev({ type: "form_view", formId: "form-a", ts: earlierWeek });
    const series = computeSeries([one, two], "week");
    expect(series).toHaveLength(2);
    expect(series[0]!.bucket).toBeLessThan(series[1]!.bucket);
  });

  it("breakdown counts sum to the total events", async () => {
    const { app, repo, projectId } = await makeEnv();
    const total = 6;
    await repo.insertEvents({
      projectId,
      events: [
        ev({ deviceType: "desktop" }),
        ev({ deviceType: "desktop" }),
        ev({ deviceType: "mobile" }),
        ev({ deviceType: "tablet" }),
        ev({ deviceType: "desktop" }),
        ev({ deviceType: "mobile" }),
      ],
    });
    const res = await app.request(`/v1/projects/${projectId}/breakdown?dimension=device`, { headers: auth });
    const body = await res.json();
    const sum = body.rows.reduce((acc: number, r: { count: number }) => acc + r.count, 0);
    expect(sum).toBe(total);
    expect(body.rows[0].key).toBe("desktop");
  });
});

import type { Repo, StoredEvent } from "../repositories/types";
import { newApiKeys } from "../lib/crypto";

export interface SyntheticSeed {
  projectId: string;
  pk: string;
  sk: string;
  inserted: number;
  duplicates: number;
}

/**
 * Seeds the "Form A" validation scenario plus edge cases so the dev dashboard
 * can be checked against known numbers.
 *
 *   Form A: 100 views · 60 starts · 40 submits · 25 successes · 15 abandons
 *   => conversionRate      = 25 / 100 = 25%
 *   => startConversionRate = 25 / 60  ≈ 41.67%
 *   => avgTimeToCompleteMs = 10_000 (25 matched start/success pairs)
 *
 * Edge cases:
 *   - form-b has starts but NO success (must not break metrics)
 *   - one duplicate event_id insertion (must be deduped)
 *   - a few events outside the 30-day window (must be filtered by `from`)
 */
export async function seedSyntheticEvents(repo: Repo, days = 30): Promise<SyntheticSeed> {
  const { pk, sk, skHash } = newApiKeys("pk", "sk");
  const project = await repo.createOrganizationAndProject({
    name: "Synthetic Site",
    slug: "synthetic",
    organizationName: "Synthetic Site",
    pk,
    skHash,
    domains: "example.com,*.example.com",
  });

  const evs: StoredEvent[] = [];
  let n = 0;
  const nextId = () => "syn-" + ++n;

  function mk(type: string, opts: Partial<StoredEvent> = {}): StoredEvent {
    const ts = opts.ts ?? new Date(Date.now() - (n % days) * 86_400_000);
    const sessionId = opts.sessionId ?? "s" + (n % 50);
    const visitorId = opts.visitorId ?? "v" + (n % 50);
    return {
      eventId: nextId(),
      type,
      ts,
      sessionId,
      visitorId,
      url: "https://example.com/form",
      referrer: "https://google.com",
      pagePath: "/form",
      pageTitle: "Form",
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
      ...opts,
    };
  }

  const base = Date.now() - days * 86_400_000;
  const formA = { formId: "form-a", formName: "Formulario A" };

  // 25 matched start/success pairs => avg 10s
  for (let i = 0; i < 25; i++) {
    const startTs = new Date(base + i * 3_600_000);
    evs.push(mk("form_start", { ...formA, sessionId: "sp" + i, visitorId: "vp" + i, ts: startTs }));
    evs.push(mk("form_success", { ...formA, sessionId: "sp" + i, visitorId: "vp" + i, ts: new Date(startTs.getTime() + 10_000) }));
  }
  // remaining starts (incomplete sessions -> no success)
  for (let i = 25; i < 60; i++) {
    evs.push(mk("form_start", { ...formA, sessionId: "si" + i, visitorId: "vi" + i, ts: new Date(base + i * 3_600_000) }));
  }
  for (let i = 0; i < 100; i++) evs.push(mk("form_view", formA));
  for (let i = 0; i < 40; i++) evs.push(mk("form_submit", formA));
  for (let i = 0; i < 15; i++) evs.push(mk("form_abandon", formA));

  // edge: form-b has starts but NO success
  for (let i = 0; i < 20; i++) evs.push(mk("form_start", { formId: "form-b", formName: "Formulario B", sessionId: "sb" + i, visitorId: "vb" + i }));
  for (let i = 0; i < 10; i++) evs.push(mk("form_view", { formId: "form-b", formName: "Formulario B" }));

  // edge: a couple of events way outside the 30-day window
  evs.push(mk("form_view", { ...formA, ts: new Date(Date.now() - (days + 45) * 86_400_000) }));
  evs.push(mk("form_success", { ...formA, ts: new Date(Date.now() - (days + 45) * 86_400_000) }));

  // edge: a duplicate event_id (must be deduped — same id as an existing view)
  const origView = evs.find((e) => e.type === "form_view");
  if (origView) evs.push({ ...origView });

  const res = await repo.insertEvents({ projectId: project.id, events: evs });

  return {
    projectId: project.id,
    pk,
    sk,
    inserted: res.inserted,
    duplicates: res.duplicates,
  };
}

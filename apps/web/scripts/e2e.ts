/**
 * Live end-to-end smoke (Prompt 08). Requires a running Postgres (DATABASE_URL),
 * a built Next app, and a reachable Google OAuth config — but login is simulated
 * by inserting an Auth.js database session directly, so no browser is needed.
 *
 *   cd apps/web && pnpm e2e          (DATABASE_URL must point at Postgres)
 *   DATABASE_URL=postgresql://trell:trell@localhost:5432/trell pnpm e2e
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, createWriteStream, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const LOG_WEB = "/tmp/e2e-web.log";
const LOG_API = "/tmp/e2e-api.log";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, "..");
const API_DIR = path.resolve(WEB_DIR, "../api");
const ROOT = path.resolve(WEB_DIR, "../..");

const API_PORT = 8787;
const WEB_PORT = 3000;
const DB = process.env.DATABASE_URL || "postgresql://trell:trell@localhost:5432/trell";

function envFromDotenv(): Record<string, string> {
  const env: Record<string, string> = {};
  const p = path.join(WEB_DIR, ".env");
  if (!existsSync(p)) return env;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!.trim();
  }
  return env;
}

function start(cmd: string, args: string[], env: Record<string, string>, cwd: string, logFile: string): ChildProcess {
  try {
    unlinkSync(logFile);
  } catch {
    /* ignore */
  }
  const out = createWriteStream(logFile, { flags: "a" });
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => out.write(d));
  child.stderr?.on("data", (d) => out.write(d));
  child.on("error", (e) => console.error(`spawn error (${cmd}):`, e.message));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${cmd}] exited with ${code}`);
    }
  });
  return child;
}

function tailLog(file: string): string {
  try {
    return readFileSync(file, "utf8").slice(-2000);
  } catch {
    return "(no log)";
  }
}

async function waitFor(url: string, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.status > 0) return true;
    } catch {
      /* not ready */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " · " + detail : ""}`);
}

function authedFetch(token: string) {
  return {
    cookie: `authjs.session-token=${token}`,
    fetch: (url: string, init?: RequestInit) =>
      fetch(url, { ...init, headers: { ...(init?.headers ?? {}), cookie: `authjs.session-token=${token}` } }),
  };
}

function validEvent(pk: string, eventId: string, ts: number) {
  return {
    v: 1,
    event_id: eventId,
    project: pk,
    type: "form_submit",
    ts,
    session_id: "sess-1",
    visitor_id: "vis-1",
    url: "https://example.com/contact",
    page: { path: "/contact", title: "Contact" },
    referrer: "https://google.com",
    utm: null,
    device: { type: "desktop", os: "linux", browser: "chrome", viewport: [1280, 800] },
    properties: {},
    form: { id: "contact", name: "Contact" },
    valid: true,
  };
}

function assertNoSecret(bodyText: string, sk: string | null, what: string) {
  check(`no sk in ${what}`, sk ? !bodyText.includes(sk) : true);
}

const prisma = new PrismaClient();
let api: ChildProcess | null = null;
let web: ChildProcess | null = null;

async function makeUser(email: string) {
  const user = await prisma.user.create({ data: { email, name: email.split("@")[0]! } });
  const sessionToken = "sess_" + crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });
  return { user, token: sessionToken };
}

async function main() {
  process.env.DATABASE_URL = DB;

  console.log(`▸ using Postgres ${DB}`);
  const dotenv = envFromDotenv();

  api = start(
    path.join(API_DIR, "node_modules/.bin/tsx"),
    ["src/index.ts"],
    { DATABASE_URL: DB, PORT: String(API_PORT), TRELL_ADMIN_KEY: "devadmin" },
    API_DIR,
    LOG_API,
  );
  web = start(
    path.join(WEB_DIR, "node_modules/.bin/next"),
    ["start", "-p", String(WEB_PORT)],
    { ...dotenv, DATABASE_URL: DB, AUTH_URL: `http://localhost:${WEB_PORT}`, NODE_ENV: "production" },
    WEB_DIR,
    LOG_WEB,
  );

  const apiUp = await waitFor(`http://localhost:${API_PORT}/health`, 30_000);
  const webUp = await waitFor(`http://localhost:${WEB_PORT}/`, 45_000);
  if (!apiUp || !webUp) {
    check("servers started", false, `api=${apiUp} web=${webUp}`);
    return;
  }
  check("servers started", true, `api → :${API_PORT}, web → :${WEB_PORT}`);

  // 1) unauthenticated
  const noauth = await fetch(`http://localhost:${WEB_PORT}/api/projects`, { redirect: "manual" });
  check("unauthenticated /api/projects → 401", noauth.status === 401, `got ${noauth.status}`);

  const dashNoSession = await fetch(`http://localhost:${WEB_PORT}/dashboard`, { redirect: "manual" });
  check(
    "no session → redirect to /signin",
    [302, 307].includes(dashNoSession.status) && /signin/.test(dashNoSession.headers.get("location") ?? ""),
    `got ${dashNoSession.status} ${dashNoSession.headers.get("location")}`,
  );

  // 2) user 1 (owner)
  const run = Date.now();
  const u1 = await makeUser(`owner-${run}@trell.dev`);
  const A = authedFetch(u1.token);

  const created = await A.fetch(`http://localhost:${WEB_PORT}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Site A " + run, domains: ["example.com"] }),
  });
  const createdText = await created.text();
  console.log(`[e2e] create status=${created.status} body=${createdText.slice(0, 200)}`);
  let createdBody: Record<string, any> = {};
  try {
    createdBody = JSON.parse(createdText);
  } catch {
    check("create project → 201 + pk + sk", false, "non-JSON response");
  }
  check("create project → 201 + pk + sk (shown once)", created.status === 201 && createdBody.keys?.pk?.startsWith("pk_") && createdBody.keys?.sk?.startsWith("sk_"));
  if (!createdBody?.keys) {
    console.error("\n--- WEB LOG ---\n" + tailLog(LOG_WEB));
    return;
  }
  const sk = createdBody.keys.sk as string;
  const pk = createdBody.keys.pk as string;
  const projectId = createdBody.project.id as string;

  // list must not leak sk
  const list = await A.fetch(`http://localhost:${WEB_PORT}/api/projects`);
  const listText = await list.text();
  check("list projects hides sk", !listText.includes(sk) && listText.includes(projectId!));

  // 3) installation status (waiting)
  const status0 = await A.fetch(`http://localhost:${WEB_PORT}/api/projects/${projectId}`);
  const statusBody0 = await status0.json();
  check("installation → waiting for first event", statusBody0.installation?.connected === false, JSON.stringify(statusBody0.installation));
  assertNoSecret(JSON.stringify(statusBody0), sk, "project status");

  // 4) ingestion (allowed origin)
  const ingest = await fetch(`http://localhost:${API_PORT}/v1/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${pk}`, origin: "https://example.com", "content-type": "application/json" },
    body: JSON.stringify([validEvent(pk, crypto.randomUUID(), Date.now())]),
  });
  check("ingest allowed origin → 202", ingest.status === 202, `got ${ingest.status}`);

  // 5) reflect allowlist: evil origin rejected
  const evil = await fetch(`http://localhost:${API_PORT}/v1/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${pk}`, origin: "https://evil.com", "content-type": "application/json" },
    body: JSON.stringify([validEvent(pk, crypto.randomUUID(), Date.now())]),
  });
  check("disallowed origin → 403", evil.status === 403, `got ${evil.status}`);

  // 6) stats relay hides secrets
  const stats = await A.fetch(`http://localhost:${WEB_PORT}/api/projects/${projectId}/stats`);
  const statsText = await stats.text();
  check("relay stats → 200", stats.status === 200);
  assertNoSecret(statsText, sk, "relay stats");
  assertNoSecret(statsText, pk, "relay stats (pk)");
  const statsBody = JSON.parse(statsText);
  check("relay reflects the ingested submit (submits=1, views=0)", statsBody.metrics?.submits === 1 && statsBody.metrics?.views === 0, `submits=${statsBody.metrics?.submits} views=${statsBody.metrics?.views}`);

  // 7) installation now connected
  const status1 = await A.fetch(`http://localhost:${WEB_PORT}/api/projects/${projectId}`);
  const statusBody1 = await status1.json();
  check("installation → connected + lastEventAt", statusBody1.installation?.connected === true && !!statusBody1.installation?.lastEventAt);

  // 8) rotate secret: old sk invalidated, new sk works (direct Hono auth check)
  const rot = await A.fetch(`http://localhost:${WEB_PORT}/api/projects/${projectId}/rotate-secret`, { method: "POST" });
  const rotBody = await rot.json();
  const sk2 = rotBody?.keys?.sk as string;
  check("rotate secret → new sk, owner only", rot.status === 200 && sk2?.startsWith("sk_"));
  const oldStats = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/stats`, { headers: { authorization: `Bearer ${sk}` } });
  check("old sk invalidated after rotate → 401", oldStats.status === 401, `got ${oldStats.status}`);
  const newStats = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/stats`, { headers: { authorization: `Bearer ${sk2}` } });
  check("new sk works after rotate → 200", newStats.status === 200, `got ${newStats.status}`);

  // 9) allowlist edit + validation
  const patch = await A.fetch(`http://localhost:${WEB_PORT}/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ addDomain: "Evil.com " }),
  });
  const patchBody = await patch.json();
  check("PATCH addDomain (normalized + deduped)", patch.status === 200 && patchBody.project.domains.includes("evil.com"), JSON.stringify(patchBody.project.domains));
  const bad = await A.fetch(`http://localhost:${WEB_PORT}/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ addDomain: "not a domain" }),
  });
  check("PATCH invalid domain → 400", bad.status === 400, `got ${bad.status}`);

  // 9) cross-user authorization → 403
  const u2 = await makeUser(`other-${run}@trell.dev`);
  const B = authedFetch(u2.token);
  const forbidden = await B.fetch(`http://localhost:${WEB_PORT}/api/projects/${projectId}/stats`);
  check("non-member → 403", forbidden.status === 403, `got ${forbidden.status}`);
  const listB = await B.fetch(`http://localhost:${WEB_PORT}/api/projects`);
  const listBText = await listB.text();
  check("non-member list excludes project", !listBText.includes(projectId!));

  // 10) funnel CRUD via API (using new sk2)
  const createFunnel = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/funnels`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${sk2}` },
    body: JSON.stringify({ name: "E2E Funnel", steps: [
      { eventType: "form_view", position: 0 },
      { eventType: "form_start", position: 1 },
      { eventType: "form_success", position: 2 },
    ]}),
  });
  const funnelBody = await createFunnel.json();
  const funnelId = funnelBody?.funnel?.id as string;
  check("create funnel → 201 + id", createFunnel.status === 201 && funnelId?.length > 0);

  const listFunnels = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/funnels`, { headers: { authorization: `Bearer ${sk2}` } });
  check("list funnels → 200 + 1 funnel", listFunnels.status === 200, `got ${listFunnels.status}`);

  const getFunnel = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/funnels/${funnelId}`, { headers: { authorization: `Bearer ${sk2}` } });
  check("get funnel → 200 + correct name", getFunnel.status === 200, `got ${getFunnel.status}`);

  // 11) funnel-live computation
  const funnelLive = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/funnel-live?funnelId=${funnelId}`, { headers: { authorization: `Bearer ${sk2}` } });
  const funnelLiveBody = await funnelLive.json();
  check("funnel-live → 200 + steps array", funnelLive.status === 200 && Array.isArray(funnelLiveBody?.steps), `got ${funnelLive.status}`);

  // 12) saved views CRUD
  const createView = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/views`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${sk2}` },
    body: JSON.stringify({ name: "My View", type: "funnel", config: { funnelId } }),
  });
  const viewBody = await createView.json();
  const viewId = viewBody?.view?.id as string;
  check("create saved view → 201 + id", createView.status === 201 && viewId?.length > 0);

  const listViews = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/views`, { headers: { authorization: `Bearer ${sk2}` } });
  check("list views → 200 + 1 view", listViews.status === 200, `got ${listViews.status}`);

  // 13) drill-down: events with funnelId
  const drilldown = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/events?funnelId=${funnelId}&limit=5`, { headers: { authorization: `Bearer ${sk2}` } });
  check("drill-down events → 200", drilldown.status === 200, `got ${drilldown.status}`);

  // 14) segmentation on stats
  const segStats = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/stats?device=desktop`, { headers: { authorization: `Bearer ${sk2}` } });
  check("segmented stats → 200", segStats.status === 200, `got ${segStats.status}`);

  // 15) cleanup: delete view, delete funnel
  const delView = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/views/${viewId}`, { method: "DELETE", headers: { authorization: `Bearer ${sk2}` } });
  check("delete view → 200", delView.status === 200, `got ${delView.status}`);
  const delFunnel = await fetch(`http://localhost:${API_PORT}/v1/projects/${projectId}/funnels/${funnelId}`, { method: "DELETE", headers: { authorization: `Bearer ${sk2}` } });
  check("delete funnel → 200", delFunnel.status === 200, `got ${delFunnel.status}`);

  // 16) dashboard HTML does not embed sk
  const dash = await A.fetch(`http://localhost:${WEB_PORT}/dashboard`);
  const dashText = await dash.text();
  check("dashboard HTML hides sk", dash.status === 200 && !dashText.includes(sk));
}

async function teardown() {
  await prisma.$disconnect().catch(() => {});
  api?.kill("SIGTERM");
  web?.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 500));
}

main()
  .catch((e) => {
    console.error("E2E error:", e);
    results.push({ name: "e2e", ok: false, detail: String(e) });
  })
  .finally(async () => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    await teardown();
    process.exit(failed.length === 0 ? 0 : 1);
  });

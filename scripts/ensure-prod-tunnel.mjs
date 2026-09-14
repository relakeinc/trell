#!/usr/bin/env node
/**
 * Ensures the SSH tunnel to the production Postgres is up before `pnpm dev`.
 *
 * Context: prod Postgres only listens on 127.0.0.1:5432 on the VPS
 * (see docker-compose.production.yml), so direct connections to
 * 89.117.76.234:5432 always fail. Local dev reaches prod through:
 *   ssh -N -L 5433:127.0.0.1:5432 trell-vps
 * with DATABASE_URL pointing at localhost:5433 (see apps/api/.env,
 * apps/web/.env). Port 5433 is used because a local Postgres dev DB
 * already occupies 5432 on this machine.
 *
 * Behaviour:
 * - Skips silently when no .env references the tunnel port (local-DB mode).
 * - Skips when TRELL_SKIP_TUNNEL=1.
 * - If the port is already open, does nothing (idempotent).
 * - Otherwise spawns ssh detached and waits (max ~20s) for the port.
 *
 * Env overrides:
 *   TRELL_SSH_HOST     (default "trell-vps", from ~/.ssh/config)
 *   TRELL_DB_LOCAL_PORT (default "5433")
 *   TRELL_DB_REMOTE    (default "127.0.0.1:5432")
 *   TRELL_SKIP_TUNNEL=1 to bypass
 *
 * Run: node scripts/ensure-prod-tunnel.mjs (wired as `predev`)
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_PORT = Number.parseInt(process.env.TRELL_DB_LOCAL_PORT ?? "5433", 10);
const REMOTE = process.env.TRELL_DB_REMOTE ?? "127.0.0.1:5432";
const SSH_HOST = process.env.TRELL_SSH_HOST ?? "trell-vps";
const ENV_FILES = ["apps/api/.env", "apps/web/.env"];

function isPortOpen(port, host = "127.0.0.1", timeoutMs = 1500) {
  return new Promise((resolvePromise) => {
    const socket = new net.Socket();
    const done = (open) => {
      socket.destroy();
      resolvePromise(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

function tunnelWanted() {
  if (process.env.TRELL_SKIP_TUNNEL === "1") return false;
  return ENV_FILES.some((rel) => {
    const abs = resolve(ROOT, rel);
    if (!existsSync(abs)) return false;
    const content = readFileSync(abs, "utf8");
    return content.includes(`localhost:${LOCAL_PORT}`) || content.includes(`127.0.0.1:${LOCAL_PORT}`);
  });
}

async function waitForPort(port, tries = 40, intervalMs = 500) {
  for (let i = 0; i < tries; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortOpen(port)) return true;
    // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function main() {
  if (!tunnelWanted()) {
    console.log("[trell:db] tunnel not needed (no .env points at localhost:5433), skipping.");
    return;
  }
  if (await isPortOpen(LOCAL_PORT)) {
    console.log(`[trell:db] tunnel already up on localhost:${LOCAL_PORT}.`);
    return;
  }
  const forward = `${LOCAL_PORT}:${REMOTE}`;
  console.log(`[trell:db] opening SSH tunnel: ssh -N -L ${forward} ${SSH_HOST} ...`);
  const child = spawn(
    "ssh",
    ["-N", "-o", "ServerAliveInterval=30", "-o", "ExitOnForwardFailure=yes", "-L", forward, SSH_HOST],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
  child.on("error", (err) => {
    console.error(`[trell:db] failed to spawn ssh: ${err.message}`);
    process.exit(1);
  });
  if (await waitForPort(LOCAL_PORT)) {
    console.log(`[trell:db] tunnel ready on localhost:${LOCAL_PORT}.`);
    return;
  }
  console.error(
    `[trell:db] tunnel did not come up on localhost:${LOCAL_PORT} after ~20s.\n` +
      `  Check: ssh ${SSH_HOST}  (key ~/.ssh/trell_vps, host trell-vps)\n` +
      `  Bypass with: TRELL_SKIP_TUNNEL=1 pnpm dev  (local-DB mode only)`,
  );
  process.exit(1);
}

await main();

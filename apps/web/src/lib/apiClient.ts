import { prisma } from "./prisma";
import { decrypt } from "./crypto";

export const API_URL = process.env.TRELL_API_URL ?? "http://localhost:8787";

/** Decrypt the project's secret key so the server can call the analytics API (never sent to the browser). */
export async function projectSecret(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { apiKeyEncrypted: true } });
  if (!project?.apiKeyEncrypted) return null;
  const encKey = process.env.TRELL_ENC_KEY;
  if (!encKey) throw new Error("TRELL_ENC_KEY is not set");
  return decrypt(project.apiKeyEncrypted, encKey);
}

export async function analytics<T>(opts: {
  projectId: string;
  metric: string;
  search?: Record<string, string | undefined>;
}): Promise<T> {
  const sk = await projectSecret(opts.projectId);
  if (!sk) throw new Error("project has no secret key");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.search ?? {})) if (v) qs.set(k, v);
  const url = `${API_URL}/v1/projects/${opts.projectId}/${opts.metric}${qs.size ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${sk}` }, cache: "no-store" });
  const body = await res.json();
  if (!res.ok) {
    const code = body?.error?.code ?? "analytics_error";
    const message = body?.error?.message ?? res.statusText;
    throw new Error(`${code}: ${message}`);
  }
  return body as T;
}

/** Generic relay: forward requests to the analytics API with sk auth. */
export async function apiRelay<T>(opts: {
  projectId: string;
  path: string;
  method?: string;
  search?: Record<string, string | undefined>;
  body?: unknown;
}): Promise<T> {
  const sk = await projectSecret(opts.projectId);
  if (!sk) throw new Error("project has no secret key");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.search ?? {})) if (v) qs.set(k, v);
  const url = `${API_URL}/v1/projects/${opts.projectId}/${opts.path}${qs.size ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: { authorization: `Bearer ${sk}`, "content-type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    const code = data?.error?.code ?? "api_error";
    const message = data?.error?.message ?? res.statusText;
    throw new Error(`${code}: ${message}`);
  }
  return data as T;
}

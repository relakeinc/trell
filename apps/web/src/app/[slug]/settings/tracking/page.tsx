"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { Icon } from "@/components/Icon";
import { useProject } from "../_components/ProjectContext";
import { SDK_URL, INGEST_URL } from "@/lib/publicUrls";

export default function TrackingSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { project } = useProject();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"browser" | "server">("browser");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const pk = project?.pk ?? "pk_YOUR_KEY";
  const isPkReady = Boolean(project?.pk);
  const hasDomains = (project?.domains.length ?? 0) > 0;
  const script = `<!-- Trell Tracking -->
<script src="${SDK_URL}"
  data-pk="${pk}"
  data-auto-track="true"
  defer></script>`;

  const serverEvent = `{
  "v": 1,
  "event_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "project": "${pk}",
  "type": "purchase",
  "ts": 1700000000000,
  "session_id": "server-session-1",
  "visitor_id": "user-123",
  "url": "https://example.com/checkout",
  "page": { "path": "/checkout", "title": "Checkout" },
  "referrer": "",
  "utm": null,
  "device": { "type": "desktop", "os": null, "browser": null, "viewport": [0, 0] },
  "properties": { "plan": "pro" }
}`;
  const curlSnippet = `curl -X POST ${INGEST_URL} \\
  -H "content-type: application/json" \\
  -H "authorization: Bearer $TRELL_SECRET_KEY" \\
  -d '${serverEvent}'`;
  const nextSnippet = `// app/api/track/route.ts — your backend, secret stays in .env
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const events = await req.json();
  const res = await fetch("${INGEST_URL}", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + process.env.TRELL_SECRET_KEY,
    },
    body: JSON.stringify(events),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  async function copySnippet(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSnippet(id);
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Tracking</h1>
      </div>

      {/* Tracking Script */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="flex items-center justify-between border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Tracking Script</span>
          <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-white p-0.5">
            <button
              onClick={() => setTab("browser")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${tab === "browser" ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}
            >
              Browser
            </button>
            <button
              onClick={() => setTab("server")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${tab === "server" ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}
            >
              Server (.env)
            </button>
          </div>
        </div>
        {tab === "browser" ? (
          <>
            <div className="p-4">
              {!hasDomains && (
                <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Icon name="info" size={15} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed text-amber-800">
                    <span className="font-medium">This workspace accepts events from any website.</span> Anyone with your publishable key can write to it.{" "}
                    <Link href={`/${slug}/settings/domains`} className="font-medium underline hover:text-amber-900">
                      Add your domain
                    </Link>{" "}
                    to lock it down.
                  </p>
                </div>
              )}
              <p className="mb-3 text-sm text-trell-ink-muted">Add this snippet to the <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">&lt;head&gt;</code> of your HTML to start tracking events automatically.</p>
              <div className="relative overflow-hidden rounded-lg border border-trell-line bg-neutral-950 p-4">
                <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-neutral-300">
                  <code>{script}</code>
                </pre>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50 px-4 py-2.5">
              <span className="text-xs text-trell-ink-muted">
                {isPkReady ? (
                  <>This snippet already includes your publishable key — just paste it.</>
                ) : (
                  <>Replace <code className="rounded bg-neutral-100 px-1 py-0.5">pk_YOUR_KEY</code> with your project key.</>
                )}
              </span>
              <button onClick={() => void handleCopy()} className="trell-btn-outline flex h-8 cursor-pointer items-center gap-1.5 text-xs">
                <Icon name={copied ? "check" : "link"} size={14} />
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4 p-4">
              <p className="text-sm text-trell-ink-muted">
                Send events from your backend with a secret key from <Link href={`/${slug}/settings/api`} className="font-medium text-blue-600 hover:underline">API Keys</Link>.
                Server keys bypass the domain allowlist — keep them in your <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">.env</code>, never in the browser.
              </p>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-trell-ink">1. Store the key</span>
                  <button onClick={() => void copySnippet("env", "TRELL_SECRET_KEY=sk_paste_yours")} className="text-xs text-trell-ink-muted transition-colors hover:text-trell-ink">
                    {copiedSnippet === "env" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-trell-line bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-300"><code>TRELL_SECRET_KEY=sk_paste_yours</code></pre>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-trell-ink">2. Forward events from your backend (Next.js example)</span>
                  <button onClick={() => void copySnippet("next", nextSnippet)} className="text-xs text-trell-ink-muted transition-colors hover:text-trell-ink">
                    {copiedSnippet === "next" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-trell-line bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-300"><code>{nextSnippet}</code></pre>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-trell-ink">Or send an event directly (cURL)</span>
                  <button onClick={() => void copySnippet("curl", curlSnippet)} className="text-xs text-trell-ink-muted transition-colors hover:text-trell-ink">
                    {copiedSnippet === "curl" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg border border-trell-line bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-300"><code>{curlSnippet}</code></pre>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50 px-4 py-2.5">
              <span className="text-xs text-trell-ink-muted">Secret keys are created per environment in <Link href={`/${slug}/settings/api`} className="font-medium text-blue-600 hover:underline">API Keys</Link>.</span>
            </div>
          </>
        )}
      </div>

      {/* Auto-Track */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <span className="text-sm font-medium text-trell-ink">Auto-Track</span>
            <p className="mt-0.5 text-sm text-trell-ink-muted">Automatically track form views, submissions, and page views.</p>
          </div>
          <div className="flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full bg-blue-600">
            <span className="inline-block h-4 w-4 translate-x-4 rounded-full bg-white shadow" />
          </div>
        </div>
      </div>

      {/* Form naming & field capture */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Naming forms & capturing fields</span>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-trell-ink-muted">
            Every <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">&lt;form&gt;</code> is tracked automatically and its values are captured on submit.
          </p>
          <div>
            <div className="mb-1.5 text-xs font-medium text-trell-ink">Give your form a stable name (recommended)</div>
            <pre className="overflow-x-auto rounded-lg border border-trell-line bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-300"><code>{`<form data-trell-form-id="contact-form" data-trell-form-name="Contact">`}</code></pre>
            <p className="mt-1.5 text-xs text-trell-ink-muted">
              Without an id, Trell derives a stable id from the form&apos;s structure, but naming it makes your analytics readable.
            </p>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-trell-ink">Field values are captured automatically</div>
            <p className="text-xs text-trell-ink-muted">
              On submit, all <code className="rounded bg-neutral-100 px-1 py-0.5">input</code>, <code className="rounded bg-neutral-100 px-1 py-0.5">textarea</code>, and <code className="rounded bg-neutral-100 px-1 py-0.5">select</code> values are sent in <code className="rounded bg-neutral-100 px-1 py-0.5">properties.fields</code> and shown on the Submissions page. Password fields are masked as <code className="rounded bg-neutral-100 px-1 py-0.5">***</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Quick Links</span>
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-2">
            <Link
              href={`/${slug}/events`}
              className="flex items-center justify-between rounded-md border border-trell-line px-3 py-2.5 transition-colors hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <Icon name="events" size={16} className="text-trell-ink-muted" />
                <div>
                  <div className="text-sm font-medium text-trell-ink">View Events</div>
                  <div className="text-xs text-trell-ink-muted">See all tracked events for this project</div>
                </div>
              </div>
              <Icon name="arrow-right-01" size={16} className="text-trell-ink-muted" />
            </Link>
            <Link
              href={`/${slug}/analytics`}
              className="flex items-center justify-between rounded-md border border-trell-line px-3 py-2.5 transition-colors hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <Icon name="analytics" size={16} className="text-trell-ink-muted" />
                <div>
                  <div className="text-sm font-medium text-trell-ink">View Analytics</div>
                  <div className="text-xs text-trell-ink-muted">See conversion metrics and trends</div>
                </div>
              </div>
              <Icon name="arrow-right-01" size={16} className="text-trell-ink-muted" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

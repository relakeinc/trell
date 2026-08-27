"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useProject } from "../_components/ProjectContext";

export default function TrackingSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { project } = useProject();
  const [copied, setCopied] = useState(false);

  const pk = project?.pk ?? "pk_YOUR_KEY";
  const script = `<!-- Trell Tracking -->
<script src="https://trepi.relake.co/sdk/trell.js"
  data-pk="${pk}"
  data-auto-track="true"
  defer></script>`;

  function handleCopy() {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Tracking</h1>
      </div>

      {/* Tracking Script */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Tracking Script</span>
        </div>
        <div className="p-4">
          <p className="mb-3 text-sm text-trell-ink-muted">Add this snippet to the <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">&lt;head&gt;</code> of your HTML to start tracking events automatically.</p>
          <div className="relative overflow-hidden rounded-lg border border-trell-line bg-neutral-950 p-4">
            <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-neutral-300">
              <code>{script}</code>
            </pre>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50 px-4 py-2.5">
          <span className="text-xs text-trell-ink-muted">Replace <code className="rounded bg-neutral-100 px-1 py-0.5">pk_YOUR_KEY</code> with your project key.</span>
          <button onClick={handleCopy} className="trell-btn-outline flex h-8 cursor-pointer items-center gap-1.5 text-xs">
            <Icon name={copied ? "checkCircle" : "link"} size={14} />
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>
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

"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useProjectId, useProjectSubmissions } from "@/lib/hooks";

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fieldEntries(fields: unknown): [string, string][] {
  if (!fields || typeof fields !== "object") return [];
  const obj = fields as Record<string, unknown>;

  if (obj.fields && typeof obj.fields === "object") {
    return Object.entries(obj.fields as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]);
  }

  const skip = new Set(["form"]);
  return Object.entries(obj)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => {
      if (typeof v === "object" && v !== null) return [k, JSON.stringify(v)];
      return [k, String(v ?? "")];
    });
}

export default function SubmissionsPage() {
  const { projectId } = useProjectId();
  const { data, isLoading } = useProjectSubmissions(projectId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const submissions = data?.submissions ?? [];
  const formSubmissions = submissions.filter((s) => s.type === "form_submit" || s.type === "form_success");

  function copyField(key: string, value: string) {
    void navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(key);
        window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
      },
      () => {},
    );
  }

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <h1 className="text-base font-semibold text-trell-ink">Form Submissions</h1>
      </header>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-trell-ink-muted">Loading…</p>
      ) : formSubmissions.length === 0 ? (
        <div className="rounded-xl border border-trell-line bg-white p-8 text-center">
          <Icon name="events" size={32} className="mx-auto mb-3 text-trell-ink-muted" />
          <p className="text-sm text-trell-ink-muted">No form submissions yet. Users need to submit a form on your site first.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {formSubmissions.map((s) => {
            const isOpen = expanded === s.id;
            const entries = fieldEntries(s.fields as Record<string, unknown> | null);
            return (
              <div key={s.id} className="overflow-hidden rounded-2xl border border-trell-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        s.type === "form_success"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                      title={s.type === "form_success" ? "Conversion" : "Submission"}
                    >
                      <Icon name="send" size={15} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-trell-ink">{s.formName || s.formId}</div>
                      <div className="truncate text-xs tabular-nums text-neutral-400">{s.page} · {ago(s.ts)}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {entries.length > 0 && (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-neutral-600">
                        {entries.length} fields
                      </span>
                    )}
                    <Icon name="arrow-down-01" size={14} className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-trell-line px-4 py-3">
                    {entries.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {entries.map(([k, v]) => (
                          <button
                            key={k}
                            onClick={() => copyField(`${s.id}:${k}`, v)}
                            title="Click to copy"
                            className="group rounded-lg bg-neutral-50 px-3 py-2 text-left transition-colors hover:bg-neutral-100"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-neutral-500">
                              <span className="truncate">{k}</span>
                              <span className={`shrink-0 ${copied === `${s.id}:${k}` ? "text-green-600" : "text-neutral-300 group-hover:text-neutral-400"}`}>
                                {copied === `${s.id}:${k}` ? "Copied" : "Copy"}
                              </span>
                            </div>
                            <div className="mt-0.5 break-words text-sm text-trell-ink">{v || <span className="italic text-neutral-400">empty</span>}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-trell-ink-muted">No field data captured. Update the tracking script to capture form values.</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-neutral-400">
                      <span className="font-mono" title={s.visitorId}>{s.visitorId.slice(0, 8)}</span>
                      <span>·</span>
                      <span>{s.device}</span>
                      {s.browser && (<><span>·</span><span>{s.browser}</span></>)}
                      {s.os && (<><span>·</span><span>{s.os}</span></>)}
                      <span>·</span>
                      <span title={new Date(s.ts).toLocaleString()}>{new Date(s.ts).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

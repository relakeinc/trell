"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useProjectId, useProjectSubmissions } from "@/lib/hooks";

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

  const submissions = data?.submissions ?? [];
  const formSubmissions = submissions.filter((s) => s.type === "form_submit" || s.type === "form_success");

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
              <div key={s.id} className="overflow-hidden rounded-xl border border-trell-line bg-white">
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-neutral-50"
                >
                  <div className="flex items-center gap-3">
                    <Icon name={s.type === "form_success" ? "checkCircle" : "events"} size={16} className={s.type === "form_success" ? "text-green-600" : "text-blue-500"} />
                    <div>
                      <div className="text-sm font-medium text-trell-ink">{s.formName || s.formId}</div>
                      <div className="text-xs text-trell-ink-muted">{s.page} · {new Date(s.ts).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entries.length > 0 && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-medium text-blue-700">{entries.length} fields</span>
                    )}
                    <Icon name={isOpen ? "arrow-up-01" : "arrow-down-01"} size={14} className="text-trell-ink-muted" />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-trell-line px-4 py-3">
                    {entries.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {entries.map(([k, v]) => (
                          <div key={k} className="rounded-lg bg-neutral-50 px-3 py-2">
                            <div className="text-2xs font-medium text-trell-ink-muted">{k}</div>
                            <div className="mt-0.5 text-sm text-trell-ink">{v || <span className="text-trell-ink-muted italic">empty</span>}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-trell-ink-muted">No field data captured. Update the tracking script to capture form values.</p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-2xs text-trell-ink-muted">
                      <span>Visitor: {s.visitorId.slice(0, 8)}…</span>
                      <span>{s.device}</span>
                      {s.browser && <span>{s.browser}</span>}
                      {s.os && <span>{s.os}</span>}
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

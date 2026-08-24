"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";

type SettingsSection = "general" | "billing" | "domains" | "api" | "tracking" | "webhooks";

interface Status {
  project: {
    id: string;
    name: string;
    slug: string;
    pk: string;
    domains: string[];
    createdAt: string;
  };
  installation: {
    connected: boolean;
    lastEventAt: string | null;
  };
  usage: {
    events: number;
    limit: number;
  };
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

function resetDate(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const STEPS = [
  "Create project",
  "Add your website domain",
  "Install Trell SDK",
  "Send first event",
  "Verify installation",
];

type Group = { label: string; items: { id: SettingsSection; label: string; icon: string }[] };

const GROUPS: Group[] = [
  {
    label: "Workspace",
    items: [
      { id: "general", label: "General", icon: "setting-2" },
      { id: "billing", label: "Billing", icon: "card-pos" },
      { id: "domains", label: "Domains", icon: "global" },
    ],
  },
  {
    label: "Developer",
    items: [
      { id: "api", label: "API Keys", icon: "key-square" },
      { id: "tracking", label: "Tracking", icon: "monitor-mobile" },
      { id: "webhooks", label: "Webhooks", icon: "export-arrow-01" },
    ],
  },
];

export function ProjectSettings({
  projectId,
  initialSection = "general",
  onClose,
  onRotated,
}: {
  projectId: string;
  initialSection?: SettingsSection;
  onClose: () => void;
  onRotated?: () => void;
}) {
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [visible, setVisible] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const [contentVisible, setContentVisible] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [newSk, setNewSk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) setStatus(await res.json());
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Slide-in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const patch = async (body: { addDomain?: string; removeDomain?: string }) => {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.message ?? data?.error ?? "Failed to update");
      return;
    }
    setNewDomain("");
    await load();
  };

  const rotate = async () => {
    if (!window.confirm("Rotating the secret key invalidates the current one everywhere. Anyone using the old key must update. Continue?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/rotate-secret`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data?.message ?? data?.error ?? "Failed to rotate");
      return;
    }
    setNewSk(data?.keys?.sk ?? null);
    onRotated?.();
  };

  function switchSection(next: SettingsSection) {
    if (next === section) return;
    setContentVisible(false);
    setTimeout(() => {
      setSection(next);
      setContentKey((k) => k + 1);
      requestAnimationFrame(() => setContentVisible(true));
    }, 180);
  }

  function handleClose() {
    setContentVisible(false);
    setVisible(false);
    setTimeout(onClose, 250);
  }

  if (!status)
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-neutral-200/60 text-sm text-neutral-500">
        Loading…
      </div>
    );

  const { project, installation, usage } = status;
  const stepDone = [true, project.domains.length > 0, true, installation.connected, installation.connected];
  const snippet = `<script defer src="https://cdn.trell.dev/sdk.js" data-project="${project.pk}" data-domain="${project.domains[0] ?? "yourdomain.com"}"></script>`;
  const usagePct = Math.min((usage.events / (usage.limit || 1)) * 100, 100);

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch bg-neutral-200/80 p-3 transition-all duration-200 ease-out"
      style={{ opacity: visible ? 1 : 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* ── Settings sidebar ─────────────────────────────── */}
      <aside
        className="flex h-full w-[260px] shrink-0 flex-col overflow-hidden rounded-xl bg-neutral-100 transition-all duration-250 ease-out"
        style={{
          transform: visible ? "translateX(0)" : "translateX(-20px)",
          opacity: visible ? 1 : 0,
        }}
      >
        <div className="mb-4 flex items-center justify-between px-4 pt-4">
          <span className="text-base font-semibold text-neutral-900">Settings</span>
          <button
            onClick={handleClose}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
            title="Close"
          >
            <Icon name="close-circle" size={16} />
          </button>
        </div>
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex flex-col gap-6">
            {GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-0.5">
                <div className="mb-1.5 pl-3 text-xs font-medium text-neutral-400">{group.label}</div>
                {group.items.map((item) => {
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => switchSection(item.id)}
                      className={`flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm leading-none transition-all duration-150 outline-none ${
                        active
                          ? "bg-blue-50 font-medium text-blue-600"
                          : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900"
                      }`}
                    >
                      <Icon name={item.icon} size={15} className="shrink-0" strokeWidth={active ? 2 : 1.5} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Usage footer */}
        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-neutral-200 px-4 py-3">
          <button onClick={() => switchSection("billing")} className="flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-neutral-900">
            Usage <Icon name="arrow-right-01" size={13} />
          </button>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Events</span>
            <span className="tabular-nums text-neutral-500">
              {usage.events.toLocaleString()}{" "}
              <span className="text-neutral-400">of {usage.limit.toLocaleString()}</span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${usagePct}%` }} />
          </div>
          <button onClick={() => switchSection("billing")} className="mt-1 flex h-8 w-full items-center justify-center rounded-lg border border-black bg-black text-sm font-medium text-white transition-colors hover:bg-neutral-800">
            Upgrade plan
          </button>
        </div>
      </aside>

      {/* ── Content ──────────────────────────────────────── */}
      <main
        className="ml-3 flex h-full min-w-0 flex-1 overflow-hidden rounded-xl bg-white transition-all duration-250 ease-out"
        style={{
          transform: visible ? "translateX(0)" : "translateX(30px)",
          opacity: visible ? 1 : 0,
        }}
      >
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl">
            <h1
              key={`title-${section}`}
              className="text-lg font-semibold text-neutral-900"
              style={{ animation: "trell-fade-in 0.25s ease-out" }}
            >
              {GROUPS.flatMap((g) => g.items).find((i) => i.id === section)?.label}
            </h1>
            <div
              key={contentKey}
              className="mt-6"
              style={{
                opacity: contentVisible ? 1 : 0,
                transform: contentVisible ? "translateY(0)" : "translateY(6px)",
                transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
              }}
            >
              {section === "general" && <GeneralSection project={project} />}
              {section === "billing" && <BillingSection usage={usage} />}
              {section === "domains" && (
                <DomainsSection
                  domains={project.domains}
                  newDomain={newDomain}
                  setNewDomain={setNewDomain}
                  onAdd={() => void patch({ addDomain: newDomain })}
                  onRemove={(d) => void patch({ removeDomain: d })}
                  error={error}
                />
              )}
              {section === "api" && (
                <ApiSection
                  pk={project.pk}
                  busy={busy}
                  newSk={newSk}
                  onRotate={() => void rotate()}
                />
              )}
              {section === "tracking" && <TrackingSection snippet={snippet} steps={STEPS} stepDone={stepDone} lastEventAt={installation.lastEventAt} />}
              {section === "webhooks" && <WebhooksSection />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Sections ────────────────────────────────────────────────

function Field({ label, hint, children, action }: { label: string; hint?: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-neutral-900">{label}</div>
          {hint && <div className="mt-1 text-sm text-neutral-500">{hint}</div>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function GeneralSection({ project }: { project: Status["project"] }) {
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Workspace Name"
        hint="This is the name of your workspace on Trell. Max 32 characters."
        action={<button className="trell-btn-secondary h-8 px-3 text-sm">Save Changes</button>}
      >
        <input defaultValue={project.name} maxLength={32} className="trell-input max-w-sm" />
      </Field>
      <Field label="Workspace Slug" hint="This is your workspace's unique slug on Trell. Max 48 characters.">
        <input defaultValue={project.slug} maxLength={48} className="trell-input max-w-sm" />
      </Field>
      <Field label="Created" hint={`This workspace was created on ${new Date(project.createdAt).toLocaleDateString()}.`} />
    </div>
  );
}

function BillingSection({ usage }: { usage: Status["usage"] }) {
  const pct = Math.min((usage.events / (usage.limit || 1)) * 100, 100);
  return (
    <div className="flex flex-col gap-5">
      <Field label="Free plan" hint="Track events on the forms you already have.">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Events</span>
            <span className="tabular-nums text-neutral-500">
              {usage.events.toLocaleString()} <span className="text-neutral-400">of {usage.limit.toLocaleString()}</span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-neutral-400">Usage will reset {resetDate()}</p>
        </div>
      </Field>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 text-sm font-medium text-neutral-900">Plans</div>
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4">
          <div>
            <div className="text-sm font-medium text-neutral-900">Free</div>
            <div className="text-sm text-neutral-500">0 of {usage.limit.toLocaleString()} events · Current plan</div>
          </div>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-600">Active</span>
        </div>
        <button className="trell-btn-primary mt-4 flex h-9 w-full items-center justify-center text-sm">
          Upgrade to Pro
        </button>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        <div className="mb-2 text-sm font-medium text-neutral-900">Usage summary</div>
        <p className="mt-2 text-xs text-neutral-400">Event tracking is billable on a monthly cycle. Analytics, funnels and reports are always free.</p>
      </div>
    </div>
  );
}

function DomainsSection({ domains, newDomain, setNewDomain, onAdd, onRemove, error }: { domains: string[]; newDomain: string; setNewDomain: (v: string) => void; onAdd: () => void; onRemove: (d: string) => void; error: string | null }) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Allowed domains" hint="Only events from these origins are accepted by the ingestion endpoint.">
        <div className="flex flex-wrap gap-1.5">
          {domains.map((d) => (
            <span key={d} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs">
              {d}
              <button onClick={() => onRemove(d)} className="text-neutral-400 hover:text-red-600" title="Remove">
                <Icon name="close-circle" size={13} />
              </button>
            </span>
          ))}
          {domains.length === 0 && <span className="text-sm text-neutral-400">No domains yet.</span>}
        </div>
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex max-w-sm gap-2">
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          className="trell-input flex-1"
          placeholder="example.com"
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <button onClick={onAdd} className="trell-btn-primary h-9">Add</button>
      </div>
    </div>
  );
}

function ApiSection({ pk, busy, newSk, onRotate }: { pk: string; busy: boolean; newSk: string | null; onRotate: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Publishable key" hint="Safe to expose in the browser — used by the Trell SDK.">
        <CopyRow value={pk} />
      </Field>
      <Field label="Secret key" hint="Only a hash is stored. Rotating invalidates the old key immediately." action={<button onClick={onRotate} disabled={busy} className="trell-btn-danger h-8 px-3 text-xs">{busy ? "…" : "Rotate"}</button>}>
        {newSk ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-medium text-amber-800">New secret key (shown once) — copy it now:</p>
            <CopyRow value={newSk} mono />
          </div>
        ) : (
          <div className="max-w-sm rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-400">
            Secret key (sk) — never shown again
          </div>
        )}
      </Field>
    </div>
  );
}

function TrackingSection({ snippet, steps, stepDone, lastEventAt }: { snippet: string; steps: string[]; stepDone: boolean[]; lastEventAt: string | null }) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Install Trell SDK" hint="Add this snippet before the closing </body> on your website.">
        <pre className="max-w-2xl overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">{snippet}</pre>
      </Field>
      <Field label="Setup checklist" hint={lastEventAt ? `Last event: ${ago(lastEventAt)}` : "Waiting for the first event."}>
        <ol className="space-y-2 text-sm">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${stepDone[i] ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                {stepDone[i] ? "✓" : i + 1}
              </span>
              <span className={stepDone[i] ? "text-neutral-900" : "text-neutral-500"}>{s}</span>
            </li>
          ))}
        </ol>
      </Field>
    </div>
  );
}

function WebhooksSection() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
        <Icon name="export-arrow-01" size={20} />
      </div>
      <div className="text-sm font-medium text-neutral-900">Webhooks are coming soon</div>
      <p className="mt-1 text-sm text-neutral-500">Forward conversion events to your own endpoints. Stay tuned.</p>
    </div>
  );
}

function CopyRow({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <div className="flex max-w-2xl items-center gap-2">
      <code className={`flex-1 truncate rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </code>
      <button onClick={() => void navigator.clipboard.writeText(value)} className="trell-btn-outline h-8 px-3 text-xs">
        Copy
      </button>
    </div>
  );
}

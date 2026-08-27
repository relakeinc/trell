"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Icon } from "@/components/Icon";
import { useProject } from "../_components/ProjectContext";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  { value: "pageview", label: "Page View", description: "When a page is viewed" },
  { value: "form_view", label: "Form View", description: "When a form becomes visible" },
  { value: "form_start", label: "Form Start", description: "When a user focuses on a form field" },
  { value: "form_submit", label: "Form Submit", description: "When a form is submitted" },
  { value: "form_success", label: "Form Success", description: "When a form submission is successful" },
  { value: "form_abandon", label: "Form Abandon", description: "When a user leaves a form incomplete" },
  { value: "cta_click", label: "CTA Click", description: "When a call-to-action is clicked" },
  { value: "field_interaction", label: "Field Interaction", description: "When a form field is focused or changed" },
];

export default function WebhooksSettingsPage() {
  const { project, loading: projectLoading } = useProject();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["form_submit"]);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [deliveryLog, setDeliveryLog] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<{ id: string; event: string; status: string; statusCode: number | null; response: string | null; attempts: number; createdAt: string }[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${project.id}/webhooks`)
      .then((r) => r.json())
      .then((d) => { setWebhooks(d.webhooks ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project]);

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function createWebhook() {
    if (!url.trim() || creating || !project || selectedEvents.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events: selectedEvents }),
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks((prev) => [...prev, data.webhook]);
        setUrl("");
        setSelectedEvents(["form_submit"]);
        toast.success("Webhook created");
      } else {
        toast.error("Failed to create webhook");
      }
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setCreating(false);
    }
  }

  async function deleteWebhook(id: string) {
    if (!project) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/projects/${project.id}/webhooks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
        toast.success("Webhook deleted");
      } else {
        toast.error("Failed to delete webhook");
      }
    } catch {
      toast.error("Failed to delete webhook");
    } finally {
      setDeleting(null);
    }
  }

  async function loadDeliveries(webhookId: string) {
    if (!project) return;
    if (deliveryLog === webhookId) { setDeliveryLog(null); return; }
    setDeliveryLog(webhookId);
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/webhooks/${webhookId}/deliveries`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries ?? []);
      }
    } catch {} finally {
      setLoadingDeliveries(false);
    }
  }

  if (projectLoading || loading) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  const isFree = project?.plan === "free";

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Webhooks</h1>
      </div>

      {/* Free plan gating */}
      {isFree && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-trell-line bg-white px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-100">
            <Icon name="webhooks" size={24} className="text-neutral-500" />
          </div>
          <div>
            <div className="text-base font-medium text-trell-ink">Webhooks</div>
            <p className="mx-auto mt-1 max-w-md text-sm text-trell-ink-muted">
              Receive real-time event notifications on your own infrastructure. Webhooks are available on the Pro plan.
            </p>
          </div>
          <Link href={`/${project?.slug}/settings/billing/plans`} className="trell-btn-primary h-9 gap-1.5 px-4 text-xs">
            Upgrade to Pro
          </Link>
        </div>
      )}

      {/* Create Webhook */}
      {!isFree && (
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Create Webhook</span>
        </div>
        <div className="p-4">
          <p className="mb-4 text-sm text-trell-ink-muted">Receive HTTP POST requests when events occur.</p>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs text-trell-ink-muted">Endpoint URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-server.com/webhook" className="trell-input w-full max-w-lg" />
            </div>
            <div>
              <label className="mb-2 block text-xs text-trell-ink-muted">Events to subscribe</label>
              <div className="flex flex-col gap-2">
                {AVAILABLE_EVENTS.map((event) => (
                  <label
                    key={event.value}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors cursor-pointer ${
                      selectedEvents.includes(event.value)
                        ? "border-blue-200 bg-blue-50"
                        : "border-trell-line hover:bg-neutral-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event.value)}
                      onChange={() => toggleEvent(event.value)}
                      className="h-4 w-4 rounded border-trell-line text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-trell-ink">{event.label}</div>
                      <div className="text-xs text-trell-ink-muted">{event.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50 px-4 py-2.5">
          <span className="text-xs text-trell-ink-muted">You&apos;ll receive a POST request for each matching event.</span>
          <button disabled={creating || !url.trim() || selectedEvents.length === 0} onClick={createWebhook} className="trell-btn-outline h-8 gap-1.5 text-xs disabled:opacity-40">{creating ? "Creating…" : "Save Changes"}</button>
        </div>
      </div>
      )}

      {/* Existing Webhooks */}
      {!isFree && (
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Existing Webhooks</span>
        </div>
        <div className="p-4">
          {webhooks.length === 0 ? (
            <p className="text-sm text-trell-ink-muted">No webhooks configured yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {webhooks.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-md border border-trell-line px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Icon name="webhooks" size={14} className="text-trell-ink-muted" />
                    <div>
                      <div className="text-sm font-medium text-trell-ink">{w.url}</div>
                      <div className="text-xs text-trell-ink-muted">{w.events.join(", ")} · {w.enabled ? "Active" : "Paused"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSecret(showSecret === w.id ? null : w.id)}
                      className="text-xs text-trell-ink-muted hover:text-trell-ink transition-colors"
                    >
                      {showSecret === w.id ? "Hide Secret" : "Show Secret"}
                    </button>
                    {showSecret === w.id && (
                      <code className="rounded bg-neutral-100 px-2 py-1 text-xs font-mono text-trell-ink-muted">{w.secret}</code>
                    )}
                    <button
                      onClick={() => loadDeliveries(w.id)}
                      className={`text-xs transition-colors ${deliveryLog === w.id ? "text-blue-600 font-medium" : "text-trell-ink-muted hover:text-trell-ink"}`}
                    >
                      Logs
                    </button>
                    <button disabled={deleting === w.id} onClick={() => deleteWebhook(w.id)} className="flex items-center gap-1 text-xs text-trell-ink-muted transition-colors hover:text-red-600 disabled:opacity-40">
                      <Icon name="close" size={12} className={deleting === w.id ? "animate-spin" : ""} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Delivery Log */}
      {!isFree && deliveryLog && (
        <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
          <div className="border-b border-trell-line px-4 py-3">
            <span className="text-sm font-medium text-trell-ink">Delivery Log</span>
          </div>
          <div className="p-4">
            {loadingDeliveries ? (
              <p className="text-sm text-trell-ink-muted">Loading deliveries…</p>
            ) : deliveries.length === 0 ? (
              <p className="text-sm text-trell-ink-muted">No deliveries yet. Webhooks will appear here after events fire.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {deliveries.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-md border border-trell-line px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block size-2 rounded-full ${d.status === "success" ? "bg-green-500" : d.status === "failed" ? "bg-red-500" : "bg-yellow-400"}`} />
                      <div>
                        <div className="text-sm font-medium text-trell-ink">{d.event}</div>
                        <div className="text-xs text-trell-ink-muted">
                          {d.statusCode ? `HTTP ${d.statusCode}` : d.status} · {d.attempts} attempt{d.attempts !== 1 ? "s" : ""} · {new Date(d.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {d.response && (
                      <code className="max-w-xs truncate text-xs text-trell-ink-muted" title={d.response}>{d.response.slice(0, 80)}</code>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

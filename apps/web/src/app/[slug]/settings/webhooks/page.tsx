"use client";

import { useEffect, useState } from "react";
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

export default function WebhooksSettingsPage() {
  const { project, loading: projectLoading } = useProject();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("form_submit");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${project.id}/webhooks`)
      .then((r) => r.json())
      .then((d) => { setWebhooks(d.webhooks ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project]);

  async function createWebhook() {
    if (!url.trim() || creating || !project) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events: events.split(",").map((e) => e.trim()).filter(Boolean) }),
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks((prev) => [...prev, data.webhook]);
        setUrl("");
        setEvents("form_submit");
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

  if (projectLoading || loading) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Webhooks</h1>
      </div>

      {/* Create Webhook */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Create Webhook</span>
        </div>
        <div className="p-4">
          <p className="mb-4 text-sm text-trell-ink-muted">Receive HTTP POST requests when events occur.</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-trell-ink-muted">Endpoint URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-server.com/webhook" className="trell-input w-full max-w-lg" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-trell-ink-muted">Events (comma-separated)</label>
              <input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="form_submit, form_start" className="trell-input w-full max-w-lg" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50 px-4 py-2.5">
          <span className="text-xs text-trell-ink-muted">You&apos;ll receive a POST request for each matching event.</span>
          <button disabled={creating || !url.trim()} onClick={createWebhook} className="trell-btn-outline h-8 gap-1.5 text-xs disabled:opacity-40">{creating ? "Creating…" : "Save Changes"}</button>
        </div>
      </div>

      {/* Existing Webhooks */}
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
                  <button disabled={deleting === w.id} onClick={() => deleteWebhook(w.id)} className="flex items-center gap-1 text-xs text-trell-ink-muted transition-colors hover:text-red-600 disabled:opacity-40">
                    <Icon name="close" size={12} className={deleting === w.id ? "animate-spin" : ""} />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

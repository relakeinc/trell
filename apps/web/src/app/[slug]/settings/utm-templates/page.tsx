"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Icon } from "@/components/Icon";
import { useProject } from "../_components/ProjectContext";

interface UtmTemplate {
  id: string;
  name: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referral: string | null;
  createdAt: string;
}

const EMPTY_FORM = { name: "", source: "", medium: "", campaign: "", term: "", content: "", referral: "" };

export default function UtmTemplatesSettingsPage() {
  const { project, loading: projectLoading } = useProject();
  const [templates, setTemplates] = useState<UtmTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${project.id}/utm-templates`)
      .then((r) => r.json())
      .then((d) => { setTemplates(d.templates ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project]);

  function buildQueryString(t: UtmTemplate) {
    const parts: string[] = [];
    if (t.source) parts.push(`utm_source=${encodeURIComponent(t.source)}`);
    if (t.medium) parts.push(`utm_medium=${encodeURIComponent(t.medium)}`);
    if (t.campaign) parts.push(`utm_campaign=${encodeURIComponent(t.campaign)}`);
    if (t.term) parts.push(`utm_term=${encodeURIComponent(t.term)}`);
    if (t.content) parts.push(`utm_content=${encodeURIComponent(t.content)}`);
    if (t.referral) parts.push(`utm_referral=${encodeURIComponent(t.referral)}`);
    return parts.join("&");
  }

  function copyQueryString(t: UtmTemplate) {
    const qs = buildQueryString(t);
    if (!qs) return;
    navigator.clipboard.writeText(qs);
    toast.success("Copied to clipboard");
  }

  async function createTemplate() {
    if (!form.name.trim() || creating || !project) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/utm-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          source: form.source.trim() || undefined,
          medium: form.medium.trim() || undefined,
          campaign: form.campaign.trim() || undefined,
          term: form.term.trim() || undefined,
          content: form.content.trim() || undefined,
          referral: form.referral.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) => [data.template, ...prev]);
        setForm(EMPTY_FORM);
        toast.success("Template created");
      } else {
        toast.error("Failed to create template");
      }
    } catch {
      toast.error("Failed to create template");
    } finally {
      setCreating(false);
    }
  }

  function startEditing(t: UtmTemplate) {
    setEditing(t.id);
    setEditForm({
      name: t.name,
      source: t.source ?? "",
      medium: t.medium ?? "",
      campaign: t.campaign ?? "",
      term: t.term ?? "",
      content: t.content ?? "",
      referral: t.referral ?? "",
    });
  }

  async function saveEdit() {
    if (!editing || !project) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/utm-templates/${editing}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          source: editForm.source.trim() || undefined,
          medium: editForm.medium.trim() || undefined,
          campaign: editForm.campaign.trim() || undefined,
          term: editForm.term.trim() || undefined,
          content: editForm.content.trim() || undefined,
          referral: editForm.referral.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) => prev.map((t) => (t.id === editing ? data.template : t)));
        setEditing(null);
        toast.success("Template updated");
      } else {
        toast.error("Failed to update template");
      }
    } catch {
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!project) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/projects/${project.id}/utm-templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("Template deleted");
      } else {
        toast.error("Failed to delete template");
      }
    } catch {
      toast.error("Failed to delete template");
    } finally {
      setDeleting(null);
    }
  }

  function activeParams(t: UtmTemplate) {
    return [t.source, t.medium, t.campaign, t.term, t.content, t.referral].filter(Boolean).length;
  }

  if (projectLoading || loading) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">UTM Templates</h1>
        <p className="mt-1 text-sm text-trell-ink-muted">
          Save reusable UTM parameter combinations to quickly apply when creating links or campaigns.
        </p>
      </div>

      {/* Create Template */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Create Template</span>
        </div>
        <div className="p-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-trell-ink-muted">Template Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Summer Campaign" className="trell-input w-full max-w-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-trell-ink-muted">utm_source</label>
                <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="google" className="trell-input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-trell-ink-muted">utm_medium</label>
                <input value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value })} placeholder="cpc" className="trell-input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-trell-ink-muted">utm_campaign</label>
                <input value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} placeholder="summer_sale" className="trell-input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-trell-ink-muted">utm_term</label>
                <input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="running shoes" className="trell-input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-trell-ink-muted">utm_content</label>
                <input value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="logo_link" className="trell-input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-trell-ink-muted">utm_referral</label>
                <input value={form.referral} onChange={(e) => setForm({ ...form, referral: e.target.value })} placeholder="yoursite.com" className="trell-input w-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end border-t border-trell-line bg-neutral-50 px-4 py-2.5">
          <button disabled={creating || !form.name.trim()} onClick={createTemplate} className="trell-btn-outline h-8 gap-1.5 text-xs disabled:opacity-40">
            {creating ? "Creating…" : "Create Template"}
          </button>
        </div>
      </div>

      {/* Existing Templates */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Saved Templates</span>
        </div>
        <div className="p-4">
          {templates.length === 0 ? (
            <p className="text-sm text-trell-ink-muted">No templates saved yet. Create one above to get started.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {templates.map((t) => (
                <div key={t.id} className="rounded-md border border-trell-line px-3 py-2">
                  {editing === t.id ? (
                    <div className="flex flex-col gap-3">
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="trell-input w-full max-w-lg" />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-trell-ink-muted">utm_source</label>
                          <input value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="trell-input w-full" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-trell-ink-muted">utm_medium</label>
                          <input value={editForm.medium} onChange={(e) => setEditForm({ ...editForm, medium: e.target.value })} className="trell-input w-full" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-trell-ink-muted">utm_campaign</label>
                          <input value={editForm.campaign} onChange={(e) => setEditForm({ ...editForm, campaign: e.target.value })} className="trell-input w-full" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-trell-ink-muted">utm_term</label>
                          <input value={editForm.term} onChange={(e) => setEditForm({ ...editForm, term: e.target.value })} className="trell-input w-full" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-trell-ink-muted">utm_content</label>
                          <input value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} className="trell-input w-full" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-trell-ink-muted">utm_referral</label>
                          <input value={editForm.referral} onChange={(e) => setEditForm({ ...editForm, referral: e.target.value })} className="trell-input w-full" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button disabled={saving || !editForm.name.trim()} onClick={saveEdit} className="trell-btn-outline h-7 gap-1.5 text-xs disabled:opacity-40">
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setEditing(null)} className="h-7 rounded-md px-2 text-xs text-trell-ink-muted hover:text-trell-ink transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Icon name="links" size={14} className="text-trell-ink-muted" />
                        <div className="min-w-0">
                          <div className="min-w-0 truncate text-sm font-medium text-trell-ink">{t.name}</div>
                          <div className="text-xs text-trell-ink-muted">{activeParams(t)} parameters{t.createdAt && ` · ${new Date(t.createdAt).toLocaleDateString()}`}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeParams(t) > 0 && (
                          <button onClick={() => copyQueryString(t)} className="text-xs text-trell-ink-muted hover:text-trell-ink transition-colors" title="Copy query string">
                            Copy UTM
                          </button>
                        )}
                        <button onClick={() => startEditing(t)} className="text-xs text-trell-ink-muted hover:text-trell-ink transition-colors">
                          Edit
                        </button>
                        <button disabled={deleting === t.id} onClick={() => deleteTemplate(t.id)} className="flex items-center gap-1 text-xs text-trell-ink-muted transition-colors hover:text-red-600 disabled:opacity-40">
                          <Icon name="close" size={12} className={deleting === t.id ? "animate-spin" : ""} />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

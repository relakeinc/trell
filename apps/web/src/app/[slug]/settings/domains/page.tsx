"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Icon } from "@/components/Icon";
import { useProject } from "../_components/ProjectContext";

export default function DomainsSettingsPage() {
  const { project, loading, setProject } = useProject();
  const [domain, setDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  if (loading || !project) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  async function addDomain() {
    if (!domain.trim() || adding || !project) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setProject({ ...project, domains: data.domains });
        setDomain("");
        toast.success("Domain added");
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to add domain");
      }
    } catch {
      toast.error("Failed to add domain");
    } finally {
      setAdding(false);
    }
  }

  async function removeDomain(d: string) {
    if (!project) return;
    setRemoving(d);
    try {
      const res = await fetch(`/api/projects/${project.id}/domains`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      if (res.ok) {
        const data = await res.json();
        setProject({ ...project, domains: data.domains });
        toast.success("Domain removed");
      } else {
        toast.error("Failed to remove domain");
      }
    } catch {
      toast.error("Failed to remove domain");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Domains</h1>
      </div>

      {/* Add Domain */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <form onSubmit={(e) => { e.preventDefault(); void addDomain(); }}>
          <div className="border-b border-trell-line px-4 py-3">
            <span className="text-sm font-medium text-trell-ink">Add Domain</span>
          </div>
          <div className="p-4">
            <p className="mb-3 text-sm text-trell-ink-muted">Add a domain to start tracking events from that origin.</p>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="trell-input max-w-sm" />
          </div>
          <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50 px-4 py-2.5">
            <span className="text-xs text-trell-ink-muted">Only the hostname, no protocol or path.</span>
            <button type="submit" disabled={adding || !domain.trim()} className="trell-btn-outline h-8 gap-1.5 text-xs disabled:opacity-40">{adding ? "Adding…" : "Save Changes"}</button>
          </div>
        </form>
      </div>

      {/* Current Domains */}
      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Current Domains</span>
        </div>
        <div className="p-4">
          {project.domains.length === 0 ? (
            <p className="text-sm text-trell-ink-muted">No domains added yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {project.domains.map((d) => (
                <div key={d} className="flex items-center justify-between rounded-md border border-trell-line px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Icon name="globe" size={14} className="text-trell-ink-muted" />
                    <span className="text-sm text-trell-ink">{d}</span>
                  </div>
                  <button disabled={removing === d} onClick={() => removeDomain(d)} className="flex items-center gap-1 text-xs text-trell-ink-muted transition-colors hover:text-red-600 disabled:opacity-40">
                    <Icon name="close" size={12} className={removing === d ? "animate-spin" : ""} />
                    Remove
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

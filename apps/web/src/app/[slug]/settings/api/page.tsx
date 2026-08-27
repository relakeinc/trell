"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Icon } from "@/components/Icon";
import { useProject } from "../_components/ProjectContext";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
}

export default function ApiKeysSettingsPage() {
  const { project, loading: projectLoading } = useProject();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ publicKey: string; secret: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${project.id}/api-keys`)
      .then((r) => r.json())
      .then((d) => { setKeys(d.keys ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project]);

  async function createKey() {
    if (!name.trim() || creating || !project) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey({ publicKey: data.key.publicKey, secret: data.secret });
        setKeys((prev) => [...prev, { id: data.key.id, name: data.key.name, keyPrefix: data.key.publicKey.slice(0, 12), createdAt: data.key.createdAt }]);
        setName("");
        toast.success("API key created");
      } else {
        toast.error("Failed to create API key");
      }
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(id: string) {
    if (!project) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/projects/${project.id}/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        toast.success("API key deleted");
      } else {
        toast.error("Failed to delete API key");
      }
    } catch {
      toast.error("Failed to delete API key");
    } finally {
      setDeleting(null);
    }
  }

  if (projectLoading || loading) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">API Keys</h1>
      </div>

      {newKey && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <Icon name="checkCircle" size={16} className="mt-0.5 text-green-600" />
            <div className="flex-1">
              <div className="text-sm font-medium text-green-900">API key created</div>
              <div className="mt-1 text-xs text-green-700">Copy these keys now — the secret key won&apos;t be shown again.</div>
              <div className="mt-2 flex flex-col gap-2">
                <div>
                  <span className="text-[11px] font-medium text-green-700">Publishable Key</span>
                  <code className="block break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-green-800 ring-1 ring-green-200">{newKey.publicKey}</code>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-green-700">Secret Key</span>
                  <code className="block break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-green-800 ring-1 ring-green-200">{newKey.secret}</code>
                </div>
              </div>
            </div>
            <button onClick={() => setNewKey(null)} className="text-green-600 hover:text-green-800"><Icon name="close" size={14} /></button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <form onSubmit={(e) => { e.preventDefault(); void createKey(); }}>
          <div className="border-b border-trell-line px-4 py-3">
            <span className="text-sm font-medium text-trell-ink">Create New Key</span>
          </div>
          <div className="p-4">
            <p className="mb-3 text-sm text-trell-ink-muted">Create a new API key for server-side access.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. production" className="trell-input max-w-sm" />
          </div>
          <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50 px-4 py-2.5">
            <span className="text-xs text-trell-ink-muted">Give your key a descriptive name.</span>
            <button type="submit" disabled={creating || !name.trim()} className="trell-btn-outline h-8 gap-1.5 text-xs disabled:opacity-40">{creating ? "Creating…" : "Save Changes"}</button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Existing Keys</span>
        </div>
        <div className="p-4">
          {keys.length === 0 ? (
            <p className="text-sm text-trell-ink-muted">No API keys yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between rounded-md border border-trell-line px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Icon name="keyRound" size={14} className="text-trell-ink-muted" />
                    <div>
                      <div className="text-sm font-medium text-trell-ink">{k.name}</div>
                      <div className="text-xs text-trell-ink-muted">{k.keyPrefix}… · Created {new Date(k.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <button disabled={deleting === k.id} onClick={() => deleteKey(k.id)} className="flex items-center gap-1 text-xs text-trell-ink-muted transition-colors hover:text-red-600 disabled:opacity-40">
                    <Icon name="close" size={12} className={deleting === k.id ? "animate-spin" : ""} />
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { Icon } from "@/components/Icon";
import { useProject } from "../_components/ProjectContext";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Could not copy — select and copy manually");
        }
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15"
    >
      <Icon name={copied ? "check" : "link"} size={13} />
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function ApiKeysSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { project, loading: projectLoading } = useProject();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ id: string; name: string; secret: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    fetch(`/api/projects/${project.id}/api-keys`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setKeys(d.keys ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setNewKey({ id: data.key.id, name: data.key.name, secret: data.secret });
        setKeys((prev) => [
          ...prev,
          { id: data.key.id, name: data.key.name, keyPrefix: data.key.keyPrefix, createdAt: data.key.createdAt },
        ]);
        setName("");
        toast.success("Secret key created");
      } else {
        toast.error(data?.message || "Failed to create key");
      }
    } catch {
      toast.error("Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!project) return;
    if (confirmRevoke !== id) {
      setConfirmRevoke(id);
      return;
    }
    setConfirmRevoke(null);
    setRevoking(id);
    try {
      const res = await fetch(`/api/projects/${project.id}/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        toast.success("Key revoked");
      } else {
        toast.error("Failed to revoke key");
      }
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setRevoking(null);
    }
  }

  if (projectLoading || loading) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">API Keys</h1>
        <p className="mt-1 text-sm text-trell-ink-muted">
          Server keys for your backend. They live in your{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">.env</code> — never in the browser.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-trell-line bg-white p-4">
          <div className="flex items-center gap-2">
            <Icon name="globe" size={14} className="text-trell-ink-muted" />
            <span className="text-sm font-medium text-trell-ink">Publishable key</span>
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-trell-ink-muted">
              {project?.pk ? `${project.pk.slice(0, 11)}…` : "pk_…"}
            </code>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-trell-ink-muted">
            Public. Powers the browser snippet in{" "}
            <Link href={`/${slug}/settings/tracking`} className="font-medium text-blue-600 hover:underline">
              Tracking
            </Link>
            , protected by your domain allowlist.
          </p>
        </div>
        <div className="rounded-lg border border-trell-line bg-white p-4">
          <div className="flex items-center gap-2">
            <Icon name="keyRound" size={14} className="text-trell-ink-muted" />
            <span className="text-sm font-medium text-trell-ink">Secret keys</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-trell-ink-muted">
            Private. For server-to-server calls from your backend. A secret key bypasses the domain allowlist — anyone
            holding one can write to this workspace.
          </p>
        </div>
      </div>

      {newKey && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Secret key created: {newKey.name}
              </div>
              <div className="mt-1 text-xs text-amber-700 dark:text-amber-300/90">
                Copy it now — it won&apos;t be shown again. Store it as{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">TRELL_SECRET_KEY</code> in your backend{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">.env</code>.
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-black/40 dark:text-amber-200 dark:ring-amber-500/30">
                    {newKey.secret}
                  </code>
                  <CopyButton value={newKey.secret} label="Copy" />
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-black/40 dark:text-amber-200 dark:ring-amber-500/30">
                    TRELL_SECRET_KEY={newKey.secret}
                  </code>
                  <CopyButton value={`TRELL_SECRET_KEY=${newKey.secret}`} label=".env" />
                </div>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-3 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-800"
              >
                I&apos;ve saved it
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createKey();
          }}
        >
          <div className="border-b border-trell-line px-4 py-3">
            <span className="text-sm font-medium text-trell-ink">Create secret key</span>
          </div>
          <div className="p-4">
            <p className="mb-3 text-sm text-trell-ink-muted">
              Name it after where it will live, e.g.{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">production server</code> or{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">staging</code>.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. production server"
              maxLength={64}
              className="trell-input max-w-sm"
            />
          </div>
          <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50 px-4 py-2.5">
            <span className="text-xs text-trell-ink-muted">One key per environment. Revoke anytime below.</span>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="trell-btn-outline h-8 gap-1.5 text-xs disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create secret key"}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-trell-line bg-white">
        <div className="border-b border-trell-line px-4 py-3">
          <span className="text-sm font-medium text-trell-ink">Active keys</span>
        </div>
        <div className="p-4">
          {keys.length === 0 ? (
            <p className="text-sm text-trell-ink-muted">
              No secret keys yet. Browser-only? You don&apos;t need one — the{" "}
              <Link href={`/${slug}/settings/tracking`} className="font-medium text-blue-600 hover:underline">
                tracking snippet
              </Link>{" "}
              is enough.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-trell-line px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon name="keyRound" size={14} className="shrink-0 text-trell-ink-muted" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-trell-ink">{k.name}</div>
                      <div className="font-mono text-xs text-trell-ink-muted">
                        {k.keyPrefix}… · Created {new Date(k.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={revoking === k.id}
                    onClick={() => void revokeKey(k.id)}
                    className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors disabled:opacity-40 ${confirmRevoke === k.id ? "font-medium text-red-600 hover:text-red-700" : "text-trell-ink-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"}`}
                  >
                    <Icon name="close" size={12} className={revoking === k.id ? "animate-spin" : ""} />
                    {revoking === k.id ? "Revoking…" : confirmRevoke === k.id ? "Click again to revoke" : "Revoke"}
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

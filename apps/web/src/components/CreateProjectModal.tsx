"use client";

import { useState } from "react";

export function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<{ pk: string; sk: string } | null>(null);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, domains: domains.split(",").map((d) => d.trim()).filter(Boolean) }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body?.message ?? body?.error ?? "Failed to create project");
      return;
    }
    setKeys({ pk: body.keys.pk, sk: body.keys.sk });
  };

  if (keys) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="trell-card w-full max-w-lg p-6">
          <h2 className="text-lg font-semibold">Project created</h2>
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Copy your secret key now. It is shown <strong>only once</strong> — Trell stores only a hash of it.
          </div>
          <label className="mt-4 block text-xs font-medium text-trell-muted">Publishable key (pk) — safe for the SDK</label>
          <CopyRow value={keys.pk} />
          <label className="mt-3 block text-xs font-medium text-trell-muted">Secret key (sk) — never send to the browser</label>
          <CopyRow value={keys.sk} mono />
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={onClose} className="trell-btn-outline h-9">
              Close
            </button>
            <button onClick={() => { onCreated(); onClose(); }} className="trell-btn-primary">
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="trell-card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold">Create your project</h2>
        <label className="mt-4 block text-xs font-medium text-trell-muted">Project name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="trell-input mt-1" placeholder="My online store" />
        <label className="mt-3 block text-xs font-medium text-trell-muted">Allowed domains (comma separated)</label>
        <input value={domains} onChange={(e) => setDomains(e.target.value)} className="trell-input mt-1" placeholder="example.com, *.example.com" />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="trell-btn-outline h-9">
            Cancel
          </button>
          <button onClick={() => void submit()} disabled={busy || !name.trim()} className="trell-btn-primary">
            {busy ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyRow({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <code className={`flex-1 truncate rounded-md border border-trell-line bg-trell-bg px-3 py-2 text-xs ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </code>
      <button
        onClick={() => void navigator.clipboard.writeText(value)}
        className="trell-btn-outline h-8 px-2 text-xs"
      >
        Copy
      </button>
    </div>
  );
}

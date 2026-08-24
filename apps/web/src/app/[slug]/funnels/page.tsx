"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { FunnelBuilder } from "@/components/FunnelBuilder";
import { FunnelView } from "@/components/FunnelView";

interface SavedFunnel {
  id: string;
  name: string;
  steps: { eventType: string | null; formId: string | null; label: string | null; position: number }[];
}

interface FunnelStep {
  position: number;
  key: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
  dropOff: number | null;
}

interface FunnelResult {
  totalSessions: number;
  steps: FunnelStep[];
}

function localInput(d: Date): string {
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function FunnelsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedFunnels, setSavedFunnels] = useState<SavedFunnel[]>([]);
  const [activeFunnel, setActiveFunnel] = useState<(SavedFunnel & FunnelResult) | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<SavedFunnel | null>(null);
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date()));

  const qs = `from=${from}&to=${to}`;

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        const p = (d.projects ?? []).find((x: { slug: string }) => x.slug === slug);
        if (p) setProjectId(p.id);
      })
      .catch(() => {});
  }, [slug]);

  const loadFunnels = useCallback(async () => {
    if (!projectId) return;
    try {
      const r = await fetch(`/api/projects/${projectId}/funnels`);
      if (r.ok) {
        const d = await r.json();
        setSavedFunnels(d.funnels ?? []);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => { void loadFunnels(); }, [loadFunnels]);

  async function loadFunnelLive(f: SavedFunnel) {
    if (!projectId) return;
    try {
      const r = await fetch(`/api/projects/${projectId}/funnel-live?funnelId=${f.id}&${qs}`);
      if (r.ok) {
        const d = await r.json();
        setActiveFunnel({ ...f, totalSessions: d.totalSessions, steps: d.steps });
      }
    } catch { /* ignore */ }
  }

  async function saveFunnel(data: { name: string; steps: { eventType: string; formId?: string; label?: string; position: number }[] }) {
    if (!projectId) return;
    const method = editingFunnel ? "PATCH" : "POST";
    const path = editingFunnel
      ? `/api/projects/${projectId}/funnels/${editingFunnel.id}`
      : `/api/projects/${projectId}/funnels`;
    await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    setBuilderOpen(false);
    setEditingFunnel(null);
    await loadFunnels();
  }

  async function deleteFunnel(id: string) {
    if (!projectId || !confirm("Delete this funnel?")) return;
    await fetch(`/api/projects/${projectId}/funnels/${id}`, { method: "DELETE" });
    if (activeFunnel?.id === id) setActiveFunnel(null);
    await loadFunnels();
  }

  useEffect(() => {
    if (savedFunnels.length > 0 && !activeFunnel) {
      void loadFunnelLive(savedFunnels[0]!);
    }
  }, [savedFunnels]);

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <h1 className="text-base font-semibold text-trell-ink">Funnels</h1>
        <button
          onClick={() => { setEditingFunnel(null); setBuilderOpen(true); }}
          className="trell-btn-primary h-9"
        >
          New funnel
        </button>
      </header>

      {builderOpen && (
        <FunnelBuilder
          initial={editingFunnel ? {
            id: editingFunnel.id,
            name: editingFunnel.name,
            steps: editingFunnel.steps.map((s) => ({ eventType: s.eventType ?? "", formId: s.formId ?? undefined, label: s.label ?? undefined, position: s.position })),
          } : undefined}
          onSave={(data) => void saveFunnel(data)}
          onCancel={() => { setBuilderOpen(false); setEditingFunnel(null); }}
        />
      )}

      {activeFunnel && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditingFunnel(activeFunnel); setBuilderOpen(true); }} className="trell-btn-secondary h-9">Edit</button>
            <button onClick={() => void deleteFunnel(activeFunnel.id)} className="trell-btn-danger h-9">Delete</button>
          </div>
          <FunnelView funnel={activeFunnel} onDrillDown={() => {}} />
        </div>
      )}

      {!activeFunnel && !builderOpen && savedFunnels.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-trell-line bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-trell-line bg-white text-trell-ink-subtle">
            <Icon name="filter-square" size={24} />
          </div>
          <h2 className="text-base font-semibold text-trell-ink">No funnels yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-trell-ink-subtle">Create a funnel to track multi-step conversion flows.</p>
          <button onClick={() => setBuilderOpen(true)} className="trell-btn-primary mt-4">Create funnel</button>
        </div>
      )}

      {!activeFunnel && !builderOpen && savedFunnels.length > 0 && (
        <p className="py-8 text-center text-sm text-trell-ink-muted">Select a funnel from the list.</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { AskYoiButton } from "@/components/AskYoiButton";
import { FunnelBuilder } from "@/components/FunnelBuilder";
import { FunnelView } from "@/components/FunnelView";
import { useProjectId, useProjectFunnels, useFunnelLive, useFunnelMutations } from "@/lib/hooks";
import { fmtShortDate, localInput } from "@/lib/format";

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

export default function FunnelsPage() {
  const { projectId } = useProjectId();
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<SavedFunnel | null>(null);
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const qs = `from=${from}&to=${to}`;

  const { data: funnelsData } = useProjectFunnels(projectId);
  const savedFunnels = funnelsData?.funnels ?? [];

  const { data: liveData } = useFunnelLive(projectId, activeFunnelId, qs);

  const { createFunnel, updateFunnel, deleteFunnel } = useFunnelMutations(projectId);

  // Auto-select first funnel
  useEffect(() => {
    if (savedFunnels.length > 0 && !activeFunnelId) {
      setActiveFunnelId(savedFunnels[0]!.id);
    }
  }, [savedFunnels, activeFunnelId]);

  // Reset the delete confirmation whenever the selection changes
  useEffect(() => {
    setConfirmDelete(false);
  }, [activeFunnelId]);

  const activeFunnel = activeFunnelId
    ? savedFunnels.find((f) => f.id === activeFunnelId) && liveData
      ? { ...savedFunnels.find((f) => f.id === activeFunnelId)!, totalSessions: liveData.totalSessions, steps: liveData.steps }
      : null
    : null;

  function handleSave(data: { name: string; steps: { eventType: string; formId?: string; label?: string; position: number }[] }) {
    if (editingFunnel) {
      updateFunnel.mutate({ id: editingFunnel.id, ...data }, { onSuccess: () => { setBuilderOpen(false); setEditingFunnel(null); } });
    } else {
      createFunnel.mutate(data, { onSuccess: () => { setBuilderOpen(false); setEditingFunnel(null); } });
    }
  }

  function handleDelete(id: string) {
    if (!confirmDelete) {
      setConfirmDelete(true);
      window.setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setConfirmDelete(false);
    deleteFunnel.mutate(id, { onSuccess: () => { if (activeFunnelId === id) setActiveFunnelId(null); } });
  }

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <div>
          <h1 className="text-base font-semibold text-trell-ink">Funnels</h1>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => { setEditingFunnel(null); setBuilderOpen(true); }}
          className="trell-btn-accent h-10 px-4"
        >
          + New funnel
        </button>
        <AskYoiButton />
        </div>
      </header>

      {builderOpen && (
        <div className="mb-4">
          <FunnelBuilder
            initial={editingFunnel ? {
              id: editingFunnel.id,
              name: editingFunnel.name,
              steps: editingFunnel.steps.map((s) => ({ eventType: s.eventType ?? "", formId: s.formId ?? undefined, label: s.label ?? undefined, position: s.position })),
            } : undefined}
            onSave={(data) => void handleSave(data)}
            onCancel={() => { setBuilderOpen(false); setEditingFunnel(null); }}
          />
        </div>
      )}

      {!builderOpen && savedFunnels.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-neutral-100 p-0.5">
            {savedFunnels.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFunnelId(f.id)}
                title={`${f.steps.length} steps`}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  f.id === activeFunnelId
                    ? "bg-white text-trell-ink shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
          <span className="text-xs text-trell-ink-muted">
            Live data · {fmtShortDate(from)} – {fmtShortDate(to)}
          </span>
        </div>
      )}

      {activeFunnel && !builderOpen && (
        <div className="space-y-3">
          <FunnelView funnel={activeFunnel} onDrillDown={() => {}} />
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditingFunnel(activeFunnel as unknown as SavedFunnel); setBuilderOpen(true); }} className="trell-btn-secondary h-9">Edit funnel</button>
            <button
              onClick={() => activeFunnelId && handleDelete(activeFunnelId)}
              className={`${confirmDelete ? "trell-btn-danger" : "trell-btn-outline"} h-9 gap-1.5 text-xs`}
            >
              {confirmDelete ? "Click again to confirm delete" : "Delete"}
            </button>
          </div>
        </div>
      )}

      {!activeFunnel && !builderOpen && savedFunnels.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-trell-line bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-trell-line bg-white text-trell-ink-subtle">
            <Icon name="filter-square" size={24} />
          </div>
          <h2 className="text-base font-semibold text-trell-ink">No funnels yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-trell-ink-subtle">
            Funnels show how many visitors complete each step — and where the rest drop off.
            Start with view → start → success.
          </p>
          <button onClick={() => setBuilderOpen(true)} className="trell-btn-accent mt-4 h-10 px-6">Create funnel</button>
        </div>
      )}

      {!activeFunnel && !builderOpen && savedFunnels.length > 0 && (
        <p className="py-8 text-center text-sm text-trell-ink-muted">Select a funnel above to see its conversion.</p>
      )}
    </div>
  );
}

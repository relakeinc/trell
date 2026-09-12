"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { AskYoiButton } from "@/components/AskYoiButton";
import { FunnelBuilder } from "@/components/FunnelBuilder";
import { FunnelView } from "@/components/FunnelView";
import { useChat } from "@/components/ChatProvider";
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

interface FunnelTemplate {
  name: string;
  desc: string;
  icon: string;
  steps: { eventType: string; label: string; position: number }[];
}

const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    name: "Complete journey",
    desc: "From first view to success — the full picture of every form.",
    icon: "funnels",
    steps: [
      { eventType: "form_view", label: "View", position: 0 },
      { eventType: "form_start", label: "Start", position: 1 },
      { eventType: "form_submit", label: "Submit", position: 2 },
      { eventType: "form_success", label: "Success", position: 3 },
    ],
  },
  {
    name: "Starter conversion",
    desc: "How many visitors who start filling the form make it to success.",
    icon: "flash",
    steps: [
      { eventType: "form_start", label: "Start", position: 0 },
      { eventType: "form_submit", label: "Submit", position: 1 },
      { eventType: "form_success", label: "Success", position: 2 },
    ],
  },
  {
    name: "Abandonment check",
    desc: "Spot where engaged visitors give up before finishing.",
    icon: "target",
    steps: [
      { eventType: "form_start", label: "Start", position: 0 },
      { eventType: "form_abandon", label: "Abandon", position: 1 },
    ],
  },
];

function TemplateCardShell({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div
      onClick={() => { if (!disabled) onClick(); }}
      className={`group relative flex h-[360px] w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md ${disabled ? "pointer-events-none opacity-70" : ""}`}
    >
      <div
        aria-hidden
        className="absolute inset-0 [background-image:linear-gradient(#e9ebf1_1px,transparent_1px),linear-gradient(90deg,#e9ebf1_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_90%_90%_at_50%_40%,black_30%,transparent_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_108%,rgba(37,99,235,0.28),transparent_70%)]"
      />
      <div className="relative flex flex-1 flex-col justify-end p-5">
        {children}
      </div>
    </div>
  );
}

function TemplateGallery({ onUse, creating, onAskYoi }: { onUse: (t: FunnelTemplate) => void; creating: boolean; onAskYoi: () => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {FUNNEL_TEMPLATES.map((t) => (
        <TemplateCardShell key={t.name} onClick={() => onUse(t)} disabled={creating}>
          <p className="text-[15px] font-semibold text-trell-ink">{creating ? "Creating…" : t.name}</p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-trell-ink-subtle">{t.desc}</p>
          <p className="mt-2 text-xs font-semibold text-blue-600">Use template →</p>
        </TemplateCardShell>
      ))}
      <TemplateCardShell onClick={onAskYoi}>
        <p className="text-[15px] font-semibold text-trell-ink">Generate with Yoi</p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-trell-ink-subtle">Describe the funnel you want and Yoi builds it for you.</p>
        <p className="mt-2 text-xs font-semibold text-blue-600">Ask Yoi →</p>
      </TemplateCardShell>
    </div>
  );
}

export default function FunnelsPage() {
  const { projectId } = useProjectId();
  const { openChat } = useChat();
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<SavedFunnel | null>(null);
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

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

  function handleUseTemplate(t: FunnelTemplate) {
    createFunnel.mutate(
      { name: t.name, steps: t.steps.map((s) => ({ eventType: s.eventType, label: s.label, position: s.position })) },
      {
        onSuccess: (res: unknown) => {
          const id = (res as { funnel?: { id?: string } } | null)?.funnel?.id;
          if (id) setActiveFunnelId(id);
          setShowTemplates(false);
        },
      },
    );
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
          onClick={() => setShowTemplates((v) => !v)}
          className="trell-btn-secondary h-10 px-4"
        >
          Templates
        </button>
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

      {showTemplates && !builderOpen && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-trell-ink">Start from a template</h2>
          <TemplateGallery onUse={handleUseTemplate} creating={createFunnel.isPending} onAskYoi={openChat} />
        </div>
      )}

      {!builderOpen && !showTemplates && savedFunnels.length > 0 && (
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
        <div className="space-y-6">
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
          <div>
            <h2 className="mb-3 text-sm font-semibold text-trell-ink">Or start from a template</h2>
            <TemplateGallery onUse={handleUseTemplate} creating={createFunnel.isPending} onAskYoi={openChat} />
          </div>
        </div>
      )}

      {!activeFunnel && !builderOpen && savedFunnels.length > 0 && (
        <p className="py-8 text-center text-sm text-trell-ink-muted">Select a funnel above to see its conversion.</p>
      )}
    </div>
  );
}

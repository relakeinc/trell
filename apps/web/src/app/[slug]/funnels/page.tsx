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

function TemplateShot({ steps }: { steps: { label: string }[] }) {
  return (
    <div className="flex h-full flex-col justify-center gap-2 bg-[linear-gradient(135deg,#dbeafe_0%,#e0e7ff_45%,#ede9fe_70%,#f3e8ff_100%)] p-4">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2 rounded-md bg-white/85 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
          <span className="w-14 shrink-0 truncate text-[10px] font-medium text-trell-ink-muted">{s.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb,#7c3aed)]"
              style={{ width: `${Math.max(18, 100 - i * 24)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function YoiShot() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 bg-[linear-gradient(135deg,#dbeafe_0%,#e0e7ff_45%,#ede9fe_70%,#f3e8ff_100%)] p-4">
      <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-blue-600 px-2.5 py-1.5 text-[11px] text-white shadow-sm">
        track signup drop-off
      </div>
      <div className="w-fit max-w-[85%] rounded-lg rounded-bl-sm bg-white/85 px-2.5 py-1.5 text-[11px] text-trell-ink shadow-sm backdrop-blur-sm">
        Done — funnel created ✓
      </div>
    </div>
  );
}

function TemplateGallery({ onUse, creating, onAskYoi }: { onUse: (t: FunnelTemplate) => void; creating: boolean; onAskYoi: () => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {FUNNEL_TEMPLATES.map((t) => (
        <div
          key={t.name}
          onClick={() => { if (!creating) onUse(t); }}
          className={`group relative block cursor-pointer ${creating ? "pointer-events-none opacity-70" : ""}`}
        >
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="aspect-[900/580] w-full overflow-hidden [mask-image:linear-gradient(black_90%,transparent)]">
              <TemplateShot steps={t.steps} />
            </div>
          </div>
          <div className="absolute left-4 top-4 rounded bg-white px-2 py-1 text-[0.625rem] font-semibold uppercase text-neutral-800 shadow-[0_2px_2px_0_#00000014]">
            Template
          </div>
          <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm transition-all duration-100 group-hover:drop-shadow-md">
            <div className="shrink-0">
              <div className="flex size-12 items-center justify-center rounded-md bg-[linear-gradient(135deg,#dbeafe,#ede9fe)] text-trell-ink">
                <Icon name={t.icon} size={24} />
              </div>
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-base font-medium text-neutral-900">{creating ? "Creating…" : t.name}</span>
              <p className="line-clamp-2 text-sm font-medium text-neutral-700">{t.desc}</p>
            </div>
          </div>
        </div>
      ))}
      <div
        onClick={onAskYoi}
        className="group relative block cursor-pointer"
      >
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="aspect-[900/580] w-full overflow-hidden [mask-image:linear-gradient(black_90%,transparent)]">
            <YoiShot />
          </div>
        </div>
        <div className="absolute left-4 top-4 rounded bg-white px-2 py-1 text-[0.625rem] font-semibold uppercase text-neutral-800 shadow-[0_2px_2px_0_#00000014]">
          AI
        </div>
        <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm transition-all duration-100 group-hover:drop-shadow-md">
          <div className="shrink-0">
            <div className="flex size-12 items-center justify-center rounded-md bg-[linear-gradient(135deg,#dbeafe,#ede9fe)] text-trell-ink">
              <Icon name="magic-star" size={24} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-base font-medium text-neutral-900">Generate with Yoi</span>
            <p className="line-clamp-2 text-sm font-medium text-neutral-700">Describe the funnel you want and Yoi builds it for you.</p>
          </div>
        </div>
      </div>
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

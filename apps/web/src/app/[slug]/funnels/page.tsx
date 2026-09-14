"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { AskYoiButton } from "@/components/AskYoiButton";
import { FunnelBuilder } from "@/components/FunnelBuilder";
import { FunnelView } from "@/components/FunnelView";
import { useChat } from "@/components/ChatProvider";
import { SegmentedControl } from "@/components/SegmentedControl";
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
  glow: string;
  accent: string;
  from: string;
  to: string;
  steps: { eventType: string; label: string; position: number }[];
}

const SLOT_X = [25, 215, 215, 65, 65, 180];
const SLOT_Y = [30, 30, 90, 90, 150, 150];

function JourneyVisual({ steps, from, to, id }: { steps: { label: string }[]; from: string; to: string; id: string }) {
  const n = steps.length;
  const idx = steps.map((_, i) => Math.round((i * (SLOT_X.length - 1)) / Math.max(1, n - 1)));
  return (
    <svg viewBox="0 0 280 175" className="h-full w-full" role="img" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path
        d="M 25 30 H 215 A 30 30 0 0 1 215 90 H 65 A 30 30 0 0 0 65 150 H 180"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.85"
      />
      {idx.map((s, i) => (
        <g key={i}>
          <circle cx={SLOT_X[s] ?? 0} cy={SLOT_Y[s] ?? 0} r="9" fill="#fff" stroke={`url(#${id})`} strokeWidth="3" />
          <circle cx={SLOT_X[s] ?? 0} cy={SLOT_Y[s] ?? 0} r="3" fill={from} />
          <text
            x={SLOT_X[s] ?? 0}
            y={(SLOT_Y[s] ?? 0) + 22}
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill="#71717a"
          >
            {steps[i]!.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    name: "Complete journey",
    desc: "From first view to success — the full picture of every form.",
    icon: "funnels",
    glow: "bg-[radial-gradient(ellipse_90%_55%_at_50%_108%,rgba(37,99,235,0.28),transparent_70%)]",
    accent: "text-blue-600",
    from: "#2563eb",
    to: "#93c5fd",
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
    glow: "bg-[radial-gradient(ellipse_90%_55%_at_50%_108%,rgba(22,163,74,0.28),transparent_70%)]",
    accent: "text-green-600",
    from: "#16a34a",
    to: "#86efac",
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
    glow: "bg-[radial-gradient(ellipse_90%_55%_at_50%_108%,rgba(234,88,12,0.30),transparent_70%)]",
    accent: "text-orange-600",
    from: "#ea580c",
    to: "#fdba74",
    steps: [
      { eventType: "form_start", label: "Start", position: 0 },
      { eventType: "form_abandon", label: "Abandon", position: 1 },
    ],
  },
];

function TemplateCardShell({
  onClick,
  disabled,
  glow,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  glow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={`group relative flex h-[360px] w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md ${disabled ? "pointer-events-none opacity-70" : ""}`}
    >
      {/* Per-card color glow disabled — it looked bad. Restore by uncommenting the next line.
      <div aria-hidden className={`absolute inset-0 ${glow}`} />
      */}
      <div className="relative flex flex-1 flex-col justify-end p-5">{children}</div>
    </div>
  );
}

function FunnelSkeleton({ name, stepCount }: { name: string; stepCount: number }) {
  return (
    <div
      className="rounded-2xl border border-trell-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      aria-busy="true"
      aria-label="Loading funnel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-trell-ink">{name}</h3>
          <div className="mt-2 h-3 w-44 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="h-8 w-20 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="mt-4 space-y-4">
        {Array.from({ length: stepCount }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-neutral-100" />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="h-3.5 w-32 animate-pulse rounded bg-neutral-100" />
                <span className="h-3.5 w-12 animate-pulse rounded bg-neutral-100" />
              </div>
              <div
                className="h-9 animate-pulse rounded-lg bg-neutral-100"
                style={{ width: `${Math.max(25, 100 - i * 22)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateGallery({
  onUse,
  creating,
  onAskYoi,
}: {
  onUse: (t: FunnelTemplate) => void;
  creating: boolean;
  onAskYoi: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {FUNNEL_TEMPLATES.map((t) => (
        <TemplateCardShell key={t.name} onClick={() => onUse(t)} disabled={creating} glow={t.glow}>
          <div className="min-h-0 flex-1 px-1 pb-1">
            <JourneyVisual
              steps={t.steps}
              from={t.from}
              to={t.to}
              id={`j-${t.name.replace(/\s+/g, "-").toLowerCase()}`}
            />
          </div>
          <p className="text-[15px] font-semibold text-trell-ink">{creating ? "Creating…" : t.name}</p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-trell-ink-subtle">{t.desc}</p>
          <p className={`mt-2 text-xs font-semibold ${t.accent}`}>Use template →</p>
        </TemplateCardShell>
      ))}
      <TemplateCardShell
        onClick={onAskYoi}
        glow="bg-[radial-gradient(ellipse_90%_55%_at_50%_108%,rgba(124,58,237,0.30),transparent_70%)]"
      >
        <div className="min-h-0 flex-1 px-1 pb-1">
          <JourneyVisual
            steps={[{ label: "Ask" }, { label: "Build" }, { label: "Done" }]}
            from="#7c3aed"
            to="#c4b5fd"
            id="j-yoi"
          />
        </div>
        <p className="text-[15px] font-semibold text-trell-ink">Generate with Yoi</p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-trell-ink-subtle">
          Describe the funnel you want and Yoi builds it for you.
        </p>
        <p className="mt-2 text-xs font-semibold text-violet-600">Ask Yoi →</p>
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
  const [pendingTemplate, setPendingTemplate] = useState<FunnelTemplate | null>(null);

  const qs = `from=${from}&to=${to}`;

  const { data: funnelsData } = useProjectFunnels(projectId);
  const savedFunnels = funnelsData?.funnels ?? [];

  const { data: liveData, isError: liveError } = useFunnelLive(projectId, activeFunnelId, qs);

  const { createFunnel, updateFunnel, deleteFunnel } = useFunnelMutations(projectId);

  useEffect(() => {
    if (savedFunnels.length > 0 && !activeFunnelId) {
      setActiveFunnelId(savedFunnels[0]!.id);
    }
  }, [savedFunnels, activeFunnelId]);

  useEffect(() => {
    setConfirmDelete(false);
  }, [activeFunnelId]);

  const savedActive = activeFunnelId ? (savedFunnels.find((f) => f.id === activeFunnelId) ?? null) : null;
  const activeFunnel =
    savedActive && liveData ? { ...savedActive, totalSessions: liveData.totalSessions, steps: liveData.steps } : null;

  function handleSave(data: {
    name: string;
    steps: { eventType: string; formId?: string; label?: string; position: number }[];
  }) {
    if (editingFunnel) {
      updateFunnel.mutate(
        { id: editingFunnel.id, ...data },
        {
          onSuccess: () => {
            setBuilderOpen(false);
            setEditingFunnel(null);
          },
        },
      );
    } else {
      createFunnel.mutate(data, {
        onSuccess: () => {
          setBuilderOpen(false);
          setEditingFunnel(null);
        },
      });
    }
  }

  function handleUseTemplate(t: FunnelTemplate) {
    if (createFunnel.isPending) return;
    // Instant feedback: hide gallery, show skeleton, then swap in the real funnel.
    setPendingTemplate(t);
    setShowTemplates(false);
    createFunnel.mutate(
      { name: t.name, steps: t.steps.map((s) => ({ eventType: s.eventType, label: s.label, position: s.position })) },
      {
        onSuccess: (res: unknown) => {
          const id = (res as { funnel?: { id?: string } } | null)?.funnel?.id;
          if (id) setActiveFunnelId(id);
          setPendingTemplate(null);
        },
        onError: () => setPendingTemplate(null),
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
    deleteFunnel.mutate(id, {
      onSuccess: () => {
        if (activeFunnelId === id) setActiveFunnelId(null);
      },
    });
  }

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <div className="hidden md:block">
          <h1 className="text-base font-semibold text-trell-ink">Funnels</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {savedFunnels.length > 0 && (
            <button onClick={() => setShowTemplates((v) => !v)} className="trell-btn-secondary h-10 px-4">
              Templates
            </button>
          )}
          <button
            onClick={() => {
              setEditingFunnel(null);
              setBuilderOpen(true);
            }}
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
            initial={
              editingFunnel
                ? {
                    id: editingFunnel.id,
                    name: editingFunnel.name,
                    steps: editingFunnel.steps.map((s) => ({
                      eventType: s.eventType ?? "",
                      formId: s.formId ?? undefined,
                      label: s.label ?? undefined,
                      position: s.position,
                    })),
                  }
                : undefined
            }
            onSave={(data) => void handleSave(data)}
            onCancel={() => {
              setBuilderOpen(false);
              setEditingFunnel(null);
            }}
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
          <SegmentedControl
            scrollable
            size="md"
            ariaLabel="Funnels"
            value={activeFunnelId ?? ""}
            onChange={(id) => setActiveFunnelId(id)}
            options={savedFunnels.map((f) => ({ value: f.id, label: f.name, title: `${f.steps.length} steps` }))}
          />
          <span className="text-xs text-trell-ink-muted">
            Live data · {fmtShortDate(from)} – {fmtShortDate(to)}
          </span>
        </div>
      )}

      {activeFunnel && !builderOpen && (
        <div className="space-y-3">
          <FunnelView funnel={activeFunnel} onDrillDown={() => {}} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingFunnel(activeFunnel as unknown as SavedFunnel);
                setBuilderOpen(true);
              }}
              className="trell-btn-secondary h-9"
            >
              Edit funnel
            </button>
            <button
              onClick={() => activeFunnelId && handleDelete(activeFunnelId)}
              className={`${confirmDelete ? "trell-btn-danger" : "trell-btn-outline"} h-9 gap-1.5 text-xs`}
            >
              {confirmDelete ? "Click again to confirm delete" : "Delete"}
            </button>
          </div>
        </div>
      )}

      {pendingTemplate && !activeFunnel && !builderOpen && (
        <div className="space-y-3">
          <FunnelSkeleton name={pendingTemplate.name} stepCount={pendingTemplate.steps.length} />
        </div>
      )}

      {!activeFunnel && !builderOpen && !pendingTemplate && savedFunnels.length === 0 && (
        <div className="space-y-6">
          <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-trell-line bg-white px-6 py-24 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-trell-line bg-white text-trell-ink-subtle">
              <Icon name="funnels" size={24} />
            </div>
            <h2 className="text-base font-semibold text-trell-ink">No funnels yet</h2>
            <p className="mt-1.5 max-w-sm text-sm text-trell-ink-subtle">
              Funnels show how many visitors complete each step — and where the rest drop off. Start with view → start →
              success.
            </p>
            <button onClick={() => setBuilderOpen(true)} className="trell-btn-accent mt-4 h-10 px-6">
              Create funnel
            </button>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-trell-ink">Or start from a template</h2>
            <TemplateGallery onUse={handleUseTemplate} creating={createFunnel.isPending} onAskYoi={openChat} />
          </div>
        </div>
      )}

      {!activeFunnel &&
        !builderOpen &&
        !pendingTemplate &&
        savedFunnels.length > 0 &&
        (activeFunnelId && savedActive ? (
          liveError ? (
            <p className="py-8 text-center text-sm text-red-600">Couldn&apos;t load this funnel. Please try again.</p>
          ) : (
            <FunnelSkeleton name={savedActive.name} stepCount={savedActive.steps.length} />
          )
        ) : (
          <p className="py-8 text-center text-sm text-trell-ink-muted">Select a funnel above to see its conversion.</p>
        ))}
    </div>
  );
}

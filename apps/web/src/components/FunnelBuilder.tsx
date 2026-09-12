"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useMounted } from "@/components/Transitions";

interface Step {
  eventType: string;
  formId?: string;
  label?: string;
  position: number;
}

const EVENT_TYPES = [
  { value: "form_view", label: "Form view", hint: "Someone saw the form" },
  { value: "form_start", label: "Form start", hint: "Started filling it" },
  { value: "form_submit", label: "Submission", hint: "Pressed submit" },
  { value: "form_success", label: "Conversion", hint: "Completed successfully" },
  { value: "form_abandon", label: "Abandonment", hint: "Left without finishing" },
  { value: "cta_click", label: "CTA click", hint: "Clicked a button/link" },
  { value: "field_interaction", label: "Field interaction", hint: "Touched a field" },
];

export function FunnelBuilder({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { id?: string; name: string; steps: Step[] };
  onSave: (data: { name: string; steps: Step[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [steps, setSteps] = useState<Step[]>(
    initial?.steps ?? [
      { eventType: "form_view", position: 0 },
      { eventType: "form_success", position: 1 },
    ],
  );

  const valid = name.trim().length > 0 && steps.length >= 2;

  const addStep = () => {
    setSteps([...steps, { eventType: "form_view", position: steps.length }]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, position: i })));
  };

  const updateStep = (idx: number, patch: Partial<Step>) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= steps.length) return;
    const copy = [...steps];
    [copy[idx], copy[ni]] = [copy[ni]!, copy[idx]!];
    setSteps(copy.map((s, i) => ({ ...s, position: i })));
  };

  return (
    <div className="rounded-2xl border border-trell-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div>
        <h3 className="text-sm font-semibold text-trell-ink">{initial?.id ? "Edit funnel" : "New funnel"}</h3>
        <p className="mt-0.5 text-xs text-trell-ink-muted">
          Visitors must complete the steps <span className="font-medium text-trell-ink">in order</span>.
        </p>
      </div>

      <label className="mb-1 mt-4 block text-xs font-medium text-trell-ink-muted">Funnel name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="trell-input h-10 w-full"
        placeholder="e.g. Checkout"
      />

      <div className="mb-2 mt-5 text-xs font-medium text-trell-ink-muted">
        Flow <span className="text-neutral-400">· {steps.length} steps</span>
      </div>

      <div>
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const hint = EVENT_TYPES.find((et) => et.value === step.eventType)?.hint;
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-xs font-semibold tabular-nums text-white shadow-sm">
                  {i + 1}
                </span>
                {!last && (
                  <span className="w-0.5 flex-1 bg-gradient-to-b from-neutral-800 via-neutral-300 to-neutral-200" />
                )}
              </div>

              <div
                className={`mb-2 flex-1 rounded-xl border border-trell-line bg-white p-3 shadow-sm transition-colors ${!last ? "" : "mb-0"}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                    {EVENT_TYPES.find((et) => et.value === step.eventType)?.label ?? step.eventType}
                  </span>
                  <span className="flex items-center">
                    <button
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      title="Move up"
                      className="rounded-md px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-trell-ink disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveStep(i, 1)}
                      disabled={last}
                      title="Move down"
                      className="rounded-md px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-trell-ink disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeStep(i)}
                      disabled={steps.length <= 1}
                      title="Remove step"
                      className="rounded-md px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-600 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-neutral-500">Event</span>
                    <EventSelect value={step.eventType} onChange={(v) => updateStep(i, { eventType: v })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-neutral-500">
                      Form ID <span className="text-neutral-400">(any if empty)</span>
                    </span>
                    <input
                      value={step.formId ?? ""}
                      onChange={(e) => updateStep(i, { formId: e.target.value || undefined })}
                      className="trell-input h-9 w-full text-xs"
                      placeholder="e.g. checkout"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-neutral-500">
                      Label <span className="text-neutral-400">(auto if empty)</span>
                    </span>
                    <input
                      value={step.label ?? ""}
                      onChange={(e) => updateStep(i, { label: e.target.value || undefined })}
                      className="trell-input h-9 w-full text-xs"
                      placeholder={EVENT_TYPES.find((et) => et.value === step.eventType)?.label ?? "Step label"}
                    />
                  </label>
                </div>
                {hint && <p className="mt-1.5 text-[11px] text-neutral-400">{hint}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={addStep}
        className="mt-3 h-9 w-full rounded-lg border border-dashed border-trell-line text-xs font-medium text-trell-ink-subtle transition-colors hover:border-neutral-400 hover:text-trell-ink"
      >
        + Add step after step {steps.length}
      </button>

      {!valid && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {steps.length < 2
            ? "A funnel needs at least 2 steps to measure conversion."
            : "Give your funnel a name to save it."}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={() => valid && onSave({ name: name.trim(), steps })}
          disabled={!valid}
          className="trell-btn-accent h-10 w-full"
        >
          {initial?.id ? "Save changes" : "Create funnel"}
        </button>
        <button onClick={onCancel} className="trell-btn-outline h-9 w-full justify-center text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Custom dropdown for the event type — the native select popup can't be styled. */
function EventSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const t = useMounted(open, 150);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = EVENT_TYPES.find((et) => et.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-xs transition-colors ${
          open ? "border-neutral-400" : "border-trell-line hover:border-neutral-300"
        }`}
      >
        <span className="truncate text-trell-ink">{current?.label ?? value}</span>
        <Icon
          name="arrow-down-01"
          size={14}
          className={`shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {t.mounted && (
        <div
          className={`absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-xl border border-trell-line bg-white py-1 shadow-xl ${t.closing ? "trell-pop-out" : "trell-pop-in"}`}
        >
          {EVENT_TYPES.map((et) => (
            <button
              key={et.value}
              type="button"
              onClick={() => {
                onChange(et.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-neutral-100 ${
                et.value === value ? "bg-neutral-50" : ""
              }`}
            >
              <span>
                <span
                  className={`block text-xs ${et.value === value ? "font-semibold text-trell-ink" : "text-neutral-700"}`}
                >
                  {et.label}
                </span>
                <span className="block text-[11px] font-normal text-neutral-400">{et.hint}</span>
              </span>
              {et.value === value && <Icon name="check" size={14} className="shrink-0 text-trell-ink" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

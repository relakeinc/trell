"use client";

import { useState } from "react";

interface Step {
  eventType: string;
  formId?: string;
  label?: string;
  position: number;
}

const EVENT_TYPES = [
  { value: "form_view", label: "Form view" },
  { value: "form_start", label: "Form start" },
  { value: "form_submit", label: "Submission" },
  { value: "form_success", label: "Conversion" },
  { value: "form_abandon", label: "Abandonment" },
  { value: "cta_click", label: "CTA click" },
  { value: "field_interaction", label: "Field interaction" },
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
    initial?.steps ?? [{ eventType: "form_view", position: 0 }],
  );

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
    <div className="trell-card p-5">
      <h3 className="mb-3 text-sm font-semibold">{initial?.id ? "Edit funnel" : "New funnel"}</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="trell-input mb-3 w-full"
        placeholder="Funnel name (e.g. Checkout)"
      />
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-center text-xs text-trell-muted">{i + 1}</span>
            <select
              value={step.eventType}
              onChange={(e) => updateStep(i, { eventType: e.target.value })}
              className="trell-input flex-1"
            >
              {EVENT_TYPES.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
            <input
              value={step.formId ?? ""}
              onChange={(e) => updateStep(i, { formId: e.target.value || undefined })}
              className="trell-input w-28"
              placeholder="form id (opt)"
            />
            <input
              value={step.label ?? ""}
              onChange={(e) => updateStep(i, { label: e.target.value || undefined })}
              className="trell-input w-28"
              placeholder="label (opt)"
            />
            <button onClick={() => moveStep(i, -1)} className="text-trell-muted hover:text-trell-ink" disabled={i === 0}>↑</button>
            <button onClick={() => moveStep(i, 1)} className="text-trell-muted hover:text-trell-ink" disabled={i === steps.length - 1}>↓</button>
            <button onClick={() => removeStep(i)} className="text-trell-muted hover:text-red-600" disabled={steps.length <= 1}>✕</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={addStep} className="trell-btn-outline h-8 text-xs">+ Add step</button>
        <button
          onClick={() => name && steps.length >= 2 && onSave({ name, steps })}
          disabled={!name || steps.length < 2}
          className="trell-btn-primary h-8 text-xs"
        >
          Save funnel
        </button>
        <button onClick={onCancel} className="trell-btn-outline h-8 text-xs">Cancel</button>
      </div>
      {steps.length < 2 && <p className="mt-2 text-xs text-trell-muted">A funnel needs at least 2 steps.</p>}
    </div>
  );
}

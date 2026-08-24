/**
 * Product language — how Trell speaks to the user. Internal event/metric names
 * (form_view, form_start, …) stay in the SDK/API; the UI shows friendly labels
 * and short explanations, keeping technical names only where useful.
 */

export const EVENT_LABEL: Record<string, string> = {
  form_view: "Form views",
  form_start: "Form starts",
  form_submit: "Submissions",
  form_success: "Conversions",
  form_abandon: "Abandonments",
  field_interaction: "Field interactions",
  cta_click: "CTA clicks",
};

export function eventLabel(type: string): string {
  return EVENT_LABEL[type] ?? type;
}

export const METRIC_LABEL: Record<string, string> = {
  views: "Form views",
  starts: "Form starts",
  submits: "Submissions",
  successes: "Conversions",
  abandons: "Abandonments",
  ctaClicks: "CTA clicks",
  fieldInteractions: "Field interactions",
  sessions: "Sessions",
  visitors: "Visitors",
  conversionRate: "Conversion rate",
  startConversionRate: "Completion after start",
  avgTimeToCompleteMs: "Avg. time to complete",
};

export function metricLabel(key: string): string {
  return METRIC_LABEL[key] ?? key;
}

/** Short contextual explanations for the two conversion-like metrics. */
export const METRIC_HELP: Record<string, string> = {
  conversionRate:
    "Conversions ÷ form views. Of everyone who saw your form, how many completed it.",
  startConversionRate:
    "Conversions ÷ form starts. Of those who started filling the form, how many finished.",
  avgTimeToCompleteMs:
    "Average time from starting a form to a successful submission (incomplete sessions are ignored).",
  sessions: "A visit. One visitor can have several sessions.",
  visitors: "Distinct people (an anonymous id). Repeated sessions don't inflate this.",
};

export function metricHelp(key: string): string | undefined {
  return METRIC_HELP[key];
}

// ── Funnel labels ─────────────────────────────────────────────

export const FUNNEL_LABEL: Record<string, string> = {
  conversionRate: "Step conversion",
  dropOff: "Drop-off",
  totalSessions: "Total sessions",
};

export function funnelLabel(key: string): string {
  return FUNNEL_LABEL[key] ?? key;
}

// ── Comparison labels ─────────────────────────────────────────

export const COMPARISON_LABEL: Record<string, string> = {
  baseline: "Previous period",
  compare: "Current period",
  delta: "Change",
  absolute: "Absolute",
  percentage: "Percentage",
  up: "Increase",
  down: "Decrease",
  flat: "No change",
};

export function comparisonLabel(key: string): string {
  return COMPARISON_LABEL[key] ?? key;
}

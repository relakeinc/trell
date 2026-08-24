import type { EventPayload, EventType, FormContext } from "@trell/shared";

/** Tiny internal validator (not a dependency) — see docs/sdk-contract.md §11. */
export function isEventType(value: string): value is EventType {
  return ["form_view", "form_start", "field_interaction", "form_submit", "form_success", "form_abandon", "cta_click"].includes(
    value,
  );
}

export function validateEvent(event: EventPayload): boolean {
  if (!event) return false;
  if (event.v !== 1) return false;
  if (!event.event_id) return false;
  if (!event.project) return false;
  if (!event.type) return false;
  if (typeof event.ts !== "number" || !Number.isFinite(event.ts)) return false;
  if (!event.session_id) return false;
  if (!event.visitor_id) return false;
  if (!event.url) return false;
  if (!event.page) return false;
  if (!event.device) return false;
  if (!event.properties || typeof event.properties !== "object") return false;

  const type = event.type;
  const e = event as unknown as { field?: string; interaction?: string; valid?: boolean; durationMs?: number; cta?: string; form?: FormContext };
  const form = e.form;

  switch (type) {
    case "field_interaction":
      return !!e.field && (e.interaction === "focus" || e.interaction === "change") && !!form?.id;
    case "form_submit":
      return typeof e.valid === "boolean" && !!form?.id;
    case "form_success":
      return !!form?.id;
    case "form_abandon":
      return typeof e.durationMs === "number" && !!form?.id;
    case "cta_click":
      return !!e.cta;
    case "form_view":
    case "form_start":
      return !!form?.id;
    default:
      // custom event: only the base contract applies
      return true;
  }
}

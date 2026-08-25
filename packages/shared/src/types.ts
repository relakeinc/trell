/**
 * Public type definitions agreed in the frozen SDK contract.
 * See docs/sdk-contract.md §3 (config), §4 (forms), §7 (event schema).
 * These types are the single source of truth shared by SDK and API.
 */

// ---------------------------------------------------------------------------
// Events (§7)
// ---------------------------------------------------------------------------

export const EVENT_TYPES = [
  "form_view",
  "form_start",
  "field_interaction",
  "form_submit",
  "form_success",
  "form_abandon",
  "cta_click",
  "scroll_depth",
  "page_exit",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface Utm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
}

export interface Device {
  type: "desktop" | "tablet" | "mobile";
  os: string | null;
  browser: string | null;
  viewport: [number, number];
}

export interface BaseEvent {
  v: 1;
  event_id: string;
  project: string;
  type: EventType | string;
  ts: number;
  session_id: string;
  visitor_id: string;
  url: string;
  page: { path: string; title: string };
  referrer: string;
  utm: Utm | null;
  device: Device;
  properties: Record<string, unknown>;
}

export interface FormContext {
  id: string;
  name?: string;
}

export type FormEventType = Exclude<EventType, "cta_click">;

export interface FormEvent extends BaseEvent {
  type: FormEventType;
  form: FormContext;
}

export interface FieldInteractionEvent extends FormEvent {
  type: "field_interaction";
  field: string;
  interaction: "focus" | "change";
}

export interface FormSubmitEvent extends FormEvent {
  type: "form_submit";
  valid: boolean;
}

export interface FormSuccessEvent extends FormEvent {
  type: "form_success";
  timeToSuccessMs?: number;
}

export interface FormAbandonEvent extends FormEvent {
  type: "form_abandon";
  durationMs: number;
}

export interface CtaClickEvent extends BaseEvent {
  type: "cta_click";
  cta: string;
  label?: string;
  href?: string;
}

export interface CustomEvent extends BaseEvent {
  type: string;
}

export type EventPayload =
  | FieldInteractionEvent
  | FormSubmitEvent
  | FormSuccessEvent
  | FormAbandonEvent
  | CtaClickEvent
  | FormEvent
  | CustomEvent;

// ---------------------------------------------------------------------------
// Public SDK API surface (§2)
// ---------------------------------------------------------------------------

export interface TrackOptions {
  form?: string;
  properties?: Record<string, unknown>;
  value?: string | number;
  cta?: string;
}

export interface Identity {
  /** Stable user id (raw). The SDK hashes it — never transmitted raw. */
  userId?: string;
  /** User email (raw). The SDK hashes it — never transmitted raw. */
  email?: string;
}

export type SuccessDetection =
  | false
  | {
      observed?: string[];
      throttleMs?: number;
      timeoutMs?: number;
    };

export interface FormConfig {
  id: string;
  name?: string;
  selector: string;
  fields?: string[];
  ignore?: string[];
  success?: SuccessDetection;
}

export interface TrellConfig {
  project: string;
  domain?: string;
  endpoint?: string;
  autoDetect?: boolean;
  forms?: FormConfig[];
  sampleRate?: number;
  privacy?: "consent" | "strict";
  consent?: boolean;
  debug?: boolean;
  defaults?: Record<string, unknown>;
  exposeGlobal?: boolean;
}

export interface TrellForm {
  success(options?: TrackOptions): void;
  destroy(): void;
}

export interface Trell {
  track(type: EventType | string, options?: TrackOptions): void;
  form(config: FormConfig): TrellForm;
  identify(identity: Identity): void;
}

import type {
  EventPayload,
  FormContext,
  TrackOptions,
  Utm,
} from "@trell/shared";
import type { Context } from "./context";
import { randomUUID } from "./rng";

export interface BuildArgs {
  project: string;
  context: Context;
  url: { url: string; referrer: string; page: { path: string; title: string } };
  defaults: Record<string, unknown>;
  identityProps: Record<string, unknown>;
  type: string;
  options?: TrackOptions;
  form?: FormContext;
  extra?: Record<string, unknown>;
  now?: number;
}

export function buildEvent(args: BuildArgs): EventPayload {
  const { project, context, url, defaults, identityProps, type, options, form, extra } = args;

  const ts = args.now ?? Date.now();
  const extraProps = (extra?.properties ?? {}) as Record<string, unknown>;

  const properties: Record<string, unknown> = {
    ...defaults,
    ...identityProps,
    ...extraProps,
    ...(options?.properties ?? {}),
  };
  if (options?.value != null) properties.value = options.value;

  const { properties: _unused, ...extraRest } = extra ?? {};
  void _unused;

  const base = {
    v: 1 as const,
    event_id: randomUUID(),
    project,
    type,
    ts,
    session_id: context.sessionId,
    visitor_id: context.visitorId,
    url: url.url,
    page: url.page,
    referrer: url.referrer,
    utm: context.utm as Utm | null,
    device: context.device,
    properties,
  };

  if (form) {
    return { ...base, ...extraRest, form } as EventPayload;
  }

  if (type === "cta_click") {
    return { ...base, ...extraRest, cta: options?.cta ?? "" } as EventPayload;
  }

  return { ...base, ...extraRest } as EventPayload;
}

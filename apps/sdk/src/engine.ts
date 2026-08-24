import {
  DEFAULT_ENDPOINT,
  type EventPayload,
  type EventType,
  type FormConfig,
  type Identity,
  type TrackOptions,
  type Trell,
  type TrellConfig,
  type TrellForm,
} from "@trell/shared";
import { attachAuto } from "./auto";
import { getOrCreateSessionId, getOrCreateUtm, getOrCreateVisitorId, getUrlContext, detectDevice, type Context } from "./context";
import { buildEvent } from "./payload";
import { hashIdentity } from "./rng";
import { resolveStore } from "./storage";
import { Transport } from "./transport";
import { validateEvent } from "./validate";

const HIGH_VOLUME = new Set(["form_view", "field_interaction", "cta_click"]);

export interface EngineOptions {
  win: Window;
  fetchFn?: typeof fetch;
  beaconFn?: (url: string, data: BodyInit) => boolean;
  now?: () => number;
}

export class TrellEngine implements Trell {
  readonly config: TrellConfig;
  private win: Window;
  private context: Context;
  private transport: Transport;
  private auto: ReturnType<typeof attachAuto>;
  private identityProps: Record<string, unknown> = {};
  private debug: boolean;
  private sampleRate: number;
  private defaultProps: Record<string, unknown>;

  constructor(config: TrellConfig, opts: EngineOptions) {
    this.config = config;
    this.debug = config.debug ?? false;
    this.sampleRate = config.sampleRate ?? 1;
    this.win = opts.win;

    const store = resolveStore(this.win, config);
    this.context = {
      visitorId: getOrCreateVisitorId(this.win, store.store, store.persistent),
      sessionId: getOrCreateSessionId(this.win, store.store),
      utm: getOrCreateUtm(this.win, store.store, store.persistent),
      device: detectDevice(this.win),
    };

    this.defaultProps = config.defaults ?? {};

    this.transport = new Transport({
      endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
      project: config.project,
      fetchFn: (opts.fetchFn ?? globalThis.fetch).bind(globalThis),
      beaconFn: opts.beaconFn ?? this.win.navigator.sendBeacon?.bind(this.win.navigator),
      addEventListener: this.win.addEventListener.bind(this.win),
      removeEventListener: this.win.removeEventListener.bind(this.win),
    });

    this.auto = attachAuto(
      this.win,
      {
        trackEvent: (type, { form, extra }) => this.trackEvent(type, { form, extra }),
      },
      { autoDetect: config.autoDetect },
    );
  }

  track(type: EventType | string, options?: TrackOptions): void {
    if (type === "form_success" && options?.form) {
      emitFormSuccess(this, options.form, options);
      return;
    }
    this.enqueueEvent({
      type,
      options,
      form: options?.form ? { id: options.form } : undefined,
    });
  }

  form(config: FormConfig): TrellForm {
    this.auto?.register(config);
    return {
      success: (options?: TrackOptions) => emitFormSuccess(this, config.id, options),
      destroy: () => this.auto?.destroyForm(config.id),
    };
  }

  identify(identity: Identity): void {
    this.identityProps = { ...this.identityProps, ...hashIdentity(identity) };
  }

  /** Internal: used by auto-detection to emit structured form/cta events. */
  trackEvent(
    type: string,
    opts: { form?: FormConfig | { id: string; name?: string }; extra?: Record<string, unknown> },
  ): void {
    this.enqueueEvent({ type, form: opts.form, extra: opts.extra });
  }

  private enqueueEvent(input: {
    type: string;
    options?: TrackOptions;
    form?: FormConfig | { id: string; name?: string };
    extra?: Record<string, unknown>;
  }): void {
    if (HIGH_VOLUME.has(input.type) && this.sampleRate < 1 && Math.random() > this.sampleRate) return;

    const event = buildEvent({
      project: this.config.project,
      context: this.context,
      url: getUrlContext(this.win),
      defaults: this.defaultProps,
      identityProps: this.identityProps,
      type: input.type,
      options: input.options,
      form: input.form ? { id: input.form.id, name: (input.form as FormConfig).name } : undefined,
      extra: input.extra,
    });

    if (!validateEvent(event)) {
      if (this.debug) console.warn("[trell] dropped invalid event", event);
      return;
    }

    this.transport.enqueue(event);
  }

  flushNow(): Promise<void> {
    return this.transport.flushNow();
  }

  destroy(): void {
    this.auto?.destroy();
    this.transport.destroy();
  }
}

function emitFormSuccess(engine: TrellEngine, formId: string, options?: TrackOptions): void {
  engine.trackEvent("form_success", {
    form: { id: formId },
    extra: options?.properties ? { properties: options.properties } : {},
  });
}

import type { FormConfig } from "@trell/shared";

/** Emits events into the engine. Keeps auto.ts decoupled from the engine. */
export interface AutoEmitter {
  trackEvent(type: string, opts: { form: FormConfig | { id: string; name?: string }; extra?: Record<string, unknown> }): void;
}

interface FormState {
  config: FormConfig;
  element: HTMLElement;
  startedAt: number | null;
  succeeded: boolean;
  lastField: Map<string, number>;
  disposers: (() => void)[];
}

const FIELD_THROTTLE_MS = 300;

export interface AutoController {
  register(config: FormConfig): void;
  success(config: FormConfig): void;
  destroyForm(id: string): void;
  destroy(): void;
}

export function attachAuto(win: Window, emitter: AutoEmitter, opts: { autoDetect?: boolean } = {}): AutoController {
  const doc = win.document;
  const states = new Map<string, FormState>();

  function createState(element: HTMLElement, config: FormConfig): FormState {
    return { config, element, startedAt: null, succeeded: false, lastField: new Map(), disposers: [] };
  }

  function markStart(state: FormState): void {
    if (state.startedAt == null) state.startedAt = Date.now();
  }

  function emitStart(state: FormState): void {
    markStart(state);
    emitter.trackEvent("form_start", { form: state.config });
  }

  function throttleField(state: FormState, input: HTMLElement, interaction: "focus" | "change"): void {
    const name = (input as HTMLInputElement).name || input.id || "";
    const now = Date.now();
    const last = state.lastField.get(name);
    if (last != null && now - last < FIELD_THROTTLE_MS) return;
    state.lastField.set(name, now);
    emitter.trackEvent("field_interaction", {
      form: state.config,
      extra: { field: name, interaction },
    });
  }

  function observeViewport(state: FormState): void {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        if (entries.some((e) => e.isIntersecting)) {
          emitter.trackEvent("form_view", { form: state.config });
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(state.element);
    state.disposers.push(() => io.disconnect());
  }

  function watchSuccess(state: FormState): void {
    const detection = state.config.success;
    if (!detection || state.succeeded) return;

    const observed = detection.observed ?? [];
    const timeoutMs = detection.timeoutMs ?? 5000;
    if (typeof MutationObserver === "undefined") return;

    const mo = new MutationObserver((muts: MutationRecord[]) => {
      let confirmed = false;
      if (observed.length > 0) {
        confirmed = muts.some((m => Array.from(m.addedNodes ?? []).some((node) => {
            const el = node as HTMLElement;
            return el.nodeType === 1 && el.matches ? el.matches(observed.join(",")) : false;
          })));
      } else {
        confirmed = muts.some((m) => m.type === "childList");
      }
      if (confirmed) {
        success(state.config);
        mo.disconnect();
      }
    });

    const target = state.element.ownerDocument?.body ?? state.element;
    mo.observe(target, { childList: true, subtree: true });
    const timer = setTimeout(() => mo.disconnect(), timeoutMs);
    state.disposers.push(() => {
      mo.disconnect();
      clearTimeout(timer);
    });
  }

  function attachListeners(state: FormState): void {
    const { element } = state;
    const capture = { capture: true } as AddEventListenerOptions;

    const onFocus = (e: Event) => {
      const input = e.target as HTMLElement | null;
      if (!input || !element.contains(input)) return;
      markStart(state);
      throttleField(state, input, "focus");
    };
    const onChange = (e: Event) => {
      const input = e.target as HTMLElement | null;
      if (!input || !element.contains(input)) return;
      markStart(state);
      throttleField(state, input, "change");
    };
    const onSubmit = (e: Event) => {
      markStart(state);
      const formEl = element as HTMLFormElement;
      const valid = typeof formEl.checkValidity === "function" ? formEl.checkValidity() : true;
      emitter.trackEvent("form_submit", { form: state.config, extra: { valid } });
      watchSuccess(state);
    };

    element.addEventListener("focusin", onFocus, capture);
    element.addEventListener("change", onChange, capture);
    element.addEventListener("submit", onSubmit, { capture: true });

    state.disposers.push(() => {
      element.removeEventListener("focusin", onFocus, capture);
      element.removeEventListener("change", onChange, capture);
      element.removeEventListener("submit", onSubmit, { capture: true });
    });
  }

  function register(config: FormConfig): void {
    const el = doc.querySelector<HTMLElement>(config.selector);
    if (!el) return;
    const existing = states.get(config.id);
    if (existing) existing.disposers.forEach((fn) => fn());
    const state = createState(el, config);
    states.set(config.id, state);
    observeViewport(state);
    attachListeners(state);
    watchSuccess(state);
  }

  function success(config: FormConfig): void {
    const state = states.get(config.id);
    if (state) {
      if (state.succeeded) return;
      state.succeeded = true;
      const durationMs = state.startedAt != null ? Date.now() - state.startedAt : undefined;
      emitter.trackEvent("form_success", {
        form: config,
        extra: durationMs != null ? { timeToSuccessMs: durationMs } : {},
      });
    }
  }

  /** Remove listeners, disconnect observers, clear timers and drop state. Idempotent. */
  function destroyForm(id: string): void {
    const state = states.get(id);
    if (!state) return;
    state.disposers.forEach((fn) => fn());
    states.delete(id);
  }

  function scan(): void {
    doc.querySelectorAll<HTMLElement>("[data-trell-form]").forEach((el) => {
      const id = el.getAttribute("data-trell-form");
      if (!id) return;
      const name = el.getAttribute("data-trell-name") || undefined;
      const fields = (el.getAttribute("data-trell-fields") || "").split(",").filter(Boolean);
      register({
        id,
        name,
        selector: `[data-trell-form="${id}"]`,
        fields: fields.length ? fields : undefined,
      });
    });
  }

  const emitCta = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const el = target.closest("[data-trell-cta]") as HTMLElement | null;
    if (!el) return;
    emitter.trackEvent("cta_click", {
      form: { id: el.getAttribute("data-trell-cta") || "", name: el.textContent?.trim() || undefined },
      extra: {
        cta: el.getAttribute("data-trell-cta") || "",
        label: el.getAttribute("aria-label") || el.textContent?.trim() || undefined,
        href: (el as HTMLAnchorElement).href || undefined,
      },
    });
  };

  const onHidden = () => {
    const now = Date.now();
    states.forEach((state) => {
      if (state.startedAt != null && !state.succeeded) {
        emitter.trackEvent("form_abandon", {
          form: state.config,
          extra: { durationMs: now - state.startedAt },
        });
      }
    });
  };

  doc.addEventListener("click", emitCta, true);
  win.addEventListener("visibilitychange", onHidden);
  if (opts.autoDetect !== false) {
    if (doc.readyState === "complete" || doc.readyState === "interactive") scan();
    else doc.addEventListener("DOMContentLoaded", scan, { once: true });
  }

  return {
    register,
    success,
    destroyForm,
    destroy() {
      doc.removeEventListener("click", emitCta, true);
      win.removeEventListener("visibilitychange", onHidden);
      doc.removeEventListener("DOMContentLoaded", scan);
      states.forEach((s) => s.disposers.forEach((fn) => fn()));
      states.clear();
    },
  };
}

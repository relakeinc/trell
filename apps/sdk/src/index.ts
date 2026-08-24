import type { Trell, TrellConfig } from "@trell/shared";
import { TrellEngine, type EngineOptions } from "./engine";

export * from "@trell/shared";
export { TrellEngine } from "./engine.js";

const noopTrell: Trell = {
  track() {},
  form() {
    return { success() {}, destroy() {} };
  },
  identify() {},
};

export function init(config: TrellConfig, opts?: EngineOptions): Trell {
  if (!config || !config.project) {
    console.warn("[trell] init() requires a `project` (publishable key pk_...)");
    return noopTrell;
  }
  const win = opts?.win ?? globalThis.window;
  const engine = new TrellEngine(config, { ...opts, win });
  if (config.exposeGlobal) {
    (globalThis.window as unknown as { trell: Trell }).trell = engine;
  }
  return engine;
}

// Auto-init from the classic <script> snippet, driven by data-* attributes.
// Only runs when loaded as a non-module script (document.currentScript is present).
function autoInitFromSnippet(): void {
  if (typeof document === "undefined") return;
  const script = document.currentScript;
  if (!script) return;

  const project = script.getAttribute("data-project");
  if (!project) return;

  const privacy = script.getAttribute("data-privacy");
  const config: TrellConfig = {
    project,
    domain: script.getAttribute("data-domain") || undefined,
    endpoint: script.getAttribute("data-endpoint") || undefined,
    privacy: privacy === "strict" ? "strict" : privacy === "consent" ? "consent" : undefined,
    debug: script.hasAttribute("data-debug"),
    exposeGlobal: true,
  };
  init(config);
}

if (typeof document !== "undefined" && document.currentScript) {
  autoInitFromSnippet();
}

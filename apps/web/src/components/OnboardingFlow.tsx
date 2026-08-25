"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrellLogo } from "./TrellLogo";

type Keys = { pk: string; sk: string };

const SDK_SNIPPET = (pk: string, domain: string) =>
  `<script\n  defer\n  src="https://cdn.trell.dev/sdk.js"\n  data-project="${pk}"\n  data-domain="${domain}"\n></script>`;

export function OnboardingFlow({ initialStep }: { initialStep: number }) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep <= 0 ? 0 : initialStep >= 3 ? 2 : initialStep);
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<Keys | null>(null);
  const [projectSlug, setProjectSlug] = useState<string | null>(null);

  async function createProject() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, domains: domains.split(",").map((d) => d.trim()).filter(Boolean) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? "Failed to create project");
      setKeys(body.keys);
      setProjectSlug(body.project.slug);
      setStep(1);
      await saveStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await saveStep(3);
    router.push(`/${projectSlug ?? "~"}/analytics`);
    router.refresh();
  }

  async function saveStep(next: number) {
    await fetch("/api/onboarding/step", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: next }),
    }).catch(() => {});
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-white px-4">
      <header className="flex w-full max-w-[520px] items-center justify-center pt-8">
        <TrellLogo className="h-7 w-auto" />
      </header>

      <div className="flex w-full max-w-[520px] flex-1 flex-col items-center justify-center pb-16">
        {/* Progress */}
        <div className="mb-8 flex w-full items-center justify-center gap-2">
          {["Project", "Install", "Done"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex size-6 items-center justify-center rounded-full text-[11px] font-medium ${
                i <= step ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-400"
              }`}>
                {i + 1}
              </div>
              <span className={`text-xs ${i <= step ? "text-neutral-800" : "text-neutral-400"}`}>{label}</span>
              {i < 2 && <div className={`h-px w-8 ${i < step ? "bg-blue-600" : "bg-neutral-200"}`} />}
            </div>
          ))}
        </div>

        {/* Step 0 — create the project */}
        {step === 0 && (
          <div className="w-full">
            <h1 className="text-center text-2xl font-semibold tracking-tight text-neutral-900">
              Create your first project
            </h1>
            <p className="mt-2 text-center text-sm text-neutral-500">
              Track analytics and conversions on the forms you already have.
            </p>

            <div className="mt-8 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Project name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="trell-input h-10"
                  placeholder="My online store"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Allowed domains <span className="font-normal text-neutral-400">(comma separated)</span>
                </label>
                <input
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  className="trell-input h-10"
                  placeholder="example.com, *.example.com"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={() => void createProject()}
                disabled={busy || !name.trim()}
                className="trell-btn-primary w-full"
              >
                {busy ? "Creating…" : "Create project"}
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — show keys once */}
        {step === 1 && keys && (
          <div className="w-full">
            <h1 className="text-center text-2xl font-semibold tracking-tight text-neutral-900">
              Your project is ready
            </h1>
            <p className="mt-2 text-center text-sm text-neutral-500">
              Copy your keys. The secret key is shown <strong className="text-neutral-700">only once</strong> —
              Trell stores a hash of it.
            </p>

            <div className="mt-8 space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Save the secret key now. If you lose it, rotate it from Settings later.
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Publishable key (pk) — safe for the SDK</label>
                <CopyRow value={keys.pk} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Secret key (sk) — never send to the browser</label>
                <CopyRow value={keys.sk} mono />
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Install the SDK</label>
                <pre className="overflow-x-auto whitespace-pre rounded-md bg-neutral-900 p-3 text-[12px] leading-relaxed text-neutral-100">
                  <code>{SDK_SNIPPET(keys.pk, domains || "your-domain.com")}</code>
                </pre>
              </div>

              <button onClick={() => void finish()} className="trell-btn-primary w-full">
                Go to dashboard
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — done */}
        {step === 2 && (
          <div className="w-full text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Welcome to Trell</h1>
            <p className="mt-2 text-sm text-neutral-500">
              You&apos;re all set. Head to your dashboard to see analytics live.
            </p>
            <button onClick={() => void finish()} className="trell-btn-primary mt-8 w-full">
              Open dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function CopyRow({ value, mono }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-2">
      <code
        className={`flex-1 truncate rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-800 ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </code>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="trell-btn-outline h-8 shrink-0 px-2 text-xs"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

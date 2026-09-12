"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { RedirectOverlay } from "@/components/RedirectOverlay";
import { useProject } from "../_components/ProjectContext";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function resetDateFrom(start?: string): string {
  const base = start ? new Date(start) : new Date();
  const reset = addMonths(base, 1);
  return reset.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Shown once right after Polar redirects back from a successful checkout. */
function UpgradedBanner() {
  const params = useSearchParams();
  const [show, setShow] = useState(() => params.get("upgraded") === "1");

  useEffect(() => {
    if (params.get("upgraded") === "1") {
      // Clean the URL so a refresh doesn't reshow the banner.
      const url = new URL(window.location.href);
      url.searchParams.delete("upgraded");
      window.history.replaceState(null, "", url.toString());
    }
  }, [params]);

  if (!show) return null;

  return (
    <div className="trell-modal-in flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Icon name="check" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-emerald-900">You&apos;re on Pro 🎉</div>
        <p className="mt-0.5 text-sm text-emerald-800">
          50K events/mo, 100 domains, webhooks and 3-year retention are now active on your account.
        </p>
      </div>
      <button
        onClick={() => setShow(false)}
        className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
      >
        Dismiss
      </button>
    </div>
  );
}

export default function BillingSettingsPage() {
  const { project, usage, loading } = useProject();
  const [portalBusy, setPortalBusy] = useState(false);

  if (loading || !usage || !project) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  const resetDate = resetDateFrom(usage.billingPeriodStart);
  const eventPct = Math.min((usage.events / (usage.limit || 1)) * 100, 100);
  const domainPct = Math.min((usage.domains / (usage.domainLimit || 1)) * 100, 100);
  const isFree = project.plan === "free";

  return (
    <div className="flex flex-col gap-6">
      {portalBusy && <RedirectOverlay title="Opening customer portal…" subtitle="Do not close this window." />}
      <Suspense fallback={null}>
        <UpgradedBanner />
      </Suspense>
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Billing</h1>
      </div>

      <div className="overflow-hidden rounded-xl border border-trell-line bg-white">
        <div className="p-5 pb-0">
          <div className="text-sm font-semibold text-trell-ink">Current Plan</div>
          <div className="mt-1 text-sm text-trell-ink-muted">
            Your workspace is on the {isFree ? "Free" : "Pro"} plan.
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-trell-line bg-neutral-50/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isFree ? "bg-neutral-100 text-neutral-600" : "bg-blue-100 text-blue-600"}`}
            >
              {isFree ? "Free" : "Pro"}
            </span>
            <span className="text-xs text-trell-ink-muted">
              {usage.events.toLocaleString()} of {usage.limit.toLocaleString()} events used
            </span>
          </div>
          {isFree ? (
            <Link
              href={`/${project.slug}/settings/billing/plans`}
              className="trell-btn-accent h-8 cursor-pointer px-3 text-xs"
            >
              Upgrade to Pro
            </Link>
          ) : (
            <a
              href={`/api/portal?project=${project.id}`}
              onClick={() => setPortalBusy(true)}
              className="trell-btn-outline h-8 cursor-pointer px-3 text-xs"
            >
              {portalBusy ? "Opening…" : "Manage subscription"}
            </a>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-trell-line bg-white">
        <div className="p-5 pb-0">
          <div className="text-sm font-semibold text-trell-ink">Events</div>
          <div className="mt-1 text-sm text-trell-ink-muted">Track your event usage for the current billing cycle.</div>
        </div>
        <div className="p-5 pt-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-trell-ink-muted">Events used</span>
              <span className="tabular-nums text-trell-ink">
                {usage.events.toLocaleString()}{" "}
                <span className="text-trell-ink-muted">of {usage.limit.toLocaleString()}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full rounded-full transition-all ${eventPct > 90 ? "bg-red-500" : eventPct > 70 ? "bg-amber-500" : "bg-blue-500"}`}
                style={{ width: `${eventPct}%` }}
              />
            </div>
            {eventPct > 90 && (
              <p className="text-xs text-red-600">You&apos;ve used {eventPct.toFixed(0)}% of your event limit.</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-trell-line bg-neutral-50/80 px-5 py-3">
          <span className="text-xs text-trell-ink-muted">Resets {resetDate}</span>
          {isFree && <span className="text-xs text-trell-ink-muted">Upgrade to Pro for 50K events/mo</span>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-trell-line bg-white">
        <div className="p-5 pb-0">
          <div className="text-sm font-semibold text-trell-ink">Domains</div>
          <div className="mt-1 text-sm text-trell-ink-muted">Allowed origins for tracking.</div>
        </div>
        <div className="p-5 pt-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-trell-ink-muted">Domains used</span>
              <span className="tabular-nums text-trell-ink">
                {usage.domains} <span className="text-trell-ink-muted">of {usage.domainLimit}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full rounded-full transition-all ${domainPct > 90 ? "bg-red-500" : domainPct > 70 ? "bg-amber-500" : "bg-blue-500"}`}
                style={{ width: `${domainPct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-trell-line bg-neutral-50/80 px-5 py-3">
          <span className="text-xs text-trell-ink-muted">Lifetime limit</span>
          {isFree && <span className="text-xs text-trell-ink-muted">Upgrade to Pro for 100 domains</span>}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useProject } from "../_components/ProjectContext";

function resetDate(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function BillingSettingsPage() {
  const { project, usage, loading } = useProject();

  if (loading || !usage || !project) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  const eventPct = Math.min((usage.events / (usage.limit || 1)) * 100, 100);
  const domainPct = Math.min((usage.domains / (usage.domainLimit || 1)) * 100, 100);
  const isFree = project.plan === "free";

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Billing</h1>
      </div>

      {/* Current Plan */}
      <div className="overflow-hidden rounded-xl border border-trell-line bg-white">
        <div className="p-5 pb-0">
          <div className="text-sm font-semibold text-trell-ink">Current Plan</div>
          <div className="mt-1 text-sm text-trell-ink-muted">Your workspace is on the {isFree ? "Free" : "Pro"} plan.</div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-trell-line bg-neutral-50/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isFree ? "bg-neutral-100 text-neutral-600" : "bg-blue-100 text-blue-600"}`}>
              {isFree ? "Free" : "Pro"}
            </span>
            <span className="text-xs text-trell-ink-muted">{usage.events.toLocaleString()} of {usage.limit.toLocaleString()} events used</span>
          </div>
          {isFree ? (
            <Link href={`/${project.slug}/settings/billing/plans`} className="trell-btn-primary h-8 cursor-pointer px-3 text-xs">
              Upgrade to Pro
            </Link>
          ) : (
            <Link href="/api/portal" className="trell-btn-outline h-8 cursor-pointer px-3 text-xs">
              Manage subscription
            </Link>
          )}
        </div>
      </div>

      {/* Events Usage */}
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
                {usage.events.toLocaleString()} <span className="text-trell-ink-muted">of {usage.limit.toLocaleString()}</span>
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
        <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50/80 px-5 py-3">
          <span className="text-xs text-trell-ink-muted">Resets {resetDate()}</span>
          {isFree && <span className="text-xs text-trell-ink-muted">Upgrade to Pro for 100K events/mo</span>}
        </div>
      </div>

      {/* Domains Usage */}
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
        <div className="flex items-center justify-between border-t border-trell-line bg-neutral-50/80 px-5 py-3">
          <span className="text-xs text-trell-ink-muted">Lifetime limit</span>
          {isFree && <span className="text-xs text-trell-ink-muted">Upgrade to Pro for 50 domains</span>}
        </div>
      </div>
    </div>
  );
}

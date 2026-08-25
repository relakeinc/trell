"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useProject } from "../../_components/ProjectContext";

const PRO_MONTHLY_ID = process.env.NEXT_PUBLIC_POLAR_PRO_MONTHLY_ID ?? "";

interface PlanFeature {
  label: string;
  icon: string;
}

const FREE_FEATURES: PlanFeature[] = [
  { label: "5,000 events / month", icon: "chart-2" },
  { label: "1 project", icon: "grid-2" },
  { label: "1 domain", icon: "global" },
  { label: "Basic analytics", icon: "chart-2" },
  { label: "7-day data retention", icon: "calendar-2" },
];

const PRO_FEATURES: PlanFeature[] = [
  { label: "100,000 events / month", icon: "chart-2" },
  { label: "5 projects", icon: "grid-2" },
  { label: "5 domains", icon: "global" },
  { label: "Advanced analytics + funnels", icon: "filter-square" },
  { label: "UTM templates", icon: "links" },
  { label: "Webhooks", icon: "webhooks" },
  { label: "API access", icon: "key-square" },
  { label: "30-day data retention", icon: "calendar-2" },
];

export default function BillingPlansPage() {
  const { project, loading } = useProject();
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [upgrading, setUpgrading] = useState(false);

  async function handleCheckout() {
    if (!PRO_MONTHLY_ID) {
      alert("Product ID not configured");
      return;
    }
    setUpgrading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: PRO_MONTHLY_ID }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert("Failed to start checkout");
    } catch {
      alert("Failed to start checkout");
    } finally {
      setUpgrading(false);
    }
  }

  if (loading || !project) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  const isPro = project.plan === "pro";

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb + cycle toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/${project.slug}/settings/billing`} className="text-trell-ink-muted hover:text-trell-ink transition-colors">
            Billing
          </Link>
          <Icon name="arrow-right-01" size={12} className="text-trell-ink-muted" />
          <span className="font-medium text-trell-ink">Plans</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-lg border border-trell-line bg-white p-0.5">
            <button
              onClick={() => setCycle("monthly")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${cycle === "monthly" ? "bg-neutral-900 text-white" : "text-trell-ink-muted hover:text-trell-ink"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("annual")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${cycle === "annual" ? "bg-neutral-900 text-white" : "text-trell-ink-muted hover:text-trell-ink"}`}
            >
              Annual
            </button>
          </div>
          <span className="hidden rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-trell-ink-muted sm:block">
            {cycle === "monthly" ? "Monthly billing" : "Annual billing"}
          </span>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Free */}
        <div className="relative flex flex-col rounded-xl border border-trell-line bg-white">
          <div className="h-1 w-full rounded-t-xl bg-neutral-200" />
          <div className="flex flex-1 flex-col p-6">
            <div className="text-base font-medium text-trell-ink">Free</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-trell-ink">$0</span>
              <span className="text-sm text-trell-ink-muted">/ month</span>
            </div>
            <div className="mt-5 text-xs font-medium text-trell-ink-muted uppercase tracking-wide">Includes</div>
            <div className="mt-3 flex flex-1 flex-col gap-2.5">
              {FREE_FEATURES.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <div className="flex size-6 items-center justify-center rounded-md bg-neutral-100">
                    <Icon name={f.icon} size={13} className="text-neutral-500" />
                  </div>
                  <span className="text-sm text-trell-ink">{f.label}</span>
                </div>
              ))}
            </div>
            {isPro ? (
              <Link href={`/${project.slug}/settings/billing`} className="trell-btn-outline mt-6 h-9 gap-1.5 text-xs">
                Current plan
              </Link>
            ) : (
              <div className="trell-btn-primary mt-6 h-9 cursor-default gap-1.5 text-xs opacity-40">Current plan</div>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-xl border border-trell-line bg-white">
          <div className="h-1 w-full rounded-t-xl bg-blue-500" />
          <div className="absolute right-4 top-4 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
            Recommended
          </div>
          <div className="flex flex-1 flex-col p-6">
            <div className="text-base font-medium text-trell-ink">Pro</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-trell-ink">{cycle === "monthly" ? "$29" : "$278"}</span>
              <span className="text-sm text-trell-ink-muted">/ {cycle === "monthly" ? "month" : "year"}</span>
            </div>
            <div className="mt-5 text-xs font-medium text-trell-ink-muted uppercase tracking-wide">Includes</div>
            <div className="mt-3 flex flex-1 flex-col gap-2.5">
              {PRO_FEATURES.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <div className="flex size-6 items-center justify-center rounded-md bg-blue-50">
                    <Icon name={f.icon} size={13} className="text-blue-500" />
                  </div>
                  <span className="text-sm text-trell-ink">{f.label}</span>
                </div>
              ))}
            </div>
            {isPro ? (
              <Link href="/api/portal" className="trell-btn-primary mt-6 h-9 gap-1.5 text-xs">
                Manage subscription
              </Link>
            ) : cycle === "annual" ? (
              <button disabled className="trell-btn-primary mt-6 h-9 cursor-default gap-1.5 text-xs opacity-50">
                Annual soon
              </button>
            ) : (
              <button onClick={handleCheckout} disabled={upgrading} className="trell-btn-primary mt-6 h-9 gap-1.5 text-xs">
                {upgrading ? "Loading..." : "Upgrade to Pro"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* What's included comparison */}
      <div className="overflow-hidden rounded-xl border border-trell-line bg-white">
        <div className="border-b border-trell-line px-5 py-3 text-sm font-medium text-trell-ink">
          Everything in Free, plus:
        </div>
        <div className="divide-y divide-trell-line">
          {[
            { label: "Advanced analytics & funnels", desc: "Convert and optimize your forms with deeper insight." },
            { label: "UTM templates", desc: "Save and reuse UTM parameter combinations across campaigns." },
            { label: "Webhooks", desc: "Send real-time event notifications to your own infrastructure." },
            { label: "API access", desc: "Programmatic access to your tracking data via the Trell API." },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <Icon name="check" size={16} className="text-blue-500" />
                <div>
                  <div className="text-sm font-medium text-trell-ink">{item.label}</div>
                  <div className="text-xs text-trell-ink-muted">{item.desc}</div>
                </div>
              </div>
              <Link href={`/${project.slug}/settings/webhooks`} className="text-xs text-trell-ink-muted hover:text-trell-ink transition-colors">
                Learn more
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

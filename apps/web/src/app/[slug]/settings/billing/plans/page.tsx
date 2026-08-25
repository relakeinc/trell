"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useProject } from "../../_components/ProjectContext";

const PRO_MONTHLY_ID = process.env.NEXT_PUBLIC_POLAR_PRO_MONTHLY_ID ?? "";

interface Plan {
  id: string;
  name: string;
  priceMonthly: string;
  priceYearly: string;
  features: { label: string; icon: string }[];
  recommended?: boolean;
}

const VIDEO = "video";

const PLANS: Plan[] = [
  {
    id: "pro",
    name: "Pro",
    priceMonthly: "US$ 29",
    priceYearly: "US$ 278",
    recommended: true,
    features: [
      { label: "Trell Analytics", icon: "chart-2" },
      { label: "Trell Webhooks", icon: "webhooks" },
    ],
  },
  {
    id: "free",
    name: "Free",
    priceMonthly: "US$ 0",
    priceYearly: "US$ 0",
    features: [
      { label: "Trell Analytics", icon: "chart-2" },
    ],
  },
];

const FEATURE_ROWS: { section: string; rows: { name: string; free: string; pro: string }[] }[] = [
  {
    section: "Analytics",
    rows: [
      { name: "Events / month", free: "5,000", pro: "50,000" },
      { name: "Projects", free: "Unlimited", pro: "Unlimited" },
      { name: "Domains", free: "3", pro: "100" },
      { name: "Advanced analytics", free: "✓", pro: "✓" },
      { name: "Funnels", free: "✓", pro: "✓" },
      { name: "Data retention", free: "1 year", pro: "3 years" },
    ],
  },
  {
    section: "Developer",
    rows: [
      { name: "Webhooks", free: "—", pro: "✓" },
      { name: "UTM templates", free: "✓", pro: "✓" },
      { name: "API access", free: "✓", pro: "✓" },
      { name: "Priority support", free: "—", pro: "✓" },
    ],
  },
];

export default function BillingPlansPage() {
  const { project, loading } = useProject();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
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
          <Link href={`/${project.slug}/settings/billing`} className="text-neutral-600 hover:text-neutral-900 transition-colors">
            Billing
          </Link>
          <Icon name="arrow-right-01" size={12} className="text-neutral-400" />
          <span className="font-medium text-neutral-900">Plans</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-white p-0.5">
            <button
              onClick={() => setCycle("monthly")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${cycle === "monthly" ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("yearly")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${cycle === "yearly" ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}
            >
              Yearly
            </button>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
            12% off + 12x usage upfront
          </span>
        </div>
      </div>

      {/* Plan cards */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-200">
        {/* Header accent bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div key={plan.id} className={`border-b border-neutral-200 px-5 pt-5 pb-4 ${plan.recommended ? "bg-blue-50/50" : "bg-white"} sm:border-b-0`}>
              <div className={`h-0.5 w-full rounded-full ${plan.recommended ? "bg-blue-500" : "bg-neutral-200"}`} />
              <div className="mt-3 flex items-start justify-between">
                <div>
                  <div className="text-base font-medium text-neutral-900">{plan.name}</div>
                  <div className="mt-1 text-sm text-neutral-600">
                    {cycle === "monthly" ? plan.priceMonthly : plan.priceYearly} <span className="text-neutral-400">per {cycle === "monthly" ? "month" : "year"}</span>
                  </div>
                </div>
                {plan.recommended && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">Recommended</span>
                )}
              </div>
              <div className="mt-4 text-xs font-medium text-neutral-400 uppercase tracking-wide">Includes</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {plan.features.map((f) => (
                  <div key={f.label} className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1">
                    <Icon name={f.icon} size={13} className="text-neutral-600" />
                    <span className="text-xs text-neutral-600">{f.label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => plan.id === "pro" && handleCheckout()}
                disabled={plan.id !== "pro" || upgrading}
                className={`mt-5 h-9 w-full rounded-lg text-sm font-medium transition-colors ${
                  plan.id === "pro"
                    ? "bg-neutral-900 text-white hover:bg-neutral-800"
                    : "bg-neutral-100 text-neutral-500"
                } disabled:opacity-60`}
              >
                {plan.id === "pro" ? "Upgrade to Pro" : "Current plan"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Feature comparison */}
      <div className="overflow-hidden rounded-xl border border-neutral-200">
        {FEATURE_ROWS.map((group) => (
          <div key={group.section} className="border-b border-neutral-200 last:border-b-0">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                <Icon name="grid-2" size={16} className="text-neutral-500" />
                {group.section}
              </div>
              <Link href={`/${project.slug}/settings/general`} className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors">
                Learn more ↗
              </Link>
            </div>
            <div className="divide-y divide-neutral-100">
              {group.rows.map((row) => (
                <div key={row.name} className="grid grid-cols-[1fr_90px_90px] items-center px-5 py-3 sm:grid-cols-2">
                  <div className="text-sm text-neutral-700">{row.name}</div>
                  <div className="hidden text-sm text-neutral-600 sm:block">{row.free}</div>
                  <div className="hidden text-sm text-neutral-600 sm:block">{row.pro}</div>
                  <div className="col-span-2 flex gap-0 text-sm sm:hidden">
                    <div className="flex-1 text-neutral-600">{row.free}</div>
                    <div className="flex-1 text-neutral-600">{row.pro}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Icon } from "@/components/Icon";
import { SegmentedControl } from "@/components/SegmentedControl";
import { RedirectOverlay } from "@/components/RedirectOverlay";
import { useProject } from "../../_components/ProjectContext";

interface Plan {
  id: string;
  name: string;
  priceMonthly: string;
  priceYearly: string;
  features: { label: string; icon: string }[];
  recommended?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "pro",
    name: "Pro",
    priceMonthly: "US$ 29",
    priceYearly: "US$ 278",
    recommended: true,
    features: [
      { label: "Trell Analytics", icon: "analytics" },
      { label: "Trell Webhooks", icon: "webhooks" },
    ],
  },
  {
    id: "free",
    name: "Free",
    priceMonthly: "US$ 0",
    priceYearly: "US$ 0",
    features: [{ label: "Trell Analytics", icon: "analytics" }],
  },
];

const FEATURE_ROWS: {
  section: string;
  icon: string;
  rows: { name: string; free: string; pro: string; proHigh?: boolean }[];
}[] = [
  {
    section: "Analytics",
    icon: "analytics",
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
    icon: "layers",
    rows: [
      { name: "Webhooks", free: "—", pro: "✓", proHigh: true },
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
  const [redirecting, setRedirecting] = useState(false);
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(plan: "pro_monthly" | "pro_yearly") {
    if (!project) {
      setError("No project selected. Please reload and try again.");
      return;
    }
    setUpgrading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, slug: project.slug }),
      });
      const data = await res.json();
      if (data.url) {
        // Show loader before leaving: the Polar handoff can take a moment.
        setRedirecting(true);
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to start checkout. Please try again.");
        setUpgrading(false);
      }
    } catch {
      setError("Failed to start checkout. Please check your connection and try again.");
      setUpgrading(false);
    }
  }

  if (loading || !project) return <div className="py-8 text-center text-sm text-neutral-400">Loading…</div>;

  const isPro = project.plan === "pro";

  return (
    <div className="flex flex-col gap-6">
      {redirecting && <RedirectOverlay title="Redirecting to secure payment…" subtitle="Do not close this window." />}
      {managing && <RedirectOverlay title="Opening customer portal…" subtitle="Do not close this window." />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/${project.slug}/settings/billing`} className="text-lg font-semibold text-trell-ink">
            Billing
          </Link>
          <Icon name="arrow-right-01" size={12} className="text-neutral-400" />
          <span className="text-lg font-semibold text-trell-ink">Plans</span>
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl
            size="md"
            ariaLabel="Billing cycle"
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "monthly" as const, label: "Monthly" },
              { value: "yearly" as const, label: "Yearly" },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-200">
        {error && (
          <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`border-b border-neutral-200 px-5 pt-5 pb-4 ${plan.recommended ? "bg-blue-50/50" : "bg-white"} sm:border-b-0`}
            >
              <div className={`h-0.5 w-full rounded-full ${plan.recommended ? "bg-blue-500" : "bg-neutral-200"}`} />
              <div className="mt-3 flex items-start justify-between">
                <div>
                  <div className="text-base font-medium text-neutral-900">{plan.name}</div>
                  <div className="mt-1 text-sm text-neutral-600">
                    {cycle === "monthly" ? plan.priceMonthly : plan.priceYearly}{" "}
                    <span className="text-neutral-400">per {cycle === "monthly" ? "month" : "year"}</span>
                  </div>
                </div>
                {plan.recommended && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
                    Recommended
                  </span>
                )}
              </div>
              <div className="mt-4 text-xs font-medium text-neutral-400 uppercase tracking-wide">Includes</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {plan.features.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1"
                  >
                    <Icon name={f.icon} size={13} className="text-neutral-600" />
                    <span className="text-xs text-neutral-600">{f.label}</span>
                  </div>
                ))}
              </div>
              {plan.id === "pro" ? (
                isPro ? (
                  <>
                    <button
                      disabled
                      className="mt-5 h-9 w-full rounded-lg bg-neutral-100 text-sm font-medium text-neutral-500 dark:bg-white/10 dark:text-neutral-400"
                    >
                      Current plan
                    </button>
                    <a
                      href={`/api/portal?project=${project.id}`}
                      onClick={() => setManaging(true)}
                      className="mt-2 flex h-9 w-full items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
                    >
                      {managing ? "Opening…" : "Manage / Cancel subscription"}
                    </a>
                  </>
                ) : (
                  <button
                    onClick={() => handleCheckout(cycle === "monthly" ? "pro_monthly" : "pro_yearly")}
                    disabled={upgrading}
                    className="trell-btn-accent mt-5 h-9 w-full"
                  >
                    {upgrading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Preparing secure payment…
                      </span>
                    ) : cycle === "monthly" ? (
                      "Upgrade to Pro"
                    ) : (
                      "Upgrade to Pro (Yearly)"
                    )}
                  </button>
                )
              ) : (
                <button
                  disabled
                  className="mt-5 h-9 w-full rounded-lg bg-neutral-100 text-sm font-medium text-neutral-500"
                >
                  {isPro ? "Included in Pro" : "Current plan"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        {FEATURE_ROWS.map((group) => (
          <div key={group.section} className="border-b border-neutral-200 last:border-b-0">
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                <Icon name={group.icon} size={16} className="text-neutral-500" />
                {group.section}
              </div>
              <Link
                href={`/${project.slug}/settings/general`}
                className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                Learn more ↗
              </Link>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-white/10">
              {group.rows.map((row) => (
                <div key={row.name} className="grid grid-cols-[1fr_85px_85px] items-center px-5 py-2">
                  <div className="text-sm text-neutral-700">{row.name}</div>
                  <div className="pr-4 text-right text-sm text-neutral-500">{row.free}</div>
                  <div className="rounded-md bg-blue-50/60 px-3 py-1.5 text-center text-sm text-neutral-700">
                    {row.pro}
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

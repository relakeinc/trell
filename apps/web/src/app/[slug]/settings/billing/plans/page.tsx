"use client";

import { useState } from "react";
import Link from "next/link";
import { useProject } from "../../../_components/ProjectContext";

const PRO_MONTHLY_ID = process.env.NEXT_PUBLIC_POLAR_PRO_MONTHLY_ID ?? "";

export default function BillingPlansPage() {
  const { project, loading } = useProject();
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [upgrading, setUpgrading] = useState(false);

  async function handleCheckout(yearly: boolean) {
    if (yearly) return;
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
      <div className="px-1 pt-2">
        <h1 className="text-lg font-semibold text-trell-ink">Plans</h1>
        <p className="mt-1 text-sm text-trell-ink-muted">Choose the plan that fits your needs.</p>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-trell-line bg-neutral-100 p-0.5">
          <button
            onClick={() => setCycle("monthly")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${cycle === "monthly" ? "bg-white text-trell-ink shadow-sm" : "text-trell-ink-muted hover:text-trell-ink"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle("annual")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${cycle === "annual" ? "bg-white text-trell-ink shadow-sm" : "text-trell-ink-muted hover:text-trell-ink"}`}
          >
            Annual <span className="text-xs text-green-600">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col rounded-xl border border-trell-line bg-white p-6">
          <div className="mb-1 text-base font-semibold text-trell-ink">Free</div>
          <div className="mb-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-trell-ink">$0</span>
            <span className="text-sm text-trell-ink-muted">forever</span>
          </div>
          <ul className="mb-6 flex flex-1 flex-col gap-2.5 text-sm text-trell-ink">
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>5,000 events / month
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>1 project
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>1 domain
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>Basic analytics
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>7-day data retention
            </li>
          </ul>
          {isPro ? (
            <Link href={`/${project.slug}/settings/billing`} className="trell-btn-outline h-9 gap-1.5 text-xs">
              Current plan
            </Link>
          ) : (
            <div className="trell-btn-outline h-9 cursor-default gap-1.5 text-xs opacity-50">Current plan</div>
          )}
        </div>

        {/* Pro */}
        <div className="flex flex-col rounded-xl border-2 border-blue-500 bg-white p-6">
          <div className="mb-1 text-base font-semibold text-trell-ink">Pro</div>
          <div className="mb-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-trell-ink">{cycle === "monthly" ? "$29" : "$278"}</span>
            <span className="text-sm text-trell-ink-muted">/ {cycle === "monthly" ? "month" : "year"}</span>
          </div>
          <ul className="mb-6 flex flex-1 flex-col gap-2.5 text-sm text-trell-ink">
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>100,000 events / month
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>5 projects
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>5 domains
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>Advanced analytics + funnels
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>UTM templates
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>Webhooks
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>API access
            </li>
            <li className="flex items-center gap-2">
              <span className="text-blue-500">✓</span>30-day data retention
            </li>
          </ul>
          {isPro ? (
            <Link href="/api/portal" className="trell-btn-primary h-9 gap-1.5 text-xs">
              Manage subscription
            </Link>
          ) : cycle === "annual" ? (
            <button disabled className="trell-btn-primary h-9 cursor-default gap-1.5 text-xs opacity-50">
              Annual coming soon
            </button>
          ) : (
            <button onClick={() => handleCheckout(false)} disabled={upgrading} className="trell-btn-primary h-9 gap-1.5 text-xs">
              {upgrading ? "Loading..." : "Upgrade to Pro"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

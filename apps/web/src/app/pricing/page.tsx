"use client";

import { useState } from "react";
import Link from "next/link";
import { TrellLogo } from "@/components/TrellLogo";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For personal projects and testing",
    features: [
      "5,000 events / month",
      "1 project",
      "1 domain",
      "Basic analytics",
      "7-day data retention",
    ],
    cta: "Get started",
    href: "/register",
    polarProductId: null,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For teams and production apps",
    features: [
      "100,000 events / month",
      "5 projects",
      "5 domains",
      "Advanced analytics + funnels",
      "UTM templates",
      "Webhooks",
      "API access",
      "30-day data retention",
      "Priority support",
    ],
    cta: "Start free trial",
    href: "#",
    polarProductId: process.env.NEXT_PUBLIC_POLAR_PRO_MONTHLY_ID ?? "",
    popular: true,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  async function handleCheckout(productId: string) {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Failed to start checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 lg:px-12">
        <Link href="/">
          <TrellLogo className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/signin" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
            Log in
          </Link>
          <Link href="/register" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800">
            Sign up
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 pt-16 pb-12 text-center lg:px-12">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 lg:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-neutral-500">
          Start free, upgrade when you need more. No hidden fees.
        </p>
      </div>

      {/* Plans */}
      <div className="mx-auto max-w-4xl px-6 pb-24 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.popular
                  ? "border-blue-500 shadow-lg shadow-blue-500/10"
                  : "border-neutral-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
                  Most popular
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-neutral-900">{plan.name}</h2>
                <p className="mt-1 text-sm text-neutral-500">{plan.description}</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-bold text-neutral-900">{plan.price}</span>
                <span className="text-neutral-500">{plan.period}</span>
              </div>
              <ul className="mb-8 flex flex-1 flex-col gap-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-neutral-600">
                    <svg className="mt-0.5 size-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.polarProductId ? (
                <button
                  onClick={() => handleCheckout(plan.polarProductId!)}
                  disabled={loading}
                  className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    plan.popular
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
                  } disabled:opacity-50`}
                >
                  {loading ? "Loading..." : plan.cta}
                </button>
              ) : (
                <Link
                  href={plan.href}
                  className={`flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    plan.popular
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
                  }`}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

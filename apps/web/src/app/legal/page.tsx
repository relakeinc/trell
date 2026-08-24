import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal",
};

export default function LegalPage() {
  return (
    <div className="py-8">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-neutral-900">Legal</h1>
      <p className="mb-10 text-neutral-500">
        Policies, terms, and legal information for Trell.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/legal/terms"
          className="group rounded-xl border border-neutral-200 p-6 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          <h2 className="mb-1 text-lg font-semibold text-neutral-900">Terms of Service</h2>
          <p className="text-sm text-neutral-500">
            The rules and guidelines for using Trell.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-blue-600 group-hover:text-blue-700">
            Read more &rarr;
          </span>
        </Link>

        <Link
          href="/legal/privacy"
          className="group rounded-xl border border-neutral-200 p-6 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          <h2 className="mb-1 text-lg font-semibold text-neutral-900">Privacy Policy</h2>
          <p className="text-sm text-neutral-500">
            How we collect, use, and protect your data.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-blue-600 group-hover:text-blue-700">
            Read more &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
}

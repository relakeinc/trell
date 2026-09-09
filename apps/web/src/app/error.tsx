"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Global route error boundary: friendly retry instead of a blank crash screen. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[trell] route error", error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6">
      <div className="w-full max-w-md rounded-2xl border border-trell-line bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h1 className="text-lg font-semibold text-trell-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-trell-ink-muted">
          This page hit an unexpected error. Your data is safe — try again or head back to the dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button onClick={() => reset()} className="trell-btn-accent h-10 w-full">
            Try again
          </button>
          <Link href="/" className="trell-btn-outline h-9 w-full justify-center text-xs">
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

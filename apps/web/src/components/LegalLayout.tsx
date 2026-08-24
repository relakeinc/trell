"use client";

import Link from "next/link";
import Image from "next/image";

export function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-neutral-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center">
            <Image src="/icon.svg" alt="Trell" width={90} height={34} className="h-6 w-auto" />
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-neutral-500 md:flex">
            <Link href="/signin" className="hover:text-neutral-900">Log in</Link>
            <Link
              href="/register"
              className="rounded-lg bg-neutral-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-12">
        {children}
      </main>
    </div>
  );
}

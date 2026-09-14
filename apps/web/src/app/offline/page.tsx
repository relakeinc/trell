import Link from "next/link";
import { TrellLogo } from "@/components/TrellLogo";

export const metadata = {
  title: "Offline – Trell",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <TrellLogo className="h-6 w-auto" />
      <h1 className="text-lg font-semibold text-neutral-900">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-neutral-500">
        Trell needs a connection to load your analytics. Check your network and try again.
      </p>
      <Link href="/" className="trell-btn-primary h-10 px-4">
        Retry
      </Link>
    </main>
  );
}

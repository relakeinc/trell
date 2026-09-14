"use client";

import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    // Equivalente a "/trell" en relake-site: la home de la app.
    else router.push("/");
  };

  return (
    <>
      {/* No scroll here: release the global scrollbar-gutter so art reaches the viewport edge. */}
      <style>{`html{scrollbar-gutter:auto}`}</style>
      {/* Button style copied from relake-site; scoped under .trell-404 to avoid leaks. */}
      <style>{`.trell-404 .trell-btn-primary{display:inline-flex;cursor:pointer;align-items:center;justify-content:center;border-radius:0.5rem;background-color:#2563eb;background-image:linear-gradient(to bottom,#4d88f5,#2563eb);padding-inline:1.5rem;padding-block:0.75rem;font-size:0.875rem;font-weight:600;color:#fff;box-shadow:0 1px 3px 0 rgb(0 0 0 / 0.1),0 1px 2px -1px rgb(0 0 0 / 0.1),0 0 0 calc(1px + 0px) rgba(37,99,235,0.2);transition-property:color,background-color,border-color,opacity,box-shadow,transform;transition-timing-function:cubic-bezier(0.4,0,0.2,1);transition-duration:150ms}.trell-404 .trell-btn-primary:hover{opacity:0.95;transform:translateY(-1px);box-shadow:0 4px 12px 0 rgb(0 0 0 / 0.15),0 0 0 calc(1px + 0px) rgba(37,99,235,0.3)}.trell-404 .trell-btn-primary:active{transform:scale(0.985)}.dark .trell-404 .trell-btn-primary{background-color:#b8b8b7;background-image:linear-gradient(to bottom,#CDCCCC,#b8b8b7);color:#111111;box-shadow:0 1px 3px 0 rgb(0 0 0 / 0.3),0 1px 2px -1px rgb(0 0 0 / 0.3)}.dark .trell-404 .trell-btn-primary:hover{background-image:linear-gradient(to bottom,#b8b8b7,#a3a3a2)}`}</style>
      <main className="trell-404 scrollbar-hide relative flex h-[100dvh] w-[100dvw] flex-col overflow-hidden bg-[#fafafa] text-[#18181b] dark:bg-[#0a0a0b] dark:text-[#fafafa]">
        <div className="flex shrink-0 flex-col items-center px-5 pt-20 text-center sm:pt-28">
          <p className="text-sm font-medium tracking-wide text-[#71717a] dark:text-[#a1a1aa]">OOPS! 404 Error!</p>
          <h1 className="mt-3 text-4xl font-medium tracking-tight text-[#18181b] dark:text-[#fafafa] sm:text-5xl [font-family:var(--font-figtree)]">
            Page Not Found
          </h1>
          <button type="button" onClick={goBack} className="trell-btn-primary mt-6">
            Go Back
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(65%_55%_at_50%_42%,rgb(37_99_235/0.22),transparent_70%)] dark:bg-[radial-gradient(65%_55%_at_50%_42%,rgb(77_136_245/0.25),transparent_70%)]"
          />
          <img
            src="/trell/assets/img/404-vh.avif"
            alt="404"
            width={1920}
            height={1080}
            loading="eager"
            className="absolute inset-0 block size-full z-[999] object-cover object-top"
          />
        </div>
      </main>
    </>
  );
}

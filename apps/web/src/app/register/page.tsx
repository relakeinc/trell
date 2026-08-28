import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { RegisterForm } from "@/components/RegisterForm";
import { TrellLogo } from "@/components/TrellLogo";
import { ShaderBackground } from "@/components/ShaderBackground";

export const metadata: Metadata = {
  title: "Create your account – Trell",
};

export default function RegisterPage() {
  return (
    <main className="force-light grid min-h-dvh lg:grid-cols-[60%_40%]">
      {/* Left — form panel */}
      <div className="relative flex flex-col bg-white">
        {/* Mobile header */}
        <header className="flex items-center justify-between px-6 pt-6 lg:hidden">
          <Link href="/">
            <TrellLogo className="h-6 w-auto" />
          </Link>
        </header>

        {/* Desktop logo */}
        <div className="hidden px-8 pt-6 lg:block">
          <Link href="/">
            <TrellLogo className="h-7 w-auto" />
          </Link>
        </div>

        {/* Form */}
        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-[400px]">
            <h1 className="mb-6 text-center text-[26px] font-semibold tracking-tight text-zinc-900">
              Create your Trell account
            </h1>

            <RegisterForm />
          </div>
        </div>
      </div>

      {/* Right — brand panel (blue with dotted globe) */}
      <div className="relative hidden overflow-hidden bg-[#2563eb] lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[72%] bg-linear-to-r from-[#1d4ed8]/90 via-[#2563eb]/85 to-transparent"
        />

        {/* Shapes image */}
        <Image
          src="/img/img_shapes.png"
          alt=""
          width={280}
          height={280}
          className="absolute left-0 top-1/2 z-[1] -translate-y-1/2"
          priority
        />

        <div className="absolute top-1/2 right-[-18%] z-0 h-[34rem] w-[34rem] -translate-y-1/2">
          <ShaderBackground className="absolute inset-0" />
        </div>

        <div className="absolute right-8 top-7 z-[2]">
          <Link
            href="/signin"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

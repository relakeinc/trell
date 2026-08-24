"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signInWithGoogle } from "@/app/actions";

function LoginError() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");
  if (!error) return null;
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error === "sign-in-failed"
        ? "We couldn't sign you in. Please try again."
        : error}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-1.55 4.31-3.74 4.25z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saveEmail, setSaveEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const devMode = process.env.NEXT_PUBLIC_AUTH_DEV_MODE === "true";

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!devMode) return;
    setLoading(true);
    setError(null);
    try {
      const { signIn } = await import("next-auth/react");
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("invalid-credentials");
        setLoading(false);
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("sign-in-failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error === "invalid-credentials"
            ? "Invalid email or password."
            : "Something went wrong. Please try again."}
        </div>
      )}

      {/* OAuth buttons row — Google is functional, Apple/GitHub disabled (not configured) */}
      <div className="grid grid-cols-3 gap-2">
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <GoogleIcon />
            Google
          </button>
        </form>
        <button
          type="button"
          disabled
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-400 cursor-not-allowed opacity-50"
        >
          <AppleIcon />
          Apple
        </button>
        <button
          type="button"
          disabled
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-400 cursor-not-allowed opacity-50"
        >
          <GithubIcon />
          GitHub
        </button>
      </div>

      {/* SSO button — not configured */}
      <button
        type="button"
        disabled
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-400 transition-colors cursor-not-allowed opacity-50"
      >
        <LockIcon />
        Continue with SSO
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs font-medium text-zinc-400">OR</span>
        <span className="h-px flex-1 bg-zinc-200" />
      </div>

      {/* Email + Password */}
      <form onSubmit={onSignIn} className="space-y-3">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <EyeIcon visible={showPassword} />
            </button>
          </div>
        </div>

        {/* Save checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={saveEmail}
            onChange={(e) => setSaveEmail(e.target.checked)}
            className="size-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500/20"
          />
          <span className="text-sm text-zinc-600">Save email and login method on this device</span>
        </label>

        {/* Sign in button */}
        <button
          type="submit"
          disabled={loading}
          className="relative flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-lg px-4 text-sm font-medium text-white shadow-xs ring-1 ring-blue-700/10 transition-opacity duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#4d88f5] to-[#2563eb] shadow-[inset_0_1px_0_0_#4d88f5]"
          />
          <span className="relative flex items-center gap-1.5">
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </span>
        </button>
      </form>

      {/* Links */}
      <div className="space-y-1 text-center text-sm">
        <p className="text-zinc-600">
          Don&apos;t have an account?{" "}
          <a href="/register" className="font-medium text-blue-600 hover:text-blue-700">
            Sign up
          </a>
        </p>
        <p className="text-zinc-600">
          Forgot your{" "}
          <a href="#" className="font-medium text-blue-600 hover:text-blue-700">email</a>{" "}
          or{" "}
          <a href="#" className="font-medium text-blue-600 hover:text-blue-700">password</a>?
        </p>
      </div>

      <p className="pt-2 text-center text-xs text-zinc-400">
        By continuing, you agree to Trell&apos;s{" "}
        <a href="/legal/terms" className="underline hover:text-zinc-600">Terms of Service</a> and{" "}
        <a href="/legal/privacy" className="underline hover:text-zinc-600">Privacy Policy</a>.
      </p>
    </div>
  );
}

export function SignInCard() {
  return (
    <>
      <Suspense fallback={null}>
        <LoginError />
      </Suspense>
      <SignInForm />
    </>
  );
}

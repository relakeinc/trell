import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

const devModeRequested = process.env.AUTH_DEV_MODE === "true";

// Fail closed: dev bypass must NEVER run in production, even if the flag leaks via .env.
if (devModeRequested && process.env.NODE_ENV === "production") {
  throw new Error("AUTH_DEV_MODE must never be enabled in production");
}

const devMode = devModeRequested && process.env.NODE_ENV !== "production";

if (devMode) {
  console.warn("[trell:auth] AUTH_DEV_MODE is on — email-only sign-in (dev only).");
}

// Fail fast with a clear log instead of opaque `?error=Configuration`:
// Auth.js maps missing provider creds / DB failures to error=Configuration.
if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
  console.error(
    "[trell:auth] AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET missing — Google sign-in will fail with ?error=Configuration. " +
      "Set them in apps/web/.env (dev) or the web environment (prod).",
  );
}

// Production boot guard: refuse weak/missing secrets instead of running insecure.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret || secret.length < 32 || secret === "change-me-auth-secret") {
    throw new Error("AUTH_SECRET must be set to a strong random value in production");
  }
  if (!process.env.TRELL_ENC_KEY) {
    throw new Error("TRELL_ENC_KEY must be set in production");
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Explicit (Auth.js also reads AUTH_SECRET / AUTH_TRUST_HOST from env,
  // but explicit values survive dotenv/turbo load-order issues that
  // otherwise surface as `?error=Configuration` on Google sign-in).
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  // Credentials (the dev email login) only works with JWT sessions — Auth.js
  // cannot persist a database session for a credentials sign-in, which showed
  // up as a successful POST followed by no session and a bounce to /signin.
  session: { strategy: devMode ? "jwt" : "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Google verifies emails, so auto-link is safe and avoids
      // OAuthAccountNotLinked when a dev/prod user already exists
      // (e.g. created via AUTH_DEV_MODE credentials with the same email).
      allowDangerousEmailAccountLinking: true,
    }),
    ...(devMode
      ? [
          Credentials({
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email", placeholder: "dev@trell.dev" },
            },
            async authorize(credentials) {
              const email = credentials?.email;
              if (!email || typeof email !== "string") return null;
              let user = await prisma.user.findUnique({ where: { email } });
              if (!user) {
                user = await prisma.user.create({ data: { email, name: email.split("@")[0] } });
              }
              return { id: user.id, name: user.name, email: user.email, image: user.image };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    // JWT strategy (dev) carries the id on the token; database strategy
    // passes it on `user`. Support both.
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, user, token }) {
      const id = user?.id ?? (token?.id as string | undefined) ?? token?.sub;
      if (session.user && id) (session.user as { id?: string }).id = id as string;
      return session;
    },
  },
});

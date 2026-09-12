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
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
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
    async session({ session, user }) {
      if (session.user) (session.user as { id?: string }).id = user.id;
      return session;
    },
  },
});

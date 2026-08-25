"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signInDev(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) return;
  await signIn("credentials", { email, redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

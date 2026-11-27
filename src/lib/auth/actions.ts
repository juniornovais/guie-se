"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "./redirect";

export type AuthFormState = { error?: string } | undefined;

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Inicia o fluxo OAuth com Google (PKCE). */
export async function signInWithGoogle(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    return {
      error:
        error?.message === "Unsupported provider: provider is not enabled"
          ? "O login com Google ainda não foi habilitado no Supabase. Veja docs/DEPLOY.md."
          : "Não foi possível iniciar o login com Google. Tente novamente.",
    };
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Login de desenvolvimento (e-mail/senha) — SOMENTE em `next dev` com
// DEV_EMAIL_LOGIN=true. Existe para testar a aplicação localmente antes de
// configurar as credenciais do Google. Em produção a função recusa a chamada.
// ---------------------------------------------------------------------------
export async function isDevLoginEnabled() {
  return process.env.NODE_ENV === "development" && process.env.DEV_EMAIL_LOGIN === "true";
}

const DevLogin = z.object({ email: z.email(), password: z.string().min(6) });

export async function devSignIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!(await isDevLoginEnabled())) return { error: "Login de desenvolvimento desabilitado." };
  const parsed = DevLogin.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Informe um e-mail válido e uma senha com ao menos 6 caracteres." };

  const supabase = await createClient();
  let { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === "invalid_credentials") {
    const signUp = await supabase.auth.signUp(parsed.data);
    error = signUp.error;
  }
  if (error) return { error: error.message };
  redirect(safeNextPath(formData.get("next")?.toString()));
}

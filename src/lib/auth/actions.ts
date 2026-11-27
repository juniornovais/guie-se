"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "./redirect";
import { configuredSiteOrigin } from "./site-origin";

export type AuthFormState = { error?: string; message?: string; confirmationEmail?: string } | undefined;

const Email = z.email();
const EmailLogin = z.object({ email: Email, password: z.string().min(1) });
const EmailSignup = EmailLogin.extend({ password: z.string().min(8) });

function confirmationDeliveryError(error: AuthError | null) {
  switch (error?.code) {
    case "over_email_send_rate_limit":
      return "O envio de e-mails de confirmação atingiu o limite. Confira a caixa de entrada e o spam ou tente mais tarde.";
    case "over_request_rate_limit":
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
    case "email_address_not_authorized":
      return "O serviço de e-mail ainda não pode enviar confirmações para este endereço. Tente entrar com Google.";
  }
}

async function siteOrigin() {
  const configuredOrigin = configuredSiteOrigin();
  if (configuredOrigin) return configuredOrigin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function authCallbackUrl(next: string) {
  const url = new URL("/auth/callback", await siteOrigin());
  url.searchParams.set("next", next);
  return url.toString();
}

/** Inicia o fluxo OAuth com Google (PKCE). */
export async function signInWithGoogle(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: await authCallbackUrl(next),
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

export async function signInWithEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = EmailLogin.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Informe um e-mail válido e sua senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  switch (error?.code) {
    case "invalid_credentials":
      return { error: "E-mail ou senha incorretos." };
    case "email_not_confirmed":
      return { error: "Confirme seu e-mail antes de entrar. Confira também a pasta de spam.", confirmationEmail: parsed.data.email };
    case "over_request_rate_limit":
      return { error: "Muitas tentativas. Aguarde um pouco e tente novamente." };
  }
  if (error) return { error: "Não foi possível entrar. Tente novamente." };

  redirect(safeNextPath(formData.get("next")?.toString()));
}

export async function signUpWithEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = EmailSignup.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Informe um e-mail válido e uma senha com pelo menos 8 caracteres." };

  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: await authCallbackUrl(next) },
  });
  const deliveryError = confirmationDeliveryError(error);
  if (deliveryError) return { error: deliveryError };
  switch (error?.code) {
    case "email_provider_disabled":
    case "signup_disabled":
      return { error: "O cadastro por e-mail está indisponível no momento." };
    case "weak_password":
      return { error: "Escolha uma senha mais forte." };
  }
  if (error && error.code !== "user_already_exists") {
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }
  if (data.session) redirect(next);

  return { message: "Confira seu e-mail. Abra o link de confirmação neste mesmo navegador. Se já tiver uma conta, volte para entrar." };
}

export async function resendEmailConfirmation(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = Email.safeParse(formData.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido para solicitar outro link." };

  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: await authCallbackUrl(next) },
  });
  if (error) return { error: confirmationDeliveryError(error) ?? "Não foi possível solicitar outro link. Tente novamente." };

  return { message: "Se houver uma conta aguardando confirmação, você receberá um novo link. Abra-o neste mesmo navegador." };
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

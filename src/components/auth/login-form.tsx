"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { devSignIn, signInWithEmail, signInWithGoogle, signUpWithEmail, type AuthFormState } from "@/lib/auth/actions";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.87-3c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.79-2.12-6.74-4.97H1.27v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.26 14.26a7.2 7.2 0 0 1 0-4.52v-3.1H1.27a12 12 0 0 0 0 10.72l3.99-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.64l3.99 3.1C6.21 6.89 8.87 4.77 12 4.77z" />
    </svg>
  );
}

function EmailForm({ next, signup }: { next: string; signup: boolean }) {
  const action = signup ? signUpWithEmail : signInWithEmail;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, undefined);
  const alternative = new URLSearchParams();
  if (next !== "/") alternative.set("next", next);
  if (!signup) alternative.set("mode", "signup");
  const query = alternative.toString();

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={signup ? 8 : undefined}
            aria-describedby={signup ? "password-hint" : undefined}
            required
          />
          {signup && <p id="password-hint" className="text-sm text-muted-foreground">Use pelo menos 8 caracteres.</p>}
        </div>
        <Button type="submit" size="lg" className="h-12 w-full gap-3 text-base" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {signup ? "Criar conta" : "Entrar com e-mail"}
        </Button>
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        {state?.message && <p role="status" className="text-sm text-muted-foreground">{state.message}</p>}
      </form>
      <p className="text-sm text-muted-foreground">
        {signup ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link href={query ? `/login?${query}` : "/login"} className="font-medium text-primary underline-offset-4 hover:underline">
          {signup ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </div>
  );
}

export function LoginForm({ next, devLogin, signup }: { next: string; devLogin: boolean; signup: boolean }) {
  const [googleState, googleAction, googlePending] = useActionState<AuthFormState, FormData>(signInWithGoogle, undefined);
  const [devState, devAction, devPending] = useActionState<AuthFormState, FormData>(devSignIn, undefined);

  return (
    <div className="space-y-6">
      <EmailForm key={signup ? "signup" : "login"} next={next} signup={signup} />
      <form action={googleAction} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" size="lg" className="h-12 w-full gap-3 text-base" disabled={googlePending}>
          {googlePending ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <GoogleIcon />}
          Entrar com Google
        </Button>
        {googleState?.error && (
          <p role="alert" className="text-sm text-danger">
            {googleState.error}
          </p>
        )}
      </form>

      {devLogin && (
        <details className="rounded-md border border-dashed p-4 text-sm">
          <summary className="cursor-pointer font-semibold">Login de desenvolvimento</summary>
          <p className="mt-2 text-muted-foreground">
            Disponível apenas em <code>next dev</code> com <code>DEV_EMAIL_LOGIN=true</code>. Cria o usuário no Supabase local
            se ainda não existir.
          </p>
          <form action={devAction} className="mt-4 space-y-3">
            <input type="hidden" name="next" value={next} />
            <div className="space-y-1.5">
              <Label htmlFor="dev-email">E-mail</Label>
              <Input id="dev-email" name="email" type="email" required defaultValue="dev@guie-se.local" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dev-password">Senha</Label>
              <Input id="dev-password" name="password" type="password" required minLength={6} defaultValue="dev-password" />
            </div>
            <Button type="submit" variant="outline" className="w-full" disabled={devPending}>
              {devPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Entrar no ambiente local
            </Button>
            {devState?.error && (
              <p role="alert" className="text-danger">
                {devState.error}
              </p>
            )}
          </form>
        </details>
      )}
    </div>
  );
}

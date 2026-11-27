import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/layout/brand";
import { LoginForm } from "@/components/auth/login-form";
import { RouteLines } from "@/components/auth/route-lines";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Entrar" };

const devLogin = process.env.NODE_ENV === "development" && process.env.DEV_EMAIL_LOGIN === "true";

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  return <LoginForm next={next} devLogin={devLogin} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between border-r bg-surface p-12 lg:flex">
        <Brand />
        <RouteLines />
        <p className="max-w-md text-sm text-muted-foreground">
          6 etapas, 24 módulos e 236 tópicos, do funcionamento da CPU ao design de sistemas distribuídos.
        </p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">Continue de onde parou</h1>
            <p className="text-muted-foreground">
              Entre com sua conta Google para recuperar seu progresso e suas anotações em qualquer computador.
            </p>
          </div>
          <Suspense fallback={<div className="h-12 rounded-lg bg-accent" />}>
            <Form searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

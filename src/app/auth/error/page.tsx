import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  access_denied: "O acesso foi cancelado na tela do Google.",
  missing_code: "O retorno do login chegou sem o código de autorização.",
  bad_code_verifier: "A sessão de login expirou ou foi aberta em outro navegador. Inicie o login novamente.",
  flow_state_not_found: "A sessão de login expirou. Inicie o login novamente.",
};

async function Reason({ searchParams }: { searchParams: PageProps<"/auth/error">["searchParams"] }) {
  const { reason } = await searchParams;
  const key = typeof reason === "string" ? reason : "";
  return <p className="text-muted-foreground">{MESSAGES[key] ?? "Não foi possível concluir o login."}</p>;
}

export default function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-bold">O login não foi concluído</h1>
        <Suspense fallback={<p className="text-muted-foreground">Verificando…</p>}>
          <Reason searchParams={searchParams} />
        </Suspense>
        <Button asChild>
          <Link href="/login">Tentar novamente</Link>
        </Button>
      </div>
    </div>
  );
}

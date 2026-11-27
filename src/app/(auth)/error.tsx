"use client";

import { Button } from "@/components/ui/button";

export default function AuthError() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-2xl font-bold">Não foi possível continuar</h1>
      <p className="mt-2 text-muted-foreground">
        Recarregue a página para abrir a versão atual do formulário e tente novamente.
      </p>
      <Button className="mt-6" onClick={() => window.location.reload()}>
        Recarregar página
      </Button>
    </main>
  );
}

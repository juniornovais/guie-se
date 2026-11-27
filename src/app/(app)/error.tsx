"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 sm:px-8">
      <h1 className="text-2xl font-bold">Não foi possível carregar esta página</h1>
      <p className="mt-2 text-muted-foreground">
        O servidor não respondeu como esperado. Verifique sua conexão e tente de novo. Seu progresso já salvo não foi afetado.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground">Código: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}

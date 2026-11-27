/**
 * Data Access Layer de autenticação.
 *
 * Toda leitura de dados do usuário passa por aqui: valida o JWT no servidor
 * (getClaims verifica a assinatura) e devolve um usuário enxuto. Server Actions
 * chamam `requireUser()` para se autorizarem sozinhas — nunca confiam no cliente.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
};

/** Usuário autenticado ou null. Memoizado por requisição. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as Record<string, unknown> & { sub: string; email?: string };
  const meta = (claims.user_metadata ?? {}) as Record<string, string | undefined>;
  return {
    id: claims.sub,
    email: claims.email ?? null,
    name: meta.full_name ?? meta.name ?? claims.email?.split("@")[0] ?? "Estudante",
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
  };
});

/** Exige usuário; redireciona para /login caso contrário. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Usuário + cliente Supabase da mesma requisição (para services). */
export async function requireSession() {
  const user = await requireUser();
  const supabase = await createClient();
  return { user, supabase };
}

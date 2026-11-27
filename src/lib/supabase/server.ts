import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente para Server Components, Server Actions e Route Handlers.
 * Crie um por requisição. As consultas rodam com o JWT do usuário, então a
 * RLS do PostgreSQL é aplicada em todas elas.
 */
export async function createClient() {
  // Sessão é sempre dado de requisição: nunca entra no shell pré-renderizado.
  // (o cliente Supabase lê Date.now() para validar a expiração do token)
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de um Server Component (cookies somente leitura).
          // O proxy renova a sessão, então pode ser ignorado com segurança.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

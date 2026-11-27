/**
 * Variáveis de ambiente públicas (seguras para o navegador), validadas.
 * Segredos (DATABASE_URL, SUPABASE_SECRET_KEY) NUNCA são lidos aqui: são usados
 * apenas por scripts de seed/teste, fora do bundle da aplicação.
 */
import { z } from "zod";

const PublicEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

// Referências literais: o Next.js só embute NEXT_PUBLIC_* quando acessadas assim.
const parsed = PublicEnv.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
});

if (!parsed.success) {
  throw new Error(
    "Variáveis de ambiente do Supabase ausentes ou inválidas. Copie .env.example para .env.local. " +
      parsed.error.issues.map((i) => i.path.join(".")).join(", "),
  );
}

export const env = parsed.data;

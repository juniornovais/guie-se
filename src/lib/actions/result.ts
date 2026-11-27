import { z } from "zod";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

/** Valida a entrada com Zod e devolve a primeira mensagem legível em caso de erro. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new InputError(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data;
}

export class InputError extends Error {}

/** Envolve a action: erros de validação viram mensagem; erros inesperados são logados e genéricos. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof InputError) return fail(e.message);
    // redirect()/notFound() do Next lançam erros de controle: precisam propagar.
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string") {
      const digest = (e as { digest: string }).digest;
      if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR")) throw e;
    }
    console.error("[action]", e);
    return fail("Não foi possível salvar. Verifique sua conexão e tente novamente.");
  }
}

/**
 * Sanitiza o destino pós-login para impedir open redirect.
 * Aceita apenas caminhos relativos internos ("/x"), nunca "//host" ou URLs absolutas.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\t\r\n]/.test(next)) return fallback;
  if (next.startsWith("/login") || next.startsWith("/auth/")) return fallback;
  return next;
}

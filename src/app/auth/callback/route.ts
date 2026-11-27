import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { configuredSiteOrigin } from "@/lib/auth/site-origin";

/**
 * Retorno do OAuth e da confirmação de cadastro por e-mail.
 * Troca o `code` (PKCE) por uma sessão e grava os cookies. O perfil é criado
 * automaticamente pelo trigger `on_auth_user_created` no banco.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = configuredSiteOrigin() ?? request.nextUrl.origin;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return NextResponse.redirect(new URL(`/auth/error?reason=${encodeURIComponent(error.code ?? "exchange_failed")}`, origin));
  }

  const providerError = searchParams.get("error_code") ?? searchParams.get("error") ?? "missing_code";
  return NextResponse.redirect(new URL(`/auth/error?reason=${encodeURIComponent(providerError)}`, origin));
}

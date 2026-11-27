import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as authCallback } from "@/app/auth/callback/route";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth/actions";

const { exchangeCodeForSession, signInWithPassword, signUp } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, signInWithPassword, signUp } }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`Redirect: ${path}`); },
}));

function credentials(next = "/roadmap") {
  const form = new FormData();
  form.set("email", "estudante@example.com");
  form.set("password", "senha-de-teste");
  form.set("next", next);
  return form;
}

describe("autenticação por e-mail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://guie-se.onrender.com");
    vi.stubEnv("RENDER_EXTERNAL_URL", undefined);
  });

  it.each([
    [undefined, "https://guie-se.onrender.com"],
    ["http://localhost:3000", "https://guie-se.onrender.com"],
    ["https://app.example.com", "https://app.example.com"],
  ])("usa a origem pública no Render quando NEXT_PUBLIC_SITE_URL é %s", async (siteUrl, expectedOrigin) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://guie-se.onrender.com");
    signUp.mockResolvedValue({ data: { session: null }, error: null });

    await signUpWithEmail(undefined, credentials());

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: { emailRedirectTo: `${expectedOrigin}/auth/callback?next=%2Froadmap` },
    }));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("aguarda a confirmação e preserva o destino no callback público", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await signUpWithEmail(undefined, credentials("/roadmap?etapa=1"));

    expect(result?.message).toContain("link de confirmação");
    expect(signUp).toHaveBeenCalledWith({
      email: "estudante@example.com",
      password: "senha-de-teste",
      options: { emailRedirectTo: "https://guie-se.onrender.com/auth/callback?next=%2Froadmap%3Fetapa%3D1" },
    });
  });

  it("redireciona para o site público depois de confirmar o e-mail no Render", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://guie-se.onrender.com");
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await authCallback(new NextRequest(
      "http://localhost:3000/auth/callback?code=codigo-de-teste&next=%2Froadmap",
    ));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("codigo-de-teste");
    expect(response.headers.get("location")).toBe("https://guie-se.onrender.com/roadmap");
  });

  it("entra imediatamente quando o cadastro já retorna uma sessão", async () => {
    signUp.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(signUpWithEmail(undefined, credentials())).rejects.toThrow("Redirect: /roadmap");
  });

  it("uma tentativa de login inválida não cria uma conta", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    expect(await signInWithEmail(undefined, credentials())).toEqual({ error: "E-mail ou senha incorretos." });
    expect(signUp).not.toHaveBeenCalled();
  });
});

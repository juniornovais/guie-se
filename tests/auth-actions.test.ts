import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth/actions";

const { signInWithPassword, signUp } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword, signUp } }),
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

/**
 * Testes de integração de segurança (RLS) contra o Supabase LOCAL.
 * Requer `npm run db:start` + `npm run db:seed`. Pulados se o ambiente não existir.
 *
 * Usa apenas a chave publicável + JWT de usuários reais — exatamente o que um
 * navegador (ou um atacante com a chave pública) teria.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "../../scripts/lib/env";

loadEnv();
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const isLocal = !!URL && /127\.0\.0\.1|localhost/.test(URL);
const run = isLocal && PUBLISHABLE && SECRET ? describe : describe.skip;

run("RLS — isolamento entre usuários", () => {
  const admin = createClient(URL!, SECRET!, { auth: { persistSession: false } });
  const stamp = Date.now();
  const users: { id: string; client: SupabaseClient }[] = [];
  let topicId = "";

  async function makeUser(tag: string) {
    const email = `rls-${tag}-${stamp}@test.local`;
    const password = "senha-de-teste-123";
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Usuário ${tag}` },
    });
    if (error) throw error;
    const client = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false } });
    const { error: e2 } = await client.auth.signInWithPassword({ email, password });
    if (e2) throw e2;
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    users.push(await makeUser("a"), await makeUser("b"));
    const { data } = await users[0].client.from("topics").select("id").eq("key", "4.1.8").single();
    topicId = data!.id;
  });

  afterAll(async () => {
    for (const u of users) await admin.auth.admin.deleteUser(u.id);
  });

  it("cria o perfil automaticamente via trigger, com dados do provedor", async () => {
    const { data } = await users[0].client.from("profiles").select("id, display_name, settings").single();
    expect(data?.id).toBe(users[0].id);
    expect(data?.display_name).toBe("Usuário a");
    expect((data?.settings as Record<string, unknown>).requireContentRead).toBe(true);
  });

  it("anônimo não lê conteúdo nem dados de usuário", async () => {
    const anon = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false } });
    const topics = await anon.from("topics").select("id").limit(1);
    expect(topics.data ?? []).toHaveLength(0);
    const profiles = await anon.from("profiles").select("id");
    expect(profiles.data ?? []).toHaveLength(0);
  });

  it("autenticado lê o roadmap completo (236 tópicos), mas não pode alterá-lo", async () => {
    const c = users[0].client;
    const { count } = await c.from("topics").select("id", { count: "exact", head: true });
    expect(count).toBe(236);
    const upd = await c.from("topics").update({ title: "hack" }).eq("id", topicId).select();
    expect(upd.error ?? (upd.data?.length === 0 ? "nenhuma linha" : null)).toBeTruthy();
    const { data } = await c.from("topics").select("title").eq("id", topicId).single();
    expect(data?.title).toBe("Garbage Collection");
  });

  it("progresso de A é invisível e imutável para B", async () => {
    const [a, b] = users;
    const ins = await a.client
      .from("user_topic_progress")
      .insert({ user_id: a.id, topic_id: topicId, status: "in_progress" });
    expect(ins.error).toBeNull();

    const seen = await b.client.from("user_topic_progress").select("*").eq("user_id", a.id);
    expect(seen.data).toHaveLength(0);

    const upd = await b.client
      .from("user_topic_progress")
      .update({ status: "completed" })
      .eq("user_id", a.id)
      .select();
    expect(upd.data ?? []).toHaveLength(0);

    const del = await b.client.from("user_topic_progress").delete().eq("user_id", a.id).select();
    expect(del.data ?? []).toHaveLength(0);

    const mine = await a.client.from("user_topic_progress").select("status").eq("topic_id", topicId).single();
    expect(mine.data?.status).toBe("in_progress");
  });

  it("B não consegue inserir registros em nome de A", async () => {
    const [a, b] = users;
    const note = await b.client.from("user_notes").insert({ user_id: a.id, topic_id: topicId, body: "intrusão" });
    expect(note.error).not.toBeNull();
    const session = await b.client.from("study_sessions").insert({ user_id: a.id, duration_seconds: 60 });
    expect(session.error).not.toBeNull();
  });

  it("perfil: só colunas permitidas podem ser alteradas, e só no próprio perfil", async () => {
    const [a, b] = users;
    const ok = await a.client.from("profiles").update({ display_name: "Novo nome" }).eq("id", a.id);
    expect(ok.error).toBeNull();
    const email = await a.client.from("profiles").update({ email: "x@evil.com" }).eq("id", a.id);
    expect(email.error).not.toBeNull(); // sem privilégio de coluna
    const other = await b.client.from("profiles").update({ display_name: "hack" }).eq("id", a.id).select();
    expect(other.data ?? []).toHaveLength(0);
  });

  it("tentativas de desafio são um histórico imutável", async () => {
    const [a] = users;
    const { data: ch } = await a.client.from("challenges").select("id").limit(1).maybeSingle();
    if (!ch) return; // nenhum desafio completo cadastrado ainda
    const ins = await a.client
      .from("challenge_attempts")
      .insert({ user_id: a.id, challenge_id: ch.id, solution: "v1" })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    const upd = await a.client.from("challenge_attempts").update({ solution: "v2" }).eq("id", ins.data!.id).select();
    expect(upd.error ?? (upd.data?.length === 0 ? "bloqueado" : null)).toBeTruthy();
  });

  it("view de atividades respeita a RLS do chamador", async () => {
    const [a, b] = users;
    const mine = await a.client.from("user_activity").select("*");
    expect(mine.data!.length).toBeGreaterThan(0);
    const theirs = await b.client.from("user_activity").select("*").eq("user_id", a.id);
    expect(theirs.data).toHaveLength(0);
  });
});

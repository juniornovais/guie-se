/**
 * Seed: conferência contra o roadmap oficial + idempotência + preservação do progresso.
 * Requer o Supabase local (npm run db:start). Pulado sem DATABASE_URL local.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../../scripts/lib/env";
import { seed } from "../../scripts/seed";

loadEnv();
const DB = process.env.DATABASE_URL;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const run = DB && /127\.0\.0\.1|localhost/.test(DB) && URL && SECRET ? describe : describe.skip;

run("seed do roadmap", () => {
  const pg = new Client({ connectionString: DB });
  const admin = createClient(URL!, SECRET!, { auth: { persistSession: false } });
  let userId = "";

  const count = async (table: string) => Number((await pg.query(`select count(*)::int as n from public.${table}`)).rows[0].n);

  beforeAll(async () => {
    await pg.connect();
    await seed(DB!);
    const { data, error } = await admin.auth.admin.createUser({ email: `seed-${Date.now()}@test.local`, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  });
  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    await pg.end();
  });

  it("carrega 6 etapas, 24 módulos e 236 tópicos, com descrições", async () => {
    expect(await count("stages")).toBe(6);
    expect(await count("modules")).toBe(24);
    expect(await count("topics")).toBe(236);
    const { rows } = await pg.query(
      `select count(*) filter (where s.description = '')::int as stages_sem_desc,
              (select count(*)::int from public.modules where description is null) as mod_sem_desc,
              (select count(*)::int from public.topics where cardinality(objectives) = 0) as top_sem_obj
         from public.stages s`,
    );
    expect(rows[0]).toEqual({ stages_sem_desc: 0, mod_sem_desc: 0, top_sem_obj: 0 });
  });

  it("preserva a ordem original (módulos e tópicos)", async () => {
    const { rows } = await pg.query(
      `select string_agg(m.key, ',' order by s.position, m.position) as keys
         from public.modules m join public.stages s on s.id = m.stage_id`,
    );
    expect(rows[0].keys).toBe(
      "1.1,1.2,2.1,2.2,2.3,2.4,2.5,2.6,3.1,3.2,3.3,3.4,3.5,4.1,4.2,4.3,4.4,5.1,5.2,5.3,6.1,6.2,6.3,6.4",
    );
    const { rows: jvm } = await pg.query(
      `select string_agg(t.title, '|' order by t.position) as titles
         from public.topics t join public.modules m on m.id = t.module_id where m.key = '4.1'`,
    );
    expect(jvm[0].titles.split("|")[7]).toBe("Garbage Collection");
    expect(jvm[0].titles.split("|")).toHaveLength(14);
  });

  it("é idempotente e não apaga progresso dos usuários", async () => {
    const { rows } = await pg.query(`select id from public.topics where key = '1.1.7'`);
    await pg.query(
      `insert into public.user_topic_progress (user_id, topic_id, status, self_assessment) values ($1, $2, 'completed', 5)`,
      [userId, rows[0].id],
    );
    const before = { topics: await count("topics"), prereqs: await count("topic_prerequisites") };

    await seed(DB!);
    await seed(DB!);

    expect(await count("topics")).toBe(before.topics);
    expect(await count("topic_prerequisites")).toBe(before.prereqs);
    const { rows: p } = await pg.query(
      `select status, self_assessment from public.user_topic_progress where user_id = $1 and topic_id = $2`,
      [userId, rows[0].id],
    );
    expect(p[0]).toEqual({ status: "completed", self_assessment: 5 });
  });

  it("grafo de pré-requisitos referencia apenas tópicos existentes e não tem auto-referência", async () => {
    const { rows } = await pg.query(
      `select count(*)::int as n from public.topic_prerequisites where topic_id = prerequisite_id`,
    );
    expect(rows[0].n).toBe(0);
    expect(await count("topic_prerequisites")).toBeGreaterThan(200);
  });
});

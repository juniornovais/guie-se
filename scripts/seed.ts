/**
 * Seed idempotente do roadmap.
 *
 *   npm run db:seed
 *
 * - Lê content/ROADMAP_JAVA_BACKEND.md (fonte oficial) + content/meta + content/topics.
 * - Upsert por chave natural (stages.key, modules.key, topics.key, challenges.key):
 *   rodar novamente atualiza textos/ordem, sem duplicar.
 * - NUNCA apaga etapas, módulos, tópicos ou desafios (preserva progresso dos usuários).
 *   Registros que sumiram da fonte são apenas reportados.
 * - Seções de conteúdo e pré-requisitos (sem dados de usuário) são sincronizados.
 * - Não toca em nenhuma tabela de usuário.
 */
import path from "node:path";
import { Client } from "pg";
import { loadContent } from "../src/lib/content/load-content";
import { countRoadmap } from "../src/lib/content/parse-roadmap";
import { loadEnv } from "./lib/env";

loadEnv();

export async function seed(databaseUrl: string, contentDir = path.resolve(__dirname, "../content")) {
  const content = loadContent(contentDir);
  const { roadmap } = content;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const stats = { stages: 0, modules: 0, topics: 0, sections: 0, challenges: 0, prerequisites: 0 };
  try {
    await client.query("begin");
    const topicIds = new Map<string, string>();

    for (const stage of roadmap.stages) {
      const {
        rows: [s],
      } = await client.query(
        `insert into public.stages (key, slug, position, title, description)
         values ($1, $2, $3, $4, $5)
         on conflict (key) do update set slug = excluded.slug, position = excluded.position,
           title = excluded.title, description = excluded.description
         returning id`,
        [stage.key, stage.slug, stage.position, stage.title, stage.description],
      );
      stats.stages++;

      for (const mod of stage.modules) {
        const meta = content.moduleMeta.get(mod.key);
        const {
          rows: [m],
        } = await client.query(
          `insert into public.modules (stage_id, key, slug, position, title, description, objectives)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (key) do update set stage_id = excluded.stage_id, slug = excluded.slug,
             position = excluded.position, title = excluded.title,
             description = excluded.description, objectives = excluded.objectives
           returning id`,
          [s.id, mod.key, mod.slug, mod.position, mod.title, meta?.description ?? null, meta?.objectives ?? []],
        );
        stats.modules++;

        for (const topic of mod.topics) {
          const tm = content.topicMeta.get(topic.key);
          const sections = content.sections.get(topic.key) ?? [];
          const challenges = content.challenges.get(topic.key) ?? [];
          const status =
            sections.length && challenges.length ? "ready" : sections.length || challenges.length ? "draft" : "planned";
          const {
            rows: [t],
          } = await client.query(
            `insert into public.topics (module_id, key, slug, position, title, summary, objectives,
                completion_criteria, estimated_minutes, content_status, planned_challenges)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             on conflict (key) do update set module_id = excluded.module_id, slug = excluded.slug,
               position = excluded.position, title = excluded.title, summary = excluded.summary,
               objectives = excluded.objectives, completion_criteria = excluded.completion_criteria,
               estimated_minutes = excluded.estimated_minutes, content_status = excluded.content_status,
               planned_challenges = excluded.planned_challenges
             returning id`,
            [
              m.id,
              topic.key,
              topic.slug,
              topic.position,
              topic.title,
              tm?.summary ?? null,
              tm?.objectives ?? [],
              JSON.stringify({ checklist: tm?.checklist ?? [] }),
              tm?.estimatedMinutes ?? null,
              status,
              JSON.stringify(tm?.plannedChallenges ?? []),
            ],
          );
          topicIds.set(topic.key, t.id);
          stats.topics++;

          // Seções: sincroniza (remove as que não existem mais na fonte; não há dados de usuário nelas)
          await client.query(
            `delete from public.learning_contents where topic_id = $1 and not (key = any($2::text[]))`,
            [t.id, sections.map((x) => x.key)],
          );
          for (const [i, sec] of sections.entries()) {
            await client.query(
              `insert into public.learning_contents (topic_id, key, position, kind, title, body_md, is_additional)
               values ($1, $2, $3, $4, $5, $6, $7)
               on conflict (topic_id, key) do update set position = excluded.position, kind = excluded.kind,
                 title = excluded.title, body_md = excluded.body_md, is_additional = excluded.is_additional`,
              [t.id, sec.key, i + 1, sec.kind, sec.title, sec.body, sec.additional],
            );
            stats.sections++;
          }

          for (const [i, ch] of challenges.entries()) {
            await client.query(
              `insert into public.challenges (topic_id, key, slug, position, title, type, level, statement_md,
                  objective, required_knowledge, instructions_md, hints, evaluation_criteria,
                  reference_solution_md, is_required, is_additional)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
               on conflict (key) do update set topic_id = excluded.topic_id, slug = excluded.slug,
                 position = excluded.position, title = excluded.title, type = excluded.type,
                 level = excluded.level, statement_md = excluded.statement_md, objective = excluded.objective,
                 required_knowledge = excluded.required_knowledge, instructions_md = excluded.instructions_md,
                 hints = excluded.hints, evaluation_criteria = excluded.evaluation_criteria,
                 reference_solution_md = excluded.reference_solution_md, is_required = excluded.is_required,
                 is_additional = excluded.is_additional`,
              [
                t.id,
                ch.key,
                `${topic.slug}-${ch.key.split(".").pop()}`,
                i + 1,
                ch.title,
                ch.type,
                ch.level,
                ch.statement,
                ch.objective,
                ch.knowledge,
                ch.instructions ?? null,
                ch.hints,
                ch.criteria,
                ch.solution ?? null,
                ch.required,
                ch.additional,
              ],
            );
            stats.challenges++;
          }
        }
      }
    }

    // Pré-requisitos: sincroniza o grafo inteiro (sem dados de usuário)
    await client.query("delete from public.topic_prerequisites");
    for (const [key, meta] of content.topicMeta) {
      for (const p of meta.prerequisites) {
        await client.query(
          `insert into public.topic_prerequisites (topic_id, prerequisite_id, kind, reason) values ($1, $2, $3, $4)`,
          [topicIds.get(key), topicIds.get(p.key), p.kind, p.reason ?? null],
        );
        stats.prerequisites++;
      }
    }

    // Órfãos (existem no banco mas não na fonte) — apenas reporta, nunca apaga
    const orphans = await client.query(
      `select 'topic' as kind, key from public.topics where not (key = any($1::text[]))
       union all
       select 'challenge', key from public.challenges where not (key = any($2::text[]))`,
      [[...topicIds.keys()], [...content.challenges.values()].flat().map((c) => c.key)],
    );

    await client.query("commit");
    return { stats, totals: countRoadmap(roadmap), orphans: orphans.rows, warnings: content.warnings };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não definido (.env.local)");
    process.exit(1);
  }
  seed(url)
    .then(({ stats, totals, orphans, warnings }) => {
      console.log(`Seed concluído: ${JSON.stringify(stats)}`);
      console.log(`Roadmap oficial: ${totals.stages} etapas, ${totals.modules} módulos, ${totals.topics} tópicos`);
      if (orphans.length) {
        console.warn(`Atenção: ${orphans.length} registro(s) no banco não existem mais na fonte (mantidos):`);
        for (const o of orphans) console.warn(`  - ${o.kind} ${o.key}`);
      }
      if (warnings.length) console.log(`${warnings.length} aviso(s) de conteúdo — rode npm run content:check`);
    })
    .catch((e) => {
      console.error("Seed falhou:", e.message);
      process.exit(1);
    });
}

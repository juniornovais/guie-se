/**
 * Gera docs/INVENTARIO.md a partir de content/ (mesma fonte do seed).
 * Uso: npm run inventory
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { loadContent } from "../src/lib/content/load-content";
import { countRoadmap } from "../src/lib/content/parse-roadmap";

const LEVEL = { 1: "Entendimento", 2: "Aplicação", 3: "Aprofundamento", 4: "Construção" } as const;
const TYPE: Record<string, string> = {
  conceptual: "Conceitual",
  interview: "Entrevista",
  coding: "Programação",
  code_analysis: "Análise de código",
  bug_hunt: "Identificação de bugs",
  experiment: "Experimento",
  implementation: "Implementação",
  project: "Projeto",
};

const c = loadContent(path.resolve(__dirname, "../content"));
const totals = countRoadmap(c.roadmap);
const titleOf = new Map(c.roadmap.stages.flatMap((s) => s.modules.flatMap((m) => m.topics.map((t) => [t.key, t.title]))));
const planned = [...c.topicMeta.values()].reduce((a, m) => a + m.plannedChallenges.length, 0);
const edges = [...c.topicMeta.values()].reduce((a, m) => a + m.prerequisites.length, 0);

const out: string[] = [];
out.push(`# Inventário do Roadmap Java Backend`);
out.push(``);
out.push(`> Documento gerado automaticamente por \`npm run inventory\` a partir de \`content/\` — a mesma fonte usada pelo seed. Não edite à mão.`);
out.push(``);
out.push(`## Conferência`);
out.push(``);
out.push(`| Item | Roadmap oficial (contado) | Rodapé do roadmap | Inventário |`);
out.push(`|---|---|---|---|`);
out.push(`| Etapas | ${totals.stages} | ${c.roadmap.declaredTotals?.stages} | ${totals.stages} |`);
out.push(`| Módulos | ${totals.modules} | ${c.roadmap.declaredTotals?.modules} | ${c.moduleMeta.size} com descrição |`);
out.push(`| Tópicos | ${totals.topics} | ${c.roadmap.declaredTotals?.topics} | ${c.topicMeta.size} com objetivos e critérios |`);
out.push(`| Desafios planejados | — | — | ${planned} |`);
out.push(`| Pré-requisitos | — | — | ${edges} |`);
out.push(``);
out.push(
  `O rodapé do roadmap declara 23 módulos e 223 tópicos, mas o corpo do documento contém ${totals.modules} módulos e ${totals.topics} tópicos (cada módulo confere com seu "**N tópicos**"). Prevalece o corpo: nenhum tópico foi omitido.`,
);
out.push(``);
out.push(`Legenda: **[req]** pré-requisito necessário · **[rec]** recomendado (não bloqueia). Níveis: 1 ${LEVEL[1]}, 2 ${LEVEL[2]}, 3 ${LEVEL[3]}, 4 ${LEVEL[4]}. Descrições de módulo, objetivos, critérios e desafios são **conteúdo complementar** (o roadmap original define etapas, descrições das etapas, módulos e tópicos).`);
out.push(``);

for (const s of c.roadmap.stages) {
  out.push(`## ${s.key} — ${s.title}`);
  out.push(``);
  out.push(`*${s.description}*`);
  out.push(``);
  for (const m of s.modules) {
    const mm = c.moduleMeta.get(m.key);
    out.push(`### ${m.key} ${m.title} (${m.topics.length} tópicos)`);
    out.push(``);
    if (mm) {
      out.push(`**[Adicional]** ${mm.description}`);
      out.push(``);
      out.push(`Objetivos do módulo:`);
      for (const o of mm.objectives) out.push(`- ${o}`);
      out.push(``);
    }
    for (const t of m.topics) {
      const tm = c.topicMeta.get(t.key);
      out.push(`#### ${t.key} ${t.title}`);
      out.push(``);
      if (!tm) {
        out.push(`_Sem metadados._`);
        out.push(``);
        continue;
      }
      out.push(`${tm.summary} _(~${tm.estimatedMinutes} min)_`);
      out.push(``);
      out.push(`**Objetivos**`);
      for (const o of tm.objectives) out.push(`- ${o}`);
      out.push(``);
      if (tm.prerequisites.length) {
        out.push(`**Pré-requisitos**`);
        for (const p of tm.prerequisites)
          out.push(`- [${p.kind === "required" ? "req" : "rec"}] ${p.key} ${titleOf.get(p.key)}${p.reason ? ` — ${p.reason}` : ""}`);
        out.push(``);
      }
      out.push(`**Desafios planejados**`);
      for (const ch of tm.plannedChallenges) out.push(`- N${ch.level} · ${TYPE[ch.type]} — ${ch.title}`);
      out.push(``);
      out.push(`**Critérios de conclusão**`);
      for (const k of tm.checklist) out.push(`- [ ] ${k}`);
      out.push(``);
    }
  }
}

const file = path.resolve(__dirname, "../docs/INVENTARIO.md");
writeFileSync(file, out.join("\n"));
console.log(`Inventário gerado: ${file} (${out.length} linhas)`);

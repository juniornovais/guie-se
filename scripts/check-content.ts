/**
 * Valida todo o conteúdo de `content/` contra o roadmap oficial e os esquemas.
 * Uso: npm run content:check [-- --strict]   (--strict falha se houver avisos)
 */
import path from "node:path";
import { loadContent } from "../src/lib/content/load-content";
import { countRoadmap } from "../src/lib/content/parse-roadmap";

const strict = process.argv.includes("--strict");
try {
  const c = loadContent(path.resolve(__dirname, "../content"));
  const totals = countRoadmap(c.roadmap);
  const challengeCount = [...c.challenges.values()].reduce((a, l) => a + l.length, 0);
  const planned = [...c.topicMeta.values()].reduce((a, m) => a + m.plannedChallenges.length, 0);
  console.log(`Roadmap: ${totals.stages} etapas, ${totals.modules} módulos, ${totals.topics} tópicos`);
  console.log(`Metadados: ${c.moduleMeta.size}/${totals.modules} módulos, ${c.topicMeta.size}/${totals.topics} tópicos`);
  console.log(`Conteúdo aprofundado: ${c.sections.size} tópicos | Desafios completos: ${challengeCount} | Desafios planejados: ${planned}`);
  if (c.warnings.length) {
    console.log(`\n${c.warnings.length} aviso(s):`);
    for (const w of c.warnings.slice(0, 30)) console.log("  - " + w);
    if (c.warnings.length > 30) console.log(`  ... e mais ${c.warnings.length - 30}`);
  }
  if (strict && c.warnings.length) process.exit(1);
  console.log("\nOK");
} catch (e) {
  console.error("ERRO:", (e as Error).message);
  process.exit(1);
}

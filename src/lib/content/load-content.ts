/**
 * Carrega e valida TODO o conteúdo de `content/` (uso exclusivo do seed e dos
 * testes — a aplicação lê o conteúdo do banco, nunca destes arquivos).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { indexTopics, parseRoadmap, type ParsedRoadmap } from "./parse-roadmap";
import { parseChallengesMarkdown, parseContentMarkdown } from "./parse-topic-files";
import {
  StageMetaFileSchema,
  type Challenge,
  type ContentSection,
  type StageMetaFile,
  type TopicMeta,
} from "./schemas";

export type ModuleMeta = StageMetaFile["modules"][string];

export type LoadedContent = {
  roadmap: ParsedRoadmap;
  moduleMeta: Map<string, ModuleMeta>;
  topicMeta: Map<string, TopicMeta>;
  sections: Map<string, ContentSection[]>;
  challenges: Map<string, Challenge[]>;
  warnings: string[];
};

export function loadContent(contentDir: string): LoadedContent {
  const roadmap = parseRoadmap(readFileSync(path.join(contentDir, "ROADMAP_JAVA_BACKEND.md"), "utf8"));
  const topicsByKey = indexTopics(roadmap);
  const moduleKeys = new Set(roadmap.stages.flatMap((s) => s.modules.map((m) => m.key)));
  const warnings: string[] = [];

  const moduleMeta = new Map<string, ModuleMeta>();
  const topicMeta = new Map<string, TopicMeta>();
  const metaDir = path.join(contentDir, "meta");
  if (existsSync(metaDir)) {
    for (const file of readdirSync(metaDir).filter((f) => f.endsWith(".json")).sort()) {
      const parsed = StageMetaFileSchema.safeParse(JSON.parse(readFileSync(path.join(metaDir, file), "utf8")));
      if (!parsed.success) throw new Error(`content/meta/${file}: ${parsed.error.message}`);
      for (const [key, value] of Object.entries(parsed.data.modules)) {
        if (!moduleKeys.has(key)) throw new Error(`content/meta/${file}: módulo ${key} não existe no roadmap`);
        if (!key.startsWith(String(+parsed.data.stage) + "."))
          throw new Error(`content/meta/${file}: módulo ${key} não pertence à etapa ${parsed.data.stage}`);
        moduleMeta.set(key, value);
      }
      for (const [key, value] of Object.entries(parsed.data.topics)) {
        if (!topicsByKey.has(key)) throw new Error(`content/meta/${file}: tópico ${key} não existe no roadmap`);
        if (topicMeta.has(key)) throw new Error(`content/meta/${file}: tópico ${key} duplicado`);
        for (const p of value.prerequisites) {
          if (!topicsByKey.has(p.key)) throw new Error(`content/meta/${file}: ${key} depende de ${p.key}, inexistente`);
          if (p.key === key) throw new Error(`content/meta/${file}: ${key} depende de si mesmo`);
        }
        topicMeta.set(key, value);
      }
    }
  }

  const sections = new Map<string, ContentSection[]>();
  const challenges = new Map<string, Challenge[]>();
  const topicsDir = path.join(contentDir, "topics");
  if (existsSync(topicsDir)) {
    for (const key of readdirSync(topicsDir).sort()) {
      if (!topicsByKey.has(key)) throw new Error(`content/topics/${key}: tópico não existe no roadmap`);
      const contentFile = path.join(topicsDir, key, "content.md");
      const challengesFile = path.join(topicsDir, key, "challenges.md");
      if (existsSync(contentFile)) sections.set(key, parseContentMarkdown(readFileSync(contentFile, "utf8")));
      if (existsSync(challengesFile))
        challenges.set(key, parseChallengesMarkdown(readFileSync(challengesFile, "utf8"), key));
    }
  }

  assertAcyclic(topicMeta);

  for (const key of topicsByKey.keys()) {
    if (!topicMeta.has(key)) warnings.push(`Tópico ${key} sem metadados (objetivos/critérios)`);
  }
  for (const key of moduleKeys) {
    if (!moduleMeta.has(key)) warnings.push(`Módulo ${key} sem descrição complementar`);
  }

  return { roadmap, moduleMeta, topicMeta, sections, challenges, warnings };
}

/** Pré-requisitos não podem formar ciclos (senão a ordem recomendada é impossível). */
export function assertAcyclic(topicMeta: Map<string, TopicMeta>) {
  const state = new Map<string, 1 | 2>(); // 1 = visitando, 2 = concluído
  const visit = (key: string, trail: string[]) => {
    const s = state.get(key);
    if (s === 2) return;
    if (s === 1) throw new Error(`Ciclo de pré-requisitos: ${[...trail, key].join(" -> ")}`);
    state.set(key, 1);
    for (const p of topicMeta.get(key)?.prerequisites ?? []) visit(p.key, [...trail, key]);
    state.set(key, 2);
  };
  for (const key of topicMeta.keys()) visit(key, []);
}

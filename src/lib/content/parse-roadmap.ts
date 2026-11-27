/**
 * Parser do documento oficial `content/ROADMAP_JAVA_BACKEND.md`.
 *
 * O roadmap original é a fonte de verdade para etapas, descrições, módulos,
 * tópicos e a ordem entre eles. Este parser converte o Markdown em uma
 * estrutura tipada, sem perder nem reordenar nada. Conteúdos complementares
 * (descrições de módulo, objetivos, pré-requisitos, desafios) são aplicados
 * depois, a partir de outros arquivos em `content/`.
 *
 * Função pura: sem I/O, para poder ser testada isoladamente.
 */

export type ParsedTopic = {
  key: string; // "4.1.8"
  slug: string; // "4-1-8-garbage-collection"
  position: number; // 1-based, ordem original no módulo
  title: string;
};

export type ParsedModule = {
  key: string; // "4.1"
  slug: string; // "4-1-jvm"
  position: number;
  title: string;
  declaredTopicCount: number | null; // valor de "**N tópicos**"
  topics: ParsedTopic[];
};

export type ParsedStage = {
  key: string; // "04"
  slug: string; // "java-backend"
  position: number;
  title: string;
  description: string;
  modules: ParsedModule[];
};

export type ParsedRoadmap = {
  title: string;
  stages: ParsedStage[];
  declaredTotals: { stages: number; modules: number; topics: number } | null;
};

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/#/g, " sharp ")
    .replace(/@/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const STAGE_RE = /^##\s+(\d{2})\s+[—-]\s+(.+?)\s*$/;
const MODULE_RE = /^###\s+(\d+)\.(\d+)\s+(.+?)\s*$/;
const TOPIC_RE = /^(\d+)\.\s+(.+?)\s*$/;
const COUNT_RE = /^\*\*(\d+)\s+tópicos\*\*\s*$/;
const TOTALS_RE = /\*\*Total:\s*(\d+)\s+etapas,\s*(\d+)\s+módulos\s+e\s+(\d+)\s+tópicos\.\*\*/;

export function parseRoadmap(markdown: string): ParsedRoadmap {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const stages: ParsedStage[] = [];
  let title = "";
  let stage: ParsedStage | null = null;
  let mod: ParsedModule | null = null;
  let collectingDescription = false;
  const descriptionLines: string[] = [];
  let declaredTotals: ParsedRoadmap["declaredTotals"] = null;

  const flushDescription = () => {
    if (stage && collectingDescription) {
      stage.description = descriptionLines.join(" ").replace(/\s+/g, " ").trim();
    }
    collectingDescription = false;
    descriptionLines.length = 0;
  };

  for (const raw of lines) {
    const line = raw.trim();

    const totals = line.match(TOTALS_RE);
    if (totals) {
      declaredTotals = { stages: +totals[1], modules: +totals[2], topics: +totals[3] };
      continue;
    }

    if (line.startsWith("# ") && !title) {
      title = line.slice(2).trim();
      continue;
    }

    const stageMatch = line.match(STAGE_RE);
    if (stageMatch) {
      flushDescription();
      stage = {
        key: stageMatch[1],
        slug: slugify(stageMatch[2]),
        position: stages.length + 1,
        title: stageMatch[2].trim(),
        description: "",
        modules: [],
      };
      stages.push(stage);
      mod = null;
      collectingDescription = true;
      continue;
    }

    // Qualquer outro "## " encerra a área de etapas (ex.: "## Regras de utilização")
    if (line.startsWith("## ")) {
      flushDescription();
      stage = null;
      mod = null;
      continue;
    }

    const moduleMatch = line.match(MODULE_RE);
    if (moduleMatch && stage) {
      flushDescription();
      const key = `${moduleMatch[1]}.${moduleMatch[2]}`;
      mod = {
        key,
        slug: `${moduleMatch[1]}-${moduleMatch[2]}-${slugify(moduleMatch[3])}`,
        position: stage.modules.length + 1,
        title: moduleMatch[3].trim(),
        declaredTopicCount: null,
        topics: [],
      };
      stage.modules.push(mod);
      continue;
    }

    if (collectingDescription) {
      if (line === "" && descriptionLines.length === 0) continue;
      if (line === "") {
        flushDescription();
        continue;
      }
      descriptionLines.push(line);
      continue;
    }

    if (!mod) continue;

    const countMatch = line.match(COUNT_RE);
    if (countMatch) {
      mod.declaredTopicCount = +countMatch[1];
      continue;
    }

    const topicMatch = line.match(TOPIC_RE);
    if (topicMatch) {
      const position = mod.topics.length + 1;
      if (+topicMatch[1] !== position) {
        throw new Error(
          `Numeração fora de ordem no módulo ${mod.key}: esperado ${position}, encontrado ${topicMatch[1]} (${topicMatch[2]})`,
        );
      }
      const key = `${mod.key}.${position}`;
      mod.topics.push({
        key,
        slug: `${key.replace(/\./g, "-")}-${slugify(topicMatch[2])}`,
        position,
        title: topicMatch[2].trim(),
      });
    }
  }
  flushDescription();

  return { title, stages, declaredTotals };
}

export function countRoadmap(roadmap: ParsedRoadmap) {
  const modules = roadmap.stages.flatMap((s) => s.modules);
  return {
    stages: roadmap.stages.length,
    modules: modules.length,
    topics: modules.reduce((acc, m) => acc + m.topics.length, 0),
  };
}

/** Busca rápida de tópicos por chave ("4.1.8"). */
export function indexTopics(roadmap: ParsedRoadmap) {
  const map = new Map<string, ParsedTopic & { moduleKey: string; stageKey: string }>();
  for (const s of roadmap.stages)
    for (const m of s.modules)
      for (const t of m.topics) map.set(t.key, { ...t, moduleKey: m.key, stageKey: s.key });
  return map;
}

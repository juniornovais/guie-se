/**
 * Parsers dos arquivos de conteúdo de um tópico.
 *
 * content.md — seções separadas por "## ":
 *   ## Título                    -> seção
 *   ## Exemplo: Título           -> exemplo
 *   ## Diagrama: Título          -> diagrama
 *   ## [Adicional] Título        -> conteúdo complementar (fora do roadmap original)
 *
 * challenges.md — um desafio por "## Título", seguido de um bloco ```meta (JSON)
 * e subseções "### Enunciado | Objetivo | Instruções | Dicas |
 * Critérios de avaliação | Solução de referência".
 *
 * Cabeçalhos dentro de blocos de código são ignorados.
 */
import { ChallengeSchema, ContentSectionSchema, type Challenge, type ContentSection } from "./schemas";
import { slugify } from "./parse-roadmap";

type Block = { heading: string; body: string[] };

function splitByHeading(markdown: string, level: 2 | 3): { preamble: string[]; blocks: Block[] } {
  const prefix = "#".repeat(level) + " ";
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const preamble: string[] = [];
  const blocks: Block[] = [];
  let fence: string | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1];
      else if (line.trim().startsWith(fence)) fence = null;
    }
    if (fence === null && line.startsWith(prefix) && !fenceMatch) {
      blocks.push({ heading: line.slice(prefix.length).trim(), body: [] });
      continue;
    }
    (blocks.at(-1)?.body ?? preamble).push(line);
  }
  return { preamble, blocks };
}

const trimBody = (lines: string[]) => lines.join("\n").trim();

export function parseContentMarkdown(markdown: string): ContentSection[] {
  const { blocks } = splitByHeading(markdown, 2);
  const used = new Set<string>();
  return blocks.map((b) => {
    let heading = b.heading;
    let additional = false;
    let kind: ContentSection["kind"] = "section";
    if (/^\[adicional\]\s*/i.test(heading)) {
      additional = true;
      heading = heading.replace(/^\[adicional\]\s*/i, "");
    }
    if (/^exemplo:\s*/i.test(heading)) {
      kind = "example";
      heading = heading.replace(/^exemplo:\s*/i, "");
    } else if (/^diagrama:\s*/i.test(heading)) {
      kind = "diagram";
      heading = heading.replace(/^diagrama:\s*/i, "");
    }
    let key = slugify(heading) || "secao";
    for (let i = 2; used.has(key); i++) key = `${slugify(heading)}-${i}`;
    used.add(key);
    return ContentSectionSchema.parse({ key, title: heading, kind, additional, body: trimBody(b.body) });
  });
}

const SUBSECTIONS: Record<string, "statement" | "objective" | "instructions" | "hints" | "criteria" | "solution"> = {
  enunciado: "statement",
  objetivo: "objective",
  "instrucoes": "instructions",
  dicas: "hints",
  "criterios de avaliacao": "criteria",
  "solucao de referencia": "solution",
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function parseList(body: string): string[] {
  // Itens de lista de primeiro nível ("- " ou "1. "); linhas seguintes indentadas continuam o item.
  const items: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
    if (m) items.push(m[1]);
    else if (items.length && line.trim()) items[items.length - 1] += "\n" + line.replace(/^ {2,4}/, "");
  }
  return items.map((i) => i.trim()).filter(Boolean);
}

export function parseChallengesMarkdown(markdown: string, topicKey: string): Challenge[] {
  const { blocks } = splitByHeading(markdown, 2);
  return blocks.map((b, index) => {
    const raw = b.body.join("\n");
    const metaMatch = raw.match(/```meta\s*\n([\s\S]*?)\n```/);
    if (!metaMatch) throw new Error(`Desafio "${b.heading}" (${topicKey}) sem bloco \`\`\`meta`);
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(metaMatch[1]);
    } catch (e) {
      throw new Error(`Bloco meta inválido em "${b.heading}" (${topicKey}): ${(e as Error).message}`);
    }
    const rest = raw.replace(metaMatch[0], "");
    const { blocks: subs } = splitByHeading(rest, 3);
    const fields: Record<string, string | string[]> = {};
    for (const s of subs) {
      const field = SUBSECTIONS[normalize(s.heading)];
      if (!field) throw new Error(`Subseção desconhecida "### ${s.heading}" em "${b.heading}" (${topicKey})`);
      const body = trimBody(s.body);
      fields[field] = field === "hints" || field === "criteria" ? parseList(body) : body;
    }
    const result = ChallengeSchema.safeParse({
      key: `${topicKey}.c${index + 1}`,
      title: b.heading,
      type: meta.type,
      level: meta.level,
      required: meta.required ?? false,
      additional: meta.additional ?? false,
      knowledge: meta.knowledge ?? [],
      ...fields,
    });
    if (!result.success) {
      throw new Error(`Desafio inválido "${b.heading}" (${topicKey}): ${result.error.message}`);
    }
    return result.data;
  });
}

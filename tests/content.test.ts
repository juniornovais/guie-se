import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadContent } from "@/lib/content/load-content";
import { recommendedOrder } from "@/lib/domain/order";

const content = loadContent(path.resolve(__dirname, "../content"));
const allKeys = content.roadmap.stages.flatMap((s) => s.modules.flatMap((m) => m.topics.map((t) => t.key)));

describe("conteúdo aprofundado (content/topics)", () => {
  it("todo tópico com conteúdo tem seções suficientes, com exemplo e diagrama", () => {
    for (const [key, sections] of content.sections) {
      expect(sections.length, `${key}: poucas seções`).toBeGreaterThanOrEqual(5);
      expect(sections.some((s) => s.kind === "example"), `${key}: sem exemplo`).toBe(true);
      expect(sections.some((s) => s.kind === "diagram"), `${key}: sem diagrama`).toBe(true);
      for (const s of sections) expect(s.body.length, `${key}/${s.key}: seção vazia`).toBeGreaterThan(80);
    }
  });

  it("desafios cobrem os 4 níveis, têm obrigatórios e solução de referência", () => {
    for (const [key, challenges] of content.challenges) {
      expect(new Set(challenges.map((c) => c.level)).size, `${key}: níveis`).toBe(4);
      expect(challenges.filter((c) => c.required).length, `${key}: obrigatórios`).toBeGreaterThanOrEqual(1);
      for (const c of challenges) {
        expect(c.solution?.length ?? 0, `${c.key}: sem solução`).toBeGreaterThan(50);
        expect(c.hints.length, `${c.key}: sem dicas`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("desafios completos correspondem aos desafios planejados no inventário", () => {
    for (const [key, challenges] of content.challenges) {
      const planned = new Set(content.topicMeta.get(key)!.plannedChallenges.map((p) => p.title));
      for (const c of challenges) expect(planned.has(c.title), `${c.key} "${c.title}" não está no inventário`).toBe(true);
    }
  });

  it("todo tópico com desafios também tem conteúdo (e vice-versa)", () => {
    expect([...content.challenges.keys()].sort()).toEqual([...content.sections.keys()].sort());
  });
});

describe("inventário pedagógico (content/meta)", () => {
  it("cobre 100% dos módulos e tópicos, sem avisos", () => {
    expect(content.moduleMeta.size).toBe(24);
    expect(content.topicMeta.size).toBe(236);
    expect(content.warnings).toEqual([]);
  });

  it("todo tópico tem desafios planejados cobrindo os 4 níveis", () => {
    for (const [key, meta] of content.topicMeta) {
      const levels = new Set(meta.plannedChallenges.map((c) => c.level));
      expect([...levels].sort(), key).toEqual([1, 2, 3, 4]);
    }
  });

  it("ordem recomendada com dados reais: BD I (3.4) antes de BD II (3.2), sem perder tópicos", () => {
    const edges = [...content.topicMeta].flatMap(([key, m]) =>
      m.prerequisites.map((p) => ({ topicId: key, prerequisiteId: p.key })),
    );
    const order = recommendedOrder(
      allKeys.map((id, originalIndex) => ({ id, originalIndex })),
      edges,
    );
    expect(order).toHaveLength(236);
    expect(new Set(order).size).toBe(236);
    expect(order.indexOf("3.4.2")).toBeLessThan(order.indexOf("3.2.1"));
    // Todo pré-requisito vem antes do tópico que depende dele
    for (const e of edges) expect(order.indexOf(e.prerequisiteId), `${e.topicId}<-${e.prerequisiteId}`).toBeLessThan(order.indexOf(e.topicId));
    // Etapas continuam em sequência (nenhum tópico de etapa posterior antecipado)
    const stageOf = (k: string) => +k[0];
    for (let i = 1; i < order.length; i++) expect(stageOf(order[i])).toBeGreaterThanOrEqual(stageOf(order[i - 1]));
  });
});

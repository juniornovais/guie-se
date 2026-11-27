import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { countRoadmap, indexTopics, parseRoadmap, slugify } from "@/lib/content/parse-roadmap";

const md = readFileSync(path.resolve(__dirname, "../content/ROADMAP_JAVA_BACKEND.md"), "utf8");
const roadmap = parseRoadmap(md);

describe("parseRoadmap — conferência contra o documento oficial", () => {
  it("preserva as seis etapas na ordem original, com descrição", () => {
    expect(roadmap.stages.map((s) => `${s.key} ${s.title}`)).toEqual([
      "01 Fundamentos",
      "02 LeetCode",
      "03 Backend",
      "04 Java Backend",
      "05 Sistemas Distribuídos",
      "06 System Design",
    ]);
    for (const s of roadmap.stages) expect(s.description.length).toBeGreaterThan(100);
    expect(roadmap.stages[0].description).toMatch(/^Como o computador executa um programa/);
    expect(roadmap.stages[0].description).toMatch(/comportamento da JVM\.$/);
  });

  it("contém 24 módulos e 236 tópicos (o rodapé declara 23/223, valor incorreto)", () => {
    expect(countRoadmap(roadmap)).toEqual({ stages: 6, modules: 24, topics: 236 });
    expect(roadmap.declaredTotals).toEqual({ stages: 6, modules: 23, topics: 223 });
  });

  it("cada módulo tem exatamente a quantidade de tópicos declarada em '**N tópicos**'", () => {
    for (const m of roadmap.stages.flatMap((s) => s.modules)) {
      expect(m.declaredTopicCount, m.key).not.toBeNull();
      expect(m.topics.length, m.key).toBe(m.declaredTopicCount);
    }
  });

  it("preserva a ordem original dos módulos (inclusive 3.2 antes de 3.4)", () => {
    const backend = roadmap.stages[2].modules.map((m) => m.key);
    expect(backend).toEqual(["3.1", "3.2", "3.3", "3.4", "3.5"]);
  });

  it("não ignora as regras de utilização como se fossem tópicos", () => {
    const last = roadmap.stages[5].modules.at(-1)!;
    expect(last.key).toBe("6.4");
    expect(last.topics.at(-1)!.title).toBe("Evoluir arquitetura conforme a escala");
    expect(last.topics).toHaveLength(8);
  });

  it("mantém tópicos repetidos como unidades distintas, com chaves e slugs únicos", () => {
    const all = roadmap.stages.flatMap((s) => s.modules.flatMap((m) => m.topics));
    expect(new Set(all.map((t) => t.key)).size).toBe(236);
    expect(new Set(all.map((t) => t.slug)).size).toBe(236);
    expect(all.filter((t) => t.title === "Replication")).toHaveLength(3);
    expect(all.filter((t) => t.title === "Idempotência")).toHaveLength(2);
  });

  it("indexa tópicos por chave", () => {
    const gc = indexTopics(roadmap).get("4.1.8")!;
    expect(gc.title).toBe("Garbage Collection");
    expect(gc.slug).toBe("4-1-8-garbage-collection");
    expect(gc.moduleKey).toBe("4.1");
  });
});

describe("slugify", () => {
  it("remove acentos e símbolos", () => {
    expect(slugify("Sistemas Distribuídos")).toBe("sistemas-distribuidos");
    expect(slugify("Heap / Priority Queue")).toBe("heap-priority-queue");
    expect(slugify("@Transactional")).toBe("transactional");
    expect(slugify("SLI / SLO")).toBe("sli-slo");
  });
});

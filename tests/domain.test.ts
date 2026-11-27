import { describe, expect, it } from "vitest";
import { parseUserSettings } from "@/lib/content/schemas";
import { computeAchievements } from "@/lib/domain/achievements";
import { nextRecommended, recommendedOrder } from "@/lib/domain/order";
import { computeStreak, toLocalDay } from "@/lib/domain/streak";
import { safeNextPath } from "@/lib/auth/redirect";

describe("parseUserSettings", () => {
  it("usa o fuso padrão e ignora chaves antigas de critérios de conclusão", () => {
    expect(parseUserSettings({ requireContentRead: true, minSelfAssessment: 3 })).toEqual({ timezone: "America/Sao_Paulo" });
    expect(parseUserSettings({ timezone: "Europe/Lisbon" })).toEqual({ timezone: "Europe/Lisbon" });
  });
  it("não quebra com valores inválidos", () => {
    expect(parseUserSettings(null).timezone).toBe("America/Sao_Paulo");
    expect(parseUserSettings({ timezone: 42 }).timezone).toBe("America/Sao_Paulo");
  });
});

describe("computeAchievements", () => {
  const base = { topicsCompleted: 0, topicsReviewed: 0, modulesCompleted: [], stagesCompleted: [], longestStreak: 0, totalStudySeconds: 0, notesCount: 0 };
  it("nada desbloqueado no início, com progresso informado", () => {
    const a = computeAchievements(base);
    expect(a.every((x) => !x.unlocked)).toBe(true);
    expect(a.find((x) => x.id === "streak-7")?.progress).toEqual({ value: 0, target: 7 });
  });
  it("desbloqueia por marcos reais e adiciona conquista por etapa concluída", () => {
    const a = computeAchievements({ ...base, topicsCompleted: 18, longestStreak: 8, stagesCompleted: [{ key: "01", title: "Fundamentos" }] });
    const ok = new Set(a.filter((x) => x.unlocked).map((x) => x.id));
    expect(ok).toEqual(new Set(["first-topic", "first-stage", "streak-7", "stage-01"]));
  });
});

describe("recommendedOrder", () => {
  // Ordem original: 3.1, 3.2(transações) , 3.4(SQL). 3.2 depende de 3.4.
  const topics = [
    { id: "3.1.1", originalIndex: 0 },
    { id: "3.2.1", originalIndex: 1 },
    { id: "3.2.2", originalIndex: 2 },
    { id: "3.4.1", originalIndex: 3 },
    { id: "3.4.2", originalIndex: 4 },
  ];

  it("mantém a ordem original quando não há conflito", () => {
    expect(recommendedOrder(topics, [])).toEqual(topics.map((t) => t.id));
  });

  it("antecipa pré-requisitos que vêm depois na ordem original (BD I antes de BD II)", () => {
    const order = recommendedOrder(topics, [{ topicId: "3.2.1", prerequisiteId: "3.4.2" }]);
    expect(order).toEqual(["3.1.1", "3.4.2", "3.2.1", "3.2.2", "3.4.1"]);
    expect(order.indexOf("3.4.2")).toBeLessThan(order.indexOf("3.2.1"));
  });

  it("não entra em loop com ciclos e inclui todos os tópicos", () => {
    const order = recommendedOrder(topics, [
      { topicId: "3.2.1", prerequisiteId: "3.4.1" },
      { topicId: "3.4.1", prerequisiteId: "3.2.1" },
    ]);
    expect(new Set(order).size).toBe(topics.length);
  });

  it("nextRecommended devolve o primeiro não concluído", () => {
    const status = new Map([["a", "completed"], ["b", "in_progress"]]);
    expect(nextRecommended(["a", "b", "c"], status)).toBe("b");
    expect(nextRecommended(["a"], status)).toBeNull();
  });
});

describe("computeStreak", () => {
  const tz = "America/Sao_Paulo";
  const now = new Date("2026-11-26T15:00:00Z"); // 12h em São Paulo

  it("conta dias consecutivos até hoje", () => {
    const r = computeStreak(["2026-11-26T12:00:00Z", "2026-11-25T12:00:00Z", "2026-11-24T12:00:00Z"], tz, now);
    expect(r).toMatchObject({ current: 3, longest: 3, studiedToday: true });
  });

  it("sequência continua viva se o último estudo foi ontem", () => {
    const r = computeStreak(["2026-11-25T12:00:00Z", "2026-11-24T12:00:00Z"], tz, now);
    expect(r.current).toBe(2);
    expect(r.studiedToday).toBe(false);
  });

  it("zera após um dia sem estudo e mantém o recorde", () => {
    const r = computeStreak(
      ["2026-11-20T12:00:00Z", "2026-11-19T12:00:00Z", "2026-11-18T12:00:00Z", "2026-11-23T12:00:00Z"],
      tz,
      now,
    );
    expect(r.current).toBe(0);
    expect(r.longest).toBe(3);
  });

  it("usa o fuso do usuário (01h UTC ainda é o dia anterior em São Paulo)", () => {
    expect(toLocalDay("2026-11-26T01:00:00Z", tz)).toBe("2026-11-25");
  });
});

describe("safeNextPath (proteção contra open redirect)", () => {
  it.each([
    ["/roadmap", "/roadmap"],
    ["/estudo/4-1-8?x=1", "/estudo/4-1-8?x=1"],
    ["https://evil.com", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["/login", "/"],
    [null, "/"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

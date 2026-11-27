/**
 * Conquistas (puras): marcos objetivos da jornada, derivados do progresso real.
 * Nada de pontos arbitrários — cada conquista corresponde a algo verificável.
 */
export type AchievementInput = {
  topicsCompleted: number;
  topicsReviewed: number;
  modulesCompleted: { key: string; title: string }[];
  stagesCompleted: { key: string; title: string }[];
  longestStreak: number;
  totalStudySeconds: number;
  notesCount: number;
};

export type Achievement = { id: string; title: string; description: string; unlocked: boolean; progress?: { value: number; target: number } };

const tier = (id: string, title: string, description: string, value: number, target: number): Achievement => ({
  id,
  title,
  description,
  unlocked: value >= target,
  progress: { value: Math.min(value, target), target },
});

export function computeAchievements(i: AchievementInput): Achievement[] {
  const list: Achievement[] = [
    tier("first-topic", "Primeira estação", "Concluir o primeiro tópico.", i.topicsCompleted, 1),
    tier("topics-25", "25 estações", "Concluir 25 tópicos.", i.topicsCompleted, 25),
    tier("topics-100", "100 estações", "Concluir 100 tópicos.", i.topicsCompleted, 100),
    tier("topics-all", "Linha completa", "Concluir os 236 tópicos do roadmap.", i.topicsCompleted, 236),
    tier("first-module", "Módulo fechado", "Concluir todos os tópicos de um módulo.", i.modulesCompleted.length, 1),
    tier("first-stage", "Etapa concluída", "Concluir uma etapa inteira.", i.stagesCompleted.length, 1),
    tier("streak-7", "Uma semana seguida", "Estudar 7 dias consecutivos.", i.longestStreak, 7),
    tier("streak-30", "Um mês seguido", "Estudar 30 dias consecutivos.", i.longestStreak, 30),
    tier("hours-10", "10 horas", "Acumular 10 horas de estudo registradas.", Math.floor(i.totalStudySeconds / 3600), 10),
    tier("hours-100", "100 horas", "Acumular 100 horas de estudo registradas.", Math.floor(i.totalStudySeconds / 3600), 100),
    tier("reviewer", "Revisão espaçada", "Revisar 10 tópicos já concluídos.", i.topicsReviewed, 10),
    tier("notes-20", "Caderno de bordo", "Escrever 20 anotações.", i.notesCount, 20),
  ];
  for (const s of i.stagesCompleted)
    list.push({ id: `stage-${s.key}`, title: `Linha ${s.key} concluída`, description: s.title, unlocked: true });
  return list;
}

/** Soma de duração por semana (segunda-feira como início), últimas N semanas. */
export function weeklyTotals(sessions: { started_at: string; duration_seconds: number }[], weeks: number, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (start.getUTCDay() + 6) % 7; // 0 = segunda
  start.setUTCDate(start.getUTCDate() - dow - (weeks - 1) * 7);
  const buckets = Array.from({ length: weeks }, (_, k) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + k * 7);
    return { weekStart: d.toISOString().slice(0, 10), seconds: 0 };
  });
  for (const s of sessions) {
    const idx = Math.floor((new Date(s.started_at).getTime() - start.getTime()) / (7 * 86400_000));
    if (idx >= 0 && idx < weeks) buckets[idx].seconds += s.duration_seconds;
  }
  return buckets;
}

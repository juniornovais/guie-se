export const LEVEL_LABEL: Record<number, string> = {
  1: "Entendimento",
  2: "Aplicação",
  3: "Aprofundamento",
  4: "Construção",
};

export const CHALLENGE_TYPE_LABEL: Record<string, string> = {
  conceptual: "Questão conceitual",
  interview: "Pergunta de entrevista",
  coding: "Exercício de programação",
  code_analysis: "Análise de código",
  bug_hunt: "Identificação de bugs",
  experiment: "Experimento prático",
  implementation: "Implementação pequena",
  project: "Projeto progressivo",
};


/** Percentual para exibição: nunca mostra 0% quando já existe progresso. */
export function formatPercent(done: number, total: number) {
  if (!total || !done) return "0";
  const p = (done / total) * 100;
  if (p < 1) return "<1";
  if (p < 10) return p.toFixed(1).replace(".", ",");
  return String(Math.round(p));
}

export function formatMinutes(min: number | null | undefined) {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatDuration(seconds: number) {
  const min = Math.round(seconds / 60);
  return formatMinutes(min) ?? "0 min";
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
export function relativeTime(iso: string, now = Date.now()) {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "agora";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

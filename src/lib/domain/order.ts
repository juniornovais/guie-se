/**
 * Ordem pedagógica recomendada (pura).
 *
 * Parte da ordem original do roadmap e aplica uma ordenação topológica ESTÁVEL
 * sobre os pré-requisitos: um tópico só é antecipado quando algum pré-requisito
 * vem depois dele na ordem original (ex.: 3.4 SQL antes de 3.2 Transações).
 * Não bloqueia nada — é apenas recomendação.
 */
export type OrderTopic = { id: string; originalIndex: number };
export type Edge = { topicId: string; prerequisiteId: string };

export function recommendedOrder(topics: OrderTopic[], edges: Edge[]): string[] {
  const byIndex = [...topics].sort((a, b) => a.originalIndex - b.originalIndex);
  const prereqs = new Map<string, string[]>();
  for (const e of edges) {
    if (!prereqs.has(e.topicId)) prereqs.set(e.topicId, []);
    prereqs.get(e.topicId)!.push(e.prerequisiteId);
  }
  const known = new Set(topics.map((t) => t.id));
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];

  const place = (id: string) => {
    if (placed.has(id) || visiting.has(id) || !known.has(id)) return; // ciclo: ignora a aresta
    visiting.add(id);
    const deps = (prereqs.get(id) ?? [])
      .filter((d) => known.has(d))
      .sort((a, b) => indexOf(a) - indexOf(b));
    for (const d of deps) place(d);
    visiting.delete(id);
    placed.add(id);
    result.push(id);
  };
  const idx = new Map(byIndex.map((t) => [t.id, t.originalIndex]));
  const indexOf = (id: string) => idx.get(id) ?? Number.MAX_SAFE_INTEGER;

  for (const t of byIndex) place(t.id);
  return result;
}

/**
 * Próximo tópico recomendado: o primeiro na ordem pedagógica que não está
 * concluído. Prefere um tópico em andamento se ele vier antes.
 */
export function nextRecommended(order: string[], status: Map<string, string>): string | null {
  for (const id of order) if (status.get(id) !== "completed") return id;
  return null;
}

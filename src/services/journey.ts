/**
 * Visão consolidada da jornada do usuário: roadmap + progresso + recomendações.
 * Usada por Início, Roadmap, Módulo e Evolução.
 */
import "server-only";
import { cache } from "react";
import { requireSession } from "@/lib/auth/dal";
import { parseUserSettings } from "@/lib/content/schemas";
import { nextRecommended } from "@/lib/domain/order";
import { getRoadmapTree, type ModuleNode, type StageNode, type TopicNode } from "./content";
import { getAllTopicProgress, getProfile, type TopicProgressRow } from "./progress";

export type TopicStatus = "not_started" | "in_progress" | "completed";

export type Stats = { total: number; completed: number; inProgress: number; percent: number };

function stats(topics: TopicNode[], progress: Map<string, TopicProgressRow>): Stats {
  let completed = 0;
  let inProgress = 0;
  for (const t of topics) {
    const s = progress.get(t.id)?.status;
    if (s === "completed") completed++;
    else if (s === "in_progress") inProgress++;
  }
  return {
    total: topics.length,
    completed,
    inProgress,
    percent: topics.length ? Math.round((completed / topics.length) * 100) : 0,
  };
}

export const getJourney = cache(async () => {
  const { user, supabase } = await requireSession();
  const [tree, topicProgress, profile] = await Promise.all([
    getRoadmapTree(),
    getAllTopicProgress(supabase),
    getProfile(supabase),
  ]);

  const statusOf = (topicId: string): TopicStatus => topicProgress.get(topicId)?.status ?? "not_started";
  const allTopics = [...tree.topics.values()];

  const stageStats = new Map<string, Stats>();
  const moduleStats = new Map<string, Stats>();
  for (const s of tree.stages) {
    stageStats.set(s.id, stats(s.modules.flatMap((m) => m.topics), topicProgress));
    for (const m of s.modules) moduleStats.set(m.id, stats(m.topics, topicProgress));
  }
  const overall = stats(allTopics, topicProgress);

  const statusMap = new Map([...topicProgress].map(([id, p]) => [id, p.status]));
  const nextId = nextRecommended(tree.order, statusMap);
  const lastTopic = profile?.last_topic_id ? tree.topics.get(profile.last_topic_id) ?? null : null;

  // Ponto atual da jornada: último tópico acessado se ainda não concluído; senão a próxima recomendação.
  const currentId = lastTopic && statusOf(lastTopic.id) !== "completed" ? lastTopic.id : nextId;
  const current = currentId ? tree.topics.get(currentId)! : null;
  const currentModule = current ? tree.modules.get(current.moduleId)! : null;
  const currentStage = currentModule ? tree.stages.find((s) => s.id === currentModule.stageId)! : null;

  /** Próximo recomendado diferente do atual (para "depois deste"). */
  const upcoming = tree.order.filter((id) => statusOf(id) !== "completed" && id !== currentId).slice(0, 4).map((id) => tree.topics.get(id)!);

  return {
    user,
    profile,
    settings: parseUserSettings(profile?.settings),
    tree,
    topicProgress,
    statusOf,
    stageStats,
    moduleStats,
    overall,
    lastTopic,
    current,
    currentModule,
    currentStage,
    next: nextId ? tree.topics.get(nextId)! : null,
    upcoming,
  };
});

export type Journey = Awaited<ReturnType<typeof getJourney>>;

export function stageOfModule(tree: Journey["tree"], m: ModuleNode): StageNode {
  return tree.stages.find((s) => s.id === m.stageId)!;
}

export function moduleNext(m: ModuleNode, j: Journey): TopicNode | null {
  const ordered = j.tree.order.filter((id) => m.topics.some((t) => t.id === id));
  const id = ordered.find((x) => j.statusOf(x) !== "completed");
  return id ? j.tree.topics.get(id)! : null;
}

export type { TopicProgressRow };

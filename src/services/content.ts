/**
 * Repositório de CONTEÚDO (somente leitura, compartilhado entre usuários).
 * As consultas usam o cliente do usuário; a RLS libera leitura a autenticados.
 */
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { recommendedOrder } from "@/lib/domain/order";

export type PlannedChallenge = { level: 1 | 2 | 3 | 4; type: string; title: string };

export type TopicNode = {
  id: string;
  key: string;
  slug: string;
  title: string;
  position: number;
  summary: string | null;
  estimatedMinutes: number | null;
  contentStatus: "planned" | "draft" | "ready";
  plannedChallengeCount: number;
  moduleId: string;
};
export type ModuleNode = {
  id: string;
  key: string;
  slug: string;
  title: string;
  description: string | null;
  objectives: string[];
  position: number;
  stageId: string;
  topics: TopicNode[];
};
export type StageNode = {
  id: string;
  key: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  modules: ModuleNode[];
};
export type PrereqEdge = { topicId: string; prerequisiteId: string; kind: "required" | "recommended"; reason: string | null };

export type RoadmapTree = {
  stages: StageNode[];
  edges: PrereqEdge[];
  topics: Map<string, TopicNode & { moduleKey: string; stageKey: string }>;
  modules: Map<string, ModuleNode>;
  /** Ordem pedagógica recomendada (ids). */
  order: string[];
  /** Ordem original (ids). */
  originalOrder: string[];
};

/** Árvore completa do roadmap. Memoizada por requisição. */
export const getRoadmapTree = cache(async (): Promise<RoadmapTree> => {
  const supabase = await createClient();
  const [stagesRes, modulesRes, topicsRes, edgesRes] = await Promise.all([
    supabase.from("stages").select("id, key, slug, title, description, position").order("position"),
    supabase.from("modules").select("id, key, slug, title, description, objectives, position, stage_id").order("position"),
    supabase
      .from("topics")
      .select("id, key, slug, title, position, summary, estimated_minutes, content_status, planned_challenges, module_id")
      .order("position"),
    supabase.from("topic_prerequisites").select("topic_id, prerequisite_id, kind, reason"),
  ]);
  for (const r of [stagesRes, modulesRes, topicsRes, edgesRes]) if (r.error) throw r.error;

  const modulesByStage = new Map<string, ModuleNode[]>();
  const modules = new Map<string, ModuleNode>();
  for (const m of modulesRes.data!) {
    const node: ModuleNode = {
      id: m.id,
      key: m.key,
      slug: m.slug,
      title: m.title,
      description: m.description,
      objectives: m.objectives,
      position: m.position,
      stageId: m.stage_id,
      topics: [],
    };
    modules.set(m.id, node);
    if (!modulesByStage.has(m.stage_id)) modulesByStage.set(m.stage_id, []);
    modulesByStage.get(m.stage_id)!.push(node);
  }
  for (const t of topicsRes.data!) {
    modules.get(t.module_id)?.topics.push({
      id: t.id,
      key: t.key,
      slug: t.slug,
      title: t.title,
      position: t.position,
      summary: t.summary,
      estimatedMinutes: t.estimated_minutes,
      contentStatus: t.content_status,
      plannedChallengeCount: Array.isArray(t.planned_challenges) ? t.planned_challenges.length : 0,
      moduleId: t.module_id,
    });
  }

  const stages: StageNode[] = stagesRes.data!.map((s) => ({
    ...s,
    modules: (modulesByStage.get(s.id) ?? []).sort((a, b) => a.position - b.position),
  }));

  const topics: RoadmapTree["topics"] = new Map();
  const originalOrder: string[] = [];
  for (const s of stages)
    for (const m of s.modules) {
      m.topics.sort((a, b) => a.position - b.position);
      for (const t of m.topics) {
        topics.set(t.id, { ...t, moduleKey: m.key, stageKey: s.key });
        originalOrder.push(t.id);
      }
    }

  const edges: PrereqEdge[] = edgesRes.data!.map((e) => ({
    topicId: e.topic_id,
    prerequisiteId: e.prerequisite_id,
    kind: e.kind,
    reason: e.reason,
  }));
  const order = recommendedOrder(
    originalOrder.map((id, originalIndex) => ({ id, originalIndex })),
    edges,
  );

  return { stages, edges, topics, modules, order, originalOrder };
});

export async function getModuleBySlug(slug: string) {
  const tree = await getRoadmapTree();
  for (const s of tree.stages) {
    const m = s.modules.find((x) => x.slug === slug);
    if (m) return { tree, stage: s, module: m };
  }
  return null;
}

export async function getTopicBySlug(slug: string) {
  const tree = await getRoadmapTree();
  const topic = [...tree.topics.values()].find((t) => t.slug === slug);
  if (!topic) return null;
  const supabase = await createClient();
  const [full, sections] = await Promise.all([
    supabase
      .from("topics")
      .select("objectives, planned_challenges")
      .eq("id", topic.id)
      .single(),
    supabase
      .from("learning_contents")
      .select("id, key, title, kind, body_md, is_additional, position")
      .eq("topic_id", topic.id)
      .order("position"),
  ]);
  if (full.error) throw full.error;
  if (sections.error) throw sections.error;

  const mod = tree.modules.get(topic.moduleId)!;
  const stage = tree.stages.find((s) => s.id === mod.stageId)!;
  const idx = tree.originalOrder.indexOf(topic.id);
  const prev = idx > 0 ? tree.topics.get(tree.originalOrder[idx - 1])! : null;
  const next = idx < tree.originalOrder.length - 1 ? tree.topics.get(tree.originalOrder[idx + 1])! : null;

  return {
    tree,
    stage,
    module: mod,
    topic,
    objectives: full.data.objectives,
    plannedChallenges: (full.data.planned_challenges ?? []) as PlannedChallenge[],
    sections: sections.data,
    prerequisites: tree.edges
      .filter((e) => e.topicId === topic.id)
      .map((e) => ({ ...e, topic: tree.topics.get(e.prerequisiteId)! })),
    unlocks: tree.edges
      .filter((e) => e.prerequisiteId === topic.id)
      .map((e) => ({ ...e, topic: tree.topics.get(e.topicId)! })),
    prev,
    next,
  };
}

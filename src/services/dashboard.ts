import "server-only";
import { requireSession } from "@/lib/auth/dal";
import { listRecentActivity } from "./progress";
import { getJourney } from "./journey";

export type ActivityItem = {
  kind: string;
  occurredAt: string;
  topic: { slug: string; title: string; key: string; stageKey: string } | null;
};

export async function getRecentActivity(limit = 8): Promise<ActivityItem[]> {
  const j = await getJourney();
  const { supabase } = await requireSession();
  const rows = await listRecentActivity(supabase, limit);
  return rows
    .filter((r) => r.occurred_at)
    .map((r) => {
      const t = r.topic_id ? j.tree.topics.get(r.topic_id) : undefined;
      return {
        kind: r.kind!,
        occurredAt: r.occurred_at!,
        topic: t ? { slug: t.slug, title: t.title, key: t.key, stageKey: t.stageKey } : null,
      };
    });
}

export const ACTIVITY_LABEL: Record<string, string> = {
  topic_started: "Começou",
  topic_completed: "Concluiu",
  topic_reviewed: "Revisou",
  challenge_solved: "Resolveu um desafio de",
  challenge_attempted: "Registrou tentativa em",
  note_added: "Anotou em",
};

/**
 * Repositório de PROGRESSO do usuário.
 * Toda função recebe o cliente da requisição (JWT do usuário): a RLS garante que
 * só as linhas do próprio usuário são lidas/escritas. `userId` é passado
 * explicitamente nas escritas para satisfazer o WITH CHECK das policies.
 */
import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export type TopicProgressRow = {
  topic_id: string;
  status: "not_started" | "in_progress" | "completed";
  content_read_at: string | null;
  self_assessment: number | null;
  checklist_done: string[];
  started_at: string;
  completed_at: string | null;
  reviewed_at: string | null;
  review_count: number;
  last_accessed_at: string;
};

const TOPIC_COLS =
  "topic_id, status, content_read_at, self_assessment, checklist_done, started_at, completed_at, reviewed_at, review_count, last_accessed_at";

export async function getAllTopicProgress(supabase: ServerSupabase) {
  const { data, error } = await supabase.from("user_topic_progress").select(TOPIC_COLS);
  if (error) throw error;
  return new Map((data as TopicProgressRow[]).map((r) => [r.topic_id, r]));
}

export async function getTopicProgress(supabase: ServerSupabase, topicId: string) {
  const { data, error } = await supabase.from("user_topic_progress").select(TOPIC_COLS).eq("topic_id", topicId).maybeSingle();
  if (error) throw error;
  return data as TopicProgressRow | null;
}

export async function getProfile(supabase: ServerSupabase) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, last_topic_id, last_topic_at, settings, created_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Registra acesso ao tópico: cria o progresso como "em andamento" (se ainda não
 * existir), atualiza o último acesso e o "último tópico estudado" do perfil.
 * Não rebaixa um tópico concluído.
 */
export async function touchTopic(supabase: ServerSupabase, userId: string, topicId: string) {
  const now = new Date().toISOString();
  const existing = await getTopicProgress(supabase, topicId);
  if (existing) {
    const { error } = await supabase
      .from("user_topic_progress")
      .update({ last_accessed_at: now })
      .eq("user_id", userId)
      .eq("topic_id", topicId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("user_topic_progress")
      .upsert(
        { user_id: userId, topic_id: topicId, status: "in_progress", started_at: now, last_accessed_at: now },
        { onConflict: "user_id,topic_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }
  const { error: pErr } = await supabase
    .from("profiles")
    .update({ last_topic_id: topicId, last_topic_at: now })
    .eq("id", userId);
  if (pErr) throw pErr;
}

/** Garante a linha de progresso e aplica um patch. */
export async function patchTopicProgress(
  supabase: ServerSupabase,
  userId: string,
  topicId: string,
  patch: Partial<Omit<TopicProgressRow, "topic_id">>,
) {
  const { data, error } = await supabase
    .from("user_topic_progress")
    .upsert({ user_id: userId, topic_id: topicId, ...patch }, { onConflict: "user_id,topic_id" })
    .select(TOPIC_COLS)
    .single();
  if (error) throw error;
  return data as TopicProgressRow;
}

export async function listNotes(supabase: ServerSupabase, topicId: string) {
  const { data, error } = await supabase
    .from("user_notes")
    .select("id, body, created_at, updated_at")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listRecentActivity(supabase: ServerSupabase, limit = 12) {
  const { data, error } = await supabase
    .from("user_activity")
    .select("kind, topic_id, challenge_id, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** Timestamps de toda atividade (para sequência de dias e histórico). */
export async function listActivityTimestamps(supabase: ServerSupabase, sinceIso: string) {
  const [act, sessions] = await Promise.all([
    supabase.from("user_activity").select("occurred_at, kind").gte("occurred_at", sinceIso),
    supabase
      .from("study_sessions")
      .select("started_at, duration_seconds, topic_id, source")
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: false }),
  ]);
  if (act.error) throw act.error;
  if (sessions.error) throw sessions.error;
  return { activity: act.data, sessions: sessions.data };
}

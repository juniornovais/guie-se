"use server";

/**
 * Server Actions de progresso de estudo.
 * Cada action: (1) autentica no servidor, (2) valida a entrada com Zod,
 * (3) escreve via cliente do usuário (RLS), (4) atualiza a UI com refresh().
 */
import { refresh } from "next/cache";
import { requireSession } from "@/lib/auth/dal";
import { HeartbeatInput, ManualSessionInput, SettingsInput, TopicIdInput } from "@/lib/validations/progress";
import { getTopicProgress, patchTopicProgress, touchTopic } from "@/services/progress";
import { InputError, parseInput, runAction } from "./result";

/** Chamado ao abrir a página de estudo (client effect, não durante o render/prefetch). */
export async function recordTopicVisit(input: { topicId: string }) {
  return runAction(async () => {
    const { topicId } = parseInput(TopicIdInput, input);
    const { user, supabase } = await requireSession();
    await touchTopic(supabase, user.id, topicId);
  });
}

/** Conclui o tópico com um clique. */
export async function completeTopic(input: { topicId: string }) {
  return runAction(async () => {
    const { topicId } = parseInput(TopicIdInput, input);
    const { user, supabase } = await requireSession();
    const current = await getTopicProgress(supabase, topicId);
    await patchTopicProgress(supabase, user.id, topicId, {
      status: "completed",
      completed_at: current?.completed_at ?? new Date().toISOString(),
    });
    refresh();
  });
}

/** Reabre um tópico concluído (volta para "em andamento"). */
export async function reopenTopic(input: { topicId: string }) {
  return runAction(async () => {
    const { topicId } = parseInput(TopicIdInput, input);
    const { user, supabase } = await requireSession();
    await patchTopicProgress(supabase, user.id, topicId, { status: "in_progress", completed_at: null });
    refresh();
  });
}

/** Marca uma revisão posterior de um tópico concluído. */
export async function markTopicReviewed(input: { topicId: string }) {
  return runAction(async () => {
    const { topicId } = parseInput(TopicIdInput, input);
    const { user, supabase } = await requireSession();
    const current = await getTopicProgress(supabase, topicId);
    if (current?.status !== "completed") throw new InputError("Só é possível revisar um tópico concluído.");
    await patchTopicProgress(supabase, user.id, topicId, {
      reviewed_at: new Date().toISOString(),
      review_count: (current.review_count ?? 0) + 1,
    });
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Sessões de estudo (tempo de estudo e sequência de dias)
// ---------------------------------------------------------------------------

export async function startStudySession(input: { topicId: string }) {
  return runAction(async () => {
    const { topicId } = parseInput(TopicIdInput, input);
    const { user, supabase } = await requireSession();
    const { data, error } = await supabase
      .from("study_sessions")
      .insert({ user_id: user.id, topic_id: topicId, source: "auto" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  });
}

/** Atualiza a duração de uma sessão automática (heartbeat do cliente). */
export async function heartbeatStudySession(input: { sessionId: string; durationSeconds: number }) {
  return runAction(async () => {
    const { sessionId, durationSeconds } = parseInput(HeartbeatInput, input);
    const { supabase } = await requireSession();
    const { error } = await supabase
      .from("study_sessions")
      .update({ duration_seconds: durationSeconds, ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("source", "auto");
    if (error) throw error;
  });
}

export async function addManualStudySession(input: { topicId?: string; minutes: number; date: string }) {
  return runAction(async () => {
    const { topicId, minutes, date } = parseInput(ManualSessionInput, input);
    const { user, supabase } = await requireSession();
    const startedAt = new Date(`${date}T12:00:00Z`).toISOString();
    const { error } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      topic_id: topicId ?? null,
      started_at: startedAt,
      ended_at: startedAt,
      duration_seconds: minutes * 60,
      source: "manual",
    });
    if (error) throw error;
    refresh();
  });
}

export async function updateSettings(input: unknown) {
  return runAction(async () => {
    const settings = parseInput(SettingsInput, input);
    const { user, supabase } = await requireSession();
    const { error } = await supabase.from("profiles").update({ settings }).eq("id", user.id);
    if (error) throw error;
    refresh();
  });
}

import "server-only";
import { requireSession } from "@/lib/auth/dal";
import { computeAchievements, weeklyTotals } from "@/lib/domain/achievements";
import { computeStreak, toLocalDay } from "@/lib/domain/streak";
import { listActivityTimestamps } from "./progress";
import { getJourney } from "./journey";

const DAY = 86400_000;

export async function getEvolution() {
  const j = await getJourney();
  const { supabase } = await requireSession();
  const tz = j.settings.timezone;
  const since = new Date(Date.now() - 400 * DAY).toISOString();

  const [{ activity, sessions }, notesCount] = await Promise.all([
    listActivityTimestamps(supabase, since),
    supabase.from("user_notes").select("id", { count: "exact", head: true }),
  ]);

  const stamps = [
    ...activity.map((a) => a.occurred_at!).filter(Boolean),
    ...sessions.filter((s) => s.duration_seconds >= 60).map((s) => s.started_at),
  ];
  const streak = computeStreak(stamps, tz);

  // Grade de dias (últimas 18 semanas): minutos estudados + eventos por dia
  const perDay = new Map<string, { seconds: number; events: number }>();
  for (const s of sessions) {
    const d = toLocalDay(s.started_at, tz);
    const e = perDay.get(d) ?? { seconds: 0, events: 0 };
    e.seconds += s.duration_seconds;
    perDay.set(d, e);
  }
  for (const a of activity) {
    if (!a.occurred_at) continue;
    const d = toLocalDay(a.occurred_at, tz);
    const e = perDay.get(d) ?? { seconds: 0, events: 0 };
    e.events += 1;
    perDay.set(d, e);
  }

  const totalStudySeconds = sessions.reduce((a, s) => a + s.duration_seconds, 0);
  const weeks = weeklyTotals(sessions, 8);

  const completedTopics = [...j.topicProgress.values()]
    .filter((p) => p.status === "completed")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .map((p) => ({ progress: p, topic: j.tree.topics.get(p.topic_id)! }))
    .filter((x) => x.topic);

  const modulesCompleted = [...j.tree.modules.values()].filter((m) => {
    const s = j.moduleStats.get(m.id)!;
    return s.total > 0 && s.completed === s.total;
  });
  const stagesCompleted = j.tree.stages.filter((s) => {
    const st = j.stageStats.get(s.id)!;
    return st.total > 0 && st.completed === st.total;
  });

  const achievements = computeAchievements({
    topicsCompleted: j.overall.completed,
    topicsReviewed: [...j.topicProgress.values()].filter((p) => p.review_count > 0).length,
    modulesCompleted: modulesCompleted.map((m) => ({ key: m.key, title: m.title })),
    stagesCompleted: stagesCompleted.map((s) => ({ key: s.key, title: s.title })),
    longestStreak: streak.longest,
    totalStudySeconds,
    notesCount: notesCount.count ?? 0,
  });

  const recentSessions = sessions.filter((s) => s.duration_seconds >= 60).slice(0, 15).map((s) => ({
    ...s,
    topic: s.topic_id ? j.tree.topics.get(s.topic_id) ?? null : null,
  }));

  return {
    j,
    tz,
    streak,
    perDay,
    totalStudySeconds,
    weeks,
    completedTopics,
    topicsReviewed: [...j.topicProgress.values()].filter((p) => p.review_count > 0).length,
    achievements,
    recentSessions,
  };
}

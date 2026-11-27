import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { ManualSessionForm } from "@/components/evolution/manual-session";
import { LineBar } from "@/components/roadmap/station";
import { EmptyState, PageSkeleton, SectionTitle } from "@/components/states";
import { toLocalDay } from "@/lib/domain/streak";
import { formatDuration, formatPercent, relativeTime } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { getEvolution } from "@/services/evolution";

export const metadata: Metadata = { title: "Evolução" };

export default function EvolutionPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Evolution />
    </Suspense>
  );
}

const WEEKS = 18;

async function Evolution() {
  const e = await getEvolution();
  const { j } = e;
  const today = toLocalDay(new Date(), e.tz);

  // Grade: colunas = semanas (seg → dom), terminando na semana atual
  const end = new Date(`${today}T12:00:00Z`);
  const dow = (end.getUTCDay() + 6) % 7;
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - dow - (WEEKS - 1) * 7);
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    return { key, future: key > today, ...(e.perDay.get(key) ?? { seconds: 0, events: 0 }) };
  });
  const activeDays = days.filter((d) => d.seconds >= 60 || d.events > 0).length;
  const level = (d: { seconds: number; events: number }) => {
    const minutes = d.seconds / 60;
    if (minutes >= 90) return 4;
    if (minutes >= 45) return 3;
    if (minutes >= 15 || d.events >= 3) return 2;
    if (minutes >= 1 || d.events > 0) return 1;
    return 0;
  };
  const maxWeek = Math.max(1, ...e.weeks.map((w) => w.seconds));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-12">
      <h1 className="text-3xl font-bold tracking-tight">Evolução</h1>

      {/* Números principais */}
      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 border-y py-6 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Tópicos concluídos" value={`${j.overall.completed}`} hint={`de ${j.overall.total} (${formatPercent(j.overall.completed, j.overall.total)}%)`} />
        <Stat label="Tópicos revisados" value={`${e.topicsReviewed}`} hint="revisão depois de concluir" />
        <Stat label="Sequência atual" value={`${e.streak.current} ${e.streak.current === 1 ? "dia" : "dias"}`} hint={e.streak.studiedToday ? "estudou hoje" : e.streak.current ? "estude hoje para manter" : "comece hoje"} />
        <Stat label="Maior sequência" value={`${e.streak.longest} ${e.streak.longest === 1 ? "dia" : "dias"}`} hint={`${e.streak.activeDays} dias ativos no total`} />
        <Stat label="Tempo de estudo" value={formatDuration(e.totalStudySeconds)} hint="registrado nos últimos 400 dias" />
      </dl>

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-12">
          {/* Dias estudados */}
          <section aria-labelledby="dias">
            <SectionTitle id="dias" aside={`${activeDays} dias ativos em ${WEEKS} semanas`}>
              Dias estudados
            </SectionTitle>
            <div className="overflow-x-auto">
              <div
                role="img"
                aria-label={`Atividade diária: ${activeDays} dias ativos nas últimas ${WEEKS} semanas. Sequência atual de ${e.streak.current} dias.`}
                className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
              >
                {days.map((d) => {
                  const l = level(d);
                  return (
                    <span
                      key={d.key}
                      title={d.future ? undefined : `${new Date(`${d.key}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}: ${Math.round(d.seconds / 60)} min, ${d.events} atividades`}
                      className={cn(
                        "size-3.5 rounded-[3px]",
                        d.future && "opacity-0",
                        l === 0 && "bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]",
                        l === 1 && "bg-[color-mix(in_oklab,var(--line-01)_30%,transparent)]",
                        l === 2 && "bg-[color-mix(in_oklab,var(--line-01)_55%,transparent)]",
                        l === 3 && "bg-[color-mix(in_oklab,var(--line-01)_80%,transparent)]",
                        l === 4 && "bg-[var(--line-01)]",
                        d.key === today && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
                      )}
                    />
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Cada quadrado é um dia (colunas = semanas, de segunda a domingo). Mais escuro = mais tempo estudado.
            </p>
          </section>

          {/* Tempo por semana */}
          <section aria-labelledby="semanas">
            <SectionTitle id="semanas">Tempo de estudo por semana</SectionTitle>
            <ul className="space-y-2">
              {e.weeks.map((w) => (
                <li key={w.weekStart} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {new Date(`${w.weekStart}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-accent" aria-hidden>
                    <span className="block h-full rounded-full bg-[var(--line-01)]" style={{ width: `${(w.seconds / maxWeek) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{formatDuration(w.seconds)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-lg border bg-surface p-4">
              <p className="mb-3 text-sm">
                <span className="font-semibold">Estudou fora da plataforma?</span>{" "}
                <span className="text-muted-foreground">Registre o tempo de livros, vídeos ou prática. O tempo nos tópicos é medido automaticamente.</span>
              </p>
              <ManualSessionForm today={today} />
            </div>
          </section>

          {/* Progresso por etapa e módulo */}
          <section aria-labelledby="modulos">
            <SectionTitle id="modulos">Progresso por etapa e módulo</SectionTitle>
            <div className="space-y-8">
              {j.tree.stages.map((s) => {
                const st = j.stageStats.get(s.id)!;
                return (
                  <div key={s.id} data-line={s.key}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3 className="font-bold">
                        <span className="mr-2 text-[var(--line)]">{s.key}</span>
                        {s.title}
                      </h3>
                      <span className="text-sm tabular-nums text-muted-foreground">{st.completed}/{st.total} ({st.percent}%)</span>
                    </div>
                    <LineBar percent={st.percent} label={`Progresso da etapa ${s.title}`} className="h-2" />
                    <table className="mt-3 w-full text-sm">
                      <caption className="sr-only">Módulos da etapa {s.title}</caption>
                      <thead className="sr-only">
                        <tr><th>Módulo</th><th>Concluídos</th><th>Progresso</th></tr>
                      </thead>
                      <tbody>
                        {s.modules.map((m) => {
                          const ms = j.moduleStats.get(m.id)!;
                          return (
                            <tr key={m.id} className="border-b last:border-0">
                              <td className="py-2 pr-3">
                                <Link href={`/modulos/${m.slug}`} className="hover:underline">
                                  <span className="mr-2 tabular-nums text-muted-foreground">{m.key}</span>
                                  {m.title}
                                </Link>
                              </td>
                              <td className="w-20 py-2 text-right tabular-nums text-muted-foreground">{ms.completed}/{ms.total}</td>
                              <td className="hidden w-40 py-2 pl-4 sm:table-cell">
                                <LineBar percent={ms.percent} label={`Progresso do módulo ${m.title}`} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-12">
          {/* Conquistas */}
          <section aria-labelledby="conquistas">
            <SectionTitle id="conquistas" aside={`${e.achievements.filter((a) => a.unlocked).length}/${e.achievements.length}`}>
              Conquistas
            </SectionTitle>
            <ul className="space-y-3">
              {e.achievements.map((a) => (
                <li key={a.id} className={cn("flex gap-3", !a.unlocked && "text-muted-foreground")}>
                  <span
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2",
                      a.unlocked ? "border-[var(--line-03)] bg-[var(--line-03)] text-white" : "border-dashed",
                    )}
                    aria-hidden
                  >
                    {a.unlocked ? "✓" : <Lock className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", a.unlocked && "text-foreground")}>{a.title}</span>
                    <span className="block text-xs">{a.description}</span>
                    {!a.unlocked && a.progress && (
                      <span className="mt-1 block text-xs tabular-nums">
                        {a.progress.value}/{a.progress.target}
                      </span>
                    )}
                  </span>
                  <span className="sr-only">{a.unlocked ? "desbloqueada" : "bloqueada"}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Histórico */}
          <section aria-labelledby="concluidos">
            <SectionTitle id="concluidos" aside={`${e.completedTopics.length}`}>Tópicos concluídos</SectionTitle>
            {e.completedTopics.length ? (
              <ol className="space-y-2.5">
                {e.completedTopics.slice(0, 20).map(({ topic, progress }) => (
                  <li key={topic.id} data-line={topic.stageKey} className="flex items-baseline gap-3 text-sm">
                    <span className="size-2 shrink-0 translate-y-[-1px] rounded-full bg-[var(--line)]" aria-hidden />
                    <Link href={`/estudo/${topic.slug}`} className="min-w-0 flex-1 truncate hover:underline">
                      {topic.title}
                    </Link>
                    {progress.completed_at && <time className="shrink-0 text-muted-foreground" dateTime={progress.completed_at}>{relativeTime(progress.completed_at)}</time>}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Nenhum tópico concluído ainda">Conclua um tópico cumprindo seus critérios para vê-lo aqui.</EmptyState>
            )}
          </section>

          <section aria-labelledby="sessoes">
            <SectionTitle id="sessoes">Histórico de estudos</SectionTitle>
            {e.recentSessions.length ? (
              <ol className="space-y-2.5">
                {e.recentSessions.map((s, i) => (
                  <li key={i} data-line={s.topic?.stageKey} className="flex items-baseline gap-3 text-sm">
                    <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{formatDuration(s.duration_seconds)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {s.topic ? (
                        <Link href={`/estudo/${s.topic.slug}`} className="hover:underline">{s.topic.title}</Link>
                      ) : (
                        "Registro manual"
                      )}
                    </span>
                    <time className="shrink-0 text-muted-foreground" dateTime={s.started_at}>{relativeTime(s.started_at)}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Sem sessões registradas">O tempo é medido enquanto você estuda um tópico.</EmptyState>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

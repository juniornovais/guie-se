import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { LineBar, Station } from "@/components/roadmap/station";
import { Segment } from "@/components/roadmap/segment";
import { Bone, EmptyState, PageSkeleton, SectionTitle } from "@/components/states";
import { formatMinutes, formatPercent, relativeTime } from "@/lib/labels";
import { ACTIVITY_LABEL, getRecentActivity } from "@/services/dashboard";
import { getJourney } from "@/services/journey";

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const j = await getJourney();
  const firstName = j.user.name.split(" ")[0];
  const { current, currentModule, currentStage } = j;
  const isFresh = j.topicProgress.size === 0;
  const lastProgress = j.lastTopic ? j.topicProgress.get(j.lastTopic.id) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-12">
      <p className="text-muted-foreground">
        {isFresh ? `Olá, ${firstName}. Sua jornada começa na primeira estação.` : `Bom te ver de novo, ${firstName}.`}
      </p>

      {/* ---------------- Ponto atual: a estação na sua linha ---------------- */}
      {current && currentModule && currentStage ? (
        <section data-line={currentStage.key} aria-labelledby="atual" className="mt-6">
          <Link
            href={`/modulos/${currentModule.slug}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--line)] hover:underline"
          >
            <span className="inline-block h-2.5 w-6 rounded-full bg-[var(--line)]" aria-hidden />
            Linha {currentStage.key} {currentStage.title}, módulo {currentModule.key} {currentModule.title}
          </Link>
          <h1 id="atual" className="mt-3 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            {current.title}
          </h1>
          {current.summary && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{current.summary}</p>}

          <Segment topics={currentModule.topics} statusOf={j.statusOf} currentId={current.id} className="mt-4 max-w-3xl" />

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild size="lg" className="h-11 px-6 text-base">
              <Link href={`/estudo/${current.slug}`}>{isFresh ? "Começar a estudar" : "Continuar estudando"}</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              {current.key}
              {formatMinutes(current.estimatedMinutes) && <>, cerca de {formatMinutes(current.estimatedMinutes)}.</>}
              {j.lastTopic && lastProgress && (
                <>
                  {" "}
                  Último estudo:{" "}
                  <Link href={`/estudo/${j.lastTopic.slug}`} className="font-medium text-foreground hover:underline">
                    {j.lastTopic.title}
                  </Link>{" "}
                  {relativeTime(lastProgress.last_accessed_at)}
                </>
              )}
            </p>
          </div>
        </section>
      ) : (
        <section className="mt-6">
          <h1 className="text-4xl font-bold tracking-tight">Roadmap concluído.</h1>
          <p className="mt-3 text-muted-foreground">Todos os 236 tópicos estão concluídos. Use a revisão para manter o conhecimento vivo.</p>
          <Button asChild className="mt-6">
            <Link href="/evolucao">Ver evolução</Link>
          </Button>
        </section>
      )}

      <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-12">
          {/* ---------------- Próximos passos ---------------- */}
          <section aria-labelledby="proximos">
            <SectionTitle id="proximos" aside={<Link href="/roadmap" className="hover:text-foreground hover:underline">Ver mapa</Link>}>
              Próximas estações
            </SectionTitle>
            {j.upcoming.length ? (
              <ol className="divide-y">
                {j.upcoming.map((t, i) => (
                  <li key={t.id} data-line={t.stageKey}>
                    <Link href={`/estudo/${t.slug}`} className="group flex items-center gap-4 py-3">
                      <Station state={j.statusOf(t.id) === "in_progress" ? "in_progress" : "not_started"} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold group-hover:underline">{t.title}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {t.key} em {j.tree.modules.get(t.moduleId)?.title}
                        </span>
                      </span>
                      {i === 0 && <span className="text-xs font-semibold text-[var(--line)]">recomendado</span>}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Não há próximas estações." />
            )}
          </section>

          <Suspense fallback={<Bone className="h-40" />}>
            <RecentActivity />
          </Suspense>
        </div>

        {/* ---------------- Quanto já evoluí ---------------- */}
        <aside aria-labelledby="evolucao" className="lg:sticky lg:top-8 lg:self-start">
          <SectionTitle id="evolucao">Quanto já evoluí</SectionTitle>
          <p className="text-5xl font-bold tabular-nums tracking-tight">
            {formatPercent(j.overall.completed, j.overall.total)}
            <span className="text-2xl text-muted-foreground">%</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {j.overall.completed} de {j.overall.total} tópicos concluídos, {j.overall.inProgress} em andamento
          </p>
          <ul className="mt-6 space-y-4">
            {j.tree.stages.map((s) => {
              const st = j.stageStats.get(s.id)!;
              return (
                <li key={s.id} data-line={s.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className={s.id === currentStage?.id ? "font-bold" : "font-medium"}>
                      {s.key} {s.title}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {st.completed}/{st.total}
                    </span>
                  </div>
                  <LineBar percent={st.percent} label={`Progresso da etapa ${s.title}`} />
                </li>
              );
            })}
          </ul>
          <Link href="/evolucao" className="mt-6 inline-block text-sm font-semibold hover:underline">
            Ver evolução completa
          </Link>
        </aside>
      </div>
    </div>
  );
}

async function RecentActivity() {
  const items = await getRecentActivity();
  return (
    <section aria-labelledby="atividades">
      <SectionTitle id="atividades">Atividades recentes</SectionTitle>
      {items.length ? (
        <ol className="space-y-3">
          {items.map((a, i) => (
            <li key={i} data-line={a.topic?.stageKey} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--line,var(--muted))]" aria-hidden />
              <span className="min-w-0 flex-1">
                {ACTIVITY_LABEL[a.kind] ?? a.kind}{" "}
                {a.topic && (
                  <Link href={`/estudo/${a.topic.slug}`} className="font-semibold hover:underline">
                    {a.topic.title}
                  </Link>
                )}
              </span>
              <time dateTime={a.occurredAt} className="shrink-0 text-muted-foreground">
                {relativeTime(a.occurredAt)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="Nada por aqui ainda">Abra um tópico para registrar sua primeira atividade.</EmptyState>
      )}
    </section>
  );
}

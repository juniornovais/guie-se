import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { LineBar, STATUS_LABEL, Station, stateFor } from "@/components/roadmap/station";
import { PageSkeleton, SectionTitle } from "@/components/states";
import { formatMinutes } from "@/lib/labels";
import { getModuleBySlug } from "@/services/content";
import { getJourney, moduleNext } from "@/services/journey";

export async function generateMetadata({ params }: PageProps<"/modulos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Módulo ${slug.split("-").slice(0, 2).join(".")}` };
}

export default function ModulePage({ params }: PageProps<"/modulos/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Module params={params} />
    </Suspense>
  );
}

async function Module({ params }: { params: PageProps<"/modulos/[slug]">["params"] }) {
  const { slug } = await params;
  const found = await getModuleBySlug(slug);
  if (!found) notFound();
  const { module: m, stage } = found;
  const j = await getJourney();
  const st = j.moduleStats.get(m.id)!;
  const next = moduleNext(m, j);
  const aid = (x: string) => `m${m.key.split(".").join("-")}-${x}`;
  const stageModules = stage.modules;
  const idx = stageModules.findIndex((x) => x.id === m.id);

  return (
    <div data-line={stage.key} className="mx-auto max-w-5xl px-4 py-8 sm:px-8 lg:py-12">
      <nav aria-label="Trilha" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/roadmap" className="hover:text-foreground hover:underline">Roadmap</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/roadmap#etapa-${stage.key}`} className="hover:text-foreground hover:underline">
              {stage.key} {stage.title}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-medium text-foreground">{m.key}</li>
        </ol>
      </nav>

      <header className="mt-6 border-l-4 border-[var(--line)] pl-5">
        <p className="text-sm font-semibold text-[var(--line)]">Módulo {m.key}</p>
        <h1 className="mt-1 text-4xl font-bold leading-tight tracking-tight">{m.title}</h1>
        {m.description && <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted-foreground">{m.description}</p>}
      </header>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-8 md:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-labelledby={aid("objetivos")}>
          <SectionTitle id={aid("objetivos")}>Objetivos do módulo</SectionTitle>
          <ul className="space-y-2">
            {m.objectives.map((o) => (
              <li key={o} className="flex gap-3 leading-relaxed">
                <span className="mt-2.5 h-0.5 w-3 shrink-0 bg-[var(--line)]" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={aid("progresso")} className="space-y-4">
          <SectionTitle id={aid("progresso")}>Progresso</SectionTitle>
          <div>
            <p className="text-3xl font-bold tabular-nums">{st.percent}%</p>
            <LineBar percent={st.percent} label={`Progresso do módulo ${m.title}`} className="mt-2" />
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Concluídos</dt>
            <dd className="text-right font-semibold tabular-nums">{st.completed}/{st.total}</dd>
            <dt className="text-muted-foreground">Em andamento</dt>
            <dd className="text-right font-semibold tabular-nums">{st.inProgress}</dd>
          </dl>
          {next && (
            <Button asChild className="w-full">
              <Link href={`/estudo/${next.slug}`}>Próximo: {next.title}</Link>
            </Button>
          )}
        </section>
      </div>

      <section aria-labelledby={aid("topicos")} className="mt-12">
        <SectionTitle id={aid("topicos")} aside={`${st.total - st.completed} pendentes`}>
          Tópicos
        </SectionTitle>
        <ol className="relative">
          <span aria-hidden className="absolute bottom-6 left-[0.6rem] top-6 w-1 rounded-full bg-[var(--line)] opacity-80" />
          {m.topics.map((t) => {
            const status = j.statusOf(t.id);
            const isNext = next?.id === t.id;
            const state = stateFor(status, t.id === j.current?.id);
            return (
              <li key={t.id} className="relative">
                <Link
                  href={`/estudo/${t.slug}`}
                  className="group grid grid-cols-[1.5rem_1fr] gap-4 rounded-lg py-4 pr-2 hover:bg-accent/60 sm:grid-cols-[1.5rem_1fr_auto]"
                >
                  <span className="relative z-10 flex justify-center pt-1">
                    <Station state={state} size={18} label={STATUS_LABEL[state]} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-lg font-semibold leading-snug group-hover:underline ${status === "completed" ? "text-muted-foreground" : ""}`}>
                      <span className="mr-2 text-sm font-normal tabular-nums text-muted-foreground">{t.key}</span>
                      {t.title}
                      {isNext && <span className="ml-2 align-middle text-xs font-bold text-[var(--line)]">recomendado</span>}
                    </span>
                    {t.summary && <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">{t.summary}</span>}
                  </span>
                  <span className="col-start-2 flex gap-4 text-sm text-muted-foreground sm:col-start-3 sm:flex-col sm:items-end sm:gap-1 sm:pt-1">
                    <span>{STATUS_LABEL[state]}</span>
                    {formatMinutes(t.estimatedMinutes) && <span>{formatMinutes(t.estimatedMinutes)}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <nav aria-label="Módulos vizinhos" className="mt-12 grid gap-4 border-t pt-6 sm:grid-cols-2">
        {idx > 0 ? (
          <Link href={`/modulos/${stageModules[idx - 1].slug}`} className="rounded-lg py-2 hover:underline">
            <span className="block text-sm text-muted-foreground">Módulo anterior</span>
            <span className="font-semibold">{stageModules[idx - 1].key} {stageModules[idx - 1].title}</span>
          </Link>
        ) : <span />}
        {idx < stageModules.length - 1 && (
          <Link href={`/modulos/${stageModules[idx + 1].slug}`} className="rounded-lg py-2 text-right hover:underline sm:col-start-2">
            <span className="block text-sm text-muted-foreground">Próximo módulo</span>
            <span className="font-semibold">{stageModules[idx + 1].key} {stageModules[idx + 1].title}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}

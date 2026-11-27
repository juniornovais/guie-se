import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STATUS_LABEL, Station, stateFor } from "@/components/roadmap/station";
import { PageSkeleton, SectionTitle } from "@/components/states";
import { CompletionPanel } from "@/components/study/completion-panel";
import { Markdown } from "@/components/study/markdown";
import { Notes } from "@/components/study/notes";
import { StudyTracker } from "@/components/study/study-tracker";
import { Toc } from "@/components/study/toc";
import { requireSession } from "@/lib/auth/dal";
import { CHALLENGE_TYPE_LABEL, formatMinutes, LEVEL_LABEL } from "@/lib/labels";
import { getTopicBySlug } from "@/services/content";
import { getJourney } from "@/services/journey";
import { InlineMarkdown } from "@/components/study/inline-markdown";
import { listNotes } from "@/services/progress";

export async function generateMetadata({ params }: PageProps<"/estudo/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Tópico ${slug.split("-").slice(0, 3).join(".")}` };
}

export default function StudyPage({ params }: PageProps<"/estudo/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Study params={params} />
    </Suspense>
  );
}

const KIND_LABEL = { section: null, example: "Exemplo", diagram: "Diagrama" } as const;

async function Study({ params }: { params: PageProps<"/estudo/[slug]">["params"] }) {
  const { slug } = await params;
  const data = await getTopicBySlug(slug);
  if (!data) notFound();
  const { stage, module: m, topic, sections, plannedChallenges, prerequisites, unlocks, prev, next } = data;

  const [j, { supabase }] = await Promise.all([getJourney(), requireSession()]);
  const notes = await listNotes(supabase, topic.id);
  const progress = j.topicProgress.get(topic.id) ?? null;
  const status = progress?.status ?? "not_started";

  const aid = (x: string) => `t${topic.key.split(".").join("-")}-${x}`;
  const toc = [
    { id: aid("objetivos"), title: "Objetivos de aprendizagem" },
    ...sections.map((s) => ({ id: aid(s.key), title: s.title })),
    ...(plannedChallenges.length ? [{ id: aid("pratica"), title: "Ideias de prática" }] : []),
    { id: aid("anotacoes"), title: "Anotações" },
  ];

  return (
    <div data-line={stage.key} className="mx-auto max-w-[90rem] px-4 py-8 sm:px-8 lg:py-10">
      <StudyTracker topicId={topic.id} firstVisit={!progress} />

      <nav aria-label="Trilha" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/roadmap" className="hover:text-foreground hover:underline">Roadmap</Link></li>
          <li aria-hidden>/</li>
          <li><Link href={`/roadmap#etapa-${stage.key}`} className="hover:text-foreground hover:underline">{stage.title}</Link></li>
          <li aria-hidden>/</li>
          <li><Link href={`/modulos/${m.slug}`} className="hover:text-foreground hover:underline">{m.key} {m.title}</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-medium text-foreground">{topic.title}</li>
        </ol>
      </nav>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[13rem_minmax(0,1fr)_19rem]">
        {/* Sumário */}
        <aside className="hidden xl:block">
          <div className="sticky top-8">
            <Toc items={toc} />
          </div>
        </aside>

        {/* Conteúdo */}
        <article className="min-w-0">
          <header>
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--line)]">
              <Station state={stateFor(status, false)} size={14} />
              {topic.key}, {STATUS_LABEL[stateFor(status, false)].toLowerCase()}
              {formatMinutes(topic.estimatedMinutes) && <span className="font-normal text-muted-foreground">(cerca de {formatMinutes(topic.estimatedMinutes)})</span>}
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">{topic.title}</h1>
            {topic.summary && <p className="mt-4 max-w-[68ch] text-lg leading-relaxed text-muted-foreground">{topic.summary}</p>}
            <a
              href={`#${aid("progresso")}`}
              className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold hover:border-[var(--line)] lg:hidden"
            >
              Concluir tópico
            </a>
          </header>

          {prerequisites.length > 0 && (
            <section aria-label="Pré-requisitos" className="mt-6 max-w-[68ch] rounded-lg border bg-surface p-4">
              <p className="text-sm font-bold">Antes deste tópico</p>
              <ul className="mt-2 space-y-1.5">
                {prerequisites.map((p) => {
                  const ps = j.statusOf(p.topic.id);
                  return (
                    <li key={p.topic.id} data-line={p.topic.stageKey} className="flex items-start gap-2 text-sm">
                      <Station state={stateFor(ps, false)} size={12} className="mt-1" label={STATUS_LABEL[stateFor(ps, false)]} />
                      <span>
                        <Link href={`/estudo/${p.topic.slug}`} className="font-medium hover:underline">
                          {p.topic.key} {p.topic.title}
                        </Link>
                        {p.kind === "required" && <span className="ml-1.5 text-xs font-semibold text-[var(--line)]">necessário</span>}
                        {p.reason && <span className="block text-muted-foreground">{p.reason}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Recomendação, não bloqueio: você pode estudar este tópico agora.</p>
            </section>
          )}

          <section aria-labelledby={aid("objetivos")} className="mt-10 max-w-[68ch]">
            <h2 id={aid("objetivos")} className="scroll-mt-20 text-2xl font-bold">Objetivos de aprendizagem</h2>
            <ul className="mt-4 space-y-2.5">
              {data.objectives.map((o) => (
                <li key={o} className="flex gap-3 font-serif text-lg leading-relaxed">
                  <span className="mt-3 h-0.5 w-3 shrink-0 bg-[var(--line)]" aria-hidden />
                  <span><InlineMarkdown>{o}</InlineMarkdown></span>
                </li>
              ))}
            </ul>
          </section>

          {sections.length > 0 && (
            <div className="mt-4">
              <p className="mt-12 max-w-[68ch] rounded-md border-l-4 border-[var(--line)] bg-surface px-4 py-3 text-sm text-muted-foreground">
                Texto de estudo para leitura opcional. Você pode concluir o tópico quando quiser.
              </p>
              {sections.map((s) => (
                <section key={s.id} aria-labelledby={aid(s.key)} className="mt-12">
                  <h2 id={aid(s.key)} className="scroll-mt-20 text-2xl font-bold tracking-tight">
                    {KIND_LABEL[s.kind] && <span className="mr-2 text-base font-semibold text-[var(--line)]">{KIND_LABEL[s.kind]}</span>}
                    {s.title}
                    {s.is_additional && <span className="ml-2 align-middle text-xs font-semibold text-muted-foreground">conteúdo adicional</span>}
                  </h2>
                  <Markdown className="mt-4">{s.body_md}</Markdown>
                </section>
              ))}
            </div>
          )}

          {plannedChallenges.length > 0 && (
            <section aria-labelledby={aid("pratica")} className="mt-14 max-w-[68ch]">
              <details className="group rounded-lg border bg-surface">
                <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-4 py-3">
                  <h2 id={aid("pratica")} className="scroll-mt-20 text-lg font-bold">Ideias de prática</h2>
                  <span className="text-sm text-muted-foreground">{plannedChallenges.length} sugestões, opcional</span>
                </summary>
                <ol className="divide-y border-t px-4">
                  {plannedChallenges.map((c, i) => (
                    <li key={i} className="flex items-start gap-3 py-3">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded border border-[var(--line)] text-xs font-bold text-[var(--line)]" title={`Nível ${c.level}: ${LEVEL_LABEL[c.level]}`}>
                        {c.level}
                      </span>
                      <span>
                        <span className="block text-[0.95rem]">{c.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {CHALLENGE_TYPE_LABEL[c.type]}, {LEVEL_LABEL[c.level].toLowerCase()}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            </section>
          )}

          {unlocks.length > 0 && (
            <section aria-label="Próximos passos" className="mt-12 max-w-[68ch]">
              <SectionTitle>Este tópico abre caminho para</SectionTitle>
              <ul className="flex flex-wrap gap-2">
                {unlocks.map((u) => (
                  <li key={u.topic.id} data-line={u.topic.stageKey}>
                    <Link href={`/estudo/${u.topic.slug}`} className="flex items-center gap-2 rounded-full border bg-surface py-1 pl-1.5 pr-3 text-sm hover:border-[var(--line)]">
                      <Station state={stateFor(j.statusOf(u.topic.id), false)} size={12} />
                      {u.topic.key} {u.topic.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby={aid("anotacoes")} className="mt-14 max-w-[68ch]">
            <h2 id={aid("anotacoes")} className="mb-4 scroll-mt-20 text-2xl font-bold">Anotações</h2>
            <Notes topicId={topic.id} notes={notes} />
          </section>

          <nav aria-label="Tópicos vizinhos" className="mt-14 grid max-w-[68ch] gap-4 border-t pt-6 sm:grid-cols-2">
            {prev ? (
              <Link href={`/estudo/${prev.slug}`} data-line={prev.stageKey} className="group flex items-start gap-2 py-2">
                <ChevronLeft className="mt-5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <span className="block text-sm text-muted-foreground">Anterior</span>
                  <span className="font-semibold group-hover:underline">{prev.key} {prev.title}</span>
                </span>
              </Link>
            ) : <span />}
            {next && (
              <Link href={`/estudo/${next.slug}`} data-line={next.stageKey} className="group flex items-start justify-end gap-2 py-2 text-right sm:col-start-2">
                <span>
                  <span className="block text-sm text-muted-foreground">Próximo</span>
                  <span className="font-semibold group-hover:underline">{next.key} {next.title}</span>
                </span>
                <ChevronRight className="mt-5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            )}
          </nav>
        </article>

        {/* Painel de conclusão */}
        <aside id={aid("progresso")} aria-label="Progresso do tópico" className="scroll-mt-20 lg:col-start-2 lg:row-start-1 xl:col-start-3">
          <div className="rounded-lg border bg-surface p-5 lg:sticky lg:top-8">
            <CompletionPanel
              topicId={topic.id}
              status={status}
              completedAt={progress?.completed_at ?? null}
              reviewedAt={progress?.reviewed_at ?? null}
              reviewCount={progress?.review_count ?? 0}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

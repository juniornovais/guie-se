import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RoadmapMap, type MapStage } from "@/components/roadmap/roadmap-map";
import { PageSkeleton } from "@/components/states";
import { getJourney } from "@/services/journey";

export const metadata: Metadata = { title: "Roadmap" };

export default function RoadmapPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Roadmap />
    </Suspense>
  );
}

async function Roadmap() {
  const j = await getJourney();
  const stages: MapStage[] = j.tree.stages.map((s) => {
    const st = j.stageStats.get(s.id)!;
    return {
      key: s.key,
      title: s.title,
      description: s.description,
      completed: st.completed,
      total: st.total,
      percent: st.percent,
      modules: s.modules.map((m) => {
        const ms = j.moduleStats.get(m.id)!;
        return {
          key: m.key,
          slug: m.slug,
          title: m.title,
          completed: ms.completed,
          total: ms.total,
          topics: m.topics.map((t) => ({
            id: t.id,
            key: t.key,
            slug: t.slug,
            title: t.title,
            status: j.statusOf(t.id),
            summary: t.summary,
            estimatedMinutes: t.estimatedMinutes,
            contentStatus: t.contentStatus,
          })),
        };
      }),
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roadmap Java Backend</h1>
          <p className="mt-1 text-muted-foreground">
            6 linhas, {j.tree.modules.size} módulos e {j.tree.topics.size} estações. Você concluiu {j.overall.completed}.
          </p>
        </div>
        <nav aria-label="Ir para etapa" className="flex flex-wrap gap-1.5">
          {j.tree.stages.map((s) => (
            <Link
              key={s.key}
              href={`#etapa-${s.key}`}
              data-line={s.key}
              className="rounded-md border-2 border-[var(--line)] px-2 py-0.5 text-sm font-bold text-[var(--line)] hover:bg-[var(--line)] hover:text-white"
              title={s.title}
            >
              {s.key}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
        A ordem segue o roadmap original. A recomendação de próximo passo considera os pré-requisitos — por exemplo, o
        módulo 3.4 (SQL) é sugerido antes do 3.2 (transações). Nada fica bloqueado: explore livremente.
      </p>
      <div className="mt-2">
        <RoadmapMap stages={stages} edges={j.tree.edges} currentId={j.current?.id ?? null} nextId={j.next?.id ?? null} />
      </div>
    </div>
  );
}

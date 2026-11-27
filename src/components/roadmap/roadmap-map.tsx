"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { LineBar, STATUS_LABEL, Station, stateFor } from "./station";

export type MapTopic = {
  id: string;
  key: string;
  slug: string;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  summary: string | null;
  estimatedMinutes: number | null;
  contentStatus: string;
};
export type MapModule = { key: string; slug: string; title: string; completed: number; total: number; topics: MapTopic[] };
export type MapStage = {
  key: string;
  title: string;
  description: string;
  completed: number;
  total: number;
  percent: number;
  modules: MapModule[];
};
export type MapEdge = { topicId: string; prerequisiteId: string; kind: "required" | "recommended"; reason: string | null };

type Filter = "all" | "pending" | "in_progress" | "completed";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluídos" },
];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function RoadmapMap({
  stages,
  edges,
  currentId,
  nextId,
}: {
  stages: MapStage[];
  edges: MapEdge[];
  currentId: string | null;
  nextId: string | null;
}) {
  // Começa sem seleção: no celular o painel cobriria o mapa. No desktop, o painel mostra uma orientação.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const index = useMemo(() => {
    const topics = new Map<string, MapTopic & { stageKey: string; moduleKey: string; moduleTitle: string }>();
    for (const s of stages) for (const m of s.modules) for (const t of m.topics) topics.set(t.id, { ...t, stageKey: s.key, moduleKey: m.key, moduleTitle: m.title });
    return topics;
  }, [stages]);

  const selected = selectedId ? index.get(selectedId) ?? null : null;
  const prereqs = useMemo(() => edges.filter((e) => e.topicId === selectedId), [edges, selectedId]);
  const unlocks = useMemo(() => edges.filter((e) => e.prerequisiteId === selectedId), [edges, selectedId]);
  const related = useMemo(() => {
    const m = new Map<string, "prereq" | "unlock">();
    for (const e of prereqs) m.set(e.prerequisiteId, "prereq");
    for (const e of unlocks) if (!m.has(e.topicId)) m.set(e.topicId, "unlock");
    return m;
  }, [prereqs, unlocks]);

  const q = normalize(query.trim());
  const matches = (t: MapTopic) => {
    if (q && !normalize(`${t.key} ${t.title}`).includes(q)) return false;
    if (filter === "pending") return t.status !== "completed";
    if (filter === "in_progress") return t.status === "in_progress";
    if (filter === "completed") return t.status === "completed";
    return true;
  };
  const visibleCount = [...index.values()].filter(matches).length;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <div className="min-w-0">
        {/* Controles */}
        <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:top-0 sm:-mx-8 sm:px-8">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tópico (ex.: MVCC, 4.1.8)"
              aria-label="Buscar tópico"
              className="pl-9"
            />
          </div>
          <div role="radiogroup" aria-label="Filtrar estações" className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground",
                  filter === f.value && "border-foreground bg-foreground text-background hover:text-background",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {visibleCount} de {index.size}
          </p>
        </div>

        <Legend />

        {/* Linhas */}
        <div className="mt-6 space-y-14">
          {stages.map((s) => (
            <section key={s.key} data-line={s.key} aria-labelledby={`linha-${s.key}`} className="scroll-mt-28" id={`etapa-${s.key}`}>
              <header className="grid gap-x-8 gap-y-2 md:grid-cols-[1fr_12rem]">
                <div>
                  <h2 id={`linha-${s.key}`} className="flex items-center gap-3 text-2xl font-bold tracking-tight">
                    <span className="grid h-8 min-w-11 place-items-center rounded-md bg-[var(--line)] px-2 text-base text-white dark:text-[var(--paper)]">
                      {s.key}
                    </span>
                    {s.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-muted-foreground">{s.description}</p>
                </div>
                <div className="self-end">
                  <p className="mb-1.5 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">{s.percent}%</span> ({s.completed} de {s.total} tópicos)
                  </p>
                  <LineBar percent={s.percent} label={`Progresso da etapa ${s.title}`} />
                </div>
              </header>

              <div className="relative mt-6 border-l-4 border-[var(--line)] pl-5 sm:pl-7">
                {s.modules.map((m) => (
                  <div key={m.key} className="relative pb-7 last:pb-1">
                    <span aria-hidden className="absolute -left-[1.95rem] top-1 size-3.5 rounded-full border-[3px] border-[var(--line)] bg-background sm:-left-[2.45rem]" />
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link href={`/modulos/${m.slug}`} className="font-bold hover:underline">
                        {m.key} {m.title}
                      </Link>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {m.completed}/{m.total}
                      </span>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Tópicos de ${m.title}`}>
                      {m.topics.map((t) => {
                        const visible = matches(t);
                        const rel = related.get(t.id);
                        const isSel = t.id === selectedId;
                        const state = stateFor(t.status, t.id === currentId);
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(isSel ? null : t.id)}
                              aria-pressed={isSel}
                              aria-label={`${t.key} ${t.title} — ${STATUS_LABEL[state]}`}
                              className={cn(
                                "group flex max-w-[16rem] items-center gap-2 rounded-full border bg-surface py-1 pl-1.5 pr-3 text-left text-sm transition-[opacity,box-shadow]",
                                !visible && "opacity-25",
                                isSel && "border-[var(--line)] ring-2 ring-[var(--line)]",
                                rel === "prereq" && "border-[var(--line)] border-dashed ring-1 ring-[var(--line)]/40",
                                rel === "unlock" && "border-[var(--line)]/60",
                                t.status === "completed" && !isSel && "text-muted-foreground",
                              )}
                            >
                              <Station state={state} size={13} />
                              <span className="truncate">{t.title}</span>
                              {t.id === nextId && t.id !== currentId && (
                                <span className="shrink-0 text-[0.7rem] font-bold text-[var(--line)]">próximo</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Painel da estação selecionada */}
      <aside
        aria-label="Estação selecionada"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 max-h-[60dvh] overflow-y-auto border-t bg-surface p-5 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)] lg:sticky lg:top-6 lg:z-0 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:rounded-lg lg:border lg:shadow-none",
          !selected && "hidden lg:block",
        )}
      >
        {selected ? (
          <div data-line={selected.stageKey} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--line)]">
                {selected.moduleKey} {selected.moduleTitle}
              </p>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-md p-1 hover:bg-accent" aria-label="Fechar painel">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div>
              <h3 className="text-xl font-bold leading-snug">{selected.title}</h3>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Station state={stateFor(selected.status, selected.id === currentId)} size={12} />
                {STATUS_LABEL[stateFor(selected.status, selected.id === currentId)]}
                {formatMinutes(selected.estimatedMinutes) && <>, cerca de {formatMinutes(selected.estimatedMinutes)}</>}
              </p>
            </div>
            {selected.summary && <p className="text-sm leading-relaxed text-muted-foreground">{selected.summary}</p>}
            {selected.contentStatus !== "planned" && <p className="text-sm text-muted-foreground">Tem texto de estudo para ler (opcional).</p>}
            <Button asChild className="w-full">
              <Link href={`/estudo/${selected.slug}`}>Estudar este tópico</Link>
            </Button>

            <Connections title="Pré-requisitos" empty="Nenhum pré-requisito: pode começar por aqui." items={prereqs.map((e) => ({ edge: e, topic: index.get(e.prerequisiteId)! }))} onSelect={setSelectedId} />
            <Connections title="Abre caminho para" empty="Nenhum tópico depende diretamente deste." items={unlocks.map((e) => ({ edge: e, topic: index.get(e.topicId)! }))} onSelect={setSelectedId} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Selecione uma estação</p>
            <p className="mt-1">Veja o resumo, os pré-requisitos e os tópicos que ela desbloqueia. As conexões ficam destacadas no mapa.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Connections({
  title,
  empty,
  items,
  onSelect,
}: {
  title: string;
  empty: string;
  items: { edge: MapEdge; topic: MapTopic & { stageKey: string; moduleKey: string } }[];
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h4 className="border-b pb-1.5 text-sm font-bold">{title}</h4>
      {items.length ? (
        <ul className="mt-2 space-y-2">
          {items.map(({ edge, topic }) => (
            <li key={topic.id} data-line={topic.stageKey}>
              <button type="button" onClick={() => onSelect(topic.id)} className="flex w-full items-start gap-2 rounded-md text-left text-sm hover:underline">
                <Station state={stateFor(topic.status, false)} size={12} className="mt-1" />
                <span className="min-w-0">
                  <span className="font-medium">
                    {topic.key} {topic.title}
                  </span>
                  {edge.kind === "required" && <span className="ml-1.5 text-xs font-semibold text-[var(--line)]">necessário</span>}
                  {edge.reason && <span className="block text-xs text-muted-foreground no-underline">{edge.reason}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function Legend() {
  const items: { state: "not_started" | "in_progress" | "completed" | "current"; label: string }[] = [
    { state: "not_started", label: "Não iniciado" },
    { state: "in_progress", label: "Em andamento" },
    { state: "completed", label: "Concluído" },
    { state: "current", label: "Você está aqui" },
  ];
  return (
    <ul data-line="01" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Legenda">
      {items.map((i) => (
        <li key={i.state} className="flex items-center gap-2">
          <Station state={i.state} size={13} />
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className="inline-block h-5 w-8 rounded-full border border-dashed border-[var(--line)]" aria-hidden />
        Pré-requisito da estação selecionada
      </li>
    </ul>
  );
}

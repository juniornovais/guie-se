import Link from "next/link";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, Station, stateFor } from "./station";

type SegTopic = { id: string; slug: string; title: string; key: string };

/**
 * Trecho horizontal de linha: as estações de um módulo, com a atual em destaque.
 * Rola horizontalmente em telas pequenas.
 */
export function Segment({
  topics,
  statusOf,
  currentId,
  showLabels = "current",
  className,
}: {
  topics: SegTopic[];
  statusOf: (id: string) => string;
  currentId?: string | null;
  showLabels?: "current" | "none";
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto pb-2", className)}>
      <ol className="relative inline-flex min-w-max items-center px-6 pb-8 pt-6" aria-label="Estações do módulo">
        <span aria-hidden className="absolute left-10 right-10 top-[calc(1.5rem+10px)] sm:left-11 sm:right-11 h-1 -translate-y-1/2 rounded-full bg-[var(--line)] opacity-80" />
        {topics.map((t) => {
          const state = stateFor(statusOf(t.id), t.id === currentId);
          const isCurrent = t.id === currentId;
          return (
            <li key={t.id} className="relative z-10 flex h-5 w-8 flex-col items-center justify-center sm:w-10">
              <Link
                href={`/estudo/${t.slug}`}
                className="group relative rounded-full"
                aria-label={`${t.key} ${t.title} — ${STATUS_LABEL[state]}`}
                title={`${t.key} ${t.title}`}
              >
                <Station state={state} size={isCurrent ? 20 : 14} />
              </Link>
              {showLabels === "current" && isCurrent && (
                <span className="absolute top-full mt-2 whitespace-nowrap text-xs font-semibold text-[var(--line)]">
                  Você está aqui
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

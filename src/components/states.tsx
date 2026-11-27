import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bloco de carregamento genérico (as páginas usam esqueletos com o formato real). */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-accent", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8 lg:py-12" role="status" aria-label="Carregando">
      <Bone className="h-4 w-40" />
      <Bone className="h-10 w-2/3" />
      <Bone className="h-24 w-full" />
      <div className="grid gap-6 md:grid-cols-2">
        <Bone className="h-48" />
        <Bone className="h-48" />
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b pb-2">
      <h2 id={id} className="text-base font-bold">
        {children}
      </h2>
      {aside && <div className="text-sm text-muted-foreground">{aside}</div>}
    </div>
  );
}

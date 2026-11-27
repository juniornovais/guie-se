"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TocItem = { id: string; title: string };

/** Sumário lateral com indicação da seção visível. */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav aria-label="Sumário">
      <p className="mb-2 text-sm font-bold">Neste tópico</p>
      <ol className="space-y-0.5 border-l">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              onClick={() => {
                // Seções recolhidas (<details>) abrem ao navegar pelo sumário
                const details = document.getElementById(i.id)?.closest("details");
                if (details) details.open = true;
              }}
              aria-current={active === i.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 border-transparent py-1 pl-3 text-sm leading-snug text-muted-foreground hover:text-foreground",
                active === i.id && "border-[var(--line)] font-semibold text-foreground",
              )}
            >
              {i.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesColumn, House, Map, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Início", icon: House, match: (p: string) => p === "/" },
  { href: "/roadmap", label: "Roadmap", icon: Map, match: (p: string) => p.startsWith("/roadmap") || p.startsWith("/modulos") || p.startsWith("/estudo") },
  { href: "/evolucao", label: "Evolução", icon: ChartNoAxesColumn, match: (p: string) => p.startsWith("/evolucao") },
  { href: "/configuracoes", label: "Configurações", icon: Settings2, match: (p: string) => p.startsWith("/configuracoes") },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavList pathname={pathname} onNavigate={onNavigate} />;
}

/** Versão sem destaque do item ativo, usada no shell pré-renderizado (sem dados de URL). */
export function NavLinksStatic() {
  return <NavList pathname={null} />;
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal">
      <ul className="space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = pathname !== null && match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-[0.95rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-accent font-semibold text-foreground",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

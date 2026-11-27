import { Suspense } from "react";
import { Brand } from "@/components/layout/brand";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks, NavLinksStatic } from "@/components/layout/nav-links";
import { UserMenu, UserMenuSkeleton } from "@/components/layout/user-menu";

/**
 * Shell da área autenticada. A navegação é estática (entra no shell
 * pré-renderizado); apenas o menu do usuário lê a sessão, dentro de Suspense.
 * O proxy já redireciona visitantes sem sessão; cada página e action revalida.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const userMenu = (
    <Suspense fallback={<UserMenuSkeleton />}>
      <UserMenu />
    </Suspense>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Pular para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r bg-surface px-3 py-5 lg:flex">
        <div className="px-3">
          <Brand />
        </div>
        <Suspense fallback={<NavLinksStatic />}>
          <NavLinks />
        </Suspense>
        <div className="mt-auto px-1">{userMenu}</div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Brand />
        <MobileNav footer={userMenu} />
      </header>

      <main id="conteudo" className="min-w-0">
        {children}
      </main>
    </div>
  );
}

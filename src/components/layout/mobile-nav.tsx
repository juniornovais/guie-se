"use client";

import { Suspense, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks, NavLinksStatic } from "./nav-links";

export function MobileNav({ footer }: { footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="rounded-md p-2 hover:bg-accent" aria-label="Abrir menu">
          <Menu className="size-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col gap-6 p-4">
        <SheetTitle className="px-3 pt-1">Menu</SheetTitle>
        <Suspense fallback={<NavLinksStatic />}>
          <NavLinks onNavigate={() => setOpen(false)} />
        </Suspense>
        <div className="mt-auto">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}

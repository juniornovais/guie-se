import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsForm } from "@/components/settings/settings-form";
import { PageSkeleton } from "@/components/states";
import { getJourney } from "@/services/journey";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const j = await getJourney();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 lg:py-12">
      <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
      <p className="mt-1 text-muted-foreground">Preferências salvas na sua conta e aplicadas em qualquer dispositivo.</p>
      <div className="mt-10">
        <SettingsForm initial={j.settings} />
      </div>
    </div>
  );
}

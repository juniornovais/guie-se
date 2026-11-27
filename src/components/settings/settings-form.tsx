"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { updateSettings } from "@/lib/actions/progress";
import { SettingsInput } from "@/lib/validations/progress";

type Settings = z.infer<typeof SettingsInput>;

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Noronha", "America/Rio_Branco", "Europe/Lisbon", "UTC"];

export function SettingsForm({ initial }: { initial: Settings }) {
  const form = useForm<Settings>({ resolver: zodResolver(SettingsInput), defaultValues: initial });
  const [pending, start] = useTransition();

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const r = await updateSettings(values);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Configurações salvas");
      form.reset(values);
    }),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <fieldset>
        <legend className="text-lg font-bold">Fuso horário</legend>
        <p className="mt-1 text-sm text-muted-foreground">Usado para contar a sequência de dias estudados.</p>
        <select {...form.register("timezone")} className="mt-4 h-10 rounded-md border bg-surface px-3 text-sm" aria-label="Fuso horário">
          {[...new Set([initial.timezone, ...TIMEZONES])].map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        {form.formState.errors.timezone && <p className="mt-1 text-sm text-danger">{form.formState.errors.timezone.message}</p>}
      </fieldset>

      <div className="flex items-center gap-4 border-t pt-6">
        <Button type="submit" disabled={pending || !form.formState.isDirty}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Salvar configurações
        </Button>
        {form.formState.isDirty && <span className="text-sm text-muted-foreground">Alterações não salvas</span>}
      </div>
    </form>
  );
}

"use client";

import { useId, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addManualStudySession } from "@/lib/actions/progress";

const Form = z.object({
  minutes: z.coerce.number<number>().int("Use minutos inteiros.").min(1, "Mínimo de 1 minuto.").max(720, "Máximo de 12 horas por registro."),
  date: z.iso.date("Informe a data."),
});
type Form = z.infer<typeof Form>;

/** Registro manual de tempo (estudo fora da plataforma: livro, vídeo, prática). */
export function ManualSessionForm({ today }: { today: string }) {
  const form = useForm<Form>({ resolver: zodResolver(Form), defaultValues: { minutes: 30, date: today } });
  const [pending, start] = useTransition();
  const uid = useId();
  const onSubmit = form.handleSubmit((v) =>
    start(async () => {
      const r = await addManualStudySession(v);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Tempo de estudo registrado");
      form.reset({ minutes: 30, date: today });
    }),
  );
  const errors = form.formState.errors;
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-minutes`}>Minutos</Label>
        <Input id={`${uid}-minutes`} type="number" inputMode="numeric" className="w-28" aria-invalid={Boolean(errors.minutes)} {...form.register("minutes")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-date`}>Data</Label>
        <Input id={`${uid}-date`} type="date" max={today} className="w-44" aria-invalid={Boolean(errors.date)} {...form.register("date")} />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Registrar tempo
      </Button>
      {(errors.minutes || errors.date) && (
        <p role="alert" className="w-full text-sm text-danger">
          {errors.minutes?.message ?? errors.date?.message}
        </p>
      )}
    </form>
  );
}

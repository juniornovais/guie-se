"use client";

import { useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNote, deleteNote, updateNote } from "@/lib/actions/notes";
import { relativeTime } from "@/lib/labels";

const NoteForm = z.object({ body: z.string().trim().min(1, "A anotação está vazia.").max(20_000, "Máximo de 20.000 caracteres.") });
type NoteForm = z.infer<typeof NoteForm>;

export type NoteItem = { id: string; body: string; created_at: string; updated_at: string };

export function Notes({ topicId, notes }: { topicId: string; notes: NoteItem[] }) {
  const form = useForm<NoteForm>({ resolver: zodResolver(NoteForm), defaultValues: { body: "" } });
  const [pending, start] = useTransition();
  const uid = useId();

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const r = await addNote({ topicId, body: values.body });
      if (!r.ok) return void toast.error(r.error);
      form.reset();
      toast.success("Anotação salva");
    }),
  );

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor={`${uid}-note`} className="sr-only">
          Nova anotação
        </label>
        <Textarea
          id={`${uid}-note`}
          rows={3}
          placeholder="O que você aprendeu, dúvidas, links úteis…"
          aria-invalid={Boolean(form.formState.errors.body)}
          {...form.register("body")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
          }}
        />
        {form.formState.errors.body && <p className="text-sm text-danger">{form.formState.errors.body.message}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Ctrl+Enter para salvar</span>
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Salvar anotação
          </Button>
        </div>
      </form>

      {notes.length > 0 ? (
        <ul className="space-y-3">
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Suas anotações deste tópico aparecem aqui.</p>
      )}
    </div>
  );
}

function NoteRow({ note }: { note: NoteItem }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note.body);
  const [pending, start] = useTransition();

  return (
    <li className="rounded-md border bg-background p-3 text-sm">
      {editing ? (
        <div className="space-y-2">
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} aria-label="Editar anotação" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => (setEditing(false), setValue(note.body))}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await updateNote({ noteId: note.id, body: value });
                  if (!r.ok) return void toast.error(r.error);
                  setEditing(false);
                })
              }
            >
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap leading-relaxed">{note.body}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <time dateTime={note.created_at} suppressHydrationWarning>
              {relativeTime(note.created_at)}
              {note.updated_at !== note.created_at && " (editada)"}
            </time>
            <span className="flex gap-1">
              <button type="button" onClick={() => setEditing(true)} className="rounded p-1 hover:bg-accent hover:text-foreground" aria-label="Editar anotação">
                <Pencil className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Excluir esta anotação?")) return;
                  start(async () => {
                    const r = await deleteNote({ noteId: note.id });
                    if (!r.ok) toast.error(r.error);
                  });
                }}
                className="rounded p-1 hover:bg-accent hover:text-danger"
                aria-label="Excluir anotação"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </span>
          </div>
        </>
      )}
    </li>
  );
}

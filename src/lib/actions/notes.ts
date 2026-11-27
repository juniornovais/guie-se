"use server";

import { refresh } from "next/cache";
import { requireSession } from "@/lib/auth/dal";
import { NoteIdInput, NoteInput, NoteUpdateInput } from "@/lib/validations/progress";
import { parseInput, runAction } from "./result";

export async function addNote(input: { topicId: string; body: string }) {
  return runAction(async () => {
    const { topicId, body } = parseInput(NoteInput, input);
    const { user, supabase } = await requireSession();
    const { error } = await supabase.from("user_notes").insert({ user_id: user.id, topic_id: topicId, body });
    if (error) throw error;
    refresh();
  });
}

export async function updateNote(input: { noteId: string; body: string }) {
  return runAction(async () => {
    const { noteId, body } = parseInput(NoteUpdateInput, input);
    const { supabase } = await requireSession();
    const { error } = await supabase.from("user_notes").update({ body }).eq("id", noteId);
    if (error) throw error;
    refresh();
  });
}

export async function deleteNote(input: { noteId: string }) {
  return runAction(async () => {
    const { noteId } = parseInput(NoteIdInput, input);
    const { supabase } = await requireSession();
    const { error } = await supabase.from("user_notes").delete().eq("id", noteId);
    if (error) throw error;
    refresh();
  });
}

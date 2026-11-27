import { z } from "zod";

export const Uuid = z.uuid();

export const TopicIdInput = z.object({ topicId: Uuid });

export const NoteInput = z.object({
  topicId: Uuid,
  body: z.string().trim().min(1, "A anotação está vazia.").max(20_000),
});
export const NoteUpdateInput = z.object({ noteId: Uuid, body: NoteInput.shape.body });
export const NoteIdInput = z.object({ noteId: Uuid });

export const HeartbeatInput = z.object({
  sessionId: Uuid,
  durationSeconds: z.number().int().min(0).max(86_400),
});
export const ManualSessionInput = z.object({
  topicId: Uuid.optional(),
  minutes: z.number().int().min(1).max(720),
  date: z.iso.date(),
});

export const SettingsInput = z.object({
  timezone: z
    .string()
    .min(1)
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Fuso horário inválido"),
});

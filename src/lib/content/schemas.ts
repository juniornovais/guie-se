/**
 * Esquemas dos arquivos de conteúdo complementar em `content/`.
 *
 * - `content/meta/<etapa>.json`: descrições/objetivos de módulos, metadados de
 *   tópicos (resumo, objetivos, pré-requisitos, critérios, desafios planejados).
 * - `content/topics/<chave>/content.md`: conteúdo técnico do tópico.
 * - `content/topics/<chave>/challenges.md`: desafios completos do tópico.
 */
import { z } from "zod";

export const TOPIC_KEY = /^\d\.\d+\.\d+$/;
export const MODULE_KEY = /^\d\.\d+$/;

export const challengeTypes = [
  "conceptual",
  "interview",
  "coding",
  "code_analysis",
  "bug_hunt",
  "experiment",
  "implementation",
  "project",
] as const;
export const ChallengeType = z.enum(challengeTypes);
export type ChallengeType = z.infer<typeof ChallengeType>;

export const Level = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const PrerequisiteSchema = z.object({
  key: z.string().regex(TOPIC_KEY),
  kind: z.enum(["required", "recommended"]).default("recommended"),
  reason: z.string().min(5).optional(),
});

export const PlannedChallengeSchema = z.object({
  level: Level,
  type: ChallengeType,
  title: z.string().min(5),
});

export const TopicMetaSchema = z.object({
  summary: z.string().min(20),
  objectives: z.array(z.string().min(5)).min(3).max(8),
  estimatedMinutes: z.number().int().min(10).max(600),
  prerequisites: z.array(PrerequisiteSchema).default([]),
  checklist: z.array(z.string().min(5)).min(2).max(8),
  plannedChallenges: z.array(PlannedChallengeSchema).min(4).max(8),
});
export type TopicMeta = z.infer<typeof TopicMetaSchema>;

export const ModuleMetaSchema = z.object({
  description: z.string().min(40),
  objectives: z.array(z.string().min(5)).min(3).max(8),
});

export const StageMetaFileSchema = z.object({
  stage: z.string().regex(/^0[1-6]$/),
  modules: z.record(z.string().regex(MODULE_KEY), ModuleMetaSchema),
  topics: z.record(z.string().regex(TOPIC_KEY), TopicMetaSchema),
});
export type StageMetaFile = z.infer<typeof StageMetaFileSchema>;

/** Desafio completo (parseado de challenges.md). */
export const ChallengeSchema = z.object({
  key: z.string(),
  title: z.string().min(5),
  type: ChallengeType,
  level: Level,
  required: z.boolean(),
  additional: z.boolean().default(false),
  knowledge: z.array(z.string()).default([]),
  statement: z.string().min(10),
  objective: z.string().min(5),
  instructions: z.string().optional(),
  hints: z.array(z.string()).default([]),
  criteria: z.array(z.string()).min(1),
  solution: z.string().optional(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const ContentSectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  kind: z.enum(["section", "example", "diagram"]),
  additional: z.boolean(),
  body: z.string().min(1),
});
export type ContentSection = z.infer<typeof ContentSectionSchema>;

/**
 * Preferências do usuário (profiles.settings). Chaves antigas (critérios de
 * conclusão de versões anteriores) são ignoradas.
 */
export const UserSettingsSchema = z.object({
  timezone: z.string().default("America/Sao_Paulo"),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export function parseUserSettings(raw: unknown): UserSettings {
  const r = UserSettingsSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  return r.success ? r.data : UserSettingsSchema.parse({});
}

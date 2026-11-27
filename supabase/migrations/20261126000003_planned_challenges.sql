-- Migration 003: desafios planejados do inventário pedagógico.
-- Lista leve (nível, tipo, título) exibida enquanto os desafios completos de um
-- tópico ainda não foram escritos. Os desafios completos ficam em `challenges`.
alter table public.topics
  add column planned_challenges jsonb not null default '[]'::jsonb;

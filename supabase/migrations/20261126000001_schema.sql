-- =============================================================================
-- Guie-se — Plataforma pessoal de estudos (Roadmap Java Backend)
-- Migration 001: esquema principal
--
-- Dois grupos de tabelas:
--   1. Conteúdo (stages, modules, topics, topic_prerequisites, learning_contents,
--      challenges): compartilhado, somente leitura para usuários autenticados.
--      Escrito apenas pelo seed (conexão de banco / service role).
--   2. Dados do usuário (profiles, user_topic_progress, user_challenge_progress,
--      challenge_attempts, study_sessions, user_notes): isolados por RLS.
--
-- Identidade de conteúdo: cada registro de conteúdo tem uma `key` natural estável
-- (ex.: etapa "04", módulo "4.1", tópico "4.1.8"). O seed faz upsert por essa
-- chave, o que o torna idempotente. `position` define a ordem e pode ser
-- reorganizada sem mudar a identidade.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.topic_status as enum ('not_started', 'in_progress', 'completed');
create type public.challenge_status as enum ('not_started', 'attempting', 'solved', 'skipped');
create type public.content_status as enum ('planned', 'draft', 'ready');
create type public.content_kind as enum ('section', 'example', 'diagram');
create type public.prerequisite_kind as enum ('required', 'recommended');
create type public.challenge_type as enum (
  'conceptual',        -- Questão conceitual
  'interview',         -- Pergunta de entrevista técnica
  'coding',            -- Exercício de programação
  'code_analysis',     -- Análise de código
  'bug_hunt',          -- Identificação de bugs
  'experiment',        -- Experimento prático
  'implementation',    -- Implementação pequena
  'project'            -- Projeto progressivo
);
create type public.session_source as enum ('auto', 'manual');

-- ---------------------------------------------------------------------------
-- Utilitário: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- CONTEÚDO
-- ---------------------------------------------------------------------------
create table public.stages (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,                 -- "01" .. "06"
  slug        text not null unique,                 -- "fundamentos"
  position    integer not null,
  title       text not null,
  description text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  stage_id    uuid not null references public.stages (id) on delete restrict,
  key         text not null unique,                 -- "4.1"
  slug        text not null unique,                 -- "4-1-jvm"
  position    integer not null,
  title       text not null,
  description text,                                 -- complementar (o roadmap original não descreve módulos)
  objectives  text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index modules_stage_position_idx on public.modules (stage_id, position);

create table public.topics (
  id                  uuid primary key default gen_random_uuid(),
  module_id           uuid not null references public.modules (id) on delete restrict,
  key                 text not null unique,         -- "4.1.8"
  slug                text not null unique,         -- "4-1-8-garbage-collection"
  position            integer not null,
  title               text not null,
  summary             text,
  objectives          text[] not null default '{}',
  -- Critérios de conclusão específicos do tópico (sobrepõem as preferências do usuário).
  -- Formato: { "requireContentRead": bool, "requireRequiredChallenges": bool,
  --            "requireSelfAssessment": bool, "minSelfAssessment": 1..5,
  --            "checklist": ["critério textual", ...] }
  completion_criteria jsonb not null default '{}'::jsonb,
  estimated_minutes   integer,
  content_status      public.content_status not null default 'planned',
  is_additional       boolean not null default false, -- true = tópico complementar, fora do roadmap original
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index topics_module_position_idx on public.topics (module_id, position);

create table public.topic_prerequisites (
  topic_id        uuid not null references public.topics (id) on delete cascade,
  prerequisite_id uuid not null references public.topics (id) on delete cascade,
  kind            public.prerequisite_kind not null default 'recommended',
  reason          text,
  primary key (topic_id, prerequisite_id),
  constraint topic_prerequisites_no_self check (topic_id <> prerequisite_id)
);
create index topic_prerequisites_prereq_idx on public.topic_prerequisites (prerequisite_id);

create table public.learning_contents (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid not null references public.topics (id) on delete cascade,
  key           text not null,                      -- slug da seção dentro do tópico
  position      integer not null,
  kind          public.content_kind not null default 'section',
  title         text not null,
  body_md       text not null,
  is_additional boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (topic_id, key)
);
create index learning_contents_topic_position_idx on public.learning_contents (topic_id, position);

create table public.challenges (
  id                  uuid primary key default gen_random_uuid(),
  topic_id            uuid not null references public.topics (id) on delete cascade,
  key                 text not null unique,         -- "4.1.8.c1"
  slug                text not null unique,
  position            integer not null,
  title               text not null,
  type                public.challenge_type not null,
  level               smallint not null check (level between 1 and 4),
  statement_md        text not null,                -- Enunciado
  objective           text not null,                -- Objetivo
  required_knowledge  text[] not null default '{}', -- Conhecimentos necessários
  instructions_md     text,                         -- Instruções
  hints               text[] not null default '{}', -- Dicas progressivas (reveladas uma a uma)
  evaluation_criteria text[] not null default '{}', -- Critérios de avaliação
  reference_solution_md text,                       -- Solução de referência (oculta até ser solicitada)
  is_required         boolean not null default false,
  is_additional       boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index challenges_topic_position_idx on public.challenges (topic_id, position);

-- ---------------------------------------------------------------------------
-- DADOS DO USUÁRIO
-- ---------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text,
  display_name   text,
  avatar_url     text,
  last_topic_id  uuid references public.topics (id) on delete set null,
  last_topic_at  timestamptz,
  -- Preferências de conclusão (configuráveis pelo usuário).
  settings       jsonb not null default jsonb_build_object(
                   'requireContentRead', true,
                   'requireRequiredChallenges', true,
                   'requireSelfAssessment', true,
                   'minSelfAssessment', 3
                 ),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.user_topic_progress (
  user_id          uuid not null references auth.users (id) on delete cascade,
  topic_id         uuid not null references public.topics (id) on delete cascade,
  status           public.topic_status not null default 'in_progress',
  content_read_at  timestamptz,
  self_assessment  smallint check (self_assessment between 1 and 5),
  checklist_done   text[] not null default '{}',
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  reviewed_at      timestamptz,
  review_count     integer not null default 0,
  last_accessed_at timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index user_topic_progress_user_accessed_idx on public.user_topic_progress (user_id, last_accessed_at desc);

create table public.user_challenge_progress (
  user_id              uuid not null references auth.users (id) on delete cascade,
  challenge_id         uuid not null references public.challenges (id) on delete cascade,
  status               public.challenge_status not null default 'attempting',
  solution             text,
  notes                text,
  hints_revealed       smallint not null default 0,
  solution_revealed_at timestamptz,
  solved_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (user_id, challenge_id)
);
create index user_challenge_progress_user_updated_idx on public.user_challenge_progress (user_id, updated_at desc);

-- Histórico imutável de tentativas (cada envio de solução gera uma linha).
create table public.challenge_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  solution     text not null,
  notes        text,
  marked_solved boolean not null default false,
  created_at   timestamptz not null default now()
);
create index challenge_attempts_user_challenge_idx on public.challenge_attempts (user_id, challenge_id, created_at desc);

create table public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  topic_id         uuid references public.topics (id) on delete set null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  source           public.session_source not null default 'auto',
  created_at       timestamptz not null default now()
);
create index study_sessions_user_started_idx on public.study_sessions (user_id, started_at desc);

create table public.user_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  topic_id   uuid not null references public.topics (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_notes_user_topic_idx on public.user_notes (user_id, topic_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
create trigger stages_updated_at before update on public.stages for each row execute function public.set_updated_at();
create trigger modules_updated_at before update on public.modules for each row execute function public.set_updated_at();
create trigger topics_updated_at before update on public.topics for each row execute function public.set_updated_at();
create trigger learning_contents_updated_at before update on public.learning_contents for each row execute function public.set_updated_at();
create trigger challenges_updated_at before update on public.challenges for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger user_topic_progress_updated_at before update on public.user_topic_progress for each row execute function public.set_updated_at();
create trigger user_challenge_progress_updated_at before update on public.user_challenge_progress for each row execute function public.set_updated_at();
create trigger user_notes_updated_at before update on public.user_notes for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Criação automática do perfil ao cadastrar usuário (login Google)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

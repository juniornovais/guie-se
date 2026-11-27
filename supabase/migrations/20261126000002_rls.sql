-- =============================================================================
-- Migration 002: Row Level Security e privilégios
--
-- Princípios:
--   * `anon` não acessa nenhuma tabela (toda a plataforma exige login).
--   * Conteúdo: `authenticated` apenas lê. Escrita só pelo seed (role postgres
--     ou service_role, que ignoram RLS e nunca vão para o navegador).
--   * Dados do usuário: cada linha pertence a `user_id = auth.uid()`.
--   * Privilégios de coluna limitam o que o próprio usuário pode alterar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Privilégios de tabela (defesa em profundidade, além da RLS)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

-- Conteúdo: somente leitura
grant select on public.stages, public.modules, public.topics, public.topic_prerequisites,
               public.learning_contents, public.challenges
  to authenticated;

-- Perfil: leitura e atualização de colunas específicas (inserção feita pelo trigger)
grant select on public.profiles to authenticated;
grant update (display_name, last_topic_id, last_topic_at, settings) on public.profiles to authenticated;

-- Progresso e registros pessoais
grant select, insert, update, delete on public.user_topic_progress to authenticated;
grant select, insert, update, delete on public.user_challenge_progress to authenticated;
grant select, insert on public.challenge_attempts to authenticated;           -- histórico imutável
grant select, insert, update, delete on public.study_sessions to authenticated;
grant select, insert, update, delete on public.user_notes to authenticated;

-- Novas tabelas não herdam acesso automaticamente
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;

-- ---------------------------------------------------------------------------
-- Habilitar RLS em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.stages              enable row level security;
alter table public.modules             enable row level security;
alter table public.topics              enable row level security;
alter table public.topic_prerequisites enable row level security;
alter table public.learning_contents   enable row level security;
alter table public.challenges          enable row level security;
alter table public.profiles            enable row level security;
alter table public.user_topic_progress enable row level security;
alter table public.user_challenge_progress enable row level security;
alter table public.challenge_attempts  enable row level security;
alter table public.study_sessions      enable row level security;
alter table public.user_notes          enable row level security;

-- ---------------------------------------------------------------------------
-- Conteúdo: leitura para autenticados
-- ---------------------------------------------------------------------------
create policy "content readable by authenticated" on public.stages
  for select to authenticated using (true);
create policy "content readable by authenticated" on public.modules
  for select to authenticated using (true);
create policy "content readable by authenticated" on public.topics
  for select to authenticated using (true);
create policy "content readable by authenticated" on public.topic_prerequisites
  for select to authenticated using (true);
create policy "content readable by authenticated" on public.learning_contents
  for select to authenticated using (true);
create policy "content readable by authenticated" on public.challenges
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------------
create policy "profile: select own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profile: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Tabelas com user_id: o usuário só vê e altera as próprias linhas
-- ---------------------------------------------------------------------------
create policy "own rows: select" on public.user_topic_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.user_topic_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.user_topic_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.user_topic_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own rows: select" on public.user_challenge_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.user_challenge_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.user_challenge_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.user_challenge_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own rows: select" on public.challenge_attempts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.challenge_attempts
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "own rows: select" on public.study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.study_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.study_sessions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.study_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own rows: select" on public.user_notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.user_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.user_notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.user_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- View de atividades recentes (security_invoker => respeita a RLS do chamador)
-- ---------------------------------------------------------------------------
create view public.user_activity
with (security_invoker = true)
as
  select p.user_id, 'topic_started'::text as kind, p.topic_id, null::uuid as challenge_id, p.started_at as occurred_at
    from public.user_topic_progress p
  union all
  select p.user_id, 'topic_completed', p.topic_id, null, p.completed_at
    from public.user_topic_progress p where p.completed_at is not null
  union all
  select p.user_id, 'topic_reviewed', p.topic_id, null, p.reviewed_at
    from public.user_topic_progress p where p.reviewed_at is not null
  union all
  select a.user_id, case when a.marked_solved then 'challenge_solved' else 'challenge_attempted' end,
         c.topic_id, a.challenge_id, a.created_at
    from public.challenge_attempts a join public.challenges c on c.id = a.challenge_id
  union all
  select n.user_id, 'note_added', n.topic_id, null, n.created_at
    from public.user_notes n;

revoke all on public.user_activity from anon;
grant select on public.user_activity to authenticated;

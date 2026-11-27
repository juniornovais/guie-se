# Arquitetura

## 1. Arquitetura escolhida

Uma única aplicação **Next.js 16 (App Router)**, com **Supabase** (PostgreSQL + Auth) como único serviço externo. Não há backend separado, filas nem microsserviços.

| Camada | Responsabilidade | Onde |
|---|---|---|
| Páginas (Server Components) | Ler dados e renderizar | `src/app/(app)/**/page.tsx` |
| Componentes interativos (Client) | Formulários, mapa, autosave, medição de tempo | `src/components/**` |
| Server Actions | Toda escrita (progresso, notas, tempo de estudo, preferências) | `src/lib/actions/*.ts` |
| Route Handler | Somente o retorno do OAuth | `src/app/auth/callback/route.ts` |
| Proxy | Renovação da sessão e redirecionamento para `/login` | `src/proxy.ts` |
| Serviços / repositórios | Consultas ao banco | `src/services/*.ts` |
| Domínio (puro, testado) | Ordem recomendada, sequência de dias, conquistas | `src/lib/domain/*.ts` |
| Validação | Esquemas Zod de entrada e de conteúdo | `src/lib/validations`, `src/lib/content/schemas.ts` |
| Autenticação | DAL de sessão, actions de login e logout | `src/lib/auth/*` |
| Banco | Esquema, RLS e trigger de perfil | `supabase/migrations/*.sql` |
| Conteúdo | Roadmap oficial e complementos | `content/` |

### Justificativa da stack

- **Next.js** concentra interface, autenticação e lógica num só projeto: Server Components leem, Server Actions escrevem, sem uma API REST manual.
- **Cache Components** (padrão do Next 16) está ativo. Cada página tem um *shell* estático, e os dados do usuário chegam por streaming dentro de `<Suspense>`, o que também dá os estados de carregamento.
- **Supabase** oferece PostgreSQL gerenciado, Auth com Google e **RLS**. A segurança fica no banco, não só nas páginas.
- **shadcn/ui + Tailwind** fornecem componentes acessíveis (Radix) sem uma biblioteca de UI pesada.
- **TanStack Query não foi usado**: todos os dados vêm de Server Components e `refresh()` após as mutações, então não houve necessidade real. **React Hook Form + Zod** atendem os formulários com validação no cliente e no servidor.
- Dependências adicionadas além da stack pedida, cada uma com motivo:
  - `react-markdown`, `remark-gfm`, `rehype-slug`: renderizar o conteúdo Markdown sem executar HTML.
  - `next-themes`: tema escuro sem piscar na carga.
  - `pg` e `tsx`: o seed.
  - `vitest` e `@playwright/test`: testes.

## 2. Diagrama

```text
                    ┌──────────────────────── Render ────────────────────────┐
 Navegador ───────▶ │ proxy.ts  (renova sessão, exige login)                  │
   ▲   │            │   │                                                     │
   │   │ Server     │ Server Components ──▶ services/* ──┐                   │
   │   │ Actions    │ Server Actions ──▶ Zod ──▶ services ┼──▶ Supabase JS ───┼──┐
   │   └──────────▶ │ /auth/callback (troca code PKCE por sessão)  │          │  │
   │                └───────────────────────────────────────────────────────┘  │
   │                                                                             ▼
   │                ┌──────────────────────── Supabase ───────────────────────────┐
   └── Google ◀───▶ │ Auth (OAuth Google, JWT)   PostgreSQL + RLS (auth.uid())     │
                    └──────────────────────────────────────────────────────────────┘
                                   ▲
       npm run db:seed (pg) ───────┘  lê content/ (roadmap oficial + complementos)
```

## 3. Modelo de dados

```text
stages 1──N modules 1──N topics 1──N learning_contents
                          │  1──N challenges 1──N challenge_attempts N──1 auth.users
                          │  N──N topics (topic_prerequisites: required | recommended)
auth.users 1──1 profiles (last_topic_id → topics, settings jsonb)
auth.users 1──N user_topic_progress     N──1 topics      PK (user_id, topic_id)
auth.users 1──N user_challenge_progress N──1 challenges  PK (user_id, challenge_id)
auth.users 1──N study_sessions          N──1 topics (opcional)
auth.users 1──N user_notes              N──1 topics
view user_activity (security_invoker): união de eventos de progresso, tentativas e notas
```

Avaliação das entidades sugeridas: todas foram mantidas.

- `user_challenge_progress` guarda o estado atual: rascunho, status, dicas reveladas e quando a solução foi vista.
- `challenge_attempts` é o histórico imutável de tentativas, sem `update` nem `delete` para o usuário.
- `topics.planned_challenges` guarda as ideias de prática exibidas (só títulos) na página do tópico.
- As tabelas `challenges`, `user_challenge_progress` e `challenge_attempts` e as colunas de critérios (`content_read_at`, `self_assessment`, `checklist_done`) vêm de uma versão anterior com desafios resolvíveis e critérios de conclusão. Continuam no esquema, protegidas por RLS, mas a interface não as usa mais.
- Toda entidade de conteúdo tem uma **chave natural estável** (`04`, `4.1`, `4.1.8`, `4.1.8.c1`) e um campo `position` separado. Assim é possível reorganizar a ordem sem perder a identidade nem o progresso.

## 4. Fluxo de autenticação

1. `/login` chama a Server Action `signInWithGoogle`, que pede ao Supabase a URL do Google (PKCE; o *code verifier* vai num cookie).
2. Google → Supabase Auth → `/auth/callback?code=…&next=…`.
3. O callback troca o `code` pela sessão (cookies httpOnly) e redireciona para `next`, sanitizado contra open redirect.
4. O trigger `on_auth_user_created` cria o perfil com nome e avatar do Google.
5. A cada requisição, o `proxy.ts` renova o token se preciso e manda visitantes sem sessão para `/login?next=…`.
6. Leituras usam `getCurrentUser()` / `requireSession()` (DAL), que **valida o JWT** com `getClaims()`. Cada Server Action chama `requireSession()` de novo e não confia no cliente.
7. Logout: a Server Action `signOut` encerra a sessão e redireciona para `/login`.

## 5. Políticas RLS

| Tabelas | anon | authenticated |
|---|---|---|
| `stages`, `modules`, `topics`, `topic_prerequisites`, `learning_contents`, `challenges` | nada | `select` |
| `profiles` | nada | `select` / `update` só da própria linha, e `update` só das colunas `display_name`, `last_topic_id`, `last_topic_at`, `settings` |
| `user_topic_progress`, `user_challenge_progress`, `study_sessions`, `user_notes` | nada | CRUD só onde `user_id = auth.uid()` |
| `challenge_attempts` | nada | `select`/`insert` só das próprias linhas (sem alteração) |
| `user_activity` (view) | nada | `security_invoker`: herda a RLS acima |

Também há privilégios explícitos (`grant`) e a revogação dos privilégios padrão: uma tabela nova nasce inacessível até ganhar políticas. A cobertura está em `tests/integration/rls.test.ts`, com dois usuários reais e a chave pública.

## 6. Estratégia de seed

- O seed **lê o próprio `ROADMAP_JAVA_BACKEND.md`** (`src/lib/content/parse-roadmap.ts`). Nada da estrutura é copiado à mão.
- Os complementos (`content/meta`, `content/topics`) são validados com Zod e checados contra o roadmap: chaves existentes, pré-requisitos sem ciclos e os 4 níveis de desafio.
- O seed faz upsert por chave natural dentro de uma transação, então é **idempotente**.
- Etapas, módulos, tópicos e desafios **nunca são apagados**; registros que sumiram da fonte são apenas reportados.
- Seções de conteúdo e pré-requisitos, que não têm dados de usuário, são sincronizados.
- `tests/integration/seed.test.ts` prova: 6/24/236, ordem original preservada e progresso intacto após rodar o seed de novo.
- O rodapé do roadmap declara 23 módulos e 223 tópicos, mas o corpo contém 24 e 236. Prevalece o corpo (ver `docs/INVENTARIO.md`).

## 7. Persistência do progresso

| Evento | Onde dispara | O que grava |
|---|---|---|
| Abrir um tópico | `StudyTracker` (efeito no cliente, nunca no render ou prefetch) | progresso "em andamento" (se novo), `last_accessed_at`, `profiles.last_topic_id` |
| Tempo de estudo | Heartbeat a cada 30 s (só com aba visível e interação recente) | `study_sessions.duration_seconds` |
| Concluir tópico | Um clique no `CompletionPanel` | `status = completed`, `completed_at` |
| Revisar | Action | `reviewed_at`, `review_count` |
| Anotação | Action | `user_notes` |

Ao entrar de novo, em qualquer navegador, tudo é lido do banco. Nada depende de `localStorage`; a única exceção é a preferência de tema.

### Ordem recomendada

A ordem original do roadmap passa por uma ordenação topológica **estável** sobre os pré-requisitos (`src/lib/domain/order.ts`). Um tópico só é antecipado quando um pré-requisito dele aparece depois na ordem original, por exemplo BD I (3.4) antes de BD II (3.2). Nada é bloqueado.

## 8. Testes

| Comando | O que cobre |
|---|---|
| `npm test` | Parser do roadmap, inventário, configurações, conquistas, ordem recomendada, sequência de dias, redirecionamento seguro, RLS e seed (integração com o Supabase local) |
| `npm run test:e2e` | Login, jornada completa com persistência entre sessões, isolamento entre usuários, mobile, tema escuro e ausência de overflow horizontal |
| `npm run content:check -- --strict` | Integridade do conteúdo contra o roadmap |

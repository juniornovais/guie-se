# Guie-se

Plataforma pessoal de estudos do **Roadmap Java Backend**: 6 etapas, 24 módulos e 236 tópicos, do funcionamento da CPU ao design de sistemas distribuídos. Cada tópico tem objetivos, pré-requisitos, anotações e conclusão com um clique; alguns têm texto de estudo opcional e todos listam ideias de prática opcionais. O progresso, a sequência de dias e o tempo de estudo ficam salvos por usuário, com login Google.

**Stack:** Next.js 16 (App Router, Server Components, Server Actions), TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth + RLS), Zod, React Hook Form. Hospedagem na Vercel.

## Começar (ambiente local)

Requisitos: Node 20+ e Docker em execução.

```bash
npm install
npm run db:start                 # Supabase local (Postgres + Auth) e migrations
npx supabase status -o env       # copie URL e chaves para o .env.local
cp .env.example .env.local
npm run db:seed                  # carrega o roadmap
npm run dev                      # http://localhost:3000
```

Sem credenciais Google, ative `DEV_EMAIL_LOGIN=true` no `.env.local` para usar o login de desenvolvimento. Ele só funciona em `next dev`.

## Scripts

| Script | Função |
|---|---|
| `npm run dev` / `build` / `start` | Aplicação |
| `npm run typecheck` / `lint` | Qualidade |
| `npm test` | Testes unitários e de integração (Supabase local) |
| `npm run test:e2e` | Testes ponta a ponta (Playwright) |
| `npm run db:start` / `db:stop` / `db:reset` | Supabase local |
| `npm run db:migrate` | Aplica migrations locais pendentes |
| `npm run db:seed` | Seed idempotente do roadmap (usa `DATABASE_URL`) |
| `npm run db:types` | Regenera os tipos TypeScript do banco |
| `npm run content:check` | Valida `content/` contra o roadmap oficial |
| `npm run inventory` | Gera `docs/INVENTARIO.md` |

## Estrutura

```text
content/                 Roadmap oficial + complementos (fonte do seed)
  ROADMAP_JAVA_BACKEND.md
  meta/0X.json           objetivos, pré-requisitos e ideias de prática por tópico
  topics/<chave>/        content.md e challenges.md de cada tópico
docs/                    ARQUITETURA, DEPLOY, INVENTARIO, instruções originais
scripts/                 seed, validação de conteúdo, inventário
supabase/migrations/     esquema, RLS, ajustes
src/
  app/(auth)/login       login
  app/(app)/             início, roadmap, módulos, estudo, evolução, configurações
  app/auth/callback      retorno do OAuth
  components/            ui (shadcn), layout, roadmap, study, challenges, evolution, settings
  lib/                   supabase, auth, actions, domain (regras puras), content, validations
  services/              consultas ao banco
  proxy.ts               sessão e proteção de rotas
tests/                   unitários, integração (RLS, seed) e e2e
```

## Documentação

- [Arquitetura](docs/ARQUITETURA.md): decisões, modelo de dados, RLS, fluxos de autenticação e persistência.
- [Configuração e publicação](docs/DEPLOY.md): Supabase, Google OAuth, Vercel, migrations, seed e backup.
- [Inventário do roadmap](docs/INVENTARIO.md): todas as etapas, módulos, tópicos, objetivos, pré-requisitos, desafios planejados e critérios.

## Situação do conteúdo

| Conteúdo | Cobertura |
|---|---|
| Etapas, módulos, tópicos e ordem (roadmap oficial) | 236 de 236 |
| Objetivos, pré-requisitos e ideias de prática (opcionais) | 236 de 236 |
| Texto de estudo (leitura opcional) | 18 de 236: Etapa 01 Fundamentos |

Concluir um tópico é um clique: não depende de leitura nem de desafios. Os arquivos `challenges.md` da Etapa 01 continuam no repositório e no banco, mas não aparecem na interface.

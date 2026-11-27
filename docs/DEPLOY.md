# Configuração e publicação

Guia passo a passo para colocar o Guie-se no ar com **Vercel** (aplicação Next.js) e **Supabase** (PostgreSQL + Auth), com login Google.

Ordem recomendada: 1) Supabase → 2) Google OAuth → 3) Supabase Auth → 4) Vercel → 5) verificação.

---

## Visão geral

```text
Navegador ──HTTPS──▶ Vercel (Next.js: páginas, Server Actions, /auth/callback)
    │                        │
    │                        └──▶ Supabase (PostgreSQL com RLS + Auth)
    └── login ──▶ Google ──▶ Supabase Auth ──▶ /auth/callback
```

| Onde | Variáveis | Observação |
|---|---|---|
| Vercel | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` | Únicas variáveis da aplicação. São públicas por natureza (a RLS protege os dados). |
| Sua máquina, só para o seed | `DATABASE_URL` | Connection string do Postgres. **Nunca** configure na Vercel. |
| Supabase Dashboard | Client ID e Secret do Google | Ficam no Supabase, não na aplicação. |

> A chave `service_role`/secret do Supabase **não é usada pela aplicação**. Ela só aparece no `.env.local` para os testes de integração locais. Não a coloque na Vercel.

---

## 1. Projeto Supabase

1. Crie um projeto em [supabase.com/dashboard](https://supabase.com/dashboard). Guarde a senha do banco.
2. Em **Project Settings → API**, copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (ou a chave `anon` em projetos antigos) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Vincule o repositório ao projeto e aplique as migrations:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   `db push` aplica, em ordem, os arquivos de `supabase/migrations/`: esquema, RLS e políticas, desafios planejados.

4. Rode o seed do roadmap contra o banco de produção. Use a connection string em **Project Settings → Database → Connection string**. Prefira o **Session pooler** (porta 5432), que funciona em redes sem IPv6.

   ```bash
   # bash
   DATABASE_URL="postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres" npm run db:seed
   ```

   ```powershell
   # PowerShell
   $env:DATABASE_URL = "postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:5432/postgres"
   npm run db:seed
   Remove-Item Env:DATABASE_URL
   ```

   Saída esperada: `Seed concluído: {"stages":6,"modules":24,"topics":236,...}`. O seed é **idempotente**: pode ser executado quantas vezes for preciso, sem duplicar registros e sem apagar progresso de usuários.

---

## 2. Credenciais OAuth no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e crie (ou escolha) um projeto.
2. **APIs & Services → OAuth consent screen**:
   - Tipo de usuário: **External**.
   - Preencha nome do app e e-mail de suporte.
   - Escopos: os padrões (`openid`, `email`, `profile`) bastam.
   - Enquanto o app estiver em modo **Testing**, adicione sua conta Google em **Test users**. Para uso pessoal, não é preciso publicar o app.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Tipo: **Web application**.
   - **Authorized JavaScript origins**: a URL da aplicação, por exemplo `https://guie-se.vercel.app`.
   - **Authorized redirect URIs**: a URL de callback **do Supabase** (não a da aplicação):

     ```text
     https://<project-ref>.supabase.co/auth/v1/callback
     ```

4. Copie o **Client ID** e o **Client Secret**.

---

## 3. Supabase Auth

1. **Authentication → Sign In / Providers → Google**: habilite e cole o Client ID e o Client Secret.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://<seu-domínio>` (produção).
   - **Redirect URLs**, uma por linha:

     ```text
     https://<seu-domínio>/auth/callback
     http://localhost:3000/auth/callback
     https://*-<seu-time>.vercel.app/auth/callback
     ```

     A última linha cobre os deploys de preview da Vercel.

O perfil do usuário (`public.profiles`) é criado automaticamente pelo trigger `on_auth_user_created` no primeiro login.

---

## 4. Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new). O framework é detectado como Next.js, sem configuração extra.
2. **Settings → Environment Variables**:

   | Variável | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ✔ | ✔ |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✔ | ✔ |
   | `NEXT_PUBLIC_SITE_URL` | `https://<seu-domínio>` | **deixe vazio** |

   Sem `NEXT_PUBLIC_SITE_URL`, o preview usa o próprio host como destino do login. Com o valor de produção, o login de um preview voltaria para produção.

   Não configure `DATABASE_URL`, `SUPABASE_SECRET_KEY` nem `DEV_EMAIL_LOGIN`. O login por e-mail de desenvolvimento só funciona em `next dev` (`NODE_ENV=development`), mas não há motivo para expor essa variável.

3. Faça o deploy. O build falha de propósito se as variáveis do Supabase estiverem ausentes (`src/lib/env.ts`).

---

## 5. Verificação pós-deploy

- [ ] Abrir `https://<seu-domínio>/` sem sessão redireciona para `/login`.
- [ ] "Entrar com Google" leva à tela do Google e volta para a página inicial.
- [ ] Em **Supabase → Table editor → profiles** aparece seu perfil.
- [ ] Abrir um tópico e voltar à página inicial mostra "Último estudo".
- [ ] Em outro navegador ou aba anônima, depois do login, o mesmo progresso aparece.
- [ ] **Supabase → Advisors → Security** não acusa tabelas sem RLS.

---

## Desenvolvimento local

Requisitos: Node 20+, Docker em execução.

```bash
npm install
npm run db:start          # sobe Postgres + Auth locais (Docker) e aplica as migrations
npx supabase status -o env  # mostra URL e chaves locais
cp .env.example .env.local  # preencha com os valores do status
npm run db:seed
npm run dev               # http://localhost:3000
```

Sem credenciais Google, use o **login de desenvolvimento** (`DEV_EMAIL_LOGIN=true` no `.env.local`): ele aparece na tela de login apenas em `next dev` e cria o usuário no Supabase local.

### Login Google no ambiente local (opcional)

1. No OAuth client do Google, adicione o redirect URI `http://127.0.0.1:54321/auth/v1/callback`.
2. Em `supabase/.env` (não versionado; veja `supabase/.env.example`):

   ```text
   SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<client id>
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<client secret>
   ```

3. `npm run db:stop && npm run db:start`.

---

## Migrations

- Novas alterações de esquema: `npx supabase migration new <nome>`, edite o SQL gerado e rode `npm run db:migrate` localmente.
- Depois de alterar o esquema: `npm run db:types` para regenerar `src/types/database.ts`.
- Publicar em produção: `npx supabase db push`.
- Toda tabela nova precisa de `enable row level security`, políticas e `grant` explícitos. Os privilégios padrão do schema `public` foram revogados na migration 002, então uma tabela nova nasce **inacessível**, o que é intencional.

## Atualizar o conteúdo do roadmap

O conteúdo vive em `content/` (nunca nos componentes):

| Arquivo | Conteúdo |
|---|---|
| `content/ROADMAP_JAVA_BACKEND.md` | Fonte oficial: etapas, descrições, módulos, tópicos e ordem |
| `content/meta/0X.json` | Descrições de módulos, objetivos, pré-requisitos, critérios e desafios planejados |
| `content/topics/<chave>/content.md` | Texto técnico do tópico (seções `##`) |
| `content/topics/<chave>/challenges.md` | Desafios completos (carregados no banco, mas não exibidos na interface atual) |

```bash
npm run content:check -- --strict   # valida tudo contra o roadmap e os esquemas
npm run inventory                   # regenera docs/INVENTARIO.md
npm run db:seed                     # aplica localmente
DATABASE_URL="<produção>" npm run db:seed   # aplica em produção
```

O seed nunca apaga tópicos nem desafios. Se algo sair da fonte, ele apenas avisa, porque os usuários podem ter progresso associado.

## Backup do banco

O que importa preservar são as tabelas de usuário (`profiles`, `user_*`, `challenge_attempts`, `study_sessions`). O conteúdo pode ser recriado pelo seed.

1. **Backups do Supabase**: veja em **Database → Backups** o que o seu plano inclui (frequência e retenção variam por plano).
2. **Dump manual** (recomendado periodicamente, independentemente do plano). Requer o projeto vinculado (`supabase link`) e Docker:

   ```bash
   npx supabase db dump -f backups/schema.sql                  # esquema
   npx supabase db dump --data-only -f backups/dados.sql       # dados (public)
   ```

   A pasta `backups/` está no `.gitignore`: os dumps contêm dados pessoais e não devem ir para o repositório.

3. **Restaurar** em um banco novo: aplique as migrations (`db push`) e depois os dados:

   ```bash
   psql "<connection string>" -f backups/dados.sql
   ```

## Checklist de segurança

- RLS habilitada em todas as tabelas; `anon` sem acesso; conteúdo somente leitura; dados de usuário restritos a `auth.uid()` (testado em `tests/integration/rls.test.ts`).
- Server Actions revalidam a sessão no servidor e validam a entrada com Zod.
- Redirecionamento pós-login sanitizado (sem open redirect).
- Nenhuma chave secreta no bundle do navegador; `.env*` fora do git (exceto `.env.example`).

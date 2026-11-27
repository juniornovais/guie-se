# Configuração e publicação

Guia passo a passo para colocar o Guie-se no ar com **Render** (aplicação Next.js) e **Supabase** (PostgreSQL + Auth), com login Google.

Aplique as migrations e rode o seed no Supabase. Crie o serviço no Render para obter sua URL pública e use essa URL na configuração do login com Google.

---

## Visão geral

```text
Navegador ──HTTPS──▶ Render (Next.js: páginas, Server Actions, /auth/callback)
    │                        │
    │                        └──▶ Supabase (PostgreSQL com RLS + Auth)
    └── login ──▶ Google ──▶ Supabase Auth ──▶ /auth/callback
```

| Onde | Variáveis | Observação |
|---|---|---|
| Render | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` | Variáveis públicas da aplicação. A RLS protege os dados. |
| Sua máquina, só para o seed | `DATABASE_URL` | String de conexão do Postgres. |
| Supabase Dashboard | Client ID e Client Secret do Google | Credenciais do provedor de login. |

> Reserve `SUPABASE_SECRET_KEY` para os testes de integração locais.

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
   - Em **Authorized JavaScript origins**, informe a URL pública da aplicação, por exemplo `https://guie-se.onrender.com`.
   - **Authorized redirect URIs**: a URL de callback **do Supabase** (não a da aplicação):

     ```text
     https://<project-ref>.supabase.co/auth/v1/callback
     ```

4. Copie o **Client ID** e o **Client Secret**.

---

## 3. Supabase Auth

1. **Authentication → Sign In / Providers → Google**: habilite e cole o Client ID e o Client Secret.
2. **Authentication → URL Configuration**:
   - Em **Site URL**, informe a URL pública do serviço, por exemplo `https://guie-se.onrender.com`.
   - **Redirect URLs**, uma por linha:

     ```text
     https://guie-se.onrender.com/auth/callback
     http://localhost:3000/auth/callback
     ```

     Substitua `guie-se.onrender.com` pelo domínio do seu serviço. A entrada `localhost` permite testar a aplicação local com o mesmo Supabase hospedado.

O perfil do usuário (`public.profiles`) é criado automaticamente pelo trigger `on_auth_user_created` no primeiro login.

### Cadastro por e-mail e senha

Em **Authentication → Sign In / Providers**, habilite **Email** e permita novos cadastros. Com **Confirm email** ativo, o Guie-se usa as URLs `/auth/callback` acima. Mantenha o link do template **Confirm signup** apontando para `{{ .ConfirmationURL }}`. O usuário abre o link no mesmo navegador em que iniciou o cadastro. [Cadastro por e-mail no Supabase](https://supabase.com/docs/guides/auth/passwords)

Se a confirmação abrir `localhost` em produção, confira o domínio em **Site URL**, **Redirect URLs** e `NEXT_PUBLIC_SITE_URL` no Render. Depois do deploy, teste com um novo cadastro iniciado no site público. Se o clique anterior já confirmou o endereço, entre com e-mail e senha pelo site público. [URLs de redirecionamento no Supabase](https://supabase.com/docs/guides/auth/redirect-urls)

O SMTP padrão do Supabase envia até dois e-mails de autenticação por hora por projeto e atende apenas endereços da equipe. Configure um provedor em **Authentication → Emails → SMTP Settings** para receber cadastros externos. Em **Authentication → Rate Limits**, confira o limite de envio do projeto. Para distinguir um limite de envio de um bloqueio de requisições, consulte o código do erro nos logs de Auth. [Configuração de SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Limites de requisições](https://supabase.com/docs/guides/auth/rate-limits)

---

## 4. Render

O [Blueprint do projeto](../render.yaml) descreve o serviço Node `guie-se` no plano Free. Se o serviço já existe no Render, use as configurações abaixo no painel dele. [Blueprints do Render](https://render.com/docs/infrastructure-as-code)

1. No painel do Render, selecione **New → Web Service** e conecte o repositório GitHub. Use **Node** como linguagem e a raiz do repositório como diretório. [Deploy de Next.js no Render](https://render.com/docs/deploy-nextjs-app)
2. Configure os comandos **Build Command** `npm ci && npm run build` e **Start Command** `npm start`. O `next start` usa a variável `PORT` do Render. [Portas de Web Services](https://render.com/docs/web-services#port-binding)
3. Em **Environment**, adicione as variáveis antes do build.

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase hospedado |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key do mesmo projeto |
   | `NEXT_PUBLIC_SITE_URL` | URL pública do serviço, por exemplo `https://guie-se.onrender.com`. Se estiver ausente ou apontar para localhost, a aplicação usa `RENDER_EXTERNAL_URL` no Render. |

4. Faça o deploy e confira a URL atribuída pelo Render. Se precisar corrigir `NEXT_PUBLIC_SITE_URL`, use **Save, rebuild, and deploy**. Use a mesma URL nas configurações do Google Cloud e do Supabase Auth. [Variáveis de ambiente no Render](https://render.com/docs/configure-environment-variables)

O Next.js usa `RENDER_GIT_COMMIT` para identificar a versão do site. Se aparecer `Failed to find Server Action` depois de um deploy, recarregue a aba de login e envie o formulário novamente. [Identificador de deploy no Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId)

Se configurar **Health Check Path**, use `/login`. Aplique as migrations e carregue o roadmap no Supabase conforme a seção 1 para que o app consiga consultar os tópicos após o login.

---

## 5. Verificação pós-deploy

- [ ] Abrir `https://<seu-domínio>/` sem sessão redireciona para `/login`.
- [ ] "Criar conta" permite cadastrar e-mail e senha. Com a confirmação ativa, o link no e-mail conclui o acesso.
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

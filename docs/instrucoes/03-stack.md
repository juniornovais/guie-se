# ARQUITETURA TÉCNICA — ROADMAP JAVA BACKEND

Atue como arquiteto de software sênior.

Quero definir uma arquitetura simples, moderna e eficiente para desenvolver minha plataforma pessoal de estudos.

Uma decisão importante já foi tomada: quero utilizar Next.js para concentrar a aplicação em um único projeto.

Não quero criar um frontend separado e um backend independente em Java. O Java será o principal conteúdo de aprendizado da plataforma, não a tecnologia utilizada para construir a própria plataforma.

## 1. Stack definida

Utilize como ponto de partida:

### Aplicação
- Next.js.
- React.
- TypeScript.
- App Router.
- Server Components.
- Server Actions.
- Route Handlers quando necessário.

### Interface
- Tailwind CSS.
- shadcn/ui.
- Lucide Icons.
- Componentes responsivos.

### Dados e estado
- TanStack Query somente quando realmente necessário.
- React Hook Form.
- Zod para validações.

### Banco de dados e autenticação
- Supabase.
- PostgreSQL.
- Supabase Auth.
- Login com Google OAuth.
- @supabase/ssr para integração com Next.js.

### Infraestrutura
- Vercel para hospedagem da aplicação.
- Supabase para banco de dados e autenticação.

Não introduza tecnologias adicionais sem necessidade real.

## 2. Arquitetura

Quero manter tudo em um único repositório Next.js.

A aplicação deverá concentrar:

- Interface.
- Autenticação.
- Lógica de negócio.
- Consultas ao banco.
- Atualização do progresso.
- Gerenciamento dos conteúdos.
- Gerenciamento dos desafios.

Utilize Server Components para leitura de dados sempre que fizer sentido.

Utilize Server Actions para operações internas de criação, atualização e exclusão.

Utilize Route Handlers para endpoints que realmente precisem ser expostos.

Evite criar uma API REST completa sem necessidade.

Mantenha separação lógica entre:
- Componentes.
- Páginas.
- Serviços.
- Repositórios de dados.
- Validações.
- Tipos.
- Autenticação.

Não transforme o projeto em uma arquitetura excessivamente complexa.

## 3. Banco de dados

Utilize PostgreSQL através do Supabase.

O roadmap deverá ser armazenado de maneira estruturada.

Considere as seguintes entidades:

- profiles
- stages
- modules
- topics
- topic_prerequisites
- learning_contents
- challenges
- challenge_attempts
- user_topic_progress
- user_challenge_progress
- study_sessions
- user_notes

Avalie a necessidade de cada entidade e proponha uma modelagem adequada.

### Requisitos importantes

O sistema deverá permitir:

- Cadastrar as seis etapas do roadmap.
- Cadastrar módulos dentro das etapas.
- Cadastrar tópicos dentro dos módulos.
- Organizar tópicos em uma ordem específica.
- Criar pré-requisitos.
- Associar desafios aos tópicos.
- Armazenar conteúdos de estudo.
- Registrar o progresso individual.
- Armazenar tentativas de resolução.
- Registrar anotações pessoais.
- Recuperar o último ponto de estudo.

O conteúdo do roadmap não deve ficar codificado diretamente nos componentes React.

Crie uma estrutura que permita adicionar e reorganizar conteúdos futuramente.

## 4. Autenticação Google

Quero entrar na plataforma utilizando minha conta Google.

Implemente o fluxo com Supabase Auth.

Requisitos:

- Login com Google.
- Criação automática do perfil.
- Persistência da sessão.
- Logout.
- Proteção das páginas privadas.
- Recuperação da sessão ao atualizar a página.
- Associação de todos os registros ao usuário autenticado.

A segurança é fundamental.

Utilize Row Level Security (RLS) no PostgreSQL para garantir que cada usuário tenha acesso apenas aos próprios dados.

Não confie apenas na proteção das páginas do frontend.

Não exponha a chave service_role do Supabase no navegador.

## 5. Persistência do progresso

O sistema deverá salvar automaticamente as alterações importantes.

Exemplos:

- Ao iniciar um tópico, registrar como em andamento.
- Ao concluir um desafio, atualizar seu progresso.
- Ao concluir um tópico, persistir a conclusão.
- Ao adicionar uma anotação, salvar no banco.
- Ao acessar um novo tópico, atualizar o último tópico estudado.

Ao fazer login novamente, quero encontrar exatamente meu progresso anterior.

O estado de progresso deve ser recuperado do banco de dados, não depender exclusivamente do navegador.

## 6. Estrutura inicial do roadmap

Crie um mecanismo de seed para inserir todo o roadmap original no banco de dados.

O seed deve incluir:

- As seis etapas.
- Todas as descrições.
- Todos os módulos.
- Todos os tópicos.
- A ordem original dos conteúdos.

Não omita nenhum tópico.

O processo de seed deve ser idempotente: executá-lo novamente não pode duplicar os registros nem apagar o progresso dos usuários.

Os desafios poderão ser cadastrados e ampliados progressivamente.

## 7. Organização do projeto

Proponha uma estrutura de diretórios simples, organizada e escalável.

Exemplo de referência:

src/
  app/
    (auth)/
    (dashboard)/
    api/
  components/
    ui/
    layout/
    roadmap/
    study/
    challenges/
  lib/
    supabase/
    validations/
    utils/
  services/
  types/

Ajuste essa estrutura conforme as necessidades reais do projeto.

## 8. Segurança e qualidade

Implemente:

- Validação de dados.
- Proteção de rotas.
- RLS.
- Tratamento de erros.
- Controle de acesso.
- Variáveis de ambiente.
- Proteção contra exposição de credenciais.
- Validação de operações no servidor.

Inclua testes para as principais regras de negócio e operações críticas.

## 9. Deploy

Quero uma configuração simples de deploy.

Considere:
- Vercel para Next.js.
- Supabase para PostgreSQL e autenticação.
- Variáveis de ambiente.
- Configuração do Google OAuth.
- Migrations.
- Seeds.
- Backup do banco.

Documente o processo de configuração e publicação.

## 10. Entregáveis

Antes de implementar, apresente:

1. Arquitetura escolhida.
2. Justificativa da stack.
3. Diagrama da arquitetura.
4. Modelo entidade-relacionamento.
5. Estrutura de diretórios.
6. Fluxo de autenticação.
7. Políticas RLS.
8. Estratégia de seed.
9. Fluxo de persistência do progresso.
10. Plano de implementação.

## 11. Diretriz principal

Simplicidade sem comprometer a qualidade.

Não quero:
- Microsserviços.
- Backend separado.
- Docker desnecessário para a primeira versão.
- Kafka ou RabbitMQ.
- Arquitetura distribuída.
- Camadas excessivas.
- Bibliotecas redundantes.
- Complexidade sem benefício real.

Quero uma aplicação Next.js bem estruturada, segura, rápida e fácil de evoluir.

O objetivo é construir um excelente produto pessoal de estudos, sem transformar sua infraestrutura em um projeto maior do que o próprio produto.
## Programa versus processo

Um **programa** é um arquivo: uma sequência de bytes num disco, num formato que o sistema operacional sabe carregar (ELF no Linux, PE no Windows, Mach-O no macOS). Ele contém o código de máquina, dados inicializados, a lista de bibliotecas de que depende e o endereço do ponto de entrada. O arquivo `/usr/bin/java` é um programa. Ele não faz nada sozinho.

Um **processo** é um programa **em execução**: uma instância viva, criada pelo kernel, com tudo o que é necessário para executar:

- um **espaço de endereçamento** próprio (a memória virtual que só ele enxerga, tópicos 1.2.6 e 1.2.7);
- uma ou mais **threads** de execução, cada uma com seus registradores e sua stack (tópico 1.2.3);
- **recursos** do kernel: descritores de arquivos e sockets abertos, diretório de trabalho, variáveis de ambiente, limites de recursos;
- uma **identidade**: PID, processo pai, usuário e grupo que determinam suas permissões.

O mesmo programa pode originar vários processos ao mesmo tempo. Três JVMs rodando três microsserviços diferentes são três processos criados a partir do mesmo `/usr/bin/java`, completamente isolados entre si: um não enxerga o heap do outro, e se um travar ou for morto, os outros continuam.

Essa é a ideia central: **o processo é a unidade de isolamento e de contabilidade de recursos do SO**. Limites de memória, sinais, permissões e falhas atuam sobre o processo inteiro.

## O que o kernel guarda sobre um processo

Para cada processo, o kernel mantém uma estrutura chamada genericamente de **PCB** (*Process Control Block*). No Linux, ela se chama `task_struct` (na verdade existe uma por thread, e as threads de um processo compartilham partes dela). Os principais campos:

| Informação | Para que serve |
|---|---|
| PID, PPID | Identidade do processo e do pai |
| Estado | Rodando, pronto, dormindo, parado, zumbi |
| Contexto salvo da CPU | Registradores, contador de programa, stack pointer, para retomar a execução após uma troca de contexto |
| Ponteiro para o espaço de endereçamento (`mm_struct`) | Tabelas de páginas e lista de regiões de memória |
| Tabela de descritores de arquivo | Arquivos, sockets e pipes abertos |
| Credenciais | UID, GID, capabilities |
| Sinais | Sinais pendentes, bloqueados e os tratadores instalados |
| Informações de escalonamento | Prioridade, `nice`, tempo de CPU consumido |
| Namespaces e cgroup | Qual "visão" do sistema e quais limites se aplicam (tópico 1.2.1) |
| Contabilidade | Tempo de CPU em user e kernel mode, page faults, I/O |

No Linux, boa parte disso é exposta como arquivos em `/proc/<pid>/`: `status` (estado, memória, threads), `maps` (regiões de memória), `fd/` (descritores abertos), `limits`, `cmdline`, `environ`, `cgroup`. Ferramentas como `ps`, `top` e `htop` apenas leem esses arquivos.

## Diagrama: Layout de memória de um processo

```text
 endereços altos
 ┌──────────────────────────────┐
 │ kernel (inacessível ao user) │
 ├──────────────────────────────┤ ← topo do espaço de usuário
 │ stack da thread principal    │  cresce para baixo ↓
 │            ↓                 │
 │                              │
 │ região de mmap               │  bibliotecas (.so), arquivos mapeados,
 │ (cresce para baixo)          │  stacks de outras threads, heap Java
 │                              │
 │            ↑                 │
 │ heap (malloc, via brk)       │  cresce para cima ↑
 ├──────────────────────────────┤
 │ BSS                          │  globais não inicializadas (zeradas)
 ├──────────────────────────────┤
 │ data                         │  globais inicializadas
 ├──────────────────────────────┤
 │ text                         │  código de máquina (somente leitura + execução)
 └──────────────────────────────┘
 endereços baixos
```

- **text**: o código do executável. É mapeado como leitura e execução e é **compartilhado** entre todos os processos que rodam o mesmo programa (a mesma página física serve a todos).
- **data**: variáveis globais e estáticas com valor inicial (`int contador = 10;` em C).
- **BSS**: globais e estáticas sem valor inicial (`int buffer[4096];`). Não ocupam espaço no arquivo executável; o kernel apenas mapeia páginas zeradas.
- **heap**: memória dinâmica do `malloc` em C, que cresce para cima com `brk`/`sbrk` ou com regiões `mmap` para blocos grandes (tópico 1.1.8).
- **região de mmap**: bibliotecas compartilhadas, arquivos mapeados e blocos anônimos grandes.
- **stack**: a call stack da thread principal (tópicos 1.1.7 e 1.1.9). Outras threads recebem stacks próprias na região de mmap.

Numa JVM, o **heap Java não é o `[heap]` do `malloc`**: ele é uma grande região anônima reservada com `mmap` no tamanho de `-Xmx`. O `[heap]` do processo JVM é usado pela própria JVM (código C++) e por bibliotecas nativas. Os detalhes de como esses endereços são virtualizados, organizados e paginados estão nos tópicos 1.2.6, 1.2.7 e 1.2.8.

## Estados de um processo

Um processo (mais precisamente, cada uma de suas threads) passa por estados ao longo da vida. O modelo clássico dos livros tem cinco:

```text
               admitido               escalonado
   ┌──────┐   ─────────►  ┌───────┐  ─────────►  ┌─────────┐   exit()   ┌────────────┐
   │ NEW  │               │ READY │              │ RUNNING │ ─────────► │ TERMINATED │
   └──────┘               └───────┘  ◄─────────  └─────────┘            └────────────┘
                              ▲       preempção      │
                              │   (fatia de tempo    │ espera I/O, lock,
                              │      acabou)         │ sleep, wait()
                              │                      ▼
                              │   evento ocorreu ┌─────────┐
                              └───────────────── │ WAITING │
                                                 └─────────┘
```

- **NEW**: o kernel está criando as estruturas do processo.
- **READY**: pode executar, mas está na fila esperando um núcleo livre.
- **RUNNING**: está executando instruções num núcleo neste momento. Só pode haver um processo (thread) RUNNING por núcleo.
- **WAITING** (ou *blocked*): esperando um evento externo, como dados do disco, um pacote de rede, um lock ou o fim de um `sleep`. Não consome CPU.
- **TERMINATED**: terminou; aguarda o pai recolher o status de saída.

Repare que de WAITING o processo volta para **READY**, não direto para RUNNING: o evento torna o processo elegível, mas é o escalonador quem decide quando ele roda.

No Linux, `ps -o pid,stat,cmd` mostra o estado em letras: **R** (rodando ou pronto, o Linux não distingue os dois), **S** (dormindo de forma interrompível, o caso comum de espera), **D** (dormindo de forma ininterruptível, normalmente esperando I/O de disco; nem `SIGKILL` o tira desse estado imediatamente), **T** (parado por sinal, como Ctrl+Z ou um depurador), **Z** (zumbi). Um servidor Java ocioso aparece quase sempre em **S**: suas threads estão esperando conexões ou tarefas.

## Criação de processos: fork, exec e wait

No mundo Unix, criar um processo que execute outro programa é feito em dois passos separados:

1. **`fork()`** cria um **clone** do processo atual. O filho recebe uma cópia do espaço de endereçamento, dos descritores de arquivo, do ambiente e do diretório de trabalho. A função retorna duas vezes: no pai, devolve o PID do filho; no filho, devolve 0.
2. **`execve(caminho, argv, envp)`** **substitui** a imagem do processo atual por um novo programa: o kernel descarta o espaço de endereçamento antigo, mapeia o novo executável e começa a executá-lo do ponto de entrada. O PID continua o mesmo, e os descritores abertos são mantidos (exceto os marcados com `O_CLOEXEC`).
3. **`waitpid(pid, &status, 0)`** faz o pai esperar o filho terminar e recolher seu **status de saída**.

Copiar um processo inteiro só para descartá-lo no `exec` seguinte parece desperdício, e seria, se o kernel realmente copiasse. Ele usa **copy-on-write (COW)**: pai e filho passam a compartilhar as mesmas páginas físicas, marcadas como somente leitura. Só quando um deles escreve numa página o kernel a copia. Mesmo assim, o `fork` precisa duplicar as **tabelas de páginas**, e para um processo com dezenas de GB mapeados (como uma JVM grande) isso custa caro. Por isso existem alternativas:

- **`vfork`**: o filho usa a memória do pai diretamente, e o pai fica suspenso até o filho chamar `exec` ou `_exit`.
- **`posix_spawn`**: cria e executa num único passo; as implementações modernas usam `clone` com `CLONE_VM | CLONE_VFORK` por baixo.

A JVM, ao executar `ProcessBuilder.start()` no Linux, usa por padrão `posix_spawn` com um programa auxiliar (`jspawnhelper`) nas versões recentes do JDK, justamente para não pagar o custo de um `fork` de um processo enorme. O mecanismo pode ser trocado com `-Djdk.lang.Process.launchMechanism`.

O Windows não tem `fork`: `CreateProcess` cria o processo e carrega o programa num só passo, num modelo parecido com o `posix_spawn`.

## Exemplo: fork, exec e wait em C

```c
#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    printf("pai: meu PID é %d\n", (int) getpid());

    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }

    if (pid == 0) {
        /* filho: mesmo código, mas fork devolveu 0 */
        printf("filho: PID %d, pai %d\n", (int) getpid(), (int) getppid());
        execlp("ls", "ls", "-l", "/tmp", (char *) NULL);
        perror("execlp");            /* só chega aqui se o exec falhar */
        _exit(127);
    }

    int status;
    waitpid(pid, &status, 0);        /* pai espera e recolhe o status */
    if (WIFEXITED(status))
        printf("pai: filho %d terminou com código %d\n", (int) pid, WEXITSTATUS(status));
    return 0;
}
```

Compile com `gcc -Wall fork_exec.c -o fork_exec` no Linux, WSL, macOS ou num container `gcc`. A linha do `printf` do filho aparece, mas nada depois do `execlp` é executado com sucesso: a partir dele, aquele processo **é** o `ls`.

## Término, processos zumbis e órfãos

Um processo termina chamando `exit` (que no fim chama a syscall `exit_group`), retornando de `main`, ou sendo morto por um sinal. O kernel então libera memória, fecha descritores e destrói as threads, mas **mantém uma entrada mínima** na tabela de processos com o PID e o status de saída, e envia `SIGCHLD` ao pai. A entrada existe para que o pai consiga descobrir **como** o filho terminou.

- **Zumbi** (*zombie*, estado **Z**, `<defunct>` no `ps`): é um processo que já terminou, mas cujo pai ainda não chamou `wait`/`waitpid`. Não consome CPU nem memória significativa, mas ocupa um **PID**. Um pai com bug que cria filhos sem nunca esperá-los acumula zumbis até esgotar o limite de PIDs (`/proc/sys/kernel/pid_max`, ou `pids.max` do cgroup), e então nenhum processo novo pode ser criado. Não é possível matar um zumbi com `kill -9`: ele já está morto. A solução é o pai chamar `wait`, ou o pai morrer.
- **Órfão**: é um processo cujo pai terminou antes dele. O kernel o **re-parenta** ao processo `init` (PID 1) ou a um *subreaper* designado, que passa a ser responsável por chamar `wait` quando ele terminar. Órfãos não são um problema em si; daemons são criados deliberadamente como órfãos.

### O problema do PID 1 em containers

Dentro de um container, o primeiro processo tem PID 1 no seu namespace e assume o papel de `init`. Isso tem duas consequências:

- Ele herda os órfãos e precisa recolher os zumbis. Uma JVM não faz isso. Se sua aplicação dispara subprocessos que deixam netos órfãos, os zumbis se acumulam.
- O kernel **não aplica a ação padrão** de sinais ao PID 1 de um namespace para sinais que ele não trata. Um programa sem tratador de `SIGTERM` rodando como PID 1 simplesmente ignora o `docker stop` e acaba morto por `SIGKILL` depois do timeout. A JVM instala tratador para `SIGTERM`, então `ENTRYPOINT ["java", "-jar", "app.jar"]` funciona; já `ENTRYPOINT java -jar app.jar` (forma shell) deixa o `sh` como PID 1, e muitos shells não repassam o sinal para a JVM.

Por isso é comum usar um init mínimo como `tini` (ou `docker run --init`).

## Descritores de arquivo

Para um processo Unix, quase tudo é um arquivo: arquivos em disco, pipes, sockets TCP, terminais, `eventfd`, `epoll`. O processo não manipula essas coisas diretamente; ele recebe do kernel um **descritor de arquivo** (*file descriptor*, fd), um inteiro que é índice na **tabela de descritores do processo**.

```text
 tabela de fds do processo          tabela de arquivos abertos       objetos do kernel
 ┌────┬────────┐                    (offset, flags)
 │ 0  │ ──────────────────────────► stdin  ───────────────────────►  terminal /dev/pts/0
 │ 1  │ ──────────────────────────► stdout ───────────────────────►  terminal /dev/pts/0
 │ 2  │ ──────────────────────────► stderr ───────────────────────►  terminal /dev/pts/0
 │ 5  │ ──────────────────────────► pos=4096, O_RDONLY ───────────►  inode de app.log
 │ 9  │ ──────────────────────────► socket TCP ───────────────────►  conexão 10.0.0.5:5432
 └────┴────────┘
```

Fatos importantes:

- **0, 1 e 2** são, por convenção, stdin, stdout e stderr. `System.out` escreve no fd 1.
- O kernel sempre devolve **o menor descritor livre**. Redirecionamentos do shell (`> saida.txt`) funcionam fechando o fd 1 e abrindo o arquivo antes do `exec`, ou usando `dup2`.
- Descritores são **herdados** no `fork` e mantidos no `exec`, a menos que tenham `O_CLOEXEC`. É assim que o filho herda o terminal do shell.
- Existe um limite por processo (`ulimit -n`, `/proc/<pid>/limits`), muitas vezes 1024 por padrão em sessões interativas. Cada **conexão** de um servidor Java (HTTP de entrada, conexões do pool do banco, clientes HTTP de saída) consome um fd. O erro `java.io.IOException: Too many open files` significa que esse limite foi atingido, geralmente por vazamento (streams não fechados, ausência de `try-with-resources`) ou por limite baixo demais para a carga.
- `ls -l /proc/<pid>/fd` ou `lsof -p <pid>` mostram o que um processo tem aberto.

## Sinais: SIGTERM, SIGKILL e o graceful shutdown

Um **sinal** é uma notificação assíncrona que o kernel entrega a um processo. Pode ser enviada por outro processo (`kill`), pelo terminal (Ctrl+C) ou pelo próprio kernel (acesso inválido à memória). Para cada sinal, o processo pode deixar a **ação padrão**, **ignorar** ou instalar um **tratador** (*handler*), exceto `SIGKILL` e `SIGSTOP`, que não podem ser tratados nem ignorados.

| Sinal | Nº (Linux) | Origem típica | Ação padrão | Na JVM |
|---|---|---|---|---|
| `SIGHUP` | 1 | Terminal fechado | Terminar | Dispara shutdown hooks |
| `SIGINT` | 2 | Ctrl+C | Terminar | Dispara shutdown hooks |
| `SIGQUIT` | 3 | Ctrl+\ ou `kill -3` | Core dump | Imprime thread dump e **continua rodando** |
| `SIGKILL` | 9 | `kill -9`, OOM killer, orquestrador após timeout | Terminar | **Impossível tratar**: morte imediata, sem hooks |
| `SIGSEGV` | 11 | Acesso inválido à memória | Core dump | Usado internamente (null checks implícitos); se for um crash real, gera `hs_err_pid*.log` |
| `SIGTERM` | 15 | `kill`, `docker stop`, Kubernetes | Terminar | Dispara shutdown hooks |
| `SIGCHLD` | 17 | Filho terminou | Ignorar | Usado pela infraestrutura de `Process` |

Quando um processo é morto por um sinal, o shell reporta o código de saída **128 + número do sinal**: **137** para `SIGKILL` e **143** para `SIGTERM`. Ver `exit code 137` num pod significa que algo matou o processo sem lhe dar chance de reagir (frequentemente o OOM killer).

### Shutdown hooks

A JVM, ao receber `SIGTERM`, `SIGINT` ou `SIGHUP`, inicia a sequência de desligamento: executa os **shutdown hooks** registrados com `Runtime.getRuntime().addShutdownHook(Thread)`, cada um numa thread, em paralelo e sem ordem garantida, e depois termina. Os hooks também rodam no término normal (fim da última thread não-daemon) e em `System.exit`. Eles **não** rodam com `SIGKILL`, com `Runtime.halt()` nem em crash da JVM.

Frameworks usam esse mecanismo: o Spring Boot registra um hook que fecha o `ApplicationContext` e, com `server.shutdown=graceful`, para de aceitar conexões e espera as requisições em andamento terminarem. Em Kubernetes, a sequência é: o pod é removido dos endpoints do Service, recebe `SIGTERM`, tem `terminationGracePeriodSeconds` (30 s por padrão) para terminar, e então recebe `SIGKILL`. Um hook que demora mais do que isso é interrompido à força. O tema de desligamento em produção reaparece nos tópicos de deploy (3.3.8) e health checks (3.3.5).

## Exemplo: Shutdown hook na JVM

```java
public class Servico {
    public static void main(String[] args) throws InterruptedException {
        long pid = ProcessHandle.current().pid();
        System.out.println("PID " + pid + " rodando. Envie: kill " + pid + "  ou  kill -9 " + pid);

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("hook: parando de aceitar trabalho...");
            try {
                Thread.sleep(2000);          // simula terminar requisições em andamento
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            System.out.println("hook: recursos liberados, até logo");
        }, "shutdown-hook"));

        while (true) {
            Thread.sleep(1000);              // simula o serviço trabalhando
        }
    }
}
```

Com `kill <pid>` (SIGTERM), as duas mensagens do hook aparecem e `echo $?` no terminal que rodou o Java mostra `143`. Com `kill -9 <pid>`, o processo some sem imprimir nada e o código é `137`. No Windows não há sinais Unix: Ctrl+C no console dispara os hooks, e encerrar pelo Gerenciador de Tarefas ou `taskkill /F` equivale ao `SIGKILL`.

## Processos em Java: ProcessBuilder e ProcessHandle

Java expõe processos com duas APIs:

- **`ProcessBuilder`** cria processos filhos: define comando e argumentos (sem passar por shell, então não há expansão de `*` nem pipes, a menos que você execute `sh -c`), diretório (`directory`), ambiente (`environment()`) e redirecionamentos (`redirectOutput`, `redirectErrorStream(true)`, `inheritIO()`). `start()` devolve um `Process`.
- **`Process`** representa o filho: `getInputStream()` lê o **stdout** do filho (o nome confunde: é entrada para o pai), `getOutputStream()` escreve no stdin dele, `waitFor()` espera e devolve o código de saída, `destroy()` envia `SIGTERM` no Unix, `destroyForcibly()` envia `SIGKILL`.
- **`ProcessHandle`** (Java 9+) representa **qualquer** processo, inclusive o atual e os que você não criou: `ProcessHandle.current().pid()`, `ProcessHandle.of(pid)`, `allProcesses()`, `children()`, `descendants()`, `info()` (comando, argumentos, usuário, instante de início, tempo de CPU, quando o SO permite) e `onExit()`, que devolve um `CompletableFuture` completado quando o processo termina.

Uma armadilha clássica: a comunicação entre pai e filho passa por **pipes** com buffer limitado no kernel (64 KB por padrão no Linux). Se o filho escreve muito no stdout e o pai chama `waitFor()` sem ler a saída, o pipe enche, o filho bloqueia no `write` e o pai bloqueia no `waitFor`: um **deadlock**. Sempre consuma stdout e stderr (ou redirecione-os para arquivo ou para `DISCARD`) antes ou enquanto espera.

## Isolamento, custos e uso em sistemas reais

- **Isolamento forte**: processos não compartilham memória por padrão. Uma falha (crash, `OutOfMemoryError`, vazamento) fica contida no processo. Navegadores rodam cada aba num processo por esse motivo; o PostgreSQL usa um processo por conexão; o Nginx usa processos *worker*.
- **Comunicação custa**: como não há memória compartilhada, processos se comunicam por IPC (pipes, sockets, memória compartilhada explícita com `mmap`, sinais), sempre passando pelo kernel. Threads dentro de um processo se comunicam por memória, de forma muito mais barata, mas sem isolamento (tópicos 1.2.3 e 1.2.4).
- **Criação custa**: criar um processo envolve um novo espaço de endereçamento, tabelas de páginas, carregamento do executável e bibliotecas. Para a JVM soma-se a inicialização da própria VM (dezenas a centenas de milissegundos). É por isso que servidores Java são **processos de longa duração** que atendem milhares de requisições com threads, e não um processo por requisição como o CGI antigo.
- **Limites operacionais**: número de PIDs, descritores por processo e memória por cgroup são limites reais que aparecem em produção como "fork: Resource temporarily unavailable", "Too many open files" e `OOMKilled`.
- **Ferramentas**: `ps`, `top`/`htop`, `pstree`, `/proc/<pid>/*`, `lsof`, `kill`, e na JVM `jps` (lista JVMs), `jcmd <pid>` (diagnóstico) e `ProcessHandle` para monitorar processos de dentro do código.

## Desenhar o diagrama de estados de um processo e descrever o evento de cada transição

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Estados de processo", "Escalonador", "Preempção", "I/O bloqueante"]}
```

### Enunciado

Desenhe o diagrama de estados de um processo com os estados **new**, **ready**, **running**, **waiting** e **terminated**, e descreva o evento que causa cada transição. Em seguida, aplique o diagrama a um cenário: uma JVM que recebe uma requisição HTTP, consulta o banco de dados e devolve a resposta.

### Objetivo

Entender o ciclo de vida de um processo do ponto de vista do escalonador e relacionar cada transição a eventos concretos (syscalls, interrupções, timer).

### Instruções

1. Desenhe os cinco estados e todas as transições válidas, com setas.
2. Para cada seta, escreva o evento que a dispara e quem decide (o próprio processo, o escalonador ou um evento de hardware).
3. Responda: existe transição direta de waiting para running? E de ready para waiting? Por quê?
4. Descreva a sequência de estados da thread que atende a requisição HTTP do cenário.
5. Relacione os estados do modelo com as letras que o Linux mostra em `ps` (R, S, D, T, Z).

### Dicas

- Um processo só entra em waiting por iniciativa própria (ele pede algo que ainda não está disponível); ele só sai de running para ready contra a vontade (preempção).
- Quando o evento esperado acontece, o processo fica *elegível*, mas não necessariamente ganha a CPU naquele instante.
- O Linux usa `R` tanto para "rodando" quanto para "pronto na fila".

### Critérios de avaliação

- O diagrama contém as transições new→ready, ready→running, running→ready, running→waiting, waiting→ready e running→terminated.
- Cada transição tem o evento correto (admissão, escalonamento, preempção por timer/fatia de tempo, syscall bloqueante, conclusão do evento/interrupção, exit).
- Explica por que não há waiting→running nem ready→waiting.
- A sequência do cenário alterna corretamente running e waiting nos pontos de I/O (accept/leitura do socket, consulta ao banco, escrita da resposta).
- Mapeia R para ready/running, S/D para waiting, Z para terminated aguardando `wait`, T para parado.

### Solução de referência

```text
 ┌─────┐ admitido  ┌───────┐ escalonado (dispatch) ┌─────────┐ exit/sinal fatal ┌────────────┐
 │ NEW │ ────────► │ READY │ ────────────────────► │ RUNNING │ ───────────────► │ TERMINATED │
 └─────┘           └───────┘ ◄──────────────────── └─────────┘                  └────────────┘
                       ▲      preempção: timer,         │
                       │      fatia esgotada, ou        │ syscall bloqueante (read sem dados,
                       │      thread mais prioritária   │ lock ocupado, sleep, waitpid)
                       │                                ▼
                       │   evento ocorreu         ┌─────────┐
                       └───────────────────────── │ WAITING │
                          (interrupção de I/O,    └─────────┘
                           lock liberado, timeout)
```

| Transição | Evento | Quem causa |
|---|---|---|
| new → ready | Estruturas criadas (`fork`/`clone` concluído) | Kernel |
| ready → running | O escalonador escolhe o processo para um núcleo livre | Escalonador |
| running → ready | Interrupção do timer com fatia esgotada, ou uma thread de maior prioridade ficou pronta | Escalonador (preempção) |
| running → waiting | O processo faz uma syscall cujo resultado não está disponível: `read` de socket vazio, `futex` num lock ocupado, `nanosleep` | O próprio processo |
| waiting → ready | O evento acontece: interrupção do disco/rede, outro thread libera o lock, timer do sleep expira | Kernel, a partir de um evento |
| running → terminated | `exit`/`exit_group`, retorno de `main` ou sinal fatal | Processo ou kernel |

**Não existe waiting → running** porque o fim da espera apenas torna o processo elegível; ele entra na fila de prontos e o escalonador decide quando executá-lo (outro processo pode estar usando o núcleo). **Não existe ready → waiting** porque só um processo que está executando pode fazer a syscall que o bloqueia.

**Cenário HTTP** (a thread que atende a requisição):

1. waiting: bloqueada em `accept`/`epoll_wait` esperando conexão.
2. ready → running: chegou um pacote; a interrupção da placa de rede acordou a thread, que depois foi escalonada.
3. running: lê e faz o parsing da requisição, executa a lógica.
4. waiting: envia a consulta ao banco e bloqueia no `read` do socket JDBC.
5. ready → running: a resposta do banco chega (interrupção), a thread é escalonada, monta o JSON. Se a fatia de tempo acabar no meio, passa por running → ready → running.
6. running: `write` da resposta no socket (normalmente não bloqueia, pois só copia para o buffer do kernel).
7. waiting: volta a esperar a próxima conexão.

**Linux:** `R` = ready ou running; `S` = waiting interrompível (sockets, locks, sleep); `D` = waiting ininterruptível (I/O de disco, NFS travado); `T` = parado (Ctrl+Z, depurador); `Z` = terminou, aguardando o pai chamar `wait`.

## Inspecionar o mapa de memória de um processo via /proc/<pid>/maps e identificar cada região

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["/proc", "Layout de memória", "text/data/BSS", "mmap", "Heap Java"]}
```

### Enunciado

Escreva um pequeno programa em C com uma variável global inicializada, uma global não inicializada, uma alocação com `malloc` e uma variável local. Imprima os endereços de cada uma e de uma função, pause o programa e leia `/proc/<pid>/maps` para identificar em qual região cada endereço cai. Depois faça o mesmo com uma JVM.

### Objetivo

Ver na prática o layout de memória de um processo (text, data, BSS, heap, bibliotecas, stack) e perceber como o heap Java aparece para o sistema operacional.

### Instruções

1. Use Linux, WSL2 ou um container (`docker run --rm -it -v "$PWD":/w -w /w gcc:13 bash`). No macOS, use `vmmap <pid>`; no Windows, o **VMMap** da Sysinternals mostra informação equivalente.
2. Escreva o programa C, compile com `gcc -O0 -no-pie mapa.c -o mapa` (sem PIE os endereços ficam fixos e mais fáceis de ler; depois repita sem `-no-pie`).
3. Rode, anote o PID e os endereços impressos, e em outro terminal execute `cat /proc/<pid>/maps`.
4. Para cada linha relevante, explique as colunas: intervalo de endereços, permissões, offset, dispositivo, inode e caminho.
5. Associe cada endereço impresso a uma linha do `maps`.
6. Rode `java -Xmx512m -cp . Espera` (um programa que só dorme) e procure no `maps` da JVM: `libjvm.so`, `[heap]`, `[stack]` e uma região anônima grande correspondente ao heap Java.
7. Explique por que o heap Java não é a região `[heap]`.

### Dicas

- `r-xp` = leitura e execução, privado: típico de código. `rw-p` = leitura e escrita: dados.
- O BSS costuma aparecer logo depois da região de data do executável, às vezes como uma linha anônima sem nome, às vezes dentro da última região `rw-p` do executável.
- Para achar o heap Java, use `jcmd <pid> VM.flags` ou `-Xlog:gc+init` para descobrir o tamanho máximo reservado e procure uma região anônima com tamanho próximo de 512 MB.

### Critérios de avaliação

- O programa imprime os endereços da função, das duas globais, do bloco `malloc` e da local.
- Cada endereço é associado à linha correta do `maps` (text, data, BSS, `[heap]`, `[stack]`).
- Explica as colunas do `maps` e as permissões de cada região.
- Identifica as bibliotecas compartilhadas (`libc.so`) e regiões especiais (`[vdso]`, `[vvar]`).
- Na JVM, identifica `libjvm.so` e a reserva anônima do heap Java, e explica que ela é feita com `mmap`, não com `malloc`/`brk`.

### Solução de referência

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int global_inicializada = 42;       /* data */
int global_zerada[1024];            /* BSS  */

void funcao(void) {}                /* text */

int main(void) {
    int local = 7;                                  /* stack */
    int *dinamico = malloc(100 * sizeof(int));      /* heap  */

    printf("PID          %d\n", (int) getpid());
    printf("funcao       %p\n", (void *) funcao);
    printf("data         %p\n", (void *) &global_inicializada);
    printf("bss          %p\n", (void *) global_zerada);
    printf("heap malloc  %p\n", (void *) dinamico);
    printf("stack local  %p\n", (void *) &local);
    printf("Pressione Enter para sair...\n");
    getchar();
    free(dinamico);
    return 0;
}
```

Saída e `maps` ilustrativos (endereços variam; com ASLR mudam a cada execução):

```text
PID          9120
funcao       0x401136
data         0x404028
bss          0x404060
heap malloc  0x1c2c2a0
stack local  0x7ffd5a3e1b2c
```

```text
00400000-00401000 r--p 00000000 08:01 131 /w/mapa        cabeçalhos ELF
00401000-00402000 r-xp 00001000 08:01 131 /w/mapa        text  ← funcao
00402000-00403000 r--p 00002000 08:01 131 /w/mapa        dados somente leitura (strings)
00403000-00404000 r--p 00002000 08:01 131 /w/mapa        relocações já resolvidas (RELRO)
00404000-00405000 rw-p 00003000 08:01 131 /w/mapa        data + início do BSS ← global_inicializada, global_zerada
00405000-00406000 rw-p 00000000 00:00 0                  restante do BSS (anônimo, zerado)
01c2c000-01c4d000 rw-p 00000000 00:00 0   [heap]         ← malloc
7f3a1c000000-7f3a1c028000 r--p ... /usr/lib/x86_64-linux-gnu/libc.so.6
7f3a1c028000-7f3a1c1bd000 r-xp ... /usr/lib/x86_64-linux-gnu/libc.so.6   código da libc
7ffd5a3c2000-7ffd5a3e3000 rw-p 00000000 00:00 0   [stack] ← local
7ffd5a3f4000-7ffd5a3f8000 r--p 00000000 00:00 0   [vvar]
7ffd5a3f8000-7ffd5a3fa000 r-xp 00000000 00:00 0   [vdso]
```

**Colunas:** intervalo de endereços virtuais; permissões (`r`, `w`, `x`, e `p` privado com copy-on-write ou `s` compartilhado); offset no arquivo mapeado; dispositivo (major:minor); inode; caminho ou nome especial. Regiões com inode 0 e sem caminho são **anônimas** (não vêm de arquivo).

**Associação:** `funcao` cai na região `r-xp` do executável (text); `global_inicializada` na região `rw-p` com offset no arquivo (data, cujo valor inicial vem do executável); `global_zerada` no fim dessa região ou na região anônima seguinte (BSS, zerada pelo kernel, sem bytes no arquivo); o bloco `malloc` em `[heap]`; `local` em `[stack]`. `[vdso]` é o código do kernel mapeado para chamadas como `clock_gettime` sem syscall, e `[vvar]` são os dados que ele lê.

Sem `-no-pie`, o executável é carregado num endereço alto aleatório (ex.: `0x55...`), por causa do ASLR: a estrutura é a mesma, só a base muda.

**JVM:** o `maps` de uma JVM tem centenas de linhas. Aparecem `libjvm.so` (código da HotSpot), `libjava.so`, `libc.so`, o arquivo `lib/modules` mapeado, uma região `[heap]` relativamente pequena (memória do `malloc` usada pelo código C++ da JVM) e uma **região anônima grande** com cerca de 512 MB, frequentemente com uma parte `rw-p` (memória já *committed*) seguida de uma parte `---p` (reservada, sem permissão, ainda sem páginas físicas). Esse é o heap Java: a JVM reserva o espaço de `-Xmx` com `mmap` de uma vez para ter um intervalo contíguo de endereços, e só torna utilizável (commit) o que precisa. As stacks das threads Java aparecem como outras regiões anônimas de ~1 MB com uma pequena guard page `---p`.

## Iniciar e monitorar um processo filho em Java com ProcessBuilder, lendo stdout e exit code

```meta
{"type": "coding", "level": 2, "required": false, "knowledge": ["ProcessBuilder", "Process", "ProcessHandle", "Pipes", "Exit code"]}
```

### Enunciado

Escreva um utilitário Java `Executor` que recebe um comando como argumentos, executa-o como processo filho com `ProcessBuilder`, imprime a saída linha a linha prefixada com `[filho]`, aplica um timeout de 5 segundos e, ao final, mostra o PID do filho, o código de saída e o tempo de CPU consumido.

### Objetivo

Dominar a API de processos do Java e evitar as armadilhas clássicas (deadlock de pipe, processos que ficam rodando após timeout).

### Instruções

1. Monte o `ProcessBuilder` com a lista de argumentos recebida e `redirectErrorStream(true)`.
2. Leia a saída do filho numa thread separada (ou de forma que a leitura não dependa do fim do processo) para não causar deadlock.
3. Use `waitFor(5, TimeUnit.SECONDS)`. Se o tempo esgotar, chame `destroy()`, espere mais 2 segundos e, se ainda estiver vivo, `destroyForcibly()`.
4. Imprima `pid()`, `exitValue()` e, via `toHandle().info().totalCpuDuration()`, o tempo de CPU quando disponível.
5. Teste com: um comando que termina com sucesso (`java -version` ou `ls`/`dir`), um que falha (`ls /nao-existe` ou `cmd /c exit 3`), um que gera muita saída e um que demora (`sleep 30` ou `ping -n 30 127.0.0.1` no Windows).
6. Explique o que aconteceria se você chamasse `waitFor()` antes de ler a saída de um comando que escreve 1 MB.

### Dicas

- `Process.getInputStream()` é o **stdout do filho**.
- No Windows, comandos internos do `cmd` (como `dir`) exigem `cmd /c dir`; `ProcessBuilder` não usa shell.
- `info().totalCpuDuration()` devolve `Optional`: o SO pode não fornecer a informação, e depois do término ela pode estar indisponível. Leia-a antes de o processo terminar ou trate o vazio.
- Nos sistemas Unix, `destroy()` envia `SIGTERM` e `destroyForcibly()` envia `SIGKILL`. O código de saída de um processo morto por sinal aparece como 128 + número do sinal.

### Critérios de avaliação

- Usa `ProcessBuilder` com lista de argumentos e mescla stderr no stdout.
- Lê a saída concorrentemente com a espera, sem risco de deadlock de pipe.
- Implementa timeout com escalonamento `destroy` → `destroyForcibly`.
- Imprime PID, código de saída e tempo de CPU (ou "indisponível").
- Os quatro cenários de teste se comportam como esperado (0, código de erro, muita saída sem travar, timeout com 143/137 no Unix).
- Explica o deadlock: pipe com buffer limitado (64 KB no Linux) enche, o filho bloqueia no `write` e o pai no `waitFor`.

### Solução de referência

```java
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

public class Executor {
    public static void main(String[] args) throws IOException, InterruptedException {
        if (args.length == 0) {
            System.err.println("uso: java Executor <comando> [args...]");
            System.exit(2);
        }

        ProcessBuilder pb = new ProcessBuilder(List.of(args)).redirectErrorStream(true);
        long inicio = System.nanoTime();
        Process p = pb.start();
        System.out.println("filho iniciado, pid=" + p.pid());

        Thread leitor = new Thread(() -> {
            try (BufferedReader r = new BufferedReader(
                    new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                String linha;
                while ((linha = r.readLine()) != null) {
                    System.out.println("[filho] " + linha);
                }
            } catch (IOException e) {
                System.err.println("erro lendo saída: " + e.getMessage());
            }
        }, "leitor-stdout");
        leitor.start();

        String cpu = "indisponível";
        boolean terminou = p.waitFor(5, TimeUnit.SECONDS);
        if (!terminou) {
            cpu = p.toHandle().info().totalCpuDuration().map(Duration::toString).orElse(cpu);
            System.out.println("timeout: enviando destroy() (SIGTERM no Unix)");
            p.destroy();
            if (!p.waitFor(2, TimeUnit.SECONDS)) {
                System.out.println("ainda vivo: destroyForcibly() (SIGKILL no Unix)");
                p.destroyForcibly();
                p.waitFor();
            }
        } else {
            cpu = p.toHandle().info().totalCpuDuration().map(Duration::toString).orElse(cpu);
        }
        leitor.join();

        long ms = (System.nanoTime() - inicio) / 1_000_000;
        System.out.printf("pid=%d exit=%d tempo=%d ms cpu=%s%n", p.pid(), p.exitValue(), ms, cpu);
    }
}
```

Comportamento esperado (ilustrativo):

- `java Executor ls -l` → linhas `[filho] ...`, `exit=0`.
- `java Executor ls /nao-existe` → mensagem de erro do `ls` (veio pelo stderr mesclado), `exit=2`.
- `java Executor sh -c "seq 1 200000"` → 200 mil linhas sem travar, porque a thread leitora drena o pipe continuamente.
- `java Executor sleep 30` → após 5 s, `destroy()`; `sleep` morre com `SIGTERM` e `exit=143`. Um programa que ignore `SIGTERM` (`sh -c "trap '' TERM; sleep 30"`) só morre no `destroyForcibly()`, com `exit=137`. No Windows, `destroy()` e `destroyForcibly()` encerram o processo de forma imediata (`TerminateProcess`) e o código é 1.

**Deadlock:** a saída do filho vai para um pipe do kernel com capacidade limitada (64 KB por padrão no Linux). Se o pai chama `waitFor()` sem ler, o filho escreve até encher o pipe e bloqueia no `write`, esperando alguém ler; o pai está bloqueado esperando o filho terminar. Nenhum dos dois avança. Por isso a leitura precisa acontecer em paralelo com a espera, ou a saída deve ser redirecionada para arquivo (`redirectOutput(File)`) ou descartada (`Redirect.DISCARD`).

## Comparar o comportamento de shutdown hooks ao enviar SIGTERM vs. SIGKILL para uma JVM

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["Sinais", "SIGTERM", "SIGKILL", "Shutdown hooks", "Graceful shutdown", "Exit code"]}
```

### Enunciado

Construa uma JVM que simula um serviço processando tarefas e registra um shutdown hook que termina a tarefa em andamento e grava um arquivo `estado.txt` indicando um desligamento limpo. Envie diferentes sinais e compare o que acontece em cada caso.

### Objetivo

Entender, com evidência experimental, quais sinais permitem um graceful shutdown, o que acontece com `SIGKILL`, e como isso se conecta a `docker stop` e ao Kubernetes.

### Instruções

1. Use Linux, macOS, WSL2 ou Docker. (No Windows nativo, compare Ctrl+C com `taskkill /F /PID`.)
2. Escreva o serviço: um laço que processa uma "tarefa" a cada 500 ms e um hook que espera a tarefa atual acabar, grava `estado.txt` com `desligamento limpo` e imprime uma mensagem.
3. Para cada caso, apague `estado.txt`, rode o serviço e envie: `kill -TERM <pid>`, `kill -INT <pid>` (ou Ctrl+C), `kill -KILL <pid>` e `kill -QUIT <pid>`.
4. Anote: o hook rodou? `estado.txt` foi criado? Qual o código de saída (`echo $?`)?
5. Faça o hook demorar 20 segundos e rode o serviço num container com `docker stop -t 5 <container>`. O que acontece?
6. Escreva uma conclusão sobre como projetar o desligamento de um serviço Java em Kubernetes.

### Dicas

- Para o caso do Docker, a forma exec do `ENTRYPOINT`/`CMD` (`["java", "Servico"]`) faz a JVM ser o PID 1 e receber o sinal diretamente.
- `SIGQUIT` não encerra a JVM.
- `docker stop -t N` envia `SIGTERM`, espera N segundos e envia `SIGKILL`.

### Critérios de avaliação

- O serviço usa `addShutdownHook` e o hook coordena com a thread principal (não apenas imprime).
- Tabela com os quatro sinais: hook executado ou não, arquivo criado ou não, código de saída.
- Identifica 143 (SIGTERM), 130 (SIGINT), 137 (SIGKILL) e que SIGQUIT gera thread dump sem encerrar.
- No cenário Docker, observa que o hook é interrompido após o timeout por `SIGKILL` e o arquivo não é gravado.
- A conclusão menciona: hooks curtos e idempotentes, `terminationGracePeriodSeconds` maior que o tempo de drenagem, forma exec do ENTRYPOINT, e que `SIGKILL`/OOM kill exigem que o sistema tolere desligamentos abruptos.

### Solução de referência

```java
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;

public class Servico {
    private static volatile boolean rodando = true;
    private static final CountDownLatch parou = new CountDownLatch(1);

    public static void main(String[] args) throws InterruptedException {
        long esperaHookMs = args.length > 0 ? Long.parseLong(args[0]) : 0;
        System.out.println("PID " + ProcessHandle.current().pid());

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("hook: sinal recebido, aguardando tarefa atual");
            rodando = false;
            try {
                parou.await();                         // espera o laço principal sair
                Thread.sleep(esperaHookMs);            // simula drenagem longa
                Files.writeString(Path.of("estado.txt"), "desligamento limpo\n");
                System.out.println("hook: estado gravado");
            } catch (InterruptedException | IOException e) {
                System.out.println("hook: falhou " + e);
            }
        }, "shutdown-hook"));

        int tarefa = 0;
        while (rodando) {
            tarefa++;
            Thread.sleep(500);                         // simula processamento
            System.out.println("tarefa " + tarefa + " concluída");
        }
        parou.countDown();
        // Ao retornar, main termina; a JVM já está em shutdown e aguarda o hook.
    }
}
```

Resultados (Linux, ilustrativos):

| Sinal | Hook rodou? | `estado.txt` | Código de saída |
|---|---|---|---|
| `SIGTERM` (`kill <pid>`) | Sim | Criado | 143 |
| `SIGINT` (Ctrl+C) | Sim | Criado | 130 |
| `SIGKILL` (`kill -9`) | Não | Não criado | 137 |
| `SIGQUIT` (`kill -3`) | Não (JVM continua) | Não | — (processo segue rodando; um thread dump aparece no stdout) |

Explicação: a JVM instala tratadores para `SIGTERM`, `SIGINT` e `SIGHUP` que iniciam a sequência de shutdown, rodando os hooks antes de terminar com 128 + número do sinal. `SIGKILL` não pode ser tratado: o kernel destrói o processo sem executar nenhuma instrução dele. `SIGQUIT` é usado pela JVM para imprimir um thread dump (tópico 1.2.3) e não encerra o processo.

**Docker com `-t 5` e hook de 20 s:** o container recebe `SIGTERM`, o hook começa e imprime a primeira mensagem, mas após 5 segundos o Docker envia `SIGKILL`; o processo morre no meio do `sleep`, `estado.txt` não é gravado e o container termina com código 137. Com a forma shell do `CMD` (`CMD java Servico`), o `sh` é o PID 1 e pode não repassar o sinal: a JVM nem chega a ver o `SIGTERM` e só morre no `SIGKILL`.

**Conclusão para Kubernetes:** o Kubernetes envia `SIGTERM` e espera `terminationGracePeriodSeconds` (30 s padrão) antes do `SIGKILL`. O desligamento deve: parar de aceitar trabalho novo, terminar ou devolver o trabalho em andamento dentro desse prazo (no Spring Boot, `server.shutdown=graceful` e `spring.lifecycle.timeout-per-shutdown-phase`), fechar pools e conexões, e ser rápido e idempotente. Use a forma exec do ENTRYPOINT. E, como `SIGKILL` e OOM kill sempre podem acontecer, o sistema precisa tolerar término abrupto: tarefas idempotentes, mensagens reprocessáveis e transações que não deixem estado parcial.

## Diagnosticar processos zumbi gerados por um programa C que não chama wait

```meta
{"type": "bug_hunt", "level": 4, "required": false, "knowledge": ["Processos zumbi", "fork", "waitpid", "SIGCHLD", "Órfãos", "PID 1"]}
```

### Enunciado

O programa abaixo é um "servidor" que, a cada segundo, cria um processo filho para tratar uma tarefa curta. Depois de algumas horas em produção, o servidor começa a falhar com `fork: Resource temporarily unavailable`. Diagnostique o problema com ferramentas do SO, explique a causa e corrija-o.

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

static void tratar_tarefa(int n) {
    printf("filho %d tratando tarefa %d\n", (int) getpid(), n);
    usleep(100 * 1000);
}

int main(void) {
    printf("servidor PID %d\n", (int) getpid());
    for (int n = 1; ; n++) {
        pid_t pid = fork();
        if (pid < 0) { perror("fork"); sleep(1); continue; }
        if (pid == 0) {
            tratar_tarefa(n);
            exit(0);
        }
        sleep(1);
    }
}
```

### Objetivo

Reconhecer processos zumbi, entender por que eles esgotam recursos e conhecer as formas corretas de recolher filhos.

### Instruções

1. Compile e rode o programa (Linux, WSL2 ou container `gcc`). Deixe-o rodar 30 segundos.
2. Em outro terminal, use `ps -o pid,ppid,stat,cmd --ppid <pid-do-servidor>` e `ps aux | grep defunct`. Descreva o que vê.
3. Leia `/proc/<pid-de-um-filho>/status` e verifique o campo `State`.
4. Tente `kill -9` em um dos zumbis. O que acontece? Por quê?
5. Explique a relação entre os zumbis e o erro de `fork` (dica: limites de PIDs). Para reproduzir rápido, rode num container com `docker run --pids-limit 20 ...` ou com `ulimit -u` baixo.
6. Mate o servidor (`kill <pid>`) e verifique o que acontece com os zumbis.
7. Corrija o programa de duas formas: (a) tratador de `SIGCHLD` que chama `waitpid(-1, &status, WNOHANG)` em laço; (b) `signal(SIGCHLD, SIG_IGN)` ou `sigaction` com `SA_NOCLDWAIT`. Compare as duas abordagens.
8. Responda: por que esse tipo de problema também aparece em containers que rodam scripts como PID 1?

### Dicas

- Um zumbi aparece como `Z` ou `Z+` na coluna `STAT` e com `<defunct>` no comando.
- O zumbi já terminou; não há código dele para executar um sinal. Quem precisa agir é o pai.
- Num tratador de `SIGCHLD`, vários filhos podem terminar antes de o tratador rodar, e sinais iguais pendentes não se acumulam: por isso é preciso chamar `waitpid` em laço até não haver mais filhos terminados.
- Quando o pai morre, os filhos são adotados pelo `init`, que periodicamente chama `wait`.

### Critérios de avaliação

- Mostra evidências dos zumbis (`STAT` Z, `<defunct>`, `State: Z (zombie)`) e que o PPID deles é o servidor.
- Explica que `kill -9` não tem efeito porque o processo já terminou e só resta a entrada na tabela de processos com o status de saída.
- Relaciona o acúmulo de zumbis ao esgotamento de PIDs (`pid_max`, `ulimit -u`, `pids.max`) e ao erro `EAGAIN` no `fork`.
- Observa que matar o pai faz os zumbis serem re-parentados ao init e recolhidos.
- Apresenta as duas correções compiláveis e corretas, incluindo `waitpid` em laço com `WNOHANG` e preservação de `errno` no tratador.
- Explica o problema do PID 1 em containers e cita `tini`/`docker run --init`.

### Solução de referência

**Diagnóstico.** Após 30 s:

```text
$ ps -o pid,ppid,stat,cmd --ppid 4100
  PID  PPID STAT CMD
 4101  4100 Z    [servidor] <defunct>
 4102  4100 Z    [servidor] <defunct>
 ...
 4130  4100 Z    [servidor] <defunct>

$ grep State /proc/4101/status
State:	Z (zombie)
```

Cada filho termina com `exit(0)` em ~100 ms, mas o pai nunca chama `wait`. O kernel já liberou memória, descritores e threads do filho, mas mantém a entrada na tabela de processos com o PID e o status de saída, esperando que o pai os recolha. `kill -9 4101` não muda nada: o processo já está morto, não há o que matar. O sinal é descartado.

**Por que o `fork` falha:** cada zumbi ocupa um PID e conta no limite de processos do usuário (`ulimit -u`, `RLIMIT_NPROC`), no limite do cgroup (`pids.max`) e, no limite global, em `/proc/sys/kernel/pid_max`. Depois de horas criando um filho por segundo, um desses limites é atingido e `fork` devolve -1 com `errno = EAGAIN` ("Resource temporarily unavailable"). Num container com `--pids-limit 20`, isso acontece em ~20 segundos.

**Ao matar o servidor:** os zumbis ficam órfãos e são re-parentados ao `init` (PID 1) ou a um subreaper, que chama `wait` e os remove. Eles desaparecem do `ps` imediatamente.

**Correção (a): tratador de SIGCHLD**

```c
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static void recolher_filhos(int sig) {
    (void) sig;
    int salvo = errno;                    /* waitpid pode alterar errno do código interrompido */
    while (waitpid(-1, NULL, WNOHANG) > 0) {
        /* recolhe todos os filhos já terminados; vários podem ter saído por um só sinal */
    }
    errno = salvo;
}

static void tratar_tarefa(int n) {
    printf("filho %d tratando tarefa %d\n", (int) getpid(), n);
    usleep(100 * 1000);
}

int main(void) {
    struct sigaction sa;
    memset(&sa, 0, sizeof sa);
    sa.sa_handler = recolher_filhos;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = SA_RESTART | SA_NOCLDSTOP;   /* reinicia syscalls interrompidas; ignora filhos parados */
    if (sigaction(SIGCHLD, &sa, NULL) < 0) { perror("sigaction"); return 1; }

    printf("servidor PID %d\n", (int) getpid());
    for (int n = 1; ; n++) {
        pid_t pid = fork();
        if (pid < 0) { perror("fork"); sleep(1); continue; }
        if (pid == 0) {
            tratar_tarefa(n);
            exit(0);
        }
        sleep(1);   /* se interrompido pelo SIGCHLD, apenas dorme menos; aceitável aqui */
    }
}
```

**Correção (b): delegar ao kernel**

```c
#include <signal.h>
/* no início de main: */
signal(SIGCHLD, SIG_IGN);   /* POSIX.1-2001: filhos não viram zumbis e são descartados automaticamente */
```

Ou, de forma equivalente e mais explícita, `sigaction` com `sa.sa_handler = SIG_DFL` e `sa.sa_flags = SA_NOCLDWAIT`.

**Comparação:** (a) permite **ler o status de saída** de cada filho (trocando `NULL` por `&status` e registrando falhas), que é o que um servidor real precisa para saber se a tarefa falhou. (b) é mais simples, mas o status é perdido, e qualquer `waitpid` explícito passa a bloquear até todos os filhos terminarem e então falhar com `ECHILD`. Uma terceira alternativa é um laço síncrono com `waitpid(-1, &status, WNOHANG)` a cada iteração do laço principal, sem tratador de sinal.

**Containers:** o PID 1 de um container precisa recolher todos os órfãos do namespace. Se o PID 1 é um script shell que espera um único filho, ou um programa (como a JVM) que não chama `wait` para processos que não criou, netos órfãos viram zumbis acumulados e podem esgotar `pids.max`. A solução é usar um init mínimo como `tini` (ou `docker run --init`, ou `shareProcessNamespace` com um processo pause no Kubernetes), que recolhe zumbis e repassa sinais.

## O problema: concorrência dentro de um processo

Um servidor HTTP precisa atender centenas de clientes ao mesmo tempo. Enquanto espera o banco de dados responder para o cliente A, ele deveria estar processando o cliente B. Uma solução seria criar um **processo** por cliente (tópico 1.2.2), mas isso é caro: cada processo tem seu próprio espaço de endereçamento, suas tabelas de páginas e, no caso da JVM, uma VM inteira para inicializar. Pior: processos não compartilham memória, então um cache em memória, um pool de conexões ou um contador de métricas teriam de ser duplicados ou acessados via IPC.

A **thread** resolve isso. Ela é uma **unidade de execução escalonável dentro de um processo**: uma sequência independente de instruções, com seu próprio contador de programa e sua própria stack, mas que vive no **mesmo espaço de endereçamento** que as outras threads do processo. Todas enxergam o mesmo heap, o mesmo código e os mesmos arquivos abertos.

Em outras palavras: o processo é o **contêiner de recursos**; a thread é o **fluxo de execução**. Todo processo tem pelo menos uma thread, e uma JVM típica tem dezenas mesmo antes de executar uma linha de código da aplicação.

## O que é próprio de cada thread e o que é compartilhado

| Elemento | Próprio da thread | Compartilhado entre as threads do processo |
|---|---|---|
| Contador de programa (PC / `rip`) | ✔ cada thread está numa instrução diferente | |
| Registradores (incluindo stack pointer) | ✔ salvos no kernel a cada troca de contexto | |
| Stack (call stack, variáveis locais, frames) | ✔ uma região de memória por thread (tópicos 1.1.7 e 1.1.9) | (tecnicamente está no mesmo espaço de endereçamento: um ponteiro errado de outra thread conseguiria alcançá-la) |
| Thread-local storage (TLS) | ✔ | |
| Estado de escalonamento, prioridade, máscara de sinais, `errno` | ✔ | |
| Heap (objetos Java, `malloc`) | | ✔ |
| Código (text) e bibliotecas carregadas | | ✔ |
| Variáveis globais e campos `static` | | ✔ |
| Descritores de arquivo e sockets | | ✔ um `close` numa thread fecha para todas |
| Diretório de trabalho, variáveis de ambiente, PID, credenciais | | ✔ |
| Tratadores de sinais | | ✔ |

**TLS** (*thread-local storage*) é uma área de memória em que cada thread tem sua própria cópia de uma variável. Em C existe a palavra-chave `_Thread_local`/`__thread`; em x86-64 Linux, o registrador de segmento `fs` aponta para o bloco de TLS da thread atual. A JVM usa TLS nativo para saber rapidamente "qual é a `JavaThread` atual". Já o `ThreadLocal` do Java é implementado de outro jeito: cada objeto `Thread` tem um campo `ThreadLocalMap` (no heap) e `ThreadLocal.get()` consulta o mapa da thread atual. O efeito é o mesmo: cada thread vê seu próprio valor.

## Diagrama: Um processo com três threads

```text
 ┌──────────────────────────── Processo (PID 4200) ─────────────────────────────┐
 │                                                                              │
 │   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
 │   │ Thread main  │     │ Thread T1    │     │ Thread T2    │   PRÓPRIO       │
 │   │ TID 4200     │     │ TID 4201     │     │ TID 4202     │   DE CADA       │
 │   │ PC, rsp, regs│     │ PC, rsp, regs│     │ PC, rsp, regs│   THREAD        │
 │   │ stack (1 MB) │     │ stack (1 MB) │     │ stack (1 MB) │                 │
 │   │ TLS          │     │ TLS          │     │ TLS          │                 │
 │   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                 │
 │          └────────────────────┼────────────────────┘                         │
 │                               ▼                                              │
 │   ┌──────────────────────────────────────────────────────────────────────┐   │
 │   │ COMPARTILHADO: heap · código · globais/static · fds e sockets ·      │   │
 │   │ diretório de trabalho · ambiente · tratadores de sinais              │   │
 │   └──────────────────────────────────────────────────────────────────────┘   │
 └──────────────────────────────────────────────────────────────────────────────┘
```

## Threads no kernel

No Linux, o kernel não tem uma estrutura separada para "processo" e "thread": ambos são **tasks** (`task_struct`), criadas pela mesma syscall, `clone`. A diferença está nos **flags** que dizem o que a nova task compartilha com a criadora:

- `fork()` ≈ `clone` sem flags de compartilhamento: memória copiada (COW), tabela de descritores copiada. Resultado: um novo processo.
- `pthread_create()` ≈ `clone(CLONE_VM | CLONE_FS | CLONE_FILES | CLONE_SIGHAND | CLONE_THREAD | ...)`: mesmo espaço de endereçamento, mesma tabela de descritores, mesmos tratadores de sinais, mesmo grupo de threads. Resultado: uma nova thread.

Cada task tem um **TID** (thread ID). O "PID" que você vê no `ps` é, na verdade, o **TGID** (*thread group ID*), igual ao TID da primeira thread. Você pode ver as threads de um processo em `/proc/<pid>/task/` ou com `ps -L -p <pid>` / `top -H -p <pid>`.

O **escalonador do kernel escalona threads**, não processos. Uma JVM com 4 threads ocupadas pode usar 4 núcleos ao mesmo tempo. Cada vez que o kernel troca a thread em execução num núcleo, ele salva os registradores de uma e restaura os da outra (tópico 1.2.5). Se as duas threads são do mesmo processo, a troca é mais barata, porque não é preciso trocar as tabelas de páginas.

Além da stack de usuário, cada thread tem uma **stack de kernel** (16 KB em x86-64), usada quando ela executa uma syscall ou é interrompida.

## Modelos de threading: 1:1, N:1 e M:N

Como as threads que o programador cria se relacionam com as threads do kernel?

- **1:1 (threads de kernel)**: cada thread da linguagem é uma thread do kernel. O kernel as escalona de forma preemptiva em todos os núcleos; uma thread bloqueada numa syscall não afeta as outras. Custo: criação e troca de contexto passam pelo kernel, e cada uma tem uma stack de tamanho fixo. É o modelo da `pthreads` no Linux e das **platform threads** do Java.
- **N:1 (green threads / threads de usuário)**: muitas threads da linguagem rodam sobre **uma** thread do kernel, escalonadas por uma biblioteca em user space. Trocas são baratíssimas (sem syscall), mas não há paralelismo real em múltiplos núcleos, e uma syscall bloqueante trava todas. As primeiras JVMs (Java 1.1 em Solaris) usavam *green threads*; foram abandonadas em favor do modelo 1:1.
- **M:N**: M threads de usuário multiplexadas sobre N threads do kernel. Combina trocas baratas com paralelismo, mas exige que o runtime intercepte operações bloqueantes. As goroutines do Go seguem esse modelo, e as **virtual threads** do Java 21 também: milhões de virtual threads são montadas sobre um pequeno número de *carrier threads* (platform threads de um `ForkJoinPool`). Quando uma virtual thread bloqueia em I/O, a JVM desmonta sua stack (que fica no heap) e libera a carrier para outra. O funcionamento detalhado é assunto do tópico 4.4.11.

## Platform threads do Java: o mapeamento 1:1

Quando você chama `new Thread(r).start()` numa JVM HotSpot no Linux:

1. A JVM cria uma estrutura C++ `JavaThread` com os dados internos da thread (estado, TLAB para alocação rápida no heap, buffers do GC, referência ao objeto `java.lang.Thread`).
2. Reserva a stack com `mmap` no tamanho de `-Xss` (padrão 1 MB em Linux x86-64), com **guard pages** no final para detectar `StackOverflowError`.
3. Chama `pthread_create`, que chama `clone`. Nasce uma thread do kernel, com seu TID.
4. A nova thread executa código de inicialização da JVM e então chama `run()`.

A partir daí, a thread Java **é** a thread do kernel: o kernel decide quando ela roda e em qual núcleo; quando ela faz `read` num socket, é a thread do kernel que dorme. O nome da thread Java é repassado ao SO (aparece em `top -H` truncado em 15 caracteres), e o thread dump mostra o ID nativo (`nid`).

### Quanto custa uma platform thread

- **Memória**: até 1 MB de **espaço virtual** reservado para a stack, mas só as páginas tocadas viram memória física. Uma thread ociosa de servidor costuma ter algumas dezenas a centenas de KB residentes. Somam-se a stack de kernel (16 KB), a `task_struct` e as estruturas internas da JVM. Mil threads significam ~1 GB de reserva virtual e, de forma ilustrativa, 100–300 MB residentes.
- **Tempo de criação**: dezenas de microssegundos (syscalls `mmap`, `mprotect`, `clone`, inicialização na JVM). Criar uma thread por requisição custa mais que muitas requisições inteiras.
- **Escalonamento**: com milhares de threads ativas, o kernel gasta cada vez mais tempo trocando contexto, e os caches da CPU são constantemente poluídos.
- **Limites**: `ulimit -u` (processos + threads por usuário), `/proc/sys/kernel/threads-max`, `pid_max` (cada thread consome um TID), `pids.max` do cgroup em containers, `vm.max_map_count` (cada stack são mapeamentos) e a memória disponível. Quando qualquer um deles impede o `clone`, a JVM lança:

```text
java.lang.OutOfMemoryError: unable to create native thread: possibly out of memory or process/resource limits reached
```

Apesar do nome, esse erro quase nunca é falta de heap: é o kernel recusando uma nova thread.

## Memória compartilhada e race conditions

Compartilhar o heap é o que torna threads úteis e também o que as torna perigosas. Considere `contador++` num campo compartilhado. Ele parece uma operação, mas são três:

```text
1. ler    contador da memória para um registrador
2. somar  1 no registrador
3. gravar o registrador de volta na memória
```

Se duas threads executam isso ao mesmo tempo, podem ambas ler o valor 41, ambas somar 1 e ambas gravar 42: um incremento foi perdido. Isso é uma **race condition** (tópico 4.3.3): o resultado depende da ordem imprevisível em que o escalonador e os núcleos intercalam as instruções. Além da intercalação, cada núcleo tem caches e o compilador pode reordenar instruções; sem sincronização, não há garantia nem de que uma thread **veja** a escrita da outra (visibilidade, tópicos 4.3.10 e 4.4.1).

As soluções básicas são:

- **Exclusão mútua**: `synchronized` ou `ReentrantLock` (tópicos 4.4.2 e 4.4.5) garantem que só uma thread executa a seção crítica por vez, e estabelecem visibilidade.
- **Operações atômicas**: `AtomicInteger`/`LongAdder` (tópico 4.4.4) usam instruções da CPU como `lock xadd` ou *compare-and-swap*.
- **Não compartilhar**: confinar dados à thread (variáveis locais, `ThreadLocal`) ou usar objetos imutáveis.

## Exemplo: Race condition num contador

```java
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

public class Contador {
    static int inseguro = 0;
    static int sincronizado = 0;
    static final AtomicInteger atomico = new AtomicInteger();
    static final Object trava = new Object();

    public static void main(String[] args) throws InterruptedException {
        List<Thread> threads = new ArrayList<>();
        for (int t = 0; t < 10; t++) {
            Thread th = new Thread(() -> {
                for (int i = 0; i < 100_000; i++) {
                    inseguro++;                                   // ler-somar-gravar sem proteção
                    synchronized (trava) { sincronizado++; }      // exclusão mútua
                    atomico.incrementAndGet();                    // instrução atômica
                }
            });
            threads.add(th);
            th.start();
        }
        for (Thread th : threads) th.join();                      // espera todas terminarem

        System.out.println("esperado:     1000000");
        System.out.println("inseguro:     " + inseguro);           // quase sempre menor
        System.out.println("synchronized: " + sincronizado);       // sempre 1000000
        System.out.println("atomic:       " + atomico.get());      // sempre 1000000
    }
}
```

O valor de `inseguro` muda a cada execução e fica abaixo de 1.000.000, porque incrementos de threads diferentes se sobrepõem. O `join()` também é importante: além de esperar, ele garante que as escritas das threads terminadas sejam visíveis para a thread `main`.

## Estados de uma thread Java

`Thread.getState()` devolve um dos seis valores do enum `Thread.State`. Eles são o **ponto de vista da JVM**, que não coincide exatamente com o do kernel:

| Estado | Como a thread chega nele | Observação |
|---|---|---|
| `NEW` | Objeto `Thread` criado, `start()` ainda não chamado | Ainda não existe thread do kernel |
| `RUNNABLE` | Após `start()`, executando ou pronta para executar | **Inclui threads bloqueadas em I/O nativo** (leitura de socket, `accept`): para a JVM, elas estão executando código nativo |
| `BLOCKED` | Esperando para **entrar** num bloco/método `synchronized` cujo monitor está com outra thread | Só monitores; esperar um `ReentrantLock` aparece como `WAITING` |
| `WAITING` | `Object.wait()`, `Thread.join()`, `LockSupport.park()` (base de `ReentrantLock`, `BlockingQueue.take()`, `CompletableFuture.get()`) sem timeout | Espera indefinida até ser notificada |
| `TIMED_WAITING` | `Thread.sleep(ms)`, `wait(ms)`, `join(ms)`, `parkNanos`, `poll(timeout)` | Espera com prazo |
| `TERMINATED` | `run()` terminou (normalmente ou por exceção) | Não pode ser reiniciada; `start()` de novo lança `IllegalThreadStateException` |

A nuance do `RUNNABLE` é a fonte de muitos diagnósticos errados: um thread dump com 200 threads `RUNNABLE` em `SocketInputStream.read` (ou `NioSocketImpl.read`) não indica CPU alta; indica 200 threads esperando a rede, que no kernel estão dormindo (estado `S`). Para saber quem gasta CPU, compare com `top -H -p <pid>`.

## Exemplo: Lendo um thread dump

Um **thread dump** é uma fotografia das stacks de todas as threads da JVM, com estado e locks. É a ferramenta número um para investigar travamentos, lentidão e deadlocks. Formas de obter:

```bash
jps -l                          # lista as JVMs e seus PIDs
jstack <pid>                    # thread dump clássico
jcmd <pid> Thread.print         # equivalente, via jcmd
kill -3 <pid>                   # SIGQUIT: a JVM imprime o dump no próprio stdout
jcmd <pid> Thread.dump_to_file -format=json dump.json   # Java 21: inclui virtual threads
```

Trecho ilustrativo (o formato varia um pouco entre versões do JDK):

```text
"pedido-worker-1" #31 [7214] prio=5 os_prio=0 cpu=12.41ms elapsed=95.20s tid=0x00007f8c3c1a2800 nid=7214 waiting for monitor entry  [0x00007f8bf9dfe000]
   java.lang.Thread.State: BLOCKED (on object monitor)
	at com.loja.Estoque.reservar(Estoque.java:42)
	- waiting to lock <0x000000071a3c9e10> (a com.loja.Estoque)
	at com.loja.PedidoService.processar(PedidoService.java:27)

"pedido-worker-2" #32 [7215] prio=5 os_prio=0 cpu=8803.10ms elapsed=95.20s tid=0x00007f8c3c1a4000 nid=7215 runnable  [0x00007f8bf9cfd000]
   java.lang.Thread.State: RUNNABLE
	at com.loja.Estoque.recalcularTudo(Estoque.java:88)
	- locked <0x000000071a3c9e10> (a com.loja.Estoque)
	at com.loja.Estoque.reservar(Estoque.java:45)
```

Como ler:

- **Nome** (`"pedido-worker-1"`): dê nomes às threads e aos pools; dumps com `Thread-37` e `pool-3-thread-12` são muito mais difíceis de analisar.
- **`#31`**: ID da thread Java; nas versões recentes, o número entre colchetes ao lado (`[7214]`) repete o ID nativo. **`cpu`/`elapsed`**: tempo de CPU consumido e tempo de vida.
- **`tid`**: endereço da estrutura `JavaThread` na JVM (não é o ID do SO).
- **`nid`**: ID **nativo** da thread no kernel (o TID do Linux; em versões antigas do JDK aparece em hexadecimal, como `nid=0x1c2e`). Cruzando com `top -H -p <pid>`, você descobre qual stack Java está consumindo CPU.
- **Estado e locks**: o worker 1 está `BLOCKED` esperando o monitor `<0x...9e10>`, que o worker 2 segura (`- locked`) enquanto executa um método caro. O problema aqui é um lock segurado durante trabalho pesado.

Se houver um ciclo de espera, o `jstack` imprime ao final `Found one Java-level deadlock:` com as threads envolvidas. Tirar **dois ou três dumps com alguns segundos de intervalo** distingue uma thread presa de uma que só estava passando por ali.

Ferramentas gráficas como VisualVM e JDK Mission Control mostram a mesma informação de forma visual. Lembre que as virtual threads (tópico 4.4.11) não aparecem no `jstack` tradicional; use o `Thread.dump_to_file`.

## Por que existem thread pools e virtual threads

Com o custo de uma platform thread em mente, dois padrões surgem naturalmente em servidores:

- **Thread pools** (tópicos 4.4.7 e 4.4.8): em vez de criar e destruir uma thread por tarefa, mantém-se um número fixo de threads (*workers*) que retiram tarefas de uma fila. O custo de criação é pago uma vez, e o tamanho do pool limita o consumo de memória e a disputa por CPU. O Tomcat, por exemplo, usa por padrão um pool de até 200 threads para atender requisições. A limitação: se cada requisição passa a maior parte do tempo bloqueada esperando I/O, 200 threads significam no máximo 200 requisições em andamento, mesmo com a CPU ociosa.
- **Virtual threads** (tópico 4.4.11): atacam exatamente essa limitação. Como uma virtual thread bloqueada em I/O não prende uma thread do kernel, é viável ter uma thread por requisição, mesmo com dezenas de milhares de requisições simultâneas, mantendo o estilo de código simples e bloqueante.

## Custos, limitações e uso em sistemas reais

- **Uma JVM ociosa já tem muitas threads**: `main`, threads do GC (proporcionais aos núcleos), compiladores JIT (C1/C2), `Reference Handler`, `Finalizer`, `Signal Dispatcher`, `Common-Cleaner`, `VM Thread` e outras. Rode `jcmd <pid> Thread.print` num "hello world" com `Thread.sleep` para vê-las.
- **Dimensionamento**: trabalho limitado por CPU rende pouco com mais threads do que núcleos; trabalho limitado por I/O pode precisar de muitas threads esperando (ou de virtual threads / I/O não bloqueante).
- **Falhas não são isoladas**: uma exceção não tratada mata só a thread, mas um `OutOfMemoryError`, um vazamento ou uma corrupção de estado compartilhado afeta o processo inteiro. Isolamento é papel do processo; essa comparação é o tema do tópico 1.2.4.
- **Daemon threads**: a JVM termina quando só restam threads daemon (`setDaemon(true)`); threads não-daemon esquecidas impedem a JVM de encerrar.
- **Observabilidade**: nomeie threads, monitore o número de threads ativas (métrica `jvm.threads.live` no Micrometer) e aprenda a ler thread dumps antes de precisar deles num incidente.

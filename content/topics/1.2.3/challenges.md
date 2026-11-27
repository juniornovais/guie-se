## Classificar stack, heap, PC, registradores e file descriptors como próprios da thread ou compartilhados

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Thread", "Stack", "Heap", "Registradores", "Descritores de arquivo", "ThreadLocal"]}
```

### Enunciado

Classifique cada item abaixo como **próprio de cada thread** ou **compartilhado entre as threads do processo**, justificando em uma frase. Depois, analise o código Java e diga, para cada variável marcada, se ela é compartilhada entre as threads do pool.

Itens: stack, heap, contador de programa (PC), registradores de uso geral, stack pointer, descritores de arquivo, código do programa (text), variáveis `static`, diretório de trabalho, valor de um `ThreadLocal`, `errno` em C, tratadores de sinais.

```java
import java.io.FileWriter;
import java.io.IOException;
import java.util.*;

public class Relatorios {
    private static final Map<String, Integer> totais = new HashMap<>();   // (A)
    private static final ThreadLocal<StringBuilder> buffer =
            ThreadLocal.withInitial(StringBuilder::new);                    // (B)
    private final FileWriter log;                                           // (C)

    Relatorios(FileWriter log) { this.log = log; }

    void processar(String cliente) throws IOException {
        int linhas = 0;                                                     // (D)
        StringBuilder sb = buffer.get();                                    // (E)
        List<String> itens = new ArrayList<>();                             // (F)
        // ... preenche itens, linhas e sb ...
        totais.merge(cliente, linhas, Integer::sum);
        log.write(sb.toString());
    }
}
```

Suponha que uma única instância de `Relatorios` é usada por um pool de 8 threads.

### Objetivo

Saber, olhando para um trecho de código, o que é isolado por thread e o que é compartilhado, que é a base para raciocinar sobre thread safety.

### Instruções

1. Monte uma tabela com os 12 itens, a classificação e a justificativa.
2. Para cada variável de (A) a (F), diga se a **variável** e o **objeto** que ela referencia são compartilhados.
3. Aponte quais acessos no método `processar` são problemas de concorrência.

### Dicas

- O kernel salva e restaura registradores e PC a cada troca de contexto: cada thread tem o seu conjunto.
- Uma variável local é sempre da thread; o objeto para o qual ela aponta pode ou não ter escapado.
- A tabela de descritores pertence ao processo. Pense no que acontece se uma thread fecha um arquivo que outra está usando.

### Critérios de avaliação

- Classifica como próprios: stack, PC, registradores, stack pointer, valor do `ThreadLocal`, `errno` (TLS), e justifica.
- Classifica como compartilhados: heap, descritores, código, `static`, diretório de trabalho, tratadores de sinais, e justifica.
- Diferencia variável de objeto em (A)–(F) corretamente.
- Identifica `totais.merge` num `HashMap` compartilhado e `log.write` num `FileWriter` compartilhado como acessos concorrentes que precisam de sincronização ou de estruturas thread-safe.

### Solução de referência

| Item | Classificação | Justificativa |
|---|---|---|
| Stack | Própria | Cada thread executa sua sequência de chamadas e tem uma região de stack própria. |
| Heap | Compartilhado | Todas as threads usam o mesmo espaço de endereçamento e alocam no mesmo heap. |
| PC | Próprio | Cada thread está numa instrução diferente; o PC é salvo/restaurado na troca de contexto. |
| Registradores | Próprios | Fazem parte do contexto salvo por thread no kernel. |
| Stack pointer | Próprio | É um registrador e aponta para a stack daquela thread. |
| Descritores de arquivo | Compartilhados | A tabela de fds é do processo (`CLONE_FILES`); um `close` vale para todas. |
| Código (text) | Compartilhado | Mesmo executável e bibliotecas mapeados uma vez no processo. |
| Variáveis `static` | Compartilhadas | Ficam na área da classe/heap, uma cópia por classe carregada. |
| Diretório de trabalho | Compartilhado | Atributo do processo (`CLONE_FS`). |
| Valor de `ThreadLocal` | Próprio | Cada `Thread` tem seu `ThreadLocalMap`; `get()` lê o mapa da thread atual. |
| `errno` | Próprio | Na `libc` moderna é uma variável TLS, para que syscalls de threads diferentes não sobrescrevam o erro umas das outras. |
| Tratadores de sinais | Compartilhados | Instalados por processo (`CLONE_SIGHAND`); a máscara de sinais bloqueados, porém, é por thread. |

**Variáveis do código:**

- **(A) `totais`**: campo `static`; referência e `HashMap` compartilhados por todas as threads.
- **(B) `buffer`**: o objeto `ThreadLocal` é compartilhado, mas o `StringBuilder` devolvido por `get()` é **um por thread**.
- **(C) `log`**: campo de instância de um objeto usado por todas as threads; referência e `FileWriter` compartilhados (e, por baixo, um único descritor de arquivo).
- **(D) `linhas`**: primitivo local, na stack de cada chamada; próprio.
- **(E) `sb`**: a variável local é própria; o objeto é o `StringBuilder` daquela thread (via `ThreadLocal`), também não compartilhado.
- **(F) `itens`**: variável local própria; o `ArrayList` é criado a cada chamada e não escapa: confinado à thread.

**Problemas:** `totais.merge(...)` executa leitura-modificação-escrita num `HashMap` compartilhado sem sincronização (pode perder atualizações e corromper a estrutura); a correção é `ConcurrentHashMap` (cujo `merge` é atômico). `log.write(...)` em paralelo pode intercalar conteúdo de forma imprevisível; é preciso sincronizar o acesso ao writer ou usar um logger thread-safe. Um detalhe extra: o `StringBuilder` do `ThreadLocal` é reaproveitado entre tarefas da mesma thread do pool, então precisa ser limpo (`sb.setLength(0)`) a cada uso.

## Reproduzir e corrigir uma race condition em um contador incrementado por 10 threads

```meta
{"type": "bug_hunt", "level": 2, "required": true, "knowledge": ["Race condition", "synchronized", "AtomicInteger", "LongAdder", "Thread.join"]}
```

### Enunciado

O programa abaixo deveria imprimir `1000000`, mas imprime valores diferentes a cada execução. Reproduza o problema, explique a causa no nível das instruções e corrija-o de três formas diferentes, comparando o desempenho.

```java
public class ContadorBugado {
    private int valor = 0;

    void incrementar() { valor++; }

    public static void main(String[] args) throws InterruptedException {
        ContadorBugado c = new ContadorBugado();
        Thread[] threads = new Thread[10];
        for (int t = 0; t < 10; t++) {
            threads[t] = new Thread(() -> {
                for (int i = 0; i < 100_000; i++) c.incrementar();
            });
            threads[t].start();
        }
        for (Thread th : threads) th.join();
        System.out.println(c.valor);
    }
}
```

### Objetivo

Ver uma race condition acontecer, entender por que `valor++` não é atômico e conhecer as correções básicas e seus custos.

### Instruções

1. Rode o programa 5 vezes e anote os resultados.
2. Explique por que incrementos são perdidos, descrevendo uma intercalação concreta entre duas threads.
3. Veja o bytecode com `javap -c ContadorBugado` e identifique as instruções de `incrementar`.
4. Corrija com: (a) `synchronized`; (b) `AtomicInteger`; (c) `LongAdder`.
5. Meça o tempo de cada versão com 10 threads × 10.000.000 incrementos e compare.
6. Responda: por que o `join()` é necessário mesmo na versão corrigida?

### Dicas

- Em bytecode, `valor++` num campo vira `getfield`, `iconst_1`, `iadd`, `putfield`.
- Com poucos incrementos por thread, a primeira thread pode terminar antes da segunda começar e o bug some: por isso 100.000 por thread.
- `LongAdder` espalha a contagem em várias células para reduzir disputa e só soma tudo em `sum()`.

### Critérios de avaliação

- Reproduz resultados menores que 1.000.000 e variáveis entre execuções.
- Explica a sequência ler-somar-gravar e mostra uma intercalação que perde um incremento.
- Identifica as instruções `getfield`/`iadd`/`putfield` no bytecode.
- As três correções produzem sempre 1.000.000 (ou 100.000.000 no teste de desempenho).
- Compara os tempos e explica a diferença (lock com disputa, CAS com retentativas, células distribuídas).
- Explica que `join` espera o término e garante a visibilidade das escritas (relação *happens-before*).

### Solução de referência

Resultados típicos da versão bugada: `412873`, `538102`, `1000000`, `367455`, `701288` (ilustrativos; às vezes acerta por sorte).

**Causa.** `javap -c` mostra:

```text
void incrementar();
  Code:
     0: aload_0
     1: dup
     2: getfield      #7   // Field valor:I
     5: iconst_1
     6: iadd
     7: putfield      #7   // Field valor:I
    10: return
```

São leitura, soma e escrita separadas. Intercalação que perde um incremento:

```text
T1: getfield → lê 41
T2: getfield → lê 41
T1: iadd → 42; putfield → valor = 42
T2: iadd → 42; putfield → valor = 42     (o incremento de T1 foi sobrescrito)
```

Em múltiplos núcleos isso acontece de verdade em paralelo, e o JIT ainda pode manter `valor` num registrador durante o laço, piorando o efeito.

**Correções:**

```java
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.LongAdder;

public class ContadorCorrigido {
    interface Contador { void incrementar(); long valor(); }

    static final class Sincronizado implements Contador {
        private long valor;
        public synchronized void incrementar() { valor++; }
        public synchronized long valor() { return valor; }
    }

    static final class Atomico implements Contador {
        private final AtomicInteger valor = new AtomicInteger();
        public void incrementar() { valor.incrementAndGet(); }
        public long valor() { return valor.get(); }
    }

    static final class Adder implements Contador {
        private final LongAdder valor = new LongAdder();
        public void incrementar() { valor.increment(); }
        public long valor() { return valor.sum(); }
    }

    static long medir(Contador c, int threads, int porThread) throws InterruptedException {
        Thread[] ts = new Thread[threads];
        long inicio = System.nanoTime();
        for (int t = 0; t < threads; t++) {
            ts[t] = new Thread(() -> { for (int i = 0; i < porThread; i++) c.incrementar(); });
            ts[t].start();
        }
        for (Thread th : ts) th.join();
        long ms = (System.nanoTime() - inicio) / 1_000_000;
        System.out.printf("%-12s valor=%d tempo=%d ms%n", c.getClass().getSimpleName(), c.valor(), ms);
        return ms;
    }

    public static void main(String[] args) throws InterruptedException {
        for (int rodada = 0; rodada < 3; rodada++) {     // as primeiras rodadas servem de aquecimento
            medir(new Sincronizado(), 10, 10_000_000);
            medir(new Atomico(), 10, 10_000_000);
            medir(new Adder(), 10, 10_000_000);
        }
    }
}
```

Tempos ilustrativos (8 núcleos): `synchronized` ~2–5 s, `AtomicInteger` ~1–2 s, `LongAdder` ~0,1–0,3 s. Todos exibem `valor=100000000`.

- `synchronized`: exclusão mútua. Sob alta disputa, threads esperam o monitor e podem ser estacionadas no kernel (`futex`), com trocas de contexto.
- `AtomicInteger`: usa uma instrução atômica (`lock xadd` em x86). Não há bloqueio, mas todos os núcleos disputam a mesma linha de cache, que fica "pulando" entre eles.
- `LongAdder`: cada thread tende a incrementar uma célula diferente, eliminando a disputa; `sum()` soma as células. Ideal para contadores de métricas muito escritos e pouco lidos, mas `sum()` não é um instantâneo atômico se houver escritas concorrentes.

**Por que `join`:** sem ele, `main` poderia imprimir antes de as threads terminarem. Além disso, o Java Memory Model (tópico 4.4.1) garante que tudo o que uma thread fez antes de terminar é visível para quem retornou de `join()` nela (*happens-before*). Na versão `synchronized`, o getter também é sincronizado pelo mesmo motivo de visibilidade.

## Criar threads até falhar e observar o erro unable to create native thread e o consumo de memória

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["Platform threads", "Limites do SO", "-Xss", "cgroups", "OutOfMemoryError"]}
```

### Enunciado

Escreva um programa que crie platform threads que ficam dormindo, uma após a outra, até a criação falhar. Registre quantas threads foram criadas, qual erro ocorreu e quanta memória o processo usava. Depois, mude os limites e veja o número mudar.

### Objetivo

Comprovar que platform threads são recursos do sistema operacional com custo e limite reais, e entender as várias causas possíveis do erro `unable to create native thread`.

### Instruções

1. **Segurança**: este experimento pode deixar a máquina lenta ou instável. Rode **dentro de um container com limites** (recomendado): `docker run --rm -it --pids-limit 2000 -m 1g -v "$PWD":/w -w /w eclipse-temurin:21 bash`. Fora de container, no Linux, use antes `ulimit -u 3000` no terminal. Evite rodar sem limites no Windows ou macOS.
2. Escreva o programa: num laço, crie uma thread que chama `Thread.sleep(Long.MAX_VALUE)`, inicie-a, incremente um contador, e a cada 500 threads imprima o contador e a memória residente (lida de `/proc/self/status`, linha `VmRSS`, ou por `ps -o rss -p <pid>` em outro terminal).
3. Capture o `OutOfMemoryError`, imprima a mensagem e o total, e encerre com `System.exit` (as threads não são daemon).
4. Rode com `--pids-limit 2000`. Anote o total e a mensagem.
5. Mude para `--pids-limit 10000` e rode com `-Xss256k` e depois `-Xss2m`. O que limita o número agora?
6. Calcule a memória residente média por thread e compare com o `-Xss`.
7. Explique a diferença entre a memória **reservada** e a **residente** de cada stack.

### Dicas

- A JVM já tem dezenas de threads antes do seu laço começar: elas também contam no limite de PIDs.
- Threads que só dormem tocam poucas páginas da stack; o RSS por thread é bem menor que o `-Xss`.
- Possíveis limitantes: `pids.max` do cgroup, `ulimit -u`, `threads-max`, `vm.max_map_count`, memória do container (stacks + estruturas da JVM).

### Critérios de avaliação

- O programa cria threads até falhar, captura o erro e reporta o total.
- Mostra a mensagem `unable to create native thread: possibly out of memory or process/resource limits reached`.
- Com `--pids-limit`, o total fica próximo do limite menos as threads internas da JVM, e o aluno explica isso.
- Mede o RSS e calcula a memória residente por thread, explicando por que é menor que o `-Xss`.
- Explica o efeito de `-Xss` (afeta reserva virtual e consumo; não afeta o limite de PIDs) e lista os possíveis limites do SO.

### Solução de referência

```java
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class CriarAteFalhar {
    static String rss() {
        try {
            return Files.readAllLines(Path.of("/proc/self/status")).stream()
                    .filter(l -> l.startsWith("VmRSS"))
                    .findFirst().orElse("VmRSS: ?").trim();
        } catch (IOException e) {
            return "VmRSS indisponível";
        }
    }

    public static void main(String[] args) {
        int criadas = 0;
        System.out.println("início: threads vivas=" + Thread.activeCount() + " " + rss());
        try {
            while (true) {
                Thread t = new Thread(() -> {
                    try {
                        Thread.sleep(Long.MAX_VALUE);
                    } catch (InterruptedException ignored) {
                    }
                });
                t.start();
                criadas++;
                if (criadas % 500 == 0) System.out.println(criadas + " threads, " + rss());
            }
        } catch (OutOfMemoryError e) {
            System.out.println("FALHOU após " + criadas + " threads: " + e.getMessage());
            System.out.println("no momento da falha: " + rss());
            System.exit(1);
        }
    }
}
```

Saída ilustrativa com `--pids-limit 2000`:

```text
início: threads vivas=1 VmRSS:	   42100 kB
500 threads, VmRSS:	   61850 kB
1000 threads, VmRSS:	   81200 kB
1500 threads, VmRSS:	  100900 kB
[0.712s][warning][os,thread] Failed to start thread "Unknown thread" - pthread_create failed (EAGAIN) for attributes: stacksize: 1024k, guardsize: 0k, detached.
FALHOU após 1978 threads: unable to create native thread: possibly out of memory or process/resource limits reached
```

**Interpretação.** O limite foi o `pids.max` do cgroup: 2000 tasks no total, das quais ~20 já eram threads internas da JVM (GC, JIT, `Signal Dispatcher`, `Finalizer`...) e do launcher; `Thread.activeCount()` mostra só as threads Java do grupo atual, não as internas. O `clone` falhou com `EAGAIN` e a JVM converteu isso em `OutOfMemoryError`, embora o heap estivesse folgado.

**Memória por thread.** (100.900 − 42.100) kB / 1500 ≈ 39 kB residentes por thread, muito menos que os 1024 KB de `-Xss`. Cada stack **reserva** 1 MB de espaço virtual com `mmap`, mas o kernel só aloca páginas físicas quando são tocadas; uma thread que só chama `sleep` usa poucas páginas da stack, mais estruturas da JVM e do kernel (stack de kernel de 16 KB, `task_struct`). Em servidores reais, threads com stacks profundas (frameworks, ORM) tocam bem mais páginas e o RSS por thread chega a centenas de KB.

**Variando `-Xss` com `--pids-limit 10000` e `-m 1g`:** o número de threads não muda com `-Xss` enquanto o limite for de PIDs; ao aumentar o limite de PIDs, o próximo limite pode ser a memória do container (as reservas de 2 MB contam como espaço virtual, não como RSS, mas cada thread toca algumas páginas e há metadados), `vm.max_map_count` (cada stack cria mapeamentos, padrão 65530) ou `threads-max`. Com `-Xss256k`, a reserva virtual total cai para um quarto, e cenários limitados por espaço de endereçamento (sistemas 32 bits, `ulimit -v`) suportam mais threads.

**Lição:** milhares de platform threads são viáveis, mas cada uma consome um TID, memória e trabalho do escalonador. Por isso servidores usam pools com tamanho controlado ou virtual threads.

## Comparar o tempo e a memória de 10.000 tarefas bloqueantes com platform threads vs. virtual threads

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["Virtual threads", "ExecutorService", "Thread pools", "Native Memory Tracking", "Tarefas bloqueantes"]}
```

### Enunciado

Execute 10.000 tarefas que simulam I/O bloqueante (`Thread.sleep(1000)`) de três formas: (a) um pool fixo de 200 platform threads; (b) uma platform thread por tarefa; (c) uma virtual thread por tarefa. Compare o tempo total, o pico de threads do SO e o consumo de memória.

### Objetivo

Entender, com números, por que tarefas majoritariamente bloqueantes escalam mal com platform threads e por que virtual threads (tópico 4.4.11) mudam esse cenário.

### Instruções

1. Use Java 21 ou superior.
2. Implemente cada estratégia com `ExecutorService` em `try-with-resources` (o `close()` espera todas as tarefas): `Executors.newFixedThreadPool(200)`, `Executors.newThreadPerTaskExecutor(Thread.ofPlatform().factory())` e `Executors.newVirtualThreadPerTaskExecutor()`.
3. Meça o tempo total de cada estratégia.
4. Meça o pico de threads da JVM com `ManagementFactory.getThreadMXBean().getPeakThreadCount()` (reinicie o pico entre medições com `resetPeakThreadCount()`) e, se possível, observe `ps -o nlwp -p <pid>` em outro terminal.
5. Rode cada estratégia num processo separado com `-XX:NativeMemoryTracking=summary` e, durante a execução, rode `jcmd <pid> VM.native_memory summary` para observar a categoria `Thread`.
6. Monte uma tabela e explique cada resultado.
7. Responda: se a tarefa fosse 1 segundo de **CPU** em vez de `sleep`, virtual threads ajudariam?

### Dicas

- No pool fixo, só 200 tarefas dormem ao mesmo tempo: calcule o tempo mínimo teórico.
- Virtual threads bloqueadas em `sleep` não ocupam uma carrier thread; o número de carriers fica perto do número de núcleos.
- Para pausar o programa enquanto mede com `jcmd`, faça as tarefas durarem mais (por exemplo 10 s) nesse passo.

### Critérios de avaliação

- As três estratégias estão implementadas corretamente e esperam todas as tarefas.
- Tabela com tempo, pico de threads e memória nativa de threads para cada estratégia.
- Explica o tempo de ~50 s do pool fixo (10.000 / 200 × 1 s).
- Explica que a thread por tarefa é rápida mas cria ~10.000 threads do SO, com custo alto de memória e criação.
- Explica que virtual threads concluem em ~1 s com poucas threads do SO e memória baixa, porque as stacks ficam no heap e as carriers são liberadas ao bloquear.
- Responde que, para trabalho de CPU, virtual threads não aumentam a vazão: o limite é o número de núcleos.

### Solução de referência

```java
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
import java.util.stream.IntStream;

public class Bloqueantes {
    static final int TAREFAS = 10_000;
    static final ThreadMXBean MX = ManagementFactory.getThreadMXBean();

    static void executar(String nome, Supplier<ExecutorService> fabrica, Duration espera) {
        MX.resetPeakThreadCount();
        long inicio = System.nanoTime();
        try (ExecutorService ex = fabrica.get()) {
            IntStream.range(0, TAREFAS).forEach(i -> ex.submit(() -> {
                Thread.sleep(espera);       // simula I/O bloqueante
                return i;
            }));
        }                                   // close() espera todas as tarefas terminarem
        long ms = (System.nanoTime() - inicio) / 1_000_000;
        System.out.printf("%-22s tempo=%6d ms  pico de threads da plataforma=%d%n",
                nome, ms, MX.getPeakThreadCount());
    }

    public static void main(String[] args) {
        String modo = args.length > 0 ? args[0] : "todos";
        Duration espera = Duration.ofSeconds(args.length > 1 ? Long.parseLong(args[1]) : 1);

        if (modo.equals("fixo") || modo.equals("todos"))
            executar("pool fixo (200)", () -> Executors.newFixedThreadPool(200), espera);
        if (modo.equals("plataforma") || modo.equals("todos"))
            executar("platform por tarefa", () -> Executors.newThreadPerTaskExecutor(Thread.ofPlatform().factory()), espera);
        if (modo.equals("virtual") || modo.equals("todos"))
            executar("virtual por tarefa", Executors::newVirtualThreadPerTaskExecutor, espera);
    }
}
```

```bash
javac Bloqueantes.java
java Bloqueantes todos
# medição de memória nativa, uma estratégia por vez, com tarefas de 10 s:
java -XX:NativeMemoryTracking=summary Bloqueantes plataforma 10 &
sleep 5 && jcmd $(jps | grep Bloqueantes | cut -d' ' -f1) VM.native_memory summary | grep -A3 Thread
```

Resultados ilustrativos (8 núcleos, Linux):

| Estratégia | Tempo | Pico de threads do SO | Memória nativa "Thread" (NMT) |
|---|---|---|---|
| Pool fixo de 200 | ~50.100 ms | ~220 | ~200 MB reservados, ~10 MB committed |
| Platform por tarefa | ~1.400 ms | ~10.020 | ~10 GB reservados, ~400 MB committed |
| Virtual por tarefa | ~1.050 ms | ~30 | praticamente igual ao baseline da JVM |

**Explicação:**

- **Pool fixo**: só 200 tarefas dormem simultaneamente; as outras esperam na fila. 10.000 / 200 = 50 lotes de 1 s ≈ 50 s. A CPU fica quase ociosa o tempo todo: o gargalo é o número de threads, não o hardware.
- **Platform por tarefa**: todas dormem ao mesmo tempo, então o tempo se aproxima de 1 s, mais o custo de criar 10.000 threads do kernel (dezenas de µs cada, com `mmap` + `clone`). O preço é ~10.000 TIDs, ~10 GB de espaço virtual reservado para stacks e centenas de MB efetivamente usados, além de pressão sobre o escalonador. Com 100.000 tarefas, provavelmente falharia com `unable to create native thread`.
- **Virtual por tarefa**: cada tarefa ganha uma virtual thread, cuja stack é um objeto pequeno no heap. Ao chamar `sleep`, a virtual thread é desmontada e a carrier fica livre. Poucas carrier threads (≈ número de núcleos, no `ForkJoinPool` do escalonador) atendem as 10.000. O pico de threads do SO fica perto do baseline da JVM, e o custo aparece como alguns MB de heap. O `getPeakThreadCount()` do `ThreadMXBean` conta apenas platform threads.

**Tarefa de CPU:** se cada tarefa gastasse 1 s de CPU, o limite seria o número de núcleos: com 8 núcleos, 10.000 s de CPU levam ~1.250 s em qualquer estratégia. Virtual threads não criam CPU; elas resolvem o problema de **esperar** barato. Para trabalho de CPU, o adequado é um pool com tamanho próximo ao número de núcleos.

## Implementar um thread pool simples com fila de tarefas e workers fixos

```meta
{"type": "implementation", "level": 4, "required": false, "knowledge": ["Thread pools", "BlockingQueue", "Produtor-consumidor", "Interrupção", "Shutdown", "Estados de thread"]}
```

### Enunciado

Implemente uma classe `PoolSimples` que mantém **N threads worker fixas** retirando tarefas (`Runnable`) de uma fila. Ela deve oferecer `submit(Runnable)`, `shutdown()` (para de aceitar tarefas e deixa os workers terminarem o que já está na fila) e `awaitTermination(long, TimeUnit)`. Uma tarefa que lança exceção não pode matar o worker.

### Objetivo

Entender, construindo, como um thread pool reaproveita platform threads, como os workers esperam trabalho sem gastar CPU e como um desligamento ordenado funciona.

### Instruções

1. Use uma `BlockingQueue<Runnable>` com capacidade limitada (por exemplo, 1.000). Explique o que fazer quando ela enche.
2. No construtor, crie e inicie N threads worker com nomes `pool-worker-<i>`.
3. Cada worker executa um laço: retira uma tarefa da fila (bloqueando enquanto ela estiver vazia), executa-a dentro de `try/catch` e repete.
4. Implemente o desligamento sem espera ativa: depois de `shutdown()`, os workers devem esvaziar a fila e terminar.
5. Implemente `awaitTermination` usando `join` com prazo.
6. Escreva um `main` que submete 20 tarefas (algumas lançando exceção), chama `shutdown` e espera.
7. Enquanto o pool está ocioso (antes do shutdown), tire um thread dump com `jstack` e identifique o estado dos workers.
8. Compare seu pool com `Executors.newFixedThreadPool`: o que o `ThreadPoolExecutor` faz que o seu não faz?

### Dicas

- `queue.take()` bloqueia sem consumir CPU: no thread dump, o worker aparece como `WAITING (parking)`.
- Duas técnicas de desligamento: *poison pill* (enfileirar uma tarefa especial por worker) ou flag + `poll` com timeout. A pílula é colocada **depois** das tarefas, então a fila é esvaziada antes.
- Use `put` (bloqueia o produtor quando a fila enche: *backpressure*) ou `offer` (rejeita imediatamente) e justifique a escolha.
- Uma exceção que escapa de `run()` termina a thread. Capture `RuntimeException` dentro do laço do worker.

### Critérios de avaliação

- Tem exatamente N threads worker criadas uma única vez e reaproveitadas para todas as tarefas.
- Workers bloqueiam na fila vazia sem espera ativa (`take` ou `poll` com timeout).
- `submit` depois de `shutdown` lança `RejectedExecutionException`; a política para fila cheia está definida e justificada.
- Exceções nas tarefas são registradas e o worker continua vivo.
- `shutdown` permite concluir as tarefas já enfileiradas e todos os workers terminam; `awaitTermination` respeita o prazo.
- Identifica no thread dump os workers em `WAITING (parking)` dentro de `LinkedBlockingQueue.take`/`ArrayBlockingQueue.take`.
- Cita ao menos três recursos do `ThreadPoolExecutor` ausentes (core/max size, keep-alive, políticas de rejeição, `shutdownNow`, `Future`, contadores, hooks).

### Solução de referência

```java
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

public class PoolSimples {
    private static final Runnable PILULA = () -> { };    // sinal de término para um worker

    private final BlockingQueue<Runnable> fila;
    private final List<Thread> workers = new ArrayList<>();
    private volatile boolean desligando = false;

    public PoolSimples(int nThreads, int capacidadeFila) {
        if (nThreads <= 0) throw new IllegalArgumentException("nThreads deve ser positivo");
        this.fila = new ArrayBlockingQueue<>(capacidadeFila);
        for (int i = 0; i < nThreads; i++) {
            Thread t = new Thread(this::loopDoWorker, "pool-worker-" + i);
            workers.add(t);
            t.start();
        }
    }

    private void loopDoWorker() {
        while (true) {
            Runnable tarefa;
            try {
                tarefa = fila.take();                    // WAITING (parking) enquanto a fila está vazia
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            if (tarefa == PILULA) return;                // fim ordenado: tudo antes da pílula já foi feito
            try {
                tarefa.run();
            } catch (RuntimeException e) {               // a tarefa falhou, o worker continua
                System.err.println(Thread.currentThread().getName() + ": tarefa falhou: " + e);
            }
        }
    }

    /** Bloqueia o chamador se a fila estiver cheia (backpressure). */
    public synchronized void submit(Runnable tarefa) throws InterruptedException {
        if (tarefa == null) throw new NullPointerException();
        if (desligando) throw new RejectedExecutionException("pool em desligamento");
        fila.put(tarefa);
    }

    /** Para de aceitar tarefas; as já enfileiradas serão executadas. */
    public synchronized void shutdown() throws InterruptedException {
        if (desligando) return;
        desligando = true;
        for (int i = 0; i < workers.size(); i++) fila.put(PILULA);   // uma pílula por worker, após as tarefas
    }

    public boolean awaitTermination(long tempo, TimeUnit unidade) throws InterruptedException {
        long prazo = System.nanoTime() + unidade.toNanos(tempo);
        for (Thread t : workers) {
            long restanteMs = TimeUnit.NANOSECONDS.toMillis(prazo - System.nanoTime());
            if (restanteMs <= 0) return false;
            t.join(restanteMs);
            if (t.isAlive()) return false;
        }
        return true;
    }

    public static void main(String[] args) throws InterruptedException {
        PoolSimples pool = new PoolSimples(4, 1000);
        System.out.println("pool ocioso por 10 s: rode jstack " + ProcessHandle.current().pid());
        Thread.sleep(10_000);

        for (int i = 1; i <= 20; i++) {
            int n = i;
            pool.submit(() -> {
                if (n % 7 == 0) throw new IllegalStateException("tarefa " + n + " explodiu");
                try { Thread.sleep(200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                System.out.println(Thread.currentThread().getName() + " concluiu tarefa " + n);
            });
        }
        pool.shutdown();
        try {
            pool.submit(() -> { });
        } catch (RejectedExecutionException e) {
            System.out.println("rejeitada após shutdown, como esperado");
        }
        System.out.println("terminou? " + pool.awaitTermination(30, TimeUnit.SECONDS));
    }
}
```

**Decisões:**

- **Fila limitada com `put`**: se os produtores forem mais rápidos que os workers, eles bloqueiam em vez de acumular tarefas até estourar o heap. É *backpressure*. A alternativa `offer` + `RejectedExecutionException` é melhor quando quem submete não pode esperar (uma thread de I/O, por exemplo). Uma fila sem limite, como a do `Executors.newFixedThreadPool`, esconde sobrecarga até virar `OutOfMemoryError`.
- **`synchronized` em `submit` e `shutdown`**: garante que nenhuma tarefa entre na fila **depois** das pílulas. Um ponto fraco dessa escolha: se a fila estiver cheia, o `put` dentro de `submit` bloqueia segurando o monitor, e `shutdown` espera; aceitável para um pool didático.
- **Pílula**: cada worker consome exatamente uma e termina; como as pílulas vêm depois de todas as tarefas aceitas, a fila é esvaziada antes do fim.

**Thread dump do pool ocioso (ilustrativo):**

```text
"pool-worker-0" #21 [8812] prio=5 os_prio=0 cpu=0.31ms elapsed=4.02s tid=0x... nid=8812 waiting on condition  [0x...]
   java.lang.Thread.State: WAITING (parking)
	at jdk.internal.misc.Unsafe.park(java.base@21/Native Method)
	- parking to wait for  <0x...> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
	at java.util.concurrent.locks.LockSupport.park(java.base@21/LockSupport.java:371)
	...
	at java.util.concurrent.ArrayBlockingQueue.take(java.base@21/ArrayBlockingQueue.java:420)
	at PoolSimples.loopDoWorker(PoolSimples.java:27)
```

Os quatro workers estão em `WAITING (parking)` dentro de `take()`, com `cpu` praticamente zero: no kernel, estão dormindo num `futex`. Quando `submit` coloca uma tarefa, a fila chama `signal`, um worker é desestacionado, passa a `RUNNABLE` e executa.

**O que o `ThreadPoolExecutor` faz a mais:** tamanho *core* e *maximum* com criação sob demanda e `keepAliveTime` para encolher; políticas de rejeição configuráveis (`AbortPolicy`, `CallerRunsPolicy`, `DiscardPolicy`, `DiscardOldestPolicy`); `submit` devolvendo `Future` com resultado e exceção; `shutdownNow` (interrompe workers e devolve tarefas pendentes); substituição de worker que morre; `ThreadFactory` customizável; métricas (`getActiveCount`, `getCompletedTaskCount`, `getQueue().size()`); e ganchos `beforeExecute`/`afterExecute`. Esses temas são aprofundados nos tópicos 4.4.7 e 4.4.8.

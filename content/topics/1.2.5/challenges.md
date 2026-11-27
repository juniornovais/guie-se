## Listar o estado salvo em um context switch e explicar por que trocar de processo custa mais

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Registradores", "Program counter", "CR3", "TLB", "PCID", "Cache"]}
```

### Enunciado

Responda por escrito, sem consultar o conteúdo:

1. Liste tudo o que o kernel precisa salvar de uma thread para retomá-la depois exatamente do mesmo ponto. Diga o que **não** precisa ser copiado e por quê.
2. Dê dois exemplos de context switch voluntário e dois de involuntário, ligando cada um a uma situação comum num servidor Java.
3. Explique por que trocar entre threads de **processos diferentes** custa mais do que trocar entre threads do **mesmo processo**. Inclua o papel do CR3, da TLB e do PCID.
4. Diferencie custo direto de custo indireto e diga qual dos dois costuma ser maior num servidor real.

### Objetivo

Ter um modelo mental preciso do que é um context switch, do que o dispara e de onde vêm seus custos.

### Instruções

1. Responda cada item em um parágrafo ou lista curta.
2. No item 1, separe estado de CPU (registradores) de estado de kernel.
3. No item 3, descreva o que acontece com a TLB com e sem PCID.
4. Use ordens de grandeza (ns, µs, ms) quando falar de custos, deixando claro que são aproximadas.

### Dicas

- Pense no que a CPU "tem na cabeça" num instante: registradores, a próxima instrução, o topo da stack, o estado de ponto flutuante.
- A memória da thread (heap, stack) não sai do lugar durante a troca.
- A TLB guarda traduções de endereço virtual para físico; essas traduções são diferentes em cada processo.

### Critérios de avaliação

- Lista registradores gerais, PC, stack pointer, flags, estado FPU/SIMD, base de TLS e, para outro processo, o ponteiro para as tabelas de páginas.
- Explica que heap e stack não são copiados, apenas o estado da CPU.
- Dá exemplos corretos de trocas voluntárias (I/O, lock, sleep) e involuntárias (fim do time slice, thread mais prioritária acordando).
- Explica que trocar de processo exige carregar o CR3 e que, sem PCID, a TLB é invalidada; com PCID, as entradas são etiquetadas, mas caches e TLB ainda são menos aproveitados.
- Identifica o custo indireto (cache, TLB, preditor de desvios) como frequentemente maior que o direto.

### Solução de referência

**1. Estado salvo.** Registradores de uso geral; program counter (`rip`); stack pointer (`rsp`) e frame pointer; registrador de flags; estado de ponto flutuante e vetorial (x87, SSE, AVX), salvo com `XSAVE`; a base do thread-local storage (`fs`). No lado do kernel, a stack de kernel da thread e as informações de escalonamento (estado, prioridade, tempo de CPU consumido) ficam na `task_struct`. Se a próxima thread for de outro processo, troca-se também o ponteiro para as tabelas de páginas (CR3). **Não** se copia a memória: heap, stack de usuário e código continuam nas mesmas páginas físicas; basta guardar onde a thread estava (`rsp`, `rip`) para retomá-la.

**2. Exemplos.** Voluntários: uma thread do Tomcat chama o JDBC e bloqueia em `read()` no socket do banco; uma thread chama `future.get()` ou tenta entrar num `synchronized` já ocupado e é estacionada. Involuntários: uma thread de processamento de relatório CPU-bound esgota seu time slice e é preemptada; a thread do GC (ou uma thread que acabou de receber a resposta da rede) acorda e o escalonador decide que ela deve rodar imediatamente.

**3. Processo vs. thread.** Threads do mesmo processo usam as mesmas tabelas de páginas, então o CR3 não muda, as traduções da TLB continuam válidas e dados compartilhados (código da JVM, partes do heap) podem continuar no cache. Para outro processo, o kernel escreve o CR3 com a raiz das tabelas do novo processo. Sem PCID, isso invalida a TLB (exceto entradas globais do kernel), e o processo que entra paga um TLB miss a cada página nova acessada, cada miss custando um *page walk* na memória. Com PCID, cada entrada da TLB é etiquetada com o identificador do espaço de endereçamento, e não é preciso apagar tudo; mesmo assim, a TLB e os caches são divididos entre working sets que não compartilham nada.

**4. Direto vs. indireto.** O custo direto (entrar no kernel, escalonar, salvar e restaurar, retornar) é da ordem de 1 a 5 µs em hardware moderno, dependendo do kernel e de mitigações. O custo indireto é a execução mais lenta depois da troca: cache L1/L2 frio (acesso à RAM ~100 ns contra ~1 ns no L1), TLB misses, preditor de desvios sem histórico, possível migração de núcleo. Em servidores com working sets grandes, o indireto costuma ser maior, chegando a dezenas de microssegundos de desempenho degradado após cada troca.

## Observar a taxa de context switches com vmstat enquanto uma aplicação Java cria centenas de threads

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["vmstat", "pidstat", "/proc/<pid>/status", "Trocas voluntárias e involuntárias"]}
```

### Enunciado

Escreva um programa Java que cria centenas de threads em dois modos: **dorme** (cada thread faz `Thread.sleep(1)` em laço) e **calcula** (cada thread faz cálculo contínuo, sem bloquear). Observe a taxa de context switches do sistema com `vmstat 1` e, por processo, com `pidstat -w` e `/proc/<pid>/status`. Compare e explique os dois modos.

### Objetivo

Aprender a medir context switches com ferramentas do SO e distinguir, pelos números, um padrão de bloqueio frequente de um padrão de excesso de threads CPU-bound.

### Instruções

1. Use Linux, WSL2 ou um container Docker (`docker run -it --rm -v "$PWD":/w -w /w eclipse-temurin:21 bash`; instale `procps` e `sysstat` com `apt-get` se necessário). No Windows nativo, use `typeperf "\System\Context Switches/sec"` em vez de `vmstat`.
2. Rode `vmstat 1` num terminal e anote os valores de `cs` e `r` com a máquina ociosa.
3. Rode o programa com 500 threads no modo `dorme` e observe `cs`, `r`, `us` e `sy`.
4. Durante a execução, rode `pidstat -w -p <pid> 1` e `grep ctxt /proc/<pid>/status` duas vezes, com alguns segundos de intervalo.
5. Repita no modo `calcula` com 500 threads.
6. Monte uma tabela com os dois modos e explique as diferenças, especialmente a proporção entre trocas voluntárias e involuntárias.

### Dicas

- O programa imprime o próprio PID com `ProcessHandle.current().pid()`; coloque uma pausa inicial para você preparar os terminais.
- `pidstat -w` sem `-t` mostra só a thread principal; para ver todas, use `pidstat -w -t -p <pid> 1`, ou some os contadores das threads.
- No modo `calcula`, cada thread só sai da CPU quando seu time slice acaba, que dura milissegundos. Quantas trocas por segundo isso dá por núcleo?

### Critérios de avaliação

- O programa compila e tem os dois modos funcionando com número de threads configurável.
- Registra `cs` e `r` ociosos e nos dois modos.
- Mostra que o modo `dorme` gera uma taxa de `cs` muito maior, dominada por trocas voluntárias.
- Mostra que o modo `calcula` gera `r` alto (centenas de threads executáveis), CPU em 100% e trocas predominantemente involuntárias, com taxa de `cs` bem menor.
- Explica que a quantidade de trocas depende do padrão de bloqueio e do time slice, e não só do número de threads.

### Solução de referência

```java
public class Tempestade {
    public static void main(String[] args) throws Exception {
        int n = args.length > 0 ? Integer.parseInt(args[0]) : 500;
        String modo = args.length > 1 ? args[1] : "dorme";
        System.out.println("PID " + ProcessHandle.current().pid() + " | modo=" + modo + " | threads=" + n);
        Thread.sleep(10_000);                       // tempo para preparar vmstat/pidstat

        for (int i = 0; i < n; i++) {
            Thread t = new Thread(() -> {
                long x = 0;
                try {
                    while (true) {
                        if (modo.equals("dorme")) {
                            Thread.sleep(1);          // bloqueia: troca voluntária a cada ~1 ms
                        } else {
                            x += System.nanoTime() % 7;  // CPU contínua: só sai por preempção
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }, "worker-" + i);
            t.setDaemon(true);
            t.start();
        }
        System.out.println("threads criadas; observando por 30 s");
        Thread.sleep(30_000);
    }
}
```

```bash
javac Tempestade.java
java Tempestade 500 dorme      # terminal 1
vmstat 1                       # terminal 2
pidstat -w -t -p <pid> 1       # terminal 3
grep ctxt /proc/<pid>/status
```

Resultados ilustrativos (8 núcleos; seus números vão variar):

| Medida | Ocioso | `dorme` (500) | `calcula` (500) |
|---|---|---|---|
| `cs` (vmstat) | ~1–5 mil/s | ~200–450 mil/s | ~5–20 mil/s |
| `r` (vmstat) | 0–2 | baixo (poucas executáveis por vez) | ~500 |
| CPU | ~0% | `sy` relevante, `us` baixo | ~100% `us` |
| Trocas dominantes | — | voluntárias (`cswch/s`) | involuntárias (`nvcswch/s`) |

**Explicação.** No modo `dorme`, cada thread bloqueia a cada ~1 ms: sai da CPU voluntariamente, o timer a acorda, ela volta e bloqueia de novo. Com 500 threads, isso tende a centenas de milhares de trocas por segundo (cada thread faz algo próximo de 900 ciclos dormir/acordar por segundo, limitado pela resolução dos timers). Quase todo o trabalho é do kernel (`sy`), e a CPU de usuário fica baixa: o sistema está ocupado só trocando contexto. No `grep ctxt`, `voluntary_ctxt_switches` cresce muito rápido.

No modo `calcula`, nenhuma thread bloqueia. Há 500 threads executáveis (`r` ≈ 500) disputando 8 núcleos, e cada uma só sai por preempção quando o time slice (alguns ms) acaba. Cada núcleo troca algumas centenas de vezes por segundo, o que dá uma taxa total baixa, mas quase toda **involuntária**. O sintoma aqui não é `cs` alto, e sim `r` muito maior que o número de núcleos: cada thread espera em média 500/8 ≈ 60 fatias para rodar de novo, o que se traduz em latência.

Conclusão: `cs` alto indica muito bloqueio e despertar (I/O, locks, sleeps curtos); `r` alto com `nvcswch` dominante indica mais trabalho CPU do que núcleos. São problemas diferentes, com soluções diferentes.

## Medir o throughput de uma tarefa CPU-bound com 1, N cores e 50x N cores de threads e explicar a curva

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["CPU-bound", "Dimensionamento de thread pool", "Cache", "Context switch involuntário"]}
```

### Enunciado

Implemente um benchmark que divide uma quantidade fixa de trabalho CPU-bound entre `T` threads de um pool fixo e mede o tempo total para `T = 1`, `T = N` (núcleos lógicos) e `T = 50 × N`. Faça duas variantes: uma com working set **pequeno** (só registradores) e outra em que cada tarefa percorre repetidamente um **array próprio de 1 MB**. Explique a curva obtida.

### Objetivo

Verificar experimentalmente por que pools CPU-bound devem ter cerca de `N` threads e entender quando o excesso de threads custa pouco e quando custa muito.

### Instruções

1. Obtenha `N` com `Runtime.getRuntime().availableProcessors()`.
2. Divida um trabalho total fixo em `T` tarefas de tamanho igual e submeta todas a um `Executors.newFixedThreadPool(T)`.
3. Faça uma rodada de aquecimento antes de medir, para o JIT compilar o código.
4. Para cada `T`, meça o tempo (média de 3 execuções) e calcule o speedup em relação a `T = 1`.
5. Na variante com array, cada tarefa aloca seu próprio `int[1 << 18]` (1 MB) e soma seus elementos repetidamente; o número total de passagens deve ser fixo. Rode com `-Xmx2g` ou mais, porque com `50 × N` tarefas haverá centenas de arrays vivos ao mesmo tempo.
6. Opcional (Linux): leia `nonvoluntary_ctxt_switches` em `/proc/self/status` antes e depois de cada rodada.
7. Explique a curva das duas variantes.

### Dicas

- Garanta que o resultado de cada cálculo é usado (some e imprima), senão o JIT pode eliminar o laço.
- Com SMT, `N` lógicos podem render menos que `N` vezes o desempenho de um núcleo, porque dois threads lógicos dividem as mesmas unidades de execução.
- Na variante com array, compare o working set total (`T × 1 MB`) com os tamanhos dos caches L2 (por núcleo) e L3 (compartilhado) da sua CPU.

### Critérios de avaliação

- O benchmark compila, aquece o JIT e mantém o trabalho total constante entre as configurações.
- Mostra speedup próximo de `N` (ou do número de núcleos físicos com algum ganho de SMT) entre `T = 1` e `T = N`.
- Mostra que `T = 50 × N` não melhora e piora pouco na variante sem memória.
- Mostra (ou discute, se a máquina não evidenciar) que a variante com array degrada mais com `50 × N`, por poluição de cache.
- Explica a curva por paralelismo disponível, custo de trocas involuntárias e custo indireto de cache, e conclui sobre o tamanho ideal do pool.

### Solução de referência

```java
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

public class CurvaCpu {
    static final long TRABALHO_TOTAL = 4_000_000_000L;   // iterações na variante sem memória
    static final int PASSAGENS_TOTAIS = 40_000;          // passagens de 1 MB na variante com array

    static long calcular(long iteracoes) {
        long x = 0;
        for (long i = 0; i < iteracoes; i++) {
            x = x * 6364136223846793005L + 1442695040888963407L;   // LCG: não vetoriza, não é eliminado
        }
        return x;
    }

    static long percorrer(int passagens) {
        int[] dados = new int[1 << 18];                  // 1 MB por tarefa
        for (int i = 0; i < dados.length; i++) dados[i] = i;
        long soma = 0;
        for (int p = 0; p < passagens; p++) {
            for (int v : dados) soma += v;
        }
        return soma;
    }

    static double medir(int threads, boolean comArray) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<Callable<Long>> tarefas = new ArrayList<>();
        for (int t = 0; t < threads; t++) {
            if (comArray) {
                int passagens = Math.max(1, PASSAGENS_TOTAIS / threads);
                tarefas.add(() -> percorrer(passagens));
            } else {
                long fatia = TRABALHO_TOTAL / threads;
                tarefas.add(() -> calcular(fatia));
            }
        }
        long t0 = System.nanoTime();
        long acc = 0;
        for (Future<Long> f : pool.invokeAll(tarefas)) acc += f.get();
        double seg = (System.nanoTime() - t0) / 1e9;
        pool.shutdown();
        if (acc == 42) System.out.println("improvável");   // impede eliminação do resultado
        return seg;
    }

    static String involuntarias() {
        try {
            return Files.readAllLines(Path.of("/proc/self/status")).stream()
                    .filter(l -> l.startsWith("nonvoluntary")).findFirst().orElse("n/d");
        } catch (Exception e) {
            return "n/d (não é Linux)";
        }
    }

    public static void main(String[] args) throws Exception {
        int n = Runtime.getRuntime().availableProcessors();
        boolean comArray = args.length > 0 && args[0].equals("array");
        medir(n, comArray);                                // aquecimento
        double base = 0;
        for (int t : new int[] {1, n, 50 * n}) {
            System.out.println("antes: " + involuntarias());
            double soma = 0;
            for (int r = 0; r < 3; r++) soma += medir(t, comArray);
            double media = soma / 3;
            if (t == 1) base = media;
            System.out.printf("T=%4d  tempo=%.2f s  speedup=%.2fx%n", t, media, base / media);
            System.out.println("depois: " + involuntarias());
        }
    }
}
```

Resultados ilustrativos (8 núcleos lógicos, 4 físicos com SMT; varia por máquina):

| T | Sem memória | Speedup | Com array 1 MB | Speedup |
|---|---|---|---|---|
| 1 | 12,0 s | 1,0× | 9,0 s | 1,0× |
| 8 | 2,4 s | ~5× | 2,6 s | ~3,5× |
| 400 | 2,5 s | ~4,8× | 3,0 s | ~3,0× |

**Explicação da curva.**

- De `1` para `N`: o trabalho se espalha pelos núcleos e o tempo cai quase proporcionalmente. O ganho fica abaixo de `N` com SMT, porque dois threads lógicos compartilham as unidades de execução de um núcleo físico; na variante com array, a banda de memória também limita.
- De `N` para `50 × N` sem memória: o número de núcleos não mudou, então o paralelismo máximo é o mesmo. As threads extras só geram trocas involuntárias por fim de time slice (os contadores sobem bastante). Como o time slice é de milissegundos e o custo direto de uma troca é de microssegundos, o overhead é pequeno, alguns por cento. O working set é praticamente só registradores, então não há cache a perder.
- De `N` para `50 × N` com array: agora cada troca coloca no núcleo uma thread cujo 1 MB não está no cache. Com 8 threads, os 8 MB cabem no L2/L3; com 400 threads, 400 MB nunca cabem, e cada thread retomada recarrega seus dados da RAM. A penalidade é aproximadamente *tempo de recarregar o working set ÷ duração do time slice*: recarregar 1 MB leva da ordem de 100 µs, contra fatias de ~1–3 ms, o que dá uma degradação de alguns a dezenas de por cento, dependendo da CPU. Quanto maior o working set e mais curtas as fatias (mais threads, mais bloqueios), maior o custo indireto.

**Conclusão.** Para CPU-bound, threads acima de `N` não aumentam o throughput, apenas adicionam trocas e competição por cache, além de memória para stacks. O pool ideal fica em torno de `N` (ou `N + 1`, para cobrir eventuais page faults ou pausas). Mais threads só se justificam quando as tarefas **esperam** (I/O), e aí a fórmula `N × (1 + espera/CPU)` passa a valer.

## Responder: por que aumentar o pool de threads de 200 para 2.000 piorou a latência do serviço?

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["Thread pool", "Context switch", "Contenção", "Lei de Little", "Pool de conexões", "Virtual threads"]}
```

### Enunciado

Cenário de entrevista: *"Nosso serviço Spring Boot (Tomcat, JDBC, 8 vCPUs, pool HikariCP de 30 conexões) estava com p99 de 300 ms sob pico. Alguém aumentou `server.tomcat.threads.max` de 200 para 2.000 esperando melhorar. O throughput não mudou e o p99 foi para 900 ms. Explique o que provavelmente aconteceu, como você confirmaria e o que faria."*

### Objetivo

Aplicar o custo de context switch, contenção e teoria de filas para diagnosticar um problema real de dimensionamento de threads.

### Instruções

1. Identifique o recurso que realmente limita o throughput.
2. Explique pelo menos quatro mecanismos pelos quais mais threads pioram a latência.
3. Liste métricas e ferramentas que você usaria para confirmar cada hipótese.
4. Proponha correções de curto e médio prazo, incluindo uma discussão sobre virtual threads.

### Dicas

- Se cada requisição precisa de uma conexão ao banco e só há 30, quantas requisições podem estar de fato progredindo?
- Pela Lei de Little, `L = λ × W`: com o mesmo throughput (λ) e mais requisições "em voo" (L), o que acontece com o tempo de resposta (W)?
- Pense no que acontece nos 8 vCPUs quando 2.000 threads acordam juntas, e no GC varrendo 2.000 stacks.

### Critérios de avaliação

- Identifica o pool de conexões (ou outro recurso a jusante) como gargalo e explica que mais threads apenas aumentam a fila na frente dele.
- Cita context switches em massa (voluntários ao bloquear em locks e I/O, involuntários com muitas threads executáveis) e poluição de cache/TLB.
- Cita contenção em locks compartilhados e espera pelo `getConnection()` do Hikari.
- Cita custo de memória (stacks) e de GC (mais raízes, pausas maiores) e o efeito da Lei de Little.
- Propõe métricas concretas (`vmstat`, `pidstat -w`, métricas do Hikari como `pending` e tempo de aquisição, thread dump, logs de GC) e correções coerentes (voltar o pool, timeouts, limitar concorrência, backpressure, revisar queries; virtual threads com limite explícito de concorrência no acesso ao banco).

### Solução de referência

"O primeiro passo é perguntar qual recurso limita o throughput. Cada requisição usa uma conexão JDBC, e há 30. Então, no máximo 30 requisições progridem no banco ao mesmo tempo; as demais esperam. Com 200 threads, cerca de 170 já esperavam no `getConnection()`. Com 2.000, cerca de 1.970 esperam. O throughput é o mesmo porque o gargalo é o mesmo, mas, pela Lei de Little, se o número de requisições em voo aumenta com o mesmo throughput, o tempo médio de cada uma tem de aumentar: elas só estão numa fila maior, aceita pelo Tomcat em vez de recusada ou enfileirada no acceptor.

Além da fila, mais threads trazem custos próprios. Primeiro, **context switches**: cada thread que espera a conexão é estacionada e acordada; cada resposta do banco acorda outra thread; com 2.000 threads em 8 vCPUs, há rajadas em que centenas estão executáveis, e cada uma espera sua fatia de CPU, o que é latência pura. Segundo, **cache e TLB**: o escalonador alterna entre centenas de stacks e working sets diferentes, nenhum fica quente no cache, e todo código roda mais devagar. Terceiro, **contenção**: o lock interno do pool, loggers síncronos, caches sincronizados; mais threads disputando o mesmo lock geram mais bloqueios e mais trocas, um efeito que cresce mais do que linearmente. Quarto, **memória e GC**: 2.000 stacks reservam ~2 GB de espaço virtual e parte disso fica residente; o GC precisa varrer todas as stacks como raízes, então as pausas aumentam, e mais requisições simultâneas significam mais objetos vivos ao mesmo tempo no heap.

Para confirmar: `vmstat 1` e `pidstat -w -t` mostrariam `cs` muito maior e `r` acima do número de vCPUs nos picos; as métricas do Hikari (`hikaricp.connections.pending`, tempo de aquisição) mostrariam a fila de espera; um thread dump (`jcmd <pid> Thread.print`) mostraria centenas de threads em `HikariPool.getConnection`; os logs de GC mostrariam pausas mais longas; e um profiler (async-profiler, JFR) mostraria tempo de CPU em código do kernel e em locks.

Correções: no curto prazo, voltar o pool para perto de 200, ou até menos, e configurar `connectionTimeout` e timeouts de requisição para falhar rápido em vez de enfileirar indefinidamente, com limite de fila no Tomcat (`accept-count`) para aplicar backpressure. No médio prazo, atacar o gargalo real: queries lentas, índices, cache, talvez mais conexões se o banco aguentar, o que deve ser medido. Virtual threads eliminariam o custo de ter milhares de threads bloqueadas, porque bloquear desmonta a virtual thread da carrier sem context switch no kernel, mas **não** criam conexões: continua sendo necessário limitar a concorrência no acesso ao banco, com o próprio pool ou um semáforo. Elas resolvem o custo das threads, não o gargalo a jusante."

## Implementar um escalonador cooperativo de corrotinas simples e comparar com threads preemptivas

```meta
{"type": "implementation", "level": 4, "required": false, "knowledge": ["Escalonamento cooperativo", "Preempção", "Máquina de estados", "Fila de prontos", "Custo de troca"]}
```

### Enunciado

Java não expõe corrotinas diretamente, mas você pode simulá-las com **tarefas como máquinas de estado**: cada tarefa tem um método `passo()` que executa um pedaço do trabalho e devolve uma ação (`Ceder`, `Dormir(ms)` ou `Terminar`). Implemente um escalonador cooperativo single-thread que executa várias dessas tarefas e compare-o com platform threads em dois aspectos: **custo de troca** e **comportamento diante de uma tarefa que não cede**.

### Objetivo

Entender, construindo, como funciona escalonamento cooperativo, por que sua troca é muito mais barata que um context switch do kernel e por que ele depende da boa vontade das tarefas, o que a preempção resolve.

### Instruções

1. Modele as ações com uma `sealed interface` e records.
2. Implemente o escalonador com uma fila de prontos (`ArrayDeque`) e uma fila de adormecidos ordenada pelo horário de despertar (`PriorityQueue`).
3. No laço principal: mova para a fila de prontos as tarefas cujo horário de despertar chegou; se não houver prontas, durma até o próximo despertar; senão, execute um `passo()` da próxima pronta e trate a ação devolvida.
4. Conte o número de trocas (passos executados).
5. Crie tarefas de exemplo: contadores que cedem a cada incremento e uma tarefa que dorme periodicamente.
6. Meça o custo médio de uma troca cooperativa executando 10 milhões de `Ceder` entre duas tarefas.
7. Meça o custo de uma troca entre platform threads com um ping-pong de 200 mil mensagens via `SynchronousQueue`.
8. Crie uma tarefa "egoísta" cujo `passo()` entra num laço de 3 segundos sem ceder. Mostre o efeito no escalonador cooperativo e compare com o mesmo cenário usando platform threads.

### Dicas

- O "contexto" de uma tarefa cooperativa é só o estado guardado nos campos do objeto: não há registradores a salvar, porque cada `passo()` retorna antes da troca.
- Na troca entre platform threads, cada mensagem do ping-pong exige que uma thread bloqueie e a outra acorde, ou seja, context switches no kernel.
- Para a tarefa egoísta, registre o horário em que cada contador imprime: o intervalo entre impressões revela quem monopolizou a CPU.

### Critérios de avaliação

- O escalonador compila, executa várias tarefas intercaladas e suporta `Ceder`, `Dormir` e `Terminar`.
- A fila de adormecidos respeita os horários e o escalonador não faz espera ativa quando não há tarefas prontas.
- Mede o custo por troca cooperativa (esperado: dezenas a cerca de cem nanossegundos) e por troca entre threads (esperado: centenas de nanossegundos a microssegundos), com explicação da diferença e do efeito do spin antes de estacionar.
- Demonstra que a tarefa egoísta congela todas as outras no escalonador cooperativo, mas não com threads preemptivas.
- Relaciona o experimento a event loops, corrotinas e virtual threads (que desmontam só em pontos de bloqueio).

### Solução de referência

```java
import java.util.*;
import java.util.concurrent.SynchronousQueue;

public class Cooperativo {

    sealed interface Acao permits Ceder, Dormir, Terminar {}
    record Ceder() implements Acao {}
    record Dormir(long millis) implements Acao {}
    record Terminar() implements Acao {}

    static final Ceder CEDER = new Ceder();
    static final Terminar TERMINAR = new Terminar();

    interface Tarefa {
        Acao passo();
    }

    static final class Escalonador {
        private record Adormecida(long acordarEmNanos, long ordem, Tarefa tarefa) {}

        private final ArrayDeque<Tarefa> prontas = new ArrayDeque<>();
        private final PriorityQueue<Adormecida> dormindo = new PriorityQueue<>(
                Comparator.comparingLong(Adormecida::acordarEmNanos).thenComparingLong(Adormecida::ordem));
        private long sequencia = 0;
        long trocas = 0;

        void adicionar(Tarefa t) { prontas.add(t); }

        void executar() throws InterruptedException {
            while (!prontas.isEmpty() || !dormindo.isEmpty()) {
                long agora = System.nanoTime();
                while (!dormindo.isEmpty() && dormindo.peek().acordarEmNanos() <= agora) {
                    prontas.add(dormindo.poll().tarefa());
                }
                if (prontas.isEmpty()) {
                    long esperaNanos = dormindo.peek().acordarEmNanos() - agora;
                    Thread.sleep(esperaNanos / 1_000_000, (int) (esperaNanos % 1_000_000));
                    continue;
                }
                Tarefa t = prontas.poll();
                Acao acao = t.passo();          // a tarefa roda até ceder: não há preempção
                trocas++;
                switch (acao) {
                    case Ceder c -> prontas.add(t);
                    case Dormir d -> dormindo.add(new Adormecida(
                            System.nanoTime() + d.millis() * 1_000_000, sequencia++, t));
                    case Terminar fim -> { /* descartada */ }
                }
            }
        }
    }

    // Contador que imprime de tempos em tempos e cede a cada incremento
    static Tarefa contador(String nome, long limite, long inicioNanos) {
        return new Tarefa() {
            long i = 0;                          // o "contexto" da corrotina é este campo
            public Acao passo() {
                i++;
                if (i % 200_000 == 0) {
                    System.out.printf("%6d ms  %s chegou a %d%n",
                            (System.nanoTime() - inicioNanos) / 1_000_000, nome, i);
                }
                return i < limite ? CEDER : TERMINAR;
            }
        };
    }

    static Tarefa dorminhoca(long inicioNanos) {
        return new Tarefa() {
            int vezes = 0;
            public Acao passo() {
                System.out.printf("%6d ms  dorminhoca acordou (%d)%n",
                        (System.nanoTime() - inicioNanos) / 1_000_000, ++vezes);
                return vezes < 5 ? new Dormir(100) : TERMINAR;
            }
        };
    }

    static Tarefa egoista(long inicioNanos) {
        return new Tarefa() {
            boolean rodou = false;
            public Acao passo() {
                if (!rodou) {
                    rodou = true;
                    System.out.printf("%6d ms  egoísta começou a monopolizar%n",
                            (System.nanoTime() - inicioNanos) / 1_000_000);
                    long fim = System.nanoTime() + 3_000_000_000L;
                    while (System.nanoTime() < fim) { /* não cede */ }
                    System.out.printf("%6d ms  egoísta liberou%n",
                            (System.nanoTime() - inicioNanos) / 1_000_000);
                }
                return TERMINAR;
            }
        };
    }

    static void medirTrocaCooperativa() throws InterruptedException {
        Escalonador e = new Escalonador();
        long limite = 5_000_000;                 // 2 tarefas × 5 milhões = 10 milhões de trocas
        for (int k = 0; k < 2; k++) {
            e.adicionar(new Tarefa() {
                long i = 0;
                public Acao passo() { return ++i < limite ? CEDER : TERMINAR; }
            });
        }
        long t0 = System.nanoTime();
        e.executar();
        long ns = System.nanoTime() - t0;
        System.out.printf("cooperativo: %d trocas, %.1f ns por troca%n", e.trocas, (double) ns / e.trocas);
    }

    static void medirTrocaThreads() throws InterruptedException {
        int mensagens = 200_000;
        SynchronousQueue<Integer> ida = new SynchronousQueue<>();
        SynchronousQueue<Integer> volta = new SynchronousQueue<>();
        Thread eco = new Thread(() -> {
            try {
                for (int i = 0; i < mensagens; i++) volta.put(ida.take());
            } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
        });
        eco.start();
        long t0 = System.nanoTime();
        for (int i = 0; i < mensagens; i++) {
            ida.put(i);
            volta.take();
        }
        long ns = System.nanoTime() - t0;
        eco.join();
        System.out.printf("platform threads: %.0f ns por troca (ping-pong)%n", (double) ns / (2.0 * mensagens));
    }

    static void egoistaComThreads(long inicio) throws InterruptedException {
        List<Thread> ts = new ArrayList<>();
        for (String nome : List.of("A", "B")) {
            ts.add(new Thread(() -> {
                long contagem = 0;
                long proximoRelato = System.nanoTime();
                long fim = System.nanoTime() + 3_500_000_000L;
                while (System.nanoTime() < fim) {
                    contagem++;
                    if (System.nanoTime() >= proximoRelato) {
                        System.out.printf("%6d ms  thread %s chegou a %d%n",
                                (System.nanoTime() - inicio) / 1_000_000, nome, contagem);
                        proximoRelato += 500_000_000L;
                    }
                }
            }));
        }
        ts.add(new Thread(() -> egoista(inicio).passo()));
        for (Thread t : ts) t.start();
        for (Thread t : ts) t.join();
    }

    public static void main(String[] args) throws InterruptedException {
        medirTrocaCooperativa();
        medirTrocaThreads();

        System.out.println("\n--- cooperativo com tarefa egoísta ---");
        long inicio = System.nanoTime();
        Escalonador e = new Escalonador();
        e.adicionar(contador("A", 1_000_000, inicio));
        e.adicionar(contador("B", 1_000_000, inicio));
        e.adicionar(dorminhoca(inicio));
        e.adicionar(egoista(inicio));
        e.executar();

        System.out.println("\n--- platform threads (preemptivas) com tarefa egoísta ---");
        egoistaComThreads(System.nanoTime());
    }
}
```

**Resultados ilustrativos:**

- Troca cooperativa: ~20–100 ns. É uma chamada de método via interface, um `poll` e um `add` em `ArrayDeque` e uma leitura de `System.nanoTime()` por volta do laço; tudo em modo usuário, com o estado das tarefas quente no cache. Numa execução de referência no Windows, deu ~98 ns.
- Ping-pong entre platform threads: de ~0,5 a alguns µs por troca (na mesma execução de referência, ~600 ns). Cada `put`/`take` que encontra o outro lado dormindo precisa estacionar uma thread e acordar a outra (`futex` no Linux, eventos no Windows), o que passa pelo escalonador do kernel. O número medido costuma **subestimar** o context switch, porque `SynchronousQueue` gira (*spin*) brevemente antes de estacionar: com as duas threads em núcleos diferentes, muitas trocas de mensagem acontecem sem nenhuma das threads dormir. Para ver o custo completo, rode com o processo preso a um único núcleo (`taskset -c 0` no Linux, `start /affinity 1` no Windows): aí toda mensagem exige um context switch real e o tempo por troca sobe para a faixa de microssegundos. Mesmo no melhor caso, a troca cooperativa é uma ordem de grandeza mais barata.

**Tarefa egoísta.** No escalonador cooperativo, assim que a egoísta recebe a CPU, **nada mais roda por 3 segundos**: os contadores param de imprimir e a dorminhoca, que deveria acordar a cada 100 ms, acorda com 3 s de atraso. Não há como o escalonador intervir, porque ele só recupera o controle quando `passo()` retorna. Com platform threads, as threads A e B relatam progresso a cada ~500 ms durante os 3 segundos em que a egoísta gira: com vários núcleos, elas rodam em paralelo; mesmo restringindo o processo a um único núcleo (`taskset -c 0 java Cooperativo` no Linux), o kernel preempta a egoísta ao fim de cada time slice e as três se alternam.

**Relação com sistemas reais.** É exatamente o problema de bloquear o event loop no Node.js ou no Netty: um cálculo longo ou uma chamada bloqueante num handler congela todas as conexões daquele loop. As virtual threads do Java têm uma variante do mesmo comportamento: elas só desmontam em pontos de bloqueio conhecidos, então uma virtual thread em laço CPU-bound longo ocupa sua carrier até terminar (o escalonador da JDK não faz preempção por tempo). A diferença em relação ao experimento é que as carriers são platform threads, e o SO continua preemptando-as entre si e entre outros processos.

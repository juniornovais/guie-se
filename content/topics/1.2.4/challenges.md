## Construir uma tabela comparativa processo vs. thread em isolamento, custo, comunicação e falhas

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Processo", "Thread", "Isolamento de memória", "IPC", "Copy-on-write"]}
```

### Enunciado

Sem consultar o conteúdo, monte uma tabela comparando **processos** e **threads do mesmo processo** em pelo menos sete critérios: isolamento de memória, o que é compartilhado, custo de criação, custo de troca de contexto, mecanismo de comunicação, impacto de uma falha e segurança. Depois responda às três perguntas abaixo.

1. No Linux, por que se diz que "processo e thread são a mesma coisa para o kernel"? O que diferencia um do outro na criação?
2. Se o `fork` usa copy-on-write, por que ele ainda pode ser caro?
3. A stack de uma thread é privada. Uma thread consegue corromper a stack de outra thread do mesmo processo? E a de outro processo?

### Objetivo

Consolidar as diferenças estruturais entre processo e thread e conseguir explicá-las a partir do que o kernel compartilha ou não.

### Instruções

1. Faça a tabela com duas colunas (processo, thread) e uma linha por critério.
2. Em cada célula, justifique em uma frase o **porquê**, não apenas o quê (exemplo: "barato porque não troca o espaço de endereçamento").
3. Inclua ordens de grandeza de custo quando souber, deixando claro que são aproximadas.
4. Responda às três perguntas em parágrafos curtos.

### Dicas

- Pense em quais recursos a nova unidade de execução ganha "do zero" e quais ela herda por referência.
- Procure pelas flags de `clone()`: `CLONE_VM`, `CLONE_FILES`, `CLONE_SIGHAND`, `CLONE_THREAD`.
- No `fork`, as páginas não são copiadas de início, mas as **tabelas de páginas** e as VMAs são.

### Critérios de avaliação

- A tabela tem pelo menos sete critérios, todos com justificativa.
- Afirma corretamente que threads compartilham heap, código, globais e descritores, e têm stack, registradores e PC próprios.
- Relaciona o custo de criação e de troca do processo ao espaço de endereçamento (tabelas de páginas, TLB).
- Distingue comunicação por memória compartilhada (com sincronização) de IPC (com cópia e serialização).
- Explica que falhas de nível de processo (`System.exit`, segfault em código nativo) derrubam todas as threads.
- Responde corretamente às três perguntas.

### Solução de referência

| Critério | Processo | Thread (mesmo processo) |
|---|---|---|
| Isolamento de memória | Forte: espaço de endereçamento próprio, garantido pela MMU | Nenhum: todas veem o mesmo espaço de endereçamento |
| O que compartilha | Nada por padrão (após `fork`, compartilha páginas via COW até alguém escrever) | Heap, código, variáveis globais/estáticas, descritores de arquivo, credenciais, handlers de sinais |
| O que é privado | Tudo | Registradores, PC, stack, thread-local storage |
| Custo de criação | Alto: novo espaço de endereçamento, cópia de tabelas de páginas, normalmente `exec` e carregamento de bibliotecas (≈ 1 ms ou mais; JVM nova: centenas de ms) | Baixo: só stack, `task_struct` e estruturas do runtime (≈ dezenas de µs) |
| Custo de troca | Maior: troca de tabelas de páginas, TLB e caches perdem eficácia | Menor: mesmo espaço de endereçamento, TLB e caches continuam úteis |
| Comunicação | IPC (pipes, sockets, memória compartilhada, arquivos): cópia pelo kernel e serialização | Leitura/escrita direta de objetos: barata, mas exige sincronização |
| Impacto de falha | Contido: só o processo morre; o pai pode recriá-lo | Exceção Java mata só a thread, mas pode deixar estado inconsistente; falha de processo mata todas |
| Segurança | Fronteira de segurança real (sandbox, privilégios diferentes) | Nenhuma: todas têm as mesmas permissões e acesso a toda a memória |
| Memória total | Maior: cada processo tem seu heap, caches e runtime | Menor: um heap, um runtime, uma cópia dos caches |

**1.** No Linux, ambos são *tasks* (`task_struct`) criadas por `clone()`. Uma thread é uma task criada com `CLONE_VM`, `CLONE_FILES`, `CLONE_SIGHAND`, `CLONE_THREAD` etc., ou seja, compartilhando o espaço de endereçamento e os recursos de quem a criou. Um processo é uma task criada sem essas flags, recebendo cópias próprias.

**2.** Porque o kernel precisa duplicar as tabelas de páginas e as estruturas que descrevem as regiões mapeadas, e marcar todas as páginas como somente leitura nos dois processos. Isso é proporcional à memória mapeada: um processo com dezenas de GB (Redis fazendo `BGSAVE`) pode ficar congelado por milissegundos. Depois, cada escrita em página compartilhada gera uma page fault e uma cópia, aumentando consumo de memória e latência.

**3.** Sim, dentro do mesmo processo: a stack é privada por convenção, mas está no mesmo espaço de endereçamento; em C, um ponteiro inválido pode escrever nela. Em Java puro isso não acontece porque não há aritmética de ponteiros, mas código nativo (JNI) pode fazê-lo. Outro processo, não: nenhum endereço virtual dele mapeia as páginas do primeiro, a menos que ambos mapeiem explicitamente uma região de memória compartilhada.

## Medir o tempo para criar 1.000 threads vs. 1.000 processos e explicar a diferença

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["Thread.start", "ProcessBuilder", "fork/exec", "Medição de desempenho"]}
```

### Enunciado

Escreva um programa Java 21 que meça o tempo médio para criar, iniciar e aguardar o término de 1.000 threads que não fazem nada, e de 1.000 processos que executam um comando trivial do sistema. Compare os resultados e explique de onde vem a diferença.

### Objetivo

Ver na prática a diferença de ordem de grandeza entre criar threads e criar processos, e saber explicar quais etapas do kernel e do runtime causam essa diferença.

### Instruções

1. Crie o programa medindo com `System.nanoTime()`.
2. Para threads, use `new Thread(() -> {})`, `start()` e `join()` em sequência.
3. Para processos, use `ProcessBuilder` executando `true` (Linux/macOS) ou `cmd /c exit` (Windows), com `waitFor()`.
4. Rode cada medição pelo menos três vezes e descarte a primeira (aquecimento).
5. Acrescente uma terceira medição: 1.000 **virtual threads** (`Thread.ofVirtual().start(...)`).
6. Registre os resultados em µs por unidade e explique a diferença listando as etapas envolvidas em cada caso.
7. Opcional (Linux, WSL ou Docker): repita com um programa em C usando `pthread_create` e `fork` + `waitpid`, sem `exec`.

### Dicas

- Criar e esperar em sequência mede latência de criação, não paralelismo. Isso é intencional.
- O processo filho precisa ser carregado do disco (ou do page cache), linkado dinamicamente e inicializado; a thread não carrega nada.
- Se quiser saber como a JDK cria processos no Linux, pesquise a propriedade `jdk.lang.Process.launchMechanism` (o padrão é `POSIX_SPAWN`).

### Critérios de avaliação

- O programa compila, executa e imprime o tempo médio por thread, por virtual thread e por processo.
- Os resultados mostram uma diferença de pelo menos uma ordem de grandeza entre threads e processos.
- A explicação cita: novo espaço de endereçamento, tabelas de páginas, `exec`, carregamento do executável e bibliotecas, versus apenas stack e estruturas da thread.
- Comenta que virtual threads não criam thread do SO e por isso são ainda mais baratas.
- Reconhece que os números variam por SO, hardware e kernel, e que o Windows tende a ter processos mais caros.

### Solução de referência

```java
import java.util.List;

public class CriacaoBench {
    static final int N = 1_000;

    static long medirThreads() throws InterruptedException {
        long t0 = System.nanoTime();
        for (int i = 0; i < N; i++) {
            Thread t = new Thread(() -> {});
            t.start();
            t.join();
        }
        return System.nanoTime() - t0;
    }

    static long medirVirtuais() throws InterruptedException {
        long t0 = System.nanoTime();
        for (int i = 0; i < N; i++) {
            Thread t = Thread.ofVirtual().start(() -> {});
            t.join();
        }
        return System.nanoTime() - t0;
    }

    static long medirProcessos() throws Exception {
        boolean windows = System.getProperty("os.name").toLowerCase().contains("win");
        List<String> cmd = windows ? List.of("cmd", "/c", "exit") : List.of("true");
        long t0 = System.nanoTime();
        for (int i = 0; i < N; i++) {
            Process p = new ProcessBuilder(cmd).start();
            p.waitFor();
        }
        return System.nanoTime() - t0;
    }

    public static void main(String[] args) throws Exception {
        for (int rodada = 1; rodada <= 3; rodada++) {
            double th = medirThreads() / 1e3 / N;
            double vt = medirVirtuais() / 1e3 / N;
            double pr = medirProcessos() / 1e3 / N;
            System.out.printf("rodada %d: thread %.1f µs | virtual %.2f µs | processo %.1f µs%n",
                    rodada, th, vt, pr);
        }
    }
}
```

Resultados ilustrativos (notebook recente; os seus vão variar):

| Unidade | Linux | Windows |
|---|---|---|
| Platform thread | ~30–80 µs | ~50–150 µs |
| Virtual thread | ~1–5 µs | ~1–5 µs |
| Processo (`true` / `cmd /c exit`) | ~0,5–2 ms | ~5–20 ms |

**Explicação.** Para a thread, a JVM aloca uma stack (um `mmap` com guard page), cria a thread do SO via `pthread_create` (`clone` compartilhando o espaço de endereçamento), registra a thread nas estruturas internas da JVM e, no fim, a destrói. Nada é carregado e nenhuma tabela de páginas é criada.

Para o processo, o kernel cria um espaço de endereçamento novo; `exec` lê o executável, mapeia suas seções, o *dynamic linker* carrega e reloca as bibliotecas compartilhadas, o programa inicializa, termina, e o kernel desmonta tudo, liberando páginas e descritores; por fim, o pai recolhe o status (`waitpid`). No Windows, `CreateProcess` faz trabalho adicional (subsistema, DLLs, segurança), e `cmd.exe` é um programa mais pesado que `/bin/true`.

Atenção às condições da máquina: antivírus em tempo real (comum no Windows), máquina sobrecarregada ou rodando sob virtualização podem multiplicar esses números, especialmente o de processos, porque cada novo executável pode ser inspecionado antes de rodar. Numa máquina Windows carregada, por exemplo, já se observou ~2 ms por thread e ~90 ms por processo. O que importa é a razão entre eles, que continua sendo de uma a duas ordens de grandeza.

A virtual thread não cria thread do SO: é um objeto no heap agendado num pool de carrier threads, por isso custa da ordem de microssegundos ou menos.

No experimento opcional em C, `fork` sem `exec` costuma ficar na faixa de ~50–200 µs para um processo pequeno e `pthread_create` em ~5–20 µs, o que mostra que boa parte do custo de "criar um processo" em Java vem do `exec` e da inicialização do programa.

## Justificar por que navegadores usam um processo por aba enquanto servidores Java usam threads

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["Sandbox", "Isolamento de falhas", "Custo de memória", "Arquitetura multi-processo"]}
```

### Enunciado

Em uma entrevista, perguntam: *"O Chrome usa vários processos, um por aba ou por site. Um servidor Spring Boot roda tudo num único processo com centenas de threads. Por que essas escolhas opostas? Uma delas está errada?"*. Escreva sua resposta como a daria em cerca de três minutos de fala.

### Objetivo

Justificar decisões arquiteturais reais a partir dos trade-offs de processo vs. thread: modelo de ameaça, contenção de falhas, custo de memória e de comunicação.

### Instruções

1. Comece identificando o que é diferente nos **dois problemas**, e não nas tecnologias.
2. Para o navegador, discuta: origem do código executado, segurança (sandbox, Spectre), contenção de falhas e o custo pago.
3. Para o servidor Java, discuta: custo de inicialização da JVM, compartilhamento de heap, GC e caches, padrão de comunicação entre requisições, e onde o isolamento é obtido.
4. Cite pelo menos um outro sistema que escolheu processos (Nginx, PostgreSQL ou Apache prefork) e explique a escolha.
5. Feche respondendo se alguma está errada.

### Dicas

- Quem escreveu o código que roda no renderizador do navegador? E no servidor?
- Uma vulnerabilidade de leitura arbitrária de memória numa thread expõe o quê?
- Num servidor Java, se uma instância morrer, o que impede o serviço de cair? A resposta não está dentro do processo.

### Critérios de avaliação

- Identifica que o navegador executa código não confiável e por isso precisa de fronteira de segurança, que só o processo oferece.
- Menciona contenção de falhas (uma aba travada ou com crash não derruba as outras) e o custo em memória.
- Explica que a JVM tem inicialização e aquecimento caros, e que heap, GC, JIT e caches compartilhados tornam threads mais eficientes.
- Aponta que o isolamento em servidores vem de múltiplas instâncias/containers atrás de um balanceador.
- Analisa corretamente um terceiro sistema e conclui que ambas as escolhas são coerentes com seus requisitos.

### Solução de referência

"As escolhas são opostas porque os problemas são opostos. O navegador executa **código não confiável**: qualquer página da internet roda JavaScript e envia imagens, fontes e vídeos para serem decodificados. Isso tem dois riscos. Primeiro, segurança: se uma vulnerabilidade no motor de renderização permitir ler memória, e ataques como Spectre mostraram que até leitura especulativa é possível, tudo que estiver no mesmo espaço de endereçamento fica exposto, incluindo cookies e dados de outros sites. Threads não oferecem fronteira alguma; processos sim, porque a MMU impede um processo de ler a memória do outro, e o Chrome ainda roda os renderizadores num sandbox com privilégios mínimos. Segundo, robustez: uma aba que entra em laço infinito ou estoura memória não derruba o navegador. O preço é memória, porque cada processo tem seu próprio heap do V8 e suas estruturas, e comunicação por IPC entre o processo do browser e os renderizadores. Por isso o Chrome agrupa abas do mesmo site e, com pouca memória, consolida processos.

O servidor Java executa **código confiável**, escrito e testado pelo próprio time, com um padrão de trabalho de muitas requisições curtas que compartilham caches, pool de conexões e configuração. A JVM custa centenas de milissegundos para iniciar e precisa de aquecimento do JIT, então um processo por requisição seria inviável. Em um processo, há um heap, um GC, um JIT, um cache local acessível por todas as threads e comunicação por referência, sem serialização. Uma exceção numa requisição mata, no máximo, aquela thread, e o framework a trata. O isolamento existe, mas em outra camada: várias réplicas do serviço, em containers, atrás de um balanceador; se uma instância cai, as outras continuam.

Outro exemplo é o Nginx: um master e um worker por núcleo, cada worker single-thread com event loop. Processos dão isolamento barato e reload sem downtime, e como os workers quase não compartilham estado, não pagam o preço da comunicação. Já o PostgreSQL cria um processo por conexão, por robustez e por razões históricas, e paga em memória e tempo de `fork`, por isso usamos pools de conexão.

Nenhuma das duas está errada. A pergunta certa é qual a unidade de falha e de segurança que o sistema precisa e quanto ele aceita pagar por ela."

## Analisar o impacto de uma exceção não tratada em uma thread de pool vs. um System.exit em um worker

```meta
{"type": "code_analysis", "level": 3, "required": false, "knowledge": ["ExecutorService", "UncaughtExceptionHandler", "System.exit", "Isolamento de falhas", "ReentrantLock"]}
```

### Enunciado

Analise o programa abaixo **antes de executá-lo**. Preveja exatamente o que será impresso e o que acontece com as tarefas em cada um dos casos A, B, C e D. Depois execute cada caso (passando a letra como argumento) e compare com sua previsão.

```java
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;

public class Falhas {
    static final ReentrantLock LOCK = new ReentrantLock();
    static int saldo = 100;

    public static void main(String[] args) throws Exception {
        String caso = args.length > 0 ? args[0] : "A";
        ExecutorService pool = Executors.newFixedThreadPool(2);

        for (int i = 1; i <= 4; i++) {
            final int id = i;
            Runnable tarefa = () -> {
                if (id == 2) {
                    switch (caso) {
                        case "A", "B" -> throw new IllegalStateException("falha na tarefa 2");
                        case "C" -> System.exit(1);
                        case "D" -> {
                            LOCK.lock();
                            saldo -= 50;
                            throw new IllegalStateException("falha com lock adquirido");
                        }
                    }
                }
                LOCK.lock();
                try {
                    saldo -= 10;
                } finally {
                    LOCK.unlock();
                }
                System.out.println("tarefa " + id + " ok em " + Thread.currentThread().getName());
            };
            if (caso.equals("B")) pool.submit(tarefa); else pool.execute(tarefa);
            Thread.sleep(100);
        }

        pool.shutdown();
        boolean terminou = pool.awaitTermination(2, TimeUnit.SECONDS);
        System.out.println("terminou=" + terminou + " saldo=" + saldo);
        System.exit(0);
    }
}
```

### Objetivo

Entender o raio de explosão de cada tipo de falha dentro de um processo multi-thread e compará-lo com o de uma arquitetura em que cada worker é um processo.

### Instruções

1. Para cada caso, escreva a previsão: quais tarefas imprimem "ok", em quais threads, se aparece stack trace, e o valor final de `terminou` e `saldo`.
2. Execute `java Falhas.java A`, `B`, `C` e `D` e compare.
3. Explique o que o `ThreadPoolExecutor` faz com uma worker thread que lançou exceção em `execute` e em `submit`.
4. Explique por que o caso C é qualitativamente diferente dos outros.
5. Explique por que o caso D é o mais perigoso dentre os que não encerram o processo.
6. Descreva o que aconteceria com cada caso se os workers fossem **processos** gerenciados por um master (como no Nginx).

### Dicas

- Com `execute`, a exceção sobe até a worker thread, que morre; o pool cria outra para manter o tamanho. Observe os nomes das threads.
- Com `submit`, a exceção é capturada e guardada no `Future`. Ninguém chama `get()`.
- `ReentrantLock` não é liberado automaticamente quando a thread morre, ao contrário de `synchronized`.

### Critérios de avaliação

- Prevê corretamente o caso A: stack trace da tarefa 2, tarefas 1, 3 e 4 ok, uma thread nova (por exemplo `pool-1-thread-3`) aparece, `saldo=70`.
- Prevê corretamente o caso B: nenhum stack trace (exceção engolida no `Future`), tarefas 1, 3, 4 ok, `saldo=70`.
- Prevê corretamente o caso C: o processo inteiro termina com código 1 logo na tarefa 2; tarefas 3 e 4 nunca rodam e a linha final não é impressa.
- Prevê corretamente o caso D: o lock fica preso, tarefas 3 e 4 bloqueiam para sempre, `terminou=false`, `saldo=40`.
- Compara com o modelo multi-processo: no caso C só o worker morreria e seria recriado pelo master; no caso D o lock de um processo morto não bloquearia os outros (cada um tem sua memória).

### Solução de referência

**Caso A (`execute` + exceção).** A tarefa 1 imprime `ok em pool-1-thread-1`. A tarefa 2 roda em `pool-1-thread-2`, lança a exceção, que sobe até o `run()` da worker thread; o `ThreadPoolExecutor` registra a morte e cria uma worker nova. O `UncaughtExceptionHandler` padrão imprime `Exception in thread "pool-1-thread-2" java.lang.IllegalStateException: falha na tarefa 2`. Tarefas 3 e 4 rodam (uma delas em `pool-1-thread-3`, a substituta). Saída final: `terminou=true saldo=70`. A falha ficou contida na thread, e o pool se recuperou.

**Caso B (`submit` + exceção).** O `submit` embrulha a tarefa num `FutureTask`, que captura qualquer `Throwable` e o guarda para ser relançado em `get()` como `ExecutionException`. Como ninguém chama `get()`, **nada é impresso**: a falha some silenciosamente. A worker thread não morre. Saída: tarefas 1, 3, 4 ok e `terminou=true saldo=70`. Esse é um bug comum em produção: erros "engolidos" por `submit` sem tratamento do `Future`.

**Caso C (`System.exit`).** `System.exit(1)` inicia o encerramento da **JVM inteira**: executa os shutdown hooks e termina o processo com código 1. Todas as threads morrem, incluindo `main` e a thread que executaria as tarefas 3 e 4. A linha final nunca é impressa. Uma única linha de código numa tarefa qualquer derrubou todas as outras, porque a unidade de recursos do SO é o processo. O mesmo raio de explosão vale para uma segfault em código nativo ou um `kill -9`.

**Caso D (exceção com lock adquirido).** A tarefa 2 adquire o lock, altera `saldo` para 40 (100 − 10 − 50) e lança a exceção sem chamar `unlock()`: o stack trace aparece como no caso A e a worker thread morre. O `ReentrantLock` continua registrado como pertencente a uma thread que não existe mais. As tarefas 3 e 4 bloqueiam em `LOCK.lock()` para sempre, as duas worker threads ficam presas, e `awaitTermination` expira: `terminou=false saldo=40`. O `System.exit(0)` final encerra o processo, senão ele ficaria travado. É o caso mais perigoso porque o processo **parece vivo** (não caiu, health check simples passa), mas parte dele está em deadlock, e o estado compartilhado ficou corrompido (o débito de 50 foi aplicado sem completar a operação). A correção é sempre `lock(); try { ... } finally { unlock(); }`. Com `synchronized`, o monitor seria liberado ao sair do bloco por exceção, mas o estado ainda poderia ficar inconsistente.

**Com workers em processos (modelo master/worker):**

- Caso A/B: o worker trataria a exceção ou morreria sozinho; em ambos os casos, os outros workers seguem.
- Caso C: `exit(1)` encerraria **apenas aquele worker**. O master recebe `SIGCHLD`, chama `waitpid`, registra o código de saída e cria um substituto. As tarefas 3 e 4 seriam executadas pelos outros workers.
- Caso D: o lock e o saldo estariam na memória privada do worker que morreu; essa memória é descartada pelo kernel. Os outros workers não seriam afetados. Só haveria problema se o estado estivesse em memória compartilhada entre processos (como os locks do PostgreSQL), e por isso o postmaster, ao detectar a morte anormal de um backend, reinicia todos os backends: ele não confia mais na memória compartilhada.

## Implementar o mesmo processador de jobs com workers em threads e em processos e comparar throughput e isolamento

```meta
{"type": "project", "level": 4, "required": false, "knowledge": ["ExecutorService", "ProcessBuilder", "IPC por pipes", "Supervisão de processos", "Throughput"]}
```

### Enunciado

Construa um processador de jobs CPU-bound com dois modos de execução intercambiáveis:

- **threads**: um pool de N threads no mesmo processo;
- **processos**: um master que mantém N processos worker (outras JVMs), enviando jobs e recebendo resultados por **stdin/stdout** (pipes).

Cada job é "contar quantos primos existem até `n`". Um job especial "veneno" faz o worker executar `System.exit(3)`. Compare throughput e isolamento dos dois modos.

### Objetivo

Sentir na prática o custo do isolamento (inicialização de processos, IPC, serialização) e o seu benefício (contenção de falhas e recuperação por supervisão).

### Instruções

1. Defina o protocolo de texto: o master envia `id;n` e o worker responde `id;resultado`, uma linha por job.
2. Implemente o modo `threads` com `Executors.newFixedThreadPool(N)`.
3. Implemente o modo `processos`: para cada worker, uma thread "gerente" no master envia jobs de uma `BlockingQueue` compartilhada e lê a resposta.
4. Se o worker morrer (leitura retorna `null` ou ocorre `IOException`), o gerente deve recriar o processo e **reenfileirar** o job. Depois de 2 tentativas, o job é marcado como falho (para não matar workers indefinidamente).
5. Meça jobs por segundo nos dois modos com jobs **pesados** (n = 200.000) e **leves** (n = 100), com N = número de núcleos.
6. Rode os dois modos com o job veneno ativado e registre o que acontece.
7. Escreva uma conclusão: em que cenário cada modo vence e por quê.

### Dicas

- Para iniciar a mesma classe como worker: `ProcessHandle.current().info().command()` dá o caminho do `java`, e `System.getProperty("java.class.path")` dá o classpath. Compile com `javac` em vez de usar o modo *source-file*, para que o classpath contenha a classe.
- Sempre faça `flush()` depois de escrever uma linha no pipe, senão o outro lado espera para sempre.
- No modo processos com jobs leves, o tempo é dominado pelo vai e vem nos pipes e pela troca de contexto entre master e worker a cada job; com jobs pesados, pelo cálculo. Lembre também que cada JVM worker começa sem JIT aquecido.

### Critérios de avaliação

- O código compila e os dois modos produzem o mesmo total de primos para a mesma carga.
- O modo processos usa pipes para comunicação e cada worker é um processo separado (confirmável com `jps` ou o gerenciador de tarefas).
- Com veneno, o modo threads encerra o processo inteiro e o modo processos conclui todos os outros jobs, recriando workers e marcando o veneno como falho.
- A comparação de throughput mostra resultados próximos para jobs pesados e grande vantagem das threads para jobs leves, com explicação coerente (IPC, serialização, startup, JIT frio).
- A conclusão relaciona os resultados ao trade-off isolamento × custo.

### Solução de referência

```java
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public class JobProcessor {
    static final int VENENO = -1;

    record Job(int id, int n, int tentativas) {}

    static long contarPrimos(int n) {
        if (n == VENENO) System.exit(3);
        long total = 0;
        for (int i = 2; i <= n; i++) {
            boolean primo = true;
            for (int d = 2; (long) d * d <= i; d++) {
                if (i % d == 0) { primo = false; break; }
            }
            if (primo) total++;
        }
        return total;
    }

    static List<Job> gerarJobs(int quantidade, int n, boolean veneno) {
        List<Job> jobs = new ArrayList<>();
        for (int i = 0; i < quantidade; i++) {
            boolean ehVeneno = veneno && i == quantidade / 2;
            jobs.add(new Job(i, ehVeneno ? VENENO : n, 0));
        }
        return jobs;
    }

    public static void main(String[] args) throws Exception {
        String modo = args.length > 0 ? args[0] : "threads";
        if (modo.equals("worker")) { rodarWorker(); return; }

        int workers = args.length > 1 ? Integer.parseInt(args[1]) : Runtime.getRuntime().availableProcessors();
        int quantidade = args.length > 2 ? Integer.parseInt(args[2]) : 2_000;
        int n = args.length > 3 ? Integer.parseInt(args[3]) : 200_000;
        boolean veneno = args.length > 4 && args[4].equals("veneno");

        List<Job> jobs = gerarJobs(quantidade, n, veneno);
        long t0 = System.nanoTime();
        long[] resultado = modo.equals("processos") ? viaProcessos(jobs, workers) : viaThreads(jobs, workers);
        double seg = (System.nanoTime() - t0) / 1e9;
        System.out.printf("modo=%s workers=%d jobs=%d n=%d -> %.2f s, %.0f jobs/s, soma=%d, falhas=%d%n",
                modo, workers, quantidade, n, seg, quantidade / seg, resultado[0], resultado[1]);
    }

    // ---------- modo threads ----------
    static long[] viaThreads(List<Job> jobs, int workers) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(workers);
        List<Future<Long>> futuros = new ArrayList<>();
        for (Job j : jobs) futuros.add(pool.submit(() -> contarPrimos(j.n())));
        long soma = 0;
        for (Future<Long> f : futuros) soma += f.get();
        pool.shutdown();
        return new long[] {soma, 0};
    }

    // ---------- modo processos: master ----------
    static long[] viaProcessos(List<Job> jobs, int workers) throws Exception {
        BlockingQueue<Job> fila = new LinkedBlockingQueue<>(jobs);
        CountDownLatch pendentes = new CountDownLatch(jobs.size());
        AtomicLong soma = new AtomicLong();
        AtomicLong falhas = new AtomicLong();

        List<Thread> gerentes = new ArrayList<>();
        for (int i = 0; i < workers; i++) {
            Thread g = new Thread(new Gerente(fila, pendentes, soma, falhas), "gerente-" + i);
            g.start();
            gerentes.add(g);
        }
        pendentes.await();
        for (Thread g : gerentes) g.interrupt();
        for (Thread g : gerentes) g.join();
        return new long[] {soma.get(), falhas.get()};
    }

    static final class Gerente implements Runnable {
        private final BlockingQueue<Job> fila;
        private final CountDownLatch pendentes;
        private final AtomicLong soma, falhas;
        private Process proc;
        private BufferedWriter paraWorker;
        private BufferedReader doWorker;

        Gerente(BlockingQueue<Job> fila, CountDownLatch pendentes, AtomicLong soma, AtomicLong falhas) {
            this.fila = fila; this.pendentes = pendentes; this.soma = soma; this.falhas = falhas;
        }

        private void iniciarWorker() throws IOException {
            String java = ProcessHandle.current().info().command().orElse("java");
            String cp = System.getProperty("java.class.path");
            proc = new ProcessBuilder(java, "-cp", cp, "JobProcessor", "worker")
                    .redirectError(ProcessBuilder.Redirect.INHERIT)
                    .start();
            paraWorker = new BufferedWriter(new OutputStreamWriter(proc.getOutputStream()));
            doWorker = new BufferedReader(new InputStreamReader(proc.getInputStream()));
        }

        @Override
        public void run() {
            try {
                iniciarWorker();
                while (!Thread.currentThread().isInterrupted()) {
                    Job job = fila.poll(50, TimeUnit.MILLISECONDS);
                    if (job == null) continue;
                    String resposta;
                    try {
                        paraWorker.write(job.id() + ";" + job.n());
                        paraWorker.newLine();
                        paraWorker.flush();
                        resposta = doWorker.readLine();
                    } catch (IOException e) {
                        resposta = null;                       // pipe quebrado: worker morreu
                    }
                    if (resposta == null) {
                        int codigo = proc.waitFor();
                        System.err.printf("[%s] worker %d morreu (exit=%d) no job %d%n",
                                Thread.currentThread().getName(), proc.pid(), codigo, job.id());
                        if (job.tentativas() + 1 < 2) {
                            fila.add(new Job(job.id(), job.n(), job.tentativas() + 1));
                        } else {
                            falhas.incrementAndGet();
                            pendentes.countDown();
                        }
                        iniciarWorker();                       // supervisão: recria o worker
                        continue;
                    }
                    soma.addAndGet(Long.parseLong(resposta.split(";")[1]));
                    pendentes.countDown();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            } finally {
                if (proc != null) proc.destroy();
            }
        }
    }

    // ---------- modo processos: worker ----------
    static void rodarWorker() throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));
        String linha;
        while ((linha = in.readLine()) != null) {
            String[] partes = linha.split(";");
            long r = contarPrimos(Integer.parseInt(partes[1]));
            out.println(partes[0] + ";" + r);
            out.flush();
        }
    }
}
```

Uso:

```bash
javac JobProcessor.java
java JobProcessor threads   8 2000 200000
java JobProcessor processos 8 2000 200000
java JobProcessor threads   8 200000 100
java JobProcessor processos 8 200000 100
java JobProcessor threads   8 2000 200000 veneno
java JobProcessor processos 8 2000 200000 veneno
```

**Resultados esperados (ilustrativos, 8 núcleos):**

| Carga | threads | processos | Por quê |
|---|---|---|---|
| 2.000 jobs pesados | ~X jobs/s | ~0,9–1,0 X | O cálculo domina; o custo do IPC (µs) e do startup (~centenas de ms, uma vez por worker) é amortizado |
| 200.000 jobs leves | dezenas a centenas de milhares de jobs/s | uma ou duas ordens de grandeza menos | Cada job vira 2 escritas/leituras em pipe, 2 syscalls de cada lado, serialização em texto e context switches entre master e worker; o cálculo em si é desprezível |

**Com veneno:**

- Modo `threads`: quando o job do meio executa, `System.exit(3)` encerra a JVM inteira. O resumo final não é impresso; o código de saída do processo é 3. Todo o trabalho em andamento e o restante da fila são perdidos.
- Modo `processos`: o worker que recebeu o veneno morre com `exit=3`; o gerente detecta o fim do pipe (`readLine()` retorna `null`), recria o worker e reenfileira o job. Na segunda tentativa, outro worker morre, e o job é marcado como falho. Todos os outros jobs são concluídos e o resumo mostra `falhas=1`.

**Conclusão.** Processos compraram **contenção de falhas e supervisão** (o padrão de Nginx, PostgreSQL, Erlang/OTP e orquestradores como Kubernetes). O preço é memória (N JVMs, cada uma com heap, JIT e metaspace próprios), tempo de inicialização e custo por mensagem. Quando o trabalho por job é grande, esse preço quase desaparece; quando é pequeno, domina. Threads vencem em eficiência sempre, mas qualquer falha de nível de processo derruba tudo. Em produção, a solução usual é combinar: threads dentro do processo e várias instâncias do processo supervisionadas por uma camada externa.

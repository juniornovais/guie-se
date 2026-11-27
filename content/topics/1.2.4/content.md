## O problema: duas formas de fazer várias coisas ao mesmo tempo

Um servidor backend precisa atender muitas requisições simultâneas. Existem duas unidades que o sistema operacional oferece para isso: o **processo** (tópico 1.2.2) e a **thread** (tópico 1.2.3). Ambas são "coisas que o escalonador pode colocar para rodar numa CPU", mas diferem num ponto que define todo o resto: **o que é compartilhado**.

- Um **processo** é um contêiner de recursos: um espaço de endereçamento próprio, uma tabela de descritores de arquivos, credenciais, limites, handlers de sinais. Ele contém uma ou mais threads.
- Uma **thread** é um fluxo de execução dentro de um processo: tem seus próprios registradores, program counter e stack, mas **enxerga a mesma memória** e os mesmos recursos que as outras threads do mesmo processo.

Escolher entre "vários processos" e "várias threads em um processo" é escolher entre **isolamento** e **compartilhamento**. Isolamento compra segurança e contenção de falhas; compartilhamento compra comunicação barata e menor consumo de recursos. Não existe opção gratuita: cada sistema real que você vai estudar (Chrome, Nginx, PostgreSQL, a própria JVM) é uma resposta diferente para esse trade-off.

## Por dentro do kernel: o que é criado em cada caso

No Linux, o kernel não tem duas estruturas separadas para processo e thread. Tudo é uma **task** (`struct task_struct`), e o que diferencia "processo" de "thread" é **quais recursos a nova task compartilha com quem a criou**. As duas são criadas pela mesma chamada de sistema, `clone()`, com flags diferentes:

| Flag de `clone()` | O que compartilha |
|---|---|
| `CLONE_VM` | O espaço de endereçamento (mesmas tabelas de páginas) |
| `CLONE_FILES` | A tabela de descritores de arquivos |
| `CLONE_FS` | Diretório atual, raiz, umask |
| `CLONE_SIGHAND` | Os handlers de sinais |
| `CLONE_THREAD` | O mesmo grupo de threads (mesmo PID visto pelo usuário) |

- `pthread_create` (usado pela JVM para criar uma platform thread) chama `clone` **com** todas essas flags: a nova task só ganha uma stack nova, registradores próprios e uma área de *thread-local storage*.
- `fork()` chama `clone` **sem** elas: o filho recebe uma **cópia** do espaço de endereçamento, da tabela de descritores e dos handlers.

Copiar gigabytes de memória a cada `fork` seria inviável, então o kernel usa **copy-on-write (COW)**: as páginas físicas passam a ser compartilhadas por pai e filho, marcadas como somente leitura nas tabelas de páginas dos dois. Só quando um deles escreve numa página ocorre uma *page fault*, e o kernel então copia aquela página específica (o mecanismo de páginas é detalhado em 1.2.8). Mesmo com COW, o `fork` precisa **duplicar as tabelas de páginas** e as estruturas de mapeamento (VMAs), o que custa proporcionalmente ao tamanho do espaço de endereçamento mapeado.

Na maioria dos casos o filho chama logo em seguida `execve()`, que descarta o espaço de endereçamento copiado e carrega outro programa: o kernel lê o executável, mapeia suas seções, e o *dynamic linker* carrega as bibliotecas compartilhadas. É por isso que "criar um processo que executa outro programa" é bem mais caro do que um `fork` puro.

No Windows não existe `fork`. `CreateProcess` sempre cria um processo novo **e** carrega um executável, e `CreateThread` cria uma thread no processo atual. Criar processos no Windows é notoriamente mais caro do que no Linux, o que historicamente empurrou servidores Windows para modelos multi-thread.

Em Java, `new Thread(...).start()` cria uma **platform thread**, mapeada 1:1 para uma thread do SO. Já `ProcessBuilder.start()` cria um processo filho; no Linux, a JDK usa por padrão `posix_spawn` (que evita copiar as tabelas de páginas da JVM, potencialmente enormes) seguido de `exec`.

## Diagrama: O que é privado e o que é compartilhado

```text
 PROCESSO A (PID 100)                         PROCESSO B (PID 200)
┌──────────────────────────────────────┐    ┌───────────────────────────┐
│ Espaço de endereçamento próprio      │    │ Espaço de endereçamento   │
│  ┌────────┐ ┌────────┐ ┌──────────┐  │    │ próprio (outras tabelas   │
│  │ código │ │ heap   │ │ globais  │  │    │ de páginas)               │
│  └────────┘ └────────┘ └──────────┘  │    │                           │
│      ▲  compartilhado pelas threads  │    │  ┌─────────────────────┐  │
│  ┌───┴──────┐┌──────────┐┌──────────┐│    │  │ thread única        │  │
│  │thread T1 ││thread T2 ││thread T3 ││    │  │ regs, PC, stack     │  │
│  │regs, PC  ││regs, PC  ││regs, PC  ││    │  └─────────────────────┘  │
│  │stack T1  ││stack T2  ││stack T3  ││    │                           │
│  │TLS T1    ││TLS T2    ││TLS T3    ││    │ descritores: 0,1,2,5      │
│  └──────────┘└──────────┘└──────────┘│    └───────────────────────────┘
│ descritores: 0,1,2,7,8 (de todas)    │               ▲
│ credenciais, limites, sinais         │               │
└──────────────────────────────────────┘               │
            │       IPC: pipe, socket, memória compartilhada, arquivo
            └──────────────────────────────────────────┘

 Dentro de A: T1 escreve num objeto do heap → T2 enxerga (com sincronização).
 Entre A e B: nenhum endereço de A tem significado em B. Só IPC.
```

Repare que a stack de cada thread é privada **por convenção**, não por proteção de hardware: ela está no mesmo espaço de endereçamento, e um ponteiro errado em C pode corromper a stack de outra thread. Entre processos, ao contrário, o isolamento é garantido pela MMU (tópico 1.2.6): não existe endereço que B possa usar para tocar a memória de A.

## Isolamento e falhas: o raio de explosão

A consequência mais importante do compartilhamento é o **raio de explosão** de uma falha.

**Falha em um processo** derruba apenas aquele processo. Uma *segmentation fault*, um `abort()`, um `exit()`, um estouro de memória: o kernel encerra o processo, libera sua memória, fecha seus descritores, e os outros processos continuam rodando. O processo pai é notificado (`SIGCHLD`, `waitpid`) e pode criar um substituto. É assim que o master do Nginx ou o postmaster do PostgreSQL reagem à morte de um worker.

**Falha em uma thread** depende do tipo de falha:

- Uma **exceção Java não tratada** encerra apenas aquela thread. A JVM chama o `UncaughtExceptionHandler` (o padrão imprime o stack trace) e as demais threads seguem. Mas o **estado compartilhado** pode ter ficado inconsistente: um objeto modificado pela metade, um `ReentrantLock` que nunca foi liberado porque o `unlock()` não estava num `finally`.
- Uma falha no **nível do processo** derruba **todas** as threads: `System.exit()` chamado de qualquer thread, uma segfault em código nativo (JNI, um driver), um `OutOfMemoryError` que deixa a JVM sem condições de continuar, um `kill -9` no PID. Não existe "matar só a thread que causou o problema", porque o SO enxerga o processo como unidade de recursos.

Há também a dimensão de **segurança**: threads de um processo têm as mesmas credenciais e acesso a toda a memória. Se um componente processa entrada não confiável (um renderizador de HTML, um parser de imagens, um plugin de terceiros), colocá-lo num processo separado e com privilégios reduzidos (*sandbox*) impede que uma vulnerabilidade nele leia segredos do resto da aplicação. Isolamento por processo é uma fronteira de segurança; isolamento entre threads não é.

## Comunicação: memória compartilhada vs. IPC

Threads se comunicam **lendo e escrevendo os mesmos objetos**. Passar uma requisição de uma thread para outra é colocar uma referência numa fila: custa nanossegundos, não copia dados e não envolve o kernel no caminho feliz. O preço é a **sincronização**: sem locks, `volatile` ou estruturas concorrentes, você tem *race conditions* e problemas de visibilidade de memória. Esse é o tema de todo o módulo de concorrência, começando em 4.3.1, que revisita exatamente este tópico sob a ótica de race conditions e do Java Memory Model.

Processos precisam de **IPC** (*Inter-Process Communication*), porque não compartilham endereços:

| Mecanismo | Como funciona | Custo e características |
|---|---|---|
| Pipe / FIFO | Buffer no kernel; um escreve, outro lê | Cópia usuário → kernel → usuário; fluxo de bytes unidirecional |
| Unix domain socket | Socket local, sem pilha TCP/IP | Bidirecional; permite passar descritores entre processos |
| Socket TCP (loopback) | Pilha de rede completa | Mais caro que Unix socket, mas funciona entre máquinas |
| Memória compartilhada (`shm_open` + `mmap`) | Mesmas páginas físicas mapeadas em dois processos | Sem cópia; volta a exigir sincronização (semáforos, atômicos) |
| Arquivos | Um escreve, outro lê | Simples, persistente; lento e sujeito a corridas sem locks de arquivo |
| Sinais | Notificação assíncrona com um número | Não carrega dados; só "aconteceu algo" |
| Filas de mensagens (POSIX, ou externas como RabbitMQ) | Mensagens discretas | Desacoplamento; overhead de serialização |

Dois custos aparecem em quase todo IPC: a **cópia** dos dados pelo kernel e a **serialização** (transformar objetos em bytes e de volta). Uma `List<Pedido>` não pode ser "passada" para outro processo; ela precisa virar JSON, Protobuf ou outro formato. Memória compartilhada entre processos elimina a cópia, mas reintroduz exatamente o problema que o isolamento evitava: agora há memória compartilhada que precisa ser sincronizada, e um processo que corrompa essa região afeta os outros. O PostgreSQL faz isso com seu `shared_buffers`.

## Custos: criação, troca e memória

Os números abaixo são **ordens de grandeza ilustrativas** para Linux x86-64 moderno; variam bastante com hardware, kernel, mitigações de segurança e tamanho do processo. Servem para comparar, não para planejar capacidade.

| Critério | Thread (mesmo processo) | Processo |
|---|---|---|
| Criação | `pthread_create`: ~10–20 µs; `Thread.start()` na JVM: dezenas de µs (stack, estruturas da JVM) | `fork` de processo pequeno: ~100 µs a 1 ms; `fork` de processo com dezenas de GB mapeados: milissegundos a dezenas de ms; `fork`+`exec`: ~1 ms ou mais; iniciar uma JVM nova: centenas de ms |
| Memória por unidade | Stack (reservada ~1 MB, residente só o que é tocado) + estruturas do kernel e da JVM | Espaço de endereçamento inteiro; COW ajuda, mas cada processo tem suas tabelas de páginas, heap e caches próprios |
| Troca de contexto | Não troca o espaço de endereçamento; caches e TLB continuam úteis | Troca de tabelas de páginas (CR3); TLB e caches "esfriam" (detalhado em 1.2.5) |
| Comunicação | Memória compartilhada: ns, sem cópia | IPC: µs por mensagem, com cópia e serialização |
| Isolamento | Nenhum entre threads | Forte, garantido pelo hardware |
| Falha | Pode corromper estado de todos; falhas de processo derrubam todas | Contida no processo |
| Depuração | Bugs de concorrência, não determinísticos | Mais simples por processo; o sistema distribuído entre eles é mais complexo |

De onde vem a diferença de criação? A thread reaproveita tudo o que já existe: só aloca uma stack (um `mmap`), uma `task_struct` e registra a thread. O processo precisa de um espaço de endereçamento novo, cópia das tabelas de páginas e VMAs, nova tabela de descritores e, quase sempre, carregar um executável e suas bibliotecas. Se o programa for uma JVM, ainda há a inicialização do runtime, carregamento de classes e aquecimento do JIT.

Um exemplo real do custo do `fork` em processos grandes: o Redis faz `fork` para gerar snapshots (`BGSAVE`). Com dezenas de GB em memória, só copiar as tabelas de páginas pode congelar o processo principal por dezenas de milissegundos, e cada página escrita durante o snapshot é duplicada pelo COW, aumentando o consumo de memória.

## Exemplo: Medindo a criação de threads e de processos em Java

```java
import java.io.IOException;
import java.util.List;

public class CriacaoBench {
    public static void main(String[] args) throws Exception {
        int n = 1_000;

        // Threads: cria, inicia e espera terminar uma thread que não faz nada
        long t0 = System.nanoTime();
        for (int i = 0; i < n; i++) {
            Thread t = new Thread(() -> {});
            t.start();
            t.join();
        }
        long threadsNs = System.nanoTime() - t0;

        // Processos: executa um comando trivial do SO
        boolean windows = System.getProperty("os.name").toLowerCase().contains("win");
        List<String> cmd = windows ? List.of("cmd", "/c", "exit") : List.of("true");
        long p0 = System.nanoTime();
        for (int i = 0; i < n; i++) {
            Process p = new ProcessBuilder(cmd).start();
            p.waitFor();
        }
        long procNs = System.nanoTime() - p0;

        System.out.printf("threads:   %.1f µs por criação%n", threadsNs / 1e3 / n);
        System.out.printf("processos: %.1f µs por criação%n", procNs / 1e3 / n);
    }
}
```

Em Linux, é comum ver algo como dezenas de microssegundos por thread e um a alguns milissegundos por processo: duas ordens de grandeza. No Windows, a diferença costuma ser ainda maior, porque `CreateProcess` + inicialização do `cmd.exe` custa vários milissegundos. Note que o teste de processos mede `posix_spawn` + `exec` + carregamento do programa + término; um `fork` puro em C seria mais barato, mas raramente é o que um backend Java faz.

## Arquiteturas reais e suas justificativas

**Chrome (multi-processo).** O navegador separa o processo do browser (UI, rede, disco) dos processos de renderização, e com *Site Isolation* cada site tende a ganhar seu próprio processo de renderização, executando num sandbox com privilégios mínimos. Motivos: o renderizador executa JavaScript e decodifica conteúdo não confiável da internet; uma vulnerabilidade nele não deve dar acesso a cookies de outros sites (ataques como Spectre tornaram isso ainda mais importante, porque permitem ler memória do próprio processo). Além disso, uma aba que trava ou estoura memória não derruba as outras. O custo é memória: cada processo tem seu heap, seu V8, suas estruturas.

**Nginx (master + workers).** Um processo master lê a configuração e faz `fork` de um worker por núcleo. Cada worker é **single-threaded** e usa um event loop não bloqueante (`epoll`) para atender milhares de conexões. Processos aqui dão isolamento barato (um worker que morre é recriado), permitem recarregar configuração sem derrubar conexões e evitam locks, porque os workers quase não compartilham estado.

**PostgreSQL (um processo por conexão).** O postmaster faz `fork` de um *backend process* para cada conexão cliente. Os processos compartilham o cache de páginas do banco (`shared_buffers`) e estruturas de lock via memória compartilhada. O modelo nasceu numa época em que threads eram pouco portáveis e dá robustez (um backend com bug não corrompe a memória privada dos outros), mas custa caro com muitas conexões: cada backend consome memória própria e o `fork` por conexão é lento. Por isso aplicações Java usam **pool de conexões** (HikariCP) e, em escala, um pooler como PgBouncer. Esse custo é a origem de discussões recorrentes na comunidade sobre migrar o PostgreSQL para threads.

**Apache httpd e Gunicorn (pre-fork).** O modelo *prefork* cria um conjunto de processos **antes** das requisições chegarem, eliminando o custo de criação no caminho crítico. Gunicorn (Python) usa workers em processos em parte porque o GIL limita o paralelismo de threads no CPython.

**JVM (um processo, muitas threads).** Um servidor Spring Boot é um único processo com dezenas a centenas de threads: threads do Tomcat, do GC, do JIT, do pool de conexões. A escolha é natural para Java por três razões: a JVM tem custo de inicialização alto (centenas de ms e aquecimento do JIT), então criar um processo por requisição seria absurdo; o heap gerenciado por GC é mais eficiente quando compartilhado (um único GC, um único JIT, caches em memória acessíveis por todas as threads); e Java tem um modelo de memória e bibliotecas de concorrência maduros. O isolamento é obtido **fora** do processo: várias instâncias do serviço, containers, réplicas atrás de um balanceador.

## Como escolher em um cenário de backend

Prefira **threads** (ou virtual threads) quando:

- as tarefas precisam compartilhar muito estado ou caches em memória;
- o custo de criação e de comunicação importa (alto volume de tarefas curtas);
- o código é confiável e escrito por você;
- o runtime tem inicialização cara (JVM).

Prefira **processos** quando:

- há código não confiável ou de terceiros, ou entrada potencialmente maliciosa a processar (sandbox);
- você precisa que a falha de um componente não derrube os outros, especialmente código nativo instável;
- o runtime não paraleliza bem com threads (GIL do CPython);
- quer recarregar ou atualizar partes do sistema independentemente.

Em sistemas modernos, a decisão costuma ser **híbrida e em camadas**: threads dentro do processo para eficiência, vários processos (containers, pods) para isolamento e escala. A pergunta prática não é "processo ou thread?", e sim "qual é a unidade de falha e de segurança que eu preciso, e quanto estou disposto a pagar em memória e comunicação por ela?".

## [Adicional] Da comparação à concorrência e às virtual threads

A comparação não termina em "threads são mais leves". Platform threads ainda são relativamente caras: cada uma reserva uma stack de ~1 MB, ocupa estruturas no kernel e é escalonada pelo SO, com context switches de microssegundos (1.2.5). Por isso servidores tradicionais usam **thread pools** limitados, em vez de uma thread por requisição sem limite.

As **virtual threads** do Java 21 (tópico 4.4.11) deslocam o ponto de equilíbrio: são threads gerenciadas pela JVM, com stacks no heap que crescem sob demanda, montadas sobre poucas platform threads. Criar uma custa da ordem de um objeto, e milhões podem coexistir. Elas mantêm o modelo de **memória compartilhada** das threads, com todos os seus riscos, e não acrescentam isolamento nenhum. Ou seja, virtual threads tornam threads ainda mais baratas, mas não substituem processos onde o requisito é isolamento.

Ao entrar no módulo de concorrência (4.3.1), carregue esta ideia: tudo de difícil em programação concorrente em Java vem justamente da vantagem que fez você escolher threads em vez de processos, o **compartilhamento de memória**.

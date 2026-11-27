## O problema: mais threads do que CPUs

Uma máquina com 8 núcleos executa, em cada instante, no máximo 8 threads (16 com SMT/Hyper-Threading, que duplica o contexto de hardware mas não as unidades de execução). Um servidor Java típico, porém, tem centenas de threads vivas: workers do Tomcat, threads do GC, do JIT, do pool de conexões, timers. Para que todas progridam, o sistema operacional precisa **alternar** qual thread ocupa cada núcleo.

Essa alternância se chama **context switch** (troca de contexto): o kernel interrompe a thread que está rodando, salva tudo o que é necessário para retomá-la depois exatamente do mesmo ponto, escolhe outra thread e restaura o estado dela. Para cada thread, a ilusão é de que ela roda continuamente numa CPU exclusiva; na realidade, ela foi congelada e descongelada milhares de vezes.

A troca é indispensável, mas **não é gratuita**. Cada uma consome tempo de CPU que não executa código da aplicação, e ainda deixa os caches da CPU menos úteis. Entender esse custo é o que permite responder perguntas práticas como "quantas threads este pool deveria ter?" e "por que dobrar o pool piorou a latência?".

## O que é o contexto de uma thread

O **contexto** é o estado mínimo que permite retomar a execução como se nada tivesse acontecido:

- **Registradores de uso geral** (`rax`, `rbx`, … `r15` em x86-64), com os valores intermediários dos cálculos.
- **Program counter** (`rip`): a próxima instrução a executar.
- **Stack pointer** (`rsp`) e frame pointer: onde está o topo da stack da thread (tópico 1.1.7).
- **Registrador de flags** (`rflags`): resultados de comparações, estado de interrupções.
- **Estado de ponto flutuante e SIMD** (registradores x87/SSE/AVX, que somam centenas de bytes a alguns KB com AVX-512), salvo com instruções `XSAVE`/`XRSTOR`.
- **Base do thread-local storage** (registrador de segmento `fs` no Linux x86-64), que aponta para os dados locais da thread.
- **Stack de kernel** da thread e informações de escalonamento mantidas na `task_struct`.

Se a próxima thread pertence a **outro processo**, há mais um item: o **espaço de endereçamento**. O kernel precisa trocar as tabelas de páginas ativas, o que em x86-64 significa escrever o registrador **CR3** com o endereço da tabela de páginas raiz do novo processo (a tradução de endereços é assunto de 1.2.6 e 1.2.8).

Repare que o conteúdo da memória (heap, stack) **não** é copiado: ele continua onde está. O que se salva é só o estado da CPU, tipicamente da ordem de centenas de bytes a poucos KB.

## Quem dispara a troca: voluntária e involuntária

Um context switch acontece sempre dentro do kernel, mas a causa pode ser de dois tipos.

**Voluntária**: a própria thread não tem mais o que fazer e entrega a CPU.

- Bloqueia em I/O: `read()` num socket sem dados, consulta ao banco aguardando resposta (tópico 1.2.9).
- Espera um lock ou condição: `synchronized` contendido, `LockSupport.park()`, `Object.wait()`, `future.get()`.
- Dorme: `Thread.sleep()`.
- Cede explicitamente: `Thread.yield()` (no Linux, `sched_yield`; é só uma sugestão).

**Involuntária** (preempção): a thread queria continuar, mas o kernel a tira da CPU.

- O **time slice** (quantum) dela esgotou, detectado na interrupção periódica do timer.
- Uma thread de prioridade maior, ou que o escalonador considera mais merecedora, acordou (por exemplo, porque chegou o pacote de rede que ela esperava).

No Linux, os dois tipos são contados separadamente por thread e aparecem em `/proc/<pid>/status` como `voluntary_ctxt_switches` e `nonvoluntary_ctxt_switches`. Essa separação é um diagnóstico valioso: muitas trocas **voluntárias** indicam threads que bloqueiam muito (I/O, locks contendidos); muitas **involuntárias** indicam mais threads querendo CPU do que núcleos disponíveis.

## Diagrama: Linha do tempo de uma troca de contexto

```text
 núcleo 0                                                         tempo →
 ─────────────────────────────────────────────────────────────────────────
 Thread A (usuário) ████████████
                               │ interrupção do timer ou syscall bloqueante
 Kernel                        ▼
                       ┌────────────────────────────────────────────┐
                       │ 1. entra em modo kernel (salva rip/rsp de A)│
                       │ 2. escalonador escolhe a próxima: B         │
                       │ 3. salva registradores e FPU de A na        │
                       │    task_struct / stack de kernel de A       │
                       │ 4. se B é de outro processo: troca CR3      │
                       │    (tabelas de páginas; TLB afetada)        │
                       │ 5. restaura registradores de B, troca rsp   │
                       │ 6. retorna ao modo usuário em B             │
                       └────────────────────────────────────────────┘
 Thread B (usuário)                                     ░░░░██████████
                                                        ▲
                                     "aquecimento": cache misses e TLB misses
                                     enquanto B recarrega seu working set
```

Os passos 1 a 6 são o **custo direto**. A faixa clara no início de B é o **custo indireto**, que muitas vezes é maior e não aparece em nenhuma métrica de "tempo de troca".

## Escalonamento preemptivo, cooperativo e o time slice

Num **escalonamento cooperativo**, a tarefa em execução só perde a CPU quando cede voluntariamente. É simples e barato (não há interrupções no meio de operações), mas uma tarefa que entra em laço infinito ou faz um cálculo longo sem ceder **trava todas as outras**. O Windows 3.x e o Mac OS clássico funcionavam assim; hoje, o modelo sobrevive dentro de runtimes: event loops (Node.js, Netty), corrotinas e, em boa medida, as virtual threads do Java, que só desmontam da carrier thread em pontos de bloqueio.

Num **escalonamento preemptivo**, usado por todos os SOs modernos para threads do SO, o kernel interrompe a thread quando seu time slice termina. Isso garante que nenhuma thread monopolize a CPU e mantém o sistema responsivo, ao custo de trocas que ocorrem em momentos arbitrários (inclusive no meio de uma seção crítica, o que é uma das razões de precisarmos de sincronização).

O **time slice** é um compromisso:

- Curto demais: trocas frequentes, mais tempo gasto em overhead e caches sempre frios; ganho em responsividade.
- Longo demais: menos overhead e melhor throughput, mas threads interativas esperam mais.

Os escalonadores modernos não usam um quantum fixo. O CFS do Linux (substituído pelo EEVDF a partir do kernel 6.6) distribui uma "latência alvo" entre as threads executáveis, com uma granularidade mínima para não fatiar demais quando há muitas; na prática, as fatias ficam na faixa de **alguns milissegundos**. No Windows, o quantum também é da ordem de milissegundos e varia entre edições cliente e servidor. O ponto essencial: o time slice (ms) é **milhares de vezes maior** que o custo direto de uma troca (µs). Por isso, em CPU-bound puro, preempção por quantum raramente é o gargalo; o que degrada é a combinação de muitas trocas voluntárias, contenção e perda de cache.

## Custos diretos e indiretos

**Custo direto** é o tempo das instruções que efetuam a troca: entrar no kernel, executar o escalonador, salvar e restaurar registradores, trocar a stack de kernel, retornar. Medições clássicas (microbenchmarks de "ping-pong" entre duas threads, como os do lmbench) costumam encontrar **da ordem de 1 a 5 µs** por troca em hardware x86 moderno, variando com o kernel, com o estado de FPU, com virtualização e com as mitigações de Meltdown/Spectre (que tornaram entradas e saídas do kernel mais caras).

**Custo indireto** é o efeito colateral sobre o hardware:

- **Caches L1/L2** são pequenos (dezenas a centenas de KB por núcleo). A nova thread traz outro *working set* e expulsa os dados da anterior. Quando a thread original voltar, encontrará o cache "frio" e pagará *cache misses* (um acesso à RAM custa da ordem de 100 ns, contra ~1 ns no L1).
- **TLB** (*Translation Lookaside Buffer*), o cache de traduções de endereço virtual → físico, pode precisar ser invalidada ao trocar de processo (detalhes abaixo). Cada TLB miss obriga o hardware a percorrer a tabela de páginas.
- **Preditor de desvios** e prefetchers perdem o histórico útil da thread anterior.
- **Migração entre núcleos**: se o escalonador retoma a thread em outro núcleo, nem o L1/L2 dela está lá.

O custo indireto depende do tamanho do working set e pode facilmente chegar a dezenas de microssegundos de execução mais lenta após a troca. É por isso que um microbenchmark de troca "vazia" subestima o custo real em um servidor.

## Threads do mesmo processo vs. processos diferentes

Trocar entre duas threads **do mesmo processo** não troca o espaço de endereçamento: o CR3 permanece, a TLB continua válida e os dados compartilhados (heap, código da JVM) podem continuar no cache. É o caso comum num servidor Java.

Trocar entre **processos diferentes** exige carregar o CR3 do novo processo. Historicamente, escrever o CR3 em x86 **invalidava a TLB inteira** (exceto entradas globais do kernel), e o processo que entrava começava com zero traduções em cache. Processadores modernos têm **PCID** (*Process-Context Identifier*): cada entrada da TLB é etiquetada com o identificador do espaço de endereçamento, e o kernel pode trocar de processo sem apagar as entradas dos outros. Isso reduz bastante a penalidade, mas a capacidade da TLB continua sendo dividida entre processos, e os caches de dados não compartilham nada útil entre eles.

Resumo em ordem de custo crescente:

1. Troca entre virtual threads (na JVM, em modo usuário, sem kernel).
2. Troca entre platform threads do mesmo processo.
3. Troca entre processos (troca de CR3, TLB e caches menos aproveitados).
4. Qualquer troca que também migre a thread para outro núcleo ou outro socket NUMA.

## Exemplo: Medindo context switches de uma JVM

No Linux (ou WSL2/Docker no Windows), três ferramentas cobrem quase todos os diagnósticos:

```bash
# Sistema inteiro, a cada 1 segundo: coluna "cs" = trocas por segundo, "r" = threads executáveis
vmstat 1

# Por processo e por thread: cswch/s (voluntárias) e nvcswch/s (involuntárias)
pidstat -w -t -p <pid> 1          # pacote sysstat

# Contadores acumulados desde o início do processo
grep ctxt /proc/<pid>/status
# voluntary_ctxt_switches:     1834
# nonvoluntary_ctxt_switches:  97

# Contagem precisa durante a execução de um comando
perf stat -e context-switches,cpu-migrations java MeuPrograma
```

No Windows nativo, use `typeperf "\System\Context Switches/sec"` no terminal, o Monitor de Desempenho (contador *Thread → Context Switches/sec* por thread) ou o Process Explorer.

A própria aplicação Java pode ler os contadores no Linux:

```java
import java.nio.file.*;

public class MeusSwitches {
    public static void main(String[] args) throws Exception {
        Files.readAllLines(Path.of("/proc/self/status")).stream()
             .filter(l -> l.contains("ctxt_switches"))
             .forEach(System.out::println);
    }
}
```

Atenção: `/proc/self/status` soma os contadores **de todas as threads** do processo. Para uma thread específica, leia `/proc/<pid>/task/<tid>/status`. Um valor de `cs` no `vmstat` de dezenas de milhares por segundo é normal num servidor ocupado; centenas de milhares por segundo, acompanhados de alto tempo de sistema (`sy`), sugerem contenção ou excesso de threads.

## Por que milhares de platform threads bloqueantes degradam

O modelo clássico "uma thread por requisição" com I/O bloqueante funciona bem até algumas centenas de threads. Quando se tenta escalar para milhares, vários custos crescem juntos:

- **Trocas voluntárias em massa.** Cada requisição bloqueia várias vezes (banco, HTTP externo, cache), e cada bloqueio e cada despertar são context switches no kernel. Com 2.000 threads, isso pode significar centenas de milhares de trocas por segundo.
- **Fila de execução longa.** Quando muitas respostas chegam juntas, centenas de threads ficam executáveis ao mesmo tempo para poucos núcleos. Cada uma espera sua vez, e a **latência de cauda** (p99) cresce, mesmo que o throughput médio se mantenha.
- **Caches e TLB poluídos.** Cada thread tem sua stack e seus objetos; trocar entre centenas delas impede qualquer working set de permanecer no cache.
- **Contenção.** Mais threads disputando os mesmos locks (pool de conexões, caches sincronizados, logging) significam mais bloqueios, e cada bloqueio é mais um context switch.
- **Memória e GC.** Cada thread reserva uma stack (~1 MB de espaço virtual, parte dela residente), e o GC precisa varrer as stacks de todas as threads como raízes em cada pausa.

Por isso o dimensionamento de thread pools segue regras baseadas nos núcleos:

- **CPU-bound**: cerca de `N` threads (número de núcleos), às vezes `N + 1`. Mais do que isso só adiciona trocas.
- **I/O-bound**: `N × (1 + tempo de espera / tempo de CPU)`, a fórmula popularizada em *Java Concurrency in Practice*. Uma tarefa que espera 90 ms e computa 10 ms justifica cerca de `10 × N` threads.

E o limite real quase nunca é só a CPU: se o pool de conexões com o banco tem 20 conexões, 2.000 threads de requisição apenas formam uma fila maior na frente dele.

## Como virtual threads mudam a equação

As **virtual threads** do Java 21 (tópico 4.4.11) atacam exatamente o custo de bloquear. Uma virtual thread roda **montada** sobre uma *carrier thread* (uma platform thread de um `ForkJoinPool` com, por padrão, tantas threads quanto núcleos). Quando ela bloqueia num ponto que a JDK conhece (I/O de socket, `LockSupport.park`, `Thread.sleep`, `BlockingQueue`), a JVM:

1. copia os frames da stack da virtual thread para um objeto no heap (a *continuation*);
2. **desmonta** a virtual thread, liberando a carrier para executar outra;
3. registra o interesse no evento (por exemplo, o socket no `epoll`);
4. quando o evento ocorre, agenda a virtual thread de volta, que é **montada** em alguma carrier, copiando de volta os frames necessários.

Essa "troca" acontece **em modo usuário**, sem passar pelo escalonador do kernel, e custa da ordem de centenas de nanossegundos a poucos microssegundos, dependendo da profundidade da stack. As carrier threads quase nunca bloqueiam, então o número de context switches do SO cai drasticamente, e milhões de tarefas concorrentes passam a caber em poucas threads do SO.

Limitações importantes:

- Virtual threads **não aceleram CPU-bound**: o número de núcleos é o mesmo; elas tornam barata a espera, não o cálculo.
- **Pinning**: se a virtual thread bloqueia dentro de código nativo, ou dentro de `synchronized` até o Java 23, ela não pode desmontar e prende a carrier. O Java 24 (JEP 491) removeu o pinning de `synchronized`.
- Recursos externos continuam limitados: um milhão de virtual threads não cria conexões de banco a mais. Use semáforos ou pools para proteger dependências.

## [Adicional] Afinidade de CPU, NUMA e isolamento de núcleos

Em sistemas sensíveis a latência (trading, bancos de dados, proxies de alto desempenho), além de reduzir o número de trocas, busca-se reduzir **migrações**. Técnicas comuns:

- **Afinidade de CPU** (`taskset`, `sched_setaffinity`): prender uma thread a um núcleo para que seu cache permaneça quente.
- **Isolamento de núcleos** (`isolcpus`, `nohz_full`): retirar núcleos do escalonamento geral e dedicá-los a threads específicas, eliminando quase toda preempção.
- **NUMA**: em servidores com vários sockets, a memória é "local" a um socket; migrar uma thread para outro socket torna seus acessos à memória mais lentos. `numactl` e as opções `-XX:+UseNUMA` da JVM ajudam a manter threads perto de seus dados.
- **Busy-waiting** em vez de bloqueio: alguns sistemas preferem gastar CPU girando a pagar o custo de dormir e acordar (dois context switches e cache frio). É uma troca consciente de eficiência por latência, e não faz sentido em servidores comuns.

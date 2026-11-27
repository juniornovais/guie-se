## O problema: vários programas, uma única memória física

Imagine um computador em que todo programa usa **endereços físicos** diretamente: o endereço `0x4000` em qualquer programa é o byte `0x4000` dos pentes de RAM. Isso cria problemas imediatos:

- **Conflito**: dois programas compilados para usar o endereço `0x4000` não podem rodar ao mesmo tempo, ou um sobrescreve os dados do outro.
- **Falta de proteção**: um ponteiro errado em qualquer programa pode corromper outro programa ou o próprio sistema operacional.
- **Fragmentação**: um programa que precisa de 2 GB contíguos não cabe se a RAM livre estiver espalhada em pedaços.
- **Limite rígido**: um programa nunca pode usar mais memória do que existe fisicamente, mesmo que a maior parte dela fique ociosa a maior parte do tempo.

A **memória virtual** resolve todos esses problemas com uma camada de indireção: cada processo enxerga um **espaço de endereços virtual** próprio, contínuo e privado, e o hardware traduz cada endereço virtual para um endereço físico em tempo de execução. A estrutura desse espaço (onde ficam código, heap, stacks) é o tópico 1.2.7; o mecanismo de páginas e tabelas que implementa a tradução é o tópico 1.2.8. Aqui o foco é o **porquê**, o funcionamento geral e as consequências práticas para quem opera uma JVM.

## Tradução de endereços: MMU, tabelas de páginas e TLB

Toda instrução que lê ou escreve memória usa um **endereço virtual**. Quem converte esse endereço é a **MMU** (*Memory Management Unit*), um componente de hardware dentro da CPU, e não o sistema operacional. Se o SO tivesse de intervir em cada acesso, tudo seria milhares de vezes mais lento.

A divisão de trabalho é:

- O **SO** decide o mapeamento: ele mantém, para cada processo, **tabelas de páginas** em memória que dizem "a página virtual X deste processo corresponde ao frame físico Y, com permissões R/W/X". Ao trocar de processo, o SO aponta a MMU para as tabelas do novo processo (registrador CR3 em x86-64, como visto em 1.2.5).
- A **MMU** aplica o mapeamento: a cada acesso, ela divide o endereço em número de página e deslocamento, consulta as tabelas e forma o endereço físico. Também verifica as permissões.
- A **TLB** (*Translation Lookaside Buffer*) é um cache pequeno e muito rápido de traduções recentes. Sem ela, cada acesso à memória exigiria vários acessos extras para percorrer as tabelas de páginas (em x86-64 são 4 ou 5 níveis). Com ela, a grande maioria das traduções sai em um ciclo ou pouco mais.

Quando a MMU não encontra uma tradução válida, ou o acesso viola as permissões, ela dispara uma exceção de hardware chamada **page fault**, e o controle passa ao kernel. O kernel então decide: se a página é legítima mas ainda não está na RAM, ele a traz e retoma a instrução; se o acesso é ilegal, envia `SIGSEGV` ao processo (a famosa *segmentation fault*). Os detalhes de tamanho de página, formato das tabelas e tipos de fault ficam com 1.2.8.

## Diagrama: Mesmo endereço virtual, frames físicos diferentes

```text
  Processo A (JVM)                RAM física                Processo B (PostgreSQL)
  espaço virtual                  (frames)                  espaço virtual
 ┌───────────────────┐          ┌───────────┐              ┌───────────────────┐
 │ 0x7f00_0000_1000  │──┐       │ frame 12  │◀────────┐    │ 0x7f00_0000_1000  │
 │   (heap de A)     │  │       ├───────────┤         └────│   (dados de B)    │
 ├───────────────────┤  └──────▶│ frame 37  │              ├───────────────────┤
 │ 0x0040_0000       │──┐       ├───────────┤         ┌────│ 0x0040_0000       │
 │   libc.so (r-x)   │  └──────▶│ frame 90  │◀────────┘    │   libc.so (r-x)   │
 ├───────────────────┤          │ (libc,    │  mesma página├───────────────────┤
 │ 0x7f00_0000_2000  │── ✗      │ comparti- │  física,     │ 0x7f00_0000_2000  │── swap
 │   (reservado,     │ sem      │ lhada)    │  só leitura  │   (em disco)      │
 │   nunca tocado)   │ frame    └───────────┘              └───────────────────┘
 └───────────────────┘
   tabelas de páginas de A        CR3 aponta para          tabelas de páginas de B
                                  as de quem está rodando
```

O mesmo endereço virtual `0x7f00_0000_1000` existe nos dois processos, mas cada tabela de páginas o leva para um frame diferente (37 e 12). A biblioteca `libc` aparece mapeada nos dois, mas aponta para o **mesmo** frame físico, somente leitura: uma única cópia na RAM atende todos os processos. Uma página reservada e nunca tocada não ocupa frame algum. E uma página de B pode estar temporariamente em disco (swap).

## Por que a memória virtual existe

**Isolamento e proteção.** Um processo só consegue acessar o que está mapeado nas suas tabelas de páginas, e ele não pode alterá-las (só o kernel pode). Não existe endereço virtual em A que leve à memória privada de B. As entradas também carregam bits de permissão: código é marcado como leitura e execução, sem escrita; dados como leitura e escrita, sem execução (bit NX), o que dificulta ataques de injeção de código; e páginas do kernel são marcadas como acessíveis só em modo supervisor.

**Abstração.** Cada programa é compilado e ligado como se tivesse um espaço enorme e contínuo só para ele (até 128 TB de espaço de usuário em x86-64 com 4 níveis). Onde cada página cai fisicamente é problema do SO. Isso elimina a fragmentação externa da memória física: um array de 1 GB contíguo no espaço virtual pode estar espalhado em 262.144 frames de 4 KB não contíguos.

**Alocação preguiçosa e overcommit.** Reservar memória virtual é só criar uma descrição ("de tal endereço a tal endereço, leitura e escrita, anônima"); nenhum frame é alocado. O frame só é entregue no **primeiro toque** (demand paging). Isso permite que a soma da memória que os processos *reservaram* seja muito maior do que a RAM, o que se chama **overcommit**.

**Memória maior que a física.** Páginas pouco usadas podem ser movidas para o disco (**swap**) e trazidas de volta sob demanda, de forma transparente para o processo.

**Compartilhamento de páginas.** Bibliotecas compartilhadas, o código de executáveis em vários processos, o copy-on-write do `fork` (1.2.4) e arquivos mapeados por vários processos usam os mesmos frames físicos em espaços virtuais diferentes. Em Java, o *Class Data Sharing* (CDS) usa esse mecanismo para que várias JVMs compartilhem os metadados das classes da JDK.

## Demand paging, overcommit e o OOM killer

Quando um programa chama `malloc` de 1 GB (ou a JVM reserva o heap), o kernel Linux cria uma área virtual (VMA) e retorna imediatamente. As páginas só ganham frames quando são tocadas pela primeira vez; cada primeiro toque é um *page fault* tratado pelo kernel, que aloca um frame zerado e atualiza a tabela de páginas.

O Linux controla quanto pode ser prometido via `vm.overcommit_memory`:

| Valor | Política |
|---|---|
| `0` (padrão) | Heurística: recusa só reservas obviamente impossíveis (maiores que RAM + swap); aceita o resto |
| `1` | Sempre aceita, qualquer tamanho |
| `2` | Estrito: a soma do que foi prometido não pode passar de `CommitLimit` (swap + uma fração da RAM, `vm.overcommit_ratio`) |

O Windows não faz overcommit desse jeito: separa **reservar** espaço de endereços (`MEM_RESERVE`, que não custa memória) de **confirmar** (`MEM_COMMIT`), e cada byte confirmado precisa caber em RAM + arquivo de paginação, o que se vê como "Commit charge" no Gerenciador de Tarefas.

O overcommit tem uma consequência séria: se os processos **tocarem** mais páginas do que existe de RAM + swap, a promessa não pode ser cumprida. Como a falta só é descoberta no momento de um page fault, não há `malloc` para retornar `NULL`. O Linux então aciona o **OOM killer**: escolhe um processo (pela pontuação `oom_score`, que favorece matar quem usa mais memória, ajustável com `oom_score_adj`) e o mata com `SIGKILL`. Em containers, o mesmo acontece quando o **cgroup** ultrapassa seu limite de memória: o Kubernetes reporta o pod como `OOMKilled` e o código de saída é 137 (128 + 9, o número do SIGKILL). Repare que isso é diferente de `java.lang.OutOfMemoryError`: este é lançado pela JVM quando o **heap** dela não tem espaço; o OOM killer é o kernel matando o processo inteiro, sem stack trace e sem chance de reação.

## Swap e por que ele destrói a latência

Quando a RAM aperta, o kernel escolhe páginas pouco usadas e as grava na área de swap, liberando os frames. Páginas de arquivos (código, page cache) podem simplesmente ser descartadas e relidas do arquivo original; páginas anônimas (heap, stacks) não têm outro lugar senão o swap.

A diferença de velocidade é brutal, em ordem de grandeza:

| Onde está a página | Tempo de acesso aproximado |
|---|---|
| Cache L1 | ~1 ns |
| RAM | ~100 ns |
| SSD NVMe | ~10–100 µs |
| Disco rígido | ~5–10 ms |

Um acesso a uma página em swap num SSD é **centenas a milhares de vezes** mais lento que na RAM, e durante esse tempo a thread fica bloqueada no page fault (um *major fault*). Para um serviço com requisito de latência, isso é devastador, e para a JVM é pior ainda: o garbage collector percorre grande parte do heap a cada ciclo, e se partes do heap estão em swap, cada coleta provoca uma tempestade de page faults. Pausas de GC de milissegundos viram segundos. Quando o sistema passa a maior parte do tempo trocando páginas entre RAM e disco, ocorre **thrashing**: a máquina parece travada.

Por isso, em servidores de aplicação e bancos de dados, a recomendação usual é **desabilitar o swap ou limitá-lo fortemente** (`vm.swappiness` baixo), dimensionar a memória corretamente e preferir que o processo morra (e seja reiniciado pelo orquestrador) a que fique lento indefinidamente. O Kubernetes por muito tempo exigiu swap desabilitado nos nós; Elasticsearch e outros recomendam travar a memória do processo em RAM (`mlockall`, `bootstrap.memory_lock`).

## VSZ, RSS e como ler a memória de um processo

Duas métricas aparecem em `ps`, `top` e ferramentas de monitoramento:

- **VSZ** (*virtual size*, `VmSize` em `/proc/<pid>/status`): o tamanho total do espaço virtual **mapeado** pelo processo, tocado ou não. Inclui heap reservado, bibliotecas, arquivos mapeados, stacks de threads.
- **RSS** (*resident set size*, `VmRSS`): quanto do espaço virtual está **de fato em frames físicos** agora. É o que mais se aproxima do "consumo de RAM".

Cuidados ao interpretar:

- RSS conta páginas **compartilhadas** em cada processo que as usa. Somar o RSS de 10 processos que usam a mesma `libc` conta a `libc` 10 vezes. O **PSS** (*proportional set size*, em `/proc/<pid>/smaps_rollup`) divide as páginas compartilhadas entre os processos.
- Páginas em swap não entram no RSS (aparecem em `VmSwap`).
- Em containers, o limite de memória do cgroup se aplica ao que é efetivamente cobrado (RSS anônimo + page cache do cgroup), **não** ao VSZ.

```bash
ps -o pid,vsz,rss,comm -p <pid>          # VSZ e RSS em KB
grep -E 'VmSize|VmRSS|VmSwap' /proc/<pid>/status
pmap -x <pid> | sort -k3 -n | tail        # maiores mapeamentos por RSS
```

No Windows, o Gerenciador de Tarefas mostra "Conjunto de trabalho" (equivalente ao RSS) e "Tamanho de confirmação" (memória confirmada); `Get-Process -Id <pid> | Select-Object WS,PM,VM` dá os mesmos números no PowerShell.

## Exemplo: Por que a VSZ de uma JVM é tão grande

Uma JVM recém-iniciada de um serviço pequeno pode mostrar VSZ de 10 GB e RSS de 300 MB. Nada está errado. A JVM **reserva** grandes regiões virtuais na inicialização e só **toca** (e portanto consome RAM) o que precisa:

| Região | Reservado (VSZ) | Residente (RSS) típico |
|---|---|---|
| Heap Java | `-Xmx` inteiro | O que foi tocado pelas alocações e pelo GC |
| Compressed class space | ~1 GB por padrão | Alguns MB a dezenas de MB |
| Code cache (JIT) | ~240 MB | Dezenas de MB |
| Stacks das threads | ~1 MB por thread | Só as páginas usadas de cada stack |
| Arenas do `malloc` da glibc | Até 64 MB por arena, várias arenas | O que foi usado |
| Bibliotecas e `modules` da JDK | Dezenas a centenas de MB | Parte compartilhada entre JVMs |

O modelo de memória do heap segue três estados:

1. **Reservado**: no início, a JVM reserva espaço virtual contíguo de tamanho `-Xmx` (no Linux, um `mmap` com `PROT_NONE` e `MAP_NORESERVE`). Garante endereços, não consome RAM nem entra no commit.
2. **Comprometido** (*committed*): a parte que a JVM declarou que vai usar, começando em `-Xms`, que cresce conforme o GC expande o heap. No Linux, é tornar a região acessível (`mmap`/`mprotect` com leitura e escrita); conta para o limite de overcommit, mas ainda não ocupa frames.
3. **Residente**: páginas comprometidas que foram efetivamente tocadas. Só aqui há RAM consumida.

Você pode ver isso com o *Native Memory Tracking*:

```bash
java -XX:NativeMemoryTracking=summary -Xms256m -Xmx4g -jar app.jar
jcmd <pid> VM.native_memory summary
# (valores ilustrativos, resumidos)
# Java Heap (reserved=4194304KB, committed=262144KB)
# Class     (reserved=1048576KB, committed=8192KB)
# Thread    (reserved=41984KB,   committed=2304KB)
# Code      (reserved=247808KB,  committed=12288KB)
```

Repare que "committed" ainda não é "residente": o NMT mostra o que a JVM comprometeu, e o RSS só cresce com o toque nas páginas.

Consequências práticas:

- **`-Xms` igual a `-Xmx`** evita que o heap cresça e encolha (redimensionamentos custam pausas e syscalls) e torna o consumo previsível. Mesmo assim, sem toque, o RSS cresce aos poucos.
- **`-XX:+AlwaysPreTouch`** faz a JVM tocar todas as páginas do heap na inicialização. A inicialização fica mais lenta (segundos para heaps grandes), mas os page faults de primeiro toque saem do caminho das requisições, e se não houver memória física suficiente o problema aparece no deploy, não às 3 da manhã.
- Alguns coletores (G1 com `G1PeriodicGCInterval`, ZGC, Shenandoah) podem **devolver** memória ao SO (*uncommit*) quando o heap fica ocioso, reduzindo o RSS.

## A JVM em containers

Em um container, o limite que importa é o do **cgroup**, e o kernel mata o processo (OOM killer do cgroup) quando a memória cobrada passa dele. A JVM precisa saber disso:

- Desde o JDK 10 (e 8u191), a opção `-XX:+UseContainerSupport` vem ativada: a JVM lê o limite do cgroup e o usa como "RAM da máquina" para calcular os padrões. Antes disso, uma JVM num container de 1 GB num host de 64 GB escolhia um heap máximo de 16 GB e era morta pelo kernel.
- Prefira dimensionar o heap como fração do limite: `-XX:MaxRAMPercentage=75` (o padrão é 25%, conservador).
- **O heap não é toda a memória.** O RSS de uma JVM é heap + metaspace + code cache + stacks de threads + buffers diretos (`ByteBuffer.allocateDirect`, Netty) + estruturas do GC + memória nativa de bibliotecas. Um container de 1 GB com `-Xmx1g` **vai** ser morto. Deixe margem de 25% a 40% para memória fora do heap e meça com NMT.
- Se o pod reinicia com `OOMKilled` e código 137, e não há `OutOfMemoryError` nos logs, foi o kernel, não o heap: o problema está na soma das regiões, não só no `-Xmx`.

## Memory-mapped files

O `mmap` também pode mapear um **arquivo** no espaço virtual: a região de endereços passa a corresponder ao conteúdo do arquivo. Ler um byte do endereço é ler o byte do arquivo; se a página ainda não está na memória, ocorre um page fault e o kernel a carrega do disco para o **page cache**, mapeando o mesmo frame no processo. Escritas num mapeamento compartilhado (`MAP_SHARED`) marcam a página como suja, e o kernel a grava no arquivo depois (ou quando se chama `msync`/`force()`).

Vantagens:

- **Sem cópia extra**: com `read()`, os dados vão do page cache para um buffer do processo; com `mmap`, o processo acessa diretamente o frame do page cache.
- **Sem syscalls por acesso**: depois de mapeado, ler é acessar memória.
- **Acesso aleatório natural**: basta calcular o deslocamento.
- **Compartilhamento**: vários processos que mapeiam o mesmo arquivo usam os mesmos frames.

Custos e limitações:

- Cada primeiro acesso a uma página é um page fault (caro em comparação com uma leitura sequencial em buffer grande, que se beneficia de *readahead* agressivo).
- Erros de I/O viram sinais (`SIGBUS`) em vez de códigos de erro, e um arquivo truncado por outro processo pode derrubar o seu.
- Em Java, `FileChannel.map` devolve um `MappedByteBuffer` limitado a 2 GB (índice `int`), e o mapeamento só é desfeito quando o buffer é coletado pelo GC. A API de memória externa (`MemorySegment`, finalizada no Java 22) remove o limite e permite fechar o mapeamento de forma determinística.

Uso em sistemas reais: o Lucene (base do Elasticsearch e OpenSearch) usa `MMapDirectory` para ler índices, contando com o page cache do SO; LMDB e o antigo motor MMAPv1 do MongoDB eram construídos sobre `mmap`; o Kafka usa mapeamento para seus arquivos de índice e conta fortemente com o page cache para os dados. Esses sistemas recomendam deixar uma boa parte da RAM **fora** do heap da JVM justamente para o page cache.

## [Adicional] Huge pages e o custo da TLB para heaps grandes

Uma TLB típica tem da ordem de mil a poucos milhares de entradas. Com páginas de 4 KB, isso cobre poucos MB de memória. Um heap de 32 GB percorrido pelo GC gera muitos TLB misses, cada um custando um *page walk*. **Huge pages** (2 MB em x86-64) fazem cada entrada da TLB cobrir 512 vezes mais memória.

Na JVM, `-XX:+UseLargePages` usa huge pages explicitamente reservadas pelo SO, e `-XX:+UseTransparentHugePages` pede ao kernel que use *Transparent Huge Pages* (THP) quando possível. Os ganhos em heaps grandes podem ser de alguns a dezenas de por cento, mas há riscos: THP em modo `always` pode causar picos de latência quando o kernel compacta memória para formar páginas grandes, e por isso bancos como Redis e MongoDB recomendam desativá-lo. Como sempre, meça antes de adotar.

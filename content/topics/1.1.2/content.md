## O problema que a RAM resolve

A CPU (tópico 1.1.1) só sabe operar sobre registradores, e eles são poucos: algumas dezenas de valores de 64 bits. Um programa real precisa de muito mais espaço de trabalho enquanto executa: o próprio código, as variáveis, os objetos de uma requisição HTTP, um cache de sessões, o heap inteiro da JVM. Esse espaço de trabalho é a **memória principal**, implementada com **RAM** (*Random Access Memory*).

"Acesso aleatório" significa que qualquer posição pode ser lida diretamente a partir do seu endereço, sem percorrer as anteriores, ao contrário de uma fita magnética. Na prática, como veremos, "aleatório" não quer dizer "custo uniforme": a ordem dos acessos importa muito.

A RAM ocupa um ponto intermediário entre dois extremos:

- é **muito maior** que os caches da CPU (gigabytes contra megabytes), mas **muito mais lenta**;
- é **muito mais rápida** que SSDs e discos, mas **volátil e mais cara por gigabyte**.

Quase toda decisão de arquitetura de um backend (o que guardar em memória, quando serializar, quanto heap dar à JVM, quando usar um cache distribuído) é uma negociação com essas duas propriedades.

## A RAM como uma sequência de bytes endereçáveis

Do ponto de vista do software, a memória é um **array gigante de bytes**, e cada byte tem um **endereço** numérico (tópico 1.1.6). Com endereços de 64 bits, o espaço teórico é de 2⁶⁴ bytes; na prática, CPUs x86-64 atuais usam 48 ou 57 bits de endereço virtual e um número menor de bits físicos.

Algumas consequências desse modelo:

- **Valores maiores que um byte ocupam bytes consecutivos.** Um `int` ocupa 4 bytes; um `long`, 8. O endereço do valor é o endereço do seu primeiro byte.
- **A ordem dos bytes importa (endianness).** x86-64 e ARM64 (no modo usado por Linux, macOS e Windows) são **little-endian**: o byte menos significativo fica no menor endereço. O `int` `0x12345678` aparece na memória como `78 56 34 12`. Protocolos de rede usam *big-endian* ("network byte order"), por isso `java.nio.ByteBuffer` tem `order(ByteOrder)` e o formato `.class` da JVM é big-endian.
- **Os endereços que um programa vê não são físicos.** O sistema operacional e a MMU da CPU traduzem endereços **virtuais** em físicos, página por página (tópicos 1.2.6 e 1.2.8). Dois processos podem usar o mesmo endereço virtual apontando para lugares físicos diferentes. Para este tópico, basta saber que, no fim da tradução, existe um endereço físico numa memória DRAM.

## Volátil versus persistente

A RAM de um computador é **volátil**: o conteúdo some quando a energia é cortada. Isso não é um defeito de projeto, é consequência direta da tecnologia.

Uma célula de **DRAM** (*Dynamic RAM*) guarda um bit como **carga elétrica num capacitor minúsculo**, controlado por um único transistor (célula 1T1C). O capacitor vaza carga continuamente: em poucas dezenas de milissegundos o bit se perderia. Por isso o controlador de memória faz **refresh**: relê e regrava cada linha periodicamente (o padrão DDR exige que todas as linhas sejam renovadas a cada 64 ms em temperatura normal). Sem energia, não há refresh, e os dados desaparecem.

Armazenamento **persistente** (SSD, HDD) usa mecanismos que mantêm o estado sem energia: elétrons presos numa porta flutuante (flash NAND) ou domínios magnéticos (disco). Em troca, é ordens de grandeza mais lento e, no caso da flash, tem escrita em blocos e desgaste.

Implicações para backend:

- **Tudo que está só na memória está em risco.** Um processo que cai (ou um container que é reiniciado) perde o heap inteiro. Sessões, filas e caches em memória precisam ser reconstruíveis ou replicados.
- **Durabilidade exige escrita em meio persistente.** Bancos de dados mantêm páginas em memória (buffer pool) para velocidade, mas só confirmam uma transação depois de gravar o log (WAL) em disco com `fsync`. Redis, que é em memória, oferece snapshots (RDB) e log de operações (AOF) justamente por isso.
- **"Escrevi no arquivo" não significa "está no disco".** Uma chamada `write` normalmente só copia os dados para o *page cache* do SO, que também está em RAM. Só `fsync` (ou `FileChannel.force` em Java) exige que o dado chegue ao dispositivo.

## DRAM versus SRAM

Existem duas tecnologias principais de RAM, e a hierarquia de memória nasce da diferença entre elas:

| Característica | SRAM (cache da CPU) | DRAM (memória principal) |
|---|---|---|
| Célula | ~6 transistores formando um *flip-flop* | 1 transistor + 1 capacitor |
| Refresh | não precisa | precisa (o capacitor vaza) |
| Latência | ~1-20 ns (L1 a L3) | ~60-120 ns do ponto de vista do núcleo |
| Densidade / custo | baixa densidade, cara por bit | alta densidade, barata por bit |
| Onde fica | dentro do chip da CPU | módulos (DIMMs) na placa, ou no mesmo encapsulamento (Apple M-series, HBM) |

A SRAM é rápida porque o bit é mantido ativamente por transistores e pode ser lido imediatamente. A DRAM é densa porque cada bit é só um capacitor e um transistor, mas ler é um processo mais lento e destrutivo, como mostra a subseção a seguir.

### Como um acesso à DRAM acontece

Internamente, um chip DRAM é organizado em **bancos**, e cada banco é uma matriz de **linhas** (*rows*) e **colunas**. Ler um dado envolve:

1. **Ativar a linha (ACT).** O controlador envia o endereço da linha; a linha inteira (alguns KB) é copiada para o **row buffer** do banco, pois ler o capacitor descarrega a célula. O tempo até a linha estar pronta é o **tRCD**.
2. **Ler a coluna (READ).** O controlador envia o endereço da coluna; após a **latência CAS (CL)**, os dados começam a sair pelo barramento em rajada (*burst*). Uma rajada entrega 64 bytes, ou seja, uma linha de cache (no DDR4, 8 transferências num canal de 64 bits; no DDR5, 16 transferências num subcanal de 32 bits).
3. **Fechar a linha (PRE).** Antes de abrir outra linha no mesmo banco, a atual precisa ser regravada e o banco pré-carregado (**tRP**).

Se o próximo acesso cai na **mesma linha já aberta** (um *row hit*), só o passo 2 é necessário. Se cai em outra linha do mesmo banco (*row conflict*), são necessários os três passos. Por isso acessos sequenciais são muito mais baratos do que acessos espalhados, mesmo dentro da DRAM.

Os números de um módulo como "DDR4-3200 CL16" significam: 3200 milhões de transferências por segundo e latência CAS de 16 ciclos do clock de memória (1600 MHz), ou seja, 16 ÷ 1,6 GHz = 10 ns. Mas a latência total que um núcleo observa num miss de cache é bem maior (tipicamente 60 a 120 ns), porque soma a busca nos caches, a viagem até o controlador de memória, a fila do controlador, a ativação da linha e o retorno.

## Diagrama: Caminho de um acesso da CPU até a DRAM

```text
  ┌───────────── chip da CPU ───────────────────────────────┐
  │                                                          │
  │  núcleo ──▶ L1d ──▶ L2 ──▶ L3 (compartilhado)            │
  │   (load     miss    miss    miss                         │
  │   de 8 B)                    │                           │
  │                              ▼                           │
  │                  controlador de memória integrado (IMC)  │
  └──────────────────────────────┬───────────────────────────┘
                                 │  canais de memória (ex.: 2 canais DDR5)
               ┌─────────────────┴──────────────────┐
               ▼                                    ▼
         ┌───────────┐                        ┌───────────┐
         │  DIMM 0   │                        │  DIMM 1   │
         │ ┌───────┐ │   cada chip: bancos ─▶ │  ...      │
         │ │ banco │ │   cada banco: matriz   └───────────┘
         │ │ ┌───┐ │ │   de linhas × colunas
         │ │ │row│ │ │   + row buffer
         │ │ └───┘ │ │
         │ └───────┘ │
         └───────────┘
  Volta: rajada de 64 bytes (uma linha de cache) ─▶ L3 ─▶ L2 ─▶ L1d ─▶ registrador
```

## Latência versus largura de banda

São duas métricas diferentes, e confundi-las leva a conclusões erradas:

- **Latência**: quanto tempo leva para **um** acesso independente ser atendido. Importa quando cada acesso depende do anterior (percorrer uma lista ligada, uma árvore, um índice).
- **Largura de banda** (*bandwidth*): quantos bytes por segundo podem ser transferidos quando há muitos acessos em paralelo ou sequenciais. Importa para varreduras grandes, cópias, serialização, compressão.

A largura de banda **teórica** de um canal é fácil de calcular: transferências por segundo × largura do canal. DDR4-3200 com canal de 64 bits: 3200 × 10⁶ × 8 bytes = **25,6 GB/s por canal**; com dois canais, 51,2 GB/s. DDR5-4800: 38,4 GB/s por módulo (dois subcanais de 32 bits). Um único núcleo raramente alcança esse total: ele só consegue manter um número limitado de misses pendentes ao mesmo tempo, e a banda de um núcleo fica limitada por `misses simultâneos × 64 bytes ÷ latência`. Por isso servidores precisam de vários núcleos acessando memória para saturar os canais.

Ordens de grandeza para comparar (valores **aproximados**, de documentação de fabricantes e de medições publicadas; variam por geração):

| Operação | Latência típica | Comparação |
|---|---|---|
| Acerto no L1 | ~1 ns | 1× |
| Acerto no L3 | ~10-20 ns | ~10-20× |
| Acesso à DRAM | ~60-120 ns | ~100× |
| Leitura aleatória de 4 KB em SSD NVMe | ~20-100 µs | ~50.000× |
| Leitura aleatória em HDD (seek) | ~5-10 ms | ~5.000.000× |
| Ida e volta na mesma região de nuvem | ~0,2-1 ms | ~500.000× |
| Ida e volta entre continentes | ~100-200 ms | ~100.000.000× |

A tabela explica por que um cache em memória local (um `ConcurrentHashMap`, Caffeine) é tão mais rápido que um cache remoto (Redis) para dados quentes: o Redis guarda tudo em RAM, mas cada acesso paga a rede.

## Word size, alinhamento e leituras desalinhadas

A **palavra** (*word*) é a unidade natural de dados da CPU: o tamanho dos registradores de uso geral e dos endereços. Em x86-64 e ARM64, ela é de 64 bits (8 bytes). A CPU lê e escreve a memória em blocos naturais (8 bytes num registrador, 64 bytes numa linha de cache), e não byte a byte.

Um dado está **alinhado** quando seu endereço é múltiplo do seu tamanho: um `int` em endereço múltiplo de 4, um `long` em múltiplo de 8. Isso garante que ele nunca atravesse a fronteira de uma linha de cache ou de uma página. Um `long` no endereço `0x...3C` estaria **desalinhado**: seus 8 bytes começam numa linha de cache e terminam na próxima.

Consequências do desalinhamento:

- Em x86-64, acessos desalinhados funcionam, e dentro de uma mesma linha de cache costumam custar o mesmo que os alinhados. Quando o acesso **atravessa duas linhas** (*split load*), a CPU precisa buscar as duas, e se atravessa duas páginas, pode precisar de duas traduções de endereço. Isso é mais lento.
- Instruções atômicas (`lock cmpxchg`) sobre dados que atravessam linhas de cache são extremamente caras (*split locks*, que travam o barramento), e alguns sistemas as tratam como erro.
- Em algumas arquiteturas e instruções (algumas instruções SIMD, CPUs ARM mais antigas e muitos microcontroladores), acessos desalinhados geram exceção.

Por isso compiladores inserem **padding** (bytes de preenchimento) em estruturas. Em C, a ordem dos campos afeta o tamanho:

```c
struct Ruim {      // em x86-64 Linux (System V ABI)
    char  a;       // offset 0, depois 7 bytes de padding
    long  b;       // offset 8
    char  c;       // offset 16, depois 3 bytes de padding
    int   d;       // offset 20
};                 // sizeof = 24

struct Boa {
    long  b;       // offset 0
    int   d;       // offset 8
    char  a;       // offset 12
    char  c;       // offset 13, depois 2 bytes de padding
};                 // sizeof = 16
```

## Exemplo: Layout de um objeto Java na memória

Em Java você não controla a ordem dos campos, mas a JVM aplica as mesmas regras de alinhamento. Na HotSpot de 64 bits, com as configurações padrão (heap menor que ~32 GB, *compressed oops* e *compressed class pointers* ativos), todo objeto tem:

- um **header** de 12 bytes: a *mark word* (8 bytes, usada para hash, lock e idade no GC) e o ponteiro comprimido para a classe (4 bytes);
- os campos, reordenados pela JVM (maiores primeiro, aproveitando lacunas);
- **padding** até o tamanho total ser múltiplo de 8 bytes (o alinhamento padrão de objetos, `-XX:ObjectAlignmentInBytes=8`).

```java
class Pedido {
    boolean ativo;     // 1 byte
    long id;           // 8 bytes
    byte status;       // 1 byte
    Object cliente;    // referência: 4 bytes com compressed oops
    int quantidade;    // 4 bytes
}
```

Layout medido numa HotSpot 21 de 64 bits com configurações padrão:

```text
offset  tamanho  conteúdo
  0       8      mark word
  8       4      class pointer (comprimido)
 12       4      int quantidade        ← a JVM usou a lacuna após o header
 16       8      long id               ← alinhado em múltiplo de 8
 24       1      boolean ativo
 25       1      byte status
 26       2      (lacuna interna)
 28       4      Object cliente        ← referência alinhada em múltiplo de 4
 32              tamanho total = 32 bytes (já múltiplo de 8)
```

São 18 bytes de dados "úteis" num objeto de 32 bytes. Isso é o tamanho **raso** (*shallow size*): o objeto `cliente` apontado é contado à parte. Você pode conferir com a biblioteca JOL (`org.openjdk.jol:jol-core`) usando `ClassLayout.parseClass(Pedido.class).toPrintable()`. Os offsets exatos dependem da versão e das flags da JVM: com `-XX:-UseCompressedOops`, a referência passa a ter 8 bytes e o objeto, 40. O projeto Lilliput (cabeçalhos compactos, `-XX:+UseCompactObjectHeaders`, experimental a partir do JDK 24) reduz o header para 8 bytes.

Esse overhead explica por que um `Integer` ocupa 16 bytes para guardar 4, e por que um `HashMap<Long, Long>` com um milhão de entradas consome dezenas de megabytes: cada entrada tem um `Node` (32 bytes), dois `Long` (24 bytes cada: header de 12, mais 4 de lacuna para alinhar o `long` em 8, mais 8 de valor) e uma posição na tabela. O assunto volta em detalhe no estudo do heap da JVM (tópico 4.1.6).

## Tamanho da RAM e limites práticos de processos

A RAM física é finita e compartilhada por todos os processos e pelo próprio kernel. Para uma aplicação Java, isso aparece em vários limites que se sobrepõem:

- **`-Xmx`** limita apenas o **heap** Java. A memória total do processo (o que o SO enxerga como RSS, ou "working set" no Windows) inclui ainda o Metaspace (tópico 4.1.7), as stacks das threads (tópico 1.1.7), o *code cache* do JIT, as estruturas do GC, buffers diretos (`ByteBuffer.allocateDirect`, muito usados por Netty), bibliotecas nativas e o próprio código da JVM. Uma regra prática é que o processo ocupa visivelmente mais que o `-Xmx`, e o quanto a mais depende muito da aplicação. A ferramenta para ver a divisão é o *Native Memory Tracking*: `-XX:NativeMemoryTracking=summary` e `jcmd <pid> VM.native_memory summary`.
- **Reserva não é uso.** Na inicialização, a JVM **reserva** espaço de endereçamento virtual para o heap máximo, mas o SO só entrega páginas físicas quando são tocadas pela primeira vez. Por isso o consumo de RAM cresce gradualmente. `-Xms` igual a `-Xmx` e `-XX:+AlwaysPreTouch` fazem a JVM tocar tudo logo no início, trocando tempo de startup por previsibilidade.
- **Heap devolvido ao SO.** Depois que o GC libera espaço, a JVM pode ou não devolver memória ao SO (o G1 faz isso de forma periódica e conservadora). O RSS de uma JVM raramente cai na mesma velocidade em que o uso do heap cai.
- **Containers.** Em Docker e Kubernetes, o limite de memória é aplicado pelo kernel via **cgroups**. A JVM moderna (JDK 10+, com backport no 8u191) detecta esse limite e, se você não passar `-Xmx`, usa por padrão `MaxRAMPercentage=25` do limite do container. Muitos times ajustam para 50% a 75%, deixando o restante para memória fora do heap. Um `-Xmx` explícito ignora o limite do container, e isso é uma fonte clássica de incidentes.

## Quando a memória física se esgota

O SO usa a RAM livre de forma agressiva: o que não está em uso por processos vira **page cache** (cópias de arquivos lidos e escritos). Por isso "memória livre" baixa não é, por si só, um problema; o indicador relevante no Linux é a memória **disponível** (`available` no `free -h`), que inclui o cache que pode ser descartado.

Quando a demanda real ultrapassa a RAM, o sistema reage em etapas:

1. **Descarte de page cache.** Páginas limpas de arquivos são descartadas, pois podem ser relidas do disco. Isso já degrada o desempenho de I/O.
2. **Swap / paginação.** Páginas anônimas (heap, stacks) de processos pouco ativos são escritas numa área de troca em disco (swap no Linux, *pagefile* no Windows) e a memória física é reaproveitada. Quando o processo toca uma página que está no swap, ocorre um *page fault* que lê a página do disco: microssegundos a milissegundos, em vez de nanossegundos.
3. **Thrashing.** Se o conjunto de páginas ativamente usadas não cabe na RAM, o sistema passa mais tempo trocando páginas do que executando. A máquina fica praticamente parada. Para a JVM, swap é especialmente ruim: o GC percorre o heap inteiro e, se parte dele está no swap, uma pausa de milissegundos pode virar segundos.
4. **OOM killer (Linux).** Se não há mais como liberar memória, o kernel escolhe um processo (com base no `oom_score`, que favorece o maior consumidor) e o mata com `SIGKILL`. Dentro de um container, é o limite do cgroup que dispara o OOM killer, e o Kubernetes mostra o pod como `OOMKilled` com código de saída 137 (128 + 9, o número do sinal). No Windows, o comportamento é diferente: quando o *commit limit* (RAM + pagefile) se esgota, novas alocações falham e o processo recebe erro de alocação.

É importante distinguir isso de um `OutOfMemoryError` (tópico 4.1.13): o `OutOfMemoryError` é a JVM dizendo que **o heap dela**, limitado por `-Xmx`, não comporta mais objetos. O processo continua vivo e você pode ter um *heap dump*. Já o OOM killer é o **SO** matando o processo inteiro de fora: não há exceção, nem log da JVM, nem *heap dump*. Muitos servidores de produção desativam o swap justamente para que a falha seja rápida e explícita, em vez de uma degradação lenta.

## [Adicional] NUMA: quando nem toda RAM está à mesma distância

Em servidores com mais de um soquete (e em algumas CPUs com muitos chiplets), cada processador tem seu próprio controlador e seus próprios módulos de memória. Acessar a memória "local" é mais rápido que acessar a memória ligada ao outro soquete, que precisa atravessar a interconexão entre processadores. Esse arranjo se chama **NUMA** (*Non-Uniform Memory Access*); a diferença de latência entre memória local e remota costuma ser de dezenas de por cento ou mais (valor que varia muito por plataforma).

O SO tenta alocar memória no nó onde a thread está rodando. A JVM oferece `-XX:+UseNUMA`, que faz o coletor (Parallel GC e, a partir do JDK 14, também o G1) alocar objetos novos na memória local de cada thread. Em `numactl --hardware` (Linux) você vê os nós e as distâncias entre eles. Para a maioria dos serviços em nuvem com VMs pequenas, NUMA é transparente, mas em máquinas grandes com bancos de dados ou JVMs com heap de centenas de GB, ele vira um parâmetro de desempenho relevante.

## Custos, limitações e uso em sistemas reais

- **Custo por acesso**: ir à DRAM custa da ordem de 100 ns, e a ordem dos acessos importa (linhas de cache, row buffer, prefetching). Estruturas compactas e acessos sequenciais aproveitam muito melhor a mesma RAM.
- **Custo de capacidade**: RAM é um dos recursos mais caros em nuvem; instâncias são cobradas por GB de memória. Objetos inchados (headers, boxing, coleções de wrappers) se traduzem diretamente em custo de infraestrutura e em mais trabalho para o GC.
- **Volatilidade**: nada que esteja só na RAM sobrevive a uma queda. Sistemas reais combinam estado em memória (rápido) com log ou réplica persistente (durável).
- **Dimensionamento de JVM em container**: defina o limite do container, configure o heap como fração dele (`-XX:MaxRAMPercentage`) e monitore o RSS, não só o heap. Métricas como `container_memory_working_set_bytes` no Kubernetes são o que o kubelet usa para decidir despejos.
- **Diagnóstico**: `free -h`, `top`/`htop` (colunas RES e VIRT), `vmstat 1` (colunas `si`/`so` mostram swap ativo), `dmesg | grep -i oom` (mortes pelo OOM killer) no Linux; Gerenciador de Tarefas e Monitor de Recursos no Windows; `jcmd <pid> GC.heap_info` e NMT para a visão de dentro da JVM.

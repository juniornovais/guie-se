## Traduzir manualmente endereços virtuais para físicos com páginas de 4 KB e uma page table dada

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Número de página e offset", "Page table", "Bits de controle da PTE", "Page fault", "Page table multinível"]}
```

### Enunciado

Um processo roda numa máquina com endereços virtuais de 32 bits e páginas de 4 KiB. Parte de sua page table (nível único) é:

| VPN | Present | PFN | Permissões | Observação |
|---|---|---|---|---|
| 0x0 | 0 | — | — | não mapeada (região inexistente) |
| 0x1 | 1 | 0x08 | leitura e escrita | |
| 0x2 | 1 | 0x0C | somente leitura | |
| 0x3 | 1 | 0x1F | leitura e escrita | |
| 0x4 | 0 | — | leitura e escrita | página válida, atualmente no swap |
| 0x5 | — | — | — | fora de qualquer região do address space |

Para cada acesso abaixo, diga o endereço físico resultante ou, se não houver, o que acontece e por quê.

1. Leitura de `0x00001004`
2. Leitura de `0x00003A7C`
3. Escrita em `0x00002010`
4. Leitura de `0x00004123`
5. Leitura de `0x00000000`
6. Leitura de `0x00005FFF`

Depois, responda: (a) quantas entradas e quantos bytes teria uma page table de nível único completa para este address space, com PTEs de 4 bytes? (b) Num esquema de dois níveis 10/10/12, quais seriam o índice do diretório, o índice da tabela e o offset de `0x00403ABC`?

### Objetivo

Dominar a mecânica da tradução: separar VPN e offset, consultar a PTE, aplicar os bits de controle e reconhecer cada tipo de falha.

### Instruções

1. Para cada endereço, separe os 12 bits de offset (três últimos dígitos hexadecimais) do VPN.
2. Consulte a tabela, verifique o bit Present e as permissões para a operação pedida.
3. Monte o endereço físico como `PFN × 0x1000 + offset` quando a tradução for possível.
4. Para cada falha, classifique: violação de proteção, major fault (dado no swap) ou acesso inválido (`SIGSEGV`).
5. Responda (a) e (b) mostrando as contas.

### Dicas

- Com páginas de 4 KiB, o endereço físico é o PFN "colado" à esquerda do offset de três dígitos hexadecimais.
- Present = 0 não significa necessariamente erro: depende de o kernel saber onde está a página.
- No item (b), o índice do diretório são os 10 bits mais altos: desloque o endereço 22 bits para a direita.

### Critérios de avaliação

- Itens 1 e 2 com endereços físicos corretos (`0x00008004` e `0x0001FA7C`).
- Item 3 identificado como violação de proteção (escrita em página somente leitura), resultando em `SIGSEGV` (ou tratamento CoW, se o kernel souber que é uma página copy-on-write).
- Item 4 identificado como major fault: o kernel lê a página do swap, preenche a PTE e reexecuta a instrução.
- Itens 5 e 6 identificados como acessos inválidos (`SIGSEGV`), com o 5 relacionado a desreferência de `NULL`.
- (a) 2²⁰ entradas e 4 MiB; (b) diretório 0x001, tabela 0x003, offset 0xABC.

### Solução de referência

| # | Endereço | VPN | Offset | Resultado |
|---|---|---|---|---|
| 1 | `0x00001004` leitura | 0x1 | 0x004 | PFN 0x08 → **`0x00008004`** |
| 2 | `0x00003A7C` leitura | 0x3 | 0xA7C | PFN 0x1F → **`0x0001FA7C`** |
| 3 | `0x00002010` escrita | 0x2 | 0x010 | Página presente, mas somente leitura → page fault de proteção. Se a região não permite escrita, `SIGSEGV`. (Se fosse uma página CoW após `fork`, o kernel copiaria o frame e liberaria a escrita.) |
| 4 | `0x00004123` leitura | 0x4 | 0x123 | Present = 0, mas a página é válida e está no swap → **major fault**: o kernel escolhe um frame (talvez expulsando outra página), lê a página do disco, preenche a PTE com o novo PFN e Present = 1, e a instrução é reexecutada. A thread fica bloqueada durante o I/O. |
| 5 | `0x00000000` leitura | 0x0 | 0x000 | Página não mapeada → acesso inválido → `SIGSEGV`. É o caso clássico de desreferência de `NULL`; a página 0 nunca é mapeada justamente para isso. |
| 6 | `0x00005FFF` leitura | 0x5 | 0xFFF | Fora de qualquer região → `SIGSEGV`. Note que o offset 0xFFF é o último byte da página: o erro não tem nada a ver com o offset, e sim com o VPN. |

(a) São 32 − 12 = 20 bits de VPN, logo 2²⁰ = 1.048.576 entradas. Com 4 bytes cada: 4 MiB **por processo**, mesmo que o processo use só algumas páginas. Esse desperdício é o motivo das page tables multinível.

(b) `0x00403ABC` em binário tem os 10 bits mais altos iguais a `0000000001`:

- índice do diretório = `0x00403ABC >> 22` = **0x001**;
- índice da tabela = `(0x00403ABC >> 12) & 0x3FF` = `0x403 & 0x3FF` = **0x003**;
- offset = `0x00403ABC & 0xFFF` = **0xABC**.

A MMU lê a entrada 1 do diretório (apontado por CR3), obtém o endereço da tabela de segundo nível, lê a entrada 3 dela, obtém o PFN e concatena com o offset 0xABC. Se a entrada 1 do diretório não estivesse presente, a tabela de segundo nível inteira não precisaria existir: 4 MiB de address space sem custo de page table.

## Medir minor e major page faults de um processo com /usr/bin/time -v ou perf

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["Minor fault", "Major fault", "Demand paging", "Page cache", "/usr/bin/time", "perf"]}
```

### Enunciado

Meça os page faults de três cenários: um programa Java que aloca e toca memória, a leitura de um arquivo grande mapeado em memória com cache quente e a mesma leitura com cache frio. Explique os números de cada cenário.

### Objetivo

Ver demand paging acontecendo, distinguir minor de major faults na prática e relacioná-los com memória anônima e page cache.

### Instruções

1. Use Linux (nativo, WSL 2 ou Docker com `--privileged` para limpar caches). Instale `time` (`apt install time`) e, se possível, `perf` (`apt install linux-tools-generic`; em WSL e containers o `perf` pode não estar disponível).
2. Cenário A: rode `/usr/bin/time -v java -Xmx2g ContaFaults.java 1024` (programa do conteúdo do tópico, ou um que aloque e toque 1 GB). Anote "Minor (reclaiming a frame) page faults" e "Major (requiring I/O) page faults".
3. Repita o cenário A com `-Xms2g -Xmx2g -XX:+AlwaysPreTouch`. O que muda?
4. Crie um arquivo de 1 GB (`dd if=/dev/urandom of=dados.bin bs=1M count=1024`) e escreva um programa Java que o mapeie com `FileChannel.map` e leia um byte a cada 4096.
5. Cenário B (cache quente): rode o programa duas vezes seguidas com `/usr/bin/time -v` e anote os faults da segunda execução.
6. Cenário C (cache frio): rode `sync; echo 3 | sudo tee /proc/sys/vm/drop_caches` e execute de novo.
7. Se tiver `perf`, confirme com `perf stat -e page-faults,minor-faults,major-faults java ...`.
8. Explique cada resultado.

### Dicas

- 1 GB / 4 KiB = 262.144 páginas. Compare os números com essa referência.
- Uma página de arquivo que já está no page cache só precisa ser ligada à page table do processo.
- O kernel faz *readahead*: um major fault pode trazer várias páginas vizinhas de uma vez, e os acessos seguintes viram minor faults ou nem geram fault.
- Se os minor faults do cenário A forem muito menores que o esperado, verifique `/sys/kernel/mm/transparent_hugepage/enabled`.

### Critérios de avaliação

- Os três cenários foram executados e os números de minor e major faults registrados.
- Explica que o cenário A gera principalmente minor faults (memória anônima zerada no primeiro toque), na ordem de grandeza do número de páginas tocadas, mais os faults da própria JVM.
- Explica o efeito do `AlwaysPreTouch` (faults antecipados para a inicialização, ou contados no total mas fora do laço de medição).
- Mostra que o cenário B gera minor faults (páginas já no page cache) e quase nenhum major.
- Mostra que o cenário C gera major faults e é muito mais lento, e explica por que o número de major faults é menor que o número de páginas (readahead).
- Menciona o efeito do THP, se observado.

### Solução de referência

Programa do passo 4:

```java
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

public class LeMapeado {
    public static void main(String[] args) throws Exception {
        try (FileChannel ch = FileChannel.open(Path.of(args[0]), StandardOpenOption.READ)) {
            long tamanho = ch.size();
            long soma = 0;
            long inicio = System.nanoTime();
            for (long base = 0; base < tamanho; base += Integer.MAX_VALUE) {
                long len = Math.min(Integer.MAX_VALUE, tamanho - base);
                MappedByteBuffer buf = ch.map(FileChannel.MapMode.READ_ONLY, base, len);
                for (int i = 0; i < len; i += 4096) soma += buf.get(i);   // 1 byte por página
            }
            System.out.printf("soma=%d tempo=%d ms%n", soma, (System.nanoTime() - inicio) / 1_000_000);
        }
    }
}
```

Resultados ilustrativos (Linux, SSD NVMe, THP em `madvise`; variam por sistema):

| Cenário | Minor faults | Major faults | Tempo |
|---|---|---|---|
| A: aloca e toca 1 GB | ~290.000 | 0 | ~1,2 s |
| A com `AlwaysPreTouch` (`-Xms2g`) | ~560.000 | 0 | ~1,6 s (mais na inicialização) |
| B: mmap 1 GB, cache quente | ~265.000 | 0–5 | ~0,3 s |
| C: mmap 1 GB, cache frio | ~250.000 | ~8.000 | ~1,5 s |

- **Cenário A**: ~262 mil faults vêm do toque de 1 GB de memória anônima (cada primeira escrita numa página faz o kernel entregar um frame zerado), e o restante é a inicialização da JVM (carregar `libjvm.so`, classes, CDS, JIT). Todos são minor: nada vem do disco. Se o THP estiver em `always`, o número pode cair para alguns milhares, porque cada fault preenche 2 MiB.
- **Com `AlwaysPreTouch`**: a JVM toca o heap inteiro (2 GB = ~524 mil páginas) na inicialização. O total de faults do processo aumenta (pré-tocou mais do que o programa usa), mas eles acontecem antes de `main`. O laço do programa praticamente não gera faults, como mostraria a medição interna via `/proc/self/stat`.
- **Cenário B**: o arquivo está inteiro no page cache por causa da execução anterior. Cada página tocada gera um minor fault: o kernel só encontra a página no cache e a liga à page table do processo. Sem I/O, a leitura é rápida.
- **Cenário C**: depois de `drop_caches`, as páginas não estão na RAM. O primeiro toque em cada trecho gera um **major fault** e bloqueia até o SSD responder. O número de major faults (~8.000) é bem menor que 262 mil porque o kernel faz **readahead**: cada leitura do disco traz um bloco de páginas vizinhas para o page cache, e os toques seguintes nessas páginas são minor faults. O tempo maior é dominado pela espera do dispositivo.

Lição: minor faults custam microssegundos e acontecem o tempo todo; major faults custam de dezenas de microssegundos a milissegundos e indicam I/O de disco no caminho de um acesso à memória.

## Comparar o tempo de inicialização de uma JVM com -XX:+AlwaysPreTouch e sem a flag e explicar pelos page faults

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["AlwaysPreTouch", "Demand paging", "RSS", "Huge pages", "Latência de cauda"]}
```

### Enunciado

Meça o tempo de inicialização e o RSS de uma JVM com heap de 4 GB com e sem `-XX:+AlwaysPreTouch`. Depois, meça a latência de um laço que aloca memória nos primeiros segundos de execução nos dois casos. Explique os resultados em termos de page faults e discuta quando a flag vale a pena.

### Objetivo

Entender o trade-off entre inicialização rápida (demand paging) e latência previsível (memória pré-tocada), e quando cada um é desejável em produção.

### Instruções

1. Garanta pelo menos 6 GB de RAM livre. No Linux, meça com `/usr/bin/time -v java -Xms4g -Xmx4g -version` e com `-XX:+AlwaysPreTouch`. No Windows, use `Measure-Command { java -Xms4g -Xmx4g -XX:+AlwaysPreTouch -version }` no PowerShell.
2. Repita cada medição 3 vezes e use a mediana. Registre tempo total, minor faults (Linux) e RSS máximo ("Maximum resident set size").
3. Escreva um programa que, logo no início, aloque objetos em ritmo alto por 5 segundos e registre o tempo de cada lote de 10 MB alocados. Compare a distribuição (máximo e p99) com e sem a flag.
4. Repita a comparação com `-XX:+UseTransparentHugePages` (se o THP estiver em `madvise` ou `always`).
5. Explique os resultados e escreva uma recomendação: em que tipo de serviço você ativaria `AlwaysPreTouch`, e em qual não ativaria?

### Dicas

- Sem a flag, `-Xms4g` torna o heap *committed*, mas não residente.
- Com a flag, a JVM escreve em cada página do heap na inicialização; JDKs recentes fazem isso em paralelo com as threads do GC.
- Com huge pages, o número de faults para tocar 4 GB cai de ~1 milhão para ~2 mil.
- Pense em containers com escalonamento automático e em serviços que precisam de p99 baixo desde a primeira requisição.

### Critérios de avaliação

- Tabela com tempo, faults e RSS para as duas configurações (e para a variação com THP, se possível).
- Mostra que a flag aumenta o tempo de inicialização e faz o RSS chegar perto de 4 GB imediatamente.
- Mostra que, com a flag, os primeiros lotes de alocação têm latência menor e mais estável.
- Explica pelos page faults: sem a flag, cada página nova do heap gera um minor fault no primeiro uso, durante a execução da aplicação.
- Recomendação justificada, considerando tempo de inicialização, densidade de memória e latência de cauda.

### Solução de referência

```java
public class AlocaCedo {
    public static void main(String[] args) {
        long fim = System.nanoTime() + 5_000_000_000L;
        long[] lotes = new long[100_000];
        int n = 0;
        Object[] retidos = new Object[256];          // mantém parte viva para o heap crescer
        int k = 0;
        while (System.nanoTime() < fim && n < lotes.length) {
            long t0 = System.nanoTime();
            for (int i = 0; i < 10; i++) retidos[k++ & 255] = new byte[1024 * 1024]; // 10 MB
            lotes[n++] = System.nanoTime() - t0;
        }
        java.util.Arrays.sort(lotes, 0, n);
        System.out.printf("lotes=%d p50=%d µs p99=%d µs max=%d µs%n",
                n, lotes[n / 2] / 1000, lotes[(int) (n * 0.99)] / 1000, lotes[n - 1] / 1000);
    }
}
```

Resultados ilustrativos (Linux, 16 GB de RAM, JDK 21, G1; variam por sistema):

| Configuração | Inicialização (`-version`) | Minor faults | RSS máximo |
|---|---|---|---|
| `-Xms4g -Xmx4g` | ~0,08 s | ~12.000 | ~45 MB |
| `+ AlwaysPreTouch` | ~0,7 s | ~1.060.000 | ~4,1 GB |
| `+ AlwaysPreTouch + UseTransparentHugePages` | ~0,3 s | ~14.000 | ~4,1 GB |

| Configuração | p50 lote 10 MB | p99 | máximo |
|---|---|---|---|
| sem pre-touch | ~1.800 µs | ~3.500 µs | ~9.000 µs |
| com pre-touch | ~600 µs | ~1.200 µs | ~4.000 µs |

Explicação:

- **Sem a flag**, `-Xms4g` faz a JVM reservar e comprometer 4 GB, mas o kernel só entrega frames quando cada página é escrita (demand paging). A inicialização é rápida e o RSS começa baixo. O custo aparece depois: cada página do heap usada pela primeira vez (pelo alocador TLAB ou pela cópia do GC) gera um minor fault de ~1 µs, mais o tempo de o kernel zerar a página. Num laço que aloca 10 MB, são ~2.560 faults por lote.
- **Com a flag**, a JVM escreve em todas as ~1 milhão de páginas antes de `main`. A inicialização fica mais lenta (centenas de ms; com heaps de 30 GB pode passar de segundos) e o RSS vai direto para ~4 GB. Em troca, a aplicação não paga faults no heap durante a execução: a alocação vira só incrementar o ponteiro do TLAB e zerar memória já mapeada.
- **Com THP**, cada fault preenche 2 MiB, então pré-tocar 4 GB custa ~2.000 faults e a inicialização fica bem mais rápida; o heap também ganha TLB reach.

Recomendação: ativar `AlwaysPreTouch` em serviços de vida longa, sensíveis a latência de cauda e com memória dedicada (gateways de pagamento, sistemas de trading, bancos em memória), em que alguns segundos a mais na inicialização não importam e picos na primeira hora importam. Evitar em ferramentas de linha de comando, funções serverless e containers que escalam rápido (a inicialização mais lenta atrasa o *readiness*), e em ambientes com overcommit de memória entre muitos containers, porque a flag torna toda a reserva do heap residente desde o início, mesmo que a aplicação nunca precise dela.

## Explicar como huge pages reduzem TLB misses e quais os riscos de transparent huge pages em bancos de dados

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["TLB", "TLB reach", "Huge pages", "THP", "khugepaged", "Compactação de memória", "Copy-on-write"]}
```

### Enunciado

Pergunta de entrevista: *"Nosso time quer habilitar huge pages para melhorar o desempenho do PostgreSQL e dos serviços Java. Um colega diz que a documentação do Redis e do MongoDB manda desabilitar transparent huge pages. Explique como huge pages ajudam, por que esses bancos recomendam desabilitar THP e o que você configuraria em cada caso."*

### Objetivo

Explicar com precisão o mecanismo (TLB reach, page walk mais curto) e os riscos operacionais do THP, chegando a uma recomendação prática.

### Instruções

1. Explique o que é TLB reach e calcule-o para 1.536 entradas com páginas de 4 KiB e de 2 MiB.
2. Explique por que uma huge page também encurta o page walk.
3. Diferencie huge pages explícitas (hugetlbfs) de THP.
4. Liste pelo menos três riscos do THP no modo `always` para bancos de dados e explique o mecanismo de cada um.
5. Recomende a configuração para: PostgreSQL com `shared_buffers` grande, Redis e um serviço Java com heap de 16 GB.

### Dicas

- Um banco de dados acessa páginas do buffer pool de forma espalhada, por todo o espaço.
- O Redis faz `fork` para snapshots. Pense no que acontece com copy-on-write se a unidade for 2 MiB.
- Encontrar 2 MiB fisicamente contíguos numa máquina que roda há semanas pode exigir mover páginas de lugar.
- A JVM tem flags diferentes para cada um dos dois mecanismos.

### Critérios de avaliação

- Calcula o TLB reach corretamente (~6 MiB vs. ~3 GiB) e explica o impacto em acesso aleatório a muita memória.
- Explica que uma página de 2 MiB é resolvida no nível PD, economizando um nível do page walk, e que as page tables ficam menores.
- Diferencia hugetlbfs (pool reservado, explícito, não vai para swap) de THP (automático, `khugepaged`, `always`/`madvise`/`never`).
- Cita riscos do THP com mecanismo: compactação síncrona causando picos de latência, inchaço de memória (RSS maior que o necessário), CoW de 2 MiB após `fork`, custo do `khugepaged`.
- Recomendações coerentes: PostgreSQL com `huge_pages=on` e hugetlbfs; Redis com THP `never` (ou `madvise`); JVM com `madvise` + `-XX:+UseTransparentHugePages` ou `-XX:+UseLargePages` com pool reservado.

### Solução de referência

**Como ajudam.** A TLB guarda um número fixo de traduções. *TLB reach* é quanto de memória essas entradas cobrem: 1.536 × 4 KiB ≈ **6 MiB**; 1.536 × 2 MiB ≈ **3 GiB**. Um banco com 64 GB de buffer pool, ou uma JVM com heap de 16 GB, acessa memória de forma espalhada; com páginas de 4 KiB, quase todo acesso a uma página "fria" é um TLB miss seguido de page walk. Com páginas de 2 MiB, a maior parte dos acessos acerta na TLB.

Além disso, a página de 2 MiB é mapeada diretamente por uma entrada do nível PD (bit PS = 1): o walk tem três níveis em vez de quatro, e as page tables ocupam 512 vezes menos entradas no último nível. Isso importa no PostgreSQL, em que cada processo *backend* mapeia o `shared_buffers` inteiro e paga sua própria page table: com 100 conexões e 32 GB de memória compartilhada, page tables de 4 KiB podem consumir vários GB.

**hugetlbfs vs. THP.** Huge pages explícitas vêm de um pool reservado pelo administrador (`vm.nr_hugepages`), alocado de preferência no boot. São garantidas, não vão para swap, não precisam de compactação, mas ficam reservadas mesmo sem uso e exigem que a aplicação as peça (`MAP_HUGETLB`, `SHM_HUGETLB`). THP é automático: o kernel tenta entregar 2 MiB no page fault e o `khugepaged` funde páginas pequenas em segundo plano. Modos: `always` (qualquer memória anônima), `madvise` (só regiões marcadas com `madvise(MADV_HUGEPAGE)`) e `never`.

**Riscos do THP `always` em bancos.**

1. **Picos de latência por compactação**: num sistema com memória fragmentada, conseguir 2 MiB contíguos pode exigir que o kernel migre páginas de lugar (compactação), às vezes de forma síncrona dentro do page fault, travando a thread por milissegundos.
2. **Inchaço de memória**: alocadores que usam e liberam pedaços pequenos espalhados não conseguem devolver memória, porque basta um byte em uso para manter 2 MiB residentes. O RSS cresce além do necessário.
3. **Copy-on-write caro**: o Redis faz `fork` para `BGSAVE`; cada escrita do pai durante o snapshot copia uma página. Com THP, escrever 1 byte pode copiar 2 MiB, aumentando a latência e o consumo de memória durante o snapshot.
4. **CPU em segundo plano e imprevisibilidade**: o `khugepaged` varre e funde páginas; os benefícios variam ao longo do tempo, o que dificulta capacidade e diagnóstico.

**Recomendações.**

- **PostgreSQL**: `huge_pages = on` (ou `try`) com pool hugetlbfs dimensionado para `shared_buffers`; THP em `madvise` ou `never` para o resto. Ganha TLB reach e reduz drasticamente as page tables dos backends.
- **Redis**: THP `never` (o próprio Redis avisa no log quando está em `always`), por causa do CoW em `fork` e das latências. Sem huge pages explícitas.
- **Serviço Java com heap de 16 GB**: THP em `madvise` no sistema e `-XX:+UseTransparentHugePages` na JVM (o heap é grande, contíguo e acessado de forma espalhada pelo GC, o caso ideal), muitas vezes com `-XX:+AlwaysPreTouch` para pagar os faults na inicialização. Alternativa mais previsível: `-XX:+UseLargePages` com pool hugetlbfs reservado, ao custo de memória dedicada. Em qualquer caso, medir antes e depois (`perf stat -e dTLB-load-misses`, latência p99).

## Implementar um simulador de paging com TLB e algoritmos de substituição FIFO e LRU

```meta
{"type": "implementation", "level": 4, "required": false, "knowledge": ["Page table", "TLB", "Page fault", "FIFO", "LRU", "Anomalia de Bélády", "LinkedHashMap"]}
```

### Enunciado

Implemente em Java um simulador de memória paginada que recebe uma sequência de endereços virtuais e simula: a tradução via TLB, a consulta à page table, os page faults e a substituição de páginas quando os frames físicos acabam, com as políticas FIFO e LRU. O simulador deve produzir estatísticas e demonstrar a anomalia de Bélády.

### Objetivo

Consolidar o funcionamento de TLB, page table e substituição de páginas implementando-os, e observar experimentalmente as diferenças entre FIFO e LRU.

### Instruções

1. Parâmetros: tamanho de página, número de frames físicos, número de entradas da TLB e política (`FIFO` ou `LRU`).
2. Para cada endereço: calcule VPN e offset; consulte a TLB (hit ou miss); em caso de miss, consulte a page table; se a página não estiver residente, conte um page fault e carregue-a num frame livre ou no frame de uma vítima escolhida pela política.
3. Ao expulsar uma página, invalide também sua entrada na TLB (senão a TLB apontaria para um frame reutilizado).
4. A TLB deve usar substituição LRU, independentemente da política de páginas.
5. Retorne o endereço físico de cada acesso e acumule: acessos, TLB hits, TLB misses, page faults e expulsões.
6. Teste com a sequência de páginas `1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5` (convertida em endereços) para 3 e 4 frames com FIFO e LRU, e mostre a anomalia de Bélády.
7. Teste uma varredura sequencial de 64 páginas acessando de 8 em 8 bytes, com TLB de 16 entradas, e uma sequência de acessos aleatórios no mesmo espaço. Compare a taxa de TLB hits.

### Dicas

- `LinkedHashMap` com `accessOrder = true` mantém a ordem do menos recentemente usado para o mais recente; com `false`, mantém a ordem de inserção (FIFO).
- Sobrescrever `removeEldestEntry` dá uma TLB com capacidade fixa e LRU de graça.
- Num hit de TLB com política LRU, a página também precisa ser marcada como usada na estrutura de substituição (no hardware real, quem faz esse papel é o bit Accessed).
- Resultados esperados para a sequência clássica: FIFO com 3 frames = 9 faults e com 4 frames = 10; LRU com 3 frames = 10 e com 4 frames = 8.

### Critérios de avaliação

- O código compila e roda com Java 21, sem dependências externas.
- A tradução calcula VPN e offset corretamente e retorna `frame × tamanhoPagina + offset`.
- TLB com capacidade fixa e LRU, invalidada quando uma página é expulsa.
- FIFO e LRU implementados corretamente, reproduzindo 9/10 faults (FIFO) e 10/8 faults (LRU) na sequência clássica.
- Demonstra e explica a anomalia de Bélády com FIFO e por que LRU não a sofre.
- Mostra e explica a diferença de TLB hit rate entre acesso sequencial e aleatório.

### Solução de referência

```java
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Random;

public class SimuladorPaging {
    enum Politica { FIFO, LRU }

    private final int tamanhoPagina;
    private final Politica politica;
    private final Deque<Integer> framesLivres = new ArrayDeque<>();
    // páginas residentes: VPN -> frame. Ordem = ordem de expulsão (FIFO: inserção; LRU: acesso).
    private final LinkedHashMap<Long, Integer> residentes;
    // TLB: VPN -> frame, capacidade fixa, sempre LRU.
    private final LinkedHashMap<Long, Integer> tlb;

    long acessos, tlbHits, tlbMisses, pageFaults, expulsoes;

    SimuladorPaging(int tamanhoPagina, int numFrames, int entradasTlb, Politica politica) {
        this.tamanhoPagina = tamanhoPagina;
        this.politica = politica;
        for (int f = 0; f < numFrames; f++) framesLivres.addLast(f);
        this.residentes = new LinkedHashMap<>(16, 0.75f, politica == Politica.LRU);
        this.tlb = new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Long, Integer> eldest) {
                return size() > entradasTlb;
            }
        };
    }

    long traduzir(long enderecoVirtual) {
        long vpn = enderecoVirtual / tamanhoPagina;
        long offset = enderecoVirtual % tamanhoPagina;
        acessos++;

        Integer frame = tlb.get(vpn);
        if (frame != null) {
            tlbHits++;
            residentes.get(vpn);              // com LRU, marca a página como recém-usada
        } else {
            tlbMisses++;
            frame = residentes.get(vpn);      // "page walk"
            if (frame == null) {
                pageFaults++;
                frame = carregar(vpn);
            }
            tlb.put(vpn, frame);
        }
        return (long) frame * tamanhoPagina + offset;
    }

    private int carregar(long vpn) {
        if (framesLivres.isEmpty()) {
            Map.Entry<Long, Integer> vitima = residentes.entrySet().iterator().next(); // mais antiga
            residentes.remove(vitima.getKey());
            tlb.remove(vitima.getKey());      // invalida a tradução que apontava para o frame
            framesLivres.addLast(vitima.getValue());
            expulsoes++;
        }
        int frame = framesLivres.pollFirst();
        residentes.put(vpn, frame);
        return frame;
    }

    @Override
    public String toString() {
        return String.format("%-4s acessos=%d tlbHit=%.1f%% faults=%d expulsoes=%d",
                politica, acessos, 100.0 * tlbHits / acessos, pageFaults, expulsoes);
    }

    public static void main(String[] args) {
        final int PAGINA = 4096;
        long[] paginas = {1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5};

        System.out.println("== Sequência clássica (TLB de 2 entradas) ==");
        for (Politica p : Politica.values()) {
            for (int frames : new int[] {3, 4}) {
                SimuladorPaging sim = new SimuladorPaging(PAGINA, frames, 2, p);
                for (long pg : paginas) sim.traduzir(pg * PAGINA + 0x10);
                System.out.println(frames + " frames: " + sim);
            }
        }

        System.out.println("== Localidade (64 páginas, 32 frames, TLB de 16) ==");
        SimuladorPaging seq = new SimuladorPaging(PAGINA, 32, 16, Politica.LRU);
        for (long end = 0; end < 64L * PAGINA; end += 8) seq.traduzir(end);
        System.out.println("sequencial: " + seq);

        SimuladorPaging alea = new SimuladorPaging(PAGINA, 32, 16, Politica.LRU);
        Random r = new Random(42);
        for (int i = 0; i < 32_768; i++) alea.traduzir((long) r.nextInt(64 * PAGINA));
        System.out.println("aleatório:  " + alea);
    }
}
```

Saída (a separação decimal depende do locale; o resultado é determinístico, inclusive o acesso aleatório, por causa da semente fixa):

```text
== Sequência clássica (TLB de 2 entradas) ==
3 frames: FIFO acessos=12 tlbHit=0,0% faults=9 expulsoes=6
4 frames: FIFO acessos=12 tlbHit=0,0% faults=10 expulsoes=6
3 frames: LRU  acessos=12 tlbHit=0,0% faults=10 expulsoes=7
4 frames: LRU  acessos=12 tlbHit=0,0% faults=8 expulsoes=4
== Localidade (64 páginas, 32 frames, TLB de 16) ==
sequencial: LRU  acessos=32768 tlbHit=99,8% faults=64 expulsoes=32
aleatório:  LRU  acessos=32768 tlbHit=24,6% faults=16380 expulsoes=16348
```

Na sequência clássica a TLB de 2 entradas nunca acerta: nenhuma página é reacessada enquanto ainda está entre as duas mais recentes. É uma sequência sem localidade, escolhida para estressar a substituição de páginas.

**Anomalia de Bélády.** Com FIFO, passar de 3 para 4 frames **aumentou** os faults de 9 para 10. A FIFO expulsa pela idade de chegada, sem considerar uso, e o conjunto de páginas residentes com 4 frames não é necessariamente um superconjunto do conjunto com 3 frames ao longo da execução. LRU é um *algoritmo de pilha*: em qualquer instante, as páginas residentes com N frames são sempre um subconjunto das residentes com N + 1 (são as N mais recentemente usadas). Por isso mais frames nunca pioram a LRU: 10 faults com 3 frames e 8 com 4.

**Localidade e TLB.** Na varredura sequencial, cada página recebe 512 acessos seguidos (4096 / 8): só o primeiro é TLB miss, então a taxa de hit é 511/512 ≈ 99,8%, e os 64 page faults vêm do primeiro toque em cada página (32 delas expulsando outras, pois só há 32 frames). No acesso aleatório sobre 64 páginas com TLB de 16 entradas, a probabilidade de a página estar na TLB é cerca de 16/64 = 25% (medido: 24,6%), e como só metade das páginas cabe nos frames, cerca de metade dos acessos gera page fault (16.380 de 32.768). É a mesma razão pela qual percorrer arrays é muito mais rápido que seguir ponteiros espalhados: localidade espacial favorece caches, TLB e paging ao mesmo tempo.

Observação: o simulador implementa LRU exato, o que o hardware não faz. Sistemas reais aproximam LRU com o bit Accessed e algoritmos como clock (segunda chance). Uma extensão interessante é implementar o clock e comparar com LRU nas mesmas sequências.

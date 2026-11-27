## O problema que o paging resolve

O tópico 1.2.6 mostrou que a MMU traduz cada endereço virtual para um endereço físico. A questão é **com que granularidade**. Traduzir byte a byte exigiria uma tabela gigantesca. Traduzir por segmentos grandes e de tamanho variável (o modelo antigo de *segmentação*) causa **fragmentação externa**: sobram buracos livres na RAM que, somados, são grandes, mas nenhum cabe um segmento novo.

**Paging** resolve isso dividindo os dois lados em blocos de tamanho fixo:

- a memória virtual é dividida em **páginas** (*pages*);
- a memória física é dividida em **frames** (*page frames*) do mesmo tamanho;
- uma **page table** diz, para cada página virtual, em qual frame ela está (se estiver).

Qualquer página pode ir para qualquer frame. Não existe fragmentação externa: todo frame livre serve. O custo é uma **fragmentação interna** pequena (a última página de uma região raramente é usada por inteiro) e a necessidade de manter e consultar as page tables, que é o centro deste tópico.

O tamanho de página padrão em x86-64 e na maioria dos ARM é **4 KiB**. Também existem páginas grandes (*huge pages*) de 2 MiB e 1 GiB, que veremos adiante.

## Número de página e offset

Com páginas de 4 KiB = 2¹² bytes, os **12 bits menos significativos** de um endereço indicam a posição dentro da página (*offset*), e os bits restantes formam o **número da página virtual** (*VPN — virtual page number*).

```text
endereço virtual (32 bits, para simplificar):  0x00403ABC

  ┌────────────────────────────┬──────────────┐
  │ VPN = 0x00403  (20 bits)   │ offset 0xABC │
  └────────────────────────────┴──────────────┘
                 │                     │
         page table[0x00403] = frame 0x1F2      (copiado sem mudança)
                 │                     │
  ┌────────────────────────────┬──────────────┐
  │ PFN = 0x001F2              │ offset 0xABC │  → endereço físico 0x001F2ABC
  └────────────────────────────┴──────────────┘
```

A tradução troca apenas o número da página pelo número do frame (*PFN — physical frame number*); o offset passa intacto. Em hexadecimal, com páginas de 4 KiB, isso é visual: os três últimos dígitos são o offset.

Cada entrada da page table (*PTE — page table entry*) guarda, além do PFN, bits de controle. No x86-64:

| Bit | Nome | Significado |
|---|---|---|
| 0 | Present (P) | A página está em um frame. Se 0, qualquer acesso gera page fault |
| 1 | Read/Write | 0 = somente leitura |
| 2 | User/Supervisor | 0 = só o kernel acessa |
| 5 | Accessed (A) | A CPU liga quando a página é lida ou escrita |
| 6 | Dirty (D) | A CPU liga quando a página é escrita |
| 7 | Page Size (PS) | Nos níveis superiores: a entrada aponta para uma huge page |
| 12–51 | PFN | Número do frame físico |
| 63 | NX | Não executável |

Os bits **Accessed** e **Dirty** são a matéria-prima dos algoritmos de substituição de páginas e do *writeback*: o kernel usa A para saber o que está "quente" e D para saber o que precisa ser gravado antes de reaproveitar o frame.

## Por que page tables multinível

Uma page table de nível único para um address space de 48 bits com páginas de 4 KiB teria 2³⁶ entradas. Com 8 bytes cada, são **512 GiB por processo**, a maior parte descrevendo endereços que nunca serão usados. Mesmo em 32 bits, uma tabela única tem 2²⁰ entradas × 4 bytes = 4 MiB por processo, desperdício grande para processos pequenos.

A solução é transformar a tabela numa **árvore** (*radix tree*). O VPN é fatiado em vários índices; cada nível aponta para tabelas do nível seguinte, e **subárvores inteiras de endereços não usados simplesmente não existem**. Um processo que usa um pedaço do código embaixo e a stack lá no alto precisa de poucas tabelas: as dos caminhos que levam até essas regiões.

O preço: traduzir um endereço exige percorrer a árvore, um acesso à memória por nível. É o que chamamos de **page walk**.

## Diagrama: Page walk de 4 níveis no x86-64

```text
 endereço virtual de 48 bits (bits 63–48 = cópia do bit 47)

  47      39 38      30 29      21 20      12 11           0
 ┌──────────┬──────────┬──────────┬──────────┬──────────────┐
 │ PML4 (9) │ PDPT (9) │  PD (9)  │  PT (9)  │ offset (12)  │
 └────┬─────┴────┬─────┴────┬─────┴────┬─────┴──────┬───────┘
      │          │          │          │            │
 CR3 ─┼─► ┌──────▼───┐      │          │            │
      └──►│ PML4     │──┐   │          │            │
          │ 512 ent. │  │   │          │            │
          └──────────┘  └──►┌──────────┐            │
                            │ PDPT     │──┐ (PS=1 aqui → página de 1 GiB)
                            └──────────┘  └──►┌──────────┐
                                              │ PD       │──┐ (PS=1 aqui → página de 2 MiB)
                                              └──────────┘  └──►┌──────────┐
                                                                │ PT       │──► PFN
                                                                └──────────┘     │
                                                                                 ▼
                                                     endereço físico = PFN · 4096 + offset
```

Cada tabela tem 512 entradas de 8 bytes, ou seja, ocupa exatamente **uma página de 4 KiB**. São 9 bits de índice por nível (2⁹ = 512), quatro níveis, mais 12 bits de offset: 4 × 9 + 12 = 48. O registrador **CR3** guarda o endereço físico da PML4 do processo atual; trocar de processo é, em grande parte, trocar o CR3. CPUs com *5-level paging* adicionam um nível (PML5) e chegam a 57 bits.

O page walk é feito **pelo hardware** no x86 (e no ARM). O kernel só monta as tabelas; a MMU as percorre sozinha.

## TLB: o cache das traduções

Se cada acesso à memória exigisse quatro acessos extras para o page walk, todo programa ficaria várias vezes mais lento. A CPU evita isso com a **TLB** (*translation lookaside buffer*), um cache pequeno e muito rápido de traduções `VPN → PFN + permissões`.

Ordens de grandeza típicas de um núcleo x86 moderno (variam por microarquitetura):

| Estrutura | Entradas | Latência |
|---|---|---|
| L1 dTLB (páginas de 4 KiB) | ~64–96 | parte do acesso ao L1, ~1 ciclo |
| L2 TLB (STLB, compartilhada) | ~1.500–2.000 | alguns ciclos |
| Page walk (TLB miss) | — | dezenas a centenas de ciclos |

O conceito-chave é o **TLB reach**: quanto de memória a TLB consegue cobrir. Com 1.536 entradas de 4 KiB, são apenas ~6 MiB. Um programa que acessa aleatoriamente um heap de 8 GB vai errar na TLB em praticamente todo acesso. Com páginas de 2 MiB, as mesmas entradas cobrem ~3 GiB.

Um TLB miss nem sempre custa quatro idas à DRAM: as entradas das tabelas superiores costumam estar nos caches L1/L2/L3, e a CPU tem *page walk caches* para os níveis intermediários. Ainda assim, em cargas com acesso aleatório a muita memória (bancos de dados, caches em memória, heaps Java grandes, grafos), TLB misses podem consumir uma fração relevante do tempo de CPU. Em máquinas virtuais o custo é maior: com tradução aninhada (EPT/NPT), cada nível da tabela do convidado precisa ser traduzido pela tabela do hipervisor, e um walk completo pode exigir até 24 acessos.

Duas situações invalidam a TLB:

- **Troca de contexto entre processos**: as traduções do processo anterior não valem mais. Recursos como **PCID** marcam entradas com o ID do address space para evitar descartar tudo.
- **Alteração de mapeamentos** (`munmap`, `mprotect`, migração de página): se o processo tem threads rodando em outros núcleos, o kernel precisa invalidar a TLB deles via interrupção entre processadores, a **TLB shootdown**. Programas que fazem muito `mmap`/`munmap` em muitos núcleos pagam caro por isso.

## Page faults: minor e major

Um **page fault** é a exceção que a MMU gera quando a tradução falha: a PTE não está presente ou a operação viola as permissões. O kernel trata a exceção e decide entre três desfechos:

1. **Acesso inválido**: o endereço não pertence a nenhuma região do address space (tópico 1.2.7) ou a região não permite a operação. Resultado: `SIGSEGV`.
2. **Minor fault** (*soft fault*): o acesso é legítimo e o dado **já está na RAM** ou não precisa vir do disco. Basta alocar ou localizar um frame e preencher a PTE. Exemplos: primeiro toque numa página anônima (o kernel entrega um frame zerado); página de arquivo que já está no page cache; escrita numa página *copy-on-write*.
3. **Major fault** (*hard fault*): o dado precisa ser **lido do armazenamento**: página de arquivo mapeado que não está no page cache, ou página anônima que foi para o swap. A thread fica bloqueada até o I/O terminar.

Custos ilustrativos (dependem muito do hardware):

| Evento | Custo aproximado |
|---|---|
| Acesso com TLB hit | ~1 ns |
| TLB miss com page walk | ~10–100 ns |
| Minor fault (entrar no kernel, zerar 4 KiB, preencher PTE) | ~0,5–2 µs |
| Major fault em SSD NVMe | ~50–150 µs |
| Major fault em HDD | ~5–10 ms |

Um minor fault é mil vezes mais caro que um acesso normal; um major fault em disco rotativo é milhões de vezes mais caro. Esse é o fundamento da **demand paging**: o kernel só entrega frames quando a página é tocada pela primeira vez. Isso torna `mmap` e `malloc` baratos, mas transfere o custo para o primeiro acesso, que pode cair no meio de uma requisição sensível a latência.

## Copy-on-write e fork

`fork()` cria um processo filho com uma cópia do address space do pai. Copiar gigabytes de memória a cada `fork` seria inviável. Em vez disso, o kernel:

1. copia **as page tables** (não os dados), fazendo pai e filho apontarem para os mesmos frames;
2. marca todas as páginas graváveis privadas como **somente leitura** em ambos;
3. quando qualquer um dos dois escreve, ocorre um page fault de proteção; o kernel percebe que é uma página CoW, copia aquele frame, aponta a PTE de quem escreveu para a cópia e devolve a permissão de escrita.

Só as páginas efetivamente escritas são duplicadas. Para `fork` seguido de `exec`, quase nada é copiado.

Uso real e armadilhas:

- O **Redis** usa `fork` para gerar snapshots (`BGSAVE`): o filho grava a memória "congelada" no disco enquanto o pai continua atendendo. Se a carga de escrita for alta durante o snapshot, muitas páginas são duplicadas e o uso de memória pode quase dobrar.
- Mesmo sem copiar dados, `fork` copia as page tables: para um processo com dezenas de GB, isso leva milissegundos e congela o processo. Por isso o JDK, no Linux, usa por padrão `posix_spawn` (via o auxiliar `jspawnhelper`) em `ProcessBuilder`, em vez de `fork`, evitando duplicar a page table de uma JVM grande.

## Huge pages e transparent huge pages

Páginas maiores reduzem o número de entradas necessárias: uma página de **2 MiB** (entrada no nível PD com o bit PS) substitui 512 páginas de 4 KiB, elimina um nível do page walk e multiplica o TLB reach por 512. Também reduzem o tamanho das page tables e o número de page faults (um fault preenche 2 MiB).

O Linux oferece dois mecanismos:

**Huge pages explícitas (hugetlbfs).** O administrador reserva um pool (`vm.nr_hugepages`); a aplicação as solicita explicitamente. São previsíveis, não vão para swap e não fragmentam, mas a memória reservada fica indisponível para o resto do sistema, usada ou não. Na JVM: `-XX:+UseLargePages` (no Linux, por padrão usa hugetlbfs; `-XX:LargePageSizeInBytes` escolhe 2 MiB ou 1 GiB). No Windows, a mesma flag exige o privilégio *Lock pages in memory*.

**Transparent Huge Pages (THP).** O kernel tenta usar páginas de 2 MiB automaticamente para memória anônima, e a thread `khugepaged` funde páginas pequenas em grandes em segundo plano. Configuração em `/sys/kernel/mm/transparent_hugepage/enabled`: `always`, `madvise` (só regiões marcadas com `madvise(MADV_HUGEPAGE)`) ou `never`. Na JVM, `-XX:+UseTransparentHugePages` marca o heap com `madvise`, funcionando quando o modo do sistema é `madvise` ou `always`.

Os riscos do THP, especialmente no modo `always`:

- **Picos de latência**: para obter 2 MiB contíguos, o kernel pode precisar **compactar memória** de forma síncrona, dentro do page fault (configurável em `.../transparent_hugepage/defrag`).
- **Inchaço de memória**: tocar 1 byte compromete 2 MiB. Alocadores que liberam memória em pedaços pequenos (como em bancos chave-valor) não conseguem devolvê-la.
- **Copy-on-write caro**: após um `fork`, escrever 1 byte pode copiar 2 MiB em vez de 4 KiB.

Por isso Redis, MongoDB e vários bancos recomendam THP `never` ou `madvise`. Para a JVM, o meio-termo comum é `madvise` no sistema e `-XX:+UseTransparentHugePages` na aplicação: o heap Java, grande, contíguo e acessado de forma espalhada pelo GC, é o caso ideal para huge pages, e o resto do sistema não é afetado.

## Exemplo: Contando page faults de dentro de um programa Java

No Linux, `/proc/self/stat` expõe os contadores de page faults do processo (campos 10, `minflt`, e 12, `majflt`). O programa abaixo mede quantos faults acontecem ao tocar memória nova.

```java
import java.nio.file.Files;
import java.nio.file.Path;

public class ContaFaults {
    static long[] faults() throws Exception {
        String stat = Files.readString(Path.of("/proc/self/stat"));
        // o campo 2 (nome) vem entre parênteses e pode ter espaços: parte depois do último ')'
        String[] f = stat.substring(stat.lastIndexOf(')') + 2).split(" ");
        return new long[] { Long.parseLong(f[7]), Long.parseLong(f[9]) }; // campos 10 e 12
    }

    public static void main(String[] args) throws Exception {
        int mb = args.length > 0 ? Integer.parseInt(args[0]) : 512;
        long[] antes = faults();
        byte[][] blocos = new byte[mb][];
        for (int i = 0; i < mb; i++) {
            blocos[i] = new byte[1024 * 1024];
            for (int j = 0; j < blocos[i].length; j += 4096) blocos[i][j] = 1; // toca cada página
        }
        long[] depois = faults();
        System.out.printf("minor: %d  major: %d  (≈ %d páginas de 4 KiB em %d MB)%n",
                depois[0] - antes[0], depois[1] - antes[1], mb * 256L, mb);
    }
}
```

Executado com `java -Xmx1g ContaFaults.java 512`, espera-se algo na ordem de 131.072 minor faults (512 MB / 4 KiB) e zero major faults. Se o resultado for centenas de vezes menor, provavelmente o THP está ativo e cada fault preencheu 2 MiB. Com `-Xms1g -XX:+AlwaysPreTouch`, o número cai quase a zero: a JVM já tocou o heap inteiro na inicialização. No Windows, rode em WSL 2 ou Docker; nativamente, o Gerenciador de Tarefas e o Process Explorer mostram "Page faults" (somando minor e major).

## Swap, substituição de páginas e thrashing

Quando a RAM acaba, o kernel precisa liberar frames. Páginas de arquivo limpas podem ser descartadas (relidas depois do arquivo); páginas de arquivo sujas são gravadas antes; páginas **anônimas** (heap, stack) só podem sair se houver **swap**, uma área de disco para guardá-las.

Escolher a vítima é o problema de **substituição de páginas**. O ótimo teórico (Bélády) é expulsar a página que será usada mais longe no futuro, o que é impossível na prática. Aproximações:

- **FIFO**: expulsa a mais antiga. Simples, mas ignora uso, e sofre da **anomalia de Bélády** (mais frames podem gerar mais faults).
- **LRU**: expulsa a usada há mais tempo. Boa aproximação, mas manter a ordem exata a cada acesso é caro demais em hardware.
- **Clock / segunda chance**: percorre os frames em círculo usando o bit Accessed; se estiver ligado, desliga e dá outra chance. O Linux usa listas *active/inactive* (e, a partir do 6.1, opcionalmente o MGLRU), que são refinamentos dessa ideia.

`vm.swappiness` (padrão 60) ajusta o quanto o kernel prefere expulsar páginas anônimas versus page cache.

**Thrashing** é o colapso que acontece quando o **working set** (o conjunto de páginas que os processos usam ativamente) é maior que a RAM: cada página trazida expulsa outra que logo será necessária. O sistema passa a maior parte do tempo esperando o disco. Sintomas: taxa alta de major faults (`sar -B`, `/usr/bin/time -v`), colunas `si`/`so` (swap in/out) não nulas e constantes no `vmstat 1`, CPU ociosa em *iowait*, e a métrica PSI de memória (`/proc/pressure/memory`) alta.

Para a JVM, swap é especialmente ruim: o GC percorre os objetos vivos do heap inteiro, então páginas do heap que foram para o swap voltam todas durante a marcação, e uma pausa de 50 ms pode virar dezenas de segundos. Em servidores Java, a recomendação usual é dimensionar heap e memória nativa para caber na RAM e tratar swap como sinal de alerta, não como memória extra. O Kubernetes, por muito tempo, exigiu swap desligado nos nós.

## Custos, limitações e uso em sistemas reais

- **Custo da tradução**: amortizado pela TLB. Cargas com acesso aleatório a muita memória sofrem com TLB misses; huge pages são a ferramenta principal.
- **Custo do primeiro toque**: demand paging torna a alocação barata e o primeiro acesso caro. `-XX:+AlwaysPreTouch` antecipa os faults do heap para a inicialização (inicialização mais lenta, latência mais estável). Bancos de dados fazem o mesmo com seus buffer pools.
- **Memória das page tables**: processos com dezenas de GB mapeados com páginas de 4 KiB gastam dezenas de MB só em page tables (8 bytes por página de 4 KiB, ou ~2 MiB por GiB mapeado). Muitos processos mapeando a mesma memória compartilhada multiplicam esse custo, o que também é um argumento para huge pages.
- **Latência imprevisível**: major faults, compactação do THP e TLB shootdowns aparecem como picos de p99 difíceis de explicar sem olhar métricas do SO.
- **Observabilidade**: `perf stat -e page-faults,minor-faults,major-faults,dTLB-load-misses`, `/usr/bin/time -v`, `vmstat`, `sar -B` e PSI são as ferramentas para conectar sintomas da aplicação ao paging.

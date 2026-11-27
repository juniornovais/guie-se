## O problema que o address space resolve

No tópico 1.2.6 vimos que cada processo enxerga uma **memória virtual** própria, traduzida pela MMU para memória física. Mas "memória virtual" é só o mecanismo. A pergunta prática é: **quais endereços virtuais um processo pode usar, para quê, e com quais permissões?** A resposta é o **address space** (espaço de endereçamento) do processo.

O address space não é um bloco uniforme. Ele é um conjunto de **regiões** (no Linux, *VMAs — virtual memory areas*), cada uma com:

- um intervalo de endereços `[início, fim)`, sempre alinhado a páginas;
- **permissões**: leitura (`r`), escrita (`w`), execução (`x`);
- uma **origem**: um arquivo (o executável, uma biblioteca, um arquivo mapeado com `mmap`) ou memória **anônima** (preenchida com zeros, sem arquivo por trás);
- um modo de compartilhamento: **privado** (cópia própria, *copy-on-write*) ou **compartilhado** com outros processos.

Tudo o que está fora dessas regiões é **não mapeado**. Acessar um endereço não mapeado, ou violar a permissão de uma região, faz a MMU gerar uma exceção que o kernel transforma em `SIGSEGV`: o famoso *segmentation fault*.

Esse desenho resolve três problemas de uma vez: **isolamento** (um processo não enxerga o outro), **proteção** (código não pode ser sobrescrito, dados não podem ser executados) e **flexibilidade** (o heap, as stacks e os mapeamentos crescem e encolhem de forma independente).

## Tamanho do address space: 32 vs. 64 bits

O tamanho máximo do address space é dado pela largura do endereço virtual.

**32 bits:** 2³² = 4 GiB de endereços, no total. E nem tudo é do processo: o kernel reserva uma parte para si. No Linux 32 bits, o padrão é a divisão **3 GiB usuário / 1 GiB kernel**. No Windows 32 bits, 2 GiB / 2 GiB (3 GiB com a opção `/3GB` e executáveis *large address aware*). Por isso um processo 32 bits nunca usa mais que ~2–4 GiB, **não importa quanta RAM a máquina tenha**. Pior: as regiões precisam caber em pedaços contíguos. Uma JVM 32 bits no Windows raramente conseguia `-Xmx` acima de ~1,4–1,6 GB, porque o heap Java precisa de um intervalo contíguo e as DLLs carregadas fragmentavam o espaço.

**64 bits:** os registradores têm 64 bits, mas o hardware x86-64 atual usa **48 bits** de endereço virtual (endereços "canônicos": os bits 63–48 repetem o bit 47). Isso dá 256 TiB, divididos em duas metades:

| Faixa | Uso |
|---|---|
| `0x0000_0000_0000_0000` – `0x0000_7FFF_FFFF_FFFF` | user space (128 TiB) |
| `0x0000_8000_0000_0000` – `0xFFFF_7FFF_FFFF_FFFF` | buraco não canônico (acesso gera falha) |
| `0xFFFF_8000_0000_0000` – `0xFFFF_FFFF_FFFF_FFFF` | kernel space (128 TiB) |

CPUs com *5-level paging* (LA57) estendem para 57 bits (128 PiB no total). Em 64 bits, o limite deixa de ser o espaço de endereços e passa a ser a RAM física, o swap e as políticas de *overcommit* do kernel.

## Diagrama: Layout de um processo Linux x86-64

```text
 0xFFFFFFFFFFFFFFFF ┌─────────────────────────────────────┐
                    │ kernel space (inacessível em modo   │  mapeado em todo processo,
                    │ usuário: bit U/S = supervisor)       │  protegido pelas page tables
 0xFFFF800000000000 ├─────────────────────────────────────┤
                    │ buraco não canônico                  │
 0x00007FFFFFFFFFFF ├─────────────────────────────────────┤
                    │ [stack] da thread principal   rw-    │  cresce para baixo ↓
                    │   (args, envp, auxv no topo)         │
                    │ ... guard gap ...                    │
                    ├─────────────────────────────────────┤
                    │ região de mmap                        │  cresce para baixo ↓
                    │   libc.so, ld.so (r-x, r--, rw-)      │
                    │   stacks de outras threads (rw-)      │
                    │   malloc grande, arquivos mapeados    │
                    │   [vdso] [vvar]                       │
                    ├─────────────────────────────────────┤
                    │ ... espaço livre (enorme em 64 bits) │
                    ├─────────────────────────────────────┤
                    │ [heap] (brk)                  rw-    │  cresce para cima ↑
                    ├─────────────────────────────────────┤
                    │ .bss  (globais não inicializadas) rw-│  anônimo, zerado
                    │ .data (globais inicializadas)    rw- │  do arquivo, privado (CoW)
                    │ .rodata (constantes, literais)   r-- │
                    │ .text (código de máquina)        r-x │
 ~0x555555554000    ├─────────────────────────────────────┤  (executável PIE + ASLR)
                    │ não mapeado (inclui a página 0)      │  NULL cai aqui → SIGSEGV
 0x0000000000000000 └─────────────────────────────────────┘
```

Os endereços exatos variam a cada execução por causa do ASLR. A ordem relativa (executável embaixo, bibliotecas e stack no alto) é a convenção do Linux x86-64.

## As regiões, uma a uma

**`.text` (código), `r-x`.** Instruções de máquina do executável. Mapeado do arquivo, compartilhado entre todos os processos que rodam o mesmo binário (o kernel carrega as páginas uma vez no page cache). Sem `w`: código não pode ser modificado por acidente.

**`.rodata`, `r--`.** Constantes, tabelas e **literais de string** do C (`"olá"`). Sem escrita e sem execução. Escrever num literal gera segfault.

**`.data`, `rw-`.** Variáveis globais e `static` com valor inicial diferente de zero. O conteúdo inicial vem do arquivo, mas o mapeamento é **privado**: a primeira escrita numa página faz o kernel copiá-la (*copy-on-write*), e o arquivo nunca é alterado.

**`.bss`, `rw-`.** Globais sem inicialização (ou inicializadas com zero). Não ocupa espaço no arquivo: o loader só registra o tamanho, e o kernel entrega páginas anônimas zeradas.

**Heap (`[heap]`), `rw-`.** A região que cresce com a system call `brk`/`sbrk`, usada pelo `malloc` da glibc para alocações pequenas. Para blocos grandes (acima de ~128 KiB, limiar dinâmico) a glibc usa `mmap` diretamente, e o bloco vai para a região de mmap. Atenção: o "heap" do C não é o heap Java. A JVM reserva seu heap com `mmap`, fora do `[heap]`.

**Região de mmap.** Bibliotecas compartilhadas (cada `.so` aparece em várias linhas, uma por segmento com permissões diferentes), mapeamentos anônimos (alocações grandes, arenas do `malloc`, stacks de threads secundárias) e arquivos mapeados (`MappedByteBuffer` em Java). Também ficam aqui `[vdso]` e `[vvar]`: código e dados que o kernel expõe para que chamadas como `clock_gettime` rodem sem entrar no kernel.

**Stack (`[stack]`), `rw-`.** A stack da thread principal (tópico 1.1.7). Cresce para baixo sob demanda até o limite `ulimit -s` (8 MiB por padrão no Linux). Entre ela e o restante, o kernel mantém um *guard gap*. Stacks de outras threads são mapeamentos anônimos comuns, com uma página de guarda sem permissão (`---p`) no fim.

**Kernel space.** Mapeado em todos os processos, mas as entradas de page table têm o bit *supervisor*: qualquer acesso em modo usuário falha. Assim uma system call não precisa trocar de page table para acessar memória do kernel. Depois da vulnerabilidade Meltdown, o Linux passou a usar **KPTI** (*kernel page-table isolation*): em modo usuário fica mapeado só um mínimo do kernel, ao custo de trocas de page table extras a cada system call.

## Segmentation fault em termos de address space

Um segfault acontece quando a MMU não consegue completar um acesso e o kernel conclui que o acesso é ilegítimo. Há duas causas:

1. **Endereço não mapeado.** Nenhuma VMA cobre o endereço. Exemplos: desreferenciar `NULL` (o Linux nunca mapeia os primeiros 64 KiB, controlados por `vm.mmap_min_addr`), usar ponteiro para memória já liberada com `munmap`, ou estourar a stack até a guard page.
2. **Violação de permissão.** A VMA existe, mas não permite a operação: escrever em `.text` ou `.rodata`, executar dados numa região sem `x`.

O kernel registra o motivo. No `dmesg` aparece algo como `segfault at 55d0c1a2b004 ip ... error 7`: o código de erro é um conjunto de bits da exceção de página do x86 (bit 0 = a página estava presente, isto é, violação de proteção; bit 1 = escrita; bit 2 = modo usuário). `error 7` significa "escrita em modo usuário numa página presente sem permissão de escrita"; `error 4` é "leitura em modo usuário de página não presente".

A JVM usa esse mecanismo a seu favor. O código gerado pelo JIT não testa `if (ref == null)` antes de cada acesso a campo: ele simplesmente lê `[ref + offset]`. Se `ref` é nulo, o acesso cai na página 0, o kernel envia `SIGSEGV`, e o handler de sinais da HotSpot reconhece que a instrução é um *implicit null check* e lança `NullPointerException`. Um segfault "de verdade" na JVM (em código nativo, JNI ou bug da própria JVM) gera o arquivo `hs_err_pid<pid>.log`, que inclui o mapa de memória do processo.

## ASLR e NX: defesas contra exploração

Um ataque clássico de *buffer overflow* sobrescreve o endereço de retorno na stack para desviar a execução. Para funcionar, o atacante precisa saber **para onde** saltar e precisa que o destino seja **executável**. Duas defesas atacam exatamente esses pontos.

**NX / W^X.** O bit NX (*no-execute*, bit 63 da entrada de page table no x86-64) marca páginas como não executáveis. Stack, heap e dados ficam `rw-`; código fica `r-x`. A política W^X ("write xor execute") diz que nenhuma página deveria ser gravável e executável ao mesmo tempo. Isso impede injetar código e executá-lo. Atacantes reagiram com *return-oriented programming* (ROP): reaproveitar trechos de código já existentes e executáveis. Compiladores JIT são uma exceção incômoda: a HotSpot precisa escrever código de máquina e depois executá-lo, e no Linux o code cache costuma aparecer como `rwxp`. Plataformas como macOS em Apple Silicon exigem alternância explícita entre gravável e executável (`MAP_JIT`).

**ASLR** (*address space layout randomization*). O kernel sorteia a base da stack, da região de mmap, do heap (`brk`) e, se o executável for PIE (*position-independent executable*, padrão nas distribuições atuais), do próprio executável. No Linux, `/proc/sys/kernel/randomize_va_space` vale `2` (tudo randomizado), `1` (sem o `brk`) ou `0` (desligado). Sem saber os endereços, o ROP fica muito mais difícil: o atacante precisa primeiro de um **vazamento de informação** (um ponteiro impresso num log, por exemplo) para descobrir a base. ASLR em 64 bits é bem mais forte que em 32, porque há muito mais bits de entropia.

Para depuração, `setarch $(uname -m) -R ./programa` executa um processo com ASLR desligado, e o `gdb` faz isso por padrão.

## Exemplo: Lendo /proc/<pid>/maps e pmap

No Linux, `/proc/<pid>/maps` lista todas as VMAs de um processo. (No Windows, use WSL 2 ou um container Docker, que rodam um kernel Linux; a ferramenta nativa equivalente é o VMMap, do Sysinternals.)

```bash
cat /proc/self/maps        # o próprio cat
```

Saída ilustrativa (encurtada; endereços mudam a cada execução):

```text
55d0c1a00000-55d0c1a02000 r--p 00000000 08:01 1835  /usr/bin/cat
55d0c1a02000-55d0c1a07000 r-xp 00002000 08:01 1835  /usr/bin/cat
55d0c1a07000-55d0c1a09000 r--p 00007000 08:01 1835  /usr/bin/cat
55d0c1a0a000-55d0c1a0b000 rw-p 00009000 08:01 1835  /usr/bin/cat
55d0c2c41000-55d0c2c62000 rw-p 00000000 00:00 0     [heap]
7f3b5c200000-7f3b5c228000 r--p 00000000 08:01 4120  /usr/lib/x86_64-linux-gnu/libc.so.6
7f3b5c228000-7f3b5c3bd000 r-xp 00028000 08:01 4120  /usr/lib/x86_64-linux-gnu/libc.so.6
7f3b5c3bd000-7f3b5c415000 r--p 001bd000 08:01 4120  /usr/lib/x86_64-linux-gnu/libc.so.6
7f3b5c415000-7f3b5c419000 r--p 00214000 08:01 4120  /usr/lib/x86_64-linux-gnu/libc.so.6
7f3b5c419000-7f3b5c41b000 rw-p 00218000 08:01 4120  /usr/lib/x86_64-linux-gnu/libc.so.6
7ffd3e5f0000-7ffd3e611000 rw-p 00000000 00:00 0     [stack]
7ffd3e7a4000-7ffd3e7a8000 r--p 00000000 00:00 0     [vvar]
7ffd3e7a8000-7ffd3e7aa000 r-xp 00000000 00:00 0     [vdso]
```

Colunas: intervalo de endereços; permissões (`r`, `w`, `x` e `p` = privado/CoW ou `s` = compartilhado); offset dentro do arquivo; dispositivo; inode; caminho (vazio para memória anônima). Repare no padrão de um binário ELF: um segmento `r--` (cabeçalhos), um `r-x` (`.text`), um `r--` (`.rodata`) e um `rw-` (`.data`/`.bss`). Uma linha `---p` indica um intervalo **reservado** sem permissão alguma: guard pages ou espaço reservado ainda não utilizado.

`maps` mostra o que está **mapeado**, não o que ocupa RAM. Para isso, use `pmap -x <pid>` ou `/proc/<pid>/smaps`:

```text
Address           Kbytes     RSS   Dirty Mode  Mapping
00007f3a00000000 2097152  412300  412300 rw---   [ anon ]
...
---------------- ------- ------- -------
total kB         4893412  612044  540120
```

`Kbytes` é o tamanho virtual da região; `RSS` (*resident set size*) é quanto dela está em frames físicos agora; `Dirty` é quanto foi modificado e não pode ser simplesmente descartado. Uma região de 2 GiB com 400 MiB residentes é normal: páginas só ocupam RAM depois de tocadas (tópico 1.2.8).

## O mapa de memória de uma JVM

Uma JVM é um processo nativo como qualquer outro, e seu address space contém, além do executável `java` e das bibliotecas (`libjvm.so`, `libc`), várias áreas próprias:

| Área | O que guarda | Tamanho / flag |
|---|---|---|
| **Java heap** | Objetos Java | Reservado contíguo de `-Xmx`; *committed* entre `-Xms` e `-Xmx` |
| **Metaspace** | Metadados de classes (métodos, constant pool) | Cresce sob demanda; `-XX:MaxMetaspaceSize` (ilimitado por padrão) |
| **Compressed class space** | Estruturas `Klass` quando *compressed class pointers* está ativo | Reserva de 1 GiB por padrão (`-XX:CompressedClassSpaceSize`) |
| **Code cache** | Código de máquina gerado pelo JIT | `-XX:ReservedCodeCacheSize`, 240 MiB por padrão com compilação em camadas |
| **Thread stacks** | Uma stack por thread de plataforma, com zonas de guarda | `-Xss` cada (1 MiB padrão no Linux x86-64) |
| **Estruturas do GC** | Card table, remembered sets, bitmaps de marcação | Proporcional ao heap; varia por coletor (G1 costuma usar alguns % do heap) |
| **Direct buffers** | `ByteBuffer.allocateDirect`, usados por NIO e Netty | `-XX:MaxDirectMemorySize` (por padrão, igual ao heap máximo) |
| **Arquivos mapeados** | `FileChannel.map`, JARs, CDS archive | Tamanho do arquivo mapeado |
| **Memória interna** | Tabela de símbolos e strings, arenas do compilador JIT, NMT, JNI | Variável |
| **Bibliotecas nativas** | Código JNI de terceiros (compressão, RocksDB, drivers) | Fora do controle da JVM |

Três estados importam ao ler esses números:

- **Reservado**: intervalo de endereços garantido para a área (via `mmap` com `PROT_NONE`). Não ocupa RAM. No `maps` aparece como `---p`.
- **Committed**: a JVM disse ao SO que vai usar (permissões `rw-`). O SO garante, mas ainda pode não ter entregue frames.
- **Residente (RSS)**: páginas efetivamente tocadas e presentes na RAM. É isso que o `top`, o Gerenciador de Tarefas e o limite de memória do container medem.

O heap Java é reservado inteiro na inicialização porque os coletores dependem de um intervalo contíguo (e, com *compressed oops*, a JVM tenta posicioná-lo em endereços baixos para que referências de 32 bits possam ser descomprimidas com um simples deslocamento de bits).

## Exemplo: Native Memory Tracking

O **NMT** instrumenta as alocações internas da HotSpot e as classifica por área.

```bash
java -XX:NativeMemoryTracking=summary -Xmx512m -jar app.jar
jcmd <pid> VM.native_memory summary scale=MB
```

Saída ilustrativa (encurtada; os números variam por aplicação, versão e coletor):

```text
Total: reserved=2250MB, committed=790MB
-                 Java Heap (reserved=512MB, committed=512MB)
-                     Class (reserved=1030MB, committed=42MB)
                            (classes #9200)
                            (  Metadata:    reserved=64MB, committed=38MB)
                            (  Class space: reserved=1024MB, committed=4MB)
-                    Thread (reserved=152MB, committed=14MB)
                            (thread #150)
-                      Code (reserved=244MB, committed=41MB)
-                        GC (reserved=60MB, committed=60MB)
-                    Symbol (reserved=18MB, committed=18MB)
-                     Other (reserved=64MB, committed=64MB)
-        Shared class space (reserved=16MB, committed=13MB)
-                 Metaspace (reserved=64MB, committed=38MB)
```

Leitura: `Class` mostra ~1 GiB reservado (quase todo é o compressed class space) mas poucos MB committed, e detalha a parte de metadados, que também aparece na categoria `Metaspace` (o formato muda um pouco entre versões do JDK); `Thread` tem 150 stacks de 1 MiB reservadas, mas só a parte tocada é contada como committed; `Other` costuma ser onde aparecem os direct buffers. Comandos úteis: `jcmd <pid> VM.native_memory baseline` e depois `summary.diff`, para ver **o que cresceu** entre dois instantes, ótimo para caçar vazamentos nativos.

Limitações: o NMT tem custo (a documentação da Oracle cita de 5% a 10% de desempenho, mais alguns bytes por alocação), por isso não fica ligado por padrão; ele só enxerga alocações **feitas pela JVM**, não o `malloc` de bibliotecas JNI de terceiros; e *committed* não é igual a RSS. O NMT funciona igualmente no Windows, no macOS e no Linux.

## Por que o RSS de uma JVM é maior que -Xmx

`-Xmx` limita **apenas o heap Java**. O RSS é a soma de tudo o que está residente:

```text
RSS ≈ heap usado (até -Xmx)
    + metaspace + compressed class space
    + code cache
    + stacks das threads (parte tocada)
    + estruturas do GC
    + direct buffers + arquivos mapeados residentes
    + memória interna (símbolos, JIT, ...)
    + malloc de bibliotecas nativas e fragmentação das arenas da glibc
```

Uma aplicação Spring Boot típica com `-Xmx2g` facilmente soma 150–300 MB de metaspace e code cache, dezenas a centenas de MB de stacks e GC, e o que Netty ou o driver do banco alocarem fora do heap. A glibc cria até 8 × núcleos **arenas** de `malloc` (cada uma reservando até 64 MiB) para reduzir contenção entre threads, e a fragmentação delas pode inflar o RSS; `MALLOC_ARENA_MAX=2` é um ajuste comum em containers.

Em containers isso importa muito: o limite de memória do cgroup é aplicado sobre o processo inteiro. Se a soma ultrapassa o limite, o kernel mata o processo (**OOMKilled**, *exit code* 137) sem nenhum `OutOfMemoryError` no log, porque quem morreu foi o processo, não uma alocação Java. Por isso a prática é dimensionar o heap como uma fração do limite (`-XX:MaxRAMPercentage=70`, por exemplo) e reservar o resto para a memória nativa.

## [Adicional] Overcommit e mapeamentos reservados

O Linux, por padrão (`vm.overcommit_memory=0`), aceita reservas muito maiores que a RAM disponível, apostando que nem tudo será tocado. Isso permite à JVM reservar 1 GiB de class space e 240 MiB de code cache sem custo. O lado ruim aparece depois: se as páginas forem realmente tocadas e a RAM acabar, quem resolve é o **OOM killer**, escolhendo um processo para matar. Ambientes que preferem falhar cedo usam `vm.overcommit_memory=2`, em que `mmap` falha quando a soma das reservas *committed* ultrapassa um limite. O Windows não faz overcommit: memória *committed* precisa de respaldo em RAM ou no arquivo de paginação, o que explica por que lá a distinção reservar/commit é explícita na API (`VirtualAlloc` com `MEM_RESERVE` e `MEM_COMMIT`).

## Custos, limitações e uso em sistemas reais

- **Diagnóstico de memória:** em produção, a primeira pergunta diante de "o container está usando demais" é *qual região?*. `pmap -x`, `smaps` e NMT respondem isso; heap dump só cobre o heap Java.
- **Custo de muitas regiões:** cada VMA é uma estrutura no kernel; milhões de mapeamentos (bancos com muitos arquivos mapeados, Elasticsearch, Lucene) esbarram em `vm.max_map_count` (65530 por padrão). O Elasticsearch exige elevar esse valor.
- **32 bits ainda existe** em dispositivos embarcados e aplicações legadas: o teto de ~4 GiB por processo continua real ali.
- **Segurança:** ASLR e NX são camadas de defesa, não garantias. Um vazamento de ponteiro derrota o ASLR; ROP contorna o NX. Por isso existem também *stack canaries*, CFI e linguagens com memória segura, como Java, em que o programador não manipula endereços.
- **JVM em containers:** RSS > `-Xmx` não é vazamento, é o modelo normal. Vazamento é RSS que cresce sem parar, e o `summary.diff` do NMT mostra em qual área.

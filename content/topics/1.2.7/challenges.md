## Desenhar o address space de um processo 64 bits com as regiões e suas permissões

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Regiões do address space", "Permissões rwx", "Kernel space", "32 vs. 64 bits"]}
```

### Enunciado

Considere o programa C abaixo, compilado como executável PIE e executado num Linux x86-64. Desenhe o address space do processo no momento em que a linha `// AQUI` executa e indique, para cada variável e função, em qual região ela está.

```c
#include <stdio.h>
#include <stdlib.h>

int contador = 7;              // (a)
int buffer[1000];              // (b)
const char *saudacao = "oi";   // (c) o ponteiro e (d) o literal

int main(void) {               // (e)
    int local = 1;             // (f)
    char *p = malloc(64);      // (g) o bloco apontado
    char *g = malloc(1 << 20); // (h) o bloco apontado
    printf("%d\n", local);     // (i) printf
    // AQUI
    return 0;
}
```

### Objetivo

Saber descrever as regiões de um address space, suas permissões e sua origem (arquivo ou anônima), e situar o kernel space.

### Instruções

1. Desenhe as regiões em ordem de endereço, do mais baixo ao mais alto, incluindo o kernel space.
2. Para cada região, anote as permissões no formato do `/proc/<pid>/maps` (`r-xp`, `rw-p`, ...) e se ela vem de arquivo ou é anônima.
3. Classifique os itens de (a) a (i).
4. Responda: por que a página do endereço 0 não está mapeada?
5. Responda: se o mesmo programa fosse 32 bits, qual seria o tamanho máximo de address space utilizável em modo usuário no Linux? E em 64 bits (x86-64 com 48 bits)?

### Dicas

- Separe globais inicializadas com valor diferente de zero das não inicializadas.
- `saudacao` é uma variável global (um ponteiro); o texto `"oi"` é outra coisa.
- O `malloc` da glibc não trata da mesma forma 64 bytes e 1 MiB: pense no limiar de `mmap`.

### Critérios de avaliação

- O desenho tem, na ordem: área não mapeada perto de 0, `.text`, `.rodata`, `.data`, `.bss`, `[heap]`, região de mmap (bibliotecas e mapeamentos anônimos), `[stack]` e kernel space.
- Permissões corretas: `.text` `r-x`, `.rodata` `r--`, `.data`/`.bss`/heap/stack `rw-`, e kernel inacessível em modo usuário.
- Classificação correta de (a) a (i), em especial (d) em `.rodata` e (h) na região de mmap.
- Explica a página 0 não mapeada como proteção contra desreferência de `NULL` (`vm.mmap_min_addr`).
- Responde 3 GiB (divisão 3/1 padrão no Linux 32 bits) e 128 TiB em 64 bits.

### Solução de referência

```text
alto  ┌───────────────────────────────────┐
      │ kernel space (U/S = supervisor)   │ inacessível em modo usuário
      ├───────────────────────────────────┤ 0xFFFF800000000000
      │ buraco não canônico               │
      ├───────────────────────────────────┤ 0x00007FFFFFFFFFFF
      │ [stack]              rw-p  anôn.  │ (f) local, p, g (as variáveis)
      │ região de mmap                    │
      │   libc.so .text      r-xp  arq.   │ (i) printf
      │   libc.so .data      rw-p  arq.   │
      │   anônimo 1 MiB      rw-p  anôn.  │ (h) bloco de malloc(1<<20)
      │   [vdso] [vvar]                   │
      ├───────────────────────────────────┤
      │ [heap] (brk)         rw-p  anôn.  │ (g) bloco de malloc(64)
      │ .bss                 rw-p  anôn.  │ (b) buffer[1000]
      │ .data                rw-p  arq.   │ (a) contador, (c) saudacao
      │ .rodata              r--p  arq.   │ (d) "oi"
      │ .text                r-xp  arq.   │ (e) main
      ├───────────────────────────────────┤ ~0x55..., sorteado (PIE + ASLR)
baixo │ não mapeado (inclui a página 0)   │
      └───────────────────────────────────┘
```

- (a) `contador` está em `.data`: tem valor inicial 7, que precisa estar no arquivo.
- (b) `buffer` está em `.bss`: não inicializado, ocupa 4.000 bytes em memória mas zero bytes no arquivo.
- (c) `saudacao` é um ponteiro global inicializado: `.data`. Em executáveis PIE ele precisa de relocação na carga, e o linker pode colocá-lo em `.data.rel.ro` se fosse `const char *const`.
- (d) o literal `"oi"` está em `.rodata`, somente leitura.
- (e) `main` está em `.text`, `r-x`.
- (f) `local`, `p` e `g` (os ponteiros) estão no frame de `main`, em `[stack]`.
- (g) 64 bytes vêm do `[heap]` (arena principal, expandida com `brk`).
- (h) 1 MiB passa do limiar de `mmap` da glibc (~128 KiB): vira um mapeamento anônimo próprio na região de mmap.
- (i) `printf` está no `.text` da `libc.so.6`, na região de mmap.

A página 0 (na verdade os primeiros 64 KiB, por `vm.mmap_min_addr`) nunca é mapeada para que desreferenciar `NULL` (ou `NULL + pequeno offset`, como `p->campo`) gere segfault imediato, em vez de ler ou escrever memória válida silenciosamente. Isso também impede explorar bugs de desreferência nula no kernel.

Em 32 bits o espaço total é 4 GiB, dos quais 3 GiB são do usuário na divisão padrão do Linux (1 GiB fica para o kernel). Em x86-64 com 48 bits, o user space vai até `0x00007FFFFFFFFFFF`, ou seja, 128 TiB.

## Executar o mesmo programa C várias vezes e observar a variação de endereços causada por ASLR

```meta
{"type": "experiment", "level": 2, "required": false, "knowledge": ["ASLR", "PIE", "randomize_va_space", "/proc/self/maps"]}
```

### Enunciado

Escreva um programa C que imprima o endereço de uma função do executável, de uma global, de um bloco do heap, de um bloco grande alocado com `malloc`, de uma função da libc e de uma variável local. Execute-o várias vezes e investigue quais endereços mudam, quais não mudam e por quê.

### Objetivo

Ver o ASLR funcionando, entender o papel do PIE e saber desligar a randomização para depuração.

### Instruções

1. Use um Linux (nativo, WSL 2 ou `docker run --rm -it gcc:13 bash`). Confira `cat /proc/sys/kernel/randomize_va_space`.
2. Escreva o programa e compile com `gcc -O0 -o enderecos enderecos.c`.
3. Execute 5 vezes e monte uma tabela com os endereços.
4. Execute com `setarch $(uname -m) -R ./enderecos` duas vezes. O que acontece?
5. Recompile com `gcc -O0 -no-pie -o enderecos-nopie enderecos.c` e execute 3 vezes. Quais endereços passam a ser fixos?
6. Observe os 12 bits menos significativos dos endereços em todas as execuções. Eles mudam? Por quê?
7. Explique por que um atacante que consegue vazar **um** ponteiro de libc derrota o ASLR para toda a libc.

### Dicas

- O programa pode terminar com `getchar()` para você ter tempo de rodar `cat /proc/<pid>/maps` em outro terminal e conferir em qual região cada endereço cai.
- O ASLR desloca regiões inteiras, e regiões são alinhadas a páginas.
- `-no-pie` gera um executável que só funciona carregado num endereço fixo (tradicionalmente `0x400000`).

### Critérios de avaliação

- O programa compila e imprime os seis endereços com `%p`.
- A tabela mostra que, com PIE e `randomize_va_space=2`, todos os grupos de endereços mudam entre execuções.
- Mostra que `setarch -R` torna os endereços repetíveis.
- Mostra que com `-no-pie` o código e as globais ficam fixos, enquanto stack, mmap e libc continuam variando.
- Explica que o offset dentro da página (12 bits baixos) não muda porque a randomização é feita em granularidade de página.
- Explica que a libc é deslocada em bloco: conhecendo um endereço e o offset fixo da função no arquivo, calcula-se a base e todos os outros símbolos.

### Solução de referência

```c
#include <stdio.h>
#include <stdlib.h>

int global_inicializada = 42;
int global_bss;

int main(void) {
    int local = 0;
    void *pequeno = malloc(32);
    void *grande = malloc(4 << 20);

    printf("main  (text)   %p\n", (void *) main);
    printf("global (data)  %p\n", (void *) &global_inicializada);
    printf("global (bss)   %p\n", (void *) &global_bss);
    printf("heap  (brk)    %p\n", pequeno);
    printf("malloc 4 MiB   %p\n", grande);
    printf("printf (libc)  %p\n", (void *) printf);
    printf("local (stack)  %p\n", (void *) &local);

    getchar();   /* pausa para inspecionar /proc/<pid>/maps */
    free(pequeno);
    free(grande);
    return 0;
}
```

Converter ponteiro de função em `void *` não é ISO C estrito, mas o GCC aceita e é a forma usual de imprimir esses endereços.

Resultado ilustrativo (os valores variam por máquina e execução):

| Execução | `main` | `heap` | `malloc 4 MiB` | `printf` | `local` |
|---|---|---|---|---|---|
| 1 | `0x5581a3c4a1a9` | `0x5581a4e1b2a0` | `0x7f2c8e5ff010` | `0x7f2c8ea60770` | `0x7ffd9b3c1e4c` |
| 2 | `0x55f0d0a191a9` | `0x55f0d16532a0` | `0x7f9a1e1ff010` | `0x7f9a1e660770` | `0x7ffe25a8b6ac` |
| 3 | `0x563b2e6e81a9` | `0x563b2f2d92a0` | `0x7fb4c0dff010` | `0x7fb4c1260770` | `0x7ffc7d0f8b9c` |

- Com PIE e `randomize_va_space=2`, executável, heap, mmap/libc e stack mudam a cada execução, de forma independente entre si (a distância entre `main` e `printf` não é constante).
- Os 12 bits menos significativos (`...1a9`, `...2a0`, `...770`) são sempre iguais: o ASLR escolhe a base de cada região em múltiplos de página (4 KiB), e o offset dentro da região vem do arquivo ou do alocador. A stack é exceção parcial: o Linux também aplica um deslocamento aleatório pequeno dentro da página para o topo da stack, então os bits baixos de `local` podem variar.
- Com `setarch -R`, todos os endereços se repetem entre execuções, o que é útil para depurar e para reproduzir bugs dependentes de endereço. O `gdb` faz isso automaticamente (`set disable-randomization on`).
- Com `-no-pie`, `main` e as globais ficam fixos (por exemplo, `0x401176` e `0x404028`). O `[heap]` começa logo após o `.bss` com um deslocamento aleatório, então ainda varia; mmap, libc e stack continuam randomizados. Em binários não PIE, `(void *) printf` pode mostrar um endereço do próprio executável (a entrada da PLT), e não da libc.
- A libc é mapeada como um bloco: todos os seus segmentos são deslocados pela mesma base aleatória. O atacante conhece pelo arquivo da libc o offset de cada função (por exemplo, `printf` em `0x60770` e `system` em `0x50d70`). Com um ponteiro vazado: `base = vazado − offset_printf` e `system = base + offset_system`. Por isso vazamentos de informação são o primeiro passo de quase todo exploit moderno.

## Diagnosticar um segmentation fault causado por escrita em string literal em região somente leitura

```meta
{"type": "bug_hunt", "level": 2, "required": true, "knowledge": ["Segmentation fault", ".rodata", "Permissões de página", "gdb"]}
```

### Enunciado

O programa abaixo compila sem erros e quebra com `Segmentation fault (core dumped)`. Encontre a causa, prove-a usando o address space do processo e corrija o código.

```c
#include <ctype.h>
#include <stdio.h>

static void maiusculas(char *s) {
    for (; *s != '\0'; s++) {
        *s = (char) toupper((unsigned char) *s);
    }
}

int main(void) {
    char *nome = "guie-se";
    maiusculas(nome);
    puts(nome);
    return 0;
}
```

### Objetivo

Relacionar um segfault com uma violação de permissão numa região específica do address space e saber coletar evidências (endereço, região, código de erro).

### Instruções

1. Compile com `gcc -g -O0 -o maiusc maiusc.c` num Linux (nativo, WSL 2 ou Docker) e confirme o crash.
2. Rode no `gdb` (`gdb ./maiusc`, `run`) e anote a linha e o endereço de `s` no momento da falha (`print s`).
3. Ainda no `gdb`, rode `info proc mappings` e descubra em qual região e com quais permissões esse endereço está.
4. Rode `dmesg | tail` (pode exigir `sudo`; em containers pode não estar disponível) e interprete o campo `error`.
5. Corrija o programa com a mudança mínima e explique por que a correção funciona.
6. Compile com `gcc -Wall -Wwrite-strings` e veja o aviso que teria evitado o bug.

### Dicas

- O endereço de `s` é próximo do endereço de `main` ou da pilha?
- No `info proc mappings`, procure a linha do próprio executável sem `x` e sem `w`.
- `char *p = "..."` e `char p[] = "..."` geram coisas diferentes: um aponta para o literal, o outro cria um array com uma cópia dele.

### Critérios de avaliação

- Identifica que `nome` aponta para um literal de string, que o compilador coloca em `.rodata`.
- Mostra, pelo mapa de memória, que o endereço da falha pertence a um segmento `r--p` do executável.
- Interpreta `error 7` como escrita em modo usuário numa página presente sem permissão de escrita.
- Corrige com `char nome[] = "guie-se";` (ou copia para memória gravável) e explica que o array é criado na stack com uma cópia do literal.
- Menciona `-Wwrite-strings` ou `const char *` como forma de o compilador detectar o problema.

### Solução de referência

No `gdb`:

```text
Program received signal SIGSEGV, Segmentation fault.
0x0000555555555171 in maiusculas (s=0x555555556004 "guie-se") at maiusc.c:6
6               *s = (char) toupper((unsigned char) *s);
(gdb) info proc mappings
          Start Addr           End Addr       Size     Offset  Perms  objfile
      0x555555554000     0x555555555000     0x1000        0x0  r--p   /tmp/maiusc
      0x555555555000     0x555555556000     0x1000     0x1000  r-xp   /tmp/maiusc
      0x555555556000     0x555555557000     0x1000     0x2000  r--p   /tmp/maiusc
      0x555555557000     0x555555558000     0x1000     0x2000  r--p   /tmp/maiusc
      0x555555558000     0x555555559000     0x1000     0x3000  rw-p   /tmp/maiusc
      ...
```

(Saída ilustrativa; os endereços são fixos aqui porque o `gdb` desliga o ASLR.)

O endereço `0x555555556004` está na faixa `0x555555556000–0x555555557000`, com permissões `r--p`: é o segmento que contém `.rodata`. O literal `"guie-se"` foi colocado ali pelo compilador, e `nome` aponta diretamente para ele. A primeira escrita (`*s = 'G'`) tenta gravar numa página sem `w`; a MMU gera uma exceção de página e o kernel, vendo que a VMA não permite escrita, envia `SIGSEGV`.

No `dmesg`: `maiusc[1234]: segfault at 555555556004 ip 0000555555555171 sp 00007fffffffe3e0 error 7 in maiusc[...]`. `error 7` = bits 0, 1 e 2 ligados: página **presente** (violação de proteção, não ausência), operação de **escrita**, em **modo usuário**.

Correção mínima:

```c
int main(void) {
    char nome[] = "guie-se";   /* array na stack, inicializado com cópia do literal */
    maiusculas(nome);
    puts(nome);                /* GUIE-SE */
    return 0;
}
```

Agora `nome` é um array de 8 bytes no frame de `main` (região `[stack]`, `rw-p`). O literal continua em `.rodata`, mas apenas como fonte da cópia.

Em C, o tipo de um literal é `char[]` por razões históricas, embora modificá-lo seja comportamento indefinido. Com `-Wwrite-strings`, o literal passa a ser tratado como `const char[]` e o GCC avisa: `initialization discards 'const' qualifier from pointer target type`. Declarar `const char *nome` levaria o erro para o momento da chamada de `maiusculas`, que espera `char *`. Em Java esse bug não existe nesta forma: `String` é imutável por projeto da linguagem, e não há como obter um ponteiro para os bytes do literal.

## Usar Native Memory Tracking (-XX:NativeMemoryTracking) para mapear as áreas de memória de uma JVM

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["NMT", "jcmd", "Reserved vs committed", "RSS", "Direct buffers", "Thread stacks"]}
```

### Enunciado

Escreva um programa Java que exercite várias áreas de memória da JVM: heap, threads, direct buffers e geração de classes. Rode-o com Native Memory Tracking, colete o resumo por área, compare com o RSS do processo e explique cada número.

### Objetivo

Saber usar o NMT para responder "onde está a memória desta JVM?", distinguindo reservado, committed e residente.

### Instruções

1. Escreva um programa que: aloque cerca de 200 MB em `byte[]` mantidos vivos; crie 200 threads de plataforma que ficam dormindo; aloque 128 MB com `ByteBuffer.allocateDirect`; gere muitas classes de lambda ou proxies (opcional, para ver o metaspace crescer); e depois aguarde (`Thread.sleep`).
2. Execute com `java -Xms512m -Xmx512m -XX:NativeMemoryTracking=summary Areas.java`.
3. Com o processo parado no `sleep`, rode `jcmd <pid> VM.native_memory summary scale=MB` (descubra o PID com `jcmd -l`).
4. Meça o RSS: no Linux, `ps -o rss= -p <pid>` ou `grep VmRSS /proc/<pid>/status`; no Windows, `Get-Process -Id <pid> | Select-Object WorkingSet64` (o *working set* é o equivalente aproximado).
5. Faça um `jcmd <pid> VM.native_memory baseline` no início e um `summary.diff` no fim de uma fase de crescimento (por exemplo, criando mais 100 threads) e identifique o que cresceu.
6. Monte uma tabela por área: reservado, committed, e sua explicação.
7. Explique por que o total committed do NMT não bate exatamente com o RSS.

### Dicas

- `-Xms` igual a `-Xmx` faz o heap inteiro ficar committed, mas não necessariamente residente.
- Direct buffers aparecem na categoria `Other` do NMT.
- Para a categoria `Thread`, compare o reservado com 200 × `-Xss`.
- O RSS inclui coisas que o NMT não rastreia: código das bibliotecas compartilhadas, arquivos mapeados, `malloc` de bibliotecas nativas e fragmentação do alocador.

### Critérios de avaliação

- O programa roda e exercita heap, threads e direct buffers.
- Coleta o resumo do NMT e o RSS do mesmo instante.
- Explica `Java Heap` (512 MB committed, mas residente só o que foi tocado).
- Explica `Class`/`Metaspace` (reserva de ~1 GB do compressed class space, committed pequeno).
- Explica `Thread` (reservado ≈ número de threads × `-Xss`, committed bem menor) e `Other` (~128 MB de direct buffers).
- Usa `baseline` e `summary.diff` para mostrar o crescimento de uma área.
- Explica a diferença entre committed e RSS (páginas não tocadas, memória fora do NMT, páginas compartilhadas).

### Solução de referência

```java
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.function.Supplier;

public class Areas {
    static final List<Object> vivos = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        // Heap: ~200 MB em arrays de 1 MB (alocação zera a memória, então as páginas são tocadas)
        for (int i = 0; i < 200; i++) vivos.add(new byte[1024 * 1024]);

        // Direct buffers: 128 MB fora do heap
        for (int i = 0; i < 128; i++) vivos.add(ByteBuffer.allocateDirect(1024 * 1024));

        // Metaspace: classes geradas para lambdas distintas via proxies dinâmicos
        for (int i = 0; i < 2000; i++) {
            Class<?> iface = Supplier.class;
            Object proxy = java.lang.reflect.Proxy.newProxyInstance(
                    new ClassLoader(Areas.class.getClassLoader()) {},   // loader novo = classe nova
                    new Class<?>[] {iface},
                    (p, m, a) -> null);
            vivos.add(proxy);
        }

        // Thread stacks: 200 threads de plataforma bloqueadas
        CountDownLatch nunca = new CountDownLatch(1);
        for (int i = 0; i < 200; i++) {
            Thread t = new Thread(() -> {
                try { nunca.await(); } catch (InterruptedException ignored) { }
            }, "dorminhoca-" + i);
            t.setDaemon(true);
            t.start();
        }

        System.out.println("PID " + ProcessHandle.current().pid() + " pronto; rode o jcmd agora");
        Thread.sleep(Long.MAX_VALUE);
    }
}
```

Saída de `jcmd <pid> VM.native_memory summary scale=MB` obtida numa execução (JDK 21, G1, `-Xms512m -Xmx512m`; encurtada; os números variam por versão, SO e máquina):

```text
Total: reserved=2278MB, committed=758MB
-                 Java Heap (reserved=512MB, committed=512MB)
-                     Class (reserved=1029MB, committed=9MB)
                            (classes #2834)
                            (  Metadata:   )
                            (    reserved=64MB, committed=9MB)
                            (  Class space:)
                            (    reserved=1024MB, committed=4MB)
-                    Thread (reserved=222MB, committed=14MB)
-                      Code (reserved=242MB, committed=8MB)
-                        GC (reserved=52MB, committed=52MB)
-                  Internal (reserved=2MB, committed=2MB)
-                     Other (reserved=128MB, committed=128MB)
-                    Symbol (reserved=2MB, committed=2MB)
-        Shared class space (reserved=16MB, committed=13MB)
-                    Module (reserved=6MB, committed=6MB)
-                 Metaspace (reserved=64MB, committed=9MB)
```

Interpretação:

| Área | Reservado | Committed | Explicação |
|---|---|---|---|
| Java Heap | 512 | 512 | `-Xms512m -Xmx512m`: todo committed; residente ≈ os ~200 MB tocados + o que o GC usou |
| Class / Metaspace | ~1 GB + 64 MB | ~13 MB | Reserva fixa de 1 GB do compressed class space mais o espaço de metadados; o committed cresce com as classes carregadas, incluindo as ~2.000 classes de proxy |
| Thread | ~222 | ~14 | ~221 threads (200 nossas + as da JVM) × 1 MB reservados; só as poucas páginas tocadas de cada stack contam |
| Code | ~242 | ~8 | `ReservedCodeCacheSize` padrão; pouco código compilado num programa curto |
| GC | ~52 | ~52 | Estruturas do G1 (remembered sets, bitmaps), proporcionais ao heap |
| Other | 128 | 128 | Os direct buffers |

Com `baseline` antes de criar mais 100 threads e `summary.diff` depois, a linha `Thread` mostra algo como `reserved=314MB +102MB, committed=18MB +6MB` e `(thread #321 +100)`: cada thread reserva 1 MB, mas só toca algumas páginas.

RSS ilustrativo: ~420 MB. Ele é **menor** que o committed (758 MB) porque o heap foi comprometido mas apenas parte dele foi tocada: páginas committed e nunca escritas não têm frame físico. Ao mesmo tempo, o RSS inclui coisas fora do NMT: o código de `libjvm.so` e das outras bibliotecas (dezenas de MB, compartilháveis com outros processos), o CDS archive mapeado, o `malloc` feito por bibliotecas nativas e a fragmentação das arenas da glibc. Com `-XX:+AlwaysPreTouch`, o heap inteiro seria tocado na inicialização e o RSS passaria de 512 MB logo no início.

## Explicar por que uma JVM com -Xmx2g pode ocupar 3 GB de RSS em um container

```meta
{"type": "interview", "level": 4, "required": false, "knowledge": ["RSS", "Memória nativa da JVM", "cgroups", "OOMKilled", "MaxRAMPercentage", "NMT"]}
```

### Enunciado

Numa entrevista para uma vaga sênior, você recebe o cenário: *"Nosso serviço Spring Boot roda no Kubernetes com limite de 3 GiB e `-Xmx2g`. De tempos em tempos o pod é reiniciado com OOMKilled, mas nunca aparece `OutOfMemoryError` no log. O heap, segundo as métricas, nunca passa de 1,6 GB. O que está acontecendo, como você investiga e como corrige?"*

### Objetivo

Construir uma explicação completa, de sênior, ligando address space, memória nativa da JVM, RSS e limites de cgroup, com um plano de diagnóstico e correção.

### Instruções

1. Explique por que não há `OutOfMemoryError` no log.
2. Liste as áreas de memória que somam ao RSS além do heap, com ordens de grandeza plausíveis.
3. Descreva um plano de diagnóstico passo a passo, com as ferramentas e comandos.
4. Proponha correções e explique os trade-offs de cada uma.
5. Diferencie "RSS alto e estável" de "vazamento de memória nativa".

### Dicas

- Quem mata o processo no OOMKilled? A JVM fica sabendo?
- O limite do container é aplicado a qual métrica, e a quê dentro do processo?
- Pense em Netty/NIO, número de threads, metaspace de uma aplicação Spring e no alocador da glibc.
- Para comparar dois momentos, existe um comando específico do NMT.

### Critérios de avaliação

- Explica que o OOMKilled vem do kernel (OOM killer do cgroup, sinal 9, exit code 137) quando o uso de memória do cgroup ultrapassa o limite, sem passar pela JVM.
- Explica que `-Xmx` limita só o heap Java e lista pelo menos cinco outras áreas (metaspace, code cache, stacks, GC, direct buffers, arquivos mapeados, malloc nativo/arenas).
- Apresenta diagnóstico com NMT (`summary`, `baseline`, `summary.diff`), `pmap -x`/`smaps` e métricas do cgroup.
- Propõe correções concretas (heap como fração do limite com `MaxRAMPercentage`, `MaxDirectMemorySize`, limitar threads, `MALLOC_ARENA_MAX`, aumentar o limite) com trade-offs.
- Distingue RSS alto e estável (normal) de crescimento contínuo de uma área (vazamento).

### Solução de referência

**Por que não há OutOfMemoryError.** `OutOfMemoryError` é lançado pela JVM quando *ela* não consegue alocar (heap cheio após GC, metaspace no limite, direct memory no limite). O OOMKilled é outra coisa: o cgroup do container contabiliza toda a memória do processo, e quando ela ultrapassa o limite e o kernel não consegue recuperar páginas, o **OOM killer** envia `SIGKILL`. A JVM morre sem executar nada, por isso não há log nem heap dump, e o Kubernetes registra exit code 137 (128 + 9).

**O que soma ao RSS.** `-Xmx2g` limita apenas o heap Java. O RSS é a soma de todas as regiões residentes do address space. Ordens de grandeza plausíveis para um serviço Spring Boot:

| Área | Ordem de grandeza |
|---|---|
| Heap Java | até 2 GB (o heap committed pode ficar perto de `-Xmx` mesmo com uso de 1,6 GB) |
| Metaspace + class space | 100–250 MB (Spring, Hibernate e proxies geram muitas classes) |
| Code cache | 50–240 MB |
| Stacks de threads | 200–500 threads (Tomcat, pools de conexão, Kafka...) × parte tocada de 1 MB |
| GC (G1) | alguns % do heap: 50–150 MB |
| Direct buffers | Netty, NIO, drivers: dezenas a centenas de MB; limite padrão igual a `-Xmx` |
| Malloc nativo | zlib, SSL, bibliotecas JNI, arenas e fragmentação da glibc |
| Arquivos mapeados | JARs, CDS; contam quando residentes |

Somando, 2 GB de heap + 600 MB a 1 GB de nativo chega facilmente a 3 GiB.

**Diagnóstico.**

1. Confirmar o motivo: `kubectl describe pod` (`OOMKilled`, exit 137) e as métricas de memória do container (`container_memory_working_set_bytes`).
2. Reproduzir num ambiente de teste com `-XX:NativeMemoryTracking=summary` e coletar `jcmd <pid> VM.native_memory summary scale=MB` para ver a distribuição por área.
3. Fazer `jcmd <pid> VM.native_memory baseline` com a aplicação aquecida e, horas depois, `summary.diff`: a área que cresce sem parar é a suspeita.
4. Se o total do NMT for bem menor que o RSS, a memória está fora da JVM: `pmap -x <pid>` ou `/proc/<pid>/smaps` mostrando muitas regiões anônimas de 64 MB (arenas da glibc) ou crescimento de `malloc` de bibliotecas nativas. Ferramentas como jemalloc com profiling ou async-profiler (modo nativo) ajudam a achar quem aloca.
5. Verificar direct buffers via JMX (`BufferPoolMXBean`, pool `direct`) e o número de threads (`jcmd <pid> Thread.print` ou métricas `jvm_threads_live`).

**Correções e trade-offs.**

- **Dimensionar o heap como fração do limite**: `-XX:MaxRAMPercentage=65` a `75` em vez de `-Xmx` fixo. Deixa ~25–35% para memória nativa. Custo: menos heap, mais GC.
- **Limitar direct memory**: `-XX:MaxDirectMemorySize=256m`. Transforma um OOMKilled silencioso em `OutOfMemoryError: Cannot reserve direct buffer memory`, que é diagnosticável.
- **Limitar threads**: pools com tamanho máximo, ou virtual threads para I/O bloqueante (tópico 4.4.11), que não têm stacks nativas de 1 MB.
- **Limitar code cache e metaspace** (`-XX:ReservedCodeCacheSize`, `-XX:MaxMetaspaceSize`): evita crescimento ilimitado, mas um limite baixo demais causa desotimização ou `OutOfMemoryError: Metaspace`.
- **Reduzir arenas da glibc**: `MALLOC_ARENA_MAX=2` reduz fragmentação, com algum custo de contenção em alocações nativas muito concorrentes. Alternativa: usar jemalloc.
- **Aumentar o limite do container**: às vezes a resposta honesta é que a aplicação precisa de 3,5 GiB.

**Estável vs. vazamento.** RSS de 2,8 GB estável por dias com `-Xmx2g` é o comportamento normal e só exige limite compatível. Vazamento nativo é uma área que cresce monotonicamente no `summary.diff` (por exemplo, `Other` crescendo por direct buffers nunca liberados, `Thread` crescendo por threads criadas e nunca encerradas, ou RSS crescendo fora do NMT por `malloc` de biblioteca JNI). Nesse caso aumentar o limite só adia o próximo OOMKilled.

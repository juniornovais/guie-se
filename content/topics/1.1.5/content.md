## Por que a construção de um programa tem fases

Quando você digita `gcc main.c calc.c -o app`, parece que um único programa transformou C em executável. Na verdade, o `gcc` é um **driver**: ele orquestra quatro ferramentas diferentes, cada uma com entrada e saída bem definidas. Rode `gcc -v main.c` e você verá as chamadas a `cc1` (pré-processador e compilador), `as` (assembler) e `collect2`/`ld` (linker).

Essa divisão não é acidente histórico; ela resolve três problemas reais:

1. **Compilação separada.** Um projeto grande tem milhares de arquivos. Se cada mudança exigisse recompilar tudo, o ciclo de desenvolvimento seria inviável. Com fases separadas, cada arquivo `.c` é compilado **sozinho**, como uma **unidade de tradução**, gerando um *object file* (`.o`). Mudou um arquivo? Recompila só ele e refaz o linking.
2. **Reuso de código já compilado.** Bibliotecas (a libc, a OpenSSL, a zlib) são distribuídas já compiladas. Seu programa só precisa conhecer as **declarações** delas (os headers) e, no fim, ser **ligado** a elas.
3. **Separação de responsabilidades.** O compilador entende C; o assembler entende a codificação de instruções da CPU; o linker entende como juntar pedaços de código e resolver nomes. Cada ferramenta pode evoluir e ser trocada (por exemplo, o linker `mold` ou o `lld` no lugar do `ld` do binutils).

O preço da compilação separada é que, ao compilar `main.c`, o compilador **não sabe onde** estarão as funções de `calc.c` nem da libc. Ele deixa "buracos" marcados no código, e alguém precisa preenchê-los depois. Esse alguém é o linker, e entender esse mecanismo explica erros como `undefined reference`, a diferença entre bibliotecas estáticas e dinâmicas e, no mundo Java, erros como `NoSuchMethodError`.

## Diagrama: A cadeia de build com gcc

```text
 main.c   calc.h
   │        │  #include copia o header para dentro
   ▼        ▼
 ┌───────────────────┐  gcc -E main.c -o main.i
 │ 1. Preprocessing  │  (cpp: expande #include, #define, #ifdef)
 └────────┬──────────┘
          ▼ main.i   C puro, sem diretivas (texto)
 ┌───────────────────┐  gcc -S main.i -o main.s
 │ 2. Compiling      │  (cc1: análise, otimização, geração de assembly)
 └────────┬──────────┘
          ▼ main.s   assembly da arquitetura-alvo (texto)
 ┌───────────────────┐  gcc -c main.s -o main.o   (ou: as main.s -o main.o)
 │ 3. Assembling     │  (as: codifica instruções em bytes)
 └────────┬──────────┘
          ▼ main.o   object file ELF relocável (binário)
          │                 calc.o ◀── (mesmo caminho para calc.c)
          │                   │       crt1.o, crti.o ◀── código de início (_start)
          ▼                   ▼       libc (.so ou .a)
 ┌──────────────────────────────────────────┐  gcc main.o calc.o -o app
 │ 4. Linking (ld)                          │  resolve símbolos, aplica relocations,
 │                                          │  junta seções, define o entry point
 └────────┬─────────────────────────────────┘
          ▼
         app   executável ELF (PIE), pronto para o loader do SO
```

As três primeiras fases trabalham **um arquivo de cada vez**. Só o linking enxerga o programa inteiro.

## Preprocessing: manipulação de texto

O pré-processador não entende C: ele manipula **texto** seguindo diretivas que começam com `#`.

- `#include "calc.h"` copia literalmente o conteúdo do arquivo naquele ponto. `#include <stdio.h>` faz o mesmo, buscando nos diretórios de sistema (`-I` adiciona diretórios).
- `#define DOBRO(x) ((x) * 2)` define uma **macro**: toda ocorrência de `DOBRO(3)` vira `((3) * 2)` antes de o compilador ver o código.
- `#ifdef`, `#if`, `#ifndef` incluem ou removem blocos de texto (compilação condicional por plataforma, por modo debug, etc.).
- *Include guards* (`#ifndef CALC_H / #define CALC_H / ... / #endif`) evitam que o mesmo header seja colado duas vezes na mesma unidade de tradução.

Com `gcc -E main.c -o main.i`, você vê o resultado. Um `main.c` de 10 linhas que inclui `<stdio.h>` vira um `.i` de centenas de linhas (com glibc, algo como 700 a 800), porque o header inteiro, e os headers que ele inclui, foram copiados. As linhas que começam com `# 1 "main.c"` são **linemarkers**, que permitem ao compilador reportar erros com o arquivo e a linha originais.

Custos e limitações:

- **Tempo de build.** Cada unidade de tradução reprocessa todos os headers que inclui. Em C++, headers da biblioteca padrão e de templates fazem um arquivo pequeno virar centenas de milhares de linhas; é a principal causa de builds lentos em C++ (e a motivação de *precompiled headers* e de *modules* do C++20).
- **Macros são substituição textual sem tipos.** `#define QUADRADO(x) x * x` faz `QUADRADO(1 + 2)` virar `1 + 2 * 1 + 2`, que vale 5. Daí a regra de parentizar tudo, e a preferência moderna por funções `static inline` e constantes `const`/`enum`.

Java não tem pré-processador. O que cumpre papéis parecidos é o próprio compilador: `import` só cria um apelido de nome (não copia código), constantes `static final` são dobradas pelo javac e `if (DEBUG)` com constante falsa remove código (tópico 1.1.4).

## Compiling: de C para assembly

Na segunda fase, o `cc1` faz tudo o que foi descrito no tópico 1.1.4: análise léxica, sintática e semântica, geração de IR, otimizações (controladas por `-O0`, `-O2`, `-O3`, `-Os`) e geração de código. A saída de `gcc -S` é **assembly em texto**, específico da arquitetura (x86-64, ARM64...).

O ponto crucial é o que o compilador faz com nomes que **não estão definidos** naquela unidade de tradução. Em `main.c`, `somar` foi apenas **declarada** (pelo protótipo em `calc.h`), e `printf` também. O compilador confia na declaração para checar tipos e gerar a chamada, mas não tem o código delas. Ele gera simplesmente:

```asm
    movl    $4, %esi          # segundo argumento
    movl    $6, %edi          # primeiro argumento: DOBRO(3) já virou 6 (constant folding)
    call    somar@PLT         # "chame somar, onde quer que ela esteja"
```

Distinguir **declaração** de **definição** é fundamental para entender o linking:

- **Declaração** (`int somar(int, int);`, `extern int chamadas;`) diz "isso existe em algum lugar, com este tipo". Pode aparecer quantas vezes quiser.
- **Definição** (`int somar(int a, int b) { ... }`, `int chamadas = 0;`) cria a função ou reserva a memória da variável. Deve existir **exatamente uma vez** no programa inteiro (a *one definition rule*).

Se o protótipo estiver errado (declarado como `int somar(int, int)` mas definido como `double somar(double, double)` em outro arquivo), nenhum dos dois compiladores percebe, porque cada um vê só seu arquivo, e o linker C não confere tipos. O resultado é um bug silencioso em runtime. Por isso o arquivo `.c` que define as funções deve incluir o próprio header: assim o compilador compara declaração e definição.

## Assembling e o object file

O assembler (`as`) traduz cada instrução de assembly para seus bytes de máquina e produz um **object file relocável**. No Linux, o formato é **ELF** (*Executable and Linkable Format*); no Windows, **COFF/PE**; no macOS, **Mach-O**. O conteúdo é organizado em **seções**:

| Seção | Conteúdo |
|---|---|
| `.text` | Código de máquina das funções |
| `.data` | Variáveis globais/estáticas **inicializadas com valor diferente de zero** |
| `.bss` | Variáveis globais/estáticas **zeradas ou não inicializadas**. Ocupa zero bytes no arquivo; só registra o tamanho, e o loader entrega páginas zeradas |
| `.rodata` | Constantes somente leitura, como literais de string |
| `.symtab` | **Tabela de símbolos**: nomes definidos aqui e nomes usados aqui mas definidos fora |
| `.rela.text` | **Relocations**: lista dos "buracos" no `.text` que o linker precisa preencher |

A **tabela de símbolos** lista cada nome global com seu status. Você a lê com `nm`:

- `T`/`t`: definido no `.text` (função); `D`/`d`: no `.data`; `B`/`b`: no `.bss`; `R`/`r`: no `.rodata`;
- letra **maiúscula** = símbolo **global** (visível para outros object files); **minúscula** = **local** (declarado `static` em C, invisível fora do arquivo);
- `U`: **undefined**, usado aqui mas definido em outro lugar.

As **relocations** são o mecanismo dos "buracos". Como o assembler não sabe o endereço final de `somar`, ele emite `call` com deslocamento `00 00 00 00` e registra: "no offset 0x13 do `.text`, escreva o endereço relativo de `somar`, menos 4". Isso é uma entrada do tipo `R_X86_64_PLT32`. Para acessar a variável `chamadas`, o registro é `R_X86_64_PC32` (endereçamento relativo ao `rip`, usado em código independente de posição).

## Exemplo: Dissecando object files com nm e objdump

Considere três arquivos:

```c
/* calc.h */
#ifndef CALC_H
#define CALC_H

#define DOBRO(x) ((x) * 2)

int somar(int a, int b);
extern int chamadas;

#endif
```

```c
/* calc.c */
#include "calc.h"

int chamadas = 0;          /* global zerada: vai para .bss */
static int ultimo;         /* static: símbolo local */

int somar(int a, int b) {
    chamadas++;
    ultimo = a + b;
    return ultimo;
}
```

```c
/* main.c */
#include <stdio.h>
#include "calc.h"

static const char *MSG = "resultado";

int main(void) {
    int r = somar(DOBRO(3), 4);
    printf("%s = %d (chamadas: %d)\n", MSG, r, chamadas);
    return 0;
}
```

```bash
gcc -c main.c -o main.o
gcc -c calc.c -o calc.o
nm main.o
nm calc.o
objdump -d -r main.o
```

Saída ilustrativa (gcc 15, x86-64 Linux; endereços e offsets podem variar):

```text
$ nm main.o
0000000000000000 d MSG          ← variável static de main.c (local, .data)
                 U chamadas     ← usada aqui, definida em outro lugar
0000000000000000 T main         ← definida aqui, global
                 U printf       ← virá da libc
                 U somar        ← virá de calc.o

$ nm calc.o
0000000000000000 B chamadas     ← global em .bss (inicializada com zero)
0000000000000000 T somar
0000000000000004 b ultimo       ← static: local, offset 4 no .bss

$ objdump -d -r main.o
0000000000000000 <main>:
   0:  55                      push   %rbp
   1:  48 89 e5                mov    %rsp,%rbp
   4:  48 83 ec 10             sub    $0x10,%rsp
   8:  be 04 00 00 00          mov    $0x4,%esi
   d:  bf 06 00 00 00          mov    $0x6,%edi
  12:  e8 00 00 00 00          call   17 <main+0x17>
                 13: R_X86_64_PLT32   somar-0x4
  17:  89 45 fc                mov    %eax,-0x4(%rbp)
  1a:  8b 0d 00 00 00 00       mov    0x0(%rip),%ecx
                 1c: R_X86_64_PC32    chamadas-0x4
  ...
  39:  e8 00 00 00 00          call   3e <main+0x3e>
                 3a: R_X86_64_PLT32   printf-0x4
```

Como ler:

- Os bytes `e8 00 00 00 00` são a instrução `call` com o deslocamento **zerado**: é o buraco. A linha logo abaixo (`13: R_X86_64_PLT32 somar-0x4`) é a relocation que diz como preenchê-lo. O `-0x4` compensa o fato de o deslocamento de um `call` ser relativo ao fim da instrução.
- `mov $0x6,%edi`: a macro `DOBRO(3)` foi expandida pelo pré-processador e o `3 * 2` foi dobrado pelo compilador.
- `ultimo` e `MSG` têm letras minúsculas: por serem `static`, não podem ser usadas por outros arquivos, e por isso dois arquivos diferentes podem ter, cada um, seu `static int ultimo` sem conflito.

Depois do linking (`gcc main.o calc.o -o app`), `nm app` mostra `somar` e `chamadas` com endereços reais, e `printf` continua `U`: ela será resolvida em tempo de carregamento, a partir da libc dinâmica.

## Linking: resolução de símbolos e relocação

O linker trabalha em duas etapas.

**1. Resolução de símbolos.** Ele percorre os object files e bibliotecas **na ordem da linha de comando**, mantendo um conjunto de símbolos definidos e um de símbolos ainda indefinidos. Cada `U` precisa casar com exatamente uma definição global:

- nenhuma definição → `undefined reference to 'somar'`;
- duas definições globais fortes → `multiple definition of 'somar'`.

Bibliotecas estáticas (`.a`, arquivos `ar` com vários `.o`) seguem uma regra especial: o linker só extrai de um `.a` os membros que resolvem símbolos **indefinidos naquele momento**. Por isso a **ordem importa**: `gcc -lcalc main.o` falha (quando a biblioteca é processada, ainda ninguém precisava de `somar`), enquanto `gcc main.o -lcalc` funciona. Regra prática: bibliotecas depois de quem as usa.

**2. Relocação.** Com todos os símbolos resolvidos, o linker:

- junta as seções de mesmo tipo (todos os `.text` em um, todos os `.data` em outro);
- atribui endereços (virtuais, tópico 1.1.6) a cada seção e, portanto, a cada símbolo;
- percorre as relocations e **escreve os endereços corretos nos buracos**;
- adiciona o código de inicialização do runtime C (`crt1.o`, com o símbolo `_start`, que prepara `argc`/`argv`, chama `__libc_start_main`, que chama `main`) e define o *entry point* no cabeçalho ELF.

O resultado é um executável cujo cabeçalho descreve **segmentos** que o loader do SO deve mapear em memória (código com permissão de leitura e execução, dados com leitura e escrita). O tópico 1.2.2 mostra como esse arquivo vira um processo.

## Ligação estática versus dinâmica

Há duas formas de incorporar uma biblioteca ao programa.

**Ligação estática** (`.a` no Linux, `.lib` estática no Windows): o linker **copia** o código necessário da biblioteca para dentro do executável. Tudo é resolvido em tempo de build.

**Ligação dinâmica** (`.so` no Linux, `.dll` no Windows, `.dylib` no macOS): o executável guarda apenas o **nome** da biblioteca (entrada `NEEDED` na seção `.dynamic`) e referências aos símbolos. Quando o programa inicia, o **dynamic loader** (`ld-linux-x86-64.so.2` no Linux com glibc) encontra as bibliotecas, mapeia-as no espaço de endereços do processo e resolve os símbolos.

Para que uma `.so` possa ser carregada em qualquer endereço (e compartilhada entre processos), ela é compilada como **PIC** (*position-independent code*, `-fPIC`). O acesso a símbolos externos passa por duas tabelas:

- **GOT** (*Global Offset Table*): tabela de endereços, preenchida pelo loader, que o código lê para achar variáveis e funções externas;
- **PLT** (*Procedure Linkage Table*): pequenos trampolins para chamadas de função. Com *lazy binding*, a primeira chamada a `printf` passa pelo resolvedor do loader, que descobre o endereço real e grava na GOT; as chamadas seguintes saltam direto. (Muitas distribuições hoje usam `-z now`/*full RELRO*, que resolve tudo no início e deixa a GOT somente leitura, por segurança.)

| Critério | Estática | Dinâmica |
|---|---|---|
| Tamanho do binário | Maior (um hello world com glibc estática: ~800 KB) | Menor (~16 KB) |
| Dependências em runtime | Nenhuma: o binário é autocontido | Precisa das `.so` certas instaladas (`ldd` lista) |
| Atualização de segurança | Exige recompilar e redistribuir cada binário | Atualiza a `.so` uma vez; todos os programas se beneficiam no próximo start |
| Memória | Cada processo tem sua cópia do código | Páginas de código da `.so` são compartilhadas entre processos |
| Startup | Ligeiramente mais rápido (sem resolução de símbolos) | Custo de carregar e resolver; *lazy binding* reduz |
| Riscos | Licenças (LGPL), binário grande | "DLL hell": versão errada ou ausente → erro ao iniciar |

O dynamic loader procura bibliotecas em uma ordem definida: `RPATH`/`RUNPATH` gravados no binário (por exemplo, `$ORIGIN`, o diretório do próprio executável), a variável `LD_LIBRARY_PATH`, o cache `/etc/ld.so.cache` (atualizado por `ldconfig`) e os diretórios padrão (`/lib`, `/usr/lib`). Ferramentas para investigar:

- `ldd app`: lista as bibliotecas dinâmicas e onde cada uma foi encontrada (no macOS, `otool -L`; no Windows, `dumpbin /dependents`);
- `readelf -d app`: mostra `NEEDED`, `RUNPATH` e `SONAME`;
- `nm -D lib.so`: lista os símbolos exportados por uma biblioteca dinâmica.

## Diagnosticando erros de linkagem

Saber **em que fase** um erro nasce é metade do diagnóstico:

| Mensagem | Fase | Causa típica |
|---|---|---|
| `fatal error: calc.h: No such file or directory` | Preprocessing | Falta `-I` com o diretório do header |
| `implicit declaration of function 'somar'` | Compiling | Faltou incluir o header com o protótipo (erro no C moderno) |
| `undefined reference to 'somar'` | Linking | O `.o` ou a biblioteca com a definição não foi passado ao linker, ou está na ordem errada, ou o nome difere (C++ *name mangling* sem `extern "C"`) |
| `multiple definition of 'contador'` | Linking | Variável **definida** (não só declarada) em um header incluído por vários `.c` |
| `error while loading shared libraries: libestat.so: cannot open shared object file` | Carregamento (runtime) | A `.so` existia no build, mas o loader não a encontra: falta `RUNPATH`, `LD_LIBRARY_PATH` ou instalação |
| `symbol lookup error: undefined symbol: estat_mediana` | Carregamento/execução | A `.so` encontrada em runtime é de outra versão e não exporta o símbolo |

Os dois últimos são especialmente instrutivos: o programa **compilou e linkou com sucesso** contra uma versão da biblioteca, mas em runtime encontrou outra. É exatamente a mesma família de problema que, em Java, aparece como `NoSuchMethodError`.

## O "linking" na JVM: resolução tardia e preguiçosa

Java não tem um passo de linking no build. O `javac` compila cada classe para um `.class` independente e, no lugar de endereços, grava **referências simbólicas** no *constant pool*: "o método `somar` com descritor `(II)I` da classe `com/exemplo/Calc`". O javac confere o código contra as classes do classpath **de compilação**, mas não copia nada delas.

A ligação acontece **em runtime**, sob demanda, feita pela JVM (tópico 4.1.3):

1. **Loading**: quando uma classe é usada pela primeira vez, um class loader procura o `.class` no classpath (ou no module path), lê os bytes e cria a representação interna da classe.
2. **Linking**: **verificação** do bytecode (segurança de tipos), **preparação** (aloca campos estáticos com valores padrão) e **resolução**, que troca cada referência simbólica do constant pool por uma referência direta. Na HotSpot, a resolução é **preguiçosa**: acontece na primeira vez que cada instrução (`invokevirtual`, `getfield`...) é executada.
3. **Inicialização**: executa os inicializadores estáticos (`<clinit>`).

A comparação com o mundo nativo:

| Conceito nativo | Equivalente na JVM |
|---|---|
| Símbolo indefinido (`U`) no `.o` | Referência simbólica no constant pool |
| Linker estático (`ld`) | Não existe; a resolução é feita em runtime |
| Dynamic loader + `LD_LIBRARY_PATH` | Class loaders + classpath/module path |
| Lazy binding via PLT/GOT | Resolução preguiçosa no primeiro uso de cada instrução |
| `cannot open shared object file` | `NoClassDefFoundError` (a classe existia na compilação, mas não em runtime) / `ClassNotFoundException` (carga explícita via `Class.forName`) |
| `undefined symbol` em runtime | `NoSuchMethodError` / `NoSuchFieldError` (a classe existe, mas é de outra versão, sem aquele membro) |
| Biblioteca estática dentro do binário | *Fat jar*/*uber jar* (todas as dependências num só jar); no limite, GraalVM Native Image |

Essa ligação tardia é o que dá à JVM seu dinamismo: carregar plugins em runtime, gerar classes (proxies do Spring, Hibernate), trocar implementações via `ServiceLoader`. O preço é que erros de ligação só aparecem **quando o código executa**, às vezes horas depois do deploy, num caminho raro. O caso mais comum em backend é o *dependency hell* do Maven/Gradle: duas dependências trazem versões diferentes da mesma biblioteca, a resolução escolhe uma, e o código compilado contra a outra quebra com `NoSuchMethodError`. `mvn dependency:tree` e `./gradlew dependencies` são o equivalente Java do `ldd`.

## Custos, limitações e uso em sistemas reais

- **Builds incrementais dependem dessas fases.** `make`, `ninja` e CMake recompilam só as unidades de tradução cujos arquivos (ou headers incluídos) mudaram, e refazem o linking. Ferramentas como `ccache` guardam o resultado da compilação de cada `.c` pré-processado.
- **O linking pode ser o gargalo.** Em projetos gigantes (navegadores, bancos de dados), linkar leva minutos. Por isso surgiram linkers paralelos como `lld` e `mold`.
- **O linker também otimiza.** Com **LTO** (*link-time optimization*, `-flto`), o compilador grava IR nos `.o` e o linker otimiza o programa inteiro, fazendo inlining entre arquivos, algo impossível na compilação separada.
- **Containers e distribuição.** Binários estáticos (comuns em Go e com musl libc) rodam em imagens mínimas (`scratch`, *distroless*), sem se preocupar com a versão da libc da imagem. Binários dinâmicos linkados contra uma glibc nova falham em sistemas com glibc antiga (`version 'GLIBC_2.34' not found`), porque símbolos da glibc são versionados.
- **Java também carrega bibliotecas nativas.** `System.loadLibrary("estat")` (JNI) e a API de Foreign Function & Memory (`java.lang.foreign`, final no Java 22) usam o mesmo dynamic loader do SO para abrir `.so`/`.dll`; erros como `UnsatisfiedLinkError` são falhas de localização ou de símbolo, com as causas descritas acima. Drivers, bibliotecas de compressão (zstd, snappy), Netty com transporte nativo (epoll/io_uring) e RocksDB dependem disso.
- **Fat jars e shading.** Para evitar conflitos de versão, frameworks empacotam dependências num único jar e, às vezes, renomeiam pacotes (*shading*), o equivalente Java de linkar estaticamente uma biblioteca com símbolos privados.

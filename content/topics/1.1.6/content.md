## Memória como um grande array de bytes

Para o programa, a memória principal é um **array gigante de bytes**, e o **endereço** de um byte é simplesmente o seu **índice** nesse array. As arquiteturas atuais são *byte-addressable*: cada byte tem seu próprio endereço, mesmo que a CPU transfira dados da RAM em blocos maiores (linhas de cache de 64 bytes, tópico 1.1.2).

Tudo o que um programa manipula (variáveis, objetos, o código das funções, a stack) ocupa uma faixa de endereços. Quando um valor ocupa vários bytes, como um `int` de 4 bytes, o endereço dele é o do **primeiro** byte, e os demais ocupam os endereços seguintes.

As instruções de máquina trabalham com endereços o tempo todo: `mov eax, [rbp-4]` significa "leia 4 bytes a partir do endereço `rbp - 4`". Nomes de variáveis só existem no código-fonte; depois da compilação, sobram endereços e deslocamentos. Entender endereços é entender o que o compilador realmente gera e o que significa "referência" em Java.

## Valor, endereço e ponteiro

Toda variável tem duas coisas distintas:

- o **valor**: o conteúdo guardado nos bytes;
- o **endereço**: onde esses bytes estão.

Em C, o operador `&` obtém o endereço de uma variável e o operador `*` (desreferência) acessa o valor que está em um endereço:

```c
int x = 42;         /* x vale 42; mora em algum endereço, ex.: 0x7ffc1000 */
int *p = &x;        /* p vale 0x7ffc1000: p é uma variável cujo valor é um endereço */
*p = 99;            /* escreve 99 no endereço guardado em p => x agora vale 99 */
int **pp = &p;      /* pp guarda o endereço de p */
```

Um **ponteiro** é apenas uma variável cujo valor é um endereço. Ele também mora em algum endereço e ocupa bytes (8, em um sistema de 64 bits), por isso existe ponteiro para ponteiro.

O **tipo** do ponteiro (`int *`, `double *`, `struct Pedido *`) não muda o endereço guardado; muda **como o compilador interpreta** os bytes apontados: quantos bytes ler em `*p` e quanto avançar em `p + 1`. `void *` é um endereço "sem tipo": pode guardar qualquer endereço, mas não pode ser desreferenciado sem conversão.

## Diagrama: Variáveis e ponteiros na memória

```text
  endereço          bytes (valor)                 variável
             ┌────────────────────────────┐
 0x7ffc1000  │ 63 00 00 00                │  int x = 99      (4 bytes)
             ├────────────────────────────┤
 0x7ffc1004  │ (padding: 4 bytes)         │
             ├────────────────────────────┤
 0x7ffc1008  │ 00 10 fc 7f 00 00 00 00    │  int *p = 0x7ffc1000   (8 bytes)
             ├────────────────────────────┤         │
 0x7ffc1010  │ 08 10 fc 7f 00 00 00 00    │  int **pp = 0x7ffc1008  (8 bytes)
             └────────────────────────────┘         │
                                                     │
   pp ──aponta para──▶ p ──aponta para──▶ x          │
   *pp == p     **pp == *p == x == 99   ◀────────────┘
```

Repare em dois detalhes que serão explicados adiante: os bytes de cada valor aparecem "ao contrário" (`63 00 00 00` para 99 = `0x63`), porque x86-64 é **little-endian**; e há 4 bytes vazios entre `x` e `p`, porque um ponteiro de 8 bytes é **alinhado** em endereço múltiplo de 8. (A disposição real das variáveis locais na stack é escolha do compilador; o diagrama é ilustrativo.)

## Aritmética de ponteiros e arrays

Somar um inteiro `n` a um ponteiro do tipo `T *` avança `n * sizeof(T)` bytes, e não `n` bytes. Assim, `p + 1` aponta para o **próximo elemento**, seja ele um `char` (1 byte), um `int` (4) ou um `double` (8).

Em C, um array é um bloco contíguo de elementos, e o nome do array, na maioria das expressões, **decai** para um ponteiro para o primeiro elemento. Por definição da linguagem, `a[i]` é exatamente `*(a + i)`:

```c
int v[5] = {10, 20, 30, 40, 50};
int *p = v;          /* mesmo que &v[0] */
p[2]      /* 30 */
*(p + 2)  /* 30 */
*(v + 2)  /* 30 */
p + 2 - p /* 2: subtrair ponteiros dá a distância em elementos (tipo ptrdiff_t) */
```

É por isso que indexar um array é O(1): o endereço do elemento `i` é `base + i * sizeof(T)`, uma multiplicação e uma soma (em x86-64, uma única instrução com modo de endereçamento `[base + i*4]`). E é por isso que arrays são tão rápidos para percorrer: elementos contíguos ocupam as mesmas linhas de cache, e o *prefetcher* da CPU antecipa os próximos.

O lado perigoso: **C não verifica limites**. `v[5]` ou `*(p + 100)` calculam um endereço válido como número e leem o que estiver lá: outra variável, o endereço de retorno da função ou uma página não mapeada. Isso é **comportamento indefinido** e está na origem de buffer overflows, uma das classes de vulnerabilidade mais exploradas da história. Em Java, todo acesso a array verifica o índice e lança `ArrayIndexOutOfBoundsException`; o JIT remove a verificação apenas quando prova que ela é desnecessária (por exemplo, num `for` de `0` a `length - 1`).

## Tamanho de palavra, tamanho de ponteiro e espaço endereçável

A **palavra** (*word*) de uma arquitetura é o tamanho natural com que ela opera: o tamanho dos registradores de uso geral e, em geral, o tamanho de um ponteiro. Com ponteiros de **n bits**, é possível distinguir **2ⁿ endereços**:

| Ponteiro | Endereços distintos | Espaço endereçável (bytes) |
|---|---|---|
| 16 bits | 2¹⁶ | 64 KiB |
| 32 bits | 2³² | 4 GiB |
| 64 bits | 2⁶⁴ | 16 EiB (teórico) |

O limite de 4 GiB foi o grande motivo da migração para 64 bits: um processo de 32 bits não consegue endereçar mais que 4 GiB (na prática, 2 a 3 GiB, porque parte é reservada ao kernel), nem que a máquina tenha 64 GiB de RAM.

Na prática, os processadores x86-64 atuais não usam os 64 bits: endereços virtuais têm **48 bits significativos** (256 TiB; no Linux, 128 TiB para o espaço do usuário) ou **57 bits** com paginação de 5 níveis. Os bits superiores precisam repetir o bit 47 (endereços **canônicos**); um ponteiro fora desse formato gera falha. Isso explica por que endereços de stack no Linux se parecem com `0x7ffc...` e por que alguns runtimes aproveitam os bits altos "livres" de um ponteiro para guardar metadados (*pointer tagging*), como faz o coletor ZGC da HotSpot.

Os tamanhos dos tipos de C dependem do **modelo de dados** da plataforma:

| Modelo | Plataforma | `int` | `long` | ponteiro |
|---|---|---|---|---|
| ILP32 | Sistemas de 32 bits | 4 | 4 | 4 |
| LP64 | Linux, macOS (64 bits) | 4 | **8** | 8 |
| LLP64 | Windows (64 bits) | 4 | **4** | 8 |

Por isso código C portável usa `int32_t`, `uint64_t`, `size_t` (tamanhos de objetos) e `uintptr_t` (inteiro capaz de guardar um ponteiro), de `<stdint.h>`. Java evita o problema por especificação: `int` tem sempre 32 bits e `long` sempre 64, em qualquer plataforma.

Ponteiros de 64 bits têm um custo: **ocupam o dobro** dos de 32. Estruturas cheias de ponteiros (listas ligadas, árvores, grafos de objetos) ficam maiores, cabem menos dados em cada linha de cache e a pressão sobre a memória aumenta. É exatamente o problema que os *compressed oops* da JVM resolvem, mais adiante.

## Alinhamento e padding

Um valor de `k` bytes está **alinhado** quando seu endereço é múltiplo de `k` (para tipos primitivos de até 8 bytes, na maioria das ABIs). Isso importa porque a CPU lê a memória em blocos alinhados: um `int` alinhado está sempre dentro de uma única palavra e de uma única linha de cache; um `int` desalinhado pode atravessar duas linhas de cache (ou duas páginas), exigindo dois acessos. Em x86-64, acessos desalinhados funcionam, com custo pequeno na maioria dos casos; em algumas arquiteturas (ARM antigos, SPARC), geram falha. Operações atômicas desalinhadas são lentas ou proibidas em praticamente todas.

Para garantir o alinhamento, o compilador insere **padding** (bytes de enchimento) entre os campos de uma `struct` e no final dela:

```c
struct Ruim { char a; int b; char c; double d; };   /* sizeof = 24 */
/* a@0, padding 1..3, b@4, c@8, padding 9..15, d@16 */

struct Boa  { double d; int b; char a; char c; };   /* sizeof = 16 */
/* d@0, b@8, a@12, c@13, padding 14..15 */
```

Os mesmos campos, em outra ordem, ocupam 33% menos memória. O padding final existe para que, num array de `struct`, **todos** os elementos continuem alinhados. Em C, a ordem dos campos é a ordem da declaração (o compilador não pode reordenar); em Java, quem decide o layout é a JVM, que reordena os campos para minimizar o padding.

## Endianness: a ordem dos bytes

Um valor de vários bytes pode ser gravado na memória em duas ordens:

- **Big-endian**: o byte **mais significativo** vem primeiro (no menor endereço). É como escrevemos números: `0x0A0B0C0D` fica `0A 0B 0C 0D`.
- **Little-endian**: o byte **menos significativo** vem primeiro: `0D 0C 0B 0A`.

x86-64 é little-endian, e ARM (incluindo Apple Silicon e Graviton) roda praticamente sempre em little-endian; big-endian sobrevive em mainframes IBM z, em alguns processadores de rede e embarcados e, sobretudo, em **formatos de dados**.

Endianness não importa enquanto um programa lê e escreve seus próprios valores na mesma máquina. Importa quando **bytes cruzam fronteiras**:

- **Protocolos de rede** usam *network byte order*, que é big-endian. Os campos de porta e endereço do IP e do TCP são big-endian; em C, converte-se com `htons`/`htonl` (*host to network*) e `ntohs`/`ntohl`.
- **Formatos binários**: o formato `.class` da JVM, PNG e os frames do protocolo Kafka são big-endian; BMP, ZIP e a maioria dos formatos nativos de Windows são little-endian. Ler um campo na ordem errada produz números absurdos: `0x0A0B0C0D` (168.496.141) lido na ordem trocada vira `0x0D0C0B0A` (218.893.066).
- **Memória compartilhada e arquivos mapeados** lidos por programas em arquiteturas diferentes.

Java padronizou big-endian em `DataInputStream`/`DataOutputStream`, na serialização e no `ByteBuffer` (padrão `ByteOrder.BIG_ENDIAN`), independentemente da CPU. `ByteOrder.nativeOrder()` informa a ordem da máquina, e `ByteBuffer.order(ByteOrder.LITTLE_ENDIAN)` permite ler formatos little-endian. Para trocar a ordem de um `int` manualmente, há `Integer.reverseBytes`.

## Exemplo: Endereços, bytes e alinhamento em C

```c
#include <stdio.h>
#include <stddef.h>
#include <stdint.h>

struct Ruim { char a; int b; char c; double d; };
struct Boa  { double d; int b; char a; char c; };

int main(void) {
    int v[5] = {10, 20, 30, 40, 50};
    for (int *p = v; p < v + 5; p++)
        printf("indice %td  endereco %p  valor %d\n", p - v, (void *) p, *p);

    printf("sizeof(int*)=%zu  sizeof(long)=%zu\n", sizeof(int *), sizeof(long));
    printf("Ruim=%zu  Boa=%zu  offsetof(Ruim, d)=%zu\n",
           sizeof(struct Ruim), sizeof(struct Boa), offsetof(struct Ruim, d));

    uint32_t x = 0x0A0B0C0D;
    unsigned char *b = (unsigned char *) &x;     /* ver o int byte a byte */
    printf("bytes de x: %02x %02x %02x %02x\n", b[0], b[1], b[2], b[3]);

    int local = 7;
    printf("&local=%p  main=%p\n", (void *) &local, (void *) main);
    return 0;
}
```

Saída ilustrativa (Linux x86-64, gcc):

```text
indice 0  endereco 0x7fff56fe3500  valor 10
indice 1  endereco 0x7fff56fe3504  valor 20
indice 2  endereco 0x7fff56fe3508  valor 30
indice 3  endereco 0x7fff56fe350c  valor 40
indice 4  endereco 0x7fff56fe3510  valor 50
sizeof(int*)=8  sizeof(long)=8
Ruim=24  Boa=16  offsetof(Ruim, d)=16
bytes de x: 0d 0c 0b 0a
&local=0x7fff56fe34e4  main=0x63fcf0db0195
```

- Os endereços do array avançam de 4 em 4: `p++` soma `sizeof(int)`.
- `0d 0c 0b 0a` mostra que a máquina é little-endian.
- Endereços na faixa `0x7fff...` são da stack; `main` está na faixa onde o executável foi mapeado. **Rode de novo e todos os endereços mudam**: é o ASLR, assunto da próxima seção.
- No Windows (LLP64), `sizeof(long)` imprime 4.

## Endereços virtuais, não físicos

Os endereços que um programa vê, imprime e usa **não são posições reais na RAM**. São **endereços virtuais**: cada processo tem seu próprio espaço de endereçamento, e a **MMU** (*memory management unit*) da CPU traduz cada endereço virtual para um endereço físico, página a página (tipicamente 4 KiB), usando tabelas de páginas mantidas pelo sistema operacional. O funcionamento dessa tradução é o tema do tópico 1.2.6; aqui importam as consequências:

- **Dois processos podem usar o mesmo endereço virtual** (por exemplo, `0x7fff56fe3500`) apontando para memórias físicas diferentes. Um ponteiro só faz sentido **dentro do processo** que o criou; enviá-lo pela rede ou gravá-lo num arquivo não tem utilidade.
- **Endereços podem mudar a cada execução.** O SO aplica **ASLR** (*address space layout randomization*), sorteando onde ficam stack, heap, bibliotecas e o próprio executável (se compilado como PIE). Isso dificulta ataques que precisam saber endereços de antemão.
- **Nem todo endereço é válido.** Só as faixas que o SO mapeou para o processo podem ser acessadas, e cada página tem permissões (leitura, escrita, execução). Acessar uma página não mapeada, ou escrever numa página somente leitura, faz a MMU gerar uma falha que o SO entrega ao processo como **segmentation fault** (sinal `SIGSEGV` no Linux, *access violation* no Windows).

## Null pointer, dangling pointer e falhas de segmentação

Um **ponteiro nulo** (`NULL` em C, `nullptr` em C++) é um valor reservado que significa "não aponta para nada". Na prática, é o endereço `0`, e o SO **nunca mapeia** a primeira página do espaço de endereçamento (no Linux, os primeiros 64 KiB por padrão, via `vm.mmap_min_addr`). Assim, desreferenciar `NULL`, ou um campo próximo dele (`p->campo`, com `p == NULL`, lê `0 + offset`), cai numa página proibida e gera `SIGSEGV`. O crash é a **boa** notícia: é uma falha imediata e detectável.

Pior que o nulo é o **dangling pointer**: um ponteiro que guarda um endereço que **já foi válido** e deixou de ser. As duas origens clássicas:

- **Endereço de variável local retornado**: a função devolve `&local`; ao retornar, o frame é descartado (tópico 1.1.7) e a próxima chamada reutiliza aqueles bytes.
- **Use-after-free**: `free(p)` devolve o bloco ao alocador (tópico 1.1.8), mas `p` continua com o endereço antigo.

O endereço continua numericamente "válido" (a página segue mapeada), então não há crash garantido: o programa lê dados de outra pessoa, ou corrompe estruturas silenciosamente. Em C, isso é **comportamento indefinido**: o compilador pode assumir que nunca acontece e gerar qualquer coisa. Ferramentas como AddressSanitizer (`-fsanitize=address`) e Valgrind detectam esses erros em testes.

E em Java? `null` também é representado como o valor zero numa referência, mas a JVM **garante** que desreferenciá-lo lance `NullPointerException`, nunca comportamento indefinido. O interpretador faz uma checagem explícita. O código compilado pelo JIT usa um truque elegante: em vez de testar `if (ref == null)` antes de cada acesso, simplesmente lê `[ref + offset]`; se `ref` for nulo, a leitura cai na página proibida, o SO entrega o `SIGSEGV` à JVM, e o *signal handler* da JVM reconhece que o endereço da instrução corresponde a uma checagem implícita e transforma a falha em `NullPointerException`. É uma checagem de custo zero no caminho comum. Se as NPEs forem frequentes naquele ponto, a JVM recompila com checagem explícita, porque o tratamento do sinal é caro. Desde o Java 14 (JEP 358; ativado por padrão no 15), a mensagem ainda diz qual expressão era nula (`Cannot invoke "String.length()" because "pedido.cliente" is null`).

Dangling pointers não existem em Java: não há `&` nem `free`. Um objeto só é recolhido pelo Garbage Collector quando **nenhuma referência alcançável** aponta para ele, então uma referência nunca aponta para memória liberada.

## Referências em Java: endereços que você não pode ver

Uma variável de tipo objeto em Java (`Pedido p`) guarda uma **referência**: na HotSpot, ela é, na prática, um ponteiro (ou um ponteiro comprimido) para o objeto no heap. Mas a linguagem esconde isso deliberadamente:

- **Não há aritmética de referências** nem conversão de referência para inteiro. Você não consegue fabricar uma referência para um lugar arbitrário da memória, e isso permite que o verificador de bytecode garanta segurança de memória.
- **O GC move objetos.** Coletores como G1, ZGC e Shenandoah copiam objetos vivos para compactar o heap; ao mover, atualizam todas as referências. Se o programa pudesse guardar endereços numéricos, eles ficariam inválidos a cada coleta. `System.identityHashCode` **não** é o endereço: é um número gerado e gravado no cabeçalho do objeto na primeira vez que é pedido, justamente para permanecer estável quando o objeto se move.
- **Java é sempre passagem por valor.** Ao chamar `m(p)`, o **valor** de `p`, que é a referência, é copiado para o parâmetro. O método pode alterar o objeto apontado (`p.setStatus(...)` é visto pelo chamador, pois ambos apontam para o mesmo objeto), mas **reatribuir o parâmetro** (`p = new Pedido()`) muda apenas a cópia local e não afeta a variável do chamador. Em C, para alterar a variável do chamador seria preciso passar `&p`, um ponteiro para o ponteiro, algo que Java não oferece.

### Compressed oops

Na HotSpot, uma referência a objeto é chamada de **oop** (*ordinary object pointer*). Numa JVM de 64 bits, ela teria 8 bytes. Como objetos Java são alinhados em **8 bytes**, os 3 bits menos significativos de todo endereço de objeto são sempre zero. A JVM aproveita isso: guarda a referência em **32 bits**, como `(endereço - base) >> 3`, e reconstrói o endereço com `base + (oop << 3)`, uma operação que cabe no modo de endereçamento da instrução de acesso, quase sem custo.

- 32 bits × 8 bytes de granularidade = 2³² × 8 = **32 GiB** endereçáveis.
- `-XX:+UseCompressedOops` é ativado automaticamente para heaps menores que ~32 GiB. Se o heap couber nos primeiros 4 GiB do espaço virtual, nem o deslocamento é necessário; abaixo de 32 GiB, a base pode ser zero (*zero-based*).
- O ganho: cada campo de referência, cada elemento de um `Object[]` e cada referência dentro de coleções ocupa 4 bytes em vez de 8. Em aplicações típicas, que são grafos de objetos, o heap ocupado cai algo como 20% a 40%, e cabe mais coisa em cada linha de cache.
- A **armadilha dos 32 GiB**: com `-Xmx32g` ou mais, os compressed oops são desligados e todas as referências dobram de tamanho. Um heap de 33 GiB pode comportar **menos** dados úteis que um de 31 GiB. Por isso a recomendação clássica para Elasticsearch e afins é ficar abaixo de ~31 GiB. (Com `-XX:ObjectAlignmentInBytes=16`, o limite sobe para 64 GiB, ao custo de mais padding.)
- O mesmo truque se aplica ao ponteiro para a classe no cabeçalho de cada objeto (*compressed class pointers*).

### Layout de objetos e JOL

Todo objeto na HotSpot (64 bits, Java 21, configuração padrão) tem um **cabeçalho** de 12 bytes: 8 de **mark word** (hash de identidade, idade para o GC, estado de lock) e 4 do **class pointer** comprimido. Depois vêm os campos, reordenados pela JVM para reduzir padding, e o tamanho total é arredondado para múltiplo de 8. Arrays têm mais 4 bytes para o comprimento.

A ferramenta **JOL** (*Java Object Layout*, do OpenJDK, dependência `org.openjdk.jol:jol-core`) mostra esse layout:

```java
import org.openjdk.jol.info.ClassLayout;

public class Layout {
    static class Pedido {
        boolean pago;
        long id;
        int quantidade;
        String cliente;
    }

    public static void main(String[] args) {
        System.out.println(ClassLayout.parseClass(Pedido.class).toPrintable());
    }
}
```

```text
Layout$Pedido object internals:
OFF  SZ               TYPE DESCRIPTION               VALUE
  0   8                    (object header: mark)     N/A
  8   4                    (object header: class)    N/A
 12   4                int Pedido.quantidade         N/A
 16   8               long Pedido.id                 N/A
 24   1            boolean Pedido.pago               N/A
 25   3                    (alignment/padding gap)
 28   4   java.lang.String Pedido.cliente            N/A
Instance size: 32 bytes
```

Saída ilustrativa: a ordem exata dos campos pode variar entre versões da JVM. Observe que o `int` foi colocado no offset 12 para aproveitar o espaço logo após o cabeçalho, e que a referência `cliente` ocupa 4 bytes (compressed oop). Com `-XX:-UseCompressedOops`, ela passaria a 8 bytes e o objeto, a 40. Um `new Object()` vazio ocupa 16 bytes; um `Integer`, também 16 (12 de cabeçalho + 4 do `int`), enquanto o `int` primitivo ocupa 4. É por isso que um `ArrayList<Integer>` com um milhão de elementos ocupa várias vezes mais memória que um `int[]` (tópico 4.1.6 aprofunda o layout; a partir do Java 25, os *compact object headers* do JEP 519, opcionais via `-XX:+UseCompactObjectHeaders`, reduzem o cabeçalho para 8 bytes).

### Unsafe, VarHandle e memória fora do heap

Java tem portas controladas para operações de baixo nível:

- **`sun.misc.Unsafe`**: API interna que permite ler e escrever em offsets arbitrários de objetos e em memória nativa (`allocateMemory`, `getLong(endereco)`), além de operações atômicas como *compare-and-swap*. Bibliotecas como Netty, Kafka e Cassandra a usaram por desempenho. É perigosa (um offset errado corrompe a JVM e derruba o processo) e está em processo de desativação: os métodos de acesso à memória foram depreciados para remoção (JEP 471, Java 23).
- **`VarHandle`** (Java 9): a substituta segura para acessar campos e elementos de array com semânticas de memória explícitas (`getVolatile`, `setRelease`, `compareAndSet`, `getAndAdd`). É a base das classes `java.util.concurrent.atomic` e é aprofundada nos tópicos de concorrência.
- **Foreign Function & Memory API** (`java.lang.foreign`, final no Java 22): `MemorySegment` e `Arena` permitem alocar e acessar memória fora do heap com verificação de limites e de tempo de vida, inclusive escolhendo a ordem dos bytes (`ValueLayout.JAVA_INT.withOrder(ByteOrder.BIG_ENDIAN)`). É a forma moderna de ler formatos binários e conversar com bibliotecas nativas sem `Unsafe`.

## Custos, limitações e uso em sistemas reais

- **Ponteiros dão poder e risco.** Em C, aritmética de ponteiros permite estruturas de dados eficientes e acesso direto a hardware, mas erros de memória (overflows, use-after-free, dangling pointers) respondem por cerca de 70% das vulnerabilidades graves relatadas por Microsoft e Google em seus produtos. Essa é a motivação de linguagens com segurança de memória: Java e Go com GC, Rust com o sistema de *ownership*.
- **Indireção custa.** Cada referência seguida é um acesso a um endereço potencialmente distante, ou seja, um possível *cache miss* de dezenas a centenas de ciclos. Arrays de primitivos, contíguos, são muito mais rápidos de percorrer que listas ligadas ou arrays de objetos espalhados pelo heap. É a razão de ser do Project Valhalla (*value classes*, sem identidade e armazenáveis "achatados").
- **Tamanho de referência é capacidade.** Em serviços com heaps grandes, ficar abaixo do limite dos compressed oops e reduzir objetos pequenos (wrappers, nós de coleções) tem impacto direto em memória e em pausas de GC.
- **Endianness aparece nas bordas.** Parsers de protocolos binários (Kafka, Protobuf, gRPC sobre HTTP/2, formatos de arquivo) e integrações com hardware ou sistemas legados são onde bugs de ordem de bytes aparecem. Em Java, explicite sempre a ordem do `ByteBuffer` em vez de depender do padrão.
- **Alinhamento importa em concorrência.** Duas variáveis muito disputadas por threads diferentes na mesma linha de cache provocam *false sharing*; a JVM oferece `@Contended` (interna) e bibliotecas fazem padding manual para separar campos quentes, como em `LongAdder`.

## O problema que o heap resolve

A stack (tópico 1.1.7) é rápida porque impõe uma regra rígida: um dado vive exatamente enquanto a função que o criou está executando. Muitos dados reais não obedecem a essa regra:

- **Tempo de vida independente do escopo.** Um pedido criado por um método `criarPedido()` precisa continuar existindo depois que o método retorna, porque será guardado numa lista, enviado a outra thread ou devolvido ao chamador.
- **Tamanho conhecido só em tempo de execução.** O número de linhas de um arquivo CSV ou o tamanho do corpo de uma requisição HTTP só é conhecido quando o dado chega. O frame de uma função tem tamanho fixado pelo compilador.
- **Tamanho grande.** Um buffer de 200 MB não cabe numa stack de 1 MB.
- **Compartilhamento entre threads.** Cada thread tem sua stack; um dado que duas threads acessam precisa morar num lugar comum.

O **heap** é a região da memória do processo destinada a essa **alocação dinâmica**: o programa pede um bloco de N bytes a qualquer momento, recebe um endereço e decide quando devolvê-lo. A liberdade custa caro: alguém precisa encontrar espaço livre, registrar o que está ocupado e descobrir quando um bloco pode ser reaproveitado. Esse "alguém" é o **alocador** (em C) ou o **alocador + Garbage Collector** (em Java).

> **Atenção ao nome.** "Heap" aqui é uma *região de memória*. Não tem relação com a estrutura de dados *heap binário* (a árvore usada em `PriorityQueue`), estudada no tópico 2.4.7. Os dois só compartilham a palavra.

## Onde o heap fica no espaço de endereçamento

No espaço de endereçamento virtual de um processo Linux (tópico 1.2.7), o heap clássico fica logo acima dos dados globais (`.data`, `.bss`) e cresce para endereços maiores, enquanto a stack fica no topo e cresce para baixo. O alocador obtém memória do sistema operacional de duas formas:

- **`brk`/`sbrk`**: move o "program break", o limite superior do heap contíguo. Barato, mas só cresce e encolhe pelo fim.
- **`mmap`**: pede ao kernel um mapeamento anônimo novo em qualquer ponto do espaço de endereçamento. O glibc usa `mmap` diretamente para blocos grandes (por padrão a partir de ~128 KB, limite ajustado dinamicamente) e para as arenas das threads secundárias.

Essas chamadas de sistema são caras (centenas de nanossegundos a microssegundos, mais as *page faults* quando as páginas são tocadas pela primeira vez, tópico 1.2.8). Por isso o alocador pede memória ao kernel em pedaços grandes e a **subdivide em espaço de usuário**. `malloc` quase nunca faz uma syscall; ele administra um estoque.

A JVM faz o mesmo em escala maior: na inicialização ela **reserva** com `mmap` (ou `VirtualAlloc` no Windows) uma faixa contínua de espaço virtual do tamanho de `-Xmx` e vai **comprometendo** páginas conforme o heap Java cresce a partir de `-Xms`.

## Como um alocador funciona por dentro

A interface de C é mínima: `void *malloc(size_t n)` devolve um bloco de pelo menos `n` bytes, e `void free(void *p)` o devolve. Note que `free` **não recebe o tamanho**. O alocador precisa descobri-lo sozinho, e isso dita sua estrutura.

### Cabeçalho do bloco

Cada bloco (no glibc, *chunk*) tem um pequeno **cabeçalho** imediatamente antes do endereço entregue ao programa, com o tamanho do bloco e alguns bits de estado (por exemplo, "o bloco anterior está em uso"). `free(p)` lê `p - 8` para saber o tamanho. Também há **alinhamento**: em x86-64 o glibc devolve endereços múltiplos de 16, e o menor chunk ocupa 32 bytes.

### Free lists

Os blocos livres são encadeados numa **free list**. O truque é que a lista não gasta memória extra: os ponteiros `next`/`prev` são gravados **dentro do próprio bloco livre**, no espaço que o programa usaria se o bloco estivesse ocupado (lista *intrusiva*). Para atender um `malloc`, o alocador percorre a lista com uma política:

- **First fit**: o primeiro bloco grande o suficiente. Rápido, tende a fragmentar o começo da lista.
- **Best fit**: o menor bloco que serve. Desperdiça menos, mas exige busca (ou estruturas ordenadas).
- **Split**: se o bloco escolhido é muito maior, ele é dividido e a sobra volta para a lista.

No `free`, o alocador tenta **coalescer**: se o vizinho físico anterior ou posterior também está livre, os dois viram um bloco maior. Sem coalescência, o heap viraria pó de blocos pequenos.

### Size classes

Percorrer uma única lista é O(n). Alocadores reais mantêm **várias listas, uma por faixa de tamanho** (*size classes* ou *bins*). Um pedido de 40 bytes é arredondado para a classe de 48 e atendido pela cabeça da lista dessa classe em O(1). O glibc tem *tcache*, *fastbins*, *small bins* e *large bins*; jemalloc e tcmalloc organizam páginas inteiras ("slabs"/"spans") em que todos os objetos têm o mesmo tamanho.

### Arenas e caches por thread

O heap é compartilhado entre threads, então `malloc` precisa de sincronização. Um lock global seria um gargalo num servidor com 32 núcleos. A solução é ter **várias arenas** (regiões independentes, cada uma com seu lock) e **caches por thread**: no glibc, o *tcache* guarda alguns blocos pequenos recém-liberados por thread, sem lock algum. jemalloc e tcmalloc foram criados justamente para escalar melhor nesse ponto, e são comuns em bancos de dados e serviços de alta concorrência.

## Diagrama: Blocos, cabeçalhos e free list

```text
 região do heap (endereços crescem →)

 ┌────┬──────────────┬────┬────────────┬────┬──────────────────┬────┬──────┐
 │ hdr│  EM USO      │ hdr│  LIVRE     │ hdr│  EM USO          │ hdr│ LIVRE│
 │ 32 │  (p1)        │ 48 │ next ──────┼────┼──────────────────┼──► │ next │
 └────┴──────────────┴────┴────────────┴────┴──────────────────┴────┴──┬───┘
   ▲                   ▲                                                │
   │                   └── cabeça da free list (classe 48)              ▼
   p1 = endereço devolvido por malloc (logo após o cabeçalho)          NULL

 free(p1):  lê o tamanho em p1 - 8, marca o bloco como livre e,
            se o vizinho à direita estiver livre, coalesce os dois
            num bloco só antes de inseri-lo numa free list.
```

## Fragmentação interna e externa

Fragmentação é memória que o processo possui mas não consegue usar. Ela tem duas formas:

| Tipo | O que é | Causa típica | Exemplo |
|---|---|---|---|
| **Interna** | Espaço desperdiçado *dentro* de um bloco entregue | Arredondamento para size class, alinhamento, cabeçalho | `malloc(25)` no glibc ocupa um chunk de 48 bytes |
| **Externa** | Espaço livre *entre* blocos ocupados, picado demais | Alocações e liberações intercaladas de tamanhos variados | 100 MB livres em blocos de 64 bytes, e um pedido de 1 MB falha |

A fragmentação externa é a mais traiçoeira. Num processo C de vida longa (um servidor rodando por semanas), o padrão aloca-libera pode deixar o heap como queijo suíço: o RSS cresce, mas a memória "livre" não serve para os pedidos grandes, e o alocador precisa pedir mais ao SO. Como em C os ponteiros são endereços brutos, **o alocador não pode mover blocos** para juntar os buracos: qualquer ponteiro no programa ficaria inválido.

Alocadores mitigam com size classes (blocos do mesmo tamanho são intercambiáveis), coalescência e devolução de páginas ao SO (`madvise`). **GCs compactadores** resolvem o problema na raiz: como a JVM conhece todas as referências, ela pode **mover objetos vivos** para uma área contígua e atualizar as referências. O espaço livre volta a ser um único bloco. Essa capacidade é o que torna possível a alocação por *bump pointer* descrita adiante.

## Exemplo: Leak, use-after-free e double free em C

Com gerenciamento manual, o programador assume três responsabilidades: liberar **exatamente uma vez**, **depois** do último uso, e **nunca** usar o bloco após liberar.

```c
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

char *duplicar(const char *s) {
    char *copia = malloc(strlen(s) + 1);   /* vive no heap: sobrevive ao return */
    strcpy(copia, s);
    return copia;
}

int main(void) {
    char *a = duplicar("pedido-1");
    char *b = duplicar("pedido-2");

    free(a);
    printf("%s\n", a);   /* USE-AFTER-FREE: o bloco pode já estar em outra free list
                            ou ter sido entregue a outro malloc */

    free(a);             /* DOUBLE FREE: corrompe a free list; o mesmo bloco pode
                            ser entregue duas vezes por mallocs futuros */

    b = duplicar("pedido-3");  /* MEMORY LEAK: o bloco de "pedido-2" perdeu sua
                                  única referência e nunca será liberado */
    free(b);
    return 0;
}
```

- **Memory leak**: um bloco sem nenhuma referência e nunca liberado. Em processos curtos é inofensivo (o SO recupera tudo no fim); em servidores, o consumo cresce até o processo ser morto.
- **Use-after-free**: ler ou escrever num bloco já liberado. O bloco pode ter sido reaproveitado, então o programa lê dados de *outro* objeto. É uma das classes de vulnerabilidade mais exploradas em navegadores e kernels.
- **Double free**: liberar o mesmo bloco duas vezes. Corrompe as estruturas internas do alocador; o glibc detecta alguns casos (`free(): double free detected in tcache 2`) e aborta.

Esses bugs muitas vezes não falham na hora. Por isso existem ferramentas: compilando com `gcc -fsanitize=address -g`, o **AddressSanitizer** envenena blocos liberados e os coloca em quarentena, acusando `heap-use-after-free` com a stack da alocação, da liberação e do uso; o LeakSanitizer integrado relata leaks ao final. O **Valgrind** (`valgrind --leak-check=full ./prog`) faz algo parecido sem recompilar, porém de 20 a 50 vezes mais lento.

## Custo do heap comparado à stack

| Aspecto | Stack | Heap (malloc em C) |
|---|---|---|
| Alocar | Subtrair do `rsp`: ~1 instrução | Escolher size class, consultar cache/free list, às vezes lock ou syscall: dezenas de ns no caminho rápido, muito mais no lento |
| Liberar | Implícita no `ret` | `free`: achar cabeçalho, coalescer, reinserir em lista |
| Tempo de vida | Escopo da função | Arbitrário, decidido pelo programa |
| Tamanho | Fixo por thread (~1 MB) | Limitado pela memória virtual / `-Xmx` |
| Concorrência | Privada da thread | Compartilhado, exige sincronização |
| Localidade | Topo sempre quente no cache | Blocos espalhados; ponteiros podem gerar cache misses |
| Bugs típicos | Estouro, ponteiro para local | Leak, use-after-free, double free, fragmentação |

O custo do heap não é só o `malloc`. Cada acesso via ponteiro é uma indireção que pode errar o cache (tópico 1.1.2), e estruturas cheias de ponteiros (listas ligadas, árvores) são muito mais lentas de percorrer do que arrays contíguos. É por isso que a pergunta "quando ir para o heap?" tem uma resposta simples: **quando o tempo de vida ou o tamanho exigirem**. Se o dado cabe e morre no escopo, a stack é melhor.

## Como a JVM aloca: bump pointer e TLAB

Em Java, todo `new` aloca no heap (salvo as otimizações de escape analysis, ver tópico 1.1.7). Mesmo assim, alocar em Java costuma ser **mais barato do que `malloc`**. O motivo é que o GC compactador mantém o espaço de alocação contíguo, então a JVM não precisa de free lists.

### Bump pointer

Os objetos novos nascem numa área chamada **eden** (geração jovem). Como ela é esvaziada a cada coleta jovem (os sobreviventes são copiados para fora), o espaço livre é sempre um único bloco. Alocar é "empurrar" um ponteiro:

```text
novo_topo = topo + tamanho_do_objeto
se novo_topo <= fim:  objeto = topo; topo = novo_topo   ← caminho rápido
senão:                caminho lento (novo TLAB, ou coleta)
```

### TLAB (Thread-Local Allocation Buffer)

Se todas as threads disputassem o mesmo `topo`, cada `new` precisaria de uma operação atômica (CAS). A JVM evita isso dando a cada thread um pedaço privado do eden, o **TLAB**. Dentro dele, a alocação é um bump pointer **sem sincronização nenhuma**: poucas instruções que o JIT gera inline no código do método. Só quando o TLAB acaba a thread faz uma operação atômica para pegar outro TLAB do eden. Objetos grandes demais para o TLAB são alocados diretamente no eden compartilhado (ou, no G1, em regiões *humongous*).

Depois de reservar o espaço, a JVM ainda **zera os campos** (a especificação exige valores padrão) e escreve o **cabeçalho do objeto** (mark word e ponteiro de classe). Os detalhes da heap da JVM (gerações, layout de objetos, `-Xms`/`-Xmx`) são o assunto do tópico 4.1.6.

### Para onde vai o custo

A JVM não elimina o custo de gerenciar memória; ela **o desloca para o Garbage Collector**. Alocar é barato porque a liberação foi adiada e agrupada: periodicamente o GC encontra os objetos vivos a partir das *GC roots* (variáveis nas stacks das threads, campos estáticos etc.), copia ou compacta os vivos e declara todo o resto livre de uma vez. Num coletor de cópia, o trabalho é proporcional aos objetos **vivos**, não aos mortos, o que torna objetos de vida muito curta quase gratuitos de coletar (hipótese geracional, tópicos 4.1.8 e 4.1.10).

"Quase gratuito" não é gratuito. Uma **alta taxa de alocação** enche o eden mais rápido e provoca coletas jovens mais frequentes; cada coleta tem pausas e consome CPU; objetos que sobrevivem por pouco são copiados entre áreas e podem ser promovidos para a geração velha, onde coletar é caro; e escrever em memória nova polui o cache. Reduzir alocações desnecessárias em caminhos quentes continua sendo uma otimização real.

## Diagrama: Alocação com TLABs no eden

```text
 eden (contíguo, esvaziado a cada coleta jovem)
 ┌───────────────────────┬───────────────────────┬───────────────┬──────────────┐
 │ TLAB da thread T1     │ TLAB da thread T2     │ objeto grande │   livre      │
 │ [obj][obj][obj]│livre │ [obj][obj]│  livre    │ (fora de TLAB)│              │
 └────────────────▲──────┴───────────▲───────────┴───────────────┴▲─────────────┘
                  │                  │                            │
              topo de T1         topo de T2              topo do eden (CAS)
          (bump sem lock)     (bump sem lock)       usado só para pegar um novo
                                                    TLAB ou alocar fora dele
```

## Leaks em Java e OutOfMemoryError

### Memory leak: referências retidas

O GC libera objetos **inalcançáveis**. Ele não tem como saber se um objeto alcançável ainda será usado. Um leak em Java é, portanto, um objeto que continua alcançável a partir de alguma GC root, mas que o programa nunca mais vai usar.

```java
public class SessaoService {
    // campo estático = GC root enquanto a classe estiver carregada
    private static final Map<String, Sessao> SESSOES = new HashMap<>();

    public void login(String usuario) {
        SESSOES.put(usuario + ":" + System.nanoTime(), new Sessao(usuario));
    }

    public void logout(String usuario) {
        // esqueceu de remover: cada login acumula para sempre
    }
}
```

Os padrões clássicos são coleções estáticas que só crescem, caches sem limite nem expiração, listeners registrados e nunca removidos, e `ThreadLocal` em threads de pool que nunca morrem. A diferença para C é que não existe use-after-free nem double free: enquanto houver referência, o objeto existe; e sem referência, ele será coletado. O tema é aprofundado no tópico 4.1.12.

### OutOfMemoryError: Java heap space e heap dump

Quando a JVM não consegue atender uma alocação **mesmo depois de executar o GC**, e o heap já está em `-Xmx`, ela lança `java.lang.OutOfMemoryError: Java heap space`. As causas são três, e o diagnóstico muda conforme o caso:

1. **Leak**: a ocupação do heap após cada coleta completa sobe continuamente até estourar.
2. **Dimensionamento**: a aplicação precisa legitimamente de mais memória do que `-Xmx` (por padrão, 25% da RAM ou do limite do container).
3. **Pico**: uma única operação tenta materializar dados enormes (carregar uma tabela inteira, ler um arquivo de 2 GB num `byte[]`).

A ferramenta principal é o **heap dump**: um arquivo `.hprof` com todos os objetos do heap e as referências entre eles.

```bash
# gerar automaticamente no momento do OOM (recomendado em produção)
java -Xmx512m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/dumps -jar app.jar

# gerar sob demanda de um processo em execução
jcmd <pid> GC.heap_dump /tmp/dumps/heap.hprof
```

O dump é aberto no **Eclipse MAT**, no VisualVM ou no IntelliJ. O conceito central é o **retained size**: quanta memória seria liberada se aquele objeto sumisse. A **dominator tree** ordena objetos por retained size; num leak típico, o topo da árvore é uma única coleção (por exemplo, o `HashMap` estático acima) que retém 90% do heap, e o caminho até a GC root ("path to GC roots") mostra qual campo a segura. Variantes como `Metaspace`, `Direct buffer memory` e `unable to create native thread` têm outras causas e são tratadas no tópico 4.1.13.

## [Adicional] A JVM também usa malloc

O heap Java não é toda a memória de um processo Java. A própria JVM, escrita em C++, usa `malloc` para o código compilado pelo JIT, metadados de classes (metaspace), estruturas do GC, stacks das threads e buffers diretos (`ByteBuffer.allocateDirect`, usados por Netty e drivers). Por isso o RSS de um serviço Java costuma ser bem maior que `-Xmx`, e é por isso que containers com limite de memória exatamente igual ao `-Xmx` são mortos pelo OOM killer do kernel. O *Native Memory Tracking* (`-XX:NativeMemoryTracking=summary` e `jcmd <pid> VM.native_memory`) mostra essa memória por categoria. Em Linux, a fragmentação das arenas do glibc é uma causa conhecida de RSS crescente em processos Java; reduzir `MALLOC_ARENA_MAX` ou trocar o alocador por jemalloc é uma correção comum.

## Custos, limitações e uso em sistemas reais

- **Quando usar o heap:** sempre que o dado precisar sobreviver ao escopo, tiver tamanho decidido em runtime ou for grande. Em Java não há escolha explícita: `new` vai para o heap, e a JVM otimiza o que puder.
- **Custo em C:** `malloc`/`free` são rápidos no caminho comum, mas imprevisíveis: syscalls, page faults, contenção de arenas e fragmentação aparecem em processos de longa duração. Sistemas de alto desempenho usam *pools* e *arenas* próprias (alocar muitos objetos e liberar todos de uma vez, como faz um servidor HTTP por requisição).
- **Custo em Java:** alocar é barato (bump pointer no TLAB), mas a taxa de alocação dirige a frequência do GC. Medir alocação com JFR ou async-profiler em modo `alloc` é tão importante quanto medir CPU.
- **Segurança:** a maior parte das vulnerabilidades críticas em software C/C++ vem de erros de heap (use-after-free, buffer overflow). Linguagens com GC ou com ownership verificado (Rust) eliminam essas classes de bug por construção.
- **Diagnóstico:** em C, sanitizers e Valgrind; em Java, logs de GC, `jcmd`, heap dumps e a dominator tree. Configure `-XX:+HeapDumpOnOutOfMemoryError` em todo serviço em produção: o dump do momento do erro vale mais do que qualquer reprodução posterior.

## Comparar stack e heap em uma tabela de custo, tempo de vida, tamanho e responsável pela liberação

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Stack", "Heap", "Alocação dinâmica", "Garbage Collector"]}
```

### Enunciado

Monte uma tabela comparando stack e heap e, em seguida, use-a para decidir onde cada dado do trecho abaixo precisa viver e por quê.

```java
public class Carrinho {
    private final List<Item> itens = new ArrayList<>();

    public Item adicionar(String sku, int qtd) {
        int limite = 99;
        if (qtd > limite) throw new IllegalArgumentException();
        Item novo = new Item(sku, qtd);
        itens.add(novo);
        return novo;
    }
}
```

### Objetivo

Consolidar as diferenças entre as duas regiões e saber justificar quando um dado precisa ir para o heap.

### Instruções

1. Crie uma tabela com as linhas: custo de alocação, custo de liberação, tempo de vida, tamanho máximo, visibilidade entre threads, responsável pela liberação (em C e em Java) e bugs típicos.
2. Preencha as colunas "Stack" e "Heap".
3. Para o método `adicionar`, classifique `sku`, `qtd`, `limite`, a referência `novo`, o objeto `Item`, o `ArrayList` e a `String` apontada por `sku`.
4. Explique em duas ou três frases por que o objeto `Item` não poderia viver no frame de `adicionar`.
5. Explique por que a existência do heap motiva um Garbage Collector.

### Dicas

- Pense no que acontece com o frame quando `adicionar` retorna e quem ainda aponta para o `Item`.
- Em C, quem chama `free`? Em Java, quem decide que o objeto pode ser reaproveitado?
- O GC existe porque, no heap, o tempo de vida é arbitrário: ninguém além do programa (ou de um rastreador de referências) sabe quando o último uso aconteceu.

### Critérios de avaliação

- A tabela tem todas as linhas pedidas, com valores corretos (stack: ~1 instrução, escopo da função, ~1 MB por thread, privada; heap: alocador/GC, tempo de vida arbitrário, limitado por `-Xmx`/memória virtual, compartilhado).
- Indica corretamente responsável pela liberação: stack automática no retorno; heap via `free` em C e via GC em Java.
- Classifica corretamente as variáveis: `sku` (referência), `qtd`, `limite`, `novo` na stack; `Item`, `ArrayList` e `String` no heap.
- Justifica que o `Item` escapa do método (é devolvido e guardado na lista), logo precisa sobreviver ao frame.
- Relaciona o GC ao tempo de vida arbitrário e aos bugs de liberação manual.

### Solução de referência

| Aspecto | Stack | Heap |
|---|---|---|
| Custo de alocação | Subtrair do stack pointer: ~1 instrução | C: `malloc` busca em caches/free lists, dezenas de ns no caminho rápido. Java: bump pointer no TLAB, poucas instruções |
| Custo de liberação | Zero: implícita no `ret` | C: `free` (cabeçalho, coalescência). Java: adiada para o GC, que paga pelo trabalho de achar os vivos |
| Tempo de vida | Limitado ao escopo da função | Arbitrário: até `free` (C) ou até ficar inalcançável (Java) |
| Tamanho máximo | Fixo por thread (`-Xss`, ~1 MB típico) | Limitado por `-Xmx` (Java) ou memória virtual (C) |
| Visibilidade | Privada da thread | Compartilhado por todas as threads |
| Quem libera | Automático (retorno da função) | C: o programador. Java: o Garbage Collector |
| Bugs típicos | `StackOverflowError`, ponteiro para local | Leak, use-after-free, double free, fragmentação; em Java, leak por referência retida e `OutOfMemoryError` |

No método `adicionar`:

- **Stack (frame de `adicionar`)**: a referência `sku`, o `int qtd`, o `int limite`, a referência `novo` e a referência implícita `this`.
- **Heap**: o objeto `Item`, o `ArrayList` (campo de `Carrinho`, que também está no heap), o array interno do `ArrayList` e a `String` apontada por `sku`.

O `Item` não pode viver no frame porque **escapa** do método: é guardado em `itens` e devolvido ao chamador. Quando `adicionar` retorna, seu frame é descartado; se o objeto estivesse ali, a lista e o chamador teriam referências para memória que logo seria sobrescrita pela próxima chamada.

O heap motiva o GC porque o tempo de vida dos objetos não segue a ordem LIFO das chamadas. Em C, o programador precisa acertar sempre o momento do `free`, e errar gera leaks, use-after-free ou double free. A JVM elimina essas classes de bug rastreando quais objetos ainda são alcançáveis a partir das GC roots e liberando o resto.

## Encontrar memory leak e use-after-free em um programa C usando AddressSanitizer

```meta
{"type": "bug_hunt", "level": 2, "required": true, "knowledge": ["malloc/free", "AddressSanitizer", "Memory leak", "Use-after-free"]}
```

### Enunciado

O programa abaixo compila sem avisos e, em muitas máquinas, até imprime a saída esperada. Mesmo assim, ele tem dois bugs de heap. Use o AddressSanitizer para encontrá-los e corrija o programa.

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char *nome;
    int quantidade;
} Item;

Item *item_novo(const char *nome, int qtd) {
    Item *it = malloc(sizeof *it);
    it->nome = malloc(strlen(nome) + 1);
    strcpy(it->nome, nome);
    it->quantidade = qtd;
    return it;
}

void item_liberar(Item *it) {
    free(it);
}

const char *descrever(const Item *it) {
    static char buf[64];
    snprintf(buf, sizeof buf, "%s x%d", it->nome, it->quantidade);
    return buf;
}

int main(void) {
    Item *itens[3];
    itens[0] = item_novo("caneta", 10);
    itens[1] = item_novo("caderno", 2);
    itens[2] = item_novo("borracha", 5);

    int total = 0;
    for (int i = 0; i < 3; i++) {
        total += itens[i]->quantidade;
        item_liberar(itens[i]);
    }
    printf("Total: %d\n", total);
    printf("Ultimo: %s\n", descrever(itens[2]));
    return 0;
}
```

### Objetivo

Reconhecer na prática os dois bugs de heap mais comuns em C e aprender a ler o relatório de um sanitizer.

### Instruções

1. Compile normalmente (`gcc -g heap.c -o heap`) e rode. Anote o que acontece.
2. Compile com `gcc -g -fsanitize=address -fno-omit-frame-pointer heap.c -o heap` e rode de novo.
3. Leia o relatório: qual o tipo do erro, em que linha ele foi detectado, onde o bloco foi alocado e onde foi liberado?
4. Corrija esse primeiro bug e rode de novo. Um segundo relatório deve aparecer no fim da execução. Qual é?
5. Corrija o segundo bug e confirme que o ASan não relata mais nada.
6. Explique por que a versão sem sanitizer "funcionou".

Ambiente: AddressSanitizer com detecção de leaks funciona em Linux (gcc ou clang). No Windows, use WSL ou um container (`docker run --rm -it -v "$PWD":/w -w /w gcc:13 bash`). O `/fsanitize=address` do MSVC detecta o use-after-free, mas não relata leaks; como alternativa no Linux, `valgrind --leak-check=full ./heap` encontra ambos sem recompilar.

### Dicas

- O ASan para no primeiro erro de acesso inválido. O relatório de leaks só aparece quando o programa termina normalmente.
- Leia as três stacks do relatório de use-after-free: a do acesso, a do `free` e a do `malloc`.
- Cada `Item` tem **dois** blocos no heap. Quantos `free` existem para cada um?

### Critérios de avaliação

- Identifica o `heap-use-after-free` em `descrever(itens[2])`, que lê `it->nome` de um `Item` já liberado.
- Identifica o leak dos três blocos de `nome` (ASan relata algo como `Direct leak of 24 byte(s) in 3 object(s)`, alocados em `item_novo`).
- Corrige `item_liberar` para liberar `it->nome` antes de `it`, e reordena o código para usar o item antes de liberá-lo.
- A versão corrigida roda com ASan sem nenhum relatório.
- Explica que o bloco liberado continua mapeado e seus bytes geralmente continuam lá até serem reutilizados, por isso o bug pode passar despercebido sem ferramenta.

### Solução de referência

**Primeira execução com ASan** (resumida):

```text
==12345==ERROR: AddressSanitizer: heap-use-after-free on address 0x602000000050
READ of size 8 at 0x602000000050 thread T0
    #0 in descrever heap.c:24
    #1 in main heap.c:40
freed by thread T0 here:
    #0 in free
    #1 in item_liberar heap.c:19
    #2 in main heap.c:37
previously allocated by thread T0 here:
    #0 in malloc
    #1 in item_novo heap.c:11
    #2 in main heap.c:32
```

O erro é a leitura de `it->nome` (8 bytes, um ponteiro) dentro de `descrever`, sobre um `Item` liberado no laço. Endereços e números de linha variam; se o compilador avaliar `it->quantidade` primeiro, o relatório dirá `READ of size 4`, mas o diagnóstico é o mesmo.

**Segunda execução** (após reordenar), no fim do programa:

```text
==12346==ERROR: LeakSanitizer: detected memory leaks
Direct leak of 24 byte(s) in 3 object(s) allocated from:
    #0 in malloc
    #1 in item_novo heap.c:12
SUMMARY: AddressSanitizer: 24 byte(s) leaked in 3 allocation(s).
```

São os nomes `"caneta"` (7 bytes), `"caderno"` (8) e `"borracha"` (9): 24 bytes. `item_liberar` libera a struct, mas não o bloco apontado por `nome`; ao liberar a struct, a única referência a esse bloco se perde.

**Versão corrigida:**

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char *nome;
    int quantidade;
} Item;

Item *item_novo(const char *nome, int qtd) {
    Item *it = malloc(sizeof *it);
    if (!it) return NULL;
    it->nome = malloc(strlen(nome) + 1);
    if (!it->nome) { free(it); return NULL; }
    strcpy(it->nome, nome);
    it->quantidade = qtd;
    return it;
}

void item_liberar(Item *it) {
    if (!it) return;
    free(it->nome);   /* primeiro o que a struct possui */
    free(it);         /* depois a própria struct */
}

const char *descrever(const Item *it) {
    static char buf[64];
    snprintf(buf, sizeof buf, "%s x%d", it->nome, it->quantidade);
    return buf;
}

int main(void) {
    Item *itens[3];
    itens[0] = item_novo("caneta", 10);
    itens[1] = item_novo("caderno", 2);
    itens[2] = item_novo("borracha", 5);

    int total = 0;
    for (int i = 0; i < 3; i++) total += itens[i]->quantidade;
    printf("Total: %d\n", total);
    printf("Ultimo: %s\n", descrever(itens[2]));  /* usa antes de liberar */

    for (int i = 0; i < 3; i++) {
        item_liberar(itens[i]);
        itens[i] = NULL;   /* evita reuso acidental do ponteiro pendente */
    }
    return 0;
}
```

**Por que funcionava sem sanitizer:** `free` não apaga nem desmapeia o bloco; ele apenas o devolve a uma free list (no glibc, primeiro ao tcache da thread). O alocador escreve seus ponteiros internos nos primeiros bytes do bloco liberado, mas o resto costuma permanecer intacto até um próximo `malloc` reaproveitá-lo. Como nenhum `malloc` acontece entre o laço e o `printf`, o lixo ainda parece um dado válido. O ASan troca esse comportamento silencioso por um erro imediato: ele marca os bytes liberados como "envenenados" na shadow memory e mantém o bloco em quarentena para não reaproveitá-lo logo.

## Provocar OutOfMemoryError com um cache estático sem limite e analisar o heap dump

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["OutOfMemoryError", "Heap dump", "Retained size", "Dominator tree"]}
```

### Enunciado

Um serviço usa um cache estático para guardar relatórios gerados. Em produção, depois de algumas horas, ele morre com `OutOfMemoryError: Java heap space`. Reproduza o problema em miniatura, capture o heap dump no momento do erro e use-o para provar qual estrutura retém a memória.

```java
import java.util.HashMap;
import java.util.Map;

public class CacheSemLimite {
    static final Map<Long, byte[]> CACHE = new HashMap<>();

    static byte[] carregarRelatorio(long id) {
        return CACHE.computeIfAbsent(id, k -> new byte[10 * 1024]); // simula um relatório de 10 KB
    }

    public static void main(String[] args) {
        long id = 0;
        while (true) {
            carregarRelatorio(id++);           // cada id é novo: o cache nunca acerta
            if (id % 1000 == 0) System.out.println("entradas: " + id);
        }
    }
}
```

### Objetivo

Praticar o fluxo completo de diagnóstico de um `OutOfMemoryError`: reproduzir, capturar evidência e localizar a causa pela dominator tree, diferenciando leak de falta de memória.

### Instruções

1. Rode com heap pequeno e dump automático: `java -Xmx64m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=heap.hprof CacheSemLimite.java`.
2. Anote quantas entradas foram inseridas antes do erro e compare com a conta `64 MB ÷ 10 KB`.
3. Em outra execução, enquanto o programa roda, observe a ocupação com `jstat -gcutil <pid> 1000` (obtenha o pid com `jps`). O que acontece com a coluna `O` (old generation) após cada coleta?
4. Abra `heap.hprof` no Eclipse MAT (ou VisualVM, ou IntelliJ). Encontre o objeto com maior *retained size* na dominator tree e o caminho até a GC root.
5. Corrija o cache para ter um limite (LRU) e mostre que o programa passa a rodar indefinidamente com `-Xmx64m`.
6. Escreva um diagnóstico de três linhas: sintoma, evidência no dump, causa e correção.

### Dicas

- O `.hprof` tem aproximadamente o tamanho do heap ocupado; com `-Xmx64m` ele é pequeno e abre rápido.
- No MAT, o relatório "Leak Suspects" costuma apontar o problema diretamente. Confirme pela dominator tree.
- `LinkedHashMap` tem um construtor com `accessOrder = true` e um método protegido `removeEldestEntry` que você pode sobrescrever.

### Critérios de avaliação

- Reproduz o `OutOfMemoryError: Java heap space` e gera o arquivo `heap.hprof`.
- Mostra que o número de entradas antes do erro é coerente com o tamanho do heap (alguns milhares, um pouco abaixo de 6.500 por causa do overhead).
- Usa `jstat` para mostrar que a old generation não volta a cair após as coletas (sintoma de leak, e não de pico).
- Identifica no dump o `HashMap` referenciado pelo campo estático `CacheSemLimite.CACHE` como dominador de quase todo o heap, com os `byte[]` como conteúdo retido.
- Implementa um cache limitado que roda indefinidamente com o mesmo `-Xmx`.

### Solução de referência

**Execução:** com `-Xmx64m`, o programa imprime algo em torno de `entradas: 5000` a `entradas: 6000` e termina com:

```text
java.lang.OutOfMemoryError: Java heap space
Dumping heap to heap.hprof ...
Heap dump file created [66xxxxxx bytes in 0.3 secs]
```

Os números exatos variam com a versão da JVM e o coletor. A conta `64 MB ÷ 10 KB ≈ 6.550` é o teto teórico; o valor real é menor porque cada entrada também gasta um `HashMap.Node`, um `Long`, o cabeçalho de cada `byte[]` e o array de buckets do `HashMap`, além do espaço que a JVM reserva para outras áreas.

**jstat:** a coluna `O` (percentual da old generation) sobe a cada coleta e nunca volta ao patamar anterior. Coletas cada vez mais frequentes recuperam cada vez menos. Esse é o padrão de leak: os objetos sobrevivem porque continuam alcançáveis.

**Heap dump (MAT):**

- *Dominator tree*: no topo, `java.util.HashMap` com retained heap próximo de 60 MB (quase 100% do heap).
- *Path to GC roots*: `HashMap` ← campo estático `CACHE` ← classe `CacheSemLimite` ← class loader (o campo estático é alcançável enquanto a classe estiver carregada).
- *Histogram*: `byte[]` domina o shallow heap, com milhares de instâncias de 10.256 bytes (10 KB mais o cabeçalho do array).

**Correção com LRU limitado:**

```java
import java.util.LinkedHashMap;
import java.util.Map;

public class CacheComLimite {
    private static final int MAX_ENTRADAS = 1_000; // ~10 MB de relatórios

    static final Map<Long, byte[]> CACHE = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<Long, byte[]> maisAntiga) {
            return size() > MAX_ENTRADAS;   // descarta a menos usada recentemente
        }
    };

    static byte[] carregarRelatorio(long id) {
        return CACHE.computeIfAbsent(id, k -> new byte[10 * 1024]);
    }

    public static void main(String[] args) {
        long id = 0;
        while (true) {
            carregarRelatorio(id++);
            if (id % 100_000 == 0) System.out.println("entradas processadas: " + id + ", no cache: " + CACHE.size());
        }
    }
}
```

Com o limite, o heap estabiliza em ~10 MB de dados mais overhead, e as entradas expulsas ficam inalcançáveis e são coletadas na geração jovem ou velha. Esse `LinkedHashMap` não é thread-safe; num serviço real, use uma biblioteca como Caffeine (limite por tamanho ou peso, expiração por tempo, concorrente).

**Diagnóstico:** "Sintoma: OOM Java heap space após horas, com old gen crescendo monotonamente. Evidência: o heap dump mostra `CacheSemLimite.CACHE` (HashMap estático) retendo ~95% do heap em `byte[]`. Causa e correção: cache sem política de expiração nem limite; substituído por cache LRU limitado a 1.000 entradas."

## Explicar por que alocar objetos em Java é barato, mas criar muitos objetos de vida curta ainda tem custo

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["TLAB", "Bump pointer", "Garbage Collector", "Taxa de alocação"]}
```

### Enunciado

Numa entrevista para uma vaga de backend, o entrevistador diz: *"Ouvi dizer que em Java alocar é quase de graça, então não preciso me preocupar com quantos objetos crio num endpoint. Você concorda?"*. Escreva a resposta como se estivesse falando (até três minutos) e depois analise o trecho abaixo, executado milhões de vezes por minuto.

```java
public BigDecimal totalDoPedido(List<ItemPedido> itens) {
    return itens.stream()
        .map(i -> new BigDecimal(i.precoCentavos()).multiply(BigDecimal.valueOf(i.quantidade())))
        .reduce(BigDecimal.ZERO, BigDecimal::add)
        .movePointLeft(2);
}
```

### Objetivo

Explicar com precisão o mecanismo de alocação da JVM e para onde o custo de memória é deslocado, sem cair nos extremos "é grátis" ou "evite criar objetos".

### Instruções

1. Explique por que a alocação em si é barata (o que é o bump pointer e o TLAB, e por que não há free list nem lock).
2. Explique o que torna isso possível (o papel do GC compactador/de cópia).
3. Liste os custos que não desaparecem quando muitos objetos de vida curta são criados.
4. Analise o trecho: quais objetos são criados por chamada? Algum deles pode ser eliminado pelo JIT?
5. Diga como você mediria se isso é um problema real antes de otimizar.

### Dicas

- Pense no que dispara uma coleta jovem e no que o coletor faz com objetos mortos e com os vivos.
- Alocar envolve mais que mover um ponteiro: a memória precisa ser zerada e o cabeçalho escrito.
- Ferramentas: logs de GC (`-Xlog:gc`), JFR (eventos de alocação), async-profiler com `-e alloc`.

### Critérios de avaliação

- Explica o bump pointer dentro do TLAB e por que dispensa sincronização e busca por espaço livre.
- Relaciona a viabilidade do bump pointer ao GC que mantém o eden contíguo (esvaziado/copiado a cada coleta jovem).
- Cita ao menos três custos remanescentes: coletas jovens mais frequentes, CPU e pausas do GC, cópia e promoção de sobreviventes, zeroing e escrita de cabeçalho, pressão sobre cache e banda de memória.
- Identifica as alocações do trecho (BigDecimal por item, resultado de `multiply`, de `add`, objetos do stream/lambda) e menciona escape analysis como possível, mas não garantida.
- Propõe medir (taxa de alocação, frequência de GC, profiler de alocação) antes de otimizar.

### Solução de referência

**Resposta falada (modelo):**

"Concordo pela metade. A *alocação* em si é baratíssima. A HotSpot dá a cada thread um TLAB, um pedaço privado do eden. Criar um objeto é somar o tamanho dele a um ponteiro e comparar com o fim do buffer: poucas instruções, sem lock, sem procurar espaço livre. Isso só é possível porque o coletor da geração jovem copia os sobreviventes para fora e deixa o eden inteiro livre e contíguo; não há buracos para administrar.

O custo não sumiu, ele foi para o GC. Quanto mais eu aloco, mais rápido o eden enche e mais coletas jovens acontecem. Cada coleta gasta CPU e, dependendo do coletor, pausa as threads da aplicação. Se os objetos realmente morrem antes da coleta, ela é barata, porque o trabalho é proporcional aos vivos. Mas, sob carga, objetos que deviam ser curtos às vezes estão vivos no momento da coleta (uma requisição em andamento), são copiados para survivor e podem ser promovidos para a old generation, onde coletar é bem mais caro. Além disso, toda memória nova precisa ser zerada e passa pelo cache, então uma taxa de alocação de vários GB/s consome banda de memória e expulsa dados úteis do cache.

Então eu não me preocupo com objetos em código comum, mas em caminhos muito quentes eu meço a taxa de alocação e reduzo o desnecessário."

**Análise do trecho:** por item, são criados um `BigDecimal` (construtor), um `BigDecimal` de `valueOf` (para quantidades pequenas pode vir de um cache interno; não conte com isso), o resultado de `multiply` e o resultado de `add` no `reduce`. O pipeline também cria objetos do `Stream`, do `Spliterator`, lambdas e possivelmente o `BigInteger` interno quando os valores são grandes. No fim, `movePointLeft` cria mais um. São vários objetos por item e por chamada. A escape analysis do C2 pode eliminar alguns deles se o pipeline inteiro for inlined, mas isso é frágil (depende de tamanho de método, polimorfismo e profundidade de inlining).

Uma versão com menos alocação, se a medição justificar, trabalha em `long`:

```java
public BigDecimal totalDoPedido(List<ItemPedido> itens) {
    long totalCentavos = 0;
    for (ItemPedido i : itens) {
        totalCentavos = Math.addExact(totalCentavos, Math.multiplyExact(i.precoCentavos(), (long) i.quantidade()));
    }
    return BigDecimal.valueOf(totalCentavos, 2);   // uma única alocação no fim
}
```

**Como medir antes:** ativar `-Xlog:gc` e observar a frequência e a duração das coletas jovens; gravar com JFR (`jcmd <pid> JFR.start duration=60s filename=app.jfr`) e olhar a taxa de alocação e os *top allocation sites*; ou usar `async-profiler -e alloc` para um flame graph de alocações. Só otimizar se esse método aparecer entre os maiores alocadores e o GC estiver de fato impactando latência ou CPU.

## Implementar um alocador simples de bloco fixo (free list) em C e medir fragmentação

```meta
{"type": "implementation", "level": 4, "required": false, "knowledge": ["Free list intrusiva", "Fragmentação interna", "Fragmentação externa", "Size classes"]}
```

### Enunciado

Implemente em C um *pool allocator* de blocos de tamanho fixo, com free list intrusiva, e use-o para medir fragmentação interna e um indicador de fragmentação externa. Depois, compare com uma versão com quatro size classes.

### Objetivo

Construir com as próprias mãos as estruturas que um alocador real usa e ver, com números, o trade-off entre simplicidade, velocidade e desperdício.

### Instruções

1. Defina um `Pool` que reserve, com um único `malloc`, `N` blocos de `B` bytes (arredonde `B` para múltiplo de 16).
2. Mantenha a free list **dentro** dos blocos livres: os primeiros bytes de cada bloco livre guardam o ponteiro para o próximo.
3. Implemente `pool_alocar(pool, n)` e `pool_liberar(pool, ptr)`, ambos O(1). `pool_alocar` deve recusar pedidos maiores que `B`.
4. Faça `pool_liberar` detectar ponteiros que não pertencem ao pool e double free (guarde, por bloco, o tamanho pedido; zero significa livre).
5. Meça a **fragmentação interna**: `1 - bytes_pedidos / (blocos_em_uso × B)`, alocando 10.000 pedidos com tamanhos aleatórios entre 1 e 64 num pool de blocos de 64 bytes.
6. Libere aleatoriamente metade dos blocos e meça a memória livre total e a **maior sequência contígua de blocos livres**. Explique o que esse número significaria para um alocador de tamanho variável.
7. Repita a medição de fragmentação interna com quatro pools (16, 32, 48 e 64 bytes), escolhendo o pool pelo tamanho pedido.
8. Discuta os resultados.

### Dicas

- O índice de um bloco é `(ptr - memoria) / B`. Use-o para validar o ponteiro e para consultar o tamanho pedido.
- Para que o primeiro `pool_alocar` devolva o bloco 0, monte a lista empilhando os blocos do último para o primeiro.
- Com tamanhos uniformes de 1 a 64, o pedido médio é 32,5 bytes. Calcule de antemão o desperdício esperado com blocos de 64 e com classes de 16 em 16 para conferir seus números.

### Critérios de avaliação

- O código compila sem avisos com `gcc -Wall -Wextra -std=c11` e não tem leaks nem erros sob AddressSanitizer.
- `pool_alocar` e `pool_liberar` são O(1) e a free list não usa memória fora dos blocos.
- Detecta e recusa double free e ponteiros inválidos.
- Mede fragmentação interna próxima de 49% para bloco único de 64 bytes e próxima de 19% com as quatro classes, e explica a origem desses valores.
- Mostra que, após liberar metade dos blocos, há centenas de KB livres, mas a maior sequência contígua tem apenas algumas centenas de bytes, e explica por que isso não afeta o pool de bloco fixo, mas afetaria um alocador de tamanho variável.
- Discute o trade-off das size classes (menos fragmentação interna, mas blocos livres de uma classe não servem a outra).

### Solução de referência

```c
#include <stdio.h>
#include <stdlib.h>
#include <stddef.h>

typedef struct Livre { struct Livre *prox; } Livre;

typedef struct {
    unsigned char *memoria;   /* N blocos contíguos */
    size_t *pedido;           /* tamanho pedido por bloco; 0 = livre */
    size_t tam_bloco;
    size_t num_blocos;
    Livre *livres;            /* cabeça da free list intrusiva */
    size_t em_uso;
    size_t bytes_pedidos;
} Pool;

int pool_iniciar(Pool *p, size_t tam_bloco, size_t num_blocos) {
    if (tam_bloco < sizeof(Livre)) tam_bloco = sizeof(Livre);
    tam_bloco = (tam_bloco + 15) & ~(size_t)15;       /* múltiplo de 16 */
    p->memoria = malloc(tam_bloco * num_blocos);
    p->pedido = calloc(num_blocos, sizeof *p->pedido);
    if (!p->memoria || !p->pedido) { free(p->memoria); free(p->pedido); return -1; }
    p->tam_bloco = tam_bloco;
    p->num_blocos = num_blocos;
    p->em_uso = 0;
    p->bytes_pedidos = 0;
    p->livres = NULL;
    for (size_t i = num_blocos; i-- > 0;) {           /* do último ao primeiro */
        Livre *b = (Livre *)(p->memoria + i * tam_bloco);
        b->prox = p->livres;
        p->livres = b;
    }
    return 0;
}

void pool_destruir(Pool *p) {
    free(p->memoria);
    free(p->pedido);
    p->memoria = NULL;
    p->pedido = NULL;
    p->livres = NULL;
}

void *pool_alocar(Pool *p, size_t n) {
    if (n == 0 || n > p->tam_bloco || p->livres == NULL) return NULL;
    Livre *b = p->livres;                              /* pop: O(1) */
    p->livres = b->prox;
    size_t i = (size_t)((unsigned char *)b - p->memoria) / p->tam_bloco;
    p->pedido[i] = n;
    p->em_uso++;
    p->bytes_pedidos += n;
    return b;
}

/* 0 = ok, -1 = ponteiro inválido, -2 = double free */
int pool_liberar(Pool *p, void *ptr) {
    if (ptr == NULL) return 0;
    unsigned char *c = ptr;
    unsigned char *fim = p->memoria + p->tam_bloco * p->num_blocos;
    if (c < p->memoria || c >= fim) return -1;
    size_t off = (size_t)(c - p->memoria);
    if (off % p->tam_bloco != 0) return -1;            /* não é início de bloco */
    size_t i = off / p->tam_bloco;
    if (p->pedido[i] == 0) return -2;                  /* já estava livre */
    p->bytes_pedidos -= p->pedido[i];
    p->pedido[i] = 0;
    p->em_uso--;
    Livre *b = ptr;                                    /* push: O(1) */
    b->prox = p->livres;
    p->livres = b;
    return 0;
}

double frag_interna(const Pool *p) {
    if (p->em_uso == 0) return 0.0;
    return 1.0 - (double)p->bytes_pedidos / (double)(p->em_uso * p->tam_bloco);
}

size_t maior_sequencia_livre(const Pool *p) {
    size_t maior = 0, atual = 0;
    for (size_t i = 0; i < p->num_blocos; i++) {
        if (p->pedido[i] == 0) { if (++atual > maior) maior = atual; }
        else atual = 0;
    }
    return maior;
}

#define N 10000

int main(void) {
    srand(42);

    /* 1. Bloco único de 64 bytes */
    Pool p;
    if (pool_iniciar(&p, 64, N) != 0) return 1;
    void *ptrs[N];
    for (int i = 0; i < N; i++) ptrs[i] = pool_alocar(&p, (size_t)(rand() % 64) + 1);
    printf("[bloco 64] em uso: %zu, fragmentacao interna: %.1f%%\n",
           p.em_uso, 100.0 * frag_interna(&p));

    /* 2. Liberar metade aleatoriamente */
    for (int i = 0; i < N; i++) {
        if (rand() % 2) { pool_liberar(&p, ptrs[i]); ptrs[i] = NULL; }
    }
    size_t livres = p.num_blocos - p.em_uso;
    size_t seq = maior_sequencia_livre(&p);
    printf("[bloco 64] livres: %zu blocos (%zu bytes), maior sequencia contigua: %zu blocos (%zu bytes)\n",
           livres, livres * p.tam_bloco, seq, seq * p.tam_bloco);

    /* 3. Validações */
    /* chamadas em sequência: a ordem de avaliação de argumentos em C não é definida */
    void *x = pool_alocar(&p, 10);
    int r_ok = pool_liberar(&p, x);
    int r_duplo = pool_liberar(&p, x);
    int r_invalido = pool_liberar(&p, (char *)x + 1);
    void *grande = pool_alocar(&p, 65);
    printf("liberar ok: %d, double free: %d, invalido: %d, pedido de 65 bytes: %p\n",
           r_ok, r_duplo, r_invalido, grande);

    for (int i = 0; i < N; i++) pool_liberar(&p, ptrs[i]);
    pool_destruir(&p);

    /* 4. Quatro size classes: 16, 32, 48, 64 */
    Pool classes[4];
    for (int c = 0; c < 4; c++)
        if (pool_iniciar(&classes[c], (size_t)(c + 1) * 16, N) != 0) return 1;
    size_t pedidos = 0, entregues = 0;
    for (int i = 0; i < N; i++) {
        size_t n = (size_t)(rand() % 64) + 1;
        int c = (int)((n + 15) / 16) - 1;              /* 1..16 -> 0, 17..32 -> 1, ... */
        if (pool_alocar(&classes[c], n)) { pedidos += n; entregues += classes[c].tam_bloco; }
    }
    printf("[4 classes] fragmentacao interna: %.1f%%\n", 100.0 * (1.0 - (double)pedidos / (double)entregues));
    for (int c = 0; c < 4; c++) pool_destruir(&classes[c]);
    return 0;
}
```

Compile e rode: `gcc -Wall -Wextra -std=c11 -g -fsanitize=address pool.c -o pool && ./pool`. Saída ilustrativa (os números dependem do `rand()` da sua libc):

```text
[bloco 64] em uso: 10000, fragmentacao interna: 49.2%
[bloco 64] livres: 5012 blocos (320768 bytes), maior sequencia contigua: 13 blocos (832 bytes)
liberar ok: 0, double free: -2, invalido: -1, pedido de 65 bytes: (nil)
[4 classes] fragmentacao interna: 18.8%
```

**Discussão:**

- **Interna com bloco único:** o pedido médio é 32,5 bytes e o bloco é 64, então o desperdício esperado é `1 - 32,5/64 ≈ 49%`. É o preço da simplicidade: O(1) absoluto, zero cabeçalho por bloco (o tamanho pedido só é guardado aqui para medir e validar) e nenhuma busca.
- **Interna com size classes:** cada classe recebe 16 tamanhos; o bloco médio entregue é `(16+32+48+64)/4 = 40` e o pedido médio continua 32,5, logo `1 - 32,5/40 ≈ 19%`. É por isso que alocadores reais têm dezenas de classes, espaçadas de forma aproximadamente geométrica.
- **Externa:** após liberar metade, ~320 KB estão livres, mas a maior faixa contígua tem poucas centenas de bytes (para probabilidade 1/2, a maior sequência entre 10.000 blocos fica em torno de `log2(5000) ≈ 12`). No pool de bloco fixo isso **não importa**: qualquer bloco livre atende qualquer pedido permitido, então não há fragmentação externa dentro do pool. Num alocador de tamanho variável, essa mesma configuração seria fatal: um pedido de 4 KB falharia mesmo com 320 KB livres. A versão com classes mostra outra forma do problema: blocos livres na classe de 16 não servem a um pedido de 64, então a memória ociosa de uma classe não ajuda as outras.
- **Por que C não compacta:** para juntar os buracos seria preciso mover blocos, o que invalidaria os ponteiros que o programa guarda. A JVM pode fazer isso porque conhece todas as referências; é a compactação que permite a alocação por bump pointer.

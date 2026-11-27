## O que a CPU realmente faz

Um programa, no fim das contas, é uma sequência de **instruções** muito simples: "some estes dois números", "copie este valor da memória para cá", "se o resultado foi zero, pule para aquele endereço". A **CPU** (*Central Processing Unit*) é o circuito que executa essas instruções, uma após a outra, bilhões de vezes por segundo.

Tudo o que você escreve em Java, seja um `for`, um `HashMap.get` ou uma chamada a um controller Spring, acaba virando, depois do `javac` e do JIT da JVM, uma sequência desse tipo de instrução elementar (tópico 1.1.3). Entender como a CPU as executa explica fenômenos que a análise de complexidade (O(n), O(log n)) não explica: por que percorrer um array é muito mais rápido que percorrer uma lista ligada com o mesmo número de elementos, por que um `if` pode custar mais em dados desordenados do que em dados ordenados, e por que dobrar o clock não dobra o desempenho.

O ponto central deste tópico é que a CPU moderna é **muito mais rápida do que a memória que a alimenta**. Quase toda a complexidade do hardware (caches, pipeline, previsão de desvios, execução fora de ordem) existe para esconder essa diferença. E quase todo código de alto desempenho é código que coopera com esses mecanismos.

## Componentes essenciais: registradores, PC, ALU e unidade de controle

Um núcleo de CPU (*core*) pode ser entendido, num primeiro modelo, por quatro peças:

- **Registradores**: pequenas posições de armazenamento dentro da própria CPU, lidas e escritas em um ciclo de clock ou menos. São poucos: x86-64 tem 16 registradores de uso geral de 64 bits (`rax`, `rbx`, `rcx`, `rdx`, `rsi`, `rdi`, `rbp`, `rsp`, `r8`–`r15`); ARM64 tem 31 (`x0`–`x30`). Além deles existem registradores vetoriais (SSE/AVX em x86, NEON/SVE em ARM) e registradores de controle.
- **Program counter (PC)**: registrador especial que guarda o endereço da **próxima instrução** a executar. Em x86-64 ele se chama `rip` (*instruction pointer*). Um salto (`jmp`), uma chamada (`call`) ou um retorno (`ret`) nada mais são do que escritas no PC.
- **ALU** (*Arithmetic Logic Unit*): o circuito combinacional que faz as operações aritméticas (soma, subtração, comparação) e lógicas (AND, OR, XOR, deslocamentos). Ela recebe operandos, produz um resultado e atualiza **flags** (zero, carry, sinal, overflow) usadas por desvios condicionais. Multiplicação, divisão e ponto flutuante ficam em unidades próprias, com latências maiores (uma divisão inteira de 64 bits pode custar dezenas de ciclos, contra 1 ciclo de uma soma).
- **Unidade de controle**: decodifica cada instrução e gera os sinais que coordenam as outras partes: quais registradores ler, qual operação a ALU faz, onde gravar o resultado.

Há ainda as unidades de **load/store**, que conversam com a memória através da hierarquia de cache, e o **clock**, o sinal periódico que dita o ritmo de tudo. Uma CPU de 3 GHz tem 3 bilhões de ciclos por segundo: cada ciclo dura cerca de 0,33 ns. Guarde esse número; ele será a régua para medir latências mais adiante.

## Diagrama: Ciclo fetch-decode-execute

```text
            ┌─────────────────────────────────────────────────────┐
            │                                                     │
            ▼                                                     │
   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐│
   │ 1. FETCH        │   │ 2. DECODE       │   │ 3. EXECUTE      ││
   │ lê bytes da     │──▶│ identifica      │──▶│ ALU / load /    ││
   │ instrução no    │   │ opcode e        │   │ store / desvio  ││
   │ endereço do PC  │   │ operandos       │   │                 ││
   └─────────────────┘   └─────────────────┘   └────────┬────────┘│
            ▲                                            │         │
            │                                            ▼         │
   ┌─────────────────┐                         ┌─────────────────┐│
   │ PC = PC + tam.  │◀────────────────────────│ 4. WRITE-BACK   ││
   │ (ou destino do  │                         │ grava resultado ││
   │  salto)         │                         │ em registrador  ││
   └─────────────────┘                         └─────────────────┘│
            └─────────────────────────────────────────────────────┘

   Exemplo:  add rax, rbx   (bytes 48 01 D8)
   FETCH   → lê 48 01 D8 do endereço em rip
   DECODE  → "ADD 64 bits, destino rax, fonte rbx"
   EXECUTE → ALU calcula rax + rbx, atualiza flags ZF/SF/CF/OF
   WRITE   → rax ← resultado;  rip ← rip + 3
```

## O ciclo de instrução em detalhe

O modelo clássico descreve cada instrução passando por etapas bem definidas:

1. **Fetch (busca).** A CPU lê, a partir do endereço guardado no PC, os bytes da instrução. Esses bytes vêm do **cache de instruções L1** (L1i); se não estiverem lá, a busca desce para L2, L3 e RAM. Em x86-64, uma instrução tem de 1 a 15 bytes, então a CPU precisa descobrir onde cada uma termina. Em ARM64, toda instrução tem exatamente 4 bytes, o que simplifica muito essa etapa.
2. **Decode (decodificação).** A unidade de controle interpreta o **opcode** (qual operação) e os campos de operandos (quais registradores, qual valor imediato, qual modo de endereçamento). Em processadores x86 modernos, a instrução é traduzida em uma ou mais **micro-operações** (µops), instruções internas mais simples e de formato fixo. Uma `add rax, [rbx+8]` vira, internamente, algo como "carregue da memória" seguido de "some".
3. **Execute (execução).** A µop é enviada para a unidade funcional adequada: ALU para aritmética, AGU (*address generation unit*) para calcular endereços, unidade de load/store para acessar memória, unidade de desvio para comparar e decidir saltos.
4. **Memory access.** Se a instrução lê ou escreve memória, essa etapa acessa o cache de dados (L1d). É aqui que um *cache miss* pode transformar uma instrução de 1 ciclo numa espera de centenas de ciclos.
5. **Write-back.** O resultado é gravado no registrador de destino e as flags são atualizadas. O PC avança para a próxima instrução (ou recebe o destino de um salto).

Para o programador, a CPU mantém a ilusão de que cada instrução termina antes de a próxima começar (o **modelo sequencial** definido pela ISA). Internamente, como veremos, isso está longe da verdade.

## Pipeline, execução superescalar e fora de ordem

Se cada instrução esperasse a anterior passar por todas as etapas, a maior parte do circuito ficaria ociosa a cada momento. O **pipeline** resolve isso como uma linha de montagem: enquanto a instrução 1 está em *execute*, a 2 está em *decode* e a 3 em *fetch*.

```text
ciclo:      1     2     3     4     5     6
instr 1    IF    ID    EX    MEM   WB
instr 2          IF    ID    EX    MEM   WB
instr 3                IF    ID    EX    MEM ...
```

Com o pipeline cheio, termina-se uma instrução por ciclo, mesmo que cada uma leve cinco ciclos do início ao fim. Ou seja, o pipeline aumenta o **throughput** (instruções por segundo), não reduz a **latência** de uma instrução individual. CPUs reais têm pipelines de 14 a 20 estágios ou mais.

Três avanços levam a ideia mais longe:

- **Superescalar**: o núcleo tem várias ALUs e unidades de load/store, e despacha várias instruções por ciclo. Núcleos modernos de x86 e ARM conseguem retirar de 4 a 8 instruções por ciclo no melhor caso. A métrica que captura isso é o **IPC** (*instructions per cycle*).
- **Execução fora de ordem** (*out-of-order*): a CPU olha uma janela de centenas de µops à frente (o *reorder buffer*), e executa as que já têm seus operandos prontos, sem esperar as anteriores que estão bloqueadas (por exemplo, aguardando a memória). Os resultados são "retirados" na ordem original, preservando a ilusão sequencial.
- **Renomeação de registradores**: há muito mais registradores físicos do que os 16 visíveis da ISA, o que elimina dependências falsas entre instruções que apenas reutilizam o mesmo nome de registrador.

O inimigo do pipeline são as **dependências**: se a instrução B precisa do resultado de A, B espera. Um laço que soma num único acumulador (`soma += a[i]`) cria uma cadeia de dependência; o compilador (ou o JIT C2) pode usar vários acumuladores ou instruções vetoriais (SIMD) para quebrá-la.

## Branch prediction e o custo de errar

Um desvio condicional (`if`, condição de `for`, `while`, `switch`) é um problema para o pipeline: na etapa de *fetch*, a CPU ainda não sabe se o salto será tomado, porque a comparação só será resolvida vários estágios depois. Esperar significaria esvaziar o pipeline a cada `if`.

A solução é **adivinhar**. O **branch predictor** mantém um histórico de cada desvio (indexado pelo endereço da instrução e pelo histórico recente de outros desvios) e prevê o resultado. A CPU então executa **especulativamente** o caminho previsto.

- Se acertou, nada se perde: o pipeline continuou cheio.
- Se errou (*branch misprediction*), todas as instruções especuladas são descartadas, o pipeline é esvaziado e a busca recomeça no caminho certo. O custo típico é da ordem de **15 a 20 ciclos** em núcleos modernos (valor aproximado, varia por microarquitetura).

Os preditores atuais acertam bem acima de 95% dos desvios em código típico, porque a maioria dos desvios é muito regular: a condição de um laço é "verdadeira, verdadeira, ..., falsa"; uma verificação de `null` quase nunca é verdadeira. O problema aparece quando o desvio depende de **dados imprevisíveis**:

```java
long soma = 0;
for (int v : dados) {
    if (v >= 128) {          // imprevisível se 'dados' for aleatório
        soma += v;
    }
}
```

Com `dados` aleatório entre 0 e 255, o preditor erra cerca de metade das vezes. Com `dados` ordenado, o padrão vira "falso, falso, ..., falso, verdadeiro, ..., verdadeiro" e o preditor quase nunca erra. O mesmo laço, com o mesmo número de operações, pode rodar várias vezes mais rápido nos dados ordenados. Os compiladores às vezes eliminam o desvio usando instruções de movimento condicional (`cmov` em x86, `csel` em ARM) ou vetorização, e aí a diferença desaparece. O JIT C2 da HotSpot faz isso em alguns casos, o que torna o experimento sensível à forma exata do código.

## Diagrama: Hierarquia de memória e latências

```text
                         tamanho típico        latência aproximada
                         (por núcleo / total)  (ciclos @ ~3-4 GHz)   (tempo)
  ┌──────────────┐
  │ Registradores│        ~16-32 × 64 bits      0-1 ciclo             < 0,3 ns
  └──────┬───────┘
  ┌──────▼───────┐
  │   L1d / L1i  │        32-64 KB cada         ~4-5 ciclos           ~1 ns
  └──────┬───────┘        (por núcleo)
  ┌──────▼───────┐
  │      L2      │        256 KB - 2 MB         ~12-15 ciclos         ~3-5 ns
  └──────┬───────┘        (por núcleo)
  ┌──────▼───────┐
  │      L3      │        8-64 MB+              ~30-70 ciclos         ~10-20 ns
  └──────┬───────┘        (compartilhado)
  ┌──────▼───────┐
  │  RAM (DRAM)  │        8 GB - TBs            ~200-400 ciclos       ~60-120 ns
  └──────────────┘

  Valores ilustrativos de ordem de grandeza para CPUs desktop/servidor recentes
  (Intel, AMD, Apple). Os números exatos variam por geração; consulte a
  documentação do fabricante ou meça com ferramentas como o Intel MLC.
```

## Hierarquia de cache e linhas de cache

A RAM (tópico 1.1.2) leva dezenas a centenas de nanossegundos para responder; nesse tempo, um núcleo poderia ter executado centenas de instruções. Os **caches** são memórias pequenas e rápidas, feitas de **SRAM** dentro do chip, que guardam cópias dos dados usados recentemente.

Como funcionam:

- **Linha de cache.** O cache não guarda bytes isolados, e sim blocos chamados **linhas**, tipicamente de **64 bytes** em x86-64 e na maioria dos ARM (os chips Apple M-series reportam linhas de 128 bytes; o tamanho importa ao analisar *false sharing*). Ler um único `int` traz para o cache os 64 bytes ao redor.
- **Associatividade.** Cada endereço só pode ocupar um subconjunto das posições do cache (um *set*). Um cache *8-way set-associative* permite 8 linhas diferentes por set. Isso equilibra velocidade de busca e taxa de acerto.
- **Política de substituição.** Quando um set está cheio, o hardware expulsa uma linha, geralmente com uma aproximação de LRU (*least recently used*).
- **Escrita.** Caches modernos são *write-back*: a escrita fica na linha (marcada como "suja") e só vai para a RAM quando a linha é expulsa.
- **Coerência.** Cada núcleo tem seu L1 e L2. Quando dois núcleos acessam a mesma linha, um protocolo de coerência (MESI e variantes) garante que escritas de um sejam vistas pelo outro, invalidando ou transferindo a linha. Essa conversa custa caro e é a raiz do *false sharing*.
- **Prefetching.** O hardware detecta padrões de acesso (sequencial, com passo constante) e traz linhas **antes** de serem pedidas. É por isso que percorrer um array sequencialmente é quase tão rápido quanto se tudo estivesse no L1.

Um **cache miss** acontece quando o dado não está no nível consultado. Um miss que vai até a RAM pode custar 100 ns; se o código faz um miss desses por elemento, um laço sobre 10 milhões de elementos leva um segundo só esperando memória. Por isso se diz que em código moderno "memória é o novo disco".

### Localidade espacial e temporal

Caches funcionam porque programas reais exibem **localidade**:

- **Localidade temporal**: um dado acessado agora provavelmente será acessado de novo em breve (uma variável de laço, a raiz de uma árvore, um objeto de configuração).
- **Localidade espacial**: se um endereço foi acessado, endereços vizinhos provavelmente também serão (elementos consecutivos de um array, campos de um mesmo objeto).

Estruturas de dados contíguas aproveitam a localidade espacial: um `int[]` de 16 elementos ocupa uma única linha de cache. Estruturas encadeadas a desperdiçam: cada nó pode estar em qualquer lugar do heap, e seguir um ponteiro é um acesso imprevisível, que o prefetcher não consegue antecipar. Pior: o endereço do próximo nó só é conhecido depois que o nó atual chega da memória, então os misses **não podem ser sobrepostos**. Isso se chama *pointer chasing*.

Matrizes mostram o mesmo efeito. Em Java, `int[][] m` é um array de referências para arrays de linhas. Percorrer `m[i][j]` com `j` no laço interno lê cada linha sequencialmente. Percorrer com `i` no laço interno salta de uma linha para outra a cada acesso, usando apenas 4 bytes de cada linha de cache trazida.

## Exemplo: Array versus lista encadeada em Java

```java
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

public class Localidade {
    static long somar(List<Integer> lista) {
        long soma = 0;
        for (int v : lista) soma += v;     // mesmo laço O(n) para as duas
        return soma;
    }

    public static void main(String[] args) {
        int n = 5_000_000;
        List<Integer> array = new ArrayList<>(n);
        List<Integer> ligada = new LinkedList<>();
        for (int i = 0; i < n; i++) { array.add(i); ligada.add(i); }

        for (int rodada = 0; rodada < 5; rodada++) {   // aquecimento do JIT
            long t0 = System.nanoTime(); long a = somar(array);
            long t1 = System.nanoTime(); long b = somar(ligada);
            long t2 = System.nanoTime();
            System.out.printf("ArrayList %4d ms | LinkedList %4d ms (%d %d)%n",
                (t1 - t0) / 1_000_000, (t2 - t1) / 1_000_000, a, b);
        }
    }
}
```

As duas somas fazem `n` iterações. Na `ArrayList`, o array interno `Object[]` é contíguo: as referências são lidas sequencialmente e o prefetcher trabalha a favor. Na `LinkedList`, cada `Node` é um objeto separado de ~24 bytes com `prev`, `next` e `item`; percorrer é *pointer chasing*. Note que mesmo a `ArrayList<Integer>` não é ideal: cada elemento é uma referência para um `Integer` no heap. Um `int[]` puro seria ainda mais rápido, porque os valores estariam na própria linha de cache. Os tempos dependem da máquina e de como os objetos foram dispostos no heap (aqui foram alocados em sequência, o que favorece até a `LinkedList`; depois de um GC ou com inserções intercaladas, a diferença tende a crescer). Para medições rigorosas, use o JMH (*Java Microbenchmark Harness*), que cuida de aquecimento, eliminação de código morto e estatística.

## Núcleos, hyper-threading e clock

- **Clock (GHz)**: quantos ciclos por segundo. O desempenho real é aproximadamente `instruções ÷ (IPC × frequência)`. Uma CPU de 3 GHz com IPC 4 executa mais que uma de 4 GHz com IPC 2. E se o código passa metade do tempo esperando a RAM, aumentar o clock só faz a CPU esperar mais rápido: a latência da DRAM em nanossegundos praticamente não muda com o clock do núcleo. Além disso, a frequência é limitada por consumo e calor (a potência dinâmica cresce com a frequência e com o quadrado da tensão), por isso a indústria passou a crescer em número de núcleos e em IPC, e não em GHz.
- **Turbo e frequência variável**: o clock nominal é um ponto de referência; a CPU sobe ou desce a frequência conforme temperatura, consumo e número de núcleos ativos. Isso torna medições de desempenho ruidosas.
- **Núcleos físicos**: cada um tem seu pipeline, suas ALUs, seus L1 e L2. Executam threads de forma verdadeiramente paralela.
- **SMT / Hyper-Threading**: um núcleo físico expõe dois (ou mais) **núcleos lógicos**, com dois conjuntos de registradores arquiteturais e PC, mas **compartilhando** ALUs, caches e preditores. Quando uma thread está parada esperando memória, a outra usa as unidades ociosas. O ganho típico fica em torno de 10% a 30% em cargas mistas, não 100%, e pode ser negativo em código que já satura as unidades ou disputa o L1.
- **Núcleos heterogêneos**: muitas CPUs recentes (Intel com P-cores e E-cores, Apple M-series, ARM big.LITTLE) misturam núcleos de alto desempenho e de alta eficiência. A mesma thread pode rodar em velocidades bem diferentes dependendo de onde o SO a escalonar.

Em Java, `Runtime.getRuntime().availableProcessors()` devolve o número de núcleos **lógicos** disponíveis para a JVM (respeitando limites de container). A JVM usa esse número para dimensionar threads do GC, do JIT e do `ForkJoinPool.commonPool()`.

## [Adicional] False sharing

Quando duas threads escrevem em variáveis **diferentes** que caem na **mesma linha de cache**, o protocolo de coerência faz a linha "pingar" entre os núcleos a cada escrita, como se elas disputassem a mesma variável. Não há bug lógico, só uma perda de desempenho que pode ser grande.

```java
class Contadores {
    volatile long a;   // escrito pela thread 1
    volatile long b;   // escrito pela thread 2 — provavelmente na mesma linha de 64 bytes
}
```

A correção é separar os campos por pelo menos uma linha de cache, com *padding* manual ou com a anotação `@jdk.internal.vm.annotation.Contended` (usada internamente em classes como `LongAdder` e `Thread`; para código de aplicação, exige `-XX:-RestrictContended`). O `LongAdder` existe justamente para evitar que muitas threads disputem a mesma linha ao incrementar um contador. Esse assunto volta nos fundamentos de concorrência (módulo 4.3).

## Custos, limitações e uso em sistemas reais

- **Acesso à memória domina.** Em serviços backend, a maior parte do tempo de CPU costuma ir para mover e procurar dados, não para calcular. Estruturas contíguas (`ArrayList`, `int[]`, `ArrayDeque`, `HashMap` com tabela em array) vencem estruturas encadeadas mesmo quando a complexidade assintótica é igual.
- **Objetos espalhados custam caro.** Em Java, um `List<Integer>` com um milhão de elementos são um milhão de objetos no heap; um `int[]` é um bloco contíguo. Bibliotecas de alto desempenho (Agrona, Eclipse Collections primitivas, Chronicle) existem para evitar esse custo. O projeto Valhalla (*value classes*) busca resolver isso na linguagem.
- **Desvios imprevisíveis custam caro.** Ordenar ou particionar dados antes de processá-los, ou escrever código sem desvios no laço quente, pode valer mais do que trocar o algoritmo.
- **O JIT conhece a CPU.** A HotSpot detecta em tempo de execução as extensões da CPU (AVX2, AVX-512, NEON) e gera código específico, faz *inlining*, vetoriza laços simples e remove verificações redundantes. Por isso micro-otimizações manuais muitas vezes não ajudam: o C2 já as fez (tópico 4.1.4).
- **Medir é obrigatório.** Turbo, frequência variável, SMT, aquecimento do JIT e o GC tornam qualquer medição ingênua com `System.nanoTime()` ruidosa. Em produção, ferramentas como `perf stat` (Linux, que mostra IPC, cache misses e branch misses), async-profiler e Intel VTune mostram onde a CPU de fato passa o tempo.
- **Capacidade e custo.** Em nuvem, você paga por vCPU, que normalmente é um núcleo lógico (meia CPU física com SMT). Em instâncias ARM (AWS Graviton, por exemplo), cada vCPU é um núcleo físico. Saber disso muda a leitura de benchmarks e o dimensionamento de pools de threads.

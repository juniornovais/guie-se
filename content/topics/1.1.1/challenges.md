## Descrever passo a passo o ciclo fetch-decode-execute de uma instrução ADD

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Ciclo fetch-decode-execute", "Program counter", "Registradores", "ALU"]}
```

### Enunciado

Uma CPU x86-64 está prestes a executar a instrução `add rax, rbx`, cujo código de máquina são os 3 bytes `48 01 D8`, armazenados no endereço `0x401000`. Antes da execução, `rip = 0x401000`, `rax = 5` e `rbx = 7`.

Descreva, etapa por etapa, o que acontece dentro do núcleo até a instrução terminar, e qual é o estado dos registradores relevantes ao final.

### Objetivo

Verificar se você consegue explicar o ciclo de instrução completo e o papel do PC, dos registradores, da ALU e das flags.

### Instruções

1. Descreva a etapa de **fetch**: de onde vêm os bytes e qual registrador indica o endereço.
2. Descreva a etapa de **decode**: o que a unidade de controle precisa descobrir a partir dos bytes.
3. Descreva a etapa de **execute**: quem faz a soma e quais efeitos colaterais existem além do resultado.
4. Descreva o **write-back** e a atualização do PC.
5. Informe os valores finais de `rax`, `rbx`, `rip` e da flag ZF.
6. Explique, em duas ou três frases, o que muda se a instrução fosse `add rax, [rbx]` (operando na memória).

### Dicas

- O PC não é incrementado em "1": ele avança o tamanho da instrução em bytes.
- A ALU não só calcula a soma; ela também atualiza o registrador de flags (RFLAGS).
- Com um operando na memória, aparece uma etapa a mais, e ela pode ser muito mais lenta que todas as outras juntas se houver *cache miss*.

### Critérios de avaliação

- Explica que o fetch lê os bytes a partir do endereço em `rip`, via cache de instruções L1i.
- Explica que o decode identifica o opcode (ADD de 64 bits) e os operandos (destino `rax`, fonte `rbx`), e menciona µops ou sinais de controle.
- Atribui a soma à ALU e cita a atualização das flags.
- Informa `rax = 12`, `rbx = 7`, `rip = 0x401003`, `ZF = 0`.
- Explica que `add rax, [rbx]` exige um acesso à memória (load via L1d), cuja latência depende de onde o dado está na hierarquia.

### Solução de referência

1. **Fetch.** A unidade de busca usa o valor de `rip` (`0x401000`) como endereço e lê os bytes da instrução a partir do cache de instruções L1i (se não estiverem lá, a busca desce para L2, L3 e RAM). Como x86-64 tem instruções de tamanho variável, o pré-decodificador precisa determinar onde a instrução termina: 3 bytes.
2. **Decode.** A unidade de controle interpreta os bytes: `48` é o prefixo REX.W (operação de 64 bits), `01` é o opcode "ADD r/m64, r64" e `D8` é o byte ModR/M, que codifica "registrador para registrador, destino `rax`, fonte `rbx`". Num processador moderno, isso vira uma única µop de soma inteira.
3. **Execute.** Os valores de `rax` (5) e `rbx` (7) são lidos do banco de registradores (na prática, dos registradores físicos para os quais os nomes foram renomeados) e enviados a uma ALU inteira, que calcula 12 em cerca de 1 ciclo. A ALU também atualiza as flags em RFLAGS: ZF = 0 (resultado não é zero), SF = 0 (não negativo), CF = 0 (sem carry), OF = 0 (sem overflow com sinal).
4. **Write-back.** O resultado 12 é gravado em `rax`. O PC passa a apontar para a próxima instrução: `rip = 0x401000 + 3 = 0x401003`. (Na prática, o PC avança já no fetch, para que a próxima busca comece imediatamente.)

**Estado final:** `rax = 12`, `rbx = 7`, `rip = 0x401003`, `ZF = 0`.

**Com `add rax, [rbx]`:** `rbx` passa a ser um endereço. A instrução é decodificada em duas µops (load + soma). A AGU calcula o endereço, a unidade de load lê 8 bytes do cache L1d e só então a ALU soma. Se o dado estiver no L1, o load custa ~4-5 ciclos; se for preciso ir à RAM, pode custar centenas de ciclos, e durante esse tempo a execução fora de ordem tenta adiantar instruções independentes.

## Medir o tempo de percorrer uma matriz por linhas vs. por colunas e explicar a diferença por cache

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["Linha de cache", "Localidade espacial", "Prefetching", "Arrays em Java"]}
```

### Enunciado

Escreva um programa Java que some todos os elementos de uma matriz `int[4096][4096]` de duas formas: percorrendo por linhas (`i` no laço externo, `j` no interno) e por colunas (`j` no externo, `i` no interno). Meça os tempos e explique a diferença usando o que você sabe sobre cache.

### Objetivo

Observar na prática o efeito da localidade espacial e das linhas de cache, e relacioná-lo com a forma como Java armazena arrays multidimensionais.

### Instruções

1. Crie a matriz e preencha-a com valores conhecidos (por exemplo, `i + j`).
2. Implemente `porLinhas` e `porColunas`, cada um retornando a soma (confira que as duas dão o mesmo resultado).
3. Execute cada versão várias vezes (pelo menos 5 rodadas) e descarte as primeiras, que incluem o aquecimento do JIT.
4. Repita com uma matriz "plana" `int[N * N]`, acessando `m[i * N + j]`.
5. Registre os tempos numa tabela e calcule a razão colunas/linhas.
6. Explique a diferença em termos de linhas de cache, prefetching e layout de `int[][]` em Java.

### Dicas

- Uma linha de cache tem 64 bytes. Quantos `int` cabem nela? Quantos deles você usa antes de pular para outra linha em cada versão?
- Em Java, `int[][]` não é um bloco único: é um array de referências para 4096 arrays `int[]` independentes.
- A matriz tem 64 MB, muito maior que o L3. Na versão por colunas, quando você volta à mesma linha da matriz para pegar o próximo `j`, aquela linha de cache provavelmente já foi expulsa.

### Critérios de avaliação

- O programa calcula a mesma soma nas duas formas e mede várias rodadas, descartando o aquecimento.
- A tabela mostra a versão por colunas várias vezes mais lenta (a razão exata depende da máquina).
- Explica que por linhas cada linha de cache de 64 bytes fornece 16 `int` consecutivos e o prefetcher antecipa os próximos.
- Explica que por colunas cada acesso usa 4 bytes de uma linha diferente, gerando um miss por elemento quando a matriz não cabe no cache.
- Descreve corretamente o layout de `int[][]` em Java (array de arrays) e compara com a versão plana.

### Solução de referência

```java
public class Matriz {
    static final int N = 4096;

    static long porLinhas(int[][] m) {
        long soma = 0;
        for (int i = 0; i < N; i++)
            for (int j = 0; j < N; j++)
                soma += m[i][j];
        return soma;
    }

    static long porColunas(int[][] m) {
        long soma = 0;
        for (int j = 0; j < N; j++)
            for (int i = 0; i < N; i++)
                soma += m[i][j];
        return soma;
    }

    static long plana(int[] m, boolean linhas) {
        long soma = 0;
        if (linhas) {
            for (int i = 0; i < N; i++)
                for (int j = 0; j < N; j++)
                    soma += m[i * N + j];
        } else {
            for (int j = 0; j < N; j++)
                for (int i = 0; i < N; i++)
                    soma += m[i * N + j];
        }
        return soma;
    }

    public static void main(String[] args) {
        int[][] m = new int[N][N];
        int[] p = new int[N * N];
        for (int i = 0; i < N; i++)
            for (int j = 0; j < N; j++) { m[i][j] = i + j; p[i * N + j] = i + j; }

        for (int rodada = 1; rodada <= 6; rodada++) {
            long t0 = System.nanoTime(); long a = porLinhas(m);
            long t1 = System.nanoTime(); long b = porColunas(m);
            long t2 = System.nanoTime(); long c = plana(p, true);
            long t3 = System.nanoTime(); long d = plana(p, false);
            long t4 = System.nanoTime();
            if (a != b || c != d || a != c) throw new AssertionError();
            System.out.printf("rodada %d: linhas %4d ms | colunas %5d ms | plana-linhas %4d ms | plana-colunas %5d ms%n",
                rodada, (t1 - t0) / 1_000_000, (t2 - t1) / 1_000_000,
                (t3 - t2) / 1_000_000, (t4 - t3) / 1_000_000);
        }
    }
}
```

Rode com `java -Xmx1g Matriz` (as duas matrizes ocupam ~128 MB). Resultados **ilustrativos**, obtidos num notebook comum com Java 21 (seus números serão diferentes):

| Versão | Tempo típico por rodada |
|---|---|
| `int[][]` por linhas | ~20-50 ms |
| `int[][]` por colunas | ~700-1100 ms |
| plana por linhas | ~10-20 ms |
| plana por colunas | ~450-950 ms |

A versão por colunas foi algo entre 15 e 50 vezes mais lenta, fazendo exatamente o mesmo número de somas.

**Explicação.** A CPU traz dados da memória em linhas de 64 bytes. Percorrendo por linhas, os 16 `int` de cada linha de cache são usados em sequência, e o prefetcher de hardware, detectando o acesso sequencial, traz as próximas linhas antes de serem pedidas: quase todo acesso acerta no L1. Percorrendo por colunas, acessos consecutivos estão a 16 KB de distância (4096 × 4 bytes) e em arrays diferentes; cada acesso usa 4 bytes de uma linha de 64 e passa para outra. A matriz tem 64 MB, então quando o laço volta à primeira linha para o próximo `j`, a linha de cache já foi expulsa: praticamente cada elemento gera um miss que vai ao L3 ou à RAM. Além disso, acessos com passo grande cruzam páginas de memória a todo momento, pressionando a TLB.

Em Java, `int[][]` é um array de referências: cada `m[i]` é um objeto `int[]` separado, com seu próprio header, possivelmente não adjacente aos outros. Por colunas, cada acesso ainda precisa ler a referência `m[i]` antes do elemento. A versão plana garante contiguidade total e é a forma usada por bibliotecas numéricas, mas não resolve o problema do acesso por colunas: a ordem de percurso continua sendo o fator dominante.

## Reproduzir o efeito de branch prediction somando elementos de um array ordenado vs. desordenado

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["Branch prediction", "Branch misprediction", "Pipeline", "JIT"]}
```

### Enunciado

Reproduza em Java o experimento clássico: somar apenas os elementos maiores ou iguais a 128 de um array com valores aleatórios entre 0 e 255, primeiro com o array desordenado e depois com o mesmo array ordenado. Meça, explique a diferença e investigue em que condições ela desaparece.

### Objetivo

Ver o custo real de uma *branch misprediction* e entender que o compilador JIT pode transformar ou eliminar desvios, mudando o resultado do experimento.

### Instruções

1. Gere um `int[]` de ~1 milhão de elementos com `new Random(42).ints(n, 0, 256).toArray()`.
2. Crie uma cópia ordenada com `Arrays.sort`.
3. Implemente `somarGrandes(int[])` com um `if (v >= 128) soma += v;` dentro de um laço.
4. Meça 100 chamadas para cada array, em pelo menos 5 rodadas, e use o resultado de alguma forma para o JIT não eliminar o código.
5. Explique a diferença em termos de pipeline e previsão de desvios.
6. Reescreva o corpo do laço sem desvio, por exemplo usando aritmética de bits, e meça de novo.
7. Se tiver Linux, rode as duas versões com `perf stat -e branches,branch-misses java Desvio` e compare as taxas de erro.

### Dicas

- Quantas vezes o resultado do `if` muda num array ordenado? E num aleatório?
- Uma versão sem desvio: `int mascara = (v - 128) >> 31;` vale `-1` (todos os bits 1) quando `v < 128` e `0` caso contrário. Então `soma += v & ~mascara;`.
- Se você não vir diferença, o JIT pode ter gerado um `cmov` (movimento condicional) ou vetorizado o laço. Isso também é um resultado: registre e explique.

### Critérios de avaliação

- Programa correto, que confere que as duas somas são iguais e mede várias rodadas.
- Mostra o array desordenado mais lento (ou explica, com fundamento, por que não observou diferença na sua JVM).
- Explica que, no array ordenado, o desvio segue um padrão trivial (falso até a metade, verdadeiro depois) que o preditor acerta quase sempre.
- Explica que, no aleatório, o preditor erra ~50% das vezes e cada erro esvazia o pipeline (custo da ordem de 15-20 ciclos).
- Implementa a versão sem desvio e mostra que o tempo fica parecido para os dois arrays.

### Solução de referência

```java
import java.util.Arrays;
import java.util.Random;

public class Desvio {
    static long somarGrandes(int[] dados) {
        long soma = 0;
        for (int v : dados) {
            if (v >= 128) {
                soma += v;
            }
        }
        return soma;
    }

    static long somarSemDesvio(int[] dados) {
        long soma = 0;
        for (int v : dados) {
            int mascara = (v - 128) >> 31;   // -1 se v < 128, 0 caso contrário
            soma += v & ~mascara;
        }
        return soma;
    }

    interface Soma { long aplicar(int[] d); }

    static long medir(Soma f, int[] dados, int repeticoes) {
        long inicio = System.nanoTime();
        long acumulado = 0;
        for (int r = 0; r < repeticoes; r++) acumulado += f.aplicar(dados);
        long fim = System.nanoTime();
        if (acumulado == 42) System.out.println("improvável"); // evita eliminação de código morto
        return (fim - inicio) / 1_000_000;
    }

    public static void main(String[] args) {
        int n = 1 << 20;
        int[] aleatorio = new Random(42).ints(n, 0, 256).toArray();
        int[] ordenado = aleatorio.clone();
        Arrays.sort(ordenado);

        if (somarGrandes(aleatorio) != somarGrandes(ordenado)
                || somarGrandes(aleatorio) != somarSemDesvio(aleatorio)) throw new AssertionError();

        for (int rodada = 1; rodada <= 5; rodada++) {
            System.out.printf("rodada %d: if-aleatório %4d ms | if-ordenado %4d ms | "
                    + "sem-desvio-aleatório %4d ms | sem-desvio-ordenado %4d ms%n",
                rodada,
                medir(Desvio::somarGrandes, aleatorio, 100),
                medir(Desvio::somarGrandes, ordenado, 100),
                medir(Desvio::somarSemDesvio, aleatorio, 100),
                medir(Desvio::somarSemDesvio, ordenado, 100));
        }
    }
}
```

**Resultado ilustrativo** (notebook x86-64, Java 21; os valores variam): a versão com `if` levou ~450-1.000 ms no array aleatório e ~50-200 ms no ordenado, uma diferença de 5 a 10 vezes. A versão sem desvio ficou praticamente igual nos dois arrays.

**Explicação.** O desvio `v >= 128` é resolvido apenas alguns estágios depois do fetch. Para não parar o pipeline, a CPU prevê o resultado e executa especulativamente. No array ordenado, a condição é falsa para a primeira metade e verdadeira para a segunda: o preditor erra apenas na transição. No aleatório, a condição é como cara ou coroa: o preditor erra cerca de metade das vezes, e cada erro descarta o trabalho especulado e reinicia a busca no caminho certo, custando da ordem de 15 a 20 ciclos. Com ~500 mil erros por chamada e 100 chamadas, isso são dezenas de milhões de erros, o que explica centenas de milissegundos.

A versão com máscara transforma a dependência de controle numa dependência de dados: não há desvio para prever, então a ordem dos dados não importa. O custo é executar sempre as operações extras, por isso ela pode ser um pouco mais lenta que a versão com `if` no caso ordenado.

**Quando a diferença some.** O C2 pode compilar o `if` como `cmov` ou vetorizar o laço com SIMD, eliminando o desvio sozinho; isso depende da versão da JVM, do perfil coletado e do formato exato do código. Esse é o motivo pelo qual o mesmo experimento dá resultados diferentes em JVMs diferentes, e um bom exemplo de por que medir é obrigatório. Com `perf stat` no Linux, a versão com `if` no array aleatório mostra uma taxa de `branch-misses` muito maior que nos outros três casos.

## Explicar por que uma LinkedList costuma ser mais lenta que um ArrayList mesmo em operações O(n) equivalentes

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["Localidade espacial", "Pointer chasing", "Hierarquia de cache", "Layout de objetos"]}
```

### Enunciado

Um entrevistador pergunta: *"Percorrer uma `LinkedList` e um `ArrayList` com n elementos são ambos O(n). Então por que, na prática, percorrer a `LinkedList` costuma ser bem mais lento? E inserir no meio de uma `LinkedList` não é O(1)? Quando você a usaria?"*

Escreva sua resposta como faria numa entrevista, em até dois minutos de fala.

### Objetivo

Explicar com vocabulário preciso como a hierarquia de memória faz duas operações de mesma complexidade terem desempenhos muito diferentes.

### Instruções

1. Descreva como cada estrutura está organizada na memória.
2. Explique o que acontece no nível de cache ao percorrer cada uma.
3. Explique por que os misses da `LinkedList` não podem ser sobrepostos.
4. Compare o consumo de memória por elemento.
5. Responda à pergunta sobre inserção no meio "O(1)".
6. Diga quando faria sentido escolher uma estrutura encadeada.

### Dicas

- Big-O conta operações, mas supõe que todo acesso à memória custa o mesmo. Isso é verdade?
- O próximo nó só é conhecido depois que o nó atual chega da memória.
- Para inserir no meio de uma `LinkedList` por índice, primeiro é preciso chegar lá.

### Critérios de avaliação

- Descreve o `ArrayList` como um `Object[]` contíguo e a `LinkedList` como nós independentes com `prev`, `next` e `item`.
- Explica localidade espacial, linhas de cache e prefetching a favor do `ArrayList`.
- Explica *pointer chasing*: cada passo depende do anterior, impedindo paralelismo de memória e prefetch.
- Compara o overhead de memória (nó de ~24 bytes mais a referência, contra ~4 bytes por referência no array).
- Explica que a inserção O(1) só vale com um iterador já posicionado e que encontrar a posição é O(n) com misses.
- Cita cenários razoáveis para estruturas encadeadas (ou diz que `ArrayDeque` cobre a maioria dos casos de fila/pilha).

### Solução de referência

"Big-O conta operações, mas assume que todo acesso à memória tem o mesmo custo. Na CPU real isso não é verdade: um acerto no L1 custa por volta de 1 ns e um acesso à RAM, uns 100 ns.

O `ArrayList` guarda as referências num `Object[]` contíguo. Percorrê-lo é ler memória sequencialmente: cada linha de cache de 64 bytes traz 16 referências comprimidas, e o prefetcher de hardware detecta o padrão e busca as próximas linhas antes de eu precisar. Quase todo acesso acerta no cache.

A `LinkedList` é uma cadeia de objetos `Node`, cada um com `item`, `next` e `prev`, alocados separadamente no heap. Percorrer é *pointer chasing*: só sei o endereço do próximo nó depois que o atual chega da memória. Então, se os nós estão espalhados, cada passo pode ser um cache miss, e os misses são **serializados**: a CPU não consegue disparar vários em paralelo nem o prefetcher consegue adivinhar o próximo endereço. Some-se a isso que cada nó ocupa uns 24 bytes com compressed oops, além do objeto apontado, contra 4 bytes por referência no array: são mais linhas de cache para o mesmo dado e mais trabalho para o GC.

A inserção 'O(1)' no meio só é O(1) se eu já tenho um `ListIterator` posicionado. `add(index, e)` precisa caminhar até o índice, o que é O(n) com pointer chasing. Já o `ArrayList` desloca elementos com `System.arraycopy`, que é uma cópia contígua muito rápida; para tamanhos moderados, ele vence mesmo inserindo no meio.

Eu usaria uma estrutura encadeada quando preciso de remoção O(1) de elementos dos quais já tenho a referência, como numa lista LRU dentro de um `LinkedHashMap`, ou em estruturas concorrentes lock-free específicas. Para fila e pilha, o `ArrayDeque` é a escolha padrão. Na dúvida, eu meço com JMH."

## Implementar um mini-interpretador de uma CPU fictícia com registradores, PC e 6 instruções

```meta
{"type": "implementation", "level": 4, "required": false, "knowledge": ["Ciclo fetch-decode-execute", "Program counter", "Registradores", "Flags", "Código de máquina"]}
```

### Enunciado

Implemente em Java um interpretador para uma CPU fictícia com 4 registradores de 32 bits (`R0`–`R3`), um program counter, uma flag zero (`Z`) e exatamente 6 instruções:

| Mnemônico | Efeito |
|---|---|
| `LOAD rd, imm` | `rd ← imm` |
| `ADD rd, rs` | `rd ← rd + rs`, atualiza `Z` |
| `SUB rd, rs` | `rd ← rd - rs`, atualiza `Z` |
| `JMP addr` | `PC ← addr` |
| `JZ addr` | se `Z`, então `PC ← addr` |
| `HALT` | encerra a execução |

O programa deve ficar numa memória (`int[]`) como **código de máquina numérico**, e o interpretador deve executá-lo com um laço explícito de fetch-decode-execute. Escreva um programa para essa CPU que calcule 6 × 7 usando apenas somas repetidas.

### Objetivo

Construir o modelo mental de uma CPU de verdade: memória de programa, PC, registradores, flags, desvios condicionais e codificação de instruções.

### Instruções

1. Defina a codificação: cada instrução ocupa 3 palavras `[opcode, a, b]`. Escolha valores numéricos para os opcodes.
2. Implemente o laço principal: buscar a instrução no endereço do PC, avançar o PC, decodificar o opcode e executar.
3. Trate erros como uma CPU trataria: opcode inválido, registrador inexistente, PC fora da memória. Adicione um limite de ciclos para evitar laço infinito.
4. Adicione um modo *trace* que imprima, a cada instrução, o endereço, a instrução desmontada, os registradores e a flag.
5. Escreva o programa de multiplicação. Opcional (recomendado): implemente um montador que converta texto com rótulos (`laco:`) em código de máquina.
6. Confirme que o resultado em `R0` é 42 e conte quantas instruções foram executadas.

### Dicas

- O PC deve ser avançado logo após o fetch; um salto simplesmente sobrescreve esse valor.
- `JZ` só faz sentido se `ADD` e `SUB` atualizarem a flag. Use um contador que decrementa até zero.
- Um montador de duas passagens resolve rótulos: na primeira, anote o endereço de cada rótulo; na segunda, gere o código substituindo os nomes pelos endereços.

### Critérios de avaliação

- O programa fica num `int[]` como código numérico, não como objetos ou strings interpretados diretamente.
- O laço de execução tem fetch, avanço do PC, decode e execute claramente identificáveis.
- As 6 instruções funcionam, incluindo a atualização da flag `Z` e o desvio condicional.
- Erros (opcode inválido, registrador inválido, PC fora da memória, limite de ciclos) são detectados.
- O programa de multiplicação produz `R0 = 42` e o trace mostra o laço sendo executado 7 vezes.

### Solução de referência

```java
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * CPU fictícia: 4 registradores de 32 bits (R0..R3), um PC e uma flag Z.
 * Cada instrução ocupa 3 palavras na memória de programa: [opcode, a, b].
 *
 *   LOAD rd, imm   rd <- imm
 *   ADD  rd, rs    rd <- rd + rs     (atualiza Z)
 *   SUB  rd, rs    rd <- rd - rs     (atualiza Z)
 *   JMP  addr      PC <- addr
 *   JZ   addr      se Z, PC <- addr
 *   HALT           para a execução
 */
public class MiniCpu {
    static final int LOAD = 0x01, ADD = 0x02, SUB = 0x03, JMP = 0x04, JZ = 0x05, HALT = 0xFF;
    static final int TAM_INSTR = 3;

    private final int[] memoria;          // memória de programa (código de máquina)
    private final int[] reg = new int[4]; // R0..R3
    private int pc = 0;                   // program counter (índice de palavra)
    private boolean z = false;            // flag zero
    private long ciclos = 0;
    private final boolean trace;

    MiniCpu(int[] programa, boolean trace) {
        this.memoria = programa;
        this.trace = trace;
    }

    void executar(long limiteCiclos) {
        while (true) {
            if (ciclos++ >= limiteCiclos) throw new IllegalStateException("limite de ciclos excedido");
            if (pc < 0 || pc + TAM_INSTR > memoria.length)
                throw new IllegalStateException("PC fora da memória: " + pc);

            // FETCH: lê a instrução apontada pelo PC
            int opcode = memoria[pc], a = memoria[pc + 1], b = memoria[pc + 2];
            int pcAtual = pc;
            pc += TAM_INSTR;              // o PC já aponta para a próxima instrução

            // DECODE + EXECUTE + WRITE-BACK
            switch (opcode) {
                case LOAD -> reg[checarReg(a)] = b;
                case ADD -> { reg[checarReg(a)] = reg[a] + reg[checarReg(b)]; z = reg[a] == 0; }
                case SUB -> { reg[checarReg(a)] = reg[a] - reg[checarReg(b)]; z = reg[a] == 0; }
                case JMP -> pc = a;
                case JZ -> { if (z) pc = a; }
                case HALT -> { log(pcAtual, "HALT"); return; }
                default -> throw new IllegalStateException(
                    "opcode inválido 0x%02X em %d".formatted(opcode, pcAtual));
            }
            log(pcAtual, desmontar(opcode, a, b));
        }
    }

    private static int checarReg(int r) {
        if (r < 0 || r > 3) throw new IllegalStateException("registrador inválido R" + r);
        return r;
    }

    private void log(int endereco, String instr) {
        if (trace)
            System.out.printf("%03d  %-14s R=%s Z=%b PC->%03d%n",
                endereco, instr, Arrays.toString(reg), z, pc);
    }

    static String desmontar(int op, int a, int b) {
        return switch (op) {
            case LOAD -> "LOAD R" + a + ", " + b;
            case ADD -> "ADD R" + a + ", R" + b;
            case SUB -> "SUB R" + a + ", R" + b;
            case JMP -> "JMP " + a;
            case JZ -> "JZ " + a;
            case HALT -> "HALT";
            default -> "???";
        };
    }

    /** Montador mínimo: converte texto assembly em código de máquina. Rótulos terminam com ':'. */
    static int[] montar(String fonte) {
        List<String[]> linhas = new ArrayList<>();
        java.util.Map<String, Integer> rotulos = new java.util.HashMap<>();
        for (String bruta : fonte.split("\n")) {
            String l = bruta.replaceAll(";.*", "").trim();
            if (l.isEmpty()) continue;
            if (l.endsWith(":")) { rotulos.put(l.substring(0, l.length() - 1), linhas.size() * TAM_INSTR); continue; }
            linhas.add(l.replace(",", " ").trim().split("\s+"));
        }
        int[] codigo = new int[linhas.size() * TAM_INSTR];
        for (int i = 0; i < linhas.size(); i++) {
            String[] t = linhas.get(i);
            int base = i * TAM_INSTR;
            int op = switch (t[0].toUpperCase()) {
                case "LOAD" -> LOAD; case "ADD" -> ADD; case "SUB" -> SUB;
                case "JMP" -> JMP; case "JZ" -> JZ; case "HALT" -> HALT;
                default -> throw new IllegalArgumentException("mnemônico desconhecido: " + t[0]);
            };
            codigo[base] = op;
            for (int k = 1; k < t.length; k++) {
                String arg = t[k];
                int valor = arg.toUpperCase().startsWith("R") ? Integer.parseInt(arg.substring(1))
                          : rotulos.containsKey(arg) ? rotulos.get(arg)
                          : Integer.parseInt(arg);
                codigo[base + k] = valor;
            }
        }
        return codigo;
    }

    public static void main(String[] args) {
        // Multiplica 6 x 7 por somas repetidas: R0 = resultado, R1 = 6, R2 = contador, R3 = 1
        String programa = """
                LOAD R0, 0
                LOAD R1, 6
                LOAD R2, 7
                LOAD R3, 1
            laco:
                ADD R0, R1      ; R0 += 6
                SUB R2, R3      ; R2 -= 1, atualiza Z
                JZ fim
                JMP laco
            fim:
                HALT
            """;
        int[] codigo = montar(programa);
        System.out.println("código de máquina: " + Arrays.toString(codigo));
        MiniCpu cpu = new MiniCpu(codigo, true);
        cpu.executar(10_000);
        System.out.println("resultado R0 = " + cpu.reg[0] + " em " + cpu.ciclos + " instruções");
    }
}
```

Saída (resumida):

```text
código de máquina: [1, 0, 0, 1, 1, 6, 1, 2, 7, 1, 3, 1, 2, 0, 1, 3, 2, 3, 5, 24, 0, 4, 12, 0, 255, 0, 0]
000  LOAD R0, 0     R=[0, 0, 0, 0] Z=false PC->003
...
012  ADD R0, R1     R=[42, 6, 1, 1] Z=false PC->015
015  SUB R2, R3     R=[42, 6, 0, 1] Z=true PC->018
018  JZ 24          R=[42, 6, 0, 1] Z=true PC->024
024  HALT           R=[42, 6, 0, 1] Z=true PC->027
resultado R0 = 42 em 32 instruções
```

Foram executadas 32 instruções: 4 `LOAD`, 7 iterações de 4 instruções (`ADD`, `SUB`, `JZ`, `JMP`) menos o último `JMP`, que não ocorre porque `JZ` salta, e o `HALT` (4 + 27 + 1 = 32).

**Paralelos com uma CPU real.** O `int[]` é a memória de programa; `pc` é o `rip`; `reg` é o banco de registradores; `z` é a flag ZF de RFLAGS; o `switch` é a unidade de controle; o montador é o `as`/`nasm`. Uma CPU real faz exatamente esse laço, mas em hardware, com pipeline, várias instruções por ciclo e previsão de desvios. Esse também é o esqueleto de um interpretador de bytecode, como o interpretador da JVM (tópico 4.1.4): a JVM substitui o `switch` por um *template interpreter* que gera código nativo para cada opcode, justamente porque o `switch` com desvio indireto a cada instrução é caro para o preditor de desvios.

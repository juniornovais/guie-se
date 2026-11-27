## Desenhar os frames da stack durante a execução de três funções aninhadas

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Frames", "Stack pointer", "Endereço de retorno"]}
```

### Enunciado

Considere o programa abaixo e o momento exato em que a linha marcada com `// AQUI` está executando.

```java
public class Frames {
    public static void main(String[] args) {
        int base = 10;
        int r = dobrar(base);
        System.out.println(r);
    }

    static int dobrar(int x) {
        int y = somarUm(x) * 2;
        return y;
    }

    static int somarUm(int n) {
        int resultado = n + 1;   // AQUI
        return resultado;
    }
}
```

Desenhe a stack da thread `main` nesse instante, do frame mais antigo para o mais recente.

### Objetivo

Visualizar a stack como uma sequência de frames LIFO e saber o que cada frame contém.

### Instruções

1. Represente cada frame como um bloco com o nome do método.
2. Dentro de cada bloco, liste os parâmetros e as variáveis locais **que já existem** naquele instante, com seus valores quando conhecidos.
3. Indique para onde cada frame retorna.
4. Marque o topo da stack.
5. Responda: o que acontece com o frame de `somarUm` quando ele retorna? E com o valor de `resultado`?

### Dicas

- São três frames, e a ordem é a ordem das chamadas.
- `r` (em `main`) e `y` (em `dobrar`) ainda não receberam valor, porque as chamadas que os produzem não terminaram.
- O frame não é "apagado": o stack pointer recua e aquela memória será reaproveitada. O valor de `resultado` sobrevive apenas porque é copiado como valor de retorno.

### Critérios de avaliação

- Os três frames aparecem na ordem `main` → `dobrar` → `somarUm`, com `somarUm` no topo.
- Cada frame lista corretamente seus parâmetros e locais já inicializados (`args`, `base`; `x = 10`; `n = 10`, `resultado = 11`).
- Indica que `r` e `y` ainda não têm valor.
- Explica que o retorno recua o stack pointer, sem custo de "liberação", e que o valor de retorno é copiado para quem chamou.

### Solução de referência

```text
topo →  ┌───────────────────────────────┐
        │ somarUm                       │
        │   n = 10                      │
        │   resultado = 11              │
        │   retorna para: dobrar        │
        ├───────────────────────────────┤
        │ dobrar                        │
        │   x = 10                      │
        │   y = (ainda não atribuído)   │
        │   retorna para: main          │
        ├───────────────────────────────┤
        │ main                          │
        │   args = ref → String[] (heap)│
        │   base = 10                   │
        │   r = (ainda não atribuído)   │
        └───────────────────────────────┘
```

Quando `somarUm` retorna, o stack pointer volta para o topo do frame de `dobrar`. O frame de `somarUm` deixa de existir logicamente; os bytes ficam na memória até a próxima chamada sobrescrevê-los. O valor `11` sobrevive porque é devolvido (na JVM, empilhado na pilha de operandos do frame de `dobrar`), que então calcula `y = 22`.

Observe que `args` é uma **referência** no frame de `main`; o array `String[]` em si está no heap.

## Provocar um StackOverflowError controlado e ler o stack trace

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["StackOverflowError", "Recursão", "Stack trace"]}
```

### Enunciado

Escreva um programa Java que provoque um `StackOverflowError` de forma controlada, meça a profundidade alcançada e analise o stack trace gerado.

### Objetivo

Ver na prática que a stack tem tamanho finito e aprender a reconhecer o padrão de um estouro num stack trace.

### Instruções

1. Crie um método recursivo **sem caso base** que incremente um contador estático a cada chamada.
2. Em `main`, chame o método dentro de um `try/catch (StackOverflowError e)` e imprima a profundidade alcançada.
3. Rode três vezes e anote os valores. Eles são idênticos? Por quê?
4. Agora remova o `try/catch`, rode de novo e observe o stack trace. Quantas linhas aparecem? Por que são todas iguais?
5. Registre sua explicação: por que a JVM não deixa a recursão continuar até acabar a memória do computador?

### Dicas

- A profundidade pode variar um pouco entre execuções: o JIT pode compilar o método durante a recursão, e o frame do código compilado tem tamanho diferente do interpretado.
- A JVM limita o número de linhas impressas do stack trace (por padrão, 1024 frames).
- O limite vem do tamanho da stack da thread, definido na criação dela (`-Xss`), e não da RAM total.

### Critérios de avaliação

- O programa estoura a stack e captura o erro, imprimindo a profundidade.
- Explica a variação entre execuções (JIT, tamanho de frame) ou mostra resultados consistentes com justificativa.
- Reconhece no stack trace a mesma linha repetida como assinatura de recursão infinita.
- Explica que o limite é o tamanho da stack da thread, protegido por uma guard page, e não a memória total.

### Solução de referência

```java
public class Estouro {
    private static int profundidade = 0;

    private static void descer() {
        profundidade++;
        descer();
    }

    public static void main(String[] args) {
        try {
            descer();
        } catch (StackOverflowError e) {
            System.out.println("Profundidade alcançada: " + profundidade);
        }
    }
}
```

Saída típica com o `-Xss` padrão (1 MB, Linux x86-64): algo entre 10 mil e 60 mil chamadas, dependendo da versão da JVM e do quanto o método foi compilado pelo JIT durante a descida. Pequenas variações entre execuções são normais.

Sem o `try/catch`, o stack trace mostra `Exception in thread "main" java.lang.StackOverflowError` seguido de centenas de linhas `at Estouro.descer(Estouro.java:5)`, todas iguais: cada linha é um frame idêntico empilhado. Essa repetição é a assinatura de recursão infinita. Em recursão indireta (A → B → A), o padrão repetido tem duas ou mais linhas alternadas.

A recursão não consome toda a RAM porque cada thread recebe uma região de stack de tamanho fixo. Ao final dela existe uma guard page protegida; tocar nela gera uma falha que a JVM converte em `StackOverflowError`.

## Medir a profundidade máxima de recursão com diferentes valores de -Xss

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["-Xss", "Tamanho de frame", "Threads"]}
```

### Enunciado

Investigue experimentalmente como o tamanho da stack (`-Xss`) e o tamanho de cada frame afetam a profundidade máxima de recursão.

### Objetivo

Relacionar quantitativamente tamanho de stack, tamanho de frame e profundidade, e entender o trade-off de `-Xss` em servidores com muitas threads.

### Instruções

1. Reaproveite o programa do desafio anterior.
2. Rode com `-Xss256k`, `-Xss1m` e `-Xss8m`. Anote a profundidade em cada caso.
3. Crie uma segunda versão em que o método recursivo declare 8 variáveis `long` locais (e as use, para o compilador não eliminá-las). Repita as medições.
4. Monte uma tabela com os resultados e estime o tamanho aproximado de cada frame (stack ÷ profundidade).
5. Crie a recursão dentro de uma `new Thread(null, runnable, "grande", 64L * 1024 * 1024)` e compare. O que esse construtor permite?
6. Conclua: num servidor com 2.000 threads de plataforma, qual o impacto de aumentar `-Xss` de 1 MB para 4 MB?

### Dicas

- O quarto parâmetro do construtor de `Thread` é o `stackSize` desejado. A JVM pode tratá-lo como sugestão.
- Para forçar comparações mais estáveis, você pode rodar com `-Xint` (só interpretador) e comparar com o modo normal.
- Pense em espaço de endereçamento virtual reservado versus memória física efetivamente usada.

### Critérios de avaliação

- Tabela com pelo menos 6 medições (3 tamanhos × 2 versões do método).
- Mostra que a profundidade cresce de forma aproximadamente proporcional a `-Xss`.
- Mostra que frames maiores reduzem a profundidade e estima o tamanho do frame.
- Explica o uso do construtor de `Thread` com `stackSize` para isolar uma tarefa recursiva profunda.
- Discute o impacto de `-Xss` × número de threads (memória virtual reservada, limite de threads).

### Solução de referência

Resultados ilustrativos (variam por máquina e versão da JVM):

| `-Xss` | Método simples | Método com 8 `long` |
|---|---|---|
| 256k | ~2.500 | ~1.200 |
| 1m | ~11.000 | ~5.000 |
| 8m | ~90.000 | ~42.000 |

A profundidade cresce quase linearmente com `-Xss`. O frame da versão com mais locais é cerca de duas vezes maior, então a profundidade cai pela metade. Tamanho estimado do frame: 1 MB ÷ 11.000 ≈ 95 bytes no caso simples.

O construtor `Thread(ThreadGroup, Runnable, String, long stackSize)` permite dar uma stack grande apenas para a thread que executa um algoritmo recursivo profundo, sem aumentar a stack de todas as outras threads da aplicação.

Com 2.000 threads, passar de 1 MB para 4 MB aumenta a reserva de espaço virtual de ~2 GB para ~8 GB. A memória física só é consumida pelas páginas efetivamente tocadas, mas a reserva conta para limites como `ulimit -v`, para o limite de memória de containers em alguns cenários e para a pressão sobre o sistema. Em geral, é melhor corrigir o algoritmo (tornando-o iterativo) ou isolar a recursão numa thread dedicada.

## Explicar por que variáveis locais são thread-safe e objetos referenciados por elas não necessariamente

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["Stack por thread", "Heap compartilhado", "Thread safety"]}
```

### Enunciado

Um entrevistador pergunta: *"Variáveis locais em Java são thread-safe?"*. Responda como numa entrevista técnica, em até dois minutos de fala (escreva a resposta), e analise o código abaixo.

```java
public class Relatorio {
    public List<String> gerar(List<String> entrada) {
        List<String> saida = new ArrayList<>();
        for (String s : entrada) {
            saida.add(s.toUpperCase());
        }
        CACHE.put("ultimo", saida);
        return saida;
    }

    private static final Map<String, List<String>> CACHE = new HashMap<>();
}
```

### Objetivo

Distinguir com precisão o isolamento da stack (por thread) do compartilhamento do heap, usando o vocabulário certo numa entrevista.

### Instruções

1. Responda à pergunta com "depende", explicando de quê.
2. Diga o que exatamente fica isolado por thread.
3. Analise o método `gerar`: quais partes são seguras quando duas threads o chamam ao mesmo tempo, e quais não são?
4. Proponha uma correção mínima para o problema encontrado.

### Dicas

- A referência `saida` está na stack. O `ArrayList` está no heap.
- Pergunte-se: o objeto **escapa** do método? Quem mais consegue alcançá-lo?
- `CACHE` é estático: todas as threads compartilham o mesmo `HashMap`.

### Critérios de avaliação

- Explica que a variável local (a referência ou o primitivo) é isolada porque cada thread tem sua stack.
- Explica que o objeto apontado vive no heap e é seguro apenas enquanto não escapar para outras threads.
- Identifica que `saida` escapa via `CACHE` e via `return`, e que o `HashMap` estático sofre acesso concorrente sem sincronização.
- Propõe uma correção adequada (`ConcurrentHashMap`, lista imutável com `List.copyOf`, ou remover o cache).

### Solução de referência

**Resposta curta:** "A variável local em si, sim: cada thread tem sua própria stack, então uma thread nunca enxerga as locais de outra. Mas se a variável é uma referência, o objeto apontado está no heap, que é compartilhado. Ele só é seguro enquanto ficar confinado à thread, ou seja, enquanto não escapar do método."

**Análise de `gerar`:**

- `entrada`, `saida` e `s` (as referências) estão no frame de cada chamada: isoladas.
- O `ArrayList` criado é novo a cada chamada; enquanto está sendo preenchido, só a thread que o criou o conhece. O laço é seguro.
- O problema está em `CACHE.put(...)`: `CACHE` é um `HashMap` **estático e compartilhado**. `put` concorrente num `HashMap` pode corromper a estrutura interna (entradas perdidas e, em versões antigas do Java, até laços infinitos durante o resize).
- Além disso, `saida` **escapa**: fica no cache e é devolvida. Se alguém a modificar depois, outras threads que leem o cache veem uma lista mutável sem garantias de visibilidade.

**Correção mínima:**

```java
private static final Map<String, List<String>> CACHE = new ConcurrentHashMap<>();

public List<String> gerar(List<String> entrada) {
    List<String> saida = new ArrayList<>();
    for (String s : entrada) saida.add(s.toUpperCase());
    List<String> imutavel = List.copyOf(saida);   // publica uma versão imutável
    CACHE.put("ultimo", imutavel);
    return imutavel;
}
```

## Converter um algoritmo recursivo profundo em iterativo usando uma pilha explícita

```meta
{"type": "implementation", "level": 4, "required": false, "knowledge": ["Recursão", "ArrayDeque", "DFS", "Stack vs heap"]}
```

### Enunciado

O método abaixo soma os valores de uma árvore binária recursivamente. Com uma árvore degenerada (cada nó tem só filho à direita) de 1.000.000 de nós, ele lança `StackOverflowError`. Reescreva-o de forma iterativa, sem recursão, e prove que funciona com a árvore degenerada.

```java
record No(long valor, No esquerda, No direita) {}

static long somar(No no) {
    if (no == null) return 0;
    return no.valor() + somar(no.esquerda()) + somar(no.direita());
}
```

### Objetivo

Entender que a recursão usa a call stack como estrutura de dados implícita e saber substituí-la por uma pilha explícita no heap, que pode crescer até o limite do heap.

### Instruções

1. Escreva um gerador de árvore degenerada com N nós. Atenção: o próprio gerador não pode ser recursivo.
2. Confirme que `somar` recursivo estoura com N = 1.000.000.
3. Implemente `somarIterativo(No raiz)` usando `ArrayDeque<No>` como pilha.
4. Verifique que os dois métodos dão o mesmo resultado numa árvore pequena e balanceada (por exemplo, 15 nós).
5. Verifique que `somarIterativo` funciona com 1.000.000 de nós.
6. Explique em poucas linhas por que a versão iterativa não estoura, e qual é o novo limite.

### Dicas

- O que a recursão guardava em cada frame? Aqui, basicamente "qual nó ainda falta visitar".
- Empilhe a raiz; enquanto a pilha não estiver vazia, desempilhe um nó, some seu valor e empilhe os filhos não nulos.
- `ArrayDeque` é mais eficiente que `Stack` (que é sincronizada e herda de `Vector`).
- O limite agora é o heap (`-Xmx`), que normalmente é ordens de grandeza maior que a stack de uma thread.

### Critérios de avaliação

- O gerador de árvore é iterativo e cria N nós.
- `somarIterativo` não usa recursão e usa uma pilha explícita (`ArrayDeque`).
- Os resultados coincidem com a versão recursiva em árvores pequenas.
- Funciona com 1.000.000 de nós sem erro.
- A explicação relaciona call stack (tamanho fixo por thread) com pilha explícita no heap (limitada por `-Xmx`).

### Solução de referência

```java
import java.util.ArrayDeque;
import java.util.Deque;

public class SomaArvore {
    record No(long valor, No esquerda, No direita) {}

    static No degenerada(int n) {
        No atual = null;
        for (int i = n; i >= 1; i--) {
            atual = new No(i, null, atual);   // constrói de baixo para cima, sem recursão
        }
        return atual;
    }

    static long somar(No no) {
        if (no == null) return 0;
        return no.valor() + somar(no.esquerda()) + somar(no.direita());
    }

    static long somarIterativo(No raiz) {
        if (raiz == null) return 0;
        Deque<No> pilha = new ArrayDeque<>();
        pilha.push(raiz);
        long total = 0;
        while (!pilha.isEmpty()) {
            No no = pilha.pop();
            total += no.valor();
            if (no.direita() != null) pilha.push(no.direita());
            if (no.esquerda() != null) pilha.push(no.esquerda());
        }
        return total;
    }

    public static void main(String[] args) {
        No grande = degenerada(1_000_000);
        System.out.println(somarIterativo(grande));     // 500000500000
        try {
            somar(grande);
        } catch (StackOverflowError e) {
            System.out.println("A versão recursiva estourou, como esperado");
        }
    }
}
```

A versão recursiva guarda o "trabalho pendente" na call stack, que tem tamanho fixo por thread (cerca de 1 MB). Cada nível consome um frame, então 1.000.000 de níveis é inviável.

A versão iterativa guarda o trabalho pendente num `ArrayDeque`, um objeto no heap que cresce sob demanda. O limite passa a ser o heap. Nesse caso, a pilha explícita nem cresce: a árvore degenerada mantém no máximo um elemento pendente por vez, porque cada nó só tem filho à direita. Numa árvore balanceada, a pilha teria tamanho proporcional à altura.

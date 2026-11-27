## O problema que a stack resolve

Toda chamada de função precisa de um lugar para guardar três coisas enquanto executa: os **argumentos** que recebeu, suas **variáveis locais** e o **endereço de retorno** (para onde a CPU deve voltar quando a função terminar). Quando a função termina, nada disso é mais necessário.

Esse padrão de uso tem uma propriedade decisiva: **a última função chamada é sempre a primeira a terminar**. Se `main` chama `a`, e `a` chama `b`, então `b` termina antes de `a`, que termina antes de `main`. Os dados vivem e morrem em ordem LIFO (*last in, first out*). Uma estrutura LIFO em memória contígua é exatamente o que a **stack** (pilha de execução) é.

Por isso a stack não precisa de nenhum algoritmo de gerenciamento sofisticado. Alocar é avançar um ponteiro; liberar é recuar o mesmo ponteiro.

## Stack pointer e frames

A CPU mantém um registrador dedicado chamado **stack pointer** (`rsp` em x86-64, `sp` em ARM). Ele aponta para o topo atual da stack. Em x86-64 e na maioria das arquiteturas, a stack **cresce para endereços menores**: "empilhar" significa *subtrair* do stack pointer.

Cada chamada de função reserva um bloco contíguo chamado **frame** (ou *activation record*). Um frame típico contém:

- o endereço de retorno (empilhado pela instrução `call`);
- o frame pointer anterior (`rbp`), quando usado, para encadear frames;
- variáveis locais e valores temporários;
- argumentos que não couberam em registradores.

Na entrada da função, o compilador gera algo como:

```asm
push rbp          ; salva o frame pointer de quem chamou
mov  rbp, rsp     ; o frame desta função começa aqui
sub  rsp, 32      ; reserva 32 bytes para variáveis locais
```

E na saída:

```asm
mov  rsp, rbp     ; descarta as variáveis locais de uma vez
pop  rbp          ; restaura o frame pointer de quem chamou
ret               ; desempilha o endereço de retorno e salta para ele
```

Repare que "liberar" as variáveis locais é **uma única instrução** que move o ponteiro. Nada é apagado: os bytes continuam lá até serem sobrescritos pela próxima chamada. É por isso que, em C, devolver um ponteiro para uma variável local é um bug clássico: o endereço continua válido, mas o conteúdo será reutilizado.

## Diagrama: Três chamadas aninhadas

```text
 endereços altos
 ┌──────────────────────────┐
 │ frame de main            │  args, locais de main
 │   ret → runtime          │
 ├──────────────────────────┤
 │ frame de calcularTotal   │  itens, soma
 │   ret → main             │
 ├──────────────────────────┤
 │ frame de aplicarDesconto │  valor, taxa      ← rsp (topo)
 │   ret → calcularTotal    │
 └──────────────────────────┘
 endereços baixos   (a stack cresce para baixo ↓)
```

Quando `aplicarDesconto` retorna, `rsp` volta para o topo do frame de `calcularTotal`. O frame de `aplicarDesconto` deixa de existir logicamente, sem custo algum.

## Por que a stack é tão rápida

O custo de alocar na stack é praticamente zero, por quatro motivos:

1. **Sem busca por espaço livre.** O heap precisa encontrar um bloco adequado (listas livres, *size classes*, compactação). A stack sempre aloca no topo.
2. **Liberação em bloco.** Todas as locais de um frame são descartadas juntas, no `ret`.
3. **Sem sincronização.** Cada thread tem sua stack; não há locks nem operações atômicas.
4. **Localidade de cache excelente.** O topo da stack é acessado o tempo todo, então quase sempre está no cache L1. Frames recém-liberados são reaproveitados imediatamente pela próxima chamada.

O preço dessa simplicidade é uma regra rígida: **o tempo de vida de um dado na stack é limitado ao escopo da função**. Qualquer coisa que precise sobreviver ao retorno (um objeto devolvido, guardado num campo, compartilhado com outra thread) não pode morar ali. É esse limite que justifica a existência do heap (tópico 1.1.8).

## Uma stack por thread

Cada thread executa sua própria sequência de chamadas e, portanto, precisa da sua própria stack. O sistema operacional (ou a JVM) reserva uma região de memória virtual para cada uma no momento da criação da thread.

Consequências práticas:

- **Variáveis locais são automaticamente isoladas entre threads.** Duas threads executando o mesmo método têm frames diferentes e não enxergam as locais uma da outra.
- **O tamanho da stack multiplica pelo número de threads.** Em Java, o padrão de `-Xss` costuma ser 1 MB em Linux x86-64 (512 KB a 1 MB dependendo da plataforma). Mil threads de plataforma reservam ~1 GB de espaço de endereçamento só para stacks. Na prática, o SO só entrega páginas físicas conforme são tocadas (*lazy commit*), mas o espaço virtual e o limite de threads continuam sendo problemas reais.
- **Diminuir `-Xss` permite mais threads, mas reduz a profundidade de recursão possível.** É um trade-off direto.

Essa é uma das motivações das **virtual threads** do Java 21 (tópico 4.4.11): suas stacks começam pequenas, ficam no heap como objetos e crescem sob demanda, permitindo milhões de threads.

## O que fica na stack em Java

A JVM tem sua própria "JVM stack" por thread (tópico 4.1.5), com frames que contêm um **array de variáveis locais** e uma **pilha de operandos**. A regra mental para o programador é:

| Elemento | Onde vive |
|---|---|
| Variável local primitiva (`int`, `long`, `double`, `boolean`…) | No frame, na stack |
| Variável local de referência (`String s`, `List<Item> itens`) | A **referência** fica no frame; o **objeto** fica no heap |
| Parâmetros do método | No frame, como variáveis locais |
| Campos de um objeto (`this.total`) | No heap, dentro do objeto |
| Campos `static` | Na área da classe (heap/metaspace), não na stack |

## Exemplo: Onde cada variável é armazenada

```java
public class Pedido {
    private double total;                 // campo: heap (dentro de cada Pedido)

    public static void main(String[] args) {
        int quantidade = 3;               // primitivo local: stack (frame de main)
        Pedido p = new Pedido();          // referência p: stack; objeto Pedido: heap
        p.adicionar(quantidade, 19.90);
    }

    void adicionar(int qtd, double preco) {   // qtd, preco: stack (frame de adicionar)
        double subtotal = qtd * preco;        // stack
        this.total += subtotal;               // escreve no heap, através de 'this'
    }
}
```

Quando `adicionar` retorna, `qtd`, `preco` e `subtotal` desaparecem. O valor somado sobrevive porque foi escrito no objeto, que está no heap.

## Limites e StackOverflowError

A stack tem tamanho fixo, definido na criação da thread. Se a cadeia de chamadas exige mais frames do que cabem, a próxima chamada ultrapassa o limite. O SO coloca uma **guard page** (página protegida) no fim da região; tocar nela gera uma falha que a JVM converte em `java.lang.StackOverflowError`.

As causas mais comuns:

- **Recursão sem caso base** ou com caso base inalcançável.
- **Recursão legítima, porém profunda demais**: percorrer uma lista ligada de 1 milhão de nós recursivamente, ou um DFS em um grafo enorme.
- **Recursão indireta acidental**: `toString()` de A chama `toString()` de B, que chama o de A (comum em entidades JPA bidirecionais com Lombok).

```java
static long profundidade = 0;

static void descer() {
    profundidade++;
    descer();                      // sem caso base
}

public static void main(String[] args) {
    try {
        descer();
    } catch (StackOverflowError e) {
        System.out.println("Estourou em " + profundidade + " chamadas");
    }
}
```

Rodando com `java -Xss256k` e depois com `java -Xss4m`, a profundidade alcançada muda de forma proporcional ao tamanho da stack e ao tamanho de cada frame. Um frame com mais variáveis locais estoura antes.

> Capturar `StackOverflowError` serve para experimentos. Em produção, é sinal de bug: o estado da aplicação pode ter ficado inconsistente no meio da cadeia de chamadas.

O Java **não faz eliminação de chamada de cauda** (*tail call optimization*). Uma recursão em cauda continua consumindo um frame por chamada. Para profundidades grandes, a solução é converter o algoritmo para a forma iterativa, usando uma pilha explícita no heap (por exemplo, um `ArrayDeque`).

## [Adicional] Escape analysis: quando objetos "moram" na stack

O compilador JIT C2 da HotSpot faz **escape analysis**. Se ele prova que um objeto criado num método **não escapa** (não é devolvido, não é guardado em campo, não é passado a código desconhecido), pode aplicar **scalar replacement**: em vez de alocar o objeto no heap, decompõe seus campos em variáveis locais, que vão para registradores ou para o frame.

```java
double distancia(double x1, double y1, double x2, double y2) {
    Ponto delta = new Ponto(x2 - x1, y2 - y1);  // não escapa do método
    return Math.sqrt(delta.x() * delta.x() + delta.y() * delta.y());
}
```

Depois de aquecido, esse código pode não fazer nenhuma alocação no heap. Mas isso é uma **otimização opcional**: depende do JIT, do inlining e do tamanho do método. O modelo mental correto continua sendo "objetos vão para o heap", e a escape analysis é um bônus que reduz a pressão sobre o GC.

## Custos, limitações e uso em sistemas reais

- **Custo:** alocação e liberação O(1) e praticamente gratuitas. O custo real de uma chamada vem de salvar registradores e de quebrar o pipeline; por isso o JIT faz *inlining* de métodos pequenos.
- **Limitação de tamanho:** algoritmos recursivos sobre entradas de tamanho arbitrário (árvores degeneradas, grafos, parsers de JSON aninhado) podem derrubar uma thread. Servidores costumam limitar a profundidade aceita em parsers por isso.
- **Limitação de tempo de vida:** nada que precise sobreviver ao retorno pode ficar ali.
- **Diagnóstico:** um *stack trace* nada mais é do que a leitura da cadeia de frames da thread no momento da exceção. Ferramentas como `jstack` e `jcmd <pid> Thread.print` mostram os frames de todas as threads e são a primeira ferramenta para investigar travamentos e deadlocks.
- **Dimensionamento:** em servidores com milhares de threads de plataforma, `-Xss` é um parâmetro de capacidade. Em código com recursão profunda, é um parâmetro de correção.

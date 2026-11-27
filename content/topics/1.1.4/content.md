## O que um compilador faz

Um **compilador** é um programa que traduz um programa escrito em uma linguagem (a **linguagem-fonte**) para outra linguagem (a **linguagem-alvo**) **preservando o significado**. A linguagem-alvo pode ser código de máquina (gcc gerando x86-64), assembly, outra linguagem de alto nível (TypeScript → JavaScript) ou uma linguagem intermediária para uma máquina virtual (javac gerando **bytecode** da JVM, tópico 1.1.3).

A palavra-chave é *preservar o significado*. O compilador tem liberdade total para mudar **como** o programa faz as coisas (reordenar instruções, eliminar cálculos, trocar uma multiplicação por um deslocamento de bits) desde que o comportamento **observável** permaneça o mesmo. Essa liberdade é o que permite as otimizações, e entender onde ela termina explica muitos "comportamentos estranhos" de programas otimizados.

Todo compilador moderno é organizado em três grandes partes:

- **Front-end**: entende o programa. Lê o texto, verifica se ele é válido segundo as regras da linguagem e produz uma representação estruturada. É aqui que nascem os **erros de compilação**.
- **Middle-end**: transforma uma **representação intermediária** (IR) independente de máquina, aplicando otimizações.
- **Back-end**: traduz a IR para a linguagem-alvo concreta, escolhendo instruções, alocando registradores e agendando operações para o processador específico.

Essa separação é a razão pela qual o GCC e o LLVM suportam dezenas de linguagens e arquiteturas: N front-ends e M back-ends compartilham o mesmo middle-end, em vez de N × M compiladores diferentes.

## Diagrama: As fases de um compilador

```text
 código-fonte:   total = preco * 2 + 10;
        │
        ▼
 ┌──────────────────┐   IDENT(total) ASSIGN IDENT(preco) STAR INT(2)
 │ Análise léxica   │ → PLUS INT(10) SEMI
 └──────────────────┘   (sequência de tokens)
        │
        ▼
 ┌──────────────────┐            =
 │ Análise          │          /   \
 │ sintática        │ →    total    +
 └──────────────────┘             /   \
        │                        *     10        (AST)
        ▼                       / \
 ┌──────────────────┐       preco  2
 │ Análise          │ → tabela de símbolos: preco: int (local), total: int
 │ semântica        │   tipos conferidos: int * int → int; int + int → int
 └──────────────────┘   (AST anotada)
        │
        ▼
 ┌──────────────────┐   t1 = preco * 2
 │ Geração de IR    │ → t2 = t1 + 10
 └──────────────────┘   total = t2
        │
        ▼
 ┌──────────────────┐   t1 = preco << 1      (strength reduction)
 │ Otimização       │ → total = t1 + 10
 └──────────────────┘
        │
        ▼
 ┌──────────────────┐   lea eax, [rdi+rdi+10]   (x86-64, gcc -O2)
 │ Geração de código│   ou: iload_1 / iconst_2 / imul / bipush 10 / iadd / istore_2
 └──────────────────┘       (bytecode, javac)
```

Repare que o mesmo front-end pode alimentar back-ends muito diferentes: um gera uma única instrução `lea` de x86-64; o javac gera bytecode para uma máquina de pilha (tópico 4.1.2).

## Análise léxica: de caracteres a tokens

O **lexer** (ou *scanner*) lê o texto caractere a caractere e agrupa os caracteres em **tokens**: unidades com significado, como palavras reservadas (`if`, `class`), identificadores (`preco`), literais (`10`, `"abc"`), operadores (`+`, `==`) e pontuação (`;`, `{`). Espaços e comentários normalmente são descartados aqui.

Internamente, um lexer é um **autômato finito**: cada tipo de token é descrito por uma expressão regular (por exemplo, identificador = `[A-Za-z_$][A-Za-z0-9_$]*`), e o lexer percorre o texto em uma única passada, em tempo O(n). Ele segue a regra do **maximal munch**: sempre consome o maior lexema possível. É por isso que `x+++y` em Java vira `x ++ + y`, e não `x + ++y`, e que `>>=` é um token só.

**Erros léxicos** são os que impedem a formação de um token válido:

- caractere que não pertence à linguagem: `int a = 10 #;` → `illegal character: '#'`;
- literal de string não fechado: `String s = "abc;` → `unclosed string literal`;
- literal numérico fora do intervalo: `long n = 3000000000;` → `integer number too large` (falta o sufixo `L`).

O lexer não sabe nada de gramática: `int 2x = 3;` é lexicamente válido (tokens `int`, `2`, `x`, `=`, `3`, `;`). O erro só aparece na fase seguinte.

## Análise sintática: tokens viram árvore

O **parser** verifica se a sequência de tokens obedece à **gramática** da linguagem, normalmente descrita como uma gramática livre de contexto, e constrói uma **árvore sintática abstrata** (AST). A AST descarta detalhes irrelevantes (parênteses, ponto e vírgula) e mantém a estrutura: quem é operando de quem.

Precedência e associatividade de operadores são codificadas na própria gramática:

```text
expressao -> termo (('+' | '-') termo)*
termo     -> fator (('*' | '/') fator)*
fator     -> NUMERO | IDENT | '(' expressao ')'
```

Como `termo` fica "mais fundo" que `expressao`, a multiplicação se liga antes da soma: `1 + 2 * 3` vira `1 + (2 * 3)`. O laço `(...)*` constrói a árvore da esquerda para a direita, tornando `10 - 4 - 3` igual a `(10 - 4) - 3`.

Um **parser recursivo descendente** implementa cada regra como uma função que chama as funções das regras internas. É simples, rápido (linear no número de tokens para gramáticas LL) e dá ótimas mensagens de erro, e por isso é usado à mão em compiladores de produção: o próprio javac (`com.sun.tools.javac.parser.JavacParser`), o front-end Clang do LLVM e o compilador do Go são recursivos descendentes. Geradores como ANTLR, yacc e bison produzem parsers a partir da gramática.

**Erros sintáticos** são sequências de tokens válidos em ordem inválida:

- `int x = (3 + 4;` → `')' expected`;
- `int 2x = 3;` → `not a statement` / `';' expected`;
- `if (x > 0) { ... ` sem fechar a chave → `reached end of file while parsing`.

## Análise semântica: o programa faz sentido?

Uma frase pode ser gramaticalmente correta e não fazer sentido ("a cadeira bebeu a matemática"). A **análise semântica** verifica as regras que a gramática não consegue expressar:

- **Resolução de nomes**: todo identificador usado foi declarado e está no escopo? O compilador mantém uma **tabela de símbolos** (em geral, um mapa por escopo, encadeado do mais interno ao mais externo) que associa cada nome à sua declaração, tipo e posição.
- **Verificação de tipos**: `int x = "texto";` → `incompatible types: String cannot be converted to int`.
- **Regras de fluxo**: o javac garante *definite assignment* (`variable y might not have been initialized`), que todo caminho de um método não `void` retorna um valor (`missing return statement`), que código inalcançável não existe e que exceções checadas são tratadas ou declaradas.
- **Resolução de sobrecarga** (qual `println` chamar), inferência de tipos genéricos, checagem de acesso (`private`), e assim por diante.

No javac, isso acontece nas fases `Enter` (popula a tabela de símbolos), `Attr` (atribui tipos e resolve nomes) e `Flow` (análise de fluxo). Um detalhe curioso: se `Attr` encontra erros, o javac pode nem rodar `Flow` naquela classe. Por isso, às vezes você corrige um erro de tipo e "aparecem" novos erros de variável não inicializada que já estavam lá.

### Erros de compilação versus erros de runtime

Um **erro de compilação** é detectado antes de o programa rodar, sobre **todos os caminhos possíveis** do código, inclusive os que nenhum teste exercita. Um **erro de runtime** só aparece quando um caminho específico é executado com dados específicos: `ArithmeticException` em uma divisão por zero, `NullPointerException`, `ArrayIndexOutOfBoundsException`, `ClassCastException`.

A **tipagem estática** desloca uma classe inteira de falhas do runtime para a compilação. Em Python, `len(5)` só falha quando a linha executa (talvez às 3h da manhã, em produção, num ramo raro). Em Java, o equivalente nem compila. O compilador funciona como um provador automático de teoremas: "nenhuma execução deste programa chamará um método inexistente neste objeto".

Mas essa prova tem limites, e conhecê-los é essencial:

- **Decidibilidade**: o compilador não pode, em geral, provar que um índice está dentro do array ou que um valor nunca é `null` (problema da parada). Essas verificações ficam para o runtime.
- **Escapes do sistema de tipos**: casts explícitos (`(String) obj`), reflexão, *raw types* e *type erasure* de genéricos fazem com que o erro volte a ser de runtime.
- **Compilação separada**: o javac confere seu código contra as classes que estavam no classpath **no momento da compilação**. Se em runtime outra versão da biblioteca for carregada, surgem `NoSuchMethodError` e `NoClassDefFoundError` (tópico 1.1.5).

## Otimizações e seus efeitos observáveis

Otimizações transformam a IR em uma equivalente mais rápida ou menor. As mais importantes:

| Otimização | O que faz | Exemplo |
|---|---|---|
| **Constant folding** | Calcula em compilação expressões com operandos constantes | `24 * 60 * 60` → `86400` |
| **Constant propagation** | Substitui variáveis de valor conhecido pelo valor | `x = 5; y = x + 1` → `y = 6` |
| **Dead code elimination** | Remove código cujo resultado não é usado ou que nunca executa | `if (false) {...}` desaparece |
| **Inlining** | Copia o corpo do método chamado no lugar da chamada | `getX()` vira acesso direto ao campo |
| **Common subexpression elimination** | Calcula uma vez expressões repetidas | `a*b + a*b` → `t = a*b; t + t` |
| **Loop-invariant code motion** | Tira do laço cálculos que não mudam | `n * 2` calculado antes do `for` |

O **inlining** é chamado de "a mãe das otimizações": sozinho economiza o custo de uma chamada, mas sobretudo expõe o código do método chamado ao contexto de quem chama, habilitando folding, eliminação de código e escape analysis que seriam impossíveis olhando cada método isoladamente.

Otimizações têm **efeitos observáveis** que todo desenvolvedor Java encontra cedo ou tarde:

- **Constantes copiadas entre classes.** Um campo `static final` de tipo primitivo ou `String` inicializado com uma expressão constante é uma *constant variable* (JLS 13.1). O javac **copia o valor** para cada classe que o usa. Se você altera `Config.LIMITE` de 100 para 200 e recompila só `Config`, as classes que usavam o valor continuam com `100` embutido no bytecode delas.
- **Compilação condicional.** `static final boolean DEBUG = false;` faz o javac omitir completamente o corpo de `if (DEBUG) { ... }`. É o equivalente Java do `#ifdef` do C.
- **Microbenchmarks que medem o nada.** O JIT elimina cálculos cujo resultado não é usado. Um laço que "soma um milhão de números" e descarta a soma pode virar um laço vazio, ou nem existir (tópico 4.1.4).
- **Concorrência.** O compilador pode guardar em registrador um campo lido dentro de um laço. Sem `volatile` ou sincronização, uma thread pode nunca enxergar a escrita feita por outra. As regras que limitam essas otimizações são o Java Memory Model.

## Exemplo: Constant folding no javac

```java
public class CF {
    static final String A = "Olá, ";
    static final String B = "mundo";
    static String c = "Olá, ";
    static String d = "mundo";
    static final boolean DEBUG = false;
    static final int SEGUNDOS_NO_DIA = 24 * 60 * 60;

    static String constante()    { return A + B; }
    static String naoConstante() { return c + d; }
    static int segundos()        { return SEGUNDOS_NO_DIA; }
    static void log()            { if (DEBUG) System.out.println("debug"); }
}
```

```bash
javac CF.java && javap -c -p CF
```

Trecho relevante da saída (os números de entrada do constant pool, como `#9`, variam):

```text
static java.lang.String constante();
  0: ldc           #9      // String Olá, mundo
  2: areturn

static java.lang.String naoConstante();
  0: getstatic     #11     // Field c:Ljava/lang/String;
  3: getstatic     #15     // Field d:Ljava/lang/String;
  6: invokedynamic #18, 0  // InvokeDynamic #0:makeConcatWithConstants:(...)
 11: areturn

static int segundos();
  0: ldc           #22     // int 86400
  2: ireturn

static void log();
  0: return
```

O que observar:

- Em `constante()`, a concatenação **não existe mais**: o javac juntou as duas strings em tempo de compilação e gerou uma única constante.
- Em `naoConstante()`, como `c` e `d` podem mudar, a concatenação acontece em runtime. Desde o Java 9 (JEP 280), o javac emite um `invokedynamic` para `StringConcatFactory`, e a estratégia concreta de concatenação é escolhida pela JVM na primeira execução.
- `24 * 60 * 60` virou `86400`.
- O corpo de `log()` sumiu: a chamada a `println` nem está no bytecode.

Isso é quase tudo o que o javac otimiza. Ele faz folding de expressões constantes (que a JLS exige, para `switch` e anotações) e omite código protegido por condições constantes. Não faz inlining de métodos, não elimina subexpressões, não otimiza laços. Isso é proposital, como veremos a seguir.

## AOT, interpretação e JIT

Há três estratégias fundamentais para executar um programa escrito em linguagem de alto nível:

**Compilação ahead-of-time (AOT).** O programa é todo traduzido para código de máquina **antes** de executar. C, C++, Rust e Go funcionam assim. A execução começa imediatamente em velocidade máxima, mas o compilador só conhece o que é visível no código-fonte: não sabe quais ramos são quentes, quais tipos realmente aparecem numa chamada polimórfica, nem em qual CPU exata o binário vai rodar (por isso binários distribuídos costumam mirar um conjunto de instruções genérico).

**Interpretação.** Um programa (o interpretador) lê a representação do código, instrução por instrução, e executa a ação correspondente. O núcleo é um laço *fetch-decode-dispatch* (tópico 1.1.1) implementado em software: buscar a próxima instrução, decidir o que ela é, saltar para a rotina que a executa. Começa instantaneamente e é portável, mas paga esse overhead de despacho em **toda** instrução, tipicamente de 10 a 50 vezes mais lento que código nativo otimizado.

**Compilação just-in-time (JIT).** O programa começa interpretado; enquanto roda, o runtime mede o que acontece e **compila para código nativo, durante a execução, apenas os trechos que valem a pena**. O JIT tem uma vantagem que nenhum compilador AOT tem: **informação de perfil da execução real**. Ele sabe que um `if` nunca foi verdadeiro, que um `List` é sempre um `ArrayList`, que um laço roda milhões de vezes. Pode otimizar com base em **suposições especulativas** e, se a suposição deixar de valer, descartar o código e voltar ao interpretador (*deoptimization*).

| Critério | AOT | Interpretação | JIT |
|---|---|---|---|
| Tempo até executar | Rápido (já é nativo) | Imediato | Imediato, mas lento no início |
| Desempenho de pico | Alto, sem perfil (PGO ajuda) | Baixo | Alto, guiado por perfil real |
| Uso de memória/CPU do runtime | Baixo | Baixo | Alto (compilador + perfis + code cache) |
| Portabilidade do artefato | Um binário por plataforma | Alta | Alta (bytecode) |
| Otimização especulativa | Não | Não | Sim, com deoptimização |

## O caminho do Java: javac, interpretador, C1 e C2

Java combina as três ideias em dois estágios de compilação:

1. **javac** faz o front-end completo (léxica, sintática, semântica, todas as checagens de tipo) e gera bytecode, uma IR portátil, compacta e verificável. Por isso o javac quase não otimiza: qualquer otimização feita ali seria cega (sem perfil), dificultaria a depuração e a verificação de bytecode, e seria refeita melhor pelo JIT de qualquer forma. Um bytecode próximo do código-fonte também facilita ferramentas de instrumentação, agentes e debuggers.
2. **A JVM (HotSpot)** carrega o bytecode e o executa de forma adaptativa, com **tiered compilation** (detalhes no tópico 4.1.4):
   - **Nível 0, interpretador**: todo método começa aqui. O interpretador do HotSpot é um *template interpreter*: na inicialização da JVM, ele gera um pequeno trecho de código de máquina para cada bytecode, e despachar uma instrução é saltar para o template correspondente. Ele mantém contadores de invocação e de iterações de laço (*back-edges*).
   - **Nível 3, C1 com profiling**: quando um método passa de algumas centenas de invocações, o **C1** (compilador "cliente") o compila rapidamente, com otimizações leves, e instrumenta o código para coletar perfis: tipos vistos em cada chamada, ramos tomados, contagens.
   - **Nível 4, C2**: quando o método continua quente (milhares de invocações ou de iterações de laço), o **C2** (compilador "servidor") o recompila com otimizações agressivas guiadas pelo perfil: inlining profundo, escape analysis, desenrolamento e vetorização de laços, eliminação de checagens de limites de array, devirtualização especulativa.
   - **Deoptimização**: se uma suposição do C2 falha (aparece um tipo novo numa chamada que era monomórfica, um ramo "impossível" é tomado), o código é marcado como *not entrant* e a execução volta ao interpretador, que coleta novos perfis.
   - **OSR (*on-stack replacement*)**: um método chamado uma única vez, mas com um laço que roda bilhões de iterações, pode ser trocado por código compilado **no meio do laço**.

O código nativo gerado fica no **code cache**, uma região de memória fora do heap (`-XX:ReservedCodeCacheSize`). Se ela enche, o JIT para de compilar e a aplicação degrada silenciosamente para o interpretador, uma falha real em serviços grandes.

## Diagrama: Do .java ao código nativo

```text
   COMPILAÇÃO (uma vez, na máquina do desenvolvedor/CI)
   ┌──────────┐   javac: léxica, sintática,    ┌────────────┐
   │ Foo.java │ ─ semântica, constant folding ─▶│ Foo.class  │ bytecode portátil
   └──────────┘                                 └─────┬──────┘
                                                      │ class loading (4.1.3)
   EXECUÇÃO (em cada JVM, a cada inicialização)       ▼
   ┌───────────────────────────────────────────────────────────────┐
   │  nível 0: interpretador ── contadores de chamadas e de laços  │
   │      │ quente                                                 │
   │      ▼                                                        │
   │  nível 3: C1 + profiling ── tipos, ramos, frequências         │
   │      │ muito quente                                           │
   │      ▼                                                        │
   │  nível 4: C2 ── inlining, escape analysis, vetorização...     │
   │      │                    ▲                                   │
   │      │ suposição falhou   │ re-perfila e recompila            │
   │      └──▶ deoptimização ──┘ (volta ao interpretador)          │
   │                                                               │
   │  código nativo ──▶ code cache (fora do heap)                  │
   └───────────────────────────────────────────────────────────────┘
```

Você pode observar esse processo com `java -XX:+PrintCompilation`. Cada linha mostra o instante (ms), um id de compilação, flags (`%` indica OSR), o nível (3 = C1 com perfil, 4 = C2) e o método. `made not entrant` indica que uma versão antiga foi descartada, por ter sido substituída por uma melhor ou por deoptimização.

## AOT versus JIT na prática: GraalVM Native Image

O **GraalVM Native Image** compila uma aplicação Java inteira **ahead-of-time** em um executável nativo. Para isso, faz uma análise de **mundo fechado** (*closed world*): partindo do `main`, descobre todo o código alcançável, inicializa parte das classes durante o build e grava um "snapshot" do heap inicial dentro do binário. O resultado não precisa de JVM nem de JIT em runtime.

| Aspecto | JVM com JIT (HotSpot) | Native Image (AOT) |
|---|---|---|
| Startup | Centenas de ms a alguns segundos (class loading, interpretação, warm-up) | Dezenas de ms |
| Memória (RSS) | Maior: metaspace, code cache, compiladores, perfis | Bem menor |
| Desempenho de pico | Geralmente maior em serviços de longa duração (otimização por perfil real) | Geralmente menor; PGO (na edição Oracle) reduz a diferença |
| Tempo de build | Segundos | Minutos, com muita memória |
| Dinamismo | Total: reflexão, proxies, carregamento de classes em runtime | Restrito: reflexão, recursos e proxies precisam ser declarados em metadados de configuração |
| Diagnóstico | JFR, JMX, heap dumps, agentes maduros | Mais limitado |

**Quando native-image é vantajoso em backend:** funções serverless e jobs curtos, em que o startup domina o custo; CLIs; microserviços que escalam de zero sob demanda (scale-to-zero no Kubernetes ou Knative); ambientes com memória cara e muitas réplicas pequenas. Frameworks como Quarkus, Micronaut e Spring Boot 3 (Spring AOT) têm suporte de primeira classe.

**Quando não é:** serviços de longa duração com tráfego intenso e estável, em que o JIT atinge throughput de pico maior; aplicações que dependem de muita reflexão ou geração dinâmica de bytecode sem suporte do framework; times que precisam de builds rápidos e da maturidade de diagnóstico da JVM.

O OpenJDK também ataca o problema de startup sem abrir mão do JIT: **CDS/AppCDS** (*Class Data Sharing*, que mapeia classes já processadas a partir de um arquivo) e o **Project Leyden**, que no JDK 24 introduziu um cache AOT de classes já carregadas e linkadas (JEP 483), no JDK 25 passou a guardar também perfis de métodos coletados num treino (JEP 515) e segue evoluindo na direção de cachear código já compilado.

## Custos, limitações e uso em sistemas reais

- **Warm-up é real.** Logo após subir, um serviço Java roda grande parte do código no interpretador e no C1; a latência dos primeiros minutos é pior, e o JIT consome CPU compilando. Em Kubernetes, isso pede *readiness probes* que só liberam tráfego depois de um aquecimento, ou rotas de warm-up, sobretudo quando o HPA escala em picos.
- **Benchmarks sem warm-up mentem.** Medir as primeiras iterações mede o interpretador e o compilador trabalhando, não o código otimizado. Medir sem consumir o resultado permite ao JIT eliminar o trabalho. Use JMH (tópico 4.1.4).
- **O JIT custa CPU e memória.** Em containers com 1 vCPU, as threads do compilador competem com a aplicação durante o startup. O code cache e os perfis ocupam memória fora do heap, o que precisa entrar no cálculo do limite do container.
- **Desempenho depende do perfil.** Um código que se comporta de um jeito no aquecimento e de outro em produção (por exemplo, um tipo novo aparecendo numa chamada) provoca deoptimização e recompilação, que aparecem como picos de latência.
- **Erros de compilação são baratos; erros de runtime são caros.** Cada regra que o compilador verifica é uma classe de incidente que não chega à produção. Por isso vale tratar *warnings* como erros (`-Werror` no javac), usar tipos mais precisos e ferramentas de análise estática (Error Prone, NullAway, SpotBugs), que estendem a análise semântica do compilador.

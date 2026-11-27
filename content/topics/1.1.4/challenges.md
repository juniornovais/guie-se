## Classificar erros de exemplo como léxicos, sintáticos, semânticos ou de runtime

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Fases do compilador", "Tokens e gramática", "Tabela de símbolos e tipos", "Erros de runtime"]}
```

### Enunciado

Cada trecho abaixo, isolado dentro do método `main` de uma classe Java, contém **exatamente um** problema. Classifique cada um como erro **léxico**, **sintático**, **semântico** (todos detectados pelo javac) ou de **runtime** (o programa compila, mas falha ao executar).

```java
// (a)
int total = 10 # 2;

// (b)
int x = (3 + 4;

// (c)
int idade = "trinta";

// (d)
int[] v = new int[3];
v[3] = 1;

// (e)
String s = "pedido;

// (f)
int y;
System.out.println(y);

// (g)
Object o = "texto";
Integer n = (Integer) o;

// (h)
int 2pedidos = 5;

// (i)
System.out.println(quantidade);   // 'quantidade' não foi declarada

// (j)
long grande = 3000000000;
```

### Objetivo

Associar cada tipo de erro à fase que o detecta e entender por que alguns problemas só aparecem em runtime, mesmo numa linguagem estaticamente tipada.

### Instruções

1. Para cada item, escreva a classificação e a fase do compilador (ou da JVM) responsável.
2. Para os erros de compilação, escreva a mensagem que você espera do javac.
3. Para os erros de runtime, diga qual exceção é lançada e por que o compilador não consegue detectá-la.
4. Confira compilando cada trecho com `javac` (coloque um por vez num `main`).

### Dicas

- Pergunte-se: "o lexer consegue formar tokens com esses caracteres?" Se sim, passe para a próxima fase.
- Se todos os tokens são válidos, mas a ordem deles não obedece à gramática, o erro é sintático.
- Erros semânticos exigem saber tipos ou declarações (tabela de símbolos). Erros de runtime dependem do valor concreto que só existe quando o código executa.

### Critérios de avaliação

- Classifica corretamente pelo menos 9 dos 10 itens.
- Explica que (h) é sintático, e não léxico, porque `2` e `pedidos` são tokens válidos em ordem inválida.
- Explica que (f) é semântico (regra de *definite assignment*, análise de fluxo), embora não envolva tipos.
- Justifica por que (d) e (g) só podem ser detectados em runtime (valor do índice e tipo dinâmico do objeto).

### Solução de referência

| Item | Classificação | Fase / mensagem |
|---|---|---|
| (a) | Léxico | Lexer: `illegal character: '#'` |
| (b) | Sintático | Parser: `')' expected` |
| (c) | Semântico | Verificação de tipos (`Attr`): `incompatible types: String cannot be converted to int` |
| (d) | Runtime | `ArrayIndexOutOfBoundsException: Index 3 out of bounds for length 3` |
| (e) | Léxico | Lexer: `unclosed string literal` |
| (f) | Semântico | Análise de fluxo (`Flow`): `variable y might not have been initialized` |
| (g) | Runtime | `ClassCastException: class java.lang.String cannot be cast to class java.lang.Integer` |
| (h) | Sintático | Parser: `not a statement` e `';' expected` |
| (i) | Semântico | Resolução de nomes: `cannot find symbol` |
| (j) | Léxico | Literal inteiro fora do intervalo de `int`: `integer number too large` (precisa do sufixo `L`) |

Comentários:

- **(h)** é a pegadinha clássica. O lexer, aplicando *maximal munch*, produz `int`, `2`, `pedidos`, `=`, `5`, `;`, todos tokens válidos. Quem reclama é o parser, porque a gramática exige um identificador depois do tipo.
- **(j)** é léxico em natureza: o literal `3000000000` sem sufixo é um literal `int`, e um literal `int` acima de 2.147.483.647 é inválido por si só, antes de qualquer análise de tipos. No javac, a checagem ocorre durante a conversão do literal pelo parser, mas o motivo é a forma do token.
- **(f)** mostra que "semântico" é mais amplo que "tipos": a JLS exige que toda variável local seja definitivamente atribuída antes do uso, e o javac prova isso analisando todos os caminhos.
- **(d)** e **(g)**: o compilador não sabe, em geral, o valor de um índice nem o tipo dinâmico de um `Object`. O cast explícito em (g) é uma promessa do programador que o compilador aceita e a JVM verifica (instrução `checkcast`). Em (d), mesmo com a constante `3` visível, a JLS não exige essa análise e o javac não a faz; a JVM verifica limites em todo acesso a array (e o JIT remove a verificação quando prova que é desnecessária).

## Observar constant folding comparando o bytecode de final static String concatenadas vs. não finais

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["Constant folding", "Constant variables (JLS)", "javap", "invokedynamic e StringConcatFactory"]}
```

### Enunciado

Escreva uma classe com duas constantes `static final String` e dois campos `static String` não finais, com os mesmos valores. Crie um método que concatena as constantes e outro que concatena os campos não finais. Use `javap -c` para comparar o bytecode e explique a diferença. Depois, investigue o efeito colateral do folding entre classes.

### Objetivo

Ver com os próprios olhos uma otimização feita pelo javac e entender suas consequências práticas, inclusive a armadilha de constantes copiadas entre classes.

### Instruções

1. Crie `Saudacao.java` com `static final String A = "Olá, ";`, `static final String B = "mundo";`, `static String c = "Olá, ";`, `static String d = "mundo";` e os métodos `constante()` (`return A + B;`) e `naoConstante()` (`return c + d;`).
2. Compile e rode `javap -c -p Saudacao`. Compare os dois métodos.
3. Adicione `static final int SEGUNDOS = 24 * 60 * 60;` e um método que o retorna. O que aparece no bytecode?
4. Teste também com variáveis locais `final String x = "a"; final String y = "b"; return x + y;`.
5. Experimento entre classes: crie `Config.java` com `public static final int LIMITE = 100;` e `Uso.java` com um `main` que imprime `Config.LIMITE`. Compile os dois, rode `Uso`. Depois mude `LIMITE` para `200`, recompile **somente** `Config.java` e rode `Uso` de novo.
6. Responda: `"Olá, mundo" == Saudacao.constante()` é `true` ou `false`? E com `naoConstante()`?

### Dicas

- Procure pela instrução `ldc` (carrega uma constante do constant pool) e por `invokedynamic`.
- A JLS chama de *constant variable* uma variável `final` de tipo primitivo ou `String` inicializada com uma expressão constante. Só elas participam do folding.
- No passo 5, rode `javap -c Uso` e procure por `getstatic`. Ele está lá?

### Critérios de avaliação

- Mostra que `constante()` virou um único `ldc "Olá, mundo"` e que `naoConstante()` usa `getstatic` + `invokedynamic makeConcatWithConstants`.
- Mostra que `24 * 60 * 60` aparece como `86400` no bytecode.
- Reproduz o problema do passo 5 (continua imprimindo `100`) e explica a causa.
- Responde corretamente à pergunta do passo 6, relacionando constantes com o *string pool*.

### Solução de referência

```java
public class Saudacao {
    static final String A = "Olá, ";
    static final String B = "mundo";
    static String c = "Olá, ";
    static String d = "mundo";
    static final int SEGUNDOS = 24 * 60 * 60;

    static String constante()    { return A + B; }
    static String naoConstante() { return c + d; }
    static int segundos()        { return SEGUNDOS; }
    static String local() {
        final String x = "a";
        final String y = "b";
        return x + y;
    }

    public static void main(String[] args) {
        System.out.println("Olá, mundo" == constante());    // true
        System.out.println("Olá, mundo" == naoConstante()); // false
    }
}
```

Saída ilustrativa de `javap -c -p Saudacao` (índices do constant pool variam):

```text
static java.lang.String constante();
  0: ldc           #9      // String Olá, mundo
  2: areturn

static java.lang.String naoConstante();
  0: getstatic     #11     // Field c:Ljava/lang/String;
  3: getstatic     #15     // Field d:Ljava/lang/String;
  6: invokedynamic #18, 0  // InvokeDynamic #0:makeConcatWithConstants:(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;
 11: areturn

static int segundos();
  0: ldc           #22     // int 86400
  2: ireturn

static java.lang.String local();
  0: ldc           #23     // String ab
  2: areturn
```

Explicação:

- `A + B` é uma **expressão constante** (JLS 15.29): o javac calcula o resultado e grava `"Olá, mundo"` no constant pool. Em runtime não há concatenação alguma. O mesmo vale para `x + y` com locais `final` e para `24 * 60 * 60`.
- `c + d` depende de valores que podem mudar, então a concatenação acontece em runtime via `invokedynamic`. Na primeira execução, o *bootstrap method* de `StringConcatFactory` gera a estratégia de concatenação; nas seguintes, a chamada já está ligada.
- Passo 6: literais e constantes de string são *interned* (vão para o string pool), então `"Olá, mundo" == constante()` é `true`: é literalmente o mesmo objeto. `naoConstante()` cria uma `String` nova a cada chamada, então `==` é `false` (e `equals` é `true`). Isso é uma curiosidade para entender o mecanismo, nunca um motivo para comparar strings com `==`.
- Passo 5: como `Config.LIMITE` é uma constant variable, o javac **copiou o valor 100** para o bytecode de `Uso` (`bipush 100`), sem `getstatic`. Recompilar só `Config` não altera `Uso`, que continua imprimindo `100`. A JLS (13.4.9) documenta isso: mudar o valor de uma constante exige recompilar todos os usuários. Em bibliotecas, isso significa que constantes públicas fazem parte do contrato binário. Para valores que podem mudar entre versões, exponha um método (`static int limite()`) ou inicialize o campo de forma não constante.

## Usar -XX:+PrintCompilation para observar métodos sendo compilados pelo JIT durante um warm-up

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["Tiered compilation", "C1 e C2", "OSR", "Deoptimização", "Warm-up"]}
```

### Enunciado

Escreva um programa que execute repetidamente um método computacionalmente simples, em rodadas, medindo o tempo de cada rodada. Rode-o com `-XX:+PrintCompilation` e relacione a queda do tempo por rodada com os eventos de compilação mostrados pela JVM.

### Objetivo

Observar empiricamente a progressão interpretador → C1 → C2, identificar OSR e versões descartadas (`made not entrant`) e entender o que significa "warm-up".

### Instruções

1. Crie um método `static long soma(int[] dados)` que percorre o array acumulando `v * 31L`.
2. Em `main`, crie um array de 10.000 inteiros e faça 20 rodadas; cada rodada chama `soma` 200 vezes e imprime o tempo da rodada em microssegundos (`System.nanoTime()`). Acumule e imprima o resultado no final, para que o JIT não possa descartá-lo.
3. Rode com `java -XX:+PrintCompilation Aquecimento | grep -E "Aquecimento|rodada"` (no PowerShell, use `Select-String "Aquecimento|rodada"`).
4. Identifique: em que linha aparece a primeira compilação de `soma`? Qual nível? Há alguma linha com `%`? Quando o tempo por rodada estabiliza?
5. Rode de novo com `-Xint` (só interpretador) e depois com `-XX:TieredStopAtLevel=1` (só C1). Compare os tempos estáveis das três configurações.

### Dicas

- O formato de cada linha é aproximadamente: `timestamp(ms) id flags nível Classe::método [@ bci] (tamanho em bytes) [made not entrant]`.
- `%` marca compilação OSR: o código compilado substitui o interpretado no meio de um laço, e `@ 11` é o índice do bytecode (bci) do laço.
- `made not entrant` não é necessariamente um problema: a versão C1 é descartada quando a versão C2 fica pronta. Deoptimizações por suposições falhas também aparecem assim.

### Critérios de avaliação

- O programa imprime tempos por rodada e o resultado acumulado.
- Identifica corretamente linhas de nível 3 (C1 com profiling) e nível 4 (C2) para `soma`.
- Explica o significado de `%` e de `made not entrant` nas linhas observadas.
- Relaciona a queda de tempo com a chegada da versão C2 e apresenta a comparação `-Xint` × C1 × padrão.

### Solução de referência

```java
public class Aquecimento {
    static long soma(int[] dados) {
        long s = 0;
        for (int v : dados) s += v * 31L;
        return s;
    }

    public static void main(String[] args) {
        int[] dados = new int[10_000];
        for (int i = 0; i < dados.length; i++) dados[i] = i;
        long acumulado = 0;
        for (int rodada = 1; rodada <= 20; rodada++) {
            long inicio = System.nanoTime();
            for (int i = 0; i < 200; i++) acumulado += soma(dados);
            long micros = (System.nanoTime() - inicio) / 1_000;
            System.out.println("rodada " + rodada + ": " + micros + " us");
        }
        System.out.println(acumulado);
    }
}
```

Saída ilustrativa (JDK 21, x86-64; tempos e ids variam por máquina e execução):

```text
79   75 %     3       Aquecimento::soma @ 11 (42 bytes)
80   76       3       Aquecimento::soma (42 bytes)
80   77 %     4       Aquecimento::soma @ 11 (42 bytes)
86   75 %     3       Aquecimento::soma @ 11 (42 bytes)   made not entrant
rodada 1: 6894 us
108  182       4       Aquecimento::soma (42 bytes)
112   76       3       Aquecimento::soma (42 bytes)   made not entrant
rodada 2: 3946 us
rodada 3: 160 us
rodada 4: 159 us
...
rodada 20: 159 us
```

Leitura:

1. Na primeira rodada, `soma` começa no **interpretador** (nível 0). Como o laço interno roda 10.000 iterações por chamada, os contadores de *back-edge* disparam rápido, e a primeira compilação é **OSR em nível 3** (`75 % 3 ... @ 11`): o C1 compila o laço e a execução salta para o código compilado no meio do método.
2. Logo depois, o método inteiro é compilado em nível 3 (`76`), e o laço quente ganha uma versão OSR em **nível 4, C2** (`77 %`). A versão OSR de nível 3 vira `made not entrant` porque foi superada.
3. Na segunda rodada, a versão C2 do método inteiro (`182 4`) fica pronta, e a versão C1 (`76`) é descartada. A partir da terceira rodada, o tempo estabiliza em cerca de 160 µs, **mais de 40 vezes** mais rápido que a primeira rodada.
4. Comparação típica: com `-Xint`, todas as rodadas ficam próximas do tempo da primeira (ou piores, pois nem o C1 ajuda); com `-XX:TieredStopAtLevel=1`, o tempo estável fica entre o do interpretador e o do C2 (o C1 não faz otimizações agressivas de laço, como desenrolamento e vetorização); no padrão, o C2 vence.

Conclusão: "warm-up" é o período em que o código ainda está no interpretador ou em versões menos otimizadas, e o JIT está gastando CPU para compilar. Qualquer medição de desempenho feita nesse período mede a JVM se adaptando, não o código em regime estável. A dinâmica completa (limiares, filas de compilação, code cache) é aprofundada no tópico 4.1.4.

## Explicar por que benchmarks Java sem warm-up produzem resultados enganosos

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["JIT e tiered compilation", "Dead code elimination", "OSR", "JMH"]}
```

### Enunciado

Em uma entrevista, você recebe este código e a pergunta: "Um colega usou este benchmark para concluir que `StringBuilder` é só 2x mais rápido que concatenação com `+` em laço. Você confia no resultado? Por quê? Como você mediria?"

```java
public class Bench {
    public static void main(String[] args) {
        long t0 = System.nanoTime();
        String s = "";
        for (int i = 0; i < 1_000; i++) s += i;
        long t1 = System.nanoTime();

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 1_000; i++) sb.append(i);
        long t2 = System.nanoTime();

        System.out.println("concat: " + (t1 - t0) + " ns");
        System.out.println("builder: " + (t2 - t1) + " ns");
    }
}
```

### Objetivo

Articular, com o vocabulário de compiladores e da JVM, os motivos pelos quais um microbenchmark ingênuo mede a coisa errada e propor uma metodologia correta.

### Instruções

1. Liste todos os problemas metodológicos do código, relacionando cada um a um mecanismo da JVM.
2. Explique o que exatamente está sendo medido em cada trecho.
3. Proponha como medir corretamente, citando a ferramenta adequada.
4. Responda em 2 a 4 minutos de fala, como numa entrevista.

### Dicas

- Em que nível de execução (interpretador, C1, C2) cada laço roda nesse programa? Os dois laços estão em condições iguais?
- O que o JIT pode fazer com um resultado que ninguém usa?
- Uma única medição de poucos microssegundos é afetada por quais ruídos? Pense em GC, timers, frequência da CPU e class loading de `StringConcatFactory`.

### Critérios de avaliação

- Aponta a ausência de warm-up e explica que a medição inclui interpretação e compilação.
- Aponta a assimetria entre os dois trechos (ordem, OSR, class loading do primeiro uso).
- Menciona dead code elimination e a necessidade de consumir o resultado.
- Menciona variância/ruído (uma única amostra, GC, timer) e propõe JMH com warm-up, múltiplas iterações, forks e `Blackhole`.

### Solução de referência

Não confio no resultado, por cinco motivos:

1. **Sem warm-up.** Tudo roda dentro de `main`, executado uma única vez. Os laços começam no **interpretador**; o JIT pode compilar via **OSR** no meio do laço, mas o tempo medido mistura interpretação, tempo de compilação (que roda em threads de background, porém compete por CPU) e só um pouco de código otimizado. Em produção, esse código rodaria aquecido pelo C2, com outro perfil de custo.
2. **Comparação assimétrica.** O primeiro trecho paga custos de primeiro uso: a primeira concatenação com `+` dispara o *bootstrap* do `invokedynamic` (`StringConcatFactory`), que carrega classes e gera código. O segundo trecho se beneficia de classes já carregadas (`Integer`, `String`) e de caches aquecidos. Inverter a ordem muda o resultado.
3. **Dead code elimination.** `s` e `sb` nunca são usados depois. Quando o código está compilado, o C2 pode provar que parte do trabalho não tem efeito observável e eliminá-lo; o benchmark passa a medir menos do que parece. Nesse exemplo o risco é menor porque as alocações acontecem, mas o padrão "calcular e descartar" é a causa mais comum de benchmarks que reportam tempos impossivelmente baixos.
4. **Uma única amostra e escala errada.** Mil iterações levam microssegundos; a medição sofre com resolução do timer, interrupções do SO, variação de frequência da CPU e uma eventual coleta de lixo no meio. Sem repetição, não há média, desvio nem intervalo de confiança.
5. **Tamanho do problema irrealista.** A concatenação com `+` em laço é O(n²) em cópias de caracteres (cada `+=` cria uma nova `String`); com n = 1.000, o efeito quadrático mal aparece. A conclusão "só 2x" não se generaliza.

Como medir: usar **JMH** (Java Microbenchmark Harness), que executa iterações de **warm-up** descartadas antes das iterações de medição, roda em **forks** separados da JVM (para que os perfis de um benchmark não contaminem o outro), devolve o resultado do método ou o consome com `Blackhole` (impedindo dead code elimination), usa `@State` para que entradas não sejam constantes que o JIT possa dobrar, parametriza o tamanho (`@Param({"100", "1000", "100000"})`) e reporta média e erro. O tópico 4.1.4 aprofunda os mecanismos e o JMH.

## Implementar um lexer e um parser recursivo descendente para expressões com precedência de operadores

```meta
{"type": "implementation", "level": 4, "required": false, "knowledge": ["Análise léxica", "Gramáticas e precedência", "Parser recursivo descendente", "AST", "Records e sealed interfaces"]}
```

### Enunciado

Implemente em Java um front-end de compilador para expressões aritméticas com números (inteiros e decimais), `+`, `-`, `*`, `/`, `^` (potência), menos unário e parênteses. O programa deve: (1) transformar o texto em tokens; (2) construir uma AST respeitando precedência e associatividade; (3) imprimir a AST totalmente parentizada; (4) avaliar a expressão. Erros devem indicar a fase (léxica, sintática ou runtime) e a posição.

### Objetivo

Construir, na prática, as duas primeiras fases de um compilador e entender como precedência e associatividade são codificadas na estrutura da gramática.

### Instruções

1. Defina os tipos de token e implemente `tokenizar(String)`, que retorna uma lista de tokens com tipo, texto e posição. Rejeite caracteres inválidos e números mal formados (como `1.2.3`).
2. Escreva a gramática antes do código. Precedência, da menor para a maior: `+ -` < `* /` < menos unário < `^`. `+ - * /` são associativos à esquerda; `^` é associativo à direita.
3. Implemente uma função por regra da gramática (parser recursivo descendente) produzindo nós da AST (sugestão: `sealed interface` + `record`).
4. Implemente `imprimir(No)` (forma parentizada) e `avaliar(No)`. Divisão por zero deve ser um erro de runtime, não de compilação.
5. Teste com: `1 + 2 * 3`, `(1 + 2) * 3`, `10 - 4 - 3`, `2 ^ 3 ^ 2`, `-2 ^ 2`, `8 / 2 / 2`, `2 * (3 + 4) - -1`, `1 + # 2`, `1.2.3`, `(1 + 2`, `1 + * 2`, `1 / (2 - 2)`.

### Dicas

- Cada nível de precedência vira uma função; a função de menor precedência chama a de maior. A expressão inteira começa pela de menor precedência.
- Associatividade à esquerda sai de um **laço** (`esq = new Binario(op, esq, proximo())`); associatividade à direita sai de **recursão** (`new Binario('^', base, unario())`).
- `-2 ^ 2` deve resultar em `-4` (como em matemática e em Python): a potência se liga mais forte que o menos unário, mas o expoente pode ter menos unário (`2 ^ -1`). Por isso `potencia -> primario ('^' unario)?`.

### Critérios de avaliação

- `1 + 2 * 3` = 7, `(1 + 2) * 3` = 9, `10 - 4 - 3` = 3, `8 / 2 / 2` = 2, `2 ^ 3 ^ 2` = 512 e `-2 ^ 2` = -4.
- A AST impressa mostra a estrutura correta (por exemplo, `(2 ^ (3 ^ 2))` e `((10 - 4) - 3)`).
- Erros léxicos e sintáticos são reportados com a fase e a posição, sem stack trace; divisão por zero é reportada como erro de runtime.
- O código tem uma função por regra da gramática, e o lexer é separado do parser.

### Solução de referência

Gramática:

```text
expressao -> termo (('+' | '-') termo)*
termo     -> unario (('*' | '/') unario)*
unario    -> '-' unario | potencia
potencia  -> primario ('^' unario)?
primario  -> NUMERO | '(' expressao ')'
```

```java
import java.util.ArrayList;
import java.util.List;

public class Calculadora {

    // ---------- Análise léxica ----------
    enum Tipo { NUMERO, MAIS, MENOS, VEZES, DIVIDIDO, POTENCIA, ABRE, FECHA, FIM }

    record Token(Tipo tipo, String texto, int posicao) {}

    static final class ErroDeCompilacao extends RuntimeException {
        ErroDeCompilacao(String fase, String msg, int pos) {
            super("Erro " + fase + " na posição " + pos + ": " + msg);
        }
    }

    static List<Token> tokenizar(String fonte) {
        List<Token> tokens = new ArrayList<>();
        int i = 0;
        while (i < fonte.length()) {
            char c = fonte.charAt(i);
            if (Character.isWhitespace(c)) { i++; continue; }
            if (Character.isDigit(c) || c == '.') {
                int inicio = i;
                boolean viuPonto = false;
                while (i < fonte.length()
                        && (Character.isDigit(fonte.charAt(i)) || fonte.charAt(i) == '.')) {
                    if (fonte.charAt(i) == '.') {
                        if (viuPonto) throw new ErroDeCompilacao("léxico", "número mal formado", i);
                        viuPonto = true;
                    }
                    i++;                                   // maximal munch: consome o maior lexema possível
                }
                String lexema = fonte.substring(inicio, i);
                if (lexema.equals(".")) throw new ErroDeCompilacao("léxico", "número mal formado", inicio);
                tokens.add(new Token(Tipo.NUMERO, lexema, inicio));
                continue;
            }
            Tipo tipo = switch (c) {
                case '+' -> Tipo.MAIS;
                case '-' -> Tipo.MENOS;
                case '*' -> Tipo.VEZES;
                case '/' -> Tipo.DIVIDIDO;
                case '^' -> Tipo.POTENCIA;
                case '(' -> Tipo.ABRE;
                case ')' -> Tipo.FECHA;
                default -> throw new ErroDeCompilacao("léxico", "caractere inválido '" + c + "'", i);
            };
            tokens.add(new Token(tipo, String.valueOf(c), i));
            i++;
        }
        tokens.add(new Token(Tipo.FIM, "", fonte.length()));
        return tokens;
    }

    // ---------- AST ----------
    sealed interface No permits Numero, Unario, Binario {}
    record Numero(double valor) implements No {}
    record Unario(char op, No operando) implements No {}
    record Binario(char op, No esq, No dir) implements No {}

    // ---------- Análise sintática (recursivo descendente) ----------
    static final class Parser {
        private final List<Token> tokens;
        private int atual = 0;

        Parser(List<Token> tokens) { this.tokens = tokens; }

        No analisar() {
            No no = expressao();
            if (olhar().tipo() != Tipo.FIM)
                throw erro("token inesperado '" + olhar().texto() + "'");
            return no;
        }

        private No expressao() {
            No esq = termo();
            while (olhar().tipo() == Tipo.MAIS || olhar().tipo() == Tipo.MENOS) {
                char op = avancar().texto().charAt(0);
                esq = new Binario(op, esq, termo());     // laço => associatividade à esquerda
            }
            return esq;
        }

        private No termo() {
            No esq = unario();
            while (olhar().tipo() == Tipo.VEZES || olhar().tipo() == Tipo.DIVIDIDO) {
                char op = avancar().texto().charAt(0);
                esq = new Binario(op, esq, unario());
            }
            return esq;
        }

        private No unario() {
            if (olhar().tipo() == Tipo.MENOS) {
                avancar();
                return new Unario('-', unario());
            }
            return potencia();
        }

        private No potencia() {
            No base = primario();
            if (olhar().tipo() == Tipo.POTENCIA) {
                avancar();
                return new Binario('^', base, unario()); // recursão => associatividade à direita
            }
            return base;
        }

        private No primario() {
            Token t = olhar();
            if (t.tipo() == Tipo.NUMERO) {
                avancar();
                return new Numero(Double.parseDouble(t.texto()));
            }
            if (t.tipo() == Tipo.ABRE) {
                avancar();
                No dentro = expressao();
                if (olhar().tipo() != Tipo.FECHA) throw erro("')' esperado");
                avancar();
                return dentro;
            }
            throw erro(t.tipo() == Tipo.FIM ? "expressão incompleta" : "token inesperado '" + t.texto() + "'");
        }

        private Token olhar() { return tokens.get(atual); }
        private Token avancar() { return tokens.get(atual++); }
        private ErroDeCompilacao erro(String msg) {
            return new ErroDeCompilacao("sintático", msg, olhar().posicao());
        }
    }

    // ---------- "Back-end": avaliação e impressão ----------
    static double avaliar(No no) {
        return switch (no) {
            case Numero n -> n.valor();
            case Unario u -> -avaliar(u.operando());
            case Binario b -> {
                double e = avaliar(b.esq()), d = avaliar(b.dir());
                yield switch (b.op()) {
                    case '+' -> e + d;
                    case '-' -> e - d;
                    case '*' -> e * d;
                    case '/' -> {
                        if (d == 0) throw new ArithmeticException("divisão por zero (erro de runtime)");
                        yield e / d;
                    }
                    case '^' -> Math.pow(e, d);
                    default -> throw new IllegalStateException("operador " + b.op());
                };
            }
        };
    }

    static String imprimir(No no) {
        return switch (no) {
            case Numero n -> n.valor() == Math.rint(n.valor())
                    ? String.valueOf((long) n.valor()) : String.valueOf(n.valor());
            case Unario u -> "(-" + imprimir(u.operando()) + ")";
            case Binario b -> "(" + imprimir(b.esq()) + " " + b.op() + " " + imprimir(b.dir()) + ")";
        };
    }

    public static void main(String[] args) {
        String[] entradas = {
            "1 + 2 * 3", "(1 + 2) * 3", "10 - 4 - 3", "2 ^ 3 ^ 2", "-2 ^ 2",
            "8 / 2 / 2", "2 * (3 + 4) - -1", "1 + # 2", "1.2.3", "(1 + 2", "1 + * 2", "1 / (2 - 2)"
        };
        for (String e : entradas) {
            try {
                No ast = new Parser(tokenizar(e)).analisar();
                System.out.printf("%-20s => %-28s = %s%n", e, imprimir(ast), avaliar(ast));
            } catch (ErroDeCompilacao | ArithmeticException ex) {
                System.out.printf("%-20s => %s%n", e, ex.getMessage());
            }
        }
    }
}
```

Saída:

```text
1 + 2 * 3            => (1 + (2 * 3))                = 7.0
(1 + 2) * 3          => ((1 + 2) * 3)                = 9.0
10 - 4 - 3           => ((10 - 4) - 3)               = 3.0
2 ^ 3 ^ 2            => (2 ^ (3 ^ 2))                = 512.0
-2 ^ 2               => (-(2 ^ 2))                   = -4.0
8 / 2 / 2            => ((8 / 2) / 2)                = 2.0
2 * (3 + 4) - -1     => ((2 * (3 + 4)) - (-1))       = 15.0
1 + # 2              => Erro léxico na posição 4: caractere inválido '#'
1.2.3                => Erro léxico na posição 3: número mal formado
(1 + 2               => Erro sintático na posição 6: ')' esperado
1 + * 2              => Erro sintático na posição 4: token inesperado '*'
1 / (2 - 2)          => divisão por zero (erro de runtime)
```

Pontos de projeto:

- O lexer roda em O(n) e não conhece a gramática; o parser consome tokens com uma posição de leitura (`atual`) e um único token de *lookahead* (`olhar()`), o que caracteriza um parser LL(1).
- A precedência está na **profundidade** das funções: `expressao` chama `termo`, que chama `unario`, que chama `potencia`. Quanto mais fundo, mais forte a ligação.
- Recursão descendente usa a call stack (tópico 1.1.7): expressões com milhares de parênteses aninhados podem causar `StackOverflowError`. Parsers de produção (JSON, por exemplo) limitam a profundidade aceita por isso.
- Extensões naturais: variáveis com tabela de símbolos (análise semântica), constant folding na AST (`Binario` com dois `Numero` vira um `Numero`) e geração de código para uma máquina de pilha, que é exatamente o que o javac faz ao emitir bytecode.

## Explicar as camadas código-fonte → bytecode → código de máquina para um Hello World em Java

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Código-fonte", "Bytecode", "Código de máquina", "JVM", "JIT"]}
```

### Enunciado

Considere o programa abaixo, compilado com `javac Ola.java` e executado com `java Ola` num notebook Linux x86-64 e, depois, o **mesmo** `Ola.class` copiado e executado num MacBook com chip Apple (ARM64).

```java
public class Ola {
    public static void main(String[] args) {
        System.out.println("Olá, mundo!");
    }
}
```

Explique cada representação pela qual esse programa passa, desde o arquivo `.java` até instruções executadas pela CPU, e por que o mesmo `.class` funciona nas duas máquinas.

### Objetivo

Diferenciar código-fonte, bytecode, assembly e código de máquina, e identificar quem produz e quem consome cada um.

### Instruções

1. Liste as representações na ordem em que aparecem, dizendo para cada uma: quem produz, quem consome, se é portável e se é legível por humanos.
2. Descreva o que há dentro de `Ola.class` (pelo menos: número mágico, constant pool e o bytecode de `main`).
3. Explique em que momento surge código de máquina e quem o produz.
4. Explique por que o mesmo `.class` roda em x86-64 e em ARM64, e o que **não** é portável nessa história.
5. Explique onde o assembly entra (ou não entra) no caminho Java, comparando com um Hello World em C.

### Dicas

- Rode `javap -c Ola` e `javap -v Ola` para ver o bytecode e o constant pool.
- Um programa tão curto provavelmente nunca chega a ser compilado pelo JIT. Então, quem executa o `main`?
- O bytecode é portável, mas existe algo que precisa ser específico de cada plataforma.

### Critérios de avaliação

- Identifica as camadas: fonte (`.java`) → bytecode (`.class`) → código de máquina (gerado em tempo de execução pela JVM).
- Descreve o conteúdo do `.class` (CAFEBABE, versão, constant pool, bytecode com `getstatic`, `ldc`, `invokevirtual`, `return`).
- Explica que o código de máquina vem do interpretador (código nativo da própria JVM) e, para métodos quentes, do JIT.
- Explica que o bytecode é portável e que a JVM é específica de cada ISA e SO.
- Explica que, em Java, assembly não é um artefato do build, ao contrário de C (fonte → assembly → objeto → executável).

### Solução de referência

| Camada | Produzida por | Consumida por | Portável? | Legível? |
|---|---|---|---|---|
| `Ola.java` (código-fonte) | programador | `javac` | sim | sim |
| `Ola.class` (bytecode) | `javac` | JVM (verificador, interpretador, JIT) | sim, qualquer JVM 21+ | com `javap` |
| Código de máquina x86-64 ou ARM64 | interpretador e JIT da JVM, em memória, em tempo de execução | a CPU | não | só desmontado |

**Dentro de `Ola.class`:** o número mágico `CA FE BA BE`; a versão do formato (major 65 = Java 21); o *constant pool*, com entradas como a referência ao campo `java/lang/System.out`, a string `"Olá, mundo!"` e a referência ao método `java/io/PrintStream.println:(Ljava/lang/String;)V`; e o bytecode de `main`:

```text
0: getstatic     #7    // Field java/lang/System.out:Ljava/io/PrintStream;
3: ldc           #13   // String Olá, mundo!
5: invokevirtual #15   // Method java/io/PrintStream.println:(Ljava/lang/String;)V
8: return
```

Ou seja: empilhe o objeto `System.out`, empilhe a string, chame `println` virtualmente (desempilhando os dois) e retorne. As chamadas são **simbólicas**, por nome; os endereços só são resolvidos pela JVM em tempo de execução.

**Onde surge código de máquina:** o `java` é um executável nativo (código de máquina para a plataforma) que inicializa a JVM, carrega `Ola` e as classes do JDK de que ela precisa, verifica o bytecode e o executa no **interpretador**. O interpretador da HotSpot é ele mesmo um conjunto de trechos de código de máquina gerados na inicialização, um para cada opcode. Um `main` executado uma única vez não fica "quente" o bastante para o JIT; mas partes do JDK usadas na inicialização (como manipulação de strings) podem ser compiladas pelo C1 durante a execução. Então: código de máquina da própria JVM sempre; código de máquina gerado pelo JIT só para o que for quente.

**Portabilidade:** o `.class` é idêntico nas duas máquinas porque descreve instruções de uma máquina virtual especificada, independentemente da CPU. O que **não** é portável é a JVM: no Linux x86-64 roda um binário ELF x86-64 da JVM, que interpreta e compila para x86-64; no Mac roda um binário Mach-O ARM64, que gera código ARM64. A dependência de plataforma foi movida do programa para a JVM.

**Assembly:** no caminho Java, assembly não aparece como artefato: o JIT gera código de máquina diretamente na memória (é possível vê-lo desmontado com `-XX:+PrintAssembly` e o plugin `hsdis`). Num Hello World em C, o `gcc` gera assembly (visível com `-S`), o montador o transforma num arquivo objeto, o linker produz um executável nativo, e esse executável só roda na ISA e no SO para os quais foi gerado.

## Inspecionar com javap -c o bytecode de um método com loop e mapear cada instrução para a linha Java

```meta
{"type": "code_analysis", "level": 2, "required": true, "knowledge": ["Bytecode", "javap", "Pilha de operandos", "Variáveis locais", "LineNumberTable"]}
```

### Enunciado

Compile a classe abaixo e inspecione o bytecode de `contarPares` com `javap -c -l Contador`. Mapeie cada instrução para a linha Java correspondente e explique o que acontece com a pilha de operandos e com as variáveis locais.

```java
public class Contador {                                      // linha 1
    static int contarPares(int[] numeros, int limite) {      // linha 2
        int pares = 0;                                       // linha 3
        for (int i = 0; i < limite; i++) {                   // linha 4
            if (numeros[i] % 2 == 0) {                       // linha 5
                pares++;                                     // linha 6
            }                                                // linha 7
        }                                                    // linha 8
        return pares;                                        // linha 9
    }
}
```

### Objetivo

Ler bytecode real, entendendo o modelo de máquina de pilha, a numeração das variáveis locais e como estruturas de controle (`for`, `if`) viram saltos.

### Instruções

1. Rode `javac Contador.java` e `javap -c -l Contador`.
2. Identifique o índice de cada variável local (`numeros`, `limite`, `pares`, `i`).
3. Para cada instrução, escreva: a linha Java de origem e o estado da pilha de operandos depois dela.
4. Identifique a condição do `for` e o `if`: quais instruções os implementam? Por que as condições aparecem "invertidas"?
5. Explique por que `pares++` e `i++` não usam a pilha de operandos.
6. Use a `LineNumberTable` para conferir o seu mapeamento.

### Dicas

- Num método `static`, os parâmetros ocupam as primeiras variáveis locais, na ordem em que foram declarados.
- `if_icmpge` compara dois `int` desempilhados; `ifne` compara um `int` desempilhado com zero.
- O compilador gera o salto que **sai** do bloco: "se a condição for falsa, pule o corpo".

### Critérios de avaliação

- Identifica corretamente: `numeros` = local 0, `limite` = 1, `pares` = 2, `i` = 3.
- Mapeia cada offset para a linha certa, de acordo com a `LineNumberTable`.
- Descreve corretamente a pilha após instruções-chave (`iaload`, `irem`, `if_icmpge`, `ifne`).
- Explica que `i < limite` vira `if_icmpge` (sai do laço se `i >= limite`) e `== 0` vira `ifne` (pula o incremento se diferente de zero).
- Explica que `iinc` altera a variável local diretamente, sem passar pela pilha.
- Identifica o `goto` como o salto de volta ao teste do laço.

### Solução de referência

Saída de `javap -c -l Contador` (JDK 21) com o mapeamento:

```text
offset instrução          linha  pilha depois           comentário
  0: iconst_0              3     [0]
  1: istore_2              3     []                     pares = 0
  2: iconst_0              4     [0]
  3: istore_3              4     []                     i = 0
  4: iload_3               4     [i]                    ← início do teste do laço
  5: iload_1               4     [i, limite]
  6: if_icmpge     26      4     []                     se i >= limite, sai do laço
  9: aload_0               5     [numeros]
 10: iload_3               5     [numeros, i]
 11: iaload                5     [numeros[i]]           (verifica null e limites)
 12: iconst_2              5     [numeros[i], 2]
 13: irem                  5     [numeros[i] % 2]
 14: ifne          20      5     []                     se resto != 0, pula o pares++
 17: iinc          2, 1    6     []                     pares++
 20: iinc          3, 1    4     []                     i++
 23: goto          4       4     []                     volta ao teste
 26: iload_2               9     [pares]
 27: ireturn               9     []                     devolve pares
LineNumberTable:
  line 3: 0
  line 4: 2
  line 5: 9
  line 6: 17
  line 4: 20
  line 9: 26
```

**Variáveis locais:** como o método é `static`, não há `this`; `numeros` é a local 0 (uma referência, por isso `aload_0`), `limite` é a 1, `pares` é a 2 e `i` é a 3 (`int`, por isso `iload`/`istore`).

**Estruturas de controle:** o `for` foi traduzido como: inicialização (offsets 2-3), teste (4-6), corpo (9-17), incremento (20) e salto de volta (23). O teste aparece invertido porque o bytecode precisa de um salto para **sair** do laço: "continue enquanto `i < limite`" vira "salte para 26 se `i >= limite`". O mesmo vale para o `if`: "execute `pares++` se o resto for 0" vira "pule para 20 se o resto **não** for 0" (`ifne`). Repare que a linha 4 aparece duas vezes na `LineNumberTable`: o teste e o incremento do `for` são código da mesma linha em posições diferentes.

**`iinc`:** é uma instrução especial que soma uma constante a uma variável local `int` diretamente (`iinc 2, 1` = "local 2 += 1"). Sem ela, `pares++` exigiria `iload_2, iconst_1, iadd, istore_2`. É um exemplo de como o conjunto de instruções foi desenhado para os padrões mais comuns do código.

Quando esse método ficar quente, o JIT C2 transformará essa sequência de pilha em código com `i`, `pares` e `limite` em registradores, provavelmente eliminando a verificação de limites do `iaload` após provar que `i < limite <= numeros.length` (ou inserindo uma verificação antes do laço) e, possivelmente, substituindo o `% 2` por um teste do bit menos significativo.

## Compilar uma função C com gcc -S e comparar o assembly gerado com -O0 e -O2

```meta
{"type": "experiment", "level": 2, "required": false, "knowledge": ["Assembly x86-64", "Otimizações de compilador", "Convenção de chamada", "Registradores"]}
```

### Enunciado

Escreva a função C abaixo num arquivo `soma.c`, gere o assembly com e sem otimização e compare os resultados.

```c
int soma(const int *v, int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += v[i];
    }
    return total;
}
```

### Objetivo

Ler assembly real gerado por um compilador, relacioná-lo com o código-fonte e ver concretamente o que "otimizar" significa: menos acessos à memória, menos instruções e uso de registradores.

### Instruções

1. Gere os dois arquivos: `gcc -O0 -S -masm=intel -o soma_O0.s soma.c` e `gcc -O2 -S -masm=intel -o soma_O2.s soma.c`. Se usar clang, os comandos são equivalentes.
2. Sem Linux ou macOS com compilador? Use WSL no Windows, ou o Compiler Explorer (godbolt.org), escolhendo "x86-64 gcc" e passando `-O0 -masm=intel` e depois `-O2 -masm=intel`. Atenção: com MinGW no Windows, a convenção de chamada é a do Windows x64 (argumentos em `rcx` e `edx`), então os registradores serão diferentes.
3. Em cada versão, identifique: onde chegam os argumentos `v` e `n`, onde ficam `total` e `i`, qual é o laço e onde está o valor de retorno.
4. Conte as instruções dentro do laço em cada versão e quantas delas acessam memória.
5. Gere também a versão `-O3` e descreva o que mudou.
6. Opcional: num Mac com chip Apple ou com `aarch64-linux-gnu-gcc`, gere o assembly ARM64 e compare com o x86-64.

### Dicas

- Na convenção System V (Linux e macOS x86-64), o primeiro argumento inteiro ou ponteiro chega em `rdi`, o segundo em `esi` (parte baixa de `rsi`) e o retorno vai em `eax`.
- Em `-O0`, toda variável mora na stack (`[rbp-4]`, `[rbp-8]`...) e é relida a cada uso. Procure por `DWORD PTR [rbp-...]`.
- Em `-O3`, procure registradores `xmm` e instruções como `paddd`/`movdqu`: é vetorização (SIMD), somando 4 inteiros por instrução.

### Critérios de avaliação

- Gera e apresenta o assembly das duas versões (ou do Compiler Explorer, indicando compilador e flags).
- Identifica corretamente argumentos, variáveis locais, laço e retorno em cada versão.
- Mostra que `-O0` guarda tudo na stack, com vários acessos à memória por iteração, e `-O2` mantém tudo em registradores.
- Compara o número de instruções no laço (ordem de 10 em `-O0` contra 4 em `-O2`).
- Descreve a vetorização em `-O3` (ou explica por que não ocorreu na sua versão do compilador).

### Solução de referência

Saídas **típicas** do GCC x86-64 (versões 11-13; a forma exata varia entre versões; diretivas como `.cfi_*` foram omitidas).

**`-O0`:**

```asm
soma:
        push    rbp
        mov     rbp, rsp
        mov     QWORD PTR [rbp-24], rdi     ; v vai para a stack
        mov     DWORD PTR [rbp-28], esi     ; n vai para a stack
        mov     DWORD PTR [rbp-4], 0        ; total = 0
        mov     DWORD PTR [rbp-8], 0        ; i = 0
        jmp     .L2
.L3:                                        ; corpo do laço
        mov     eax, DWORD PTR [rbp-8]      ; lê i
        cdqe                                ; estende i para 64 bits
        lea     rdx, [0+rax*4]              ; rdx = i * 4
        mov     rax, QWORD PTR [rbp-24]     ; lê v
        add     rax, rdx                    ; rax = &v[i]
        mov     eax, DWORD PTR [rax]        ; eax = v[i]
        add     DWORD PTR [rbp-4], eax      ; total += v[i]  (lê e escreve memória)
        add     DWORD PTR [rbp-8], 1        ; i++            (lê e escreve memória)
.L2:                                        ; teste do laço
        mov     eax, DWORD PTR [rbp-8]      ; lê i
        cmp     eax, DWORD PTR [rbp-28]     ; compara com n
        jl      .L3                         ; se i < n, repete
        mov     eax, DWORD PTR [rbp-4]      ; retorno = total
        pop     rbp
        ret
```

Por iteração: 11 instruções (8 no corpo + 3 no teste), das quais 6 acessam variáveis na stack (duas delas, `add DWORD PTR [...]`, leem e escrevem), além da leitura de `v[i]`. O compilador traduziu cada expressão isoladamente, sem guardar nada em registrador entre uma linha e outra. Isso deixa o código lento, mas fácil de depurar: cada variável tem um endereço fixo que o depurador consegue ler.

**`-O2`:**

```asm
soma:
        test    esi, esi                    ; n <= 0?
        jle     .L4
        lea     eax, [rsi-1]
        lea     rdx, [rdi+4+rax*4]          ; rdx = &v[n] (ponteiro de fim)
        xor     eax, eax                    ; total = 0 (em eax)
.L3:
        add     eax, DWORD PTR [rdi]        ; total += *v
        add     rdi, 4                      ; v++ (avança o ponteiro)
        cmp     rdi, rdx                    ; chegou ao fim?
        jne     .L3
        ret                                 ; retorno já está em eax
.L4:
        xor     eax, eax                    ; n <= 0: devolve 0
        ret
```

Por iteração: 4 instruções e um único acesso à memória (a leitura de `v[i]`). As otimizações visíveis: variáveis em registradores (`total` em `eax`), eliminação do frame (`push rbp`/`mov rbp, rsp`), troca do índice `i` por um ponteiro que avança (*strength reduction*: em vez de calcular `v + i*4` a cada passo, soma 4 ao ponteiro), teste de `n <= 0` uma vez fora do laço e uso de `xor eax, eax` para zerar (instrução curta que a CPU reconhece como quebra de dependência).

**`-O3`:** o GCC vetoriza o laço: aparecem instruções SSE como `movdqu xmm0, XMMWORD PTR [rax]` e `paddd xmm1, xmm0`, que carregam e somam **4 inteiros de 32 bits por instrução**, seguidas de uma redução horizontal ao final e de um laço escalar para os elementos que sobram quando `n` não é múltiplo de 4. Com `-march=native`, o compilador pode usar AVX2 (registradores `ymm`, 8 inteiros por instrução).

**Conexão com Java:** é exatamente esse tipo de transformação que o C2 da JVM aplica ao bytecode de um laço quente, incluindo a vetorização (*superword optimization*). A diferença é que o C2 faz isso em tempo de execução, sabendo quais extensões a CPU atual suporta.

## Responder: por que Java é ao mesmo tempo compilado e interpretado?

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["javac", "Interpretador", "JIT", "Tiered compilation", "AOT", "GraalVM Native Image"]}
```

### Enunciado

Numa entrevista, perguntam: *"Java é uma linguagem compilada ou interpretada?"*. Responda em até dois minutos de fala, de forma precisa, e depois responda à pergunta de acompanhamento: *"Então por que uma aplicação Spring Boot fica mais rápida alguns minutos depois de subir? E o que muda se eu compilar com GraalVM Native Image?"*

### Objetivo

Explicar com precisão as etapas de execução de um programa Java e os trade-offs entre interpretação, JIT e AOT em termos de startup e desempenho de pico.

### Instruções

1. Corrija a premissa da pergunta: compilação e interpretação são propriedades de implementações.
2. Descreva a primeira compilação (`javac`) e o que ela produz.
3. Descreva o que a JVM faz com o bytecode: interpretação, perfil, JIT em camadas, desotimização.
4. Explique o aquecimento (*warm-up*) observado numa aplicação Spring Boot.
5. Compare com o GraalVM Native Image: o que ganha e o que perde.

### Dicas

- Quantos "compiladores" participam da vida de um método Java quente na HotSpot?
- O que o JIT sabe sobre o programa que o `javac` e um compilador AOT não sabem?
- Native Image exige uma "hipótese de mundo fechado". O que isso significa para reflexão e proxies dinâmicos?

### Critérios de avaliação

- Explica que "compilada" e "interpretada" descrevem implementações, não a linguagem.
- Descreve `javac` gerando bytecode portável, e a JVM interpretando e compilando com JIT (C1, C2) os métodos quentes.
- Explica que o JIT usa perfil de execução e pode desotimizar quando suposições deixam de valer.
- Explica o warm-up: no início, código interpretado ou compilado pelo C1, além de carregamento de classes e inicialização do contexto do Spring.
- Compara Native Image: startup rápido e menos memória, contra desempenho de pico geralmente menor, build lento e restrições de mundo fechado (reflexão, proxies, carregamento dinâmico precisam de configuração).

### Solução de referência

"A resposta curta é: os dois, em momentos diferentes. 'Compilada' e 'interpretada' descrevem implementações, não linguagens.

Primeiro, o `javac` **compila** o código-fonte para bytecode, uma linguagem de uma máquina virtual de pilha, independente de CPU, gravada em arquivos `.class`. Essa compilação faz análise sintática e checagem de tipos, mas quase nenhuma otimização.

Depois, em tempo de execução, a HotSpot começa **interpretando** esse bytecode. Enquanto interpreta, conta quantas vezes cada método é chamado e quantas vezes cada laço itera, e registra um perfil: quais desvios são tomados, quais tipos concretos aparecem em cada chamada. Quando um método fica quente, ele é **compilado para código de máquina** pelo JIT: primeiro pelo C1, que compila rápido com otimizações simples, e, se continuar quente, pelo C2, que faz otimizações agressivas guiadas pelo perfil, como inlining, desvirtualização, escape analysis e vetorização. Se uma suposição do C2 deixar de valer, por exemplo, uma nova subclasse é carregada, a JVM **desotimiza**: descarta o código compilado, volta a interpretar aquele método e recompila depois.

Então, um método quente passa por dois compiladores e um interpretador ao longo da vida: `javac`, interpretador, C1 e C2.

**Por que o Spring Boot fica mais rápido depois de alguns minutos:** no começo, quase todo o código está interpretado ou compilado pelo C1, as classes ainda estão sendo carregadas e verificadas, caches internos (do Spring, do Hibernate, do Jackson) estão vazios e as threads do JIT disputam CPU com a aplicação. Conforme o tráfego chega, os caminhos quentes são compilados pelo C2 com o perfil real, e a latência cai. Por isso se faz warm-up antes de colocar uma instância no balanceador.

**Com GraalVM Native Image**, toda a aplicação é compilada AOT para um executável nativo durante o build. Ganha-se startup em dezenas de milissegundos, menor uso de memória (não há JIT, nem metadados de classes carregadas dinamicamente) e desempenho previsível desde o primeiro request, o que é ótimo para serverless e para escalar rápido. Perde-se: o build fica muito mais lento e pesado; o desempenho de pico costuma ser menor que o do C2, porque não há perfil real (a versão Oracle GraalVM oferece PGO, otimização guiada por perfil, para reduzir isso); e vale a hipótese de mundo fechado: todo o código alcançável precisa ser conhecido no build, então reflexão, proxies dinâmicos e carregamento de recursos precisam ser declarados em metadados. Frameworks como Spring Boot 3, Quarkus e Micronaut geram boa parte desses metadados automaticamente.

A escolha depende do perfil: serviços de longa duração com muito tráfego tendem a se beneficiar do JIT; cargas efêmeras, de startup rápido."

## Escrever um pequeno compilador de expressões aritméticas que gera instruções para uma máquina de pilha

```meta
{"type": "implementation", "level": 4, "required": false, "knowledge": ["Análise léxica", "Análise sintática", "Geração de código", "Máquina de pilha", "Precedência de operadores"]}
```

### Enunciado

Escreva em Java um compilador que recebe uma expressão aritmética inteira como texto (por exemplo, `-(3 + 4) * 2`) e gera código para uma **máquina de pilha** com as instruções `PUSH n`, `ADD`, `SUB`, `MUL`, `DIV` e `NEG`. Escreva também a máquina virtual que executa esse código e verifique os resultados.

### Objetivo

Construir em miniatura o que o `javac` faz: transformar texto em uma representação executável por uma máquina virtual de pilha, entendendo tokenização, parsing com precedência e geração de código.

### Instruções

1. Implemente um **tokenizador** que transforme o texto em tokens: números inteiros, `+`, `-`, `*`, `/`, `(`, `)` e fim de entrada. Ignore espaços e rejeite caracteres inválidos com a posição do erro.
2. Implemente um **parser descendente recursivo** para a gramática:
   - `expr := termo (('+' | '-') termo)*`
   - `termo := fator (('*' | '/') fator)*`
   - `fator := NUMERO | '(' expr ')' | '-' fator`
3. Gere o código **durante** o parsing: ao reconhecer um número, emita `PUSH n`; depois de reconhecer os dois operandos de um operador, emita a instrução do operador.
4. Implemente a máquina de pilha: para operadores binários, desempilhe `b`, depois `a`, e empilhe `a op b`. Trate divisão por zero.
5. Teste pelo menos: `2 + 3 * 4` (14), `(2 + 3) * 4` (20), `10 - 4 - 3` (3), `100 / 10 / 5` (2), `-(3 + 4) * 2` (-14), e um erro de sintaxe como `2 + * 3`.
6. Compare o código gerado para `(a + b) * 2` com o bytecode que o `javac` gera para `return (a + b) * 2;` (use `javap -c`).

### Dicas

- A precedência sai de graça da gramática: `termo` (multiplicação) é resolvido "mais fundo" que `expr` (soma), então `MUL` é emitido antes de `ADD` em `2 + 3 * 4`.
- Laços `while` em `expr` e `termo` (em vez de recursão à direita) garantem associatividade à esquerda: `10 - 4 - 3` deve ser `(10 - 4) - 3`.
- Na máquina, a ordem dos `pop` importa para `SUB` e `DIV`: o topo da pilha é o operando da **direita**.
- O código gerado é a expressão em notação polonesa reversa (pós-fixa).

### Critérios de avaliação

- Tokenizador reconhece todos os tokens e reporta caracteres inválidos com posição.
- Parser respeita precedência (`*` e `/` antes de `+` e `-`), parênteses, menos unário e associatividade à esquerda.
- O código gerado é uma sequência de instruções de pilha (pós-fixa), e não uma avaliação direta durante o parsing.
- A máquina de pilha executa o código corretamente, incluindo a ordem dos operandos em `SUB`/`DIV` e erro de divisão por zero.
- Todos os casos de teste passam e o erro de sintaxe é detectado com mensagem clara.
- A comparação com o `javac` identifica a correspondência (`iload`/`iconst` ↔ `PUSH`, `iadd` ↔ `ADD`, `imul` ↔ `MUL`).

### Solução de referência

```java
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Compilador de expressões aritméticas inteiras para uma máquina de pilha.
 *
 * Gramática (precedência e associatividade à esquerda):
 *   expr   := termo (('+' | '-') termo)*
 *   termo  := fator (('*' | '/') fator)*
 *   fator  := NUMERO | '(' expr ')' | '-' fator
 *
 * Conjunto de instruções da máquina alvo:
 *   PUSH n | ADD | SUB | MUL | DIV | NEG
 */
public class CompiladorExpr {

    enum Op { PUSH, ADD, SUB, MUL, DIV, NEG }

    record Instr(Op op, long arg) {
        @Override public String toString() { return op == Op.PUSH ? "PUSH " + arg : op.name(); }
    }

    // ---------- 1. Análise léxica ----------
    enum TipoToken { NUMERO, MAIS, MENOS, VEZES, DIVIDE, ABRE, FECHA, FIM }

    record Token(TipoToken tipo, String texto, int posicao) {}

    static List<Token> tokenizar(String fonte) {
        List<Token> tokens = new ArrayList<>();
        int i = 0;
        while (i < fonte.length()) {
            char c = fonte.charAt(i);
            if (Character.isWhitespace(c)) { i++; continue; }
            if (Character.isDigit(c)) {
                int inicio = i;
                while (i < fonte.length() && Character.isDigit(fonte.charAt(i))) i++;
                tokens.add(new Token(TipoToken.NUMERO, fonte.substring(inicio, i), inicio));
                continue;
            }
            TipoToken tipo = switch (c) {
                case '+' -> TipoToken.MAIS;
                case '-' -> TipoToken.MENOS;
                case '*' -> TipoToken.VEZES;
                case '/' -> TipoToken.DIVIDE;
                case '(' -> TipoToken.ABRE;
                case ')' -> TipoToken.FECHA;
                default -> throw new IllegalArgumentException("caractere inesperado '" + c + "' na posição " + i);
            };
            tokens.add(new Token(tipo, String.valueOf(c), i));
            i++;
        }
        tokens.add(new Token(TipoToken.FIM, "", fonte.length()));
        return tokens;
    }

    // ---------- 2. Análise sintática + 3. Geração de código ----------
    static final class Parser {
        private final List<Token> tokens;
        private final List<Instr> codigo = new ArrayList<>();
        private int pos = 0;

        Parser(List<Token> tokens) { this.tokens = tokens; }

        List<Instr> compilar() {
            expr();
            if (atual().tipo() != TipoToken.FIM) erro("token inesperado '" + atual().texto() + "'");
            return codigo;
        }

        private Token atual() { return tokens.get(pos); }

        private boolean aceitar(TipoToken tipo) {
            if (atual().tipo() == tipo) { pos++; return true; }
            return false;
        }

        private void erro(String msg) {
            throw new IllegalArgumentException(msg + " na posição " + atual().posicao());
        }

        private void expr() {
            termo();
            while (true) {
                if (aceitar(TipoToken.MAIS)) { termo(); emitir(Op.ADD); }
                else if (aceitar(TipoToken.MENOS)) { termo(); emitir(Op.SUB); }
                else return;
            }
        }

        private void termo() {
            fator();
            while (true) {
                if (aceitar(TipoToken.VEZES)) { fator(); emitir(Op.MUL); }
                else if (aceitar(TipoToken.DIVIDE)) { fator(); emitir(Op.DIV); }
                else return;
            }
        }

        private void fator() {
            Token t = atual();
            if (aceitar(TipoToken.NUMERO)) {
                codigo.add(new Instr(Op.PUSH, Long.parseLong(t.texto())));
            } else if (aceitar(TipoToken.ABRE)) {
                expr();
                if (!aceitar(TipoToken.FECHA)) erro("esperado ')'");
            } else if (aceitar(TipoToken.MENOS)) {
                fator();
                emitir(Op.NEG);
            } else {
                erro("esperado número, '(' ou '-'");
            }
        }

        private void emitir(Op op) { codigo.add(new Instr(op, 0)); }
    }

    static List<Instr> compilar(String fonte) {
        return new Parser(tokenizar(fonte)).compilar();
    }

    // ---------- 4. Máquina de pilha que executa o código gerado ----------
    static long executar(List<Instr> codigo) {
        Deque<Long> pilha = new ArrayDeque<>();
        for (Instr in : codigo) {
            switch (in.op()) {
                case PUSH -> pilha.push(in.arg());
                case NEG -> pilha.push(-pilha.pop());
                default -> {
                    long b = pilha.pop(), a = pilha.pop();   // ordem importa para SUB e DIV
                    pilha.push(switch (in.op()) {
                        case ADD -> a + b;
                        case SUB -> a - b;
                        case MUL -> a * b;
                        case DIV -> {
                            if (b == 0) throw new ArithmeticException("divisão por zero");
                            yield a / b;
                        }
                        default -> throw new IllegalStateException();
                    });
                }
            }
        }
        if (pilha.size() != 1) throw new IllegalStateException("pilha final inválida: " + pilha);
        return pilha.pop();
    }

    public static void main(String[] args) {
        String[] casos = { "2 + 3 * 4", "(2 + 3) * 4", "10 - 4 - 3", "100 / 10 / 5", "-(3 + 4) * 2", "7" };
        long[] esperados = { 14, 20, 3, 2, -14, 7 };
        for (int i = 0; i < casos.length; i++) {
            List<Instr> codigo = compilar(casos[i]);
            long r = executar(codigo);
            System.out.printf("%-14s => %-48s = %d%n", casos[i], codigo, r);
            if (r != esperados[i]) throw new AssertionError(casos[i] + " deu " + r);
        }
        try {
            compilar("2 + * 3");
        } catch (IllegalArgumentException e) {
            System.out.println("erro de sintaxe detectado: " + e.getMessage());
        }
    }
}
```

Saída:

```text
2 + 3 * 4      => [PUSH 2, PUSH 3, PUSH 4, MUL, ADD]               = 14
(2 + 3) * 4    => [PUSH 2, PUSH 3, ADD, PUSH 4, MUL]               = 20
10 - 4 - 3     => [PUSH 10, PUSH 4, SUB, PUSH 3, SUB]              = 3
100 / 10 / 5   => [PUSH 100, PUSH 10, DIV, PUSH 5, DIV]            = 2
-(3 + 4) * 2   => [PUSH 3, PUSH 4, ADD, NEG, PUSH 2, MUL]          = -14
7              => [PUSH 7]                                         = 7
erro de sintaxe detectado: esperado número, '(' ou '-' na posição 4
```

**Comparação com o `javac`.** Para

```java
static int calcular(int a, int b) {
    return (a + b) * 2;
}
```

o `javap -c` mostra:

```text
0: iload_0     // PUSH a
1: iload_1     // PUSH b
2: iadd        // ADD
3: iconst_2    // PUSH 2
4: imul        // MUL
5: ireturn
```

É exatamente a mesma estrutura pós-fixa que o seu compilador gera para `(a + b) * 2`. As diferenças: o bytecode é tipado (`iadd` para `int`, `ladd` para `long`), carrega variáveis locais por índice (`iload_0`) em vez de só constantes, e tem instruções curtas para constantes pequenas (`iconst_2` ocupa 1 byte; `bipush` e `sipush` cobrem valores maiores e `ldc` busca no constant pool).

**O que falta para um compilador real** (tópico 1.1.4): uma árvore sintática (AST) como representação intermediária, em vez de gerar código direto no parser; análise semântica (tipos, escopos, variáveis); otimizações como *constant folding* (o `javac` calcula `2 * 3` em tempo de compilação, mas `a + b` não); e geração de código para uma máquina real, com alocação de registradores, o que é exatamente o que o JIT faz a partir do bytecode.

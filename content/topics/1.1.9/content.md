## Da stack ao mecanismo de chamadas

O tópico 1.1.7 mostrou a stack como **região de memória**: um bloco por thread, um stack pointer que avança e recua, frames alocados quase de graça. Este tópico olha para a mesma estrutura de outro ângulo: como **mecanismo de controle**. A **call stack** é a sequência de frames *ativos* de uma thread num instante, ou seja, a resposta à pergunta "quem chamou quem, e para onde cada um deve voltar?".

Essa visão é a que importa no dia a dia de backend. Um stack trace, um thread dump, um flame graph e o desempilhamento de uma exceção são, todos, leituras ou manipulações da call stack. Para entendê-los, precisamos saber o que exatamente existe dentro de um frame, quem coloca cada coisa lá e como o programa "volta".

### O que um frame contém e como o retorno funciona

Em código nativo x86-64, um frame típico contém, do endereço mais alto para o mais baixo:

1. **Argumentos que não couberam em registradores**, empilhados por quem chamou (o *caller*).
2. **Endereço de retorno**, empilhado pela instrução `call`.
3. **Frame pointer salvo** (`rbp` do caller), quando a função usa frame pointer.
4. **Registradores callee-saved** que a função vai usar e precisa restaurar.
5. **Variáveis locais e temporários** que não ficaram em registradores (*spills*).
6. **Espaço para argumentos de saída** das chamadas que esta função fará.

O endereço de retorno é o coração do mecanismo. A instrução `call alvo` faz duas coisas de uma vez: empilha o endereço da **instrução seguinte** ao `call` e salta para `alvo`. A instrução `ret` faz o inverso: desempilha esse endereço e salta para ele. Não há mágica nem tabela central: cada frame guarda, em memória, o ponto exato onde o caller parou.

Duas consequências práticas:

- **Um stack trace é a lista de endereços de retorno**, traduzidos para nomes de função e linhas. É possível reconstruí-lo percorrendo a cadeia de frames: com frame pointers, `rbp` aponta para o `rbp` anterior, formando uma lista ligada; sem eles, o depurador usa tabelas de *unwind* geradas pelo compilador (DWARF CFI, seção `.eh_frame` em Linux).
- **Sobrescrever o endereço de retorno desvia o programa.** É o mecanismo dos ataques de *stack buffer overflow*, e o motivo de existirem *stack canaries* e *shadow stacks* em hardware moderno.

A CPU também tem um preditor dedicado, o *return stack buffer*, que memoriza os endereços de retorno das últimas chamadas para que o `ret` não cause erro de previsão. Chamar e retornar é barato enquanto a profundidade é previsível.

## Convenções de chamada: o contrato entre caller e callee

Para que código compilado por compiladores diferentes (ou uma biblioteca e um programa) se chamem corretamente, ambos seguem uma **convenção de chamada** (*calling convention*), parte da ABI da plataforma. Em Linux e macOS x86-64 vale a **System V AMD64 ABI**:

| Item | Regra (System V x86-64) |
|---|---|
| Argumentos inteiros/ponteiros | `rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9`; do 7º em diante, na stack |
| Argumentos de ponto flutuante | `xmm0` a `xmm7` |
| Valor de retorno | `rax` (e `rdx` para 128 bits); `xmm0` para ponto flutuante |
| Callee-saved | `rbx`, `rbp`, `r12`–`r15` (e `rsp`): quem é chamado deve devolvê-los intactos |
| Caller-saved | `rax`, `rcx`, `rdx`, `rsi`, `rdi`, `r8`–`r11` e todos os `xmm`: podem ser destruídos pela chamada |
| Alinhamento | `rsp` múltiplo de 16 no momento do `call` |
| Red zone | 128 bytes abaixo de `rsp` que uma função pode usar sem mover `rsp` |

A divisão **callee-saved × caller-saved** é um acordo de custo. Se o caller precisa de um valor depois da chamada e ele está num registrador caller-saved, o caller deve salvá-lo antes (na stack). Se a função chamada quer usar um registrador callee-saved, ela salva o valor antigo no prólogo e restaura no epílogo. Funções pequenas que só usam registradores caller-saved não salvam nada.

A **red zone** é uma otimização para *funções folha* (que não chamam ninguém): elas podem guardar locais nos 128 bytes logo abaixo de `rsp` sem ajustar o stack pointer, porque a ABI garante que nada assíncrono (como um signal handler) vai escrever ali. O kernel Linux é compilado sem red zone, pois interrupções usam a stack corrente.

Outras plataformas têm outras regras. O **Windows x64** passa os quatro primeiros argumentos em `rcx`, `rdx`, `r8`, `r9`, exige que o caller reserve 32 bytes de *shadow space* e não tem red zone. A **HotSpot** usa uma convenção própria para código Java compilado (semelhante, mas não idêntica à do C) e gera pequenos *adapters* para traduzir chamadas entre o interpretador, o código compilado e o código nativo via JNI.

## Exemplo: Argumentos em registradores, alinhamento e retorno

```c
__attribute__((noinline))
long soma3(long a, long b, long c) {
    return a + b + c;
}

long calcula(long x) {
    long r = soma3(x, 2, 3);
    return r * 2;
}
```

Saída aproximada de `gcc -O1 -masm=intel -S` (pode variar por versão):

```asm
soma3:
    lea  rax, [rdi+rsi]   ; a está em rdi, b em rsi
    add  rax, rdx         ; c está em rdx; resultado em rax
    ret                   ; função folha: nem toca na stack

calcula:
    sub  rsp, 8           ; o call empilhou 8 bytes; realinha rsp em 16
    mov  edx, 3           ; 3º argumento
    mov  esi, 2           ; 2º argumento
    call soma3            ; x já está em rdi (1º argumento): nada a mover
    add  rax, rax         ; r * 2, aproveitando o retorno em rax
    add  rsp, 8
    ret
```

Observe que, com otimização, **não há `push rbp` nem variáveis locais na stack**: tudo cabe em registradores. O frame de `calcula` tem apenas o endereço de retorno e 8 bytes de alinhamento. O prólogo clássico com `rbp` do tópico 1.1.7 aparece em `-O0` ou com `-fno-omit-frame-pointer`, opção que muitas distribuições Linux voltaram a ativar justamente para facilitar profiling.

## Diagrama: Frame em x86-64 System V

```text
 endereços altos
 ┌─────────────────────────────────┐
 │ ... frame do caller ...         │
 │ 8º argumento (se houver)        │
 │ 7º argumento (se houver)        │  ← rsp alinhado em 16 antes do call
 ├─────────────────────────────────┤ ─┐
 │ endereço de retorno             │  │  empilhado por `call`
 │ rbp salvo do caller             │  │  ← rbp (se usar frame pointer)
 │ rbx, r12... (callee-saved)      │  │  frame da função atual
 │ variáveis locais / spills       │  │
 │ área para argumentos de saída   │  │  ← rsp
 ├─────────────────────────────────┤ ─┘
 │ red zone (128 bytes)            │  usável só por funções folha
 └─────────────────────────────────┘
 endereços baixos
```

## Exceções e stack unwinding

Quando uma exceção é lançada, a execução não segue a cadeia normal de `ret`. O runtime precisa **desempilhar frames** (*stack unwinding*) até encontrar um handler compatível, executando no caminho o código de limpeza de cada frame descartado.

### Na JVM

Cada método compilado para bytecode tem uma **exception table**: entradas `(início, fim, handler, tipo)` dizendo "se uma exceção do tipo X ocorrer entre as instruções início e fim, salte para handler". Um bloco `finally` vira entradas do tipo *any*. Quando `athrow` executa (ou uma exceção implícita como `NullPointerException` acontece):

1. A JVM procura, na exception table do método atual, uma entrada que cubra a instrução corrente e cujo tipo seja compatível.
2. Se encontra, descarta a pilha de operandos, empilha a exceção e salta para o handler. O frame continua vivo.
3. Se não encontra, **descarta o frame inteiro** e repete a busca no caller, a partir da instrução de chamada.
4. Se chega ao fim da stack da thread sem handler, a thread termina e o `UncaughtExceptionHandler` imprime o stack trace.

```java
void processar() {
    try {
        validar();               // lança IllegalStateException lá dentro
    } catch (IllegalArgumentException e) {
        // tipo incompatível: não captura
    } finally {
        log("fim");              // executa durante o unwinding
    }
}                                // frame descartado; busca continua no caller
```

No código compilado pelo JIT, a ideia é a mesma, mas os handlers ficam em tabelas associadas ao código nativo; quando necessário, o JIT faz *deoptimization* e devolve o método ao interpretador.

### Em código nativo

C++ e Rust usam exceções "de custo zero" no caminho feliz: não há instrução extra no `try`. O compilador gera tabelas de unwind e, quando algo é lançado, um runtime as percorre em duas fases (procura o handler, depois desempilha chamando destrutores). O custo fica todo no lançamento, que é caro. É o mesmo padrão da JVM: **exceções são baratas quando não ocorrem e caras quando ocorrem**.

## Como um stack trace é obtido e quanto custa

Em Java, o stack trace é capturado **quando a exceção é construída**, não quando é lançada. O construtor de `Throwable` chama `fillInStackTrace()`, um método nativo que percorre os frames da thread atual e grava um *backtrace* interno compacto. A conversão para `StackTraceElement[]` (com nome de classe, método, arquivo e linha) só acontece se alguém chamar `getStackTrace()` ou `printStackTrace()`.

O custo de criar uma exceção é, portanto, **proporcional à profundidade da stack**. Num servidor Spring, com 100 a 200 frames entre o servidor web, filtros, proxies e o seu código, criar exceções em massa (por exemplo, para controle de fluxo em validação) aparece no profiler. A profundidade gravada é limitada por `-XX:MaxJavaStackTraceDepth` (padrão 1024). Formas de reduzir o custo quando o trace não é necessário:

```java
public class SaldoInsuficiente extends RuntimeException {
    public SaldoInsuficiente(String msg) {
        // enableSuppression = false, writableStackTrace = false
        super(msg, null, false, false);   // não chama fillInStackTrace
    }
}
```

Um efeito colateral famoso: com `-XX:+OmitStackTraceInFastThrow` (ativo por padrão), quando o C2 vê uma exceção implícita (`NullPointerException`, `ArithmeticException`, `ArrayIndexOutOfBoundsException`, `ClassCastException`) ser lançada muitas vezes no mesmo ponto, passa a lançar uma instância pré-alocada **sem stack trace**. Nos logs aparece só `java.lang.NullPointerException` sem nenhuma linha `at`. Procure a primeira ocorrência no log, ou rode com `-XX:-OmitStackTraceInFastThrow` para investigar.

Para inspecionar a stack **sem** exceção, use a API `StackWalker` (Java 9+). Ela percorre os frames de forma preguiçosa e permite parar cedo, o que é bem mais barato do que `new Throwable().getStackTrace()`:

```java
String chamador = StackWalker.getInstance()
        .walk(frames -> frames.skip(1).findFirst())
        .map(f -> f.getClassName() + "." + f.getMethodName() + ":" + f.getLineNumber())
        .orElse("desconhecido");
```

Frameworks de log usam esse tipo de recurso quando você pede o nome do método ou a linha no padrão de log, e é por isso que essas opções são caras.

## Exemplo: Lendo um stack trace com Caused by

```text
org.springframework.dao.DataIntegrityViolationException: could not execute statement
    at org.springframework.orm.jpa.vendor.HibernateJpaDialect.convertHibernateAccessException(HibernateJpaDialect.java:290)
    at org.springframework.orm.jpa.JpaTransactionManager.doCommit(JpaTransactionManager.java:565)
    ... 
    at com.loja.pedido.PedidoService$$SpringCGLIB$$0.criar(<generated>)
    at com.loja.pedido.PedidoController.criar(PedidoController.java:41)
    at java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)
    ...
Caused by: org.hibernate.exception.ConstraintViolationException: could not execute statement
    at org.hibernate.exception.internal.SQLStateConversionDelegate.convert(SQLStateConversionDelegate.java:95)
    ... 
    ... 52 more
Caused by: org.postgresql.util.PSQLException: ERROR: duplicate key value violates unique constraint "uk_pedido_codigo"
    at org.postgresql.core.v3.QueryExecutorImpl.receiveErrorResponse(QueryExecutorImpl.java:2725)
    ...
    ... 64 more
```

O trace foi encurtado: as linhas `...` isoladas marcam frames omitidos aqui (dezenas de frames de Spring MVC, filtros e Tomcat), enquanto `... N more` é o formato real que a JVM imprime.

Regras de leitura:

- **Cada bloco é uma exceção**; o **primeiro frame** de cada bloco é onde ela foi criada, e os frames abaixo são os callers, até a base da thread.
- **`Caused by`** encadeia exceções embrulhadas: o framework capturou uma exceção e lançou outra mais genérica, passando a original como causa. **A causa raiz é o último `Caused by`**: aqui, a violação de chave única no PostgreSQL.
- **`... N more`** significa "os N frames finais desta exceção são idênticos aos da exceção que a envolve", e foram omitidos para não repetir.
- **O frame do código próprio** é o primeiro frame com o pacote da sua aplicação (`com.loja...`). Frames `$$SpringCGLIB$$` são proxies gerados (transação, AOP) e frames de reflexão são o framework chamando seu método. A correção quase sempre está entre o frame próprio e a causa raiz.

## Custo de chamadas e inlining pelo JIT

Uma chamada de função custa pouco, mas não zero: mover argumentos, `call`/`ret`, salvar e restaurar registradores, e, em chamadas virtuais, descobrir qual implementação invocar. O custo maior é indireto: **a fronteira da chamada impede otimizações**. O compilador não sabe o que acontece dentro da função chamada, então não pode, por exemplo, manter valores em registradores através dela, eliminar verificações redundantes ou aplicar escape analysis.

O JIT da HotSpot (tópico 4.1.4) ataca isso com **inlining**: copia o corpo do método chamado para dentro do chamador. Por padrão, métodos de até 35 bytes de bytecode são inlined mesmo sem estarem quentes (`-XX:MaxInlineSize`), e métodos quentes até cerca de 325 bytes (`-XX:FreqInlineSize`). Getters, setters e pequenos métodos utilitários desaparecem completamente.

Para chamadas virtuais (interfaces, métodos sobrescritos), o JIT usa o perfil coletado: se o ponto de chamada só viu uma implementação (*monomórfico*) ou duas (*bimórfico*), ele faz inlining com uma verificação de tipo barata; com três ou mais (*megamórfico*), recorre a uma chamada indireta via vtable/itable, sem inlining.

Um detalhe importante: **frames inlined continuam aparecendo no stack trace**. O JIT grava metadados de depuração que permitem reconstruir os frames *virtuais* de cada método inlined. A call stack lógica que você vê em Java é preservada mesmo quando a física foi achatada.

## Recursão e tail calls

Na recursão, cada chamada empilha um frame novo, com suas próprias cópias de parâmetros e locais. A profundidade máxima da recursão é, portanto, limitada pelo tamanho da stack (tópico 1.1.7), e o padrão de estouro é reconhecível no stack trace pela mesma linha repetida.

Uma **tail call** é uma chamada que é a última ação da função: `return f(x - 1, acc * x);`. Nesse caso, o frame atual não é mais necessário depois da chamada, e o compilador pode reaproveitá-lo, trocando `call` + `ret` por um simples `jmp`. Isso é a **eliminação de chamada de cauda** (*tail call optimization*, TCO), e transforma a recursão em laço, com stack constante. GCC e Clang fazem isso em `-O2`; Scheme e outras linguagens funcionais a exigem.

A **JVM não faz TCO**. Entre os motivos estão a dependência histórica de inspeção da stack (verificações de segurança e `getCallerClass`) e a expectativa de que o stack trace mostre todos os frames. Kotlin (`tailrec`) e Scala (`@tailrec`) contornam isso **no compilador da linguagem**, reescrevendo a função como laço antes de gerar bytecode. Em Java, recursões profundas devem ser convertidas manualmente em iteração (tópicos 1.1.7 e 2.2.5).

## Thread dumps e profilers: fotografias da call stack

Um **thread dump** é a call stack de **todas** as threads num instante, junto com o estado de cada uma. É obtido com `jstack <pid>`, `jcmd <pid> Thread.print`, ou `kill -3 <pid>` em Linux (o dump vai para a saída padrão da JVM).

```text
"http-nio-8080-exec-7" #42 daemon prio=5 tid=0x... nid=0x2f1 waiting for monitor entry
   java.lang.Thread.State: BLOCKED (on object monitor)
    at com.loja.estoque.Estoque.reservar(Estoque.java:58)
    - waiting to lock <0x000000071a2b3c40> (a com.loja.estoque.Estoque)
    at com.loja.pedido.PedidoService.criar(PedidoService.java:33)
```

Os estados mais úteis: `RUNNABLE` (executando ou pronta, inclusive em I/O nativo), `BLOCKED` (esperando um `synchronized`), `WAITING`/`TIMED_WAITING` (em `wait`, `park`, `sleep`). As linhas `- locked <0x...>` e `- waiting to lock <0x...>` permitem montar o grafo de quem espera quem; a JVM detecta ciclos e imprime `Found one Java-level deadlock`. Tirar três dumps com alguns segundos de intervalo e comparar é a técnica padrão: uma thread presa sempre no mesmo frame é suspeita.

Um **profiler por amostragem** automatiza essa ideia: centenas de vezes por segundo, ele registra a call stack de cada thread que está na CPU. Métodos que aparecem em muitas amostras são os que consomem tempo. Um detalhe crítico é o **safepoint bias**: APIs como `Thread.getStackTrace()` só conseguem a stack quando a thread chega a um *safepoint*, o que distorce o resultado. O **async-profiler** evita isso usando sinais do SO (`perf_events` em Linux) e a API interna `AsyncGetCallTrace` da HotSpot, amostrando a stack em qualquer instrução, inclusive frames nativos e do kernel. Ele roda em Linux e macOS; no Windows, a alternativa é o **JDK Flight Recorder** (`jcmd <pid> JFR.start`), também de baixo overhead, visualizado no JDK Mission Control ou no IntelliJ.

## Diagrama: Das amostras ao flame graph

```text
 amostras de stack (da base, à esquerda, até o topo, à direita):

   A: main → handle → serializar → writeJson
   B: main → handle → serializar → writeJson
   C: main → handle → consultarBanco → socketRead
   D: main → handle → serializar → writeJson
   E: main → handle → validar

 flame graph (largura = fração das amostras; eixo x NÃO é tempo):

 ┌───────────┐┌───────────────────────────────┐
 │socketRead ││ writeJson (3/5)               │
 ├───────────┤├───────────────────────────────┤┌───────────┐
 │ consultar ││ serializar (3/5)              ││ validar   │
 ├───────────┴┴───────────────────────────────┴┴───────────┤
 │ handle (5/5)                                            │
 ├─────────────────────────────────────────────────────────┤
 │ main (5/5)                                              │
 └─────────────────────────────────────────────────────────┘
```

Como ler: o eixo vertical é a profundidade da call stack; cada retângulo é um frame; a **largura** é a proporção de amostras em que aquele frame estava na stack. Irmãos são ordenados alfabeticamente, não no tempo. O que procurar são **topos largos** ("platôs"): frames que estão no topo da stack em muitas amostras são onde a CPU de fato gastou tempo. Aqui, `writeJson` responde por 60% das amostras; otimizar a serialização tem mais impacto do que mexer em `validar`.

## Custos, limitações e uso em sistemas reais

- **Chamadas:** baratas, e o JIT elimina a maioria das pequenas via inlining. Não sacrifique legibilidade evitando métodos; preocupe-se com chamadas megamórficas em loops extremamente quentes só se o profiler apontar.
- **Exceções:** baratas quando não ocorrem; caras quando ocorrem, pelo custo de `fillInStackTrace` proporcional à profundidade e pelo unwinding. Não use exceções para controle de fluxo em caminhos quentes; quando precisar, desligue o stack trace no construtor.
- **Diagnóstico:** sempre preserve a causa ao relançar (`throw new XException("contexto", e)`). Perder o `Caused by` é perder a única fotografia da call stack no momento do problema.
- **Recursão:** Java não elimina tail calls; profundidade depende de `-Xss` e do tamanho dos frames.
- **Observabilidade:** thread dumps diagnosticam travamentos e deadlocks; flame graphs diagnosticam onde a CPU (ou a alocação, ou o tempo de parede) é gasta. Ambos são leituras da call stack, e saber o que é um frame torna a leitura imediata.
- **Frame pointers e símbolos:** profilers nativos dependem de conseguir percorrer a stack. Compilar com frame pointers (`-fno-omit-frame-pointer`) e manter símbolos de depuração custa pouco e torna a produção inspecionável.

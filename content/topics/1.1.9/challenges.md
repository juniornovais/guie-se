## Desenhar a call stack de um fatorial recursivo para n = 4 em cada momento da execução

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Call stack", "Frames", "Endereço de retorno", "Recursão"]}
```

### Enunciado

Considere o programa abaixo. Desenhe a call stack da thread `main` em **cada** momento relevante da execução de `fatorial(4)`: a cada nova chamada (fase de descida) e a cada retorno (fase de subida).

```java
public class Fatorial {
    public static void main(String[] args) {
        int r = fatorial(4);
        System.out.println(r);
    }

    static int fatorial(int n) {
        if (n <= 1) return 1;          // caso base
        return n * fatorial(n - 1);    // a multiplicação acontece DEPOIS do retorno
    }
}
```

### Objetivo

Visualizar a call stack como uma sequência de frames que cresce e encolhe, entendendo que cada chamada recursiva tem seu próprio `n` e que o trabalho pendente fica "guardado" no frame até o retorno.

### Instruções

1. Desenhe a stack logo após cada chamada: `main`; `main → fatorial(4)`; e assim por diante até o caso base.
2. Em cada frame, mostre o valor de `n` e o que aquele frame ainda precisa fazer quando a chamada interna retornar.
3. Desenhe a fase de subida: a cada retorno, qual valor volta, qual frame desaparece e qual cálculo é concluído.
4. Indique a profundidade máxima atingida (número de frames de `fatorial` simultâneos).
5. Responda: essa recursão é uma *tail call*? Se a JVM fizesse eliminação de tail calls, este código seria beneficiado? E o que aconteceria com `fatorial(100_000)`?

### Dicas

- Existem quatro frames de `fatorial` no ponto mais profundo, cada um com um `n` diferente.
- O "endereço de retorno" de cada frame de `fatorial` aponta para o meio da expressão `n * fatorial(n - 1)`: a multiplicação ainda não foi feita.
- Uma tail call exige que a chamada seja a última coisa feita. Aqui ainda há uma multiplicação depois.

### Critérios de avaliação

- Desenha a descida com 5 estados (de só `main` até `main` + 4 frames de `fatorial`) e o topo sempre no frame mais recente.
- Cada frame mostra seu próprio `n` (4, 3, 2, 1) e o trabalho pendente (`4 * ?`, `3 * ?`, `2 * ?`).
- Desenha a subida com os valores de retorno corretos (1, 2, 6, 24) e a remoção de um frame por retorno.
- Afirma a profundidade máxima de 4 frames de `fatorial` (5 contando `main`).
- Explica que não é tail call por causa da multiplicação pendente, que a JVM não faz TCO de qualquer forma, e que `fatorial(100_000)` provavelmente estoura a stack (`StackOverflowError`) antes do overflow numérico ter importância.

### Solução de referência

**Descida** (topo à direita da seta, ou em cima no desenho):

```text
 t1            t2              t3              t4              t5 (caso base)
                                                               ┌──────────────┐
                                               ┌─────────────┐ │ fatorial n=1 │ → retorna 1
                               ┌─────────────┐ │ fatorial n=2│ ├──────────────┤
               ┌─────────────┐ │ fatorial n=3│ ├─────────────┤ │ fatorial n=2 │ pendente: 2 * ?
               │ fatorial n=4│ ├─────────────┤ │ fatorial n=3│ ├──────────────┤
 ┌──────────┐  ├─────────────┤ │ fatorial n=4│ ├─────────────┤ │ fatorial n=3 │ pendente: 3 * ?
 │ main     │  │ main        │ ├─────────────┤ │ fatorial n=4│ ├──────────────┤
 │ r = ?    │  │ r = ?       │ │ main        │ ├─────────────┤ │ fatorial n=4 │ pendente: 4 * ?
 └──────────┘  └─────────────┘ └─────────────┘ │ main        │ ├──────────────┤
                                               └─────────────┘ │ main  r = ?  │
                                                               └──────────────┘
```

**Subida:**

| Momento | Evento | Stack resultante (base → topo) |
|---|---|---|
| t6 | `fatorial(1)` retorna 1; frame removido; `fatorial(2)` calcula `2 * 1 = 2` | main, f(4), f(3), f(2) |
| t7 | `fatorial(2)` retorna 2; `fatorial(3)` calcula `3 * 2 = 6` | main, f(4), f(3) |
| t8 | `fatorial(3)` retorna 6; `fatorial(4)` calcula `4 * 6 = 24` | main, f(4) |
| t9 | `fatorial(4)` retorna 24; `main` atribui `r = 24` | main |

Profundidade máxima: 4 frames de `fatorial` (5 com `main`).

Cada frame guarda o seu `n` porque a multiplicação só pode ser feita depois que a chamada interna retornar. É exatamente isso que impede a eliminação de tail call: o frame ainda tem trabalho a fazer. Uma versão em cauda seria:

```java
static long fatorial(int n, long acc) {
    if (n <= 1) return acc;
    return fatorial(n - 1, acc * n);   // última ação: tail call
}
```

Mesmo assim, a **JVM não elimina tail calls**: essa versão também empilha um frame por chamada. Com `fatorial(100_000)` (em qualquer das versões) são 100 mil frames, o que tipicamente excede a stack padrão (~1 MB) e lança `StackOverflowError`; o resultado numérico já teria estourado `int`/`long` muito antes (13! não cabe em `int`), mas o erro que aparece é o da stack. Em Java, a solução para profundidades grandes é o laço.

## Ler um stack trace real de uma aplicação Spring e apontar a causa raiz e o frame do código próprio

```meta
{"type": "code_analysis", "level": 2, "required": true, "knowledge": ["Stack trace", "Caused by", "Proxies do Spring", "Causa raiz"]}
```

### Enunciado

Uma chamada `POST /pedidos/8812/fechar` passou a retornar HTTP 500. O log de uma aplicação Spring Boot 3 mostra o trace abaixo (formato exato da JVM; números de linha ilustrativos, frames de filtros e do Tomcat encurtados na linha marcada).

```text
com.loja.pedido.PedidoException: Não foi possível fechar o pedido 8812
	at com.loja.pedido.PedidoService.fechar(PedidoService.java:61)
	at java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)
	at java.base/java.lang.reflect.Method.invoke(Method.java:580)
	at org.springframework.aop.support.AopUtils.invokeJoinpointUsingReflection(AopUtils.java:354)
	at org.springframework.aop.framework.ReflectiveMethodInvocation.invokeJoinpoint(ReflectiveMethodInvocation.java:196)
	at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:163)
	at org.springframework.transaction.interceptor.TransactionAspectSupport.invokeWithinTransaction(TransactionAspectSupport.java:392)
	at org.springframework.transaction.interceptor.TransactionInterceptor.invoke(TransactionInterceptor.java:119)
	at org.springframework.aop.framework.ReflectiveMethodInvocation.proceed(ReflectiveMethodInvocation.java:184)
	at org.springframework.aop.framework.CglibAopProxy$DynamicAdvisedInterceptor.intercept(CglibAopProxy.java:720)
	at com.loja.pedido.PedidoService$$SpringCGLIB$$0.fechar(<generated>)
	at com.loja.pedido.PedidoController.fechar(PedidoController.java:37)
	at java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)
	at java.base/java.lang.reflect.Method.invoke(Method.java:580)
	at org.springframework.web.method.support.InvocableHandlerMethod.doInvoke(InvocableHandlerMethod.java:255)
	at org.springframework.web.method.support.InvocableHandlerMethod.invokeForRequest(InvocableHandlerMethod.java:188)
	at org.springframework.web.servlet.mvc.method.annotation.ServletInvocableHandlerMethod.invokeAndHandle(ServletInvocableHandlerMethod.java:118)
	at org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter.invokeHandlerMethod(RequestMappingHandlerAdapter.java:926)
	at org.springframework.web.servlet.DispatcherServlet.doDispatch(DispatcherServlet.java:1089)
	at org.springframework.web.servlet.FrameworkServlet.doPost(FrameworkServlet.java:914)
	at jakarta.servlet.http.HttpServlet.service(HttpServlet.java:590)
	[... ~30 frames de filtros e do Tomcat omitidos ...]
	at org.apache.tomcat.util.threads.TaskThread$WrappingRunnable.run(TaskThread.java:63)
	at java.base/java.lang.Thread.run(Thread.java:1583)
Caused by: com.loja.frete.FreteIndisponivelException: Falha ao calcular frete para o CEP 01310-100
	at com.loja.frete.CalculadoraFrete.calcular(CalculadoraFrete.java:49)
	at com.loja.pedido.PedidoService.fechar(PedidoService.java:54)
	... 52 more
Caused by: java.lang.NumberFormatException: For input string: "01310-100"
	at java.base/java.lang.NumberFormatException.forInputString(NumberFormatException.java:67)
	at java.base/java.lang.Integer.parseInt(Integer.java:662)
	at java.base/java.lang.Integer.parseInt(Integer.java:778)
	at com.loja.frete.TabelaFrete.faixaDoCep(TabelaFrete.java:27)
	at com.loja.frete.CalculadoraFrete.calcular(CalculadoraFrete.java:45)
	... 53 more
```

### Objetivo

Ler um stack trace de framework com método: separar exceções encadeadas, achar a causa raiz, reconhecer frames de proxy e reflexão e chegar à linha do código próprio que precisa ser corrigida.

### Instruções

1. Quantas exceções existem neste trace e em que ordem foram **criadas**?
2. Qual é a causa raiz? Em que frame ela nasceu?
3. Qual é o **primeiro frame do código próprio** na exceção raiz? E qual é a linha onde provavelmente está o bug?
4. Reconstrua a call stack no momento em que a causa raiz foi lançada, da thread do Tomcat até `Integer.parseInt`, listando só os frames relevantes (código próprio e um resumo de cada camada do framework).
5. Explique o que são os frames `PedidoService$$SpringCGLIB$$0`, `TransactionInterceptor` e `DirectMethodHandleAccessor`. Por que `PedidoService.fechar` aparece duas vezes, com linhas diferentes, nos três blocos?
6. O que significam `... 52 more` e `... 53 more`?
7. Proponha a correção.

### Dicas

- A exceção mais "interna" (o último `Caused by`) é a mais antiga: ela foi criada primeiro e embrulhada depois.
- Pacotes `java.base/`, `org.springframework`, `org.apache` e `jakarta` não são seus. Procure `com.loja`.
- Um `@Transactional` em `PedidoService` faz o Spring injetar um proxy no controller; a chamada passa pelo proxy, pelos interceptors e só então chega ao seu método, via reflexão.

### Critérios de avaliação

- Identifica três exceções e a ordem de criação: `NumberFormatException` → `FreteIndisponivelException` → `PedidoException`.
- Aponta a `NumberFormatException` como causa raiz, lançada por `Integer.parseInt` chamado em `TabelaFrete.faixaDoCep` (linha 27).
- Aponta `TabelaFrete.faixaDoCep(TabelaFrete.java:27)` como o primeiro frame próprio e o local do bug (parse de CEP com hífen).
- Explica proxy CGLIB, interceptor transacional e reflexão como frames do framework entre o controller e o serviço.
- Explica que `... N more` indica frames finais idênticos aos da exceção envolvente, omitidos.
- Propõe correção na origem (normalizar/validar o CEP) e mantém o encadeamento de causas.

### Solução de referência

1. **Três exceções**, criadas nesta ordem: `NumberFormatException` (dentro de `parseInt`), depois `FreteIndisponivelException` (em `CalculadoraFrete.calcular`, linha 49, que capturou a primeira e a passou como causa), depois `PedidoException` (em `PedidoService.fechar`, linha 61). O log imprime na ordem inversa: a mais externa primeiro.

2. **Causa raiz:** `java.lang.NumberFormatException: For input string: "01310-100"`, nascida em `Integer.parseInt`. O texto já explica tudo: alguém tentou converter um CEP com hífen em inteiro.

3. **Primeiro frame próprio na causa raiz:** `com.loja.frete.TabelaFrete.faixaDoCep(TabelaFrete.java:27)`. Os três frames acima dele são do JDK (`java.base/`). A linha 27 provavelmente contém algo como `Integer.parseInt(cep)` ou `Integer.parseInt(cep.substring(0, 5 ...))` sem tratar o hífen.

4. **Call stack no momento do lançamento** (base → topo):

```text
Thread.run / TaskThread (Tomcat)          ← thread do pool HTTP
  ~30 frames de filtros e do Tomcat
  HttpServlet.service → FrameworkServlet.doPost → DispatcherServlet.doDispatch
  RequestMappingHandlerAdapter → InvocableHandlerMethod (reflexão)
  PedidoController.fechar:37               ← código próprio
  PedidoService$$SpringCGLIB$$0.fechar     ← proxy gerado
  CglibAopProxy → TransactionInterceptor → TransactionAspectSupport (abre a transação)
  ReflectiveMethodInvocation → Method.invoke (reflexão)
  PedidoService.fechar:54                  ← código próprio
  CalculadoraFrete.calcular:45             ← código próprio
  TabelaFrete.faixaDoCep:27                ← código próprio: BUG
  Integer.parseInt → NumberFormatException.forInputString   ← topo
```

5. `PedidoService$$SpringCGLIB$$0` é a subclasse gerada em runtime pelo Spring (proxy CGLIB) para aplicar `@Transactional`. O controller tem uma referência ao proxy, não ao serviço real. `CglibAopProxy$DynamicAdvisedInterceptor`, `ReflectiveMethodInvocation`, `TransactionInterceptor` e `TransactionAspectSupport` formam a cadeia de *advices*: abrem a transação, chamam o método e fazem commit ou rollback. `DirectMethodHandleAccessor` / `Method.invoke` é a reflexão usada pelo Spring para invocar o método real. `PedidoService.fechar` aparece com linhas diferentes porque cada exceção registra a linha **onde aquele frame estava** quando ela foi criada: na linha 54, `fechar` estava chamando `calcular`; na linha 61, estava executando o `throw new PedidoException(...)` dentro do `catch`.

6. `... 52 more` significa que os últimos 52 frames da `FreteIndisponivelException` são idênticos aos da exceção que a envolve (do `DirectMethodHandleAccessor.invoke` logo abaixo de `fechar` até `Thread.run`), e por isso não foram repetidos. Da mesma forma, os últimos 53 frames da `NumberFormatException` coincidem com os da `FreteIndisponivelException` (de `PedidoService.fechar:54` para baixo). Os frames listados explicitamente são os únicos que diferem.

7. **Correção:** na origem, normalizar e validar o CEP antes do parse, de preferência no limite do sistema (DTO de entrada com validação), e tratá-lo como `String`:

```java
static int faixaDoCep(String cep) {
    String digitos = cep.replaceAll("\\D", "");
    if (digitos.length() != 8) {
        throw new IllegalArgumentException("CEP inválido: " + cep);
    }
    return Integer.parseInt(digitos.substring(0, 5));   // prefixo de 5 dígitos define a faixa
}
```

O encadeamento das camadas está correto e deve ser mantido: cada `catch` passou a causa adiante, e é por isso que o trace permite chegar à linha 27 sem depurador. Como bônus, o `@ControllerAdvice` deveria mapear `IllegalArgumentException` de entrada para HTTP 400 em vez de 500.

## Corrigir uma exceção cujo stack trace é perdido por um catch que relança sem a causa

```meta
{"type": "bug_hunt", "level": 2, "required": false, "knowledge": ["Encadeamento de exceções", "Throwable(String, Throwable)", "Stack trace"]}
```

### Enunciado

Em produção, o serviço não sobe e o log mostra apenas:

```text
Exception in thread "main" ConfigLoader$ConfigException: Configuração inválida em porta.txt
	at ConfigLoader.lerPorta(ConfigLoader.java:17)
	at ConfigLoader.main(ConfigLoader.java:22)
```

Ninguém sabe se o arquivo não existe, se não tem permissão ou se o conteúdo não é um número. O código é este:

```java
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class ConfigLoader {
    static class ConfigException extends RuntimeException {
        ConfigException(String mensagem) {
            super(mensagem);
        }
    }

    static int lerPorta(Path arquivo) {
        try {
            String conteudo = Files.readString(arquivo);
            return Integer.parseInt(conteudo.trim());
        } catch (IOException | NumberFormatException e) {
            throw new ConfigException("Configuração inválida em " + arquivo);
        }
    }

    public static void main(String[] args) {
        System.out.println("Porta: " + lerPorta(Path.of("porta.txt")));
    }
}
```

### Objetivo

Entender por que relançar sem a causa destrói a informação da call stack original e aprender as formas corretas de encadear e relançar exceções.

### Instruções

1. Rode o programa sem o arquivo `porta.txt`. Depois crie o arquivo com o conteúdo `80a` e rode de novo. Os traces permitem distinguir os dois casos?
2. Explique, em termos de call stack, onde a informação foi perdida. Em que momento o stack trace da `ConfigException` foi capturado?
3. Corrija o código para preservar a causa.
4. Rode os dois cenários de novo e mostre os novos traces.
5. Cite outras duas formas comuns de perder a causa em código real e diga como evitá-las.

### Dicas

- O trace de uma exceção é capturado no construtor dela (`fillInStackTrace`), ou seja, na linha do `throw new`, e não onde o problema original aconteceu.
- `RuntimeException` tem um construtor `(String message, Throwable cause)`.
- Procure no seu código padrões como `new XException(e.getMessage())`, `log.error(e.getMessage())` e `catch (Exception e) { return null; }`.

### Critérios de avaliação

- Identifica que a exceção original (`NoSuchFileException` ou `NumberFormatException`) é descartada e que o trace da nova exceção começa no `catch`.
- Explica que os frames internos onde o erro nasceu (`Files.readString`, `Integer.parseInt`) só existem no trace da exceção original.
- Corrige com o construtor que recebe a causa e passa `e` adiante.
- Mostra traces corrigidos com `Caused by:` distinguindo os dois cenários.
- Cita ao menos dois outros anti-padrões (mensagem sem causa, log sem a exceção, engolir exceção, `fillInStackTrace` ao relançar) com a correção.

### Solução de referência

**Diagnóstico:** nos dois cenários, o trace é idêntico, porque só existe o trace da `ConfigException`, criada na linha do `throw new` dentro do `catch`. O construtor de `Throwable` chamou `fillInStackTrace()` naquele instante e gravou a call stack `main → lerPorta`. A exceção original, cujo trace continha os frames onde o problema de fato aconteceu (`Files.readString` → ... → `UnixException.translateToIOException`, ou `Integer.parseInt` → `NumberFormatException.forInputString`), foi descartada: ninguém mais a referencia e o GC a coletará. A informação mais valiosa do incidente desapareceu.

**Correção:**

```java
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class ConfigLoader {
    static class ConfigException extends RuntimeException {
        ConfigException(String mensagem, Throwable causa) {
            super(mensagem, causa);
        }
    }

    static int lerPorta(Path arquivo) {
        try {
            String conteudo = Files.readString(arquivo);
            return Integer.parseInt(conteudo.trim());
        } catch (IOException | NumberFormatException e) {
            throw new ConfigException("Configuração inválida em " + arquivo.toAbsolutePath(), e);
        }
    }

    public static void main(String[] args) {
        System.out.println("Porta: " + lerPorta(Path.of("porta.txt")));
    }
}
```

Sem o arquivo (Linux; no Windows os frames internos são `WindowsException`):

```text
Exception in thread "main" ConfigLoader$ConfigException: Configuração inválida em /app/porta.txt
	at ConfigLoader.lerPorta(ConfigLoader.java:17)
	at ConfigLoader.main(ConfigLoader.java:22)
Caused by: java.nio.file.NoSuchFileException: porta.txt
	at java.base/sun.nio.fs.UnixException.translateToIOException(UnixException.java:92)
	...
	at java.base/java.nio.file.Files.readString(Files.java:3287)
	at ConfigLoader.lerPorta(ConfigLoader.java:14)
	... 1 more
```

Com `80a` no arquivo:

```text
Exception in thread "main" ConfigLoader$ConfigException: Configuração inválida em /app/porta.txt
	at ConfigLoader.lerPorta(ConfigLoader.java:17)
	at ConfigLoader.main(ConfigLoader.java:22)
Caused by: java.lang.NumberFormatException: For input string: "80a"
	at java.base/java.lang.NumberFormatException.forInputString(NumberFormatException.java:67)
	at java.base/java.lang.Integer.parseInt(Integer.java:662)
	at java.base/java.lang.Integer.parseInt(Integer.java:778)
	at ConfigLoader.lerPorta(ConfigLoader.java:15)
	... 1 more
```

Agora a causa e a linha exata ficam evidentes (`... 1 more` é o frame `main`, comum às duas exceções). Esses traces correspondem a compilar com `javac ConfigLoader.java` e rodar com `java ConfigLoader`; no modo de arquivo-fonte (`java ConfigLoader.java`), o bloco `Caused by` ainda mostra alguns frames do launcher (`com.sun.tools.javac.launcher.Main`) no lugar de `... 1 more`. Os números de linha internos do JDK variam por versão.

**Outros anti-padrões e correções:**

- `throw new RuntimeException(e.getMessage())`: perde o tipo e o trace. Use `new RuntimeException("contexto", e)`. Se a exceção de destino não tem construtor com causa, use `initCause(e)` antes de lançar.
- `log.error("Falha: " + e.getMessage())`: o log não mostra o trace. Passe a exceção como último argumento: `log.error("Falha ao ler {}", arquivo, e)`.
- `catch (Exception e) { return null; }`: engole a exceção e transforma o problema num `NullPointerException` distante, cujo trace não aponta para a origem.
- Logar **e** relançar em cada camada: o mesmo erro aparece várias vezes no log. Escolha um: relance com contexto e deixe uma camada superior (por exemplo, um `@ControllerAdvice`) logar uma única vez.
- `throw (Exception) e.fillInStackTrace()`: sobrescreve o trace original pelo ponto do relançamento. Para relançar sem mudar nada, basta `throw e;`, que preserva o trace capturado na criação.

## Capturar thread dumps com jstack de uma aplicação travada e identificar a thread bloqueada

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["Thread dump", "jstack", "Estados de thread", "Deadlock", "Monitores"]}
```

### Enunciado

O programa abaixo simula um serviço de transferências que, de vez em quando, "congela": não consome CPU, não responde e não lança exceção. Use thread dumps para provar o que está acontecendo, identificar as threads bloqueadas e a linha exata de cada uma, e corrija o problema.

```java
public class Travada {
    private static final Object CONTA_A = new Object();
    private static final Object CONTA_B = new Object();

    public static void main(String[] args) throws InterruptedException {
        new Thread(() -> transferir(CONTA_A, CONTA_B), "transferencia-1").start();
        new Thread(() -> transferir(CONTA_B, CONTA_A), "transferencia-2").start();
        Thread.sleep(500);
        new Thread(Travada::gerarRelatorio, "relatorio").start();
        System.out.println("Threads iniciadas. Rode: jps -l  e  jstack <pid>");
    }

    static void transferir(Object origem, Object destino) {
        synchronized (origem) {
            dormir(100);                  // aumenta a chance de intercalação
            synchronized (destino) {
                System.out.println(Thread.currentThread().getName() + " concluída");
            }
        }
    }

    static void gerarRelatorio() {
        synchronized (CONTA_A) {
            System.out.println("relatório gerado");
        }
    }

    static void dormir(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

### Objetivo

Usar o thread dump como fotografia das call stacks de todas as threads para diagnosticar travamentos: reconhecer estados, ler as linhas de `locked`/`waiting to lock` e montar o grafo de espera.

### Instruções

1. Rode `java Travada.java`. Em outro terminal, descubra o pid com `jps -l`.
2. Capture três dumps com ~5 segundos de intervalo: `jstack <pid> > dump1.txt` (ou `jcmd <pid> Thread.print > dump1.txt`). Funciona em Windows, Linux e macOS.
3. Em cada dump, localize as threads `transferencia-1`, `transferencia-2` e `relatorio`. Anote o estado, o frame do topo e as linhas `- locked` e `- waiting to lock`.
4. Monte o grafo: qual thread segura qual monitor e espera qual outro?
5. Leia o final do dump: a JVM detectou algo automaticamente?
6. A thread `relatorio` faz parte do deadlock? Ela está bloqueada? O que aconteceria com novas requisições que precisassem de `CONTA_A`?
7. Compare os três dumps e explique por que tirar mais de um é a prática recomendada.
8. Corrija o código para que o deadlock não possa acontecer.

### Dicas

- O endereço entre `< >` identifica o objeto monitor. Procure o mesmo endereço em `locked` numa thread e em `waiting to lock` em outra.
- Uma thread em deadlock aparece como `BLOCKED (on object monitor)` e não consome CPU, por isso o serviço parece "congelado" e não "lento".
- Deadlocks de lock clássicos desaparecem quando todas as threads adquirem os locks na mesma ordem global.

### Critérios de avaliação

- Captura os dumps e identifica `transferencia-1` e `transferencia-2` como `BLOCKED`, cada uma no frame `Travada.transferir` (no bloco `synchronized (destino)`; o javac costuma atribuir a espera à primeira linha do corpo do bloco).
- Monta o ciclo corretamente: `transferencia-1` segura `CONTA_A` e espera `CONTA_B`; `transferencia-2` segura `CONTA_B` e espera `CONTA_A`.
- Encontra a seção `Found one Java-level deadlock` no fim do dump.
- Explica que `relatorio` está `BLOCKED` esperando `CONTA_A`, mas não faz parte do ciclo, e que o deadlock "contamina" qualquer thread que precisar desses monitores.
- Justifica a comparação de dumps sucessivos (frames idênticos ao longo do tempo indicam travamento, e não um instante de contenção).
- Corrige impondo ordem global de aquisição de locks (ou usando `tryLock` com timeout) e demonstra que o programa termina.

### Solução de referência

**Trecho relevante do dump** (endereços e `nid` variam):

```text
"transferencia-1" #21 prio=5 os_prio=0 cpu=1.2ms elapsed=12.3s tid=0x... nid=0x5a03 waiting for monitor entry
   java.lang.Thread.State: BLOCKED (on object monitor)
	at Travada.transferir(Travada.java:17)
	- waiting to lock <0x000000062a8e1f10> (a java.lang.Object)
	- locked <0x000000062a8e1f00> (a java.lang.Object)
	at Travada.lambda$main$0(Travada.java:6)
	at Travada$$Lambda/0x...run(Unknown Source)
	at java.lang.Thread.runWith(Thread.java:1596)
	at java.lang.Thread.run(Thread.java:1583)

"transferencia-2" #22 ... waiting for monitor entry
   java.lang.Thread.State: BLOCKED (on object monitor)
	at Travada.transferir(Travada.java:17)
	- waiting to lock <0x000000062a8e1f00> (a java.lang.Object)
	- locked <0x000000062a8e1f10> (a java.lang.Object)
	at Travada.lambda$main$1(Travada.java:7)
	...

"relatorio" #23 ... waiting for monitor entry
   java.lang.Thread.State: BLOCKED (on object monitor)
	at Travada.gerarRelatorio(Travada.java:24)
	- waiting to lock <0x000000062a8e1f00> (a java.lang.Object)
	...

Found one Java-level deadlock:
=============================
"transferencia-1":
  waiting to lock monitor 0x... (object 0x000000062a8e1f10, a java.lang.Object),
  which is held by "transferencia-2"
"transferencia-2":
  waiting to lock monitor 0x... (object 0x000000062a8e1f00, a java.lang.Object),
  which is held by "transferencia-1"
```

**Grafo de espera:** `0x...1f00` é `CONTA_A` e `0x...1f10` é `CONTA_B`.

```text
transferencia-1 ──segura──► CONTA_A ◄──espera── transferencia-2
transferencia-1 ──espera──► CONTA_B ◄──segura── transferencia-2
relatorio ───────espera──► CONTA_A   (vítima, fora do ciclo)
```

As duas threads de transferência formam um ciclo: cada uma espera um monitor que a outra segura, para sempre. A JVM detecta ciclos de monitores (e de `ReentrantLock`) e os reporta no fim do dump. `relatorio` está `BLOCKED` mas não faz parte do ciclo: é uma vítima. Num servidor real, toda thread do pool HTTP que tocasse `CONTA_A` ficaria presa da mesma forma, até o pool se esgotar e o serviço parar de responder por completo.

**Por que três dumps:** um único dump é uma fotografia; uma thread `BLOCKED` num instante pode ser contenção normal e passageira. Se nos três dumps as mesmas threads estão no mesmo frame, esperando os mesmos endereços, é travamento. O mesmo raciocínio vale para threads `RUNNABLE` sempre no mesmo laço (CPU a 100%).

**Correção: ordem global de aquisição.**

```java
static void transferir(Object origem, Object destino) {
    // sempre trava primeiro o monitor de menor "identidade"; em código real, use o id da conta
    Object primeiro = System.identityHashCode(origem) <= System.identityHashCode(destino) ? origem : destino;
    Object segundo = (primeiro == origem) ? destino : origem;
    synchronized (primeiro) {
        dormir(100);
        synchronized (segundo) {
            System.out.println(Thread.currentThread().getName() + " concluída");
        }
    }
}
```

Com todas as threads adquirindo na mesma ordem, um ciclo é impossível, e o programa imprime as duas conclusões e o relatório e termina. Em contas reais, ordene pelo identificador da conta (o `identityHashCode` pode colidir; para dois objetos distintos com hash igual, seria preciso um lock de desempate). Outra alternativa é `ReentrantLock.tryLock(timeout)`, que desiste e tenta de novo em vez de esperar para sempre.

## Gerar um flame graph com async-profiler e identificar o método mais custoso

```meta
{"type": "experiment", "level": 4, "required": false, "knowledge": ["Profiling por amostragem", "async-profiler", "Flame graph", "Safepoint bias"]}
```

### Enunciado

O programa abaixo simula o processamento de cadastros. Sem ler o código com atenção, use o async-profiler para gerar um flame graph de CPU, identificar onde o tempo é gasto, corrigir o maior gargalo e provar a melhora com um segundo perfil.

```java
import java.util.List;
import java.util.Random;

public class Cadastros {
    static boolean emailValido(String email) {
        return email.matches("[\\w.+-]+@[\\w-]+\\.[\\w.]+");
    }

    static long checksum(int[] valores) {
        long s = 0;
        for (int v : valores) s = s * 31 + v;
        return s;
    }

    static String linhaCsv(List<String> campos) {
        String linha = "";
        for (String c : campos) linha += c + ";";
        return linha;
    }

    public static void main(String[] args) {
        int[] valores = new Random(1).ints(200, 0, 100).toArray();
        List<String> campos = List.of("id", "nome", "email", "cidade", "estado");
        long fim = System.nanoTime() + 90_000_000_000L;   // roda por 90 s
        long processados = 0, acumulador = 0;
        while (System.nanoTime() < fim) {
            String email = "usuario" + (processados % 1000) + "@exemplo.com";
            if (emailValido(email)) acumulador += checksum(valores);
            acumulador += linhaCsv(campos).length();
            processados++;
        }
        System.out.println(processados + " " + acumulador);
    }
}
```

### Objetivo

Usar um profiler por amostragem de call stacks na prática, ler um flame graph corretamente (largura, profundidade, topos largos) e guiar uma otimização por evidência.

### Instruções

1. Baixe o async-profiler 3.x na página de releases do projeto (`async-profiler/async-profiler` no GitHub) e descompacte. Ele funciona em **Linux e macOS**. No Windows, use WSL2 ou veja a alternativa no fim.
2. Rode `java Cadastros.java` e, em outro terminal, obtenha o pid com `jps`.
3. Aguarde ~10 segundos de aquecimento do JIT e capture 30 segundos de CPU: `./bin/asprof -d 30 -e cpu -f perfil1.html <pid>`.
4. Abra `perfil1.html` no navegador. Identifique os três frames de código próprio mais largos e, dentro do mais largo, o que está no topo da stack.
5. Responda: por que o eixo x não representa tempo? Qual a diferença entre um frame **largo na base** e um frame **largo no topo**?
6. Corrija **apenas** o maior gargalo, rode novamente e gere `perfil2.html`. Compare a distribuição e o número de `processados` impresso no fim.
7. Antes de mexer em `linhaCsv` (o `+=` em laço é um "pecado" clássico), olhe a largura dele no perfil. Vale a pena? Justifique com o gráfico.
8. Explique por que um profiler baseado em `Thread.getStackTrace()` poderia mostrar um resultado distorcido (safepoint bias) e como o async-profiler evita isso.

**Alternativa sem async-profiler (Windows):** grave com o JDK Flight Recorder, `java -XX:StartFlightRecording=duration=60s,filename=perfil1.jfr Cadastros.java`, e abra o arquivo no JDK Mission Control (visão *Method Profiling* / *Flame Graph*) ou no IntelliJ IDEA (*Open Profiler Snapshot*). O raciocínio de leitura é idêntico.

### Dicas

- Se aparecer erro de permissão de `perf_events` no Linux, rode `sudo sysctl kernel.perf_event_paranoid=1` ou use `-e itimer` no lugar de `-e cpu`.
- No HTML do async-profiler, passe o mouse para ver o percentual de amostras e use a busca (Ctrl+F no gráfico) para destacar `Cadastros`.
- `String.matches` compila a expressão regular a cada chamada. Um `Pattern` é imutável e thread-safe, e pode ser compilado uma vez só.

### Critérios de avaliação

- Gera o flame graph (ou equivalente via JFR) com o programa aquecido e anexa/descreve o resultado.
- Identifica `Cadastros.emailValido` como o frame próprio mais largo, com `Pattern.compile` (e seus métodos internos) ocupando a maior parte da largura acima dele, seguido de `checksum` e, bem mais estreito, `linhaCsv`.
- Explica corretamente a leitura: largura = proporção de amostras; eixo x ordenado alfabeticamente; frame largo no topo = consome CPU diretamente; largo na base = apenas está na call stack de quem consome.
- Aplica a correção do maior gargalo (`Pattern` pré-compilado) e mostra no segundo perfil a mudança de distribuição e o aumento de `processados`.
- Usa o perfil para decidir não otimizar `linhaCsv` (fatia pequena), em vez de otimizar por intuição.
- Explica safepoint bias e o uso de sinais + `AsyncGetCallTrace` pelo async-profiler.

### Solução de referência

**Leitura do primeiro perfil** (proporções ilustrativas; dependem de máquina e versão da JVM):

```text
 ~65%  Cadastros.emailValido
         └ String.matches → Pattern.matches → Pattern.compile → Pattern.<init> → expr/sequence/...
         └ (fatia menor) Matcher.matches → nós do autômato
 ~25%  Cadastros.checksum          (frame folha: a CPU está no próprio laço)
  ~8%  Cadastros.linhaCsv
         └ StringConcatFactory / StringBuilder, Arrays.copyOf
 resto: main (concatenação do e-mail), threads do JIT e do GC
```

Essas proporções vêm de uma medição isolada de cada método num notebook comum com JDK 21 (cerca de 1,6 µs por chamada de `String.matches`, 0,36 µs com o `Pattern` pré-compilado, 0,6 µs para `checksum` e 0,2 µs para `linhaCsv`); na sua máquina serão diferentes, mas a ordem deve se manter.

O frame próprio mais largo é `emailValido`. Acima dele, a maior parte da largura é `Pattern.compile` e sua árvore de construção do autômato: o trabalho de **casar** o e-mail é a fatia menor; o de **compilar** a regex a cada chamada é o que domina. `checksum` aparece em segundo lugar como frame folha: cada iteração depende da anterior (`s * 31 + v`), o que impede o JIT de vetorizar o laço. `linhaCsv` é estreito: o `+=` em laço parece ruim, mas com cinco campos curtos a concatenação otimizada do JDK (`StringConcatFactory`) custa pouco. Reescrevê-lo seria otimizar por intuição, não por evidência.

**Como ler:** cada retângulo é um frame; a altura é a profundidade da call stack; a **largura** é a fração das amostras em que o frame estava na stack. O eixo x **não é tempo**: as stacks idênticas são agregadas e os irmãos são ordenados alfabeticamente, para que stacks iguais se fundam num único retângulo. Um frame largo **na base** (como `main`) só indica que está no caminho de tudo; um frame largo **no topo** (sem filhos acima, ou com filhos estreitos) é onde a CPU executa instruções de fato. Otimiza-se olhando os topos largos e descendo até o primeiro frame de código próprio responsável por eles.

**Correção:**

```java
import java.util.List;
import java.util.Random;
import java.util.regex.Pattern;

public class Cadastros {
    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+\\.[\\w.]+");

    static boolean emailValido(String email) {
        return EMAIL.matcher(email).matches();          // compila uma vez, casa muitas
    }

    static long checksum(int[] valores) {
        long s = 0;
        for (int v : valores) s = s * 31 + v;
        return s;
    }

    static String linhaCsv(List<String> campos) {      // mantido: o perfil mostrou que é barato
        String linha = "";
        for (String c : campos) linha += c + ";";
        return linha;
    }

    public static void main(String[] args) {
        int[] valores = new Random(1).ints(200, 0, 100).toArray();
        List<String> campos = List.of("id", "nome", "email", "cidade", "estado");
        long fim = System.nanoTime() + 90_000_000_000L;
        long processados = 0, acumulador = 0;
        while (System.nanoTime() < fim) {
            String email = "usuario" + (processados % 1000) + "@exemplo.com";
            if (emailValido(email)) acumulador += checksum(valores);
            acumulador += linhaCsv(campos).length();
            processados++;
        }
        System.out.println(processados + " " + acumulador);
    }
}
```

**Segundo perfil:** `Pattern.compile` some do gráfico; `emailValido` encolhe para a parte de `Matcher.matches`, e `checksum` passa a ser o frame próprio mais largo, porque agora é uma fatia maior de um total menor. Na medição de referência, o custo por iteração caiu de ~2,4 µs para ~1,2 µs, e o número de `processados` em 90 s aumentou entre 1,5 e 2 vezes (meça na sua máquina). Se fosse preciso ir além, o próximo alvo seria `checksum` (por exemplo, calcular uma vez fora do laço, já que os valores não mudam), e não `linhaCsv`. Repare que o flame graph mostra **proporções**, não tempo absoluto: para provar a melhora, compare a vazão (`processados`), não só o desenho.

**Safepoint bias:** APIs como `Thread.getStackTrace()` e os profilers baseados em JVMTI tradicional só conseguem ler a stack quando a thread para num *safepoint* (pontos como retornos de método e voltas de laço não contados, onde a JVM sabe descrever o estado). Laços apertados compilados pelo JIT podem ter poucos safepoints, e as amostras se acumulam no ponto de parada seguinte, atribuindo o custo ao método errado. O async-profiler usa sinais do SO (`perf_events` ou timers) que interrompem a thread em **qualquer** instrução e chama `AsyncGetCallTrace`, uma API interna da HotSpot que reconstrói a call stack Java a partir desse ponto arbitrário, combinando-a com os frames nativos e do kernel. Por isso o perfil reflete onde a CPU realmente está.

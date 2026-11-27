## O problema: humanos e CPUs falam línguas diferentes

A CPU (tópico 1.1.1) só entende uma coisa: sequências de bytes que codificam instruções do seu conjunto de instruções. Ela não sabe o que é uma variável, uma classe, um laço `for` ou um `String`. Já os humanos precisam de nomes, estruturas, tipos e abstrações para conseguir escrever e manter programas com milhares ou milhões de linhas.

Entre esses dois mundos existem várias **representações do mesmo programa**, cada uma feita para um consumidor diferente:

| Representação | Exemplo | Quem escreve | Quem consome |
|---|---|---|---|
| Código-fonte | `total += valores[i];` | programador | compilador (`javac`, `gcc`) |
| Assembly | `add eax, DWORD PTR [rdi]` | compilador (ou humano, raramente) | montador (*assembler*) |
| Código de máquina | `03 07` | montador / JIT | CPU |
| Bytecode | `iload_1 aload_0 iload_2 iaload iadd` | `javac` | JVM (interpretador e JIT) |

Entender essas camadas responde a perguntas práticas: por que um executável do Windows não roda num Mac com chip Apple, por que o mesmo `.jar` roda em qualquer lugar com uma JVM, por que uma aplicação Java demora para atingir o desempenho máximo e o que exatamente o GraalVM Native Image muda.

## Código de máquina: o que a CPU realmente executa

**Código de máquina** é a sequência de bytes que a CPU busca da memória, decodifica e executa. Cada instrução é um padrão de bits que diz qual operação realizar (o **opcode**) e sobre quais operandos (registradores, endereços de memória, valores imediatos).

Alguns exemplos reais de x86-64:

```text
bytes            instrução           significado
48 01 D8         add rax, rbx        rax ← rax + rbx            (3 bytes)
B8 01 00 00 00   mov eax, 1          eax ← 1                    (5 bytes)
C3               ret                 retorna da função          (1 byte)
```

Em `48 01 D8`: `48` é o prefixo REX.W, que indica operação de 64 bits; `01` é o opcode de "ADD registrador para registrador/memória"; `D8` é o byte ModR/M, cujos bits indicam "ambos os operandos são registradores, fonte `rbx`, destino `rax`". Em `B8 01 00 00 00`, o valor imediato `1` aparece em **little-endian** (byte menos significativo primeiro).

A mesma soma em ARM64 é completamente diferente:

```text
bytes (na memória)   palavra de 32 bits   instrução
00 00 01 8B          0x8B010000           add x0, x0, x1
```

Toda instrução ARM64 tem exatamente 4 bytes, e os campos (registrador de destino, fontes, tipo de operação) ficam em posições fixas da palavra de 32 bits. Os bytes de um `add` x86-64, se fossem entregues a uma CPU ARM, seriam lixo ou outra instrução qualquer: **código de máquina só faz sentido para a arquitetura para a qual foi gerado**.

## Assembly: código de máquina legível

**Assembly** é a representação textual do código de máquina: cada linha corresponde (quase sempre) a uma instrução, com mnemônicos (`mov`, `add`, `jmp`) no lugar dos opcodes e nomes de registradores no lugar dos bits. O programa que converte assembly em código de máquina é o **montador** (*assembler*: `as` do GNU, NASM, MASM); o inverso é o **desmontador** (*disassembler*: `objdump -d`).

Diferenças importantes entre assembly e código de máquina:

- Assembly tem **rótulos** (`.L3:`) em vez de endereços numéricos; o montador e o linker calculam os endereços finais (tópico 1.1.5).
- Assembly tem **diretivas** (`.section`, `.globl`) que não viram instruções, mas organizam o arquivo objeto.
- Existem **duas sintaxes** para x86: Intel (`mov eax, 1`, destino primeiro) e AT&T (`movl $1, %eax`, fonte primeiro, com prefixos `%` e `$`). O GCC usa AT&T por padrão; `-masm=intel` troca para Intel.

Assembly é específico de cada arquitetura, e escrever programas inteiros nele é raro hoje. Mas **ler** assembly é uma habilidade útil: é a forma de verificar o que o compilador ou o JIT realmente gerou.

## ISA: o contrato entre software e hardware

A **ISA** (*Instruction Set Architecture*) é a especificação de uma família de processadores: quais instruções existem, como são codificadas, quais registradores há, como a memória é endereçada, como funcionam interrupções e modos de privilégio. Ela é um **contrato**: qualquer CPU que implemente a ISA x86-64, seja da Intel ou da AMD, de 2008 ou de 2025, executa o mesmo código de máquina, ainda que por dentro (a **microarquitetura**: pipeline, caches, preditores) sejam completamente diferentes.

As duas ISAs mais relevantes para backend hoje:

| Aspecto | x86-64 (AMD64) | ARM64 (AArch64) |
|---|---|---|
| Filosofia | CISC: instruções complexas, que podem operar direto na memória | RISC: instruções simples; só *load/store* acessam memória |
| Tamanho da instrução | variável, de 1 a 15 bytes | fixo, 4 bytes |
| Registradores de uso geral | 16 | 31 |
| Modelo de memória | relativamente forte (TSO) | mais fraco: reordena mais, exige mais barreiras |
| Onde aparece | maioria dos servidores e PCs | celulares, Apple M-series, AWS Graviton, Ampere |

A diferença de modelo de memória é relevante para quem escreve Java concorrente: o *Java Memory Model* define garantias independentes da ISA, e a JVM insere as barreiras necessárias em cada plataforma. Código com *data race* que "funcionava" em x86 pode falhar em ARM.

### Por que um binário nativo não é portável

Um executável nativo depende de muito mais do que a ISA. Ele também depende:

- do **formato do arquivo executável**: ELF (Linux), PE/COFF (Windows), Mach-O (macOS);
- da **ABI** (*Application Binary Interface*): como argumentos são passados (no Linux x86-64, System V, os primeiros inteiros vão em `rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9`; no Windows x64, em `rcx`, `rdx`, `r8`, `r9`), quem preserva quais registradores, como structs são dispostas;
- das **chamadas de sistema** e bibliotecas do SO (`libc`, `kernel32.dll`).

Por isso um `.exe` x86-64 do Windows não roda num Mac ARM: a ISA é outra, o formato é outro e as chamadas ao SO são outras. Rodá-lo exige **tradução** (o Rosetta 2 da Apple traduz binários x86-64 de macOS para ARM64; o Windows on ARM tem um emulador próprio) ou **emulação** completa (QEMU). Até entre Linux x86-64 e Windows x86-64, mesma ISA, o binário não é compatível.

## Bytecode: um código de máquina para uma máquina que não existe

O Java resolve a portabilidade com um nível intermediário. O `javac` não gera código para nenhuma CPU real; ele gera **bytecode**, as instruções de uma **máquina virtual** especificada na *JVM Specification*. O resultado é um arquivo `.class`, que começa sempre com os bytes `CA FE BA BE`, seguido da versão do formato (Java 21 = versão 65), do *constant pool* (strings, nomes de classes e métodos, constantes) e dos métodos com seu bytecode.

Características do bytecode (aprofundadas no tópico 4.1.2):

- É uma **máquina de pilha**: as instruções não nomeiam registradores; operam sobre uma **pilha de operandos** do frame atual. `iadd` desempilha dois `int`, soma e empilha o resultado.
- Os opcodes têm **1 byte** (daí o nome *byte*code), cerca de 200 em uso, e são **tipados**: `iadd` soma `int`, `ladd` soma `long`, `dadd` soma `double`, `aload` carrega uma referência.
- Mantém **informação simbólica**: chamadas referenciam métodos por nome e descritor (`java/io/PrintStream.println:(Ljava/lang/String;)V`), não por endereço. Isso permite carregamento dinâmico de classes, verificação de segurança e otimizações em tempo de execução.
- É **verificável**: antes de executar, a JVM checa que o bytecode é bem-formado (tipos consistentes na pilha, nenhum salto para fora do método), o que impede uma classe maliciosa de corromper a memória.

Por que pilha em vez de registradores? Porque uma máquina de pilha não precisa saber quantos registradores a CPU real terá: o bytecode é compacto, simples de gerar e de verificar, e a decisão de alocar registradores reais fica para o JIT, que conhece a CPU de destino.

## Exemplo: Do código-fonte ao bytecode com javap

```java
public class Soma {
    static int somar(int[] valores) {
        int total = 0;
        for (int i = 0; i < valores.length; i++) {
            total += valores[i];
        }
        return total;
    }
}
```

Compilando com `javac Soma.java` e inspecionando com `javap -c -l Soma` (saída real do JDK 21, método `somar`):

```text
  static int somar(int[]);
    Code:
       0: iconst_0              // empilha 0
       1: istore_1              // total = 0            (local 1)
       2: iconst_0
       3: istore_2              // i = 0                (local 2)
       4: iload_2               // empilha i
       5: aload_0               // empilha a referência valores (local 0)
       6: arraylength           // troca a referência pelo tamanho do array
       7: if_icmpge     22      // se i >= length, salta para 22 (sai do laço)
      10: iload_1               // empilha total
      11: aload_0               // empilha valores
      12: iload_2               // empilha i
      13: iaload                // desempilha (valores, i), empilha valores[i]
      14: iadd                  // total + valores[i]
      15: istore_1              // total = resultado
      16: iinc          2, 1    // i++ (direto na variável local, sem usar a pilha)
      19: goto          4       // volta ao teste do laço
      22: iload_1
      23: ireturn               // devolve total
    LineNumberTable:
      line 3: 0
      line 4: 2
      line 5: 10
      line 4: 16
      line 7: 22
```

Observações:

- O parâmetro `valores` é a variável local 0 (o método é `static`; num método de instância, a local 0 seria `this`).
- O `for` virou um teste no início (`if_icmpge`) e um salto para trás (`goto`): a mesma estrutura de qualquer laço em código de máquina.
- `iaload` não é só uma leitura: a JVM verifica se `valores` é `null` (`NullPointerException`) e se o índice está nos limites (`ArrayIndexOutOfBoundsException`). O JIT costuma provar que o índice está nos limites e eliminar essa verificação dentro do laço.
- A `LineNumberTable` mapeia offsets de bytecode para linhas do fonte; é dela que vêm os números de linha dos *stack traces*.

## Diagrama: Caminhos do código-fonte até a CPU

```text
  C / C++ / Rust / Go  (compilação AOT nativa)

  fonte.c ──gcc──▶ assembly ──as──▶ objeto .o ──ld──▶ executável ELF x86-64
                                                         │
                                                         ▼
                                              CPU x86-64 executa direto
  (para rodar em ARM64: recompilar para ARM64)


  Java  (bytecode + JVM)

  Soma.java ──javac──▶ Soma.class (bytecode, igual em qualquer plataforma)
                             │
             ┌───────────────┴────────────────┐
             ▼                                ▼
     JVM para Linux x86-64            JVM para macOS ARM64
     ┌────────────────────┐           ┌────────────────────┐
     │ interpretador      │           │ interpretador      │
     │   │ método quente  │           │   │ método quente  │
     │   ▼                │           │   ▼                │
     │ JIT C1 → JIT C2    │           │ JIT C1 → JIT C2    │
     │   │ código x86-64  │           │   │ código ARM64   │
     └───┼────────────────┘           └───┼────────────────┘
         ▼                                ▼
     CPU x86-64                        CPU ARM64
```

O bytecode é portável; a **JVM** não é: existe uma JVM compilada para cada combinação de ISA e SO. A portabilidade do Java consiste em mover a dependência de plataforma do programa para a JVM.

## Como a JVM executa o bytecode

A HotSpot combina três estratégias (detalhes no tópico 4.1.4):

1. **Interpretação.** Ao iniciar, todo método é executado pelo interpretador, que lê cada opcode e executa uma rotina correspondente. A HotSpot usa um *template interpreter*: na inicialização, gera um trecho de código de máquina para cada opcode e despacha entre eles. Começa imediatamente, mas é lento (tipicamente uma ordem de grandeza mais lento que código compilado), porque cada instrução de bytecode custa várias instruções de máquina, além do despacho.
2. **Compilação JIT em camadas** (*tiered compilation*). A JVM conta invocações e iterações de laço. Métodos "quentes" são compilados primeiro pelo **C1** (compilação rápida, otimizações simples, coleta de perfil) e, se continuarem quentes, pelo **C2** (compilação demorada e agressiva: *inlining*, escape analysis, eliminação de verificações de limites, vetorização, desvirtualização baseada no perfil).
3. **Desotimização.** O C2 faz apostas com base no perfil observado ("esta chamada virtual sempre vai para `ArrayList.get`"). Se uma aposta deixa de valer (outra implementação aparece), a JVM descarta o código compilado e volta ao interpretador para aquele método, recompilando depois.

O JIT tem uma vantagem que um compilador AOT não tem: ele conhece **a CPU exata** em que está rodando (pode usar AVX-512 se existir) e **o comportamento real** do programa (quais desvios são tomados, quais tipos aparecem). Em troca, consome CPU e memória durante a execução e precisa de tempo de aquecimento (*warm-up*).

## Exemplo: O mesmo código em C, com e sem otimização

Para comparar, veja uma função C simples compilada com GCC para x86-64 (sintaxe Intel com `-masm=intel`; saída típica do GCC 11-13, que pode variar ligeiramente entre versões):

```c
int quadrado_mais_um(int x) {
    return x * x + 1;
}
```

Com `gcc -O0 -S -masm=intel`:

```asm
quadrado_mais_um:
        push    rbp
        mov     rbp, rsp
        mov     DWORD PTR [rbp-4], edi    ; guarda o argumento x na stack
        mov     eax, DWORD PTR [rbp-4]    ; relê x da stack
        imul    eax, eax                  ; eax = x * x
        add     eax, 1                    ; eax = x * x + 1
        pop     rbp
        ret                               ; valor de retorno em eax
```

Com `gcc -O2 -S -masm=intel`:

```asm
quadrado_mais_um:
        imul    edi, edi                  ; x já chega em edi (System V ABI)
        lea     eax, [rdi+1]              ; eax = edi + 1, usando a unidade de endereços
        ret
```

Sem otimização, o compilador traduz cada construção literalmente, com cada variável em memória, o que facilita a depuração. Com `-O2`, ele mantém tudo em registradores, elimina o frame e usa `lea` (*load effective address*) como um somador de três operandos. Isso é o que o C2 da JVM faz com o bytecode quente, só que em tempo de execução.

## Compilado, interpretado e JIT: startup versus desempenho de pico

As estratégias de execução têm perfis de custo diferentes:

| Estratégia | Exemplos | Startup | Desempenho de pico | Portabilidade do artefato |
|---|---|---|---|---|
| AOT nativo | C, C++, Rust, Go, GraalVM Native Image | muito rápido (ms) | alto, previsível desde o início | um binário por ISA + SO |
| Interpretação pura | CPython (até 3.12), Bash, Ruby MRI clássico | rápido | baixo | fonte ou bytecode portável |
| Bytecode + JIT | Java (HotSpot), C#/.NET, JavaScript (V8) | mais lento (centenas de ms a segundos para aquecer) | alto, às vezes acima do AOT graças ao perfil | bytecode portável |

Os rótulos "compilado" e "interpretado" descrevem **implementações**, não linguagens: Java é compilado para bytecode pelo `javac`, interpretado no início pela JVM e compilado para código nativo pelo JIT. E pode ser compilado inteiramente AOT com o GraalVM Native Image.

O trade-off importa muito em backend:

- **Serviços de longa duração** (APIs que ficam no ar por dias) amortizam o aquecimento: o JIT com perfil real costuma vencer.
- **Funções serverless, CLIs e pods que escalam rápido** sofrem com o startup e o aquecimento. Por isso existem o GraalVM Native Image (startup em dezenas de ms, menos memória, mas desempenho de pico geralmente menor, sem perfil dinâmico e com restrições para reflexão e carregamento dinâmico), o CDS/AppCDS (*Class Data Sharing*, que reaproveita classes já processadas entre execuções), o CRaC (*checkpoint/restore* de uma JVM aquecida) e o Projeto Leyden, cujo primeiro resultado, o *AOT cache* do JDK 24 (JEP 483), pré-carrega e liga classes de uma execução de treino.

## [Adicional] Vendo o código de máquina que o JIT gera

É possível ver o assembly que o JIT produziu para seus métodos:

```bash
java -XX:+UnlockDiagnosticVMOptions -XX:+PrintAssembly \
     -XX:CompileCommand=print,Soma::somar  MinhaApp
```

`PrintAssembly` exige o *disassembler plugin* `hsdis` (uma biblioteca nativa que não vem no JDK; precisa ser compilada ou baixada para sua plataforma e colocada no diretório `lib` do JDK). Sem ele, a JVM imprime só os bytes. Outras opções úteis:

- `-XX:+PrintCompilation`: lista cada método compilado, com o nível (1-3 para C1, 4 para C2) e eventos de desotimização (`made not entrant`). Não precisa de `hsdis`.
- **JITWatch**: ferramenta gráfica que lê os logs da JVM (`-XX:+LogCompilation`) e mostra fonte, bytecode e assembly lado a lado.
- **Compiler Explorer** (godbolt.org): compila C, C++, Java e dezenas de outras linguagens no navegador e mostra o assembly ou o bytecode, útil quando você não tem o compilador instalado.

## Custos, limitações e uso em sistemas reais

- **Imagens multiarquitetura.** Com servidores ARM (AWS Graviton, Ampere) ganhando espaço por custo e eficiência, imagens Docker precisam existir para `linux/amd64` e `linux/arm64`. Uma aplicação Java pura roda nas duas com o mesmo `.jar`; só a imagem base (com a JVM) muda.
- **Dependências nativas quebram a portabilidade.** Bibliotecas Java que usam JNI ou a FFM API trazem código de máquina por plataforma (Netty com transporte `epoll`, drivers de compressão como Snappy e zstd, RocksDB). Elas costumam vir com *classifiers* por arquitetura (por exemplo, `linux-x86_64`, `linux-aarch_64`); esquecer a variante ARM é uma causa comum de falhas ao migrar.
- **Custo do aquecimento.** Logo após o deploy, a JVM está interpretando e compilando: a latência é maior e o consumo de CPU, alto. Estratégias comuns: *warm-up* com tráfego sintético antes de entrar no balanceador, *readiness probes* que aguardam o aquecimento, rollouts graduais.
- **Custo de memória do JIT.** O *code cache* (`-XX:ReservedCodeCacheSize`, 240 MB por padrão com compilação em camadas) e as threads do compilador consomem memória e CPU. Se o code cache enche, a JVM para de compilar e o desempenho cai drasticamente (há um aviso no log: `CodeCache is full`).
- **Engenharia reversa.** Bytecode preserva nomes de classes, métodos e campos; decompiladores (CFR, Fernflower, o do IntelliJ) reconstroem um fonte muito próximo do original. Código de máquina otimizado é bem mais difícil de reverter. Isso importa para licenciamento e segredos: nunca embuta credenciais num `.jar` acreditando que estão escondidas.
- **Diagnóstico.** `javap -c -v` mostra bytecode e constant pool; `-XX:+PrintCompilation` mostra o JIT em ação; `perf` com o agente `perf-map-agent` ou o async-profiler mostram onde o código nativo gerado gasta tempo.

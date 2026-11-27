## Desenhar o fluxo .c → .i → .s → .o → executável indicando a ferramenta de cada etapa

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Preprocessing", "Compiling", "Assembling", "Linking", "Object files"]}
```

### Enunciado

Um projeto C tem dois arquivos-fonte, `main.c` e `util.c`, e um header `util.h` incluído por ambos. `main.c` chama `printf` e uma função `normalizar` definida em `util.c`. Desenhe o fluxo completo de build, do código-fonte ao executável `app`, indicando para cada etapa: a ferramenta que a executa, o comando `gcc` que a isola, o artefato produzido (e se ele é texto ou binário) e o que acontece com `#include`, com macros e com a chamada a `normalizar`.

### Objetivo

Fixar o papel de cada fase da cadeia de build, quais trabalham sobre um arquivo de cada vez e qual enxerga o programa inteiro.

### Instruções

1. Desenhe as quatro fases para `main.c` e para `util.c` (em paralelo) e o ponto onde os caminhos se juntam.
2. Para cada seta, escreva a ferramenta (`cpp`/`cc1`, `cc1`, `as`, `ld`) e o comando `gcc` equivalente.
3. Indique em que artefato a chamada a `normalizar` ainda não tem endereço, e em qual ela passa a ter.
4. Indique onde entra a libc e o código de inicialização (`_start`).
5. Responda: se você alterar só `util.c`, quais etapas precisam ser refeitas? E se alterar `util.h`?

### Dicas

- Pré-processamento e compilação trabalham sobre texto; a partir do assembler, os artefatos são binários.
- Só uma das fases conhece mais de um arquivo ao mesmo tempo.
- Um `.o` contém código com "buracos" e uma lista de instruções de como preenchê-los. Como essa lista se chama?

### Critérios de avaliação

- Apresenta as quatro fases na ordem correta, com ferramenta, comando e artefato de cada uma.
- Indica que `.i` e `.s` são texto e que `.o` e o executável são binários ELF.
- Explica que em `main.o` a chamada a `normalizar` é um símbolo indefinido com uma relocation, resolvido apenas no linking.
- Responde corretamente à pergunta sobre rebuild incremental, incluindo o efeito de alterar um header.

### Solução de referência

```text
 main.c (+ util.h, stdio.h)                 util.c (+ util.h)
    │ gcc -E main.c -o main.i                  │ gcc -E util.c -o util.i
    │ [cpp] cola headers, expande macros       │
    ▼                                          ▼
 main.i  (texto: C puro)                    util.i
    │ gcc -S main.i -o main.s                  │ gcc -S util.i -o util.s
    │ [cc1] análise + otimização + codegen     │
    ▼                                          ▼
 main.s  (texto: assembly x86-64)           util.s
    │ gcc -c main.s -o main.o                  │ gcc -c util.s -o util.o
    │ [as] codifica instruções em bytes        │
    ▼                                          ▼
 main.o  (binário ELF relocável)            util.o
   símbolos: T main, U normalizar, U printf   símbolos: T normalizar
   relocation: "call normalizar" com offset 0
    │                                          │
    └──────────────────┬───────────────────────┘
                       │  + crt1.o/crti.o (_start)  + libc.so (printf)
                       ▼
            gcc main.o util.o -o app
            [ld] resolve símbolos, junta seções, aplica relocations
                       ▼
                 app (binário ELF executável)
                 normalizar tem endereço; printf é resolvido pelo
                 dynamic loader quando o programa inicia
```

- O `#include` e as macros deixam de existir já no `.i`: tudo foi substituído por texto.
- Em `main.o`, a chamada a `normalizar` é `e8 00 00 00 00` com uma relocation `R_X86_64_PLT32 normalizar`. O endereço só é conhecido no linking. `printf` continua indefinido no executável e é resolvido em tempo de carregamento, por ser da libc dinâmica.
- Alterou só `util.c`: refazem-se as três primeiras fases para `util.c` e o linking. `main.o` é reaproveitado.
- Alterou `util.h`: como ele foi colado dentro de **ambos** os `.i`, as duas unidades de tradução precisam ser recompiladas, e depois linkadas. Por isso Makefiles declaram headers como dependências dos `.o`, e mudanças em headers muito incluídos disparam rebuilds grandes.

## Compilar um projeto C com dois arquivos separadamente e linká-los manualmente

```meta
{"type": "coding", "level": 2, "required": true, "knowledge": ["gcc -E/-S/-c", "Tabela de símbolos", "nm", "objdump", "Relocations"]}
```

### Enunciado

Escreva um pequeno projeto C com `calc.h`, `calc.c` (que define `int somar(int, int)`, uma variável global `int chamadas` e uma variável `static int ultimo`) e `main.c` (que chama `somar` usando uma macro `DOBRO(x)` e imprime o resultado). Gere **manualmente** cada artefato intermediário, inspecione-os e faça o linking em um comando separado.

### Objetivo

Produzir e interpretar `.i`, `.s`, `.o` e o executável, lendo tabela de símbolos e relocations com ferramentas reais.

### Instruções

1. Escreva os três arquivos. `calc.c` deve incluir `calc.h`.
2. Gere `main.i` com `gcc -E` e encontre a linha onde `DOBRO(3)` foi expandida. Conte as linhas do arquivo (`wc -l`).
3. Gere `main.s` com `gcc -S` e encontre a instrução `call` para `somar`.
4. Gere `main.o` e `calc.o` com `gcc -c`.
5. Rode `nm main.o`, `nm calc.o` e `objdump -d -r main.o`. Explique cada letra (`T`, `U`, `B`, `b`, `d`) e as linhas `R_X86_64_...`.
6. Linke com `gcc main.o calc.o -o app`, rode e depois rode `nm app | grep -E "somar|chamadas|printf"`. O que mudou?
7. Tente `gcc main.o -o app2` (sem `calc.o`) e leia a mensagem.

Ambiente: Linux, WSL ou um container (`docker run --rm -it -v "$PWD":/w -w /w gcc:14 bash`). No macOS, `clang` funciona igual para os passos 1 a 6, mas o formato é Mach-O e os nomes ganham `_` na frente (`_somar`).

### Dicas

- `objdump -r` imprime cada relocation logo abaixo da instrução que ela corrige.
- `chamadas` foi inicializada com zero. Em que seção isso a coloca?
- No executável, `printf` continua `U`. Por quê?

### Critérios de avaliação

- Todos os artefatos (`main.i`, `main.s`, `main.o`, `calc.o`, `app`) foram gerados com os comandos corretos.
- Mostra a expansão de `DOBRO(3)` no `.i` e o valor já dobrado (`6`) no `.s` ou no `.o`.
- Explica corretamente cada símbolo de `nm` e a relocation da chamada a `somar`.
- Explica a mensagem `undefined reference` do passo 7 como erro de linking, e por que `printf` segue indefinido no executável.

### Solução de referência

```c
/* calc.h */
#ifndef CALC_H
#define CALC_H

#define DOBRO(x) ((x) * 2)

int somar(int a, int b);
extern int chamadas;

#endif
```

```c
/* calc.c */
#include "calc.h"

int chamadas = 0;
static int ultimo;

int somar(int a, int b) {
    chamadas++;
    ultimo = a + b;
    return ultimo;
}
```

```c
/* main.c */
#include <stdio.h>
#include "calc.h"

int main(void) {
    int r = somar(DOBRO(3), 4);
    printf("resultado = %d (chamadas: %d)\n", r, chamadas);
    return 0;
}
```

```bash
gcc -E main.c -o main.i && wc -l main.i && grep -n "somar" main.i
gcc -S main.c -o main.s && grep -n "call" main.s
gcc -c main.c -o main.o
gcc -c calc.c -o calc.o
nm main.o; nm calc.o
objdump -d -r main.o
gcc main.o calc.o -o app && ./app
nm app | grep -E "somar|chamadas|printf"
gcc main.o -o app2
```

Resultados ilustrativos e interpretação:

```text
main.i: centenas de linhas (stdio.h inteiro foi colado); perto do fim:
    int somar(int a, int b);
    int r = somar(((3) * 2), 4);

main.s:
    movl  $4, %esi
    movl  $6, %edi          ← (3)*2 já calculado pelo compilador
    call  somar@PLT

nm main.o:
                 U chamadas  ← usada, não definida aqui
0000000000000000 T main      ← função global definida em .text
                 U printf
                 U somar

nm calc.o:
0000000000000000 B chamadas  ← global em .bss (zero-inicializada)
0000000000000000 T somar
0000000000000004 b ultimo    ← static => local (minúscula), invisível ao linker

objdump -d -r main.o (trecho):
  12:  e8 00 00 00 00     call   17 <main+0x17>
                 13: R_X86_64_PLT32   somar-0x4
  1a:  8b 0d 00 00 00 00  mov    0x0(%rip),%ecx
                 1c: R_X86_64_PC32    chamadas-0x4

./app
resultado = 10 (chamadas: 1)

nm app:
0000000000004010 B chamadas   ← agora com endereço (virtual) definitivo
00000000000011ca T somar
                 U printf     ← resolvido só quando o programa inicia

gcc main.o -o app2:
/usr/bin/ld: main.o: in function `main':
main.c:(.text+0x13): undefined reference to `somar'
/usr/bin/ld: main.c:(.text+0x1c): undefined reference to `chamadas'
collect2: error: ld returned 1 exit status
```

- `e8 00 00 00 00` é o `call` com deslocamento provisório zero; a relocation no offset `0x13` (o byte logo após o opcode `e8`) diz ao linker para escrever ali o deslocamento até `somar`, descontando 4 bytes porque o deslocamento é relativo ao fim da instrução.
- `R_X86_64_PC32` em `chamadas` é endereçamento relativo ao `rip`: código independente de posição, o padrão em executáveis PIE.
- A mensagem do passo 7 cita `main.c:(.text+0x13)`, exatamente o offset da relocation que não pôde ser resolvida. Note que é o `ld` (via `collect2`) quem reclama: a compilação de `main.c` tinha sido bem-sucedida.
- `printf` fica `U` no executável porque a libc é uma biblioteca dinâmica; o executável registra a dependência (`NEEDED libc.so.6`) e o dynamic loader resolve o símbolo na inicialização ou na primeira chamada (via PLT/GOT).

## Corrigir um build que falha com undefined reference por função declarada mas não linkada

```meta
{"type": "bug_hunt", "level": 2, "required": false, "knowledge": ["Declaração vs definição", "undefined reference", "Linkage static", "nm"]}
```

### Enunciado

O build de uma pequena loja virtual em C falha. Encontre **todas** as causas e corrija-as, explicando em que fase cada uma acontece.

```c
/* pedido.h */
#ifndef PEDIDO_H
#define PEDIDO_H

double calcular_frete(double peso_kg, int cep_destino);
double total_pedido(double subtotal, double peso_kg, int cep_destino);

#endif
```

```c
/* pedido.c */
#include "pedido.h"

double total_pedido(double subtotal, double peso_kg, int cep_destino) {
    return subtotal + calcular_frete(peso_kg, cep_destino);
}
```

```c
/* frete.c: regras de frete da loja */

static double calcular_frete(double peso_kg, int cep_destino) {
    double base = cep_destino < 30000000 ? 15.0 : 25.0;
    return base + peso_kg * 2.5;
}
```

```c
/* main.c */
#include <stdio.h>
#include "pedido.h"

int main(void) {
    printf("Total: R$ %.2f\n", total_pedido(100.0, 2.0, 1310100));
    return 0;
}
```

```bash
# build.sh
gcc -Wall -c main.c
gcc -Wall -c pedido.c
gcc main.o pedido.o -o loja
```

```text
/usr/bin/ld: pedido.o: in function `total_pedido':
pedido.c:(.text+0x24): undefined reference to `calcular_frete'
collect2: error: ld returned 1 exit status
```

### Objetivo

Praticar o diagnóstico de erros de linkagem com `nm`, distinguindo "definição ausente no link" de "definição existente mas invisível".

### Instruções

1. Reproduza o erro (Linux, WSL, macOS com clang ou container `gcc:14`).
2. Determine em que fase o erro ocorre e qual object file tem o símbolo indefinido (use `nm`).
3. Faça a correção mais óbvia e rode o build de novo. O erro sumiu?
4. Use `nm frete.o` para investigar o que restou e faça a correção definitiva.
5. Proponha uma regra de organização que faria o **compilador** (e não o linker) apontar o segundo problema.
6. O programa deve imprimir `Total: R$ 120.00`.

### Dicas

- A mensagem vem do `ld`. Compilar não falhou; quem falhou foi juntar os pedaços.
- Depois de adicionar `frete.o` ao link, observe a letra que `nm` mostra para `calcular_frete`: é maiúscula ou minúscula?
- O que acontece se `frete.c` incluir `pedido.h`, como `pedido.c` faz?

### Critérios de avaliação

- Identifica o erro como de linking: `pedido.o` tem `U calcular_frete` e nenhum object file passado ao linker exporta esse símbolo.
- Identifica a primeira causa: `frete.c` não é compilado nem passado ao linker.
- Identifica a segunda causa: `static` dá ligação interna à função (`t` minúsculo em `nm`), então ela não satisfaz referências de outros arquivos.
- Corrige ambas, faz `frete.c` incluir `pedido.h` e explica que isso transforma o problema em erro de compilação (`static declaration follows non-static declaration`).

### Solução de referência

**Causa 1: `frete.c` nunca entra no build.** O `build.sh` não compila `frete.c` nem passa `frete.o` ao linker. `nm pedido.o` mostra `U calcular_frete`; nenhum `.o` da linha de comando define o símbolo, então o linker emite `undefined reference`. Correção:

```bash
gcc -Wall -c frete.c
gcc main.o pedido.o frete.o -o loja
```

**Causa 2: a função é `static`.** Mesmo com `frete.o`, o erro continua igual. Investigando:

```text
$ nm frete.o
0000000000000000 t calcular_frete     ← 't' minúsculo: símbolo local
$ nm pedido.o
                 U calcular_frete
0000000000000000 T total_pedido
```

Em C, `static` em uma função no escopo de arquivo significa **ligação interna**: o nome só existe dentro daquela unidade de tradução e não é oferecido ao linker para resolver referências de outros arquivos. O `-Wall` ainda avisava: `'calcular_frete' defined but not used`. Correção: remover `static` e incluir o header.

```c
/* frete.c: regras de frete da loja */
#include "pedido.h"

double calcular_frete(double peso_kg, int cep_destino) {
    double base = cep_destino < 30000000 ? 15.0 : 25.0;
    return base + peso_kg * 2.5;
}
```

```bash
gcc -Wall -c main.c && gcc -Wall -c pedido.c && gcc -Wall -c frete.c
gcc main.o pedido.o frete.o -o loja && ./loja
# Total: R$ 120.00     (100 + 15,00 de base + 2 kg × 2,50)
```

**Regra preventiva:** todo `.c` deve incluir o próprio header. Se `frete.c` incluísse `pedido.h` mantendo o `static`, o compilador acusaria imediatamente `static declaration of 'calcular_frete' follows non-static declaration`, transformando um erro de linking confuso num erro de compilação claro, com arquivo e linha. A mesma inclusão também detecta divergências de assinatura entre declaração e definição, que o linker C nunca detectaria. Um build com Makefile que compila **todos** os `.c` do diretório (`$(wildcard *.c)`) também elimina a primeira causa.

## Comparar tamanho e dependências (ldd) de um binário linkado estática e dinamicamente

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["Ligação estática e dinâmica", "ldd", "readelf", "Dynamic loader", "PLT/GOT"]}
```

### Enunciado

Compile o mesmo programa C de duas formas, dinâmica (padrão) e estática (`-static`), e compare: tamanho do arquivo, dependências em runtime, símbolos, tempo de inicialização e o que acontece quando a biblioteca do sistema é atualizada.

### Objetivo

Medir concretamente os trade-offs entre ligação estática e dinâmica e aprender a usar `ldd`, `file`, `readelf` e `nm` para inspecionar binários.

### Instruções

1. Use um programa que chame funções da libc e da libm, por exemplo `printf` e `sqrt`.
2. Compile: `gcc -O2 prog.c -o prog_dyn -lm` e `gcc -O2 -static prog.c -o prog_static -lm`.
3. Compare com `ls -l`, `file`, `ldd`, `readelf -d | grep NEEDED` e `nm | grep -c " T "` (quantidade de funções definidas).
4. Rode `strip` em cópias dos dois binários e compare os tamanhos de novo.
5. Meça o tempo de 1.000 execuções de cada um (`time (for i in $(seq 1000); do ./prog_dyn >/dev/null; done)`).
6. Escreva uma análise: qual você usaria para (a) uma imagem Docker `scratch`, (b) um utilitário de sistema instalado via gerenciador de pacotes, (c) quando sair uma correção de segurança na libc?

Ambiente: Linux com glibc (Ubuntu/Debian, WSL ou `docker run --rm -it gcc:14 bash`). Se `-static` falhar por falta de `libc.a`, instale `libc6-dev` (Debian/Ubuntu) ou `glibc-static` (Fedora). No macOS não é possível linkar a libSystem estaticamente: compare apenas a versão dinâmica com `otool -L`. Com Alpine (musl), os tamanhos estáticos são bem menores.

### Dicas

- `ldd` em um binário estático não lista nada (com glibc, responde `not a dynamic executable`).
- O binário estático carrega uma parte da libc, não ela inteira: o linker só extrai do `libc.a` os object files que resolvem símbolos usados, mais as dependências deles. Mesmo assim, `printf` puxa muita coisa (locale, I/O com buffer, formatação de ponto flutuante).
- O tempo de start do dinâmico inclui o trabalho do `ld-linux-x86-64.so.2`: mapear bibliotecas e aplicar relocations.

### Critérios de avaliação

- Apresenta tamanhos, saída de `file` e de `ldd` para os dois binários, com e sem `strip`.
- Explica a diferença de tamanho pela cópia do código da libc/libm para dentro do binário estático.
- Explica a lista do `ldd` (loader, `libc.so.6`, `libm.so.6`, `linux-vdso.so.1`) e por que ela está vazia no estático.
- Discute os três cenários (scratch, pacote do sistema, patch de segurança) com argumentos de dependência, atualização e memória compartilhada.

### Solução de referência

```c
/* prog.c */
#include <math.h>
#include <stdio.h>

int main(int argc, char **argv) {
    (void) argv;
    double x = argc + 1.0;      /* valor só conhecido em runtime */
    printf("raiz de %.0f = %.6f\n", x, sqrt(x));
    return 0;
}
```

```bash
gcc -O2 prog.c -o prog_dyn -lm
gcc -O2 -static prog.c -o prog_static -lm
ls -l prog_dyn prog_static
file prog_dyn prog_static
ldd prog_dyn; ldd prog_static
readelf -d prog_dyn | grep NEEDED
cp prog_dyn d_strip && cp prog_static s_strip && strip d_strip s_strip && ls -l d_strip s_strip
```

Saída ilustrativa (Ubuntu 24.04, glibc, x86-64; números aproximados):

```text
-rwxr-xr-x 1 user user  16K prog_dyn
-rwxr-xr-x 1 user user 880K prog_static

prog_dyn:    ELF 64-bit LSB pie executable, x86-64, dynamically linked,
             interpreter /lib64/ld-linux-x86-64.so.2, not stripped
prog_static: ELF 64-bit LSB executable, x86-64, statically linked, not stripped

$ ldd prog_dyn
    linux-vdso.so.1 (0x00007ffd...)
    libm.so.6 => /lib/x86_64-linux-gnu/libm.so.6 (0x00007f...)
    libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f...)
    /lib64/ld-linux-x86-64.so.2 (0x00007f...)
$ ldd prog_static
    not a dynamic executable

$ readelf -d prog_dyn | grep NEEDED
 0x0000000000000001 (NEEDED)  Shared library: [libm.so.6]
 0x0000000000000001 (NEEDED)  Shared library: [libc.so.6]

após strip:  d_strip ~14K   s_strip ~800K
```

Interpretação:

- **Tamanho:** o dinâmico tem só o código do programa, as tabelas PLT/GOT e metadados de ligação. O estático contém cópias de `printf` e de tudo de que ele depende na libc (formatação, locale, buffers de `stdio`, inicialização de threads e TLS). `strip` remove a tabela de símbolos e informações de debug, mas a diferença continua de ordem de grandeza.
- **Por que o valor vem de `argc`:** com `sqrt(2.0)`, o gcc calcularia a raiz em tempo de compilação (constant folding), nenhum símbolo da libm seria usado e o linker, com `--as-needed` (padrão no Ubuntu), nem registraria `libm.so.6` como dependência. Com um valor de runtime, o gcc emite a instrução `sqrtsd` e mantém uma chamada a `sqrt` da libm para o caso de argumento negativo (que precisa ajustar `errno`); por isso `libm.so.6` aparece em `NEEDED`.
- **`ldd`:** `linux-vdso.so.1` é uma biblioteca virtual que o kernel injeta em todo processo (para chamadas como `clock_gettime` sem trocar de modo); `ld-linux-x86-64.so.2` é o dynamic loader, gravado como `interpreter` no cabeçalho ELF. O estático não tem interpreter: o kernel salta direto para `_start`.
- **Tempo de start:** o estático tende a iniciar um pouco mais rápido (sem carregar e resolver bibliotecas). A diferença é de microssegundos a poucos milissegundos por execução: relevante para processos muito curtos e frequentes, irrelevante para um servidor de longa duração.
- **Cenários:** (a) imagem `scratch`: estático, pois não há libc nem loader na imagem (o dinâmico falharia com `no such file or directory`, na verdade referente ao interpreter ausente); (b) utilitário do sistema: dinâmico, para compartilhar páginas da libc entre todos os processos e receber correções pelo gerenciador de pacotes; (c) patch de segurança na libc: os dinâmicos são corrigidos atualizando o pacote e reiniciando os processos; cada binário estático precisa ser recompilado e redistribuído, e é fácil esquecer algum.

## Explicar a causa de NoSuchMethodError em runtime quando o projeto compilou sem erros

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["Class loading lazy", "Constant pool e referências simbólicas", "Classpath", "Conflito de dependências"]}
```

### Enunciado

Pergunta de entrevista: "Nosso serviço compila e passa nos testes no CI. Em produção, uma rota específica falha com `java.lang.NoSuchMethodError: 'java.lang.String lib.Formatador.moeda(double, java.lang.String)'`. As outras rotas funcionam. Como isso é possível, se o compilador verificou que o método existe? Como você investigaria e corrigiria?"

### Objetivo

Explicar `NoSuchMethodError` como um erro de ligação tardia da JVM, relacionando-o com o linking nativo, e demonstrar um método de diagnóstico.

### Instruções

1. Explique o que o javac grava no `.class` quando o código chama um método de outra classe.
2. Explique quando e como a JVM resolve essa referência.
3. Explique por que só uma rota falha.
4. Liste causas comuns em projetos Maven/Gradle e como investigar.
5. Opcional (recomendado): reproduza o erro com duas versões de uma classe e `javac`/`java -cp`.

### Dicas

- O javac verifica contra o classpath de **compilação**. A JVM resolve contra o classpath de **execução**. São necessariamente os mesmos?
- A HotSpot resolve referências do constant pool preguiçosamente, na primeira execução da instrução.
- O descritor do método inclui os tipos dos parâmetros **e** o tipo de retorno.

### Critérios de avaliação

- Explica que o bytecode guarda uma referência simbólica (classe, nome, descritor) e não um endereço.
- Explica a resolução lazy e por isso a falha só aparece quando aquela instrução executa.
- Aponta a divergência entre a versão usada na compilação e a carregada em runtime, com causas concretas (conflito transitivo, jar duplicado, provided pelo servidor).
- Propõe diagnóstico (`mvn dependency:tree`, `-verbose:class`, `getProtectionDomain().getCodeSource()`) e correção (alinhar versões, BOM, enforcer, shading).

### Solução de referência

**O que o javac grava.** Uma chamada `Formatador.moeda(10.0, "US$")` vira `invokestatic #31` e a entrada 31 do constant pool é uma **referência simbólica**: classe `lib/Formatador`, nome `moeda`, descritor `(DLjava/lang/String;)Ljava/lang/String;`. Não há endereço algum. O javac apenas conferiu que, **no classpath de compilação**, esse método existia.

**Quando a JVM resolve.** Classes são carregadas sob demanda pelos class loaders (tópico 4.1.3), e cada referência simbólica é resolvida na primeira vez que a instrução que a usa é executada. Se a classe `lib.Formatador` carregada em runtime não tem um método com aquele nome **e** descritor exatos, a resolução falha com `NoSuchMethodError` (uma subclasse de `LinkageError`). É o análogo exato de `symbol lookup error: undefined symbol` no linking dinâmico nativo: o programa foi ligado contra uma versão e executado com outra.

**Por que só uma rota falha.** Por causa da resolução preguiçosa: as outras rotas nunca executam aquela instrução. A falha pode aparecer horas depois do deploy, quando o caminho raro é exercitado. Demonstração:

```java
// v1/lib/Formatador.java (versão antiga)
package lib;
public class Formatador {
    public static String moeda(double v) { return "R$ " + v; }
}
```

```java
// v2/lib/Formatador.java (versão nova, usada na compilação)
package lib;
public class Formatador {
    public static String moeda(double v) { return "R$ " + v; }
    public static String moeda(double v, String simbolo) { return simbolo + " " + v; }
}
```

```java
// app/App.java
import lib.Formatador;
public class App {
    public static void main(String[] args) {
        System.out.println("iniciando...");
        System.out.println(Formatador.moeda(10.0));
        System.out.println(Formatador.moeda(10.0, "US$"));
    }
}
```

```bash
javac -d out/v1 v1/lib/Formatador.java
javac -d out/v2 v2/lib/Formatador.java
javac -cp out/v2 -d out/app app/App.java      # compila contra a v2
java -cp out/app:out/v1 App                   # executa com a v1 (no Windows use ';')
```

```text
iniciando...
R$ 10.0
Exception in thread "main" java.lang.NoSuchMethodError: 'java.lang.String lib.Formatador.moeda(double, java.lang.String)'
	at App.main(App.java:6)
```

As duas primeiras linhas executam normalmente: a classe foi carregada e `moeda(double)` existe na v1. Só a terceira chamada falha. Sem `out/v1` no classpath, o erro seria `NoClassDefFoundError: lib/Formatador`, o análogo de `cannot open shared object file`.

**Causas comuns em projetos reais:**

- **Conflito de dependências transitivas.** O serviço depende de A (que pede `lib:2.0`) e de B (que pede `lib:1.0`). Maven escolhe a versão "mais próxima" na árvore; Gradle escolhe a mais alta por padrão. Se a escolhida não for a esperada por quem compilou contra a outra, aparece o erro.
- **Dependência `provided`.** O código compila contra uma versão, mas o servidor de aplicação (Tomcat, WildFly) ou a plataforma (Spark, Hadoop) fornece outra em runtime.
- **Jars duplicados** no classpath (por exemplo, `commons-lang` 2 e 3 sob nomes de artefato diferentes, ou um *fat jar* que embutiu uma cópia antiga). O primeiro encontrado vence.
- **Mudança binariamente incompatível**: trocar o tipo de retorno ou os tipos dos parâmetros de um método público muda o descritor, mesmo que o código-fonte dos clientes continue compilando.

**Diagnóstico:** `mvn dependency:tree -Dverbose -Dincludes=grupo:lib` ou `./gradlew dependencyInsight --dependency lib` para ver qual versão foi escolhida e por quê; `java -verbose:class` (ou `-Xlog:class+load`) para ver **de qual jar** a classe foi carregada; em runtime, `Formatador.class.getProtectionDomain().getCodeSource().getLocation()`.

**Correção:** alinhar as versões (`<dependencyManagement>`, BOMs como o do Spring Boot, `constraints` no Gradle), proibir conflitos no build (Maven Enforcer com `dependencyConvergence`) e, em último caso, fazer *shading* da dependência conflitante. Para quem mantém bibliotecas: tratar assinaturas públicas como contrato binário e seguir versionamento semântico.

## Criar uma biblioteca compartilhada própria e carregá-la de um programa principal com um Makefile

```meta
{"type": "project", "level": 4, "required": false, "knowledge": ["Bibliotecas compartilhadas", "-fPIC e -shared", "Makefile", "rpath e dynamic loader", "nm -D e ldd"]}
```

### Enunciado

Crie uma biblioteca compartilhada `libestat.so` com funções de estatística (`estat_media`, `estat_maximo`, `estat_versao`) e um programa `app` que a utiliza. Automatize o build com um Makefile com alvos `all`, `run`, `symbols`, `deps` e `clean`. O executável deve funcionar sem que o usuário precise configurar `LD_LIBRARY_PATH`.

### Objetivo

Construir o ciclo completo de uma biblioteca dinâmica: código independente de posição, exportação de símbolos, linking contra a biblioteca, localização em runtime e build incremental.

### Instruções

1. Estrutura: `include/estat.h` (API pública), `src/estat.c` (implementação, com uma função auxiliar `static`), `app/main.c` (usa a API) e `Makefile`.
2. Compile a biblioteca com `-fPIC` e gere a `.so` com `-shared`, definindo um `soname`.
3. Linke o `app` com `-L` e `-l`, e grave um `RUNPATH` com `$ORIGIN` para que o loader encontre a `.so` no diretório do executável.
4. Alvo `symbols`: lista os símbolos exportados (`nm -D --defined-only`). A função `static` não deve aparecer.
5. Alvo `deps`: mostra `ldd` do app.
6. Verifique o build incremental: depois de `make`, rode `touch src/estat.c && make`. Quais comandos executam? E depois de `touch app/main.c`?
7. Experimento: mova `app` para outro diretório sem a `.so` e execute. Explique o erro.
8. Bônus: altere a implementação de `estat_media` (sem mudar a assinatura), recompile **só a biblioteca** e rode o `app` antigo. O comportamento novo aparece sem relinkar o app?

Ambiente: Linux, WSL ou container (`gcc:14`). No macOS, troque `.so` por `.dylib`, `-shared` por `-dynamiclib`, `-soname` por `-install_name`, `$ORIGIN` por `@loader_path` e `ldd` por `otool -L`. Lembre-se: linhas de comando de um Makefile começam com TAB, não com espaços.

### Dicas

- Sem `-fPIC`, o linker recusa gerar a `.so` em x86-64 com um erro de relocation (`relocation R_X86_64_PC32 against symbol ... can not be used when making a shared object; recompile with -fPIC`).
- No Makefile, `$` precisa ser escrito `$$` para chegar ao shell; e `'$$ORIGIN'` entre aspas simples impede o shell de expandir `$ORIGIN` como variável.
- `readelf -d build/app | grep -E "NEEDED|RUNPATH"` mostra exatamente o que o loader vai usar.

### Critérios de avaliação

- `make` gera `build/libestat.so` e `build/app`, e `make run` imprime versão, média e máximo corretos sem configurar `LD_LIBRARY_PATH`.
- `make symbols` lista as três funções públicas e não lista a função `static`.
- O Makefile expressa dependências corretas: alterar `src/estat.c` não recompila `main.o`; alterar o header recompila os dois.
- Explica o erro ao mover o app (loader não encontra a `.so`) e o resultado do bônus (troca de implementação sem relink, desde que a ABI se mantenha).

### Solução de referência

```c
/* include/estat.h */
#ifndef ESTAT_H
#define ESTAT_H

#include <stddef.h>

double estat_media(const double *valores, size_t n);
double estat_maximo(const double *valores, size_t n);
const char *estat_versao(void);

#endif
```

```c
/* src/estat.c */
#include "estat.h"

/* static: visível só dentro deste arquivo, não vira símbolo exportado */
static double somar(const double *v, size_t n) {
    double s = 0.0;
    for (size_t i = 0; i < n; i++) s += v[i];
    return s;
}

double estat_media(const double *valores, size_t n) {
    return n == 0 ? 0.0 : somar(valores, n) / (double) n;
}

double estat_maximo(const double *valores, size_t n) {
    if (n == 0) return 0.0;
    double m = valores[0];
    for (size_t i = 1; i < n; i++)
        if (valores[i] > m) m = valores[i];
    return m;
}

const char *estat_versao(void) {
    return "libestat 1.0.0";
}
```

```c
/* app/main.c */
#include <stdio.h>
#include "estat.h"

int main(void) {
    double latencias[] = {12.5, 8.0, 30.25, 9.75};
    size_t n = sizeof latencias / sizeof latencias[0];

    printf("%s\n", estat_versao());
    printf("media  = %.2f ms\n", estat_media(latencias, n));
    printf("maximo = %.2f ms\n", estat_maximo(latencias, n));
    return 0;
}
```

```makefile
CC       = gcc
CFLAGS   = -Wall -Wextra -O2
CPPFLAGS = -Iinclude

LIB_NAME = estat
LIB_SO   = build/lib$(LIB_NAME).so
APP      = build/app

.PHONY: all clean run symbols deps

all: $(APP)

build:
	mkdir -p build

# 1) Código da biblioteca: position-independent code
build/estat.o: src/estat.c include/estat.h | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -fPIC -c $< -o $@

# 2) Biblioteca compartilhada com soname
$(LIB_SO): build/estat.o
	$(CC) -shared -Wl,-soname,lib$(LIB_NAME).so $^ -o $@

# 3) Programa principal: só precisa do header para compilar
build/main.o: app/main.c include/estat.h | build
	$(CC) $(CPPFLAGS) $(CFLAGS) -c $< -o $@

# 4) Linking contra a .so; RUNPATH=$ORIGIN faz o loader procurar
#    a biblioteca no diretório do próprio executável
$(APP): build/main.o $(LIB_SO)
	$(CC) build/main.o -Lbuild -l$(LIB_NAME) -Wl,-rpath,'$$ORIGIN' -o $@

run: $(APP)
	./$(APP)

symbols: $(LIB_SO)
	nm -D --defined-only $(LIB_SO)

deps: $(APP)
	ldd $(APP)
	readelf -d $(APP) | grep -E "NEEDED|RUNPATH"

clean:
	rm -rf build
```

Execução ilustrativa (glibc; endereços variam):

```text
$ make
mkdir -p build
gcc -Iinclude -Wall -Wextra -O2 -c app/main.c -o build/main.o
gcc -Iinclude -Wall -Wextra -O2 -fPIC -c src/estat.c -o build/estat.o
gcc -shared -Wl,-soname,libestat.so build/estat.o -o build/libestat.so
gcc build/main.o -Lbuild -lestat -Wl,-rpath,'$ORIGIN' -o build/app

$ make run
./build/app
libestat 1.0.0
media  = 15.12 ms
maximo = 30.25 ms

$ make symbols
0000000000001180 T estat_maximo
0000000000001140 T estat_media
00000000000011c0 T estat_versao
   (podem aparecer também _init/_fini; 'somar' não aparece)

$ make deps
    linux-vdso.so.1 (0x...)
    libestat.so => /caminho/do/projeto/build/libestat.so (0x...)
    libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x...)
    /lib64/ld-linux-x86-64.so.2 (0x...)
 0x0000000000000001 (NEEDED)   Shared library: [libestat.so]
 0x0000000000000001 (NEEDED)   Shared library: [libc.so.6]
 0x000000000000001d (RUNPATH)  Library runpath: [$ORIGIN]
```

Análise:

- **`-fPIC`** gera código que acessa dados e funções globais via GOT/PLT e endereçamento relativo, para que a `.so` funcione em qualquer endereço em que o loader a mapear (e com ASLR, esse endereço muda a cada execução).
- **`somar` não é exportada** porque é `static`. Com `-O2`, ela provavelmente foi até inlinada em `estat_media`. Em bibliotecas maiores, usa-se `-fvisibility=hidden` e se marca explicitamente o que é API pública, reduzindo o tamanho da tabela de símbolos dinâmicos e o tempo de carga.
- **Build incremental:** `touch src/estat.c && make` recompila `estat.o`, regera a `.so` e relinka o app (porque o alvo `$(APP)` depende de `$(LIB_SO)`); `main.o` não é recompilado. `touch app/main.c` recompila só `main.o` e relinka. Alterar `include/estat.h` recompila os dois `.o`.
- **App movido sem a `.so`:** `error while loading shared libraries: libestat.so: cannot open shared object file: No such file or directory`. O link foi bem-sucedido, mas a ligação dinâmica é concluída pelo loader em cada execução: ele procura em `RUNPATH` (`$ORIGIN` = diretório do executável), `LD_LIBRARY_PATH`, `/etc/ld.so.cache` e diretórios padrão, e não encontra. É o paralelo nativo de `NoClassDefFoundError`.
- **Bônus:** mudando o corpo de `estat_media` e recompilando só a `.so`, o app antigo passa a usar o código novo na próxima execução, sem relink. É assim que atualizações de segurança de bibliotecas do sistema funcionam. O limite é a **ABI**: se a assinatura, o layout de uma `struct` pública ou o significado de um parâmetro mudar, o app antigo quebra (ou pior, se comporta errado silenciosamente). Por isso bibliotecas sérias versionam o `soname` (`libestat.so.1`, `libestat.so.2`) a cada quebra de ABI.

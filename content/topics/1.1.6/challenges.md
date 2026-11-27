## Explicar com um diagrama a diferença entre o valor de uma variável e o seu endereço

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Endereço de memória", "Ponteiros", "Operadores & e *", "Little-endian"]}
```

### Enunciado

Considere o trecho C abaixo, executado em Linux x86-64. Suponha que o compilador colocou `x` no endereço `0x7ffc2000`, `p` em `0x7ffc2008` e `pp` em `0x7ffc2010`.

```c
int x = 258;
int *p = &x;
int **pp = &p;
*p = *p + 1;
```

Desenhe a memória **depois** da última linha, mostrando para cada variável o endereço, os bytes guardados (em hexadecimal, na ordem em que aparecem na memória) e o valor interpretado. Em seguida, responda o valor de cada expressão: `x`, `&x`, `p`, `*p`, `&p`, `pp`, `*pp`, `**pp`.

### Objetivo

Separar de forma definitiva os conceitos de valor e de endereço, e entender que um ponteiro é uma variável comum cujo valor é um endereço.

### Instruções

1. Desenhe três blocos de memória, um por variável, com o endereço à esquerda.
2. Calcule o valor final de `x` e escreva seus 4 bytes na ordem little-endian.
3. Escreva os 8 bytes de `p` e de `pp`, também em little-endian.
4. Desenhe setas indicando "aponta para".
5. Preencha a tabela das oito expressões.

### Dicas

- 259 em hexadecimal é `0x00000103`.
- Em little-endian, o byte menos significativo fica no menor endereço.
- `&` "sobe" um nível (de valor para endereço) e `*` "desce" um nível (de endereço para o valor lá guardado).

### Critérios de avaliação

- O diagrama mostra `x` com bytes `03 01 00 00` e valor 259.
- `p` contém os bytes de `0x7ffc2000` em little-endian e `pp` os de `0x7ffc2008`.
- As oito expressões estão corretas.
- Explica com palavras que `p` tem seu próprio endereço, diferente do endereço que guarda.

### Solução de referência

```text
 endereço     bytes na memória (do menor para o maior endereço)   valor
            ┌──────────────────────────────┐
 0x7ffc2000 │ 03 01 00 00                  │  x  = 259
            ├──────────────────────────────┤
 0x7ffc2004 │ (padding)                    │
            ├──────────────────────────────┤
 0x7ffc2008 │ 00 20 fc 7f 00 00 00 00      │  p  = 0x7ffc2000  ──▶ x
            ├──────────────────────────────┤
 0x7ffc2010 │ 08 20 fc 7f 00 00 00 00      │  pp = 0x7ffc2008  ──▶ p
            └──────────────────────────────┘
```

| Expressão | Valor | Significado |
|---|---|---|
| `x` | 259 | valor de x |
| `&x` | `0x7ffc2000` | endereço de x |
| `p` | `0x7ffc2000` | valor de p, que é o endereço de x |
| `*p` | 259 | valor no endereço guardado em p |
| `&p` | `0x7ffc2008` | endereço da própria variável p |
| `pp` | `0x7ffc2008` | valor de pp = endereço de p |
| `*pp` | `0x7ffc2000` | valor de p |
| `**pp` | 259 | valor de x |

`*p = *p + 1` leu 4 bytes a partir de `0x7ffc2000` (258 = `0x102`), somou 1 e escreveu 259 = `0x103` no mesmo lugar: por isso `x` mudou sem ser citada. A lição central: `p` é uma variável como outra qualquer, com endereço próprio (`0x7ffc2008`) e 8 bytes de conteúdo; esse conteúdo é que é um endereço. Os 4 bytes entre `x` e `p` são padding para alinhar `p` em múltiplo de 8 (a disposição real das variáveis locais é escolha do compilador).

## Percorrer um array em C usando aritmética de ponteiros e imprimir endereço e valor de cada elemento

```meta
{"type": "coding", "level": 2, "required": true, "knowledge": ["Aritmética de ponteiros", "Arrays em C", "sizeof", "ASLR"]}
```

### Enunciado

Escreva um programa C que declare três arrays com 5 elementos cada, de tipos `char`, `int` e `double`, e percorra cada um **sem usar o operador `[]`**, só com um ponteiro que avança (`p++`) até um ponteiro de fim. Para cada elemento, imprima o índice (calculado por subtração de ponteiros), o endereço e o valor. Ao final, imprima a diferença em bytes entre o primeiro e o último elemento de cada array.

### Objetivo

Comprovar que `p + 1` avança `sizeof(T)` bytes, que `a[i]` equivale a `*(a + i)` e que endereços mudam entre execuções.

### Instruções

1. Use o padrão `for (T *p = arr; p < arr + N; p++)`.
2. Calcule o índice com `p - arr` (tipo `ptrdiff_t`, formato `%td`) e imprima endereços com `%p` convertendo para `void *`.
3. Para a diferença em bytes, converta os ponteiros para `char *` antes de subtrair.
4. Rode o programa duas vezes e compare os endereços.
5. Responda: por que converter para `char *` dá a diferença em bytes? O que aconteceria se o laço usasse `p <= arr + N`?

Ambiente: qualquer compilador C (gcc, clang, MSVC). No Windows sem gcc, use WSL ou o compilador online Compiler Explorer (godbolt.org) com execução ativada.

### Dicas

- `arr + N` aponta para "um depois do último"; a linguagem permite calcular esse endereço, mas não desreferenciá-lo.
- Subtrair dois `T *` dá a distância em **elementos**; subtrair dois `char *` dá a distância em bytes, porque `sizeof(char)` é 1.
- Se os endereços mudarem entre execuções, procure "ASLR".

### Critérios de avaliação

- Não usa `[]` na leitura dos elementos e o programa compila sem warnings com `-Wall -Wextra`.
- Os endereços avançam de 1, 4 e 8 bytes para `char`, `int` e `double`.
- As diferenças em bytes entre primeiro e último elemento são 4, 16 e 32.
- Explica a variação dos endereços entre execuções (ASLR) e o erro de `p <= arr + N` (leitura fora do array, comportamento indefinido).

### Solução de referência

```c
#include <stdio.h>
#include <stddef.h>

#define N 5

int main(void) {
    char   letras[N]  = {'a', 'b', 'c', 'd', 'e'};
    int    inteiros[N] = {10, 20, 30, 40, 50};
    double reais[N]   = {1.5, 2.5, 3.5, 4.5, 5.5};

    puts("char:");
    for (char *p = letras; p < letras + N; p++)
        printf("  [%td] %p  %c\n", p - letras, (void *) p, *p);

    puts("int:");
    for (int *p = inteiros; p < inteiros + N; p++)
        printf("  [%td] %p  %d\n", p - inteiros, (void *) p, *p);

    puts("double:");
    for (double *p = reais; p < reais + N; p++)
        printf("  [%td] %p  %.1f\n", p - reais, (void *) p, *p);

    printf("bytes entre primeiro e último: char=%td int=%td double=%td\n",
           (char *) &letras[N - 1] - (char *) letras,
           (char *) (inteiros + N - 1) - (char *) inteiros,
           (char *) (reais + N - 1) - (char *) reais);
    return 0;
}
```

Saída ilustrativa (Linux x86-64; endereços mudam a cada execução):

```text
char:
  [0] 0x7ffd5c1e0a33  a
  [1] 0x7ffd5c1e0a34  b
  ...
int:
  [0] 0x7ffd5c1e0a40  10
  [1] 0x7ffd5c1e0a44  20
  [2] 0x7ffd5c1e0a48  30
  ...
double:
  [0] 0x7ffd5c1e0a60  1.5
  [1] 0x7ffd5c1e0a68  2.5
  ...
bytes entre primeiro e último: char=4 int=16 double=32
```

- O compilador traduz `p++` em "somar `sizeof(T)` ao endereço": 1, 4 e 8 bytes. `p - inteiros` divide a diferença em bytes por `sizeof(int)` e devolve o índice.
- Converter para `char *` faz a subtração contar em unidades de 1 byte. (O uso de `&letras[N - 1]` na última linha, fora dos laços, é só para mostrar que `&a[i]` e `a + i` são a mesma coisa.)
- Os endereços mudam porque o SO sorteia a posição da stack a cada execução (ASLR); são endereços virtuais do processo, não posições físicas na RAM.
- Com `p <= arr + N`, o laço desreferencia `arr + N`, um elemento além do fim: comportamento indefinido. Na prática, lê a variável vizinha ou lixo da stack; o C não verifica limites. Em Java, o mesmo erro lançaria `ArrayIndexOutOfBoundsException`.

## Explicar por que reatribuir um parâmetro objeto dentro de um método Java não afeta o chamador

```meta
{"type": "interview", "level": 2, "required": false, "knowledge": ["Referências em Java", "Passagem por valor", "Stack e heap"]}
```

### Enunciado

Pergunta de entrevista: "Java passa objetos por referência ou por valor? Diga o que este programa imprime e explique usando o modelo de memória."

```java
public class Passagem {
    static class Pedido {
        String status = "NOVO";
    }

    static void aprovar(Pedido p) {
        p.status = "APROVADO";
    }

    static void substituir(Pedido p) {
        p = new Pedido();
        p.status = "CANCELADO";
    }

    static void trocar(Pedido a, Pedido b) {
        Pedido tmp = a;
        a = b;
        b = tmp;
    }

    public static void main(String[] args) {
        Pedido x = new Pedido();
        Pedido y = new Pedido();
        y.status = "PAGO";

        aprovar(x);
        System.out.println(x.status);

        substituir(x);
        System.out.println(x.status);

        trocar(x, y);
        System.out.println(x.status + " " + y.status);
    }
}
```

### Objetivo

Explicar com precisão que Java é sempre passagem por valor, e que o valor de uma variável de objeto é uma referência.

### Instruções

1. Diga a saída das três linhas.
2. Para cada método, desenhe (ou descreva) os frames da stack e os objetos no heap antes e depois da chamada.
3. Explique por que `aprovar` tem efeito visível e `substituir` e `trocar` não.
4. Compare com C: o que seria preciso para escrever um `trocar` que funcione?

### Dicas

- Ao chamar `aprovar(x)`, o que exatamente é copiado para o frame de `aprovar`: o objeto ou a referência?
- Duas cópias da mesma referência apontam para o mesmo objeto.
- Reatribuir uma variável local altera apenas aquela variável, no frame dela.

### Critérios de avaliação

- Saída correta: `APROVADO`, `APROVADO`, `APROVADO PAGO`.
- Afirma que Java é sempre passagem por valor e que, para objetos, o valor copiado é a referência.
- Explica que modificar o objeto é visível porque as duas referências apontam para o mesmo objeto, e que reatribuir o parâmetro muda só a cópia local.
- Compara com C (`void trocar(Pedido **a, Pedido **b)`) e observa que Java não tem como obter o endereço de uma variável.

### Solução de referência

Saída:

```text
APROVADO
APROVADO
APROVADO PAGO
```

Java é **sempre passagem por valor**. O valor de uma variável do tipo `Pedido` não é o objeto; é uma **referência** (na HotSpot, na prática um ponteiro, possivelmente comprimido) para um objeto no heap. Na chamada, esse valor é copiado para o parâmetro, no frame do método chamado.

```text
 main:   x = ref#1 ───────┐        heap:  #1 Pedido{status="NOVO"}
                          │
 aprovar: p = ref#1 ──────┘  (cópia da mesma referência)
          p.status = ...   → altera o objeto #1, que x também enxerga
```

- **`aprovar`**: `p` e `x` são duas variáveis diferentes (em frames diferentes) com o mesmo valor, `ref#1`. `p.status = "APROVADO"` segue a referência e altera o objeto `#1`. Quando o método retorna, `x` ainda aponta para `#1`, agora aprovado.
- **`substituir`**: `p = new Pedido()` cria o objeto `#3` e troca o valor da variável local `p` para `ref#3`. `x`, no frame de `main`, continua com `ref#1`. O objeto `#3` fica inalcançável quando o método retorna e será recolhido pelo GC. Por isso continua `APROVADO`.
- **`trocar`**: troca apenas as cópias `a` e `b` dentro do frame de `trocar`; `x` e `y` em `main` não mudam.

Se Java fosse passagem por referência (como `ref` em C# ou `&` em parâmetros C++), `substituir` e `trocar` alterariam as variáveis do chamador. Em C, para isso, passa-se o **endereço da variável**:

```c
void trocar(Pedido **a, Pedido **b) {
    Pedido *tmp = *a;
    *a = *b;
    *b = tmp;
}
/* chamada: trocar(&x, &y); */
```

Java não tem operador `&`: não é possível obter o endereço de uma variável local, e isso é parte do que torna a linguagem segura em memória. Para "devolver" uma nova referência, retorna-se o valor (`x = substituir(x)`) ou usa-se um objeto contêiner (um campo, um `AtomicReference`, um array de um elemento).

## Usar ByteBuffer em Java para observar a mesma int em BIG_ENDIAN e LITTLE_ENDIAN

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["Endianness", "ByteBuffer e ByteOrder", "Operações bit a bit", "Formatos binários"]}
```

### Enunciado

Escreva um programa Java que grave o inteiro `0x0A0B0C0D` em dois `ByteBuffer`, um em `BIG_ENDIAN` e outro em `LITTLE_ENDIAN`, e mostre os bytes de cada um. Depois, reproduza o bug clássico de escrever numa ordem e ler na outra, e implemente a troca de ordem manualmente, com operações de bits, conferindo com `Integer.reverseBytes`.

### Objetivo

Ver concretamente a ordem dos bytes, entender que o padrão do Java é big-endian independentemente da CPU, e saber converter manualmente.

### Instruções

1. Use `ByteBuffer.allocate(4)` e `putInt`. Imprima os bytes com `HexFormat.ofDelimiter(" ").formatHex(buffer.array())`.
2. Crie o segundo buffer com `.order(ByteOrder.LITTLE_ENDIAN)`.
3. Imprima `ByteOrder.nativeOrder()`.
4. No buffer big-endian, chame `flip()`, mude a ordem para little-endian e leia com `getInt()`. Mostre o valor em hexadecimal e em decimal.
5. Implemente `static int trocarOrdem(int v)` usando máscaras e deslocamentos e compare com `Integer.reverseBytes`.
6. Converta manualmente, no papel, `0x12345678` para a representação little-endian e confira com o programa.
7. Responda: se o Java roda num x86 little-endian, por que `ByteBuffer` grava big-endian por padrão? Cite um formato ou protocolo em que isso importa.

### Dicas

- `0x0A0B0C0D` em decimal é 168.496.141.
- Para a troca manual: isole cada byte com `& 0xFF` (após deslocar) e reposicione com `<<`. Use `>>>` para evitar extensão de sinal.
- Pense no formato `.class` e no *network byte order*.

### Critérios de avaliação

- Mostra `0a 0b 0c 0d` para big-endian e `0d 0c 0b 0a` para little-endian.
- Reproduz a leitura errada (`0x0D0C0B0A`, 218.893.066) e explica a causa.
- `trocarOrdem` produz o mesmo resultado que `Integer.reverseBytes` para os valores testados, incluindo um negativo.
- Explica que o padrão big-endian do Java é uma escolha de portabilidade (formato definido, igual em qualquer CPU) e cita exemplos (rede, `.class`, `DataOutputStream`).

### Solução de referência

```java
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.HexFormat;

public class Endianness {

    static int trocarOrdem(int v) {
        return ((v & 0x000000FF) << 24)
             | ((v & 0x0000FF00) << 8)
             | ((v >>> 8) & 0x0000FF00)
             | (v >>> 24);
    }

    public static void main(String[] args) {
        int valor = 0x0A0B0C0D;
        HexFormat hex = HexFormat.ofDelimiter(" ");

        ByteBuffer big = ByteBuffer.allocate(4);              // padrão: BIG_ENDIAN
        big.putInt(valor);
        System.out.println("BIG_ENDIAN    : " + hex.formatHex(big.array()));

        ByteBuffer little = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN);
        little.putInt(valor);
        System.out.println("LITTLE_ENDIAN : " + hex.formatHex(little.array()));

        System.out.println("Ordem nativa  : " + ByteOrder.nativeOrder());

        big.flip();                                           // prepara para leitura
        int lidoErrado = big.order(ByteOrder.LITTLE_ENDIAN).getInt();
        System.out.printf("Escrito BE, lido LE: 0x%08X (%d)%n", lidoErrado, lidoErrado);

        for (int v : new int[] {valor, 0x12345678, -2}) {
            System.out.printf("0x%08X -> manual 0x%08X | reverseBytes 0x%08X%n",
                    v, trocarOrdem(v), Integer.reverseBytes(v));
        }
    }
}
```

Saída (JDK 21, x86-64):

```text
BIG_ENDIAN    : 0a 0b 0c 0d
LITTLE_ENDIAN : 0d 0c 0b 0a
Ordem nativa  : LITTLE_ENDIAN
Escrito BE, lido LE: 0x0D0C0B0A (218893066)
0x0A0B0C0D -> manual 0x0D0C0B0A | reverseBytes 0x0D0C0B0A
0x12345678 -> manual 0x78563412 | reverseBytes 0x78563412
0xFFFFFFFE -> manual 0xFEFFFFFF | reverseBytes 0xFEFFFFFF
```

Análise:

- Big-endian grava o byte mais significativo (`0a`) primeiro; little-endian grava o menos significativo (`0d`) primeiro. O valor é o mesmo; muda só a disposição dos bytes.
- A leitura errada não lança exceção: produz silenciosamente outro número válido. Esse é o perigo dos bugs de endianness em parsers binários: o resultado é plausível, só que errado.
- Em `trocarOrdem`, `>>>` (deslocamento sem sinal) é essencial: com `>>`, o valor negativo `-2` propagaria o bit de sinal e o resultado ficaria errado. `Integer.reverseBytes` é um *intrinsic*: o JIT o substitui pela instrução `bswap` (x86) ou `rev` (ARM).
- `0x12345678` em little-endian: bytes `78 56 34 12`.
- Por que big-endian por padrão: o Java define formatos binários **independentes de plataforma**. Um arquivo gravado com `DataOutputStream` num x86 é lido corretamente num mainframe big-endian. O formato `.class` (o *magic number* `CAFEBABE` aparece nessa ordem no arquivo), os cabeçalhos IP/TCP (*network byte order*) e protocolos como o do Kafka são big-endian. Para ler formatos little-endian (BMP, ZIP, muitos formatos de Windows) ou memória nativa, configura-se o `ByteBuffer` explicitamente com `order(ByteOrder.LITTLE_ENDIAN)`, ou se usa `ValueLayout` com ordem explícita na FFM API.

## Encontrar e corrigir um dangling pointer em um programa C que retorna endereço de variável local

```meta
{"type": "bug_hunt", "level": 4, "required": false, "knowledge": ["Dangling pointer", "Frames da stack", "Comportamento indefinido", "Alocação dinâmica", "AddressSanitizer"]}
```

### Enunciado

O programa abaixo deveria imprimir dois identificadores de pedido diferentes, mas o comportamento varia entre compiladores e níveis de otimização: às vezes imprime `(null)`, às vezes os dois IDs saem iguais, às vezes sai lixo ou ocorre um crash.

```c
#include <stdio.h>

char *formatar_id(int id) {
    char buffer[32];
    snprintf(buffer, sizeof buffer, "PED-%06d", id);
    return buffer;
}

int main(void) {
    char *a = formatar_id(42);
    char *b = formatar_id(7);
    printf("a = %s\n", a);
    printf("b = %s\n", b);
    return 0;
}
```

Encontre o bug, explique **por que** os sintomas variam e apresente **três** correções diferentes, discutindo os trade-offs de cada uma. Por fim, compare com o que aconteceria em Java.

### Objetivo

Entender dangling pointers a partir do ciclo de vida dos frames da stack, reconhecer comportamento indefinido e escolher entre estratégias de posse da memória.

### Instruções

1. Compile com `gcc -Wall` e leia o warning. Rode com `-O0` e `-O2`; se tiver clang, compare.
2. Explique o que acontece com `buffer` quando `formatar_id` retorna, e por que `a` e `b` podem acabar apontando para o mesmo lugar.
3. Explique por que o GCC moderno imprime `(null)` em vez de lixo.
4. Implemente as três correções: (a) buffer fornecido pelo chamador; (b) alocação no heap com `malloc`; (c) buffer `static`. Para cada uma, diga quem é o dono da memória e qual é o risco.
5. Opcional: compile a versão original com `-fsanitize=address -O0` (gcc ou clang em Linux/macOS) e observe o relatório.
6. Compare com um método Java equivalente que retorna uma `String`.

### Dicas

- O frame de `formatar_id` deixa de existir no `ret`, mas os bytes continuam lá até a próxima chamada sobrescrevê-los, e a segunda chamada a `formatar_id` usa exatamente o mesmo espaço de stack.
- O compilador sabe que retornar o endereço de uma local é sempre um erro; o GCC aproveita o comportamento indefinido para retornar `NULL` e fazer o bug aparecer.
- Na correção com `static`, pense no que acontece com `a` depois da segunda chamada, e com duas threads chamando a função.

### Critérios de avaliação

- Identifica que `buffer` vive no frame de `formatar_id` e que o ponteiro retornado fica pendente (dangling) após o retorno.
- Explica a variação dos sintomas: comportamento indefinido, reuso do mesmo frame pela segunda chamada e a transformação do GCC em `NULL`.
- As três correções compilam sem warnings, imprimem `PED-000042` e `PED-000007` e cada uma tem posse e riscos discutidos (inclusive `free` na versão com `malloc` e reentrância na versão `static`).
- Explica que em Java o problema não existe: objetos ficam no heap e vivem enquanto forem alcançáveis.

### Solução de referência

**O bug.** `buffer` é uma variável local: vive no frame de `formatar_id`, na stack. Quando a função retorna, o stack pointer recua e o frame deixa de existir logicamente (tópico 1.1.7). O endereço devolvido continua numericamente válido (a página da stack segue mapeada), mas aponta para memória que **não pertence mais a ninguém**: é um *dangling pointer*. O gcc avisa:

```text
warning: function returns address of local variable [-Wreturn-local-addr]
```

**Por que os sintomas variam.** Usar esse ponteiro é comportamento indefinido, e cada compilador faz algo diferente:

- **Sem a transformação do GCC (por exemplo, clang, ou compiladores antigos):** a segunda chamada `formatar_id(7)` ocupa **o mesmo** espaço de stack da primeira e sobrescreve o buffer com `PED-000007`. `a` e `b` têm o mesmo endereço, e os dois `printf` podem imprimir `PED-000007`. Além disso, o próprio `printf` usa a stack e pode sobrescrever os bytes antes de lê-los, gerando lixo.
- **GCC moderno (ilustrativo, verificado com GCC 15):** como retornar o endereço de uma local é sempre um erro, o GCC substitui o valor retornado por `NULL`, para que o bug se manifeste de forma determinística. A glibc e a musl imprimem `(null)` para `%s` com ponteiro nulo; em outras situações (por exemplo, se o compilador trocar `printf("%s\n", a)` por `puts(a)`), o resultado é um segmentation fault.

```text
a = (null)
b = (null)
```

Com AddressSanitizer, conforme o compilador, o relatório aponta um acesso inválido (`stack-use-after-return`, quando essa detecção está ativa, ou um `SEGV` no endereço zero), indicando a linha do `printf`.

**Correção (a): o chamador fornece o buffer.** É o padrão mais idiomático em C (`snprintf`, `strftime`).

```c
#include <stdio.h>

char *formatar_id(int id, char *destino, size_t tamanho) {
    snprintf(destino, tamanho, "PED-%06d", id);
    return destino;
}

int main(void) {
    char a[32], b[32];
    formatar_id(42, a, sizeof a);
    formatar_id(7, b, sizeof b);
    printf("a = %s\nb = %s\n", a, b);
    return 0;
}
```

Dono: o chamador. Custo zero de alocação, sem risco de vazamento e reentrante. Risco: o chamador precisa passar um tamanho correto (por isso `snprintf`, que nunca escreve além de `tamanho`).

**Correção (b): alocação no heap.**

```c
#include <stdio.h>
#include <stdlib.h>

char *formatar_id(int id) {
    char *buffer = malloc(32);
    if (buffer == NULL) return NULL;
    snprintf(buffer, 32, "PED-%06d", id);
    return buffer;               /* o chamador passa a ser dono e deve chamar free */
}

int main(void) {
    char *a = formatar_id(42);
    char *b = formatar_id(7);
    if (a == NULL || b == NULL) { free(a); free(b); return 1; }
    printf("a = %s\nb = %s\n", a, b);
    free(a);
    free(b);
    return 0;
}
```

Dono: quem recebe o ponteiro. A memória sobrevive ao retorno porque o heap não está atrelado a frames (tópico 1.1.8). Riscos: esquecer `free` (vazamento), chamar `free` duas vezes (*double free*) ou usar depois do `free` (*use-after-free*, outro tipo de dangling pointer). Custo: uma alocação no heap por chamada.

**Correção (c): buffer `static`.**

```c
#include <stdio.h>

const char *formatar_id(int id) {
    static char buffer[32];      /* vive em .bss durante todo o programa */
    snprintf(buffer, sizeof buffer, "PED-%06d", id);
    return buffer;
}

int main(void) {
    printf("a = %s\n", formatar_id(42));   /* usar antes da próxima chamada */
    printf("b = %s\n", formatar_id(7));
    return 0;
}
```

Dono: o próprio módulo. O endereço é válido para sempre, então não há dangling pointer. Riscos: **todas as chamadas compartilham o mesmo buffer**. Guardar `a = formatar_id(42)` e depois chamar `formatar_id(7)` faz `a` "mudar" para `PED-000007`; e duas threads chamando a função ao mesmo tempo corrompem o resultado uma da outra. É o problema histórico de funções como `strtok`, `asctime` e `inet_ntoa`, que levou às versões reentrantes `strtok_r` e `asctime_r`. Por isso o `main` acima usa cada resultado imediatamente.

**Em Java:**

```java
static String formatarId(int id) {
    return String.format("PED-%06d", id);
}
```

Não há como errar: a `String` é um objeto no heap, a variável local guarda apenas uma referência, e o objeto vive enquanto houver alguma referência alcançável para ele. O GC só o recolhe quando ninguém mais o alcança. Java não permite obter o endereço de uma variável local, então o equivalente ao `return buffer;` simplesmente não existe. O custo dessa segurança é a alocação no heap e o trabalho do GC, que o JIT às vezes elimina com escape analysis (tópico 1.1.7).

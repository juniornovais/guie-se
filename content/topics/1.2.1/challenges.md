## Mapear quais responsabilidades do SO são acionadas ao executar um programa que lê um arquivo

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Kernel", "System calls", "Escalonamento", "Sistema de arquivos", "Memória virtual"]}
```

### Enunciado

Você digita no terminal `java LerArquivo` e o programa abaixo executa, lê `dados.txt` e imprime quantos bytes leu.

```java
import java.nio.file.Files;
import java.nio.file.Path;

public class LerArquivo {
    public static void main(String[] args) throws Exception {
        byte[] dados = Files.readAllBytes(Path.of("dados.txt"));
        System.out.println("Li " + dados.length + " bytes");
    }
}
```

Descreva, em ordem cronológica, quais responsabilidades do sistema operacional são acionadas desde o momento em que você aperta Enter até o processo terminar.

### Objetivo

Enxergar o kernel como um conjunto de subsistemas (processos, escalonamento, memória, sistema de arquivos, drivers) que cooperam numa operação aparentemente simples.

### Instruções

1. Comece pelo shell: o que ele precisa pedir ao kernel para iniciar a JVM?
2. Descreva o que acontece com a memória quando a JVM carrega e reserva o heap.
3. Descreva o caminho de `Files.readAllBytes` até o dado chegar ao array Java, considerando dois casos: arquivo no page cache e arquivo só no disco.
4. Explique o papel do escalonador e das interrupções durante a leitura do disco.
5. Explique como o texto chega ao terminal e o que acontece no término do processo.
6. Para cada passo, indique o subsistema do kernel e, quando souber, a syscall envolvida.

### Dicas

- O shell não "vira" a JVM: ele cria um processo filho e esse filho troca de programa.
- Carregar um executável e bibliotecas não significa ler tudo para a RAM imediatamente; pense em mapeamento de memória e page faults.
- Enquanto o disco trabalha, a thread que pediu o dado não precisa ocupar a CPU. Quem a acorda quando o dado chega?

### Critérios de avaliação

- Cita a criação do processo (`fork`/`clone` + `execve`) pelo shell e a espera do shell (`wait`).
- Cita o gerenciamento de memória: mapeamento do executável e bibliotecas, reserva do heap via `mmap` e page faults sob demanda.
- Descreve `openat`, `read` e `close`, passando pelo VFS, pelo page cache e, se necessário, pelo driver do disco.
- Explica que a thread é bloqueada durante o I/O, outra thread pode usar a CPU, e uma interrupção do dispositivo a torna pronta novamente.
- Cita `write` no descritor 1 (stdout) e o encerramento com `exit_group`, com liberação dos recursos e entrega do status de saída ao shell.

### Solução de referência

1. **Criação do processo (gerenciamento de processos).** O shell lê a linha, procura `java` no `PATH` e chama `fork` (na prática `clone`) para criar um processo filho. O filho chama `execve("/usr/bin/java", ...)`, que substitui a imagem do processo pelo executável da JVM. O shell pai chama `wait4` e dorme até o filho terminar.
2. **Carregamento (memória virtual + sistema de arquivos).** O `execve` faz o kernel ler o cabeçalho ELF e **mapear** o executável na memória; o dynamic linker mapeia `libjvm.so`, `libc.so` etc. com `mmap`. Nada é lido inteiro: as páginas são carregadas por **page faults** conforme o código é executado. A JVM reserva o espaço do heap com `mmap` (sem memória física ainda), mapeia `lib/modules` e cria suas threads internas (GC, JIT) com `clone`.
3. **Abrir o arquivo (VFS).** `Files.readAllBytes` chama `openat(AT_FDCWD, "dados.txt", O_RDONLY)`. O VFS resolve o caminho diretório a diretório, verifica permissões do usuário e devolve um **descritor de arquivo** (um inteiro, ex.: 5) que aponta para uma entrada na tabela de arquivos abertos do processo. Em seguida a JVM costuma consultar o tamanho com `fstat`.
4. **Ler (VFS + page cache + driver).** `read(5, buf, n)`:
   - Se o arquivo está no **page cache** (foi lido recentemente), o kernel copia os bytes da página em cache para o buffer do processo e retorna imediatamente.
   - Se não está, o sistema de arquivos traduz o deslocamento para blocos do disco e o **driver** (ex.: NVMe) envia um comando ao dispositivo.
5. **Escalonador e interrupções.** Enquanto o SSD trabalha, a thread é marcada como **bloqueada** e o escalonador entrega a CPU a outra thread. Quando a leitura termina, o dispositivo gera uma **interrupção**; o handler do kernel marca a operação como concluída e coloca a thread de volta na fila de prontas. Quando ela for escalonada, o kernel copia os dados para o buffer de user space e a syscall retorna. A JVM copia o conteúdo para o `byte[]` no heap Java.
6. **Fechar.** `close(5)` libera o descritor.
7. **Escrever no terminal (sistema de arquivos/TTY).** `System.out.println` resulta em `write(1, "Li 10 bytes\n", 12)`. O descritor 1 foi herdado do shell e aponta para o terminal (um dispositivo TTY/pseudo-terminal), cujo driver entrega o texto ao emulador de terminal.
8. **Término.** Ao fim de `main`, a JVM executa os shutdown hooks e chama `exit_group(0)`. O kernel libera memória, descritores e threads, guarda o status de saída e notifica o pai com `SIGCHLD`. O `wait4` do shell retorna com o status 0 e o prompt reaparece.

Ao longo de tudo isso, o **timer** continua interrompendo a CPU periodicamente para que o escalonador reparta o tempo entre a JVM e os demais processos.

## Rastrear com strace as system calls de um programa Java que lê um arquivo e identificar open, read e close

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["strace", "System calls", "Descritores de arquivo", "Inicialização da JVM"]}
```

### Enunciado

Use o `strace` para observar as system calls que um programa Java faz ao ler um arquivo de texto, e localize, no meio das milhares de linhas geradas pela JVM, exatamente as chamadas que abrem, leem e fecham esse arquivo.

### Objetivo

Ver com os próprios olhos que operações de I/O em Java se tornam system calls e aprender a filtrar e interpretar a saída do `strace`.

### Instruções

1. Prepare um ambiente Linux: Linux nativo, **WSL2** no Windows, ou um container: `docker run --rm -it -v "$PWD":/w -w /w eclipse-temurin:21 bash` e depois `apt-get update && apt-get install -y strace`. (No macOS sem Docker, use `dtruss` ou `fs_usage`, sabendo que a saída é diferente.)
2. Crie `dados.txt` com algumas linhas e o programa `LerArquivo` usando `FileInputStream` com um buffer de 4096 bytes num laço até `read` devolver -1.
3. Compile com `javac` (evite rodar o `.java` direto, para não poluir o rastreio com a compilação em memória).
4. Rode `strace -f -o trace.txt java LerArquivo` e conte as linhas do arquivo (`wc -l trace.txt`).
5. Encontre a abertura do seu arquivo (`grep -n dados.txt trace.txt`), anote o descritor devolvido e encontre os `read` e o `close` com esse descritor **na mesma thread** (mesmo número de TID no início da linha).
6. Rode `strace -c -f java LerArquivo` e anote as 5 syscalls mais frequentes. Explique por que elas aparecem.
7. Repita com um arquivo de 1 MB. Quantos `read` aparecem? Por quê?

### Dicas

- Com `-f`, cada linha começa com o TID; o `main` da sua aplicação não roda no primeiro TID do processo, porque o launcher `java` cria uma nova thread para executar a JVM.
- O último `read` do laço devolve `0` (fim de arquivo), que o Java traduz para `-1`.
- Nas syscalls mais frequentes do resumo, espere ver `mmap`, `mprotect`, `futex`, `openat` e `read`: pense em carregar bibliotecas, reservar memória e sincronizar threads.

### Critérios de avaliação

- O rastreio foi gerado e o aluno informa a ordem de grandeza de linhas (centenas a milhares).
- Identifica `openat(..., "dados.txt", O_RDONLY) = N`, os `read(N, ...)` e o `close(N)` correspondentes.
- Explica o significado do valor de retorno de cada uma (descritor, bytes lidos, 0 em fim de arquivo, 0 em `close` bem-sucedido).
- Relaciona o número de `read` com o tamanho do buffer (1 MB / 4096 ≈ 256 chamadas, mais a final que devolve 0).
- Explica a presença de `mmap`, `mprotect`, `futex` e `clone` como custo de inicialização e operação da JVM.

### Solução de referência

```java
import java.io.FileInputStream;
import java.io.IOException;

public class LerArquivo {
    public static void main(String[] args) throws IOException {
        long total = 0;
        try (FileInputStream in = new FileInputStream("dados.txt")) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) != -1) {
                total += n;
            }
        }
        System.out.println("Total: " + total + " bytes");
    }
}
```

```bash
printf 'linha 1\nlinha 2\nlinha 3\n' > dados.txt
javac LerArquivo.java
strace -f -o trace.txt java LerArquivo
wc -l trace.txt
grep -n 'dados.txt' trace.txt
```

Trecho ilustrativo (TIDs, descritores e endereços variam):

```text
5103  openat(AT_FDCWD, "dados.txt", O_RDONLY) = 6
5103  fstat(6, {st_mode=S_IFREG|0644, st_size=24, ...}) = 0
5103  read(6, "linha 1\nlinha 2\nlinha 3\n", 4096) = 24
5103  read(6, "", 4096)                 = 0
5103  close(6)                          = 0
5103  write(1, "Total: 24 bytes\n", 16) = 16
```

Interpretação:

- `openat` devolve `6`, o menor descritor livre (0, 1 e 2 são stdin/stdout/stderr; os demais já estavam ocupados pela JVM com bibliotecas, `lib/modules` etc.).
- O primeiro `read` pede até 4096 bytes e recebe 24; o segundo recebe `0`, que significa fim de arquivo e vira `-1` em Java.
- `close` devolve `0` (sucesso).
- O `write(1, ...)` é o `println`.

No resumo `strace -c -f`, as syscalls dominantes costumam ser `mmap`/`mprotect`/`munmap` (carregar bibliotecas, reservar heap, metaspace, stacks, code cache), `futex` (threads da JVM se coordenando durante a inicialização), `openat`/`read`/`fstat`/`close` (bibliotecas, arquivos de configuração e o próprio jimage) e `clone`/`clone3` (criação das threads de GC, JIT, finalizer etc.). Isso mostra que a maior parte do trabalho no kernel durante um programa curto é a inicialização da JVM.

Com um arquivo de 1 MB e buffer de 4096 bytes, aparecem cerca de 256 `read` que devolvem 4096 e um último que devolve 0: cada chamada a `in.read(buf)` vira exatamente uma syscall, porque `FileInputStream` não tem buffer próprio.

## Comparar o tempo de 1 milhão de escritas de 1 byte sem buffer vs. com BufferedOutputStream e explicar pelo custo de syscalls

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["Custo de syscall", "BufferedOutputStream", "FileOutputStream", "Medição de desempenho"]}
```

### Enunciado

Escreva um programa que grave 1.000.000 de bytes num arquivo, um byte por vez, de duas formas: diretamente com `FileOutputStream.write(int)` e através de um `BufferedOutputStream`. Meça o tempo das duas versões e explique a diferença em termos de system calls.

### Objetivo

Quantificar o custo de cruzar a fronteira user/kernel e entender por que bufferização em user space é uma das otimizações mais importantes em I/O.

### Instruções

1. Implemente `semBuffer()` e `comBuffer()`, cada uma escrevendo 1.000.000 de vezes o byte `'x'` em arquivos diferentes.
2. Meça com `System.nanoTime()`. Rode cada versão algumas vezes (aquecimento) e reporte a mediana.
3. Calcule quantas syscalls `write` cada versão faz (raciocine sobre o tamanho padrão do buffer).
4. Se tiver Linux/WSL/Docker, confirme com `strace -c -f -e trace=write java Escritas`.
5. Calcule o custo médio aproximado de cada `write` na versão sem buffer.
6. Varie o tamanho do buffer (`new BufferedOutputStream(out, 64)`, `512`, `65536`) e explique a curva obtida.
7. Responda: o `flush`/`close` do `BufferedOutputStream` garante que os dados estão no disco físico? Por quê?

### Dicas

- O tamanho padrão do buffer de `BufferedOutputStream` é 8192 bytes.
- O tempo da versão sem buffer é dominado pela entrada e saída do kernel, não pelo disco: o `write` normalmente só copia o byte para o page cache.
- Para a última pergunta, pesquise a diferença entre `write` e `fsync` (`FileChannel.force` em Java).

### Critérios de avaliação

- As duas versões estão corretas, fecham os streams e escrevem exatamente 1.000.000 de bytes.
- A medição inclui aquecimento ou repetição e reporta números das duas versões.
- Calcula ~1.000.000 de syscalls na versão sem buffer e ~123 na versão com buffer de 8 KB.
- Estima o custo por syscall (tempo total ÷ número de chamadas) e o relaciona à troca de modo.
- Explica o efeito do tamanho do buffer (ganho grande até alguns KB, depois retornos decrescentes).
- Explica que `write` coloca os dados no page cache e que durabilidade exige `fsync`/`FileChannel.force`.

### Solução de referência

```java
import java.io.BufferedOutputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;

public class Escritas {
    static final int N = 1_000_000;

    static long semBuffer() throws IOException {
        long inicio = System.nanoTime();
        try (OutputStream out = new FileOutputStream("sem-buffer.bin")) {
            for (int i = 0; i < N; i++) out.write('x');
        }
        return System.nanoTime() - inicio;
    }

    static long comBuffer(int tamanho) throws IOException {
        long inicio = System.nanoTime();
        try (OutputStream out = new BufferedOutputStream(new FileOutputStream("com-buffer.bin"), tamanho)) {
            for (int i = 0; i < N; i++) out.write('x');
        }
        return System.nanoTime() - inicio;
    }

    static long mediana(long[] v) {
        long[] c = v.clone();
        Arrays.sort(c);
        return c[c.length / 2];
    }

    public static void main(String[] args) throws IOException {
        int rodadas = 5;
        long[] a = new long[rodadas];
        for (int i = 0; i < rodadas; i++) a[i] = semBuffer();
        System.out.printf("sem buffer: %d ms%n", mediana(a) / 1_000_000);

        for (int tam : new int[]{64, 512, 8192, 65536}) {
            long[] b = new long[rodadas];
            for (int i = 0; i < rodadas; i++) b[i] = comBuffer(tam);
            System.out.printf("buffer %6d: %d ms%n", tam, mediana(b) / 1_000_000);
        }
    }
}
```

Resultados ilustrativos (variam muito por SO, disco, antivírus e mitigações de CPU):

| Versão | Syscalls `write` | Tempo |
|---|---|---|
| Sem buffer | 1.000.000 | ~0,4–4 s |
| Buffer 64 B | ~15.625 | ~15 ms |
| Buffer 512 B | ~1.954 | ~5 ms |
| Buffer 8 KB | ~123 | ~3 ms |
| Buffer 64 KB | ~16 | ~3 ms |

Sem buffer, cada `out.write('x')` vira `write(fd, "x", 1)`: um milhão de entradas e saídas do kernel. Se a versão levou 800 ms, cada syscall custou em média ~0,8 µs, quase todo ele em overhead fixo (troca de modo, validação, mitigações, poluição de cache), já que copiar 1 byte para o page cache é trivial. No Windows a diferença costuma ser ainda maior, porque cada `WriteFile` é mais caro e antivírus podem inspecionar as escritas.

Com buffer, `write('x')` só grava num `byte[]` em user space (alguns nanossegundos); quando o array enche, uma única syscall envia 8192 bytes. 1.000.000 / 8192 ≈ 123 syscalls, mais a do `flush` final em `close`. O `strace -c` confirma a contagem.

A curva por tamanho mostra **retornos decrescentes**: de 64 B para 8 KB o número de syscalls cai 128 vezes e o tempo cai bastante; acima de 8 KB, o custo das syscalls já é desprezível frente ao laço em Java, e o ganho praticamente some.

Por fim, `flush`/`close` só garantem que os dados foram entregues ao kernel (page cache). O kernel grava no disco depois, de forma assíncrona. Se a máquina perder energia antes disso, os dados se perdem. Para durabilidade é preciso `fsync` (em Java, `FileChannel.force(true)` ou abrir com `StandardOpenOption.SYNC`/`DSYNC`), que é muito mais caro. Bancos de dados agrupam commits justamente para amortizar o custo do `fsync`.

## Explicar a diferença entre container e VM e por que a JVM precisa reconhecer limites de cgroups

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["Containers", "Máquinas virtuais", "Namespaces", "cgroups", "UseContainerSupport", "MaxRAMPercentage"]}
```

### Enunciado

Numa entrevista para uma vaga de backend, o entrevistador diz: *"Nosso serviço Spring Boot roda em Kubernetes com limite de 1 GiB de memória. De vez em quando o pod reinicia com status `OOMKilled`, mas não aparece nenhum `OutOfMemoryError` no log. Primeiro me explique a diferença entre um container e uma VM; depois, o que pode estar acontecendo."*

Escreva a resposta como se estivesse falando (até 3 minutos).

### Objetivo

Explicar containers em termos do kernel (namespaces e cgroups) e conectar isso ao dimensionamento de memória e CPU da JVM.

### Instruções

1. Diferencie VM e container quanto a kernel, isolamento, tempo de inicialização e overhead.
2. Explique o papel de namespaces e cgroups.
3. Explique por que `OOMKilled` sem `OutOfMemoryError` indica que quem matou o processo foi o kernel, e não a JVM.
4. Liste o que consome memória num processo Java além do heap.
5. Explique o que é container awareness na JVM, a partir de que versões existe e como verificar o que a JVM enxergou.
6. Proponha uma configuração e um plano de investigação.

### Dicas

- `OutOfMemoryError` é lançado quando o **heap** (ou metaspace etc.) atinge o limite configurado na JVM; `OOMKilled` acontece quando o **cgroup** atinge `memory.max`.
- Pense em metaspace, stacks de threads, code cache, buffers diretos (`ByteBuffer.allocateDirect`, Netty) e estruturas do GC.
- `-XX:NativeMemoryTracking=summary` e `jcmd <pid> VM.native_memory summary` mostram a memória nativa por categoria.

### Critérios de avaliação

- Explica que a VM roda um kernel convidado sobre hardware virtualizado por um hypervisor, e o container é um processo do kernel do host.
- Descreve namespaces (o que o processo vê) e cgroups (quanto pode usar), com exemplos.
- Compara isolamento (VM mais forte), inicialização e overhead (container mais leve).
- Diferencia `OOMKilled` (kernel, cgroup, SIGKILL, código 137) de `OutOfMemoryError` (JVM).
- Cita as regiões fora do heap que contam no limite do cgroup.
- Explica `UseContainerSupport` (JDK 10+, 8u191+, cgroup v2 em versões recentes), `MaxRAMPercentage` e o efeito em `availableProcessors`.
- Propõe ação concreta: heap relativo ao limite com folga, NMT, métricas de RSS e revisão de memória nativa.

### Solução de referência

**Container vs. VM.** "Uma VM virtualiza o hardware: um hypervisor apresenta CPUs, disco e rede virtuais, e dentro dela roda um sistema operacional completo, com kernel próprio. Um container não tem kernel próprio: é um processo comum do kernel do host, ao qual o kernel aplica **namespaces**, que mudam o que o processo enxerga (árvore de PIDs, pontos de montagem, interfaces de rede, hostname, usuários), e **cgroups**, que limitam o que ele consome (memória com `memory.max`, CPU com `cpu.max`, número de PIDs). Por isso um container sobe em milissegundos e quase não tem overhead, mas o isolamento é mais fraco: todos compartilham o mesmo kernel, então uma falha de kernel afeta todos, enquanto numa VM o atacante teria de escapar também do hypervisor."

**O OOMKilled.** "`OutOfMemoryError` é a JVM dizendo que o heap, ou outra área que ela controla, chegou ao limite configurado. `OOMKilled` é diferente: o **processo inteiro** ultrapassou o limite de memória do cgroup, e o kernel o matou com `SIGKILL` (código de saída 137). Como é `SIGKILL`, a JVM não tem chance de logar nada nem rodar shutdown hooks. Isso indica que a soma de toda a memória do processo, não só o heap, passou de 1 GiB.

Num processo Java, além do heap, contam: metaspace (classes carregadas, e Spring carrega muitas), code cache do JIT, stacks das threads (cada platform thread tem até 1 MB reservado, e o que for tocado vira memória residente), buffers diretos e memória do Netty, estruturas internas do GC, memória de bibliotecas nativas e o `malloc` da própria JVM.

Duas causas comuns: (1) uma JVM antiga, sem container awareness, que lê a memória do host e escolhe um heap enorme; (2) uma JVM moderna configurada com heap grande demais, por exemplo `-Xmx1g` num limite de 1 GiB, ou `MaxRAMPercentage=90`, sem espaço para a memória nativa."

**Container awareness.** "Desde o JDK 10, com backport no 8u191, a flag `-XX:+UseContainerSupport` vem ligada e a JVM lê os limites do cgroup em vez de `/proc/meminfo`. O suporte a cgroup v2, que é o padrão em distribuições e clusters recentes, veio no JDK 15 e foi levado ao 11 e ao 8 em updates posteriores. Assim, o heap máximo padrão vira 25% do **limite do container**, e `Runtime.availableProcessors()` respeita a cota de CPU, o que dimensiona threads do GC, do JIT e o `ForkJoinPool.commonPool()`. Para conferir: `java -XshowSettings:system -version` ou `-Xlog:os+container=info` dentro do container."

**Plano.** "Eu confirmaria a versão do JDK e o que ela enxerga; configuraria o heap relativo ao limite com folga, algo como `-XX:MaxRAMPercentage=70` a `75`, ou `-Xmx` explícito em torno de 650–750 MiB para 1 GiB; ligaria `-XX:NativeMemoryTracking=summary` em homologação e compararia `jcmd <pid> VM.native_memory summary` com o RSS do processo; limitaria o número de threads (pool do Tomcat), o metaspace (`MaxMetaspaceSize`) e buffers diretos (`MaxDirectMemorySize`) se necessário; e acompanharia a métrica de memória do container junto com a de heap. Se a memória nativa crescer sem parar, é sinal de vazamento fora do heap."

## Escrever um mini-shell em C que executa comandos usando fork, exec e wait

```meta
{"type": "implementation", "level": 4, "required": false, "knowledge": ["fork", "execvp", "waitpid", "Processos", "C", "Status de saída"]}
```

### Enunciado

Implemente em C um mini-shell interativo: ele mostra um prompt, lê uma linha, separa o comando e os argumentos, executa o programa num processo filho e espera ele terminar antes de mostrar o próximo prompt. Deve suportar os comandos internos `cd` e `exit`.

### Objetivo

Entender, construindo, como um shell usa as system calls de gerenciamento de processos, e por que alguns comandos precisam ser internos.

### Instruções

1. Use Linux, WSL2, macOS ou um container (`docker run --rm -it -v "$PWD":/w -w /w gcc:13 bash`). No Windows nativo não existe `fork`.
2. Em laço: imprima `mini$ `, leia a linha com `fgets` e trate fim de entrada (Ctrl+D) encerrando o shell.
3. Separe a linha em até 63 argumentos com `strtok` (espaços, tabs e `\n`), terminando o vetor com `NULL`.
4. Implemente `exit [código]` e `cd [dir]` (sem argumento, vá para `$HOME`) **no próprio shell**.
5. Para outros comandos: `fork`; no filho, `execvp`; se `execvp` retornar, imprima o erro e termine o filho com código 127.
6. No pai, `waitpid` e imprima o status: código de saída normal ou o sinal que matou o filho.
7. Teste: `ls -l`, `echo ola`, `false`, `cd /tmp` seguido de `pwd`, `comando-inexistente`, `sleep 30` (mate-o de outro terminal com `kill -9 <pid>`).
8. Explique por que `cd` não pode ser um programa externo.

### Dicas

- `fork` retorna 0 no filho, o PID do filho no pai e -1 em erro.
- `execvp` só retorna se falhar; use `perror` para mostrar o motivo e `_exit(127)` (convenção dos shells para "comando não encontrado").
- Use as macros `WIFEXITED`/`WEXITSTATUS` e `WIFSIGNALED`/`WTERMSIG` para interpretar o status devolvido por `waitpid`.
- O diretório de trabalho é um atributo **do processo**. Se um filho muda o dele, o que acontece com o do pai?

### Critérios de avaliação

- Compila sem avisos com `gcc -Wall -Wextra -o mini mini.c`.
- Executa comandos com argumentos usando `fork` + `execvp` + `waitpid`.
- Mostra o código de saída (ex.: `false` → 1) e o sinal quando o filho é morto (ex.: 9).
- Trata comando inexistente sem derrubar o shell (filho termina com 127).
- `cd` e `exit` são internos e funcionam; Ctrl+D encerra o shell.
- Explica corretamente por que `cd` precisa ser interno e por que o pai precisa chamar `wait` (zumbis, tópico 1.2.2).

### Solução de referência

```c
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#define MAX_LINHA 1024
#define MAX_ARGS 64

static int separar(char *linha, char **argv) {
    int argc = 0;
    char *tok = strtok(linha, " \t\n");
    while (tok != NULL && argc < MAX_ARGS - 1) {
        argv[argc++] = tok;
        tok = strtok(NULL, " \t\n");
    }
    argv[argc] = NULL;
    return argc;
}

int main(void) {
    char linha[MAX_LINHA];
    char *argv[MAX_ARGS];

    for (;;) {
        printf("mini$ ");
        fflush(stdout);

        if (fgets(linha, sizeof linha, stdin) == NULL) {   /* Ctrl+D ou erro */
            putchar('\n');
            return 0;
        }
        int argc = separar(linha, argv);
        if (argc == 0) continue;

        if (strcmp(argv[0], "exit") == 0) {
            return argc > 1 ? atoi(argv[1]) : 0;
        }
        if (strcmp(argv[0], "cd") == 0) {
            const char *destino = argc > 1 ? argv[1] : getenv("HOME");
            if (destino == NULL || chdir(destino) != 0) perror("cd");
            continue;
        }

        pid_t pid = fork();
        if (pid < 0) {
            perror("fork");
            continue;
        }
        if (pid == 0) {                       /* processo filho */
            execvp(argv[0], argv);
            fprintf(stderr, "%s: %s\n", argv[0], strerror(errno));
            _exit(127);
        }

        int status;                           /* processo pai */
        while (waitpid(pid, &status, 0) < 0) {
            if (errno != EINTR) { perror("waitpid"); break; }
        }
        if (WIFEXITED(status)) {
            printf("[pid %d saiu com código %d]\n", (int) pid, WEXITSTATUS(status));
        } else if (WIFSIGNALED(status)) {
            printf("[pid %d morto pelo sinal %d]\n", (int) pid, WTERMSIG(status));
        }
    }
}
```

Sessão ilustrativa:

```text
mini$ echo ola
ola
[pid 7311 saiu com código 0]
mini$ false
[pid 7312 saiu com código 1]
mini$ cd /tmp
mini$ pwd
/tmp
[pid 7314 saiu com código 0]
mini$ nao-existe
nao-existe: No such file or directory
[pid 7315 saiu com código 127]
mini$ sleep 30
[pid 7316 morto pelo sinal 9]
```

**Por que `cd` é interno:** o diretório de trabalho é um atributo do processo, guardado no kernel junto com os demais dados do processo. Se `cd` fosse um programa externo, o `fork` criaria um filho, o filho chamaria `chdir`, mudaria o **próprio** diretório e terminaria; o shell pai continuaria onde estava. Pelo mesmo motivo `exit` (encerrar o próprio shell) e `export` (alterar o ambiente do shell) são internos.

**Por que o `waitpid` é obrigatório:** ele sincroniza o prompt com o fim do comando e, principalmente, recolhe o status de saída do filho. Sem ele, cada filho terminado vira um **processo zumbi** até o pai morrer (tópico 1.2.2). Note também que o `fork` duplica o processo inteiro, mas com **copy-on-write**: as páginas só são copiadas se alguém escrever nelas, e como o filho chama `execvp` logo em seguida, quase nada é copiado.

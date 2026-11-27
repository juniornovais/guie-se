## Descrever o caminho completo de um read() de arquivo até o disco e de volta, incluindo page cache

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["System calls", "Page cache", "DMA", "Interrupções", "Readahead", "Escalonamento de threads"]}
```

### Enunciado

Um programa Java executa `int n = in.read(buffer);` sobre um `FileInputStream` aberto num arquivo de 100 MB que nunca foi lido desde o boot, num Linux com SSD NVMe. `buffer` é um `byte[8192]`. Descreva, passo a passo, tudo o que acontece desde a chamada até o retorno, e depois descreva o que muda quando a mesma leitura é repetida um minuto depois.

### Objetivo

Conseguir narrar o caminho de uma operação de I/O atravessando JVM, kernel e hardware, identificando onde há cópias, onde a thread dorme e onde entra o page cache.

### Instruções

1. Comece na JVM: o que `FileInputStream.read(byte[])` faz antes de chegar ao kernel?
2. Descreva a transição para o kernel e o papel do VFS e do sistema de arquivos.
3. Descreva o cache miss: block layer, driver, DMA, interrupção e o que a thread faz enquanto espera.
4. Descreva as cópias de dados até o `byte[]`, indicando quem faz cada uma (dispositivo ou CPU).
5. Explique o readahead e seu efeito nas próximas chamadas de `read`.
6. Descreva a segunda leitura (cache quente) e estime a diferença de tempo.

### Dicas

- O kernel não sabe nada sobre o heap Java; o `byte[]` pode ser movido pelo GC a qualquer momento.
- Enquanto o SSD trabalha, a CPU pode executar outras threads.
- O page cache é indexado por (arquivo, offset da página).

### Critérios de avaliação

- Menciona a passagem JVM → código nativo → system call `read`, com um buffer nativo intermediário.
- Descreve a consulta ao page cache e, no miss, a requisição ao block layer e ao driver.
- Explica que o dispositivo transfere os dados por DMA para o page cache e sinaliza com interrupção.
- Explica que a thread é colocada para dormir e acordada pelo kernel, liberando a CPU.
- Identifica as cópias: DMA para o page cache, CPU do page cache para o buffer nativo, CPU do buffer nativo para o `byte[]`.
- Explica readahead e que a segunda leitura é servida do page cache, com ordem de grandeza da diferença (microssegundos vs. dezenas de microssegundos ou mais).

### Solução de referência

**Na JVM.** `FileInputStream.read(byte[])` chama um método nativo (`readBytes`). Como o GC pode mover o `byte[]`, o código nativo do JDK não passa o endereço do array ao kernel: usa um buffer nativo temporário (na stack nativa para até 8 KiB; com `malloc` para tamanhos maiores) e chama a system call `read(fd, bufNativo, 8192)`.

**Entrada no kernel.** A instrução `syscall` muda para modo kernel. O kernel valida o descritor, encontra o `struct file` e chama o VFS, que delega ao sistema de arquivos (ext4, xfs). A leitura usa o page cache: o kernel calcula quais páginas do arquivo cobrem o intervalo pedido (offset 0 a 8191: as páginas 0 e 1) e as procura no cache.

**Cache miss.** As páginas não estão no cache. O kernel aloca frames para elas e os insere no page cache, travados como "em leitura". Como é o início de uma leitura sequencial, o **readahead** amplia a requisição (por exemplo, para 128 KiB). O sistema de arquivos traduz offsets do arquivo para blocos do dispositivo; o block layer monta a requisição (`bio`), possivelmente agrupa com outras e a entrega ao driver NVMe, que escreve um comando na fila de submissão do SSD e avisa o controlador.

**A thread dorme.** A thread fica esperando que as páginas sejam desbloqueadas: o kernel a marca como bloqueada e o escalonador põe outra thread na CPU. Nenhum ciclo é gasto esperando.

**Dispositivo e DMA.** O controlador lê a flash e transfere os dados **por DMA** diretamente para os frames do page cache (cópia 1, sem CPU). Ao terminar, grava a conclusão na fila de completions e dispara uma **interrupção**. O handler do driver marca a requisição como concluída, as páginas ficam atualizadas e desbloqueadas, e a thread é acordada (volta à fila de prontas).

**Cópias para o processo.** Quando a thread volta a rodar, ainda em modo kernel, copia 8.192 bytes do page cache para o buffer nativo (cópia 2, CPU) e a system call retorna `8192`. De volta à JVM, o código nativo copia o buffer nativo para o `byte[]` no heap (cópia 3, CPU, via `SetByteArrayRegion`). `read` retorna `n = 8192`.

**Próximas chamadas.** Graças ao readahead, as próximas leituras de 8 KiB encontram as páginas já no cache (ou já a caminho). O kernel continua disparando readahead assíncrono à frente, de modo que uma leitura sequencial quase nunca espera o disco.

**Segunda leitura, um minuto depois.** Se não houve pressão de memória, as páginas continuam no page cache. O caminho fica: system call → page cache hit → cópia para o buffer nativo → cópia para o `byte[]`. Sem block layer, sem DMA, sem dormir. Tempo: alguns microssegundos (dominado pela system call e pelas duas cópias de 8 KiB), contra algo entre ~20 µs e centenas de microssegundos no primeiro acesso a um NVMe (milissegundos num HDD).

## Medir a leitura de um arquivo grande com cache frio vs. quente e explicar pelo page cache

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["Page cache", "drop_caches", "Throughput", "Readahead", "FileChannel"]}
```

### Enunciado

Crie um arquivo de 2 GB, meça o tempo de leitura completa com o page cache frio e depois com o cache quente, e explique os resultados. Observe também como a memória "buff/cache" do sistema muda.

### Objetivo

Ver o page cache em ação, saber controlar o estado do cache num experimento e entender por que benchmarks de I/O precisam distinguir cache frio de quente.

### Instruções

1. Use Linux (nativo ou WSL 2; em WSL 2, o page cache é o da VM Linux). Gere o arquivo: `dd if=/dev/urandom of=grande.bin bs=1M count=2048`.
2. Escreva um programa Java que leia o arquivo inteiro com `FileChannel` e um `ByteBuffer.allocateDirect(1 << 20)`, imprimindo tempo e throughput em MB/s.
3. Esvazie o cache: `sync; echo 3 | sudo tee /proc/sys/vm/drop_caches`. Observe `free -m` antes e depois.
4. Rode o programa (cache frio). Rode de novo imediatamente (cache quente). Repita o ciclo 3 vezes.
5. Durante a leitura fria, observe `vmstat 1` ou `iostat -x 1` (pacote `sysstat`) em outro terminal.
6. Bônus: use `fincore grande.bin` (util-linux) para ver quantas páginas do arquivo estão no cache.
7. No Windows nativo não há `drop_caches`. Uma aproximação é ler um arquivo maior que a RAM livre (o cache não comporta tudo) ou reiniciar a máquina entre as medições; registre a limitação.

### Dicas

- Sem `drop_caches`, o `dd` que criou o arquivo deixou boa parte dele no page cache: sua "primeira" leitura já estaria quente.
- Compare o throughput frio com a especificação do seu disco, e o quente com a banda de memória.
- Se o arquivo for maior que a RAM disponível para cache, nem a segunda leitura será totalmente quente.

### Critérios de avaliação

- O programa lê o arquivo inteiro e mostra tempo e MB/s.
- Mostra que, depois de `drop_caches`, o "buff/cache" do `free` diminui e cresce ~2 GB após a leitura.
- Apresenta medições frias e quentes repetidas, com diferença clara (tipicamente várias vezes).
- Relaciona o throughput frio ao dispositivo (visível no `iostat`/`vmstat` como leitura de disco) e o quente a cópias de memória.
- Explica o papel do readahead na leitura fria e a ausência de I/O de disco na leitura quente.

### Solução de referência

```java
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

public class LeituraCache {
    public static void main(String[] args) throws Exception {
        Path arquivo = Path.of(args.length > 0 ? args[0] : "grande.bin");
        ByteBuffer buf = ByteBuffer.allocateDirect(1 << 20);
        long total = 0;
        long inicio = System.nanoTime();
        try (FileChannel ch = FileChannel.open(arquivo, StandardOpenOption.READ)) {
            int n;
            while ((n = ch.read(buf)) != -1) {
                total += n;
                buf.clear();
            }
        }
        double segundos = (System.nanoTime() - inicio) / 1e9;
        System.out.printf("%d MB em %.2f s = %.0f MB/s%n",
                total >> 20, segundos, (total >> 20) / segundos);
    }
}
```

Resultados ilustrativos (SSD NVMe de consumo, 16 GB de RAM; variam muito por hardware):

| Execução | Tempo | Throughput |
|---|---|---|
| Fria 1 | 1,10 s | ~1.860 MB/s |
| Quente 1 | 0,28 s | ~7.300 MB/s |
| Fria 2 | 1,05 s | ~1.950 MB/s |
| Quente 2 | 0,27 s | ~7.600 MB/s |

`free -m` ilustrativo: antes do `drop_caches`, `buff/cache` em ~6.000 MB; logo depois, ~400 MB; após a leitura fria, ~2.450 MB.

Explicação:

- **Cache frio**: cada `read` que pede páginas ausentes vai ao dispositivo. O kernel detecta leitura sequencial e faz readahead cada vez maior, então o SSD recebe requisições grandes e trabalha perto da sua banda sequencial. O `iostat` mostra ~1,9 GB/s de leitura no dispositivo e `vmstat` mostra `bi` alto. O tempo total é limitado pelo disco.
- **Cache quente**: as páginas estão no page cache. Cada `read` é só system call + cópia de 1 MiB do page cache para o direct buffer. Não há leitura no `iostat`. O limite agora é a banda de memória e o custo das cópias, por isso o throughput é várias vezes maior.
- **Consequência prática**: um benchmark que lê o mesmo arquivo repetidamente mede a RAM, não o disco. Por outro lado, é também por isso que bancos de dados e o Kafka dependem tanto do page cache: dados quentes são servidos na velocidade da memória sem esforço da aplicação. Em containers, essa memória conta no cgroup, mas é recuperável antes de um OOM.

## Comparar cópia de arquivo com buffers de 1 byte, 8 KB e 1 MB e explicar a curva de desempenho

```meta
{"type": "coding", "level": 2, "required": false, "knowledge": ["Custo de system calls", "Buffers em user space", "FileInputStream", "Caches da CPU"]}
```

### Enunciado

Implemente a cópia de um arquivo usando `FileInputStream` e `FileOutputStream` **sem** classes `Buffered*`, com um buffer `byte[]` de tamanho configurável. Meça o tempo com buffers de 1 byte, 64 bytes, 8 KB, 64 KB e 1 MB e explique a curva.

### Objetivo

Sentir o custo fixo de uma system call e entender por que existe buffering em user space, e por que buffers enormes não trazem ganho proporcional.

### Instruções

1. Gere um arquivo de 16 MB (no Linux, `dd if=/dev/urandom of=origem.bin bs=1M count=16`; em qualquer SO, pode gerar em Java com `Random.nextBytes` e `Files.write`).
2. Implemente `copiar(Path origem, Path destino, int tamanhoBuffer)` usando `in.read(buf, 0, buf.length)` e `out.write(buf, 0, n)`.
3. Faça uma cópia de aquecimento para colocar o arquivo no page cache e aquecer o JIT.
4. Meça cada tamanho de buffer 3 vezes e use a mediana. Calcule também o número de system calls de leitura (tamanho do arquivo ÷ buffer).
5. Monte uma tabela e um gráfico (pode ser em texto) de tempo × tamanho do buffer.
6. Explique por que a curva cai muito no começo e fica praticamente plana depois.
7. Bônus: compare com `BufferedInputStream` envolvendo leituras de 1 byte (`in.read()`), e com `Files.copy`.

### Dicas

- Com buffer de 1 byte, uma cópia de 16 MB faz cerca de 33 milhões de system calls (leitura + escrita).
- Acima de alguns KB, o custo da system call já é pequeno perto do custo de copiar os bytes.
- Buffers maiores que 8 KB fazem o código nativo do JDK usar `malloc` a cada chamada, e buffers muito grandes não cabem no cache L1/L2.

### Critérios de avaliação

- O código compila, copia corretamente (os arquivos ficam idênticos) e mede os cinco tamanhos.
- A tabela mostra a queda de ordens de grandeza entre 1 byte e 8 KB.
- Calcula o número de system calls e relaciona o tempo de 1 byte ao custo por chamada (~0,2–1 µs).
- Explica o platô: a partir de alguns KB, o tempo é dominado pelas cópias de memória e pelo page cache, não pelas system calls.
- Explica por que 1 MB não é muito melhor (e pode ser pior) que 64 KB: cache da CPU, alocação do buffer nativo, nenhuma redução relevante de overhead.

### Solução de referência

```java
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Random;

public class CopiaBuffers {
    static void copiar(Path origem, Path destino, int tamanhoBuffer) throws IOException {
        byte[] buf = new byte[tamanhoBuffer];
        try (FileInputStream in = new FileInputStream(origem.toFile());
             FileOutputStream out = new FileOutputStream(destino.toFile())) {
            int n;
            while ((n = in.read(buf, 0, buf.length)) != -1) {
                out.write(buf, 0, n);
            }
        }
    }

    static long medirMs(Path origem, Path destino, int tamanho) throws IOException {
        long[] tempos = new long[3];
        for (int i = 0; i < 3; i++) {
            long t0 = System.nanoTime();
            copiar(origem, destino, tamanho);
            tempos[i] = (System.nanoTime() - t0) / 1_000_000;
        }
        Arrays.sort(tempos);
        return tempos[1];   // mediana
    }

    public static void main(String[] args) throws IOException {
        Path origem = Path.of("origem.bin");
        Path destino = Path.of("destino.bin");
        if (!Files.exists(origem)) {
            byte[] dados = new byte[16 * 1024 * 1024];
            new Random(1).nextBytes(dados);
            Files.write(origem, dados);
        }
        long tamanhoArquivo = Files.size(origem);
        copiar(origem, destino, 64 * 1024);   // aquecimento: page cache e JIT

        int[] tamanhos = {1, 64, 8 * 1024, 64 * 1024, 1024 * 1024};
        System.out.printf("%10s %12s %10s%n", "buffer", "reads", "tempo ms");
        for (int t : tamanhos) {
            long ms = medirMs(origem, destino, t);
            System.out.printf("%10d %12d %10d%n", t, (tamanhoArquivo + t - 1) / t, ms);
        }
        if (Files.mismatch(origem, destino) != -1) throw new AssertionError("cópia diferente!");
    }
}
```

Resultados ilustrativos (Linux, NVMe, arquivo no page cache; variam por máquina e SO; no Windows, as system calls costumam ser mais caras):

| Buffer | System calls de leitura | Tempo |
|---|---|---|
| 1 B | 16.777.216 | ~14.000 ms |
| 64 B | 262.144 | ~230 ms |
| 8 KB | 2.048 | ~12 ms |
| 64 KB | 256 | ~9 ms |
| 1 MB | 16 | ~11 ms |

```text
tempo (escala log)
14000 ms │ ●
         │
  230 ms │      ●
         │
   12 ms │           ●     ●     ●
         └──────────────────────────────
           1B   64B   8KB  64KB  1MB
```

Explicação:

- **1 byte**: são ~16,8 milhões de `read` e outros tantos `write`, ~33,5 milhões de system calls. 14 s ÷ 33,5 M ≈ 0,4 µs por chamada, que é o custo fixo de entrar no kernel, validar argumentos e voltar (mais a travessia JNI da JVM). O tempo é **todo overhead**; copiar 1 byte é irrelevante.
- **64 bytes**: 64 vezes menos chamadas, tempo ~60 vezes menor. A curva segue o número de system calls.
- **8 KB em diante**: o número de chamadas fica tão pequeno (2.048) que o overhead total é ~1 ms. O tempo restante é **copiar 16 MB** duas vezes no caminho de leitura e duas no de escrita (page cache ↔ buffer nativo ↔ `byte[]`) e o trabalho do page cache na escrita. Aumentar o buffer não reduz esse custo, por isso o platô.
- **1 MB pode ser um pouco pior**: buffers acima de 8 KB fazem o código nativo do JDK alocar um buffer temporário com `malloc` a cada chamada; 1 MB não cabe no L1/L2, então as cópias passam a ir ao L3 ou à RAM; e não há mais overhead de system call a eliminar.
- **Bônus**: `BufferedInputStream` com `read()` de 1 byte fica próximo do caso de 8 KB, porque faz uma system call a cada 8 KB e serve os bytes do próprio buffer (pagando uma chamada de método por byte, que o JIT torna barata). `Files.copy` entre arquivos pode usar cópia dentro do kernel e costuma ser o mais rápido.

Regra prática: buffers de 8 KB a 64 KB capturam quase todo o ganho. O que importa é nunca fazer I/O byte a byte sem buffer.

## Explicar a diferença entre I/O não bloqueante e assíncrono e onde Netty e virtual threads se encaixam

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["I/O não bloqueante", "I/O assíncrono", "epoll", "io_uring", "IOCP", "Netty", "Virtual threads", "Pinning"]}
```

### Enunciado

Pergunta de entrevista: *"Qual a diferença entre I/O não bloqueante e I/O assíncrono? O Netty é assíncrono? E se usarmos virtual threads com JDBC bloqueante, ainda precisamos de WebFlux/Netty?"* Escreva a resposta como faria numa entrevista para sênior, em até três minutos de fala.

### Objetivo

Distinguir com precisão prontidão de conclusão, situar Netty e virtual threads nesse mapa e discutir trade-offs reais de arquitetura.

### Instruções

1. Defina bloqueante, não bloqueante, multiplexado e assíncrono, com exemplos de system calls ou APIs.
2. Explique a diferença entre notificação de prontidão e de conclusão.
3. Explique como o Netty funciona no Linux (event loop, `epoll`, threads) e em que sentido sua API é "assíncrona".
4. Explique o que acontece por baixo quando uma virtual thread faz I/O de socket e I/O de arquivo.
5. Responda à pergunta final com critérios: quando virtual threads bastam e quando um modelo reativo ainda faz sentido.

### Dicas

- Em `epoll`, quem copia os dados do kernel para o seu buffer é você, num `read` feito depois do aviso.
- No `io_uring` ou no IOCP, você entrega o buffer antes e recebe a notificação depois que ele foi preenchido.
- Um event loop não pode bloquear: o que acontece se um handler do Netty chamar JDBC?
- Pinning e o pool de conexões do banco limitam o ganho das virtual threads.

### Critérios de avaliação

- Define corretamente os quatro modelos e associa cada um a mecanismos concretos (`O_NONBLOCK`/`EAGAIN`, `epoll`, `io_uring`/IOCP).
- Explica que não bloqueante + multiplexação notifica prontidão, enquanto assíncrono notifica conclusão.
- Descreve o Netty como event loop sobre `epoll` (NIO ou transporte nativo), com poucas threads e API baseada em futures/callbacks, e a regra de nunca bloquear o event loop.
- Explica o desmonte da virtual thread em I/O de socket (poller interno do JDK) e o bloqueio da carrier com compensação em I/O de arquivo, além do pinning.
- Conclui com critérios equilibrados (virtual threads para código bloqueante e alta concorrência; reativo para streaming, backpressure, ou quando o ecossistema já é reativo) e cita gargalos reais como o pool de conexões.

### Solução de referência

**Os modelos.** No I/O **bloqueante**, `read` só retorna quando há dados: a thread dorme dentro do kernel. No **não bloqueante**, o descritor tem `O_NONBLOCK` e `read` sem dados retorna na hora com `EAGAIN`; sozinho isso levaria a ficar tentando em laço. Por isso vem acompanhado de **multiplexação**: `epoll_wait` dorme até que algum de milhares de descritores esteja pronto e diz quais. No I/O **assíncrono**, a aplicação submete a operação com o buffer (`io_uring`, IOCP do Windows) e recebe uma notificação quando a operação **terminou**.

**Prontidão vs. conclusão.** `epoll` diz "agora um `read` não vai bloquear"; a aplicação ainda faz o `read` e a cópia. `io_uring`/IOCP dizem "os dados já estão no seu buffer". Não bloqueante é sobre a chamada não esperar; assíncrono é sobre a operação acontecer em segundo plano e ser concluída por outro agente.

**Netty.** No Linux, o Netty usa NIO (`Selector` sobre `epoll`) ou seu transporte nativo `epoll` (edge-triggered), e há transporte experimental com `io_uring`. Um `EventLoopGroup` tem poucas threads (tipicamente 2 × núcleos), cada uma com seu próprio `epoll` e responsável por muitos canais. Tecnicamente é I/O não bloqueante multiplexado; a **API** é assíncrona (`ChannelFuture`, callbacks no pipeline), porque o resultado de `write` chega depois. A regra de ouro: nunca bloquear um event loop. Um handler que chama JDBC bloqueante trava todas as conexões daquele loop; é preciso despachar para outro executor.

**Virtual threads.** Com I/O de socket, quando a virtual thread faria um `read` sem dados, o JDK usa o socket em modo não bloqueante, registra o descritor num *poller* interno (sobre `epoll`/`kqueue`/equivalente) e desmonta a virtual thread da carrier. Ou seja: o JDK faz por baixo o que o Netty faz, mas preserva o código sequencial e o stack trace. Com I/O de arquivo não há prontidão útil, então a chamada bloqueia a carrier e o escalonador compensa adicionando carriers temporariamente. No JDK 21, bloquear dentro de `synchronized` ou de código nativo causa **pinning** (a carrier fica presa), resolvido para `synchronized` no JDK 24.

**Ainda preciso de WebFlux/Netty?** Para o caso mais comum, um serviço request/response que chama banco e outros serviços, virtual threads com Spring MVC e JDBC atingem concorrência semelhante com código bem mais simples. Mas o gargalo se move: se o pool do banco tem 20 conexões, 10.000 virtual threads vão fazer fila no pool. Um modelo reativo continua fazendo sentido para streaming com backpressure (SSE, WebSockets com fluxos contínuos), para gateways e proxies em que o custo por conexão importa muito (o próprio Spring Cloud Gateway roda sobre Netty), quando o ecossistema já é reativo de ponta a ponta (R2DBC, clientes reativos), ou quando bibliotecas com pinning pesado no JDK 21 impedem o ganho. Resposta curta: virtual threads tornam o modelo bloqueante escalável; o reativo deixa de ser necessário por desempenho na maioria dos casos, mas continua útil pelo modelo de fluxo.

## Implementar um servidor echo TCP com Java NIO Selector e comparar com a versão thread-per-connection sob carga

```meta
{"type": "project", "level": 4, "required": false, "knowledge": ["Selector", "SocketChannel", "ByteBuffer", "epoll", "Thread-per-connection", "Virtual threads", "Backpressure", "Latência p99"]}
```

### Enunciado

Implemente três versões de um servidor echo TCP (que devolve ao cliente exatamente os bytes recebidos): (1) NIO com um único `Selector` e uma única thread; (2) thread-per-connection com threads de plataforma; (3) thread-per-connection com virtual threads. Implemente também um gerador de carga que abre N conexões simultâneas, envia M mensagens por conexão e mede throughput e latência. Compare as versões com 100, 1.000 e 5.000 conexões.

### Objetivo

Construir na prática um servidor que atende muitas conexões sem uma thread por conexão, entender os detalhes de um event loop (escrita parcial, interesse em `OP_WRITE`, fechamento) e comparar os modelos com dados.

### Instruções

1. Versão NIO: `ServerSocketChannel` não bloqueante registrado com `OP_ACCEPT`; cada `SocketChannel` aceito registrado com `OP_READ` e um `ByteBuffer` como attachment.
2. Trate escrita parcial: se `write` não enviar tudo, registre interesse em `OP_WRITE` e pare de ler daquela conexão até esvaziar o buffer (backpressure). Volte para `OP_READ` quando o buffer esvaziar.
3. Trate `read` retornando `-1` (cliente fechou) e exceções de I/O, cancelando a chave e fechando o canal.
4. Versão bloqueante: `ServerSocket` + um `Runnable` por conexão, executado por `Executors.newCachedThreadPool()` ou `Executors.newVirtualThreadPerTaskExecutor()` conforme argumento.
5. Gerador de carga: N conexões, cada uma envia M mensagens de 64 bytes e espera o eco completo antes da próxima; registre a latência de cada mensagem.
6. Meça para cada servidor e N ∈ {100, 1.000, 5.000}: throughput (mensagens/s), p50, p99 e número de threads do servidor (`jcmd <pid> Thread.print | grep -c '^"'`, ou JConsole/VisualVM).
7. Para 5.000 conexões, talvez seja preciso aumentar o limite de descritores (`ulimit -n 65535` no Linux). Rode cliente e servidor na mesma máquina, ciente de que eles disputam CPU.
8. Escreva uma análise dos resultados.

### Dicas

- Sempre remova a chave do conjunto `selectedKeys()` depois de processá-la, ou ela será reprocessada.
- O ciclo `flip()` → `write()` → `compact()` mantém no buffer só os bytes ainda não enviados.
- Nunca deixe `OP_WRITE` registrado sem dados pendentes: o socket quase sempre está pronto para escrita e o `select` vira um laço ocupado.
- Para o gerador de carga, virtual threads são uma forma simples de abrir milhares de conexões bloqueantes.

### Critérios de avaliação

- O servidor NIO atende várias conexões com uma única thread, sem perder nem corromper bytes.
- Trata escrita parcial com `OP_WRITE`, alternando os interesses corretamente.
- Fecha conexões de forma limpa em EOF e em erro, sem derrubar o servidor.
- As versões bloqueantes funcionam com threads de plataforma e virtual threads.
- O gerador mede throughput, p50 e p99 e verifica o eco.
- A análise compara os três modelos em throughput, latência, número de threads e memória, e explica as diferenças pelo modelo de I/O.

### Solução de referência

**Servidor NIO:**

```java
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.StandardSocketOptions;
import java.nio.ByteBuffer;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.util.Iterator;

public class EchoNio {
    public static void main(String[] args) throws IOException {
        int porta = args.length > 0 ? Integer.parseInt(args[0]) : 9000;
        try (Selector selector = Selector.open();
             ServerSocketChannel server = ServerSocketChannel.open()) {
            server.bind(new InetSocketAddress(porta), 4096);
            server.configureBlocking(false);
            server.register(selector, SelectionKey.OP_ACCEPT);
            System.out.println("Echo NIO na porta " + porta);

            while (true) {
                selector.select();                       // epoll_wait no Linux
                Iterator<SelectionKey> it = selector.selectedKeys().iterator();
                while (it.hasNext()) {
                    SelectionKey key = it.next();
                    it.remove();
                    try {
                        if (!key.isValid()) continue;
                        if (key.isAcceptable()) aceitar(selector, server);
                        else if (key.isReadable()) ler(key);
                        else if (key.isWritable()) enviarPendentes(key);
                    } catch (IOException e) {
                        fechar(key);
                    }
                }
            }
        }
    }

    private static void aceitar(Selector selector, ServerSocketChannel server) throws IOException {
        SocketChannel cliente;
        while ((cliente = server.accept()) != null) {    // aceita todas as conexões pendentes
            cliente.configureBlocking(false);
            cliente.setOption(StandardSocketOptions.TCP_NODELAY, true);
            cliente.register(selector, SelectionKey.OP_READ, ByteBuffer.allocateDirect(8192));
        }
    }

    private static void ler(SelectionKey key) throws IOException {
        SocketChannel canal = (SocketChannel) key.channel();
        ByteBuffer buf = (ByteBuffer) key.attachment();  // em modo de escrita (preenchendo)
        if (canal.read(buf) == -1) {
            fechar(key);
            return;
        }
        enviarPendentes(key);
    }

    private static void enviarPendentes(SelectionKey key) throws IOException {
        SocketChannel canal = (SocketChannel) key.channel();
        ByteBuffer buf = (ByteBuffer) key.attachment();
        buf.flip();                 // prepara para ler o que foi recebido
        canal.write(buf);           // pode escrever só parte
        buf.compact();              // mantém o resto no início, volta ao modo de preenchimento
        // Se sobrou algo, para de ler e espera o socket aceitar mais dados (backpressure).
        key.interestOps(buf.position() > 0 ? SelectionKey.OP_WRITE : SelectionKey.OP_READ);
    }

    private static void fechar(SelectionKey key) {
        key.cancel();
        try {
            key.channel().close();
        } catch (IOException ignored) {
        }
    }
}
```

**Servidor bloqueante (plataforma ou virtual):**

```java
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class EchoBloqueante {
    public static void main(String[] args) throws IOException {
        int porta = args.length > 0 ? Integer.parseInt(args[0]) : 9001;
        boolean virtual = args.length > 1 && args[1].equals("virtual");
        ExecutorService exec = virtual
                ? Executors.newVirtualThreadPerTaskExecutor()
                : Executors.newCachedThreadPool();        // uma thread de plataforma por conexão
        System.out.println("Echo bloqueante (" + (virtual ? "virtual" : "plataforma") + ") na porta " + porta);
        try (ServerSocket server = new ServerSocket(porta, 4096)) {
            while (true) {
                Socket s = server.accept();
                exec.execute(() -> atender(s));
            }
        }
    }

    static void atender(Socket s) {
        try (s; InputStream in = s.getInputStream(); OutputStream out = s.getOutputStream()) {
            s.setTcpNoDelay(true);
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) {            // bloqueia (ou desmonta, se virtual)
                out.write(buf, 0, n);
            }
        } catch (IOException ignored) {
        }
    }
}
```

**Gerador de carga:**

```java
import java.io.EOFException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class CargaEcho {
    public static void main(String[] args) throws Exception {
        int porta = Integer.parseInt(args[0]);
        int conexoes = Integer.parseInt(args[1]);
        int mensagens = Integer.parseInt(args[2]);
        byte[] msg = new byte[64];
        Arrays.fill(msg, (byte) 'x');
        long[][] latencias = new long[conexoes][];
        AtomicInteger falhas = new AtomicInteger();

        long inicio = System.nanoTime();
        try (ExecutorService exec = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int c = 0; c < conexoes; c++) {
                final int id = c;
                exec.submit(() -> {
                    long[] lat = new long[mensagens];
                    try (Socket s = new Socket("localhost", porta)) {
                        s.setTcpNoDelay(true);
                        InputStream in = s.getInputStream();
                        OutputStream out = s.getOutputStream();
                        byte[] resp = new byte[msg.length];
                        for (int i = 0; i < mensagens; i++) {
                            long t0 = System.nanoTime();
                            out.write(msg);
                            int lidos = 0;
                            while (lidos < resp.length) {
                                int n = in.read(resp, lidos, resp.length - lidos);
                                if (n == -1) throw new EOFException("servidor fechou");
                                lidos += n;
                            }
                            if (!Arrays.equals(msg, resp)) throw new IllegalStateException("eco incorreto");
                            lat[i] = System.nanoTime() - t0;
                        }
                        latencias[id] = lat;
                    } catch (Exception e) {
                        falhas.incrementAndGet();
                    }
                });
            }
        }   // close() espera todas as tarefas terminarem
        double segundos = (System.nanoTime() - inicio) / 1e9;

        long[] todas = Arrays.stream(latencias)
                .filter(a -> a != null)
                .flatMapToLong(Arrays::stream)
                .sorted()
                .toArray();
        if (todas.length == 0) {
            System.out.println("nenhuma conexão concluiu; falhas=" + falhas.get());
            return;
        }
        System.out.printf("conexões=%d falhas=%d mensagens=%d throughput=%.0f msg/s p50=%d µs p99=%d µs%n",
                conexoes, falhas.get(), todas.length, todas.length / segundos,
                todas[todas.length / 2] / 1000, todas[(int) (todas.length * 0.99)] / 1000);
    }
}
```

Execução: `java EchoNio.java 9000`, `java EchoBloqueante.java 9001`, `java EchoBloqueante.java 9002 virtual` e, para cada um, `java CargaEcho.java <porta> 1000 200`.

Resultados ilustrativos (8 núcleos, cliente e servidor na mesma máquina, JDK 21; variam muito):

| Servidor | Conexões | Throughput | p50 | p99 | Threads do servidor |
|---|---|---|---|---|---|
| NIO (1 thread) | 100 | ~90 mil msg/s | ~1,0 ms | ~2,5 ms | ~15 |
| NIO (1 thread) | 5.000 | ~85 mil msg/s | ~55 ms | ~90 ms | ~15 |
| Plataforma | 100 | ~120 mil msg/s | ~0,7 ms | ~2 ms | ~115 |
| Plataforma | 5.000 | ~70 mil msg/s | ~60 ms | ~250 ms | ~5.015 |
| Virtual | 100 | ~115 mil msg/s | ~0,8 ms | ~2 ms | ~25 |
| Virtual | 5.000 | ~110 mil msg/s | ~40 ms | ~80 ms | ~25 |

Análise:

- **Com poucas conexões**, thread-per-connection é tão bom quanto ou melhor que o NIO de uma thread: usa vários núcleos, e 100 threads são baratas. O NIO com uma única thread está limitado a um núcleo; servidores reais (Netty) usam um event loop por núcleo.
- **Com 5.000 conexões**, a versão com threads de plataforma cria ~5.000 threads de SO: ~5 GB de stack reservada, mais trocas de contexto e mais pressão no escalonador, o que aparece no p99. O NIO mantém o número de threads constante; o p50 cresce porque uma thread processa tudo em sequência, mas o throughput se mantém.
- **Virtual threads** mantêm o código bloqueante simples e o número de threads de SO pequeno (as carriers, ~1 por núcleo). Por baixo, os sockets são não bloqueantes e registrados no poller do JDK, o mesmo princípio do `Selector`, mas com o escalonamento espalhado por todos os núcleos.
- **Detalhes do event loop** que a versão NIO precisa tratar e a bloqueante não: escrita parcial com `OP_WRITE`, backpressure (parar de ler quando não consegue escrever), remoção das chaves selecionadas, e a proibição de qualquer chamada bloqueante dentro do loop.
- **Cuidados de medição**: cliente e servidor competem pela CPU; o gerador com virtual threads tem seu próprio custo; latências de loopback não incluem a rede real. Em um teste sério, cliente e servidor ficam em máquinas diferentes e as medições se repetem várias vezes.

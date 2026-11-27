## Por que I/O domina a latência em backend

Um serviço backend típico recebe uma requisição pela rede, consulta um banco, talvez chame outro serviço e um cache, grava um log e responde. A CPU gasta microssegundos com a lógica de negócio; o resto do tempo é **espera por I/O**. A tabela abaixo mostra por quê (ordens de grandeza ilustrativas; variam muito por hardware e rede):

| Operação | Tempo aproximado |
|---|---|
| Acesso ao cache L1 | ~1 ns |
| Acesso à RAM | ~100 ns |
| System call simples | ~100 ns – 1 µs |
| Troca de contexto entre threads | ~1–5 µs (mais o efeito nos caches) |
| Leitura aleatória de 4 KiB em SSD NVMe | ~20–100 µs |
| Ida e volta na mesma zona de datacenter | ~100–500 µs |
| `fsync` em SSD de consumo | ~0,5–10 ms |
| Seek em disco rotativo | ~5–10 ms |
| Ida e volta entre continentes | ~100–200 ms |

Uma única ida ao banco custa o equivalente a centenas de milhares de acessos à RAM. Por isso o desempenho de um backend depende menos de "código rápido" e mais de **quantas operações de I/O são feitas, em série ou em paralelo, e o que as threads fazem enquanto esperam**. Este tópico explica o caminho de uma operação de I/O pelo sistema operacional e os modelos de programação construídos sobre ele.

## Dispositivos, drivers, interrupções e DMA

A CPU não fala diretamente com o disco ou com a placa de rede. Cada dispositivo tem um **controlador** com registradores e filas próprias, e o kernel tem um **driver** que sabe programá-lo. Um processo só faz I/O por meio de **system calls** (tópico 1.2.1): `read`, `write`, `send`, `recv`, `open`.

Duas perguntas definem o desempenho: **como a CPU sabe que o dispositivo terminou** e **quem copia os dados**.

**Polling vs. interrupções.** Em *polling*, a CPU consulta repetidamente um registrador de status, o que desperdiça ciclos se o dispositivo for lento. Com **interrupções**, o dispositivo sinaliza a CPU quando termina; a CPU suspende o que está fazendo e executa o *interrupt handler* do driver. Interrupções têm custo próprio, e sob tráfego altíssimo (milhões de pacotes por segundo) elas se tornam o gargalo. Por isso o Linux usa o **NAPI** na rede: após a primeira interrupção, o driver passa a fazer polling enquanto houver pacotes, voltando às interrupções quando a fila esvazia. Placas de rede também agrupam interrupções (*interrupt coalescing*).

**DMA** (*direct memory access*). Sem DMA, a CPU copiaria cada byte do dispositivo para a memória. Com DMA, o driver entrega ao controlador o endereço físico de um buffer e o tamanho, e o **próprio dispositivo transfere os dados para a RAM**, avisando com uma interrupção no fim. A CPU fica livre durante a transferência. Discos NVMe e placas de rede modernas trabalham com filas de descritores em memória, que o dispositivo consome e preenche por DMA.

Enquanto o dispositivo trabalha, a thread que pediu o I/O **não precisa ocupar a CPU**: o kernel a coloca para dormir numa fila de espera e escala outra thread. Quando a interrupção chega, o kernel marca a thread como pronta. Esse é o mecanismo por trás de toda chamada bloqueante.

## Diagrama: O caminho de um read() de arquivo

```text
 user space          read(fd, buf, 4096)                       buf ◄─────────────┐
 ─────────────────────────│─────────────────────────────────────────────────────│── cópia 2 (CPU)
 kernel space             ▼                                                     │
                   VFS → sistema de arquivos (ext4, xfs)                        │
                          │ página está no page cache?                         │
                          ├── sim (cache hit) ──────────────────► página ───────┘
                          │                                          ▲
                          └── não (cache miss)                       │
                                 │                                   │
                           block layer: monta a requisição           │
                           (bio), agenda, faz readahead              │
                                 │                                   │
                           driver NVMe: escreve descritor            │
                           na fila do dispositivo                    │
                                 │        thread dorme               │
 ─────────────────────────────────│───────────────────────────────────│────────────
 hardware                         ▼                                   │
                           controlador do SSD lê a flash ── DMA ──────┘  cópia 1 (DMA)
                                 │                                      para o page cache
                           interrupção → kernel acorda a thread
```

Num **cache hit**, o `read` custa uma system call e uma cópia de memória: microssegundos ou menos. Num **cache miss**, a thread dorme até o dispositivo terminar: dezenas de microssegundos num NVMe, milissegundos num HDD. É por isso que a segunda leitura de um arquivo costuma ser muito mais rápida que a primeira.

## Buffers do kernel e page cache

O **page cache** é a memória que o kernel usa para guardar páginas de arquivos. Ele ocupa toda a RAM que os processos não estão usando, e é por isso que o `free` mostra pouca memória "livre" e muita em "buff/cache": essa memória é recuperável sob demanda.

**Leitura.** O kernel procura as páginas no page cache; se faltarem, lê do dispositivo para o cache e então copia para o buffer do processo. Ao detectar leitura sequencial, ele faz **readahead**: busca as próximas páginas antes de serem pedidas, transformando muitas leituras pequenas em poucas grandes.

**Escrita.** `write` copia os dados do processo para páginas do page cache, marca-as como **sujas** (*dirty*) e **retorna imediatamente**. O dado ainda não está no disco. Threads do kernel gravam as páginas sujas depois (*writeback*), quando elas envelhecem (no Linux, `vm.dirty_expire_centisecs`, 30 s por padrão) ou quando há páginas sujas demais (`vm.dirty_background_ratio`, `vm.dirty_ratio`). Se um processo escreve mais rápido do que o disco aguenta, o kernel passa a bloqueá-lo no próprio `write`.

**Buffers em user space.** Cada system call tem um custo fixo (troca para modo kernel, validação, mitigações de segurança). Ler um arquivo de 1 GB com `read` de 1 byte significa um bilhão de system calls. Bibliotecas resolvem isso com buffers no próprio processo: `BufferedInputStream` (8 KiB por padrão) faz uma system call para encher o buffer e serve as próximas leituras da memória. O custo é **mais uma cópia** e o cuidado com `flush()` na escrita.

**Contando cópias.** Ler um arquivo com `FileInputStream.read(byte[])` em Java envolve: DMA do dispositivo para o page cache, cópia do page cache para um buffer nativo da JVM, e cópia desse buffer para o `byte[]` no heap (porque o GC pode mover o array, a JVM não entrega o endereço dele ao kernel). Com NIO e um `ByteBuffer.allocateDirect`, o buffer já está fora do heap e uma dessas cópias desaparece. Bancos de dados que gerenciam o próprio cache usam `O_DIRECT` para pular o page cache por completo.

## Durabilidade: fsync e o que "write retornou" significa

Um `write` bem-sucedido garante apenas que o kernel aceitou os dados. Se a máquina perder energia antes do writeback, eles se perdem. Para **durabilidade**, é preciso pedir explicitamente:

- `fsync(fd)`: grava as páginas sujas do arquivo **e** seus metadados e espera o dispositivo confirmar. O kernel também envia um comando de *flush* para esvaziar o cache volátil interno do disco.
- `fdatasync(fd)`: igual, mas pula metadados que não afetam a leitura dos dados (como o horário de modificação). Mais barato.
- `O_SYNC` / `O_DSYNC` na abertura: cada `write` se comporta como `write` + `fsync`/`fdatasync`.

Sutilezas que causam perda de dados em produção:

- **Arquivo novo**: o `fsync` do arquivo não garante que a **entrada no diretório** esteja durável. É preciso também fazer `fsync` no diretório. O padrão seguro para substituir um arquivo é: escrever num temporário, `fsync` do temporário, `rename` atômico sobre o original, `fsync` do diretório.
- **Erros de fsync**: em 2018 descobriu-se que, no Linux, um `fsync` que falha pode marcar as páginas como limpas e "esquecer" o erro; tentar de novo retorna sucesso sem que os dados tenham sido gravados. O PostgreSQL passou a tratar falha de `fsync` como fatal (*fsyncgate*).
- **Hardware que mente**: discos de consumo sem proteção contra queda de energia podem confirmar o flush antes de gravar. SSDs de datacenter têm capacitores para isso.

`fsync` é caro (de centenas de microssegundos a milissegundos). Bancos de dados amortizam o custo com **WAL** (*write-ahead log*: grava sequencialmente num log e sincroniza só o log) e **group commit** (um único `fsync` confirma as transações de várias conexões).

Em Java: `FileChannel.force(true)` equivale a `fsync` e `force(false)` a `fdatasync`; `FileOutputStream.getFD().sync()` também faz `fsync`; `StandardOpenOption.SYNC` e `DSYNC` correspondem a `O_SYNC` e `O_DSYNC`. Para o diretório, `FileChannel.open(dir, READ).force(true)` funciona no Linux (no Windows, abrir diretório assim lança exceção).

## Modelos de I/O: bloqueante, não bloqueante, multiplexado e assíncrono

A diferença entre os modelos está em **o que a thread faz enquanto o dado não chegou** e **quem avisa quando chegou**.

| Modelo | Como funciona | Quem espera |
|---|---|---|
| **Bloqueante** | `read` só retorna quando há dados (ou EOF/erro) | A thread dorme dentro da system call |
| **Não bloqueante** | Com `O_NONBLOCK`, `read` sem dados retorna na hora com `EAGAIN` | Ninguém; a aplicação precisa tentar de novo |
| **Multiplexado** | `select`/`poll`/`epoll` esperam *vários* descritores e dizem quais estão **prontos** | Uma thread espera por milhares de conexões |
| **Assíncrono** | A aplicação submete a operação e é avisada quando ela **terminou**, com os dados já no buffer | O kernel executa; a aplicação recebe a conclusão |

A distinção mais cobrada em entrevistas é **não bloqueante ≠ assíncrono**. No modelo multiplexado com sockets não bloqueantes, o kernel avisa *prontidão* ("agora um `read` não vai bloquear") e a aplicação ainda faz a cópia com `read`. No modelo assíncrono (Windows IOCP, Linux `io_uring`, POSIX AIO), o kernel avisa *conclusão* ("os 4 KiB já estão no seu buffer").

Um detalhe importante: arquivos regulares estão **sempre "prontos"** para `select`/`epoll`, mesmo que a leitura vá ao disco. Multiplexação de prontidão não ajuda com disco. Por isso servidores baseados em event loop fazem I/O de arquivo em pools de threads, e por isso o `io_uring` foi criado: ele oferece I/O realmente assíncrono para arquivos e sockets, através de filas compartilhadas entre processo e kernel que também reduzem o número de system calls.

## select, poll e epoll

Os três resolvem o mesmo problema: "espere até que **algum** destes descritores esteja pronto".

- **`select`**: recebe bitmaps de descritores (limitados a `FD_SETSIZE`, normalmente 1.024). A cada chamada, o processo copia os bitmaps para o kernel, que verifica **todos** os descritores, e a aplicação percorre todos para descobrir quais ficaram prontos. Custo O(n) por chamada.
- **`poll`**: troca o bitmap por um array de `struct pollfd`, sem o limite de 1.024, mas mantém o custo O(n) por chamada.
- **`epoll`** (Linux): separa **registro** de **espera**. `epoll_create` cria uma instância no kernel; `epoll_ctl` adiciona ou remove descritores uma única vez; `epoll_wait` devolve **só os prontos**. Internamente, cada descritor registrado tem um *callback* na fila de espera do socket; quando chega um pacote, o callback coloca o descritor numa lista de prontos. O custo de `epoll_wait` é proporcional ao número de eventos, não ao de conexões.

`epoll` tem dois modos. **Level-triggered** (padrão): enquanto houver dados no socket, ele continua sendo reportado como pronto. **Edge-triggered** (`EPOLLET`): só reporta a *transição* para pronto; a aplicação precisa ler até `EAGAIN`, senão perde o aviso. Edge-triggered gera menos eventos, mas é mais fácil de usar errado.

Equivalentes em outros sistemas: `kqueue` no BSD e no macOS; IOCP no Windows (que é de conclusão, não de prontidão).

Com `epoll`, um servidor atende 10.000 ou 100.000 conexões ociosas com uma única thread: o famoso **problema C10K** resolvido por Nginx, Node.js, Redis e Netty.

## Zero-copy: sendfile e transferTo

Servir um arquivo pela rede com `read` + `write` custa:

```text
 disco ──DMA──► page cache ──CPU──► buffer do processo ──CPU──► buffer do socket ──DMA──► placa de rede
              (cópia 1)          (cópia 2)                   (cópia 3)                (cópia 4)
 + 2 system calls (4 transições user/kernel) por bloco
```

As cópias 2 e 3 só existem para os bytes passarem por um processo que **não os modifica**. A system call `sendfile(out_fd, in_fd, offset, count)` move dados de um arquivo para um socket **dentro do kernel**: uma system call, nenhuma cópia para user space. Com placas de rede que suportam *scatter-gather DMA*, até a cópia do page cache para o buffer do socket vira apenas a passagem de descritores, e os dados vão por DMA direto do page cache para a placa.

Em Java, `FileChannel.transferTo(posição, quantidade, canalDestino)` usa `sendfile` no Linux quando o destino é um socket. O exemplo mais famoso é o **Kafka**: consumidores leem segmentos de log que estão no page cache, e o broker os envia com `transferTo`, sem trazer as mensagens para o heap. Limitação: zero-copy só funciona quando o processo não precisa tocar nos bytes. Com TLS, os dados precisam ser criptografados em user space (a menos que se use kTLS, a criptografia TLS no kernel), e a vantagem desaparece em boa parte.

## Exemplo: java.io, NIO e FileChannel

```java
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import static java.nio.file.StandardOpenOption.*;

public class ModosDeIO {
    // java.io: stream bloqueante, um byte[] no heap, buffer em user space
    static long copiarComStreams(Path origem, Path destino) throws IOException {
        try (InputStream in = new BufferedInputStream(Files.newInputStream(origem));
             OutputStream out = new BufferedOutputStream(Files.newOutputStream(destino))) {
            return in.transferTo(out);
        }
    }

    // NIO: canal + direct buffer (fora do heap, uma cópia a menos)
    static void gravarDuravel(Path arquivo, byte[] dados) throws IOException {
        try (FileChannel ch = FileChannel.open(arquivo, CREATE, WRITE, TRUNCATE_EXISTING)) {
            ByteBuffer buf = ByteBuffer.allocateDirect(dados.length);
            buf.put(dados).flip();
            while (buf.hasRemaining()) ch.write(buf);   // write pode ser parcial
            ch.force(true);                             // fsync: só agora está durável
        }
    }

    // zero-copy: sendfile/copy no kernel quando o SO suporta
    static void copiarZeroCopy(Path origem, Path destino) throws IOException {
        try (FileChannel in = FileChannel.open(origem, READ);
             FileChannel out = FileChannel.open(destino, CREATE, WRITE, TRUNCATE_EXISTING)) {
            long pos = 0, tamanho = in.size();
            while (pos < tamanho) pos += in.transferTo(pos, tamanho - pos, out); // pode transferir menos
        }
    }
}
```

O pacote `java.io`, assim como os sockets clássicos de `java.net` (tópico 3.1.6), é **bloqueante e orientado a streams**: cada `read` ocupa a thread até haver dados. O NIO (Java 1.4) trouxe **buffers** (`ByteBuffer`, inclusive direct), **canais** (`FileChannel`, `SocketChannel`) e o **`Selector`**, que no Linux é implementado sobre `epoll` (no macOS, `kqueue`). Um `SocketChannel` em modo não bloqueante registrado num `Selector` é exatamente o modelo multiplexado descrito acima, e é a base do Netty.

O NIO.2 (Java 7) acrescentou `AsynchronousSocketChannel` e `AsynchronousFileChannel`. No Windows, eles usam IOCP; no Linux, o canal de socket é implementado com `epoll` mais threads internas, e o de arquivo, com um pool de threads fazendo I/O bloqueante. A API é assíncrona; a implementação nem sempre é.

## Virtual threads e I/O bloqueante

O modelo **thread-per-request** com I/O bloqueante é o mais simples de escrever, depurar e ler: o código é sequencial e o stack trace conta a história. Seu problema é o custo de cada thread de plataforma: ~1 MiB de stack reservada, estruturas no kernel e trocas de contexto. Com 10.000 requisições esperando o banco ao mesmo tempo, são 10.000 threads de SO dormindo. A alternativa clássica, event loop com `epoll` (Netty, WebFlux), escala muito melhor, mas obriga a escrever código assíncrono, com callbacks ou programação reativa.

As **virtual threads** do Java 21 (tópico 4.4.11) combinam os dois mundos. O código continua bloqueante, mas, por baixo:

- **Sockets**: quando uma virtual thread faz `read` num socket sem dados, o JDK coloca o socket em modo não bloqueante, registra o descritor num *poller* interno (baseado em `epoll`, `kqueue` ou equivalente) e **desmonta** a virtual thread da thread de plataforma (*carrier*). A carrier fica livre para executar outra virtual thread. Quando o poller avisa que o socket está pronto, a virtual thread é remontada e o `read` continua. Milhares de conexões esperando custam só objetos no heap.
- **Arquivos**: como `epoll` não ajuda com arquivos regulares, o I/O de arquivo **bloqueia a carrier**. O JDK compensa adicionando temporariamente uma carrier extra ao pool do escalonador, para que as demais virtual threads continuem andando.
- **Pinning**: no JDK 21, bloquear dentro de um bloco `synchronized` (ou em código nativo) prende a virtual thread à carrier, impedindo o desmonte. Isso foi resolvido para `synchronized` no JDK 24 (JEP 491); em versões anteriores, prefira `ReentrantLock` em trechos que fazem I/O.

Virtual threads não tornam o I/O mais rápido: a latência de uma consulta ao banco continua a mesma. Elas aumentam o **número de operações de I/O simultâneas** que uma JVM sustenta sem mudar o estilo do código. O limite passa a ser outro recurso: conexões do pool do banco, descritores de arquivo, ou o próprio serviço chamado.

## Custos, limitações e uso em sistemas reais

- **Custo por operação**: cada system call tem custo fixo, e cada cópia consome banda de memória e cache. Buffers bem dimensionados (de 8 KiB a algumas centenas de KiB) amortizam o primeiro; direct buffers e zero-copy reduzem o segundo.
- **Page cache é um aliado e um risco**: acelera leituras repetidas de graça, mas mascara a latência real do disco em benchmarks (sempre diferencie cache frio de quente) e conta no limite de memória de containers (é recuperável, mas sob pressão gera writeback e latência).
- **Durabilidade custa latência**: cada `fsync` adiciona de centenas de microssegundos a milissegundos. Sistemas sérios agrupam (*group commit*) e documentam a janela de perda aceitável (por exemplo, `appendfsync everysec` no Redis, ou `acks` e replicação no Kafka).
- **Modelo de servidor**: thread-per-request bloqueante (simples, limitado pelo número de threads), event loop com `epoll` (escala, mas o código é assíncrono e não pode bloquear o loop), virtual threads (escala com código bloqueante, mas atenção a pinning e a I/O de arquivo).
- **Sistemas reais**: Nginx, Redis e Netty usam event loops sobre `epoll`; Kafka usa page cache e `sendfile`; PostgreSQL usa WAL, `fsync` e group commit; Tomcat e Jetty podem rodar com virtual threads a partir do Java 21. Em todos, o desenho começa pela mesma pergunta: **o que a thread faz enquanto espera o I/O?**

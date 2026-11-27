## Explicar com um diagrama como dois processos usam o mesmo endereço virtual apontando para frames físicos diferentes

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Endereço virtual", "MMU", "Tabela de páginas", "Frame físico", "Isolamento"]}
```

### Enunciado

Dois processos, A e B, executam o mesmo programa. Ambos imprimem o endereço de uma variável global `contador` e o resultado é o mesmo: `0x55d4a3c04010`. O processo A incrementa `contador` até 1.000; o processo B imprime `contador` e vê 0.

1. Desenhe um diagrama (ASCII ou à mão) mostrando os dois espaços virtuais, as tabelas de páginas e a memória física, explicando como isso é possível.
2. No mesmo diagrama, represente uma biblioteca compartilhada (`libc`) usada pelos dois processos. Quantas cópias dela existem na RAM?
3. Explique quem cria o mapeamento, quem o aplica em cada acesso e o que acontece se A tentar acessar um endereço que não está mapeado.
4. Explique por que B não consegue, de forma alguma, ler a memória privada de A, mesmo conhecendo o endereço exato.

### Objetivo

Entender a memória virtual como um mapeamento por processo e saber explicar, com precisão, como ela garante isolamento e permite compartilhamento.

### Instruções

1. Represente as páginas virtuais de A e de B com seus endereços.
2. Represente as tabelas de páginas de cada processo como setas de página virtual para frame físico.
3. Mostre os frames físicos com o que cada um contém.
4. Indique as permissões das páginas (por exemplo, `rw-` para dados, `r-x` para código).
5. Responda os itens 3 e 4 em texto.

### Dicas

- Um endereço virtual só tem significado junto com a tabela de páginas de um processo.
- A página de dados de cada processo aponta para um frame diferente; a página de código da `libc` pode apontar para o mesmo frame nos dois.
- Quem pode alterar as tabelas de páginas? Em que modo da CPU isso acontece?

### Critérios de avaliação

- O diagrama mostra o mesmo endereço virtual mapeado para frames físicos diferentes em A e B.
- Mostra a `libc` mapeada nos dois processos para os mesmos frames, somente leitura e execução, com uma única cópia na RAM.
- Explica que o SO (kernel) cria e mantém as tabelas e que a MMU traduz cada acesso em hardware, usando a TLB como cache.
- Explica que um acesso a endereço não mapeado gera page fault e, se ilegal, `SIGSEGV`.
- Explica que B não tem nenhuma entrada em sua tabela que aponte para os frames privados de A e não pode alterar suas tabelas, pois isso exige modo kernel.

### Solução de referência

```text
 Processo A                    RAM física                    Processo B
 ┌──────────────────────┐    ┌──────────────┐    ┌──────────────────────┐
 │ 0x55d4a3c04000 (rw-) │───▶│ frame 812    │    │ 0x55d4a3c04000 (rw-) │
 │  .data: contador     │    │ contador=1000│ ┌──│  .data: contador     │
 └──────────────────────┘    ├──────────────┤ │  └──────────────────────┘
                             │ frame 305    │◀┘
                             │ contador=0   │
 ┌──────────────────────┐    ├──────────────┤    ┌──────────────────────┐
 │ 0x7f3a12000000 (r-x) │───▶│ frame 77     │◀───│ 0x7f3a12000000 (r-x) │
 │  libc .text          │    │ código libc  │    │  libc .text          │
 └──────────────────────┘    │ (1 cópia)    │    └──────────────────────┘
  tabelas de páginas de A    └──────────────┘     tabelas de páginas de B
  (CR3 = raiz de A quando                         (CR3 = raiz de B quando
   A está rodando)                                 B está rodando)
```

O endereço `0x55d4a3c04010` cai na página virtual `0x55d4a3c04000` com deslocamento `0x10`. Na tabela de A, essa página aponta para o frame 812; na tabela de B, para o frame 305. A MMU forma o endereço físico como "frame + deslocamento", então as duas variáveis ficam em lugares físicos diferentes. (O mesmo endereço virtual em ambos aparece porque o programa é o mesmo e, neste exemplo, foi carregado na mesma base; com ASLR, os endereços normalmente seriam diferentes.)

A página de código da `libc` aponta para o **mesmo** frame 77 nos dois processos. Como ela é somente leitura e execução, compartilhá-la é seguro, e existe **uma única cópia** na RAM, por mais processos que a usem.

**Quem faz o quê.** O kernel cria e mantém as tabelas de páginas de cada processo (ao carregar o programa, em `mmap`, `brk`, `fork`). A MMU, em hardware, traduz cada acesso consultando a TLB e, em caso de miss, percorrendo as tabelas. Se A acessar um endereço sem mapeamento válido, ou violar as permissões (escrever numa página `r-x`), a MMU gera um page fault; o kernel verifica que o acesso é ilegal e envia `SIGSEGV`, encerrando o processo com *segmentation fault*.

**Por que B não lê A.** Todo acesso de B é traduzido pelas tabelas de B, e nenhuma entrada delas aponta para o frame 812. Conhecer o endereço virtual de A é inútil, porque em B ele leva ao frame 305. B também não pode alterar suas tabelas para apontar para o frame 812: as tabelas ficam em memória do kernel e só podem ser modificadas em modo supervisor; o registrador CR3 também só é escrito pelo kernel. O único jeito de compartilhar é pedir ao kernel explicitamente (memória compartilhada, arquivo mapeado), e o kernel aplica as regras de permissão.

## Comparar VSZ e RSS de uma JVM antes e depois de tocar em um array grande alocado

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["VSZ", "RSS", "Heap reservado e comprometido", "Demand paging", "AlwaysPreTouch"]}
```

### Enunciado

Escreva um programa Java que imprime VSZ e RSS do próprio processo em várias etapas: logo ao iniciar, depois de alocar um `byte[]` de 512 MB, depois de escrever em todas as páginas do array e, por fim, depois de mapear (`FileChannel.map`) um arquivo de 512 MB e de ler todas as suas páginas. Rode com diferentes opções de heap e explique cada variação.

### Objetivo

Ver na prática a diferença entre memória virtual reservada e memória residente, e entender como a JVM reserva, compromete e toca o heap.

### Instruções

1. No Linux (ou WSL2/Docker), leia `VmSize`, `VmRSS`, `RssAnon` e `RssFile` de `/proc/self/status`. No Windows nativo, imprima o PID e acompanhe no Gerenciador de Tarefas as colunas "Conjunto de trabalho" e "Tamanho de confirmação", ou rode `Get-Process -Id <pid> | Select-Object WS,PM,VM` em cada pausa.
2. Coloque uma pausa de alguns segundos entre as etapas.
3. Rode com `java -Xms64m -Xmx2g VszRss`.
4. Rode com `java -Xms2g -Xmx2g VszRss`.
5. Rode com `java -Xms2g -Xmx2g -XX:+AlwaysPreTouch VszRss`.
6. Monte uma tabela com VSZ e RSS em cada etapa e configuração e explique as diferenças.

### Dicas

- O VSZ já é grande no início: a JVM reserva o `-Xmx` inteiro e outras regiões na inicialização.
- Em Java, todo array novo é zerado. Zerar é escrever, e escrever toca as páginas. Em que etapa você espera que o RSS do array suba?
- Páginas de um arquivo mapeado aparecem em `RssFile`, não em `RssAnon`: elas pertencem ao page cache.

### Critérios de avaliação

- O programa compila e imprime as métricas em todas as etapas (ou pausa para leitura no Windows).
- Mostra VSZ muito maior que RSS no início e explica pelo heap reservado, class space, code cache e stacks.
- Mostra que o RSS sobe cerca de 512 MB na alocação do array (por causa da zeragem) e quase não muda ao escrever nele de novo.
- Mostra que o mapeamento do arquivo aumenta o VSZ imediatamente, mas o RSS (`RssFile`) só sobe ao ler as páginas.
- Explica o efeito de `-XX:+AlwaysPreTouch`: RSS próximo de 2 GB desde o início e início mais lento.

### Solução de referência

```java
import java.io.RandomAccessFile;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.*;

public class VszRss {
    static final int MB = 1024 * 1024;
    static final int TAMANHO = 512 * MB;

    static void mostrar(String etapa) throws Exception {
        System.out.println("--- " + etapa);
        Path status = Path.of("/proc/self/status");
        if (Files.exists(status)) {
            for (String l : Files.readAllLines(status)) {
                if (l.startsWith("VmSize") || l.startsWith("VmRSS")
                        || l.startsWith("RssAnon") || l.startsWith("RssFile")) {
                    System.out.println("    " + l);
                }
            }
        } else {
            System.out.println("    PID " + ProcessHandle.current().pid()
                    + ": confira no Gerenciador de Tarefas (pausa de 8 s)");
        }
        Thread.sleep(8_000);
    }

    public static void main(String[] args) throws Exception {
        mostrar("início");

        byte[] dados = new byte[TAMANHO];
        mostrar("após new byte[512 MB]");

        for (int i = 0; i < dados.length; i += 4096) dados[i] = 1;
        mostrar("após escrever em todas as páginas do array");

        Path arquivo = Files.createTempFile("vszrss", ".bin");
        try (RandomAccessFile raf = new RandomAccessFile(arquivo.toFile(), "rw");
             FileChannel canal = raf.getChannel()) {
            raf.setLength(TAMANHO);
            MappedByteBuffer mapa = canal.map(FileChannel.MapMode.READ_ONLY, 0, TAMANHO);
            mostrar("após mapear arquivo de 512 MB");

            long soma = 0;
            for (int i = 0; i < TAMANHO; i += 4096) soma += mapa.get(i);
            mostrar("após ler uma vez cada página do arquivo (soma=" + soma + ")");
        } finally {
            Files.deleteIfExists(arquivo);
        }
        System.out.println(dados[0]);   // mantém o array vivo até aqui
    }
}
```

Resultados ilustrativos no Linux (valores aproximados, em MB):

| Etapa | `-Xms64m -Xmx2g` VSZ / RSS | `-Xms2g -Xmx2g` VSZ / RSS | `+AlwaysPreTouch` VSZ / RSS |
|---|---|---|---|
| Início | ~4.300 / ~45 | ~4.300 / ~45 | ~4.300 / ~2.090 |
| Após `new byte[512 MB]` | ~4.300 / ~560 | ~4.300 / ~560 | ~4.300 / ~2.090 |
| Após escrever no array | ~4.300 / ~560 | ~4.300 / ~560 | ~4.300 / ~2.090 |
| Após mapear o arquivo | ~4.800 / ~560 | ~4.800 / ~560 | ~4.800 / ~2.090 |
| Após ler o mapeamento | ~4.800 / ~1.070 | ~4.800 / ~1.070 | ~4.800 / ~2.600 |

**Explicação.**

- **Início.** O VSZ já é de vários GB porque a JVM reservou o heap inteiro (`-Xmx2g`), cerca de 1 GB de compressed class space, ~240 MB de code cache, stacks das threads internas e arenas de `malloc`. O RSS é pequeno: só o que foi tocado (código da JVM, classes carregadas, o pouco do heap usado). Entre `-Xms64m` e `-Xms2g`, o VSZ é o mesmo: comprometer memória (`-Xms`) não muda a reserva e também não a torna residente.
- **Após `new byte[512 MB]`.** O VSZ não muda, porque o array cabe no heap já reservado; no máximo o heap é comprometido. O RSS sobe ~512 MB **já na alocação**, porque a JVM precisa entregar o array zerado e, ao zerá-lo, escreve em todas as páginas, que recebem frames no primeiro toque (demand paging).
- **Após escrever.** Nenhuma mudança relevante: as páginas já eram residentes.
- **Após mapear.** O VSZ cresce 512 MB imediatamente: o `mmap` criou a região virtual. O RSS não muda: nenhuma página do arquivo foi lida.
- **Após ler.** Cada primeiro acesso a uma página do mapeamento gera um page fault; o kernel coloca a página no page cache e a mapeia. O crescimento aparece em `RssFile`, não em `RssAnon`. Como o arquivo foi criado com `setLength` (esparso em sistemas de arquivos Linux comuns), as páginas são zeros e não há leitura de disco.
- **`AlwaysPreTouch`.** A JVM toca todas as páginas do heap comprometido na inicialização, então o RSS já começa perto de 2 GB, e a alocação do array não muda nada (as páginas já eram residentes). O custo é um início mais lento; o benefício é eliminar page faults de primeiro toque durante a execução e descobrir cedo se a memória física não é suficiente.

## Ler um arquivo grande com FileChannel.map e comparar com leitura via InputStream

```meta
{"type": "experiment", "level": 3, "required": false, "knowledge": ["mmap", "Page cache", "MappedByteBuffer", "BufferedInputStream", "Page fault"]}
```

### Enunciado

Gere um arquivo de 2 GB com dados aleatórios e calcule a soma de todos os seus bytes de três formas: (a) `BufferedInputStream` lendo em blocos de 64 KB, (b) `FileInputStream` lendo **um byte por vez** com `read()` (apenas nos primeiros 20 MB, extrapolando o resultado) e (c) `FileChannel.map` em fatias de até 1 GB. Meça cada abordagem com o arquivo no page cache (*warm*) e, se possível, fora dele (*cold*). Explique os resultados.

### Objetivo

Entender, com números, o que um mapeamento de arquivo evita (cópias e syscalls) e o que ele não evita (page faults e leitura de disco), e por que o desempenho depende tanto do page cache.

### Instruções

1. Crie o arquivo de teste uma vez (pode reaproveitar entre execuções).
2. Implemente as três leituras, todas somando os bytes como `long` e imprimindo o total para conferir que coincidem (para a leitura byte a byte, compare a soma dos 20 MB com as outras usando o mesmo intervalo, se quiser).
3. Rode cada uma pelo menos três vezes e reporte a melhor e a pior.
4. Para medir *cold* no Linux: `sync; echo 3 | sudo tee /proc/sys/vm/drop_caches` antes da execução. No Windows nativo, a forma mais simples é reiniciar ou usar o RAMMap ("Empty Standby List"); se não puder, documente apenas o cenário *warm*.
5. Opcional (Linux): rode com `perf stat -e page-faults,major-faults` ou `/usr/bin/time -v` e compare page faults entre as abordagens.
6. Explique as diferenças e diga quando escolheria cada uma.

### Dicas

- `MappedByteBuffer` usa índice `int`, por isso o limite de ~2 GB por mapeamento; mapeie em fatias.
- Ler byte a byte com `FileInputStream.read()` é uma chamada de sistema por byte.
- Com o arquivo no page cache, a leitura em blocos copia dados do page cache para seu `byte[]`; o mapeamento acessa o frame do page cache diretamente, mas paga um page fault por página na primeira vez.

### Critérios de avaliação

- O código compila e as abordagens (a) e (c) produzem a mesma soma.
- Mostra que a leitura byte a byte sem buffer é ordens de grandeza mais lenta, e explica pelo custo de uma syscall por byte.
- Compara (a) e (c) no cenário *warm*, com resultados próximos ou vantagem moderada do mapeamento, e explica por cópias evitadas versus page faults.
- Discute o cenário *cold*: ambos limitados pelo disco, readahead favorecendo a leitura sequencial.
- Conclui quando `mmap` é vantajoso (acesso aleatório, arquivos reaproveitados, compartilhamento entre processos) e quando não é (leitura sequencial única, arquivos muito maiores que a RAM, necessidade de controle de erros).

### Solução de referência

```java
import java.io.*;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.util.Random;

public class LeituraGrande {
    static final long TAMANHO = 2L * 1024 * 1024 * 1024;   // 2 GB
    static final Path ARQUIVO = Path.of("grande.bin");

    static void gerar() throws IOException {
        if (Files.exists(ARQUIVO) && Files.size(ARQUIVO) == TAMANHO) return;
        byte[] bloco = new byte[1 << 20];
        Random r = new Random(42);
        try (OutputStream out = new BufferedOutputStream(Files.newOutputStream(ARQUIVO))) {
            for (long escrito = 0; escrito < TAMANHO; escrito += bloco.length) {
                r.nextBytes(bloco);
                out.write(bloco);
            }
        }
    }

    static long viaBufferedStream() throws IOException {
        long soma = 0;
        byte[] buf = new byte[64 * 1024];
        try (InputStream in = new BufferedInputStream(new FileInputStream(ARQUIVO.toFile()), 64 * 1024)) {
            int n;
            while ((n = in.read(buf)) > 0) {
                for (int i = 0; i < n; i++) soma += buf[i];
            }
        }
        return soma;
    }

    static long viaByteAByte(long limite) throws IOException {
        long soma = 0;
        try (FileInputStream in = new FileInputStream(ARQUIVO.toFile())) {
            for (long i = 0; i < limite; i++) {
                int b = in.read();                  // uma chamada de sistema por byte
                if (b < 0) break;
                soma += (byte) b;
            }
        }
        return soma;
    }

    static long viaMmap() throws IOException {
        long soma = 0;
        long fatia = 1L << 30;                      // 1 GB por mapeamento
        try (FileChannel canal = FileChannel.open(ARQUIVO, StandardOpenOption.READ)) {
            for (long pos = 0; pos < TAMANHO; pos += fatia) {
                long tam = Math.min(fatia, TAMANHO - pos);
                MappedByteBuffer mapa = canal.map(FileChannel.MapMode.READ_ONLY, pos, tam);
                for (int i = 0; i < tam; i++) soma += mapa.get(i);
            }
        }
        return soma;
    }

    interface Leitura { long executar() throws IOException; }

    static void medir(String nome, Leitura l) throws IOException {
        for (int r = 1; r <= 3; r++) {
            long t0 = System.nanoTime();
            long soma = l.executar();
            double ms = (System.nanoTime() - t0) / 1e6;
            System.out.printf("%-22s rodada %d: %8.0f ms  soma=%d%n", nome, r, ms, soma);
        }
    }

    public static void main(String[] args) throws IOException {
        gerar();
        String modo = args.length > 0 ? args[0] : "todos";
        if (modo.equals("todos") || modo.equals("stream")) medir("BufferedInputStream", LeituraGrande::viaBufferedStream);
        if (modo.equals("todos") || modo.equals("mmap"))   medir("FileChannel.map", LeituraGrande::viaMmap);
        if (modo.equals("todos") || modo.equals("byte")) {
            long limite = 20L * 1024 * 1024;
            long t0 = System.nanoTime();
            viaByteAByte(limite);
            double ms = (System.nanoTime() - t0) / 1e6;
            System.out.printf("byte a byte: %.0f ms para 20 MB -> ~%.0f s estimados para 2 GB%n",
                    ms, ms * (TAMANHO / (double) limite) / 1000);
        }
    }
}
```

Para medir *cold* de cada abordagem isoladamente no Linux: `sync; echo 3 | sudo tee /proc/sys/vm/drop_caches; java LeituraGrande stream` e o mesmo com `mmap` (somente a primeira rodada é *cold*; as seguintes já são *warm*).

Resultados ilustrativos (SSD NVMe, máquina com RAM de sobra; os seus vão variar):

| Abordagem | Warm | Cold |
|---|---|---|
| `BufferedInputStream` 64 KB | ~0,8–1,2 s | ~1,5–3 s |
| `FileChannel.map` | ~0,6–1,0 s | ~1,5–3,5 s |
| `read()` byte a byte | ~10–30 min (extrapolado a partir de 20 MB) | — |

**Explicação.**

- **Byte a byte.** Cada `read()` sem buffer é uma chamada de sistema completa (transição para o kernel, cópia de 1 byte, retorno), custando da ordem de centenas de nanossegundos a um microssegundo. Dois bilhões delas levam dezenas de minutos; só os 20 MB do teste já levam vários segundos. É a razão de existir o `BufferedInputStream`: ele amortiza a syscall em 64 KB.
- **Warm.** Com o arquivo inteiro no page cache, a leitura em blocos faz ~32 mil syscalls e copia 2 GB do page cache para o `byte[]`. O mapeamento não faz cópia nem syscalls por bloco, mas paga um page fault (*minor*, a página já está na RAM) por página de 4 KB na primeira passagem, ~500 mil faults, e o kernel pode usar *fault-around* para mapear várias páginas por fault. O resultado é parecido, frequentemente com vantagem moderada para o `mmap`; o laço de soma em Java também pesa bastante nos dois.
- **Cold.** Os dois ficam limitados pela velocidade do disco. A leitura sequencial com `read` se beneficia do *readahead* do kernel, que antecipa blocos grandes; o `mmap` também tem readahead, mas o padrão de faults pode torná-lo menos eficiente. Não há vencedor universal.
- **Quando usar `mmap`.** Acesso aleatório a arquivos grandes reaproveitados (índices do Lucene, arquivos de índice do Kafka, bancos embarcados como LMDB), compartilhamento do mesmo arquivo entre processos, e quando se quer deixar o SO gerenciar o cache. **Quando evitar.** Leitura sequencial única (streams são simples e igualmente rápidos), arquivos que podem ser truncados por outros processos (o acesso vira `SIGBUS`, que em Java aparece como `InternalError`), necessidade de tratar erros de I/O com exceções claras, ou quando o mapeamento precisa ser liberado deterministicamente (até o Java 21, `MappedByteBuffer` só é desmapeado pelo GC; `MemorySegment` com `Arena` resolve isso a partir do Java 22).

## Explicar por que é recomendado desabilitar ou limitar swap em servidores de aplicação

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["Swap", "Major page fault", "Garbage collection", "OOM killer", "Latência de cauda"]}
```

### Enunciado

Pergunta de entrevista: *"Swap existe para evitar que o sistema fique sem memória. Por que, então, é comum recomendar desabilitar ou limitar o swap em servidores que rodam serviços Java e bancos de dados? Não seria melhor ficar lento do que cair?"*

Responda como faria numa entrevista, cobrindo também o que você faria em vez de depender de swap.

### Objetivo

Relacionar memória virtual, swap e garbage collection com requisitos de latência e confiabilidade, e defender uma decisão operacional com argumentos técnicos.

### Instruções

1. Explique o que acontece quando uma página está em swap e é acessada.
2. Compare as ordens de grandeza de acesso à RAM e ao disco.
3. Explique por que a JVM é especialmente sensível a swap.
4. Responda diretamente a "não seria melhor ficar lento do que cair?", considerando um ambiente com várias réplicas e um orquestrador.
5. Diga o que fazer em vez disso: dimensionamento, limites, monitoramento e ajustes do kernel.

### Dicas

- Um page fault que precisa ler do disco bloqueia a thread até o I/O terminar.
- O GC precisa visitar objetos espalhados pelo heap inteiro; o que acontece se metade do heap estiver no disco?
- Um nó lento que responde a health checks pode continuar recebendo tráfego; um nó que morre é substituído.

### Critérios de avaliação

- Explica major page fault, bloqueio da thread e diferença de 100 ns (RAM) para dezenas de µs a ms (disco).
- Explica que o GC percorre o heap e que heap em swap transforma pausas de ms em segundos, gerando thrashing.
- Argumenta que lentidão imprevisível é pior que falha rápida em sistemas com réplicas: degrada a latência de cauda, provoca timeouts em cascata e mascara o problema.
- Propõe alternativas: dimensionar heap e memória nativa, limites de container, `vm.swappiness` baixo, alertas de RSS e de major faults, `AlwaysPreTouch`, travamento de memória quando aplicável.
- Reconhece nuances: swap pequeno pode ser útil para páginas realmente frias em alguns cenários, desde que monitorado.

### Solução de referência

"Swap troca falta de memória por lentidão, e para um servidor de aplicação essa troca costuma ser ruim.

Quando uma página anônima, como parte do heap, é enviada ao swap, o frame é liberado e a entrada da tabela de páginas passa a indicar onde ela está no disco. No próximo acesso, a MMU gera um page fault, e o kernel precisa ler a página do disco: é um *major fault*, e a thread fica bloqueada até o I/O terminar. Um acesso à RAM custa da ordem de 100 ns; ler do SSD custa de dezenas a centenas de microssegundos, e de um disco rígido, milissegundos. São três a cinco ordens de grandeza.

A JVM é particularmente sensível porque o garbage collector precisa visitar os objetos vivos, que estão espalhados pelo heap inteiro. Num serviço normal, o kernel decide o que vai para swap com base em quais páginas estão frias, e regiões do heap que a aplicação não toca há algum tempo parecem frias, mas o GC vai tocá-las na próxima coleta. Cada coleta vira uma sequência de major faults; uma pausa que seria de 50 ms passa a durar segundos. Se a pressão continuar, o sistema entra em *thrashing*: passa mais tempo movendo páginas do que executando código.

Sobre 'ficar lento em vez de cair': em produção normalmente temos várias réplicas e um orquestrador. Um nó lento é pior que um nó morto, porque continua respondendo a health checks, recebe sua parte do tráfego e entrega respostas em segundos. Isso explode a latência de cauda, esgota pools e timeouts dos clientes, gera retries que aumentam a carga e pode propagar a degradação para outros serviços. Um nó que morre é detectado em segundos, removido do balanceador e recriado. Falhar rápido e de forma visível é mais fácil de operar do que degradar de forma silenciosa e imprevisível.

Em vez de depender de swap, eu faria: dimensionar a memória total do processo, não só o heap (heap + metaspace + code cache + stacks + buffers diretos), medindo com Native Memory Tracking; configurar limites de container com margem e `MaxRAMPercentage` adequado; usar `-Xms` igual a `-Xmx` e, em serviços sensíveis, `AlwaysPreTouch` para descobrir falta de memória no deploy; manter `vm.swappiness` baixo ou o swap desligado nos nós; monitorar RSS, major page faults (`sar -B`, `vmstat` colunas `si`/`so`), pausas de GC e eventos de OOM kill; e, para bancos ou buscadores que exigem, travar a memória em RAM (`mlockall`).

Há nuances: um swap pequeno pode ser útil para empurrar páginas realmente frias (código de inicialização nunca mais usado) e dar folga à RAM, desde que o uso seja monitorado e o `si`/`so` contínuo seja tratado como alerta. A recomendação geral, porém, é não usar swap como parte do dimensionamento."

## Escrever um programa C que reserva 10 GB com mmap sem usá-los e explicar por que não falha

```meta
{"type": "coding", "level": 4, "required": false, "knowledge": ["mmap", "Overcommit", "Demand paging", "cgroups", "OOM killer", "ulimit"]}
```

### Enunciado

Escreva um programa em C que reserva 10 GB de memória anônima com `mmap`, imprime VSZ e RSS, toca uma quantidade configurável de MB dessa região e imprime as métricas novamente. Mostre que a reserva funciona mesmo numa máquina com menos de 10 GB livres e explique por quê. Depois provoque três situações em que algo falha: com `ulimit -v`, com `vm.overcommit_memory=2` (ou sem `MAP_NORESERVE` numa máquina com pouca RAM) e tocando mais memória do que o limite de um container.

### Objetivo

Entender em nível de chamada de sistema a diferença entre reservar espaço virtual e consumir memória física, e saber quais limites atuam em cada momento: limite de espaço de endereços, política de overcommit e limite de memória física do cgroup.

### Instruções

1. Use Linux, WSL2 ou Docker (`docker run --rm -it -v "$PWD":/w -w /w gcc:13 bash`).
2. Reserve 10 GB com `mmap(NULL, 10 GB, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS|MAP_NORESERVE, -1, 0)` e trate `MAP_FAILED`.
3. Imprima `VmSize` e `VmRSS` de `/proc/self/status` após a reserva.
4. Toque N MB (recebidos por argumento) escrevendo um byte a cada página, e imprima de novo.
5. Rode com N = 0, 100 e 1024.
6. Rode com `ulimit -v 2000000` (cerca de 2 GB de espaço virtual) num subshell e observe.
7. Se tiver permissão de root numa VM/WSL, teste `sudo sysctl vm.overcommit_memory=2` (restaure o valor depois).
8. Rode dentro de um container com `--memory=512m` e N = 1024, e observe o código de saída.
9. Explique cada resultado.

### Dicas

- O kernel só cria uma VMA na chamada `mmap`; frames são alocados no primeiro toque de cada página.
- `MAP_NORESERVE` pede para não contabilizar a reserva no limite de overcommit no modo heurístico; no modo estrito (`2`), ele é ignorado.
- O limite de memória de um cgroup conta páginas efetivamente cobradas (residentes), não espaço virtual. Código de saída 137 significa morto por `SIGKILL`.

### Critérios de avaliação

- O programa compila sem avisos com `gcc -Wall -O2` e trata erro de `mmap`.
- Mostra VSZ aumentando ~10 GB imediatamente e RSS praticamente inalterado com N = 0.
- Mostra RSS crescendo proporcionalmente a N após tocar as páginas.
- Explica a falha com `ulimit -v` (limite de espaço de endereços, `ENOMEM` no `mmap`) e com overcommit estrito (o commit excederia o `CommitLimit`).
- Explica a morte no container com limite de 512 MB ao tocar 1 GB (OOM killer do cgroup, código 137) e relaciona com a JVM: reservar `-Xmx` grande é barato, mas usar mais que o limite do container mata o processo.

### Solução de referência

```c
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>

static void mostrar(const char *etapa) {
    FILE *f = fopen("/proc/self/status", "r");
    char linha[256];
    printf("--- %s\n", etapa);
    if (!f) { perror("fopen"); return; }
    while (fgets(linha, sizeof linha, f)) {
        if (strncmp(linha, "VmSize", 6) == 0 || strncmp(linha, "VmRSS", 5) == 0) {
            fputs(linha, stdout);
        }
    }
    fclose(f);
}

int main(int argc, char **argv) {
    const size_t tamanho = 10UL * 1024 * 1024 * 1024;          /* 10 GB */
    size_t tocar = (argc > 1 ? strtoull(argv[1], NULL, 10) : 0) * 1024 * 1024;
    if (tocar > tamanho) tocar = tamanho;

    mostrar("início");

    char *p = mmap(NULL, tamanho, PROT_READ | PROT_WRITE,
                   MAP_PRIVATE | MAP_ANONYMOUS | MAP_NORESERVE, -1, 0);
    if (p == MAP_FAILED) {
        perror("mmap de 10 GB falhou");
        return 1;
    }
    mostrar("após mmap de 10 GB (nada tocado)");

    long pagina = sysconf(_SC_PAGESIZE);
    for (size_t off = 0; off < tocar; off += (size_t) pagina) {
        p[off] = 1;                                         /* primeiro toque: page fault + frame */
    }
    printf("tocados %zu MB\n", tocar / (1024 * 1024));
    mostrar("após tocar");

    munmap(p, tamanho);
    return 0;
}
```

```bash
gcc -Wall -O2 -o reserva reserva.c
./reserva 0
./reserva 100
./reserva 1024
(ulimit -v 2000000; ./reserva 0)
docker run --rm --memory=512m --memory-swap=512m -v "$PWD":/w -w /w gcc:13 ./reserva 1024; echo "exit=$?"
```

Saída ilustrativa:

```text
$ ./reserva 1024
--- início
VmSize:     2640 kB
VmRSS:      1100 kB
--- após mmap de 10 GB (nada tocado)
VmSize: 10488400 kB
VmRSS:      1120 kB
tocados 1024 MB
--- após tocar
VmSize: 10488400 kB
VmRSS:   1049700 kB
```

**Por que não falha.** `mmap` anônimo não aloca memória física: o kernel só cria uma VMA, uma descrição da região com suas permissões, e devolve o endereço. Nenhum frame é entregue e nenhuma tabela de páginas é preenchida ainda. Por isso o VSZ cresce 10 GB e o RSS não muda. No modo de overcommit padrão (`0`), a reserva com `MAP_NORESERVE` nem entra na contabilidade de commit. Quando o programa escreve em cada página, ocorre um page fault; o kernel aloca um frame zerado e preenche a entrada da tabela. O RSS cresce exatamente com o que foi tocado: 100 MB, 1 GB. Os outros 9 GB nunca existiram fisicamente.

**As três falhas.**

- **`ulimit -v`.** `RLIMIT_AS` limita o tamanho total do espaço de endereços virtual do processo. Com ~2 GB, uma reserva de 10 GB é recusada na hora: `mmap` retorna `MAP_FAILED` com `ENOMEM`, sem nenhuma relação com a RAM livre. É por isso que uma JVM com `-Xmx` grande falha ao iniciar em ambientes com `ulimit -v` baixo, mesmo que nunca fosse usar tudo.
- **Overcommit estrito (`vm.overcommit_memory=2`).** O kernel passa a contabilizar toda memória gravável privada prometida e recusa o que ultrapassar `CommitLimit` (swap + `overcommit_ratio`% da RAM). `MAP_NORESERVE` é ignorado nesse modo, então 10 GB numa máquina de 8 GB falha com `ENOMEM`. No modo `0`, sem `MAP_NORESERVE`, a heurística também recusa uma reserva maior que RAM + swap total. (Uma reserva com `PROT_NONE`, como a JVM faz inicialmente para o heap, não é contabilizada; o commit acontece quando a JVM torna a região gravável.)
- **Container com `--memory=512m`.** A reserva de 10 GB funciona, porque o cgroup não limita espaço virtual. Ao tocar páginas, cada frame é cobrado do cgroup; ao passar de 512 MB (sem swap disponível), o kernel aciona o OOM killer do cgroup, que mata o processo com `SIGKILL`. O shell mostra `exit=137` e `dmesg` registra a morte. Não há `malloc` falhando nem chance de tratar o erro: a promessa feita no `mmap` simplesmente não pôde ser cumprida.

**Relação com a JVM.** É exatamente o que acontece com uma JVM: reservar `-Xmx` e outras regiões é barato e quase nunca falha, mas o limite que mata o processo em produção é a memória **tocada** somada de todas as regiões (heap, metaspace, stacks, buffers diretos). Por isso, em containers, o heap deve ser uma fração do limite, e a memória fora do heap precisa ser medida.

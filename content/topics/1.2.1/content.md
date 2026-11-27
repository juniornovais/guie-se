## O problema que o sistema operacional resolve

Imagine um computador sem sistema operacional executando dois programas: um servidor web e um banco de dados. Os dois querem usar a CPU o tempo todo, os dois escrevem na RAM, os dois falam com o mesmo disco e a mesma placa de rede. Sem um árbitro, qualquer um deles poderia sobrescrever a memória do outro, monopolizar a CPU num laço infinito ou corromper o sistema de arquivos escrevendo blocos de disco diretamente.

O **sistema operacional (SO)** existe para resolver três problemas ao mesmo tempo:

1. **Multiplexação**: dividir recursos finitos (núcleos de CPU, RAM, disco, rede) entre muitos programas, dando a cada um a ilusão de ter a máquina só para si.
2. **Proteção e isolamento**: impedir que um programa com bug (ou malicioso) leia ou destrua os dados de outro, ou derrube a máquina inteira.
3. **Abstração**: esconder a diversidade do hardware atrás de interfaces estáveis. Um programa chama `read` num arquivo sem saber se ele está num SSD NVMe, num disco SATA ou num compartilhamento de rede.

A parte do SO que faz esse trabalho com privilégio total sobre o hardware é o **kernel**. O resto (shell, utilitários, bibliotecas como a `libc`, o gerenciador de pacotes) roda como programa comum, sem privilégios especiais.

## Responsabilidades do kernel

O kernel é, na prática, um conjunto de subsistemas que gerenciam recursos e expõem uma API para os programas:

| Subsistema | O que gerencia | Exemplo do ponto de vista de uma JVM |
|---|---|---|
| Escalonamento de processos e threads | Quem usa cada núcleo de CPU e por quanto tempo | As threads da JVM (aplicação, GC, JIT) disputam núcleos |
| Gerenciamento de memória | Memória virtual, páginas físicas, page faults, swap | O heap Java é uma região reservada via `mmap` |
| Sistema de arquivos (VFS) | Arquivos, diretórios, permissões, page cache | `Files.readAllBytes` vira `openat`/`read`/`close` |
| Drivers de dispositivo | Disco, placa de rede, teclado, GPU | O driver NVMe transforma um `read` em comandos para o SSD |
| Pilha de rede | TCP/IP, sockets, roteamento | `ServerSocket.accept()` usa `socket`, `bind`, `listen`, `accept` |
| Segurança e contabilidade | Usuários, permissões, limites, cgroups | `ulimit -n` limita quantos arquivos e sockets a JVM abre |

Esses subsistemas não são independentes. Uma leitura de arquivo, por exemplo, passa pelo sistema de arquivos, pode encontrar o dado no **page cache** (memória gerenciada pelo subsistema de memória) ou acionar o driver do disco, e a thread que pediu o dado é colocada para dormir pelo escalonador até a resposta chegar.

## User mode e kernel mode

A proteção não é uma convenção de software: ela é imposta pelo **hardware**. A CPU (tópico 1.1.1) tem **níveis de privilégio**. Em x86 eles se chamam **rings**, numerados de 0 a 3:

- **Ring 0 (kernel mode)**: pode executar qualquer instrução, inclusive as privilegiadas, como alterar as tabelas de páginas (o registrador `CR3`), desabilitar interrupções, falar diretamente com dispositivos via portas de I/O e configurar o tratamento de interrupções.
- **Ring 3 (user mode)**: só executa instruções "comuns" (aritmética, saltos, acesso à memória mapeada para o processo). Se tentar uma instrução privilegiada, a CPU gera uma **exceção** (*general protection fault*) e transfere o controle ao kernel, que normalmente mata o processo.

Os rings 1 e 2 existem em x86, mas Linux e Windows praticamente não os usam. Em ARM, o equivalente são os **exception levels**: EL0 (usuário), EL1 (kernel), EL2 (hypervisor) e EL3 (firmware seguro).

O segundo pilar da proteção é a **memória virtual** (tópico 1.2.6): cada processo enxerga apenas os endereços que o kernel mapeou para ele nas tabelas de páginas. As páginas do kernel são marcadas como acessíveis só em modo supervisor. Um programa em ring 3 que tenta ler o endereço de outro processo simplesmente não tem esse endereço mapeado e recebe uma falha de segmentação (`SIGSEGV`).

Por isso um programa não consegue acessar o disco diretamente: as instruções e registradores de dispositivo exigem ring 0. Ele precisa **pedir ao kernel**.

## Diagrama: User space, kernel e hardware

```text
 ┌────────────────────────────────────────────────────────────┐
 │ USER SPACE (ring 3)                                        │
 │                                                            │
 │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
 │  │  JVM        │   │  PostgreSQL │   │  bash       │       │
 │  │  (processo) │   │  (processo) │   │  (processo) │       │
 │  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘       │
 │         │ libc (wrappers: read(), write(), mmap()...)      │
 ├─────────┼─────────────────┼─────────────────┼──────────────┤
 │         ▼   instrução syscall (troca para ring 0)          │
 │ KERNEL SPACE (ring 0)                                      │
 │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
 │  │Escalona- │ │ Memória  │ │ VFS /    │ │ Pilha de rede │  │
 │  │dor       │ │ virtual  │ │ arquivos │ │ (TCP/IP)      │  │
 │  └──────────┘ └──────────┘ └────┬─────┘ └───────┬───────┘  │
 │                          ┌──────┴───────────────┴──────┐   │
 │                          │  Drivers de dispositivo     │   │
 │                          └──────────────┬──────────────┘   │
 ├─────────────────────────────────────────┼──────────────────┤
 │ HARDWARE      CPU   RAM   SSD   NIC     ▼   (interrupções ↑)│
 └────────────────────────────────────────────────────────────┘
```

Os pedidos descem por system calls; os eventos de hardware sobem por interrupções. O kernel é o único componente que conversa com as duas pontas.

## System calls: a porta de entrada do kernel

Uma **system call** (syscall) é uma chamada de função controlada que cruza a fronteira entre user mode e kernel mode. Ela não pode ser uma chamada comum (`call`), porque isso permitiria saltar para qualquer endereço do kernel. A CPU oferece uma instrução específica que muda o privilégio **e** salta para um único ponto de entrada configurado pelo kernel.

Em Linux x86-64, uma syscall acontece assim:

1. O programa (normalmente a `libc`, através de uma função "wrapper" como `read()`) coloca o **número da syscall** no registrador `rax` e os argumentos em `rdi`, `rsi`, `rdx`, `r10`, `r8` e `r9`.
2. Executa a instrução `syscall`. A CPU salva o endereço de retorno e as flags, troca para ring 0 e salta para o endereço registrado pelo kernel no MSR `IA32_LSTAR`.
3. O código de entrada do kernel troca para a **stack de kernel** da thread, salva os registradores do usuário e usa `rax` como índice na **tabela de syscalls** (`sys_call_table`).
4. O kernel **valida tudo**: o descritor existe? O ponteiro do buffer aponta para memória do próprio processo? O processo tem permissão? Nunca se confia em dados vindos do user space.
5. Executa o trabalho (que pode incluir dormir esperando o disco), coloca o resultado em `rax` e retorna com `sysret`, voltando ao ring 3.
6. Se houve erro, o kernel devolve um número negativo (`-ENOENT`, `-EACCES`...); o wrapper da `libc` converte isso em `-1` e preenche `errno`.

```c
#include <unistd.h>
#include <fcntl.h>

int main(void) {
    char buf[64];
    int fd = open("/etc/hostname", O_RDONLY);  // syscall openat
    ssize_t n = read(fd, buf, sizeof buf);      // syscall read
    write(1, buf, n);                           // syscall write no fd 1 (stdout)
    close(fd);                                  // syscall close
    return 0;                                   // exit_group, via runtime da libc
}
```

Linux tem cerca de 300 a 450 syscalls, dependendo da arquitetura. Algumas que aparecem o tempo todo num backend: `openat`, `read`, `write`, `close`, `mmap`, `munmap`, `mprotect`, `clone`, `futex`, `socket`, `accept4`, `epoll_wait`, `sendto`, `recvfrom`, `exit_group`.

Windows tem o mesmo conceito, mas a API documentada é a **Win32** (`ReadFile`, `CreateThread`), que chama a camada `ntdll.dll` (`NtReadFile`), que por sua vez faz a transição para o kernel. Os números de syscall do Windows mudam entre versões, por isso programas nunca os usam diretamente.

## O custo de uma system call

Uma syscall custa muito mais do que uma chamada de função comum, por vários motivos:

- **Troca de modo**: salvar e restaurar registradores, trocar de stack, executar `syscall`/`sysret`. Só isso já custa dezenas a centenas de ciclos.
- **Mitigações de segurança**: depois das vulnerabilidades Meltdown e Spectre, kernels passaram a usar técnicas como **KPTI** (tabelas de páginas separadas para usuário e kernel) e barreiras de especulação, que encarecem cada entrada e saída do kernel.
- **Poluição de cache e TLB**: o código e os dados do kernel ocupam linhas de cache L1/L2 e entradas da TLB que eram do programa. Ao voltar, o programa sofre mais *cache misses*.
- **Validação e cópia**: o kernel precisa verificar argumentos e copiar dados entre o buffer do usuário e o do kernel (`copy_from_user`/`copy_to_user`).
- **O trabalho em si**: uma syscall que bloqueia (ler de um socket sem dados) envolve o escalonador e uma troca de contexto (tópico 1.2.5), que é ordens de grandeza mais cara.

Como ordem de grandeza ilustrativa, uma syscall trivial (`getppid`) custa algo entre **100 ns e 1 µs** numa máquina moderna, enquanto uma chamada de método Java inlinada custa menos de 1 ns. Isso significa que **fazer muitas syscalls pequenas é caro**, e explica várias decisões de design que você usa todo dia:

- `BufferedOutputStream`, `BufferedReader` e `BufferedWriter` acumulam dados num array em user space e fazem uma syscall a cada 8 KB, em vez de uma por byte.
- Loggers assíncronos agrupam linhas antes de escrever.
- `writev` e `readv` enviam vários buffers numa só syscall; `sendfile` copia de arquivo para socket sem passar pelo user space.
- `epoll` permite esperar milhares de sockets com uma única syscall, em vez de um `read` bloqueante por conexão.
- **io_uring** (Linux 5.1+) usa filas compartilhadas entre usuário e kernel para submeter lotes de operações quase sem syscalls.
- O **vDSO** (*virtual dynamic shared object*) é uma página de código do kernel mapeada no processo que implementa `clock_gettime` em user space. Por isso `System.nanoTime()` e `System.currentTimeMillis()` normalmente **não** fazem syscall de verdade.

## Exemplo: Observando as system calls de um programa Java

No Linux, a ferramenta `strace` usa a API de depuração `ptrace` para interceptar cada syscall de um processo e imprimir nome, argumentos e retorno.

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

```bash
javac LerArquivo.java
echo "ola mundo" > dados.txt
# -f segue todas as threads; -e filtra syscalls; -o grava num arquivo
strace -f -e trace=openat,read,close,write -o trace.txt java LerArquivo
grep -A3 'dados.txt' trace.txt
strace -c -f java LerArquivo     # resumo: contagem e tempo por syscall
```

Saída ilustrativa (números de PID e descritores variam):

```text
4821  openat(AT_FDCWD, "dados.txt", O_RDONLY) = 5
4821  read(5, "ola mundo\n", 10) = 10
4821  close(5)                    = 0
4821  write(1, "Li 10 bytes\n", 12) = 12
```

O `openat` devolve o descritor `5`; `read` usa esse descritor e devolve quantos bytes leu; `close` libera o descritor. O arquivo completo do `trace.txt`, porém, terá **milhares** de linhas: a JVM abre `libjvm.so`, mapeia o arquivo de módulos (`lib/modules`), cria dezenas de threads (`clone`/`clone3`), reserva o heap com `mmap` e sincroniza threads com `futex`. Esse "ruído" é o custo de inicialização da JVM, visto do ponto de vista do kernel.

Fora do Linux: no Windows use **WSL2** ou um container Docker (`docker run --rm -it --cap-add=SYS_PTRACE eclipse-temurin:21 bash` e instale o `strace`), ou o **Process Monitor** da Sysinternals, que mostra operações de arquivo e rede por processo. No macOS, o equivalente é `dtruss` (exige desabilitar parte do SIP) ou `fs_usage` para operações de arquivo.

> `strace` deixa o programa muito mais lento, porque cada syscall vira duas paradas do processo rastreado. Para produção, ferramentas baseadas em eBPF (`bpftrace`, `perf trace`) têm overhead muito menor.

## Interrupções, exceções e o escalonador

Syscalls são a forma como o programa **pede** algo ao kernel. Mas o kernel também precisa ganhar o controle **sem ser chamado**. Isso acontece por dois mecanismos de hardware:

- **Interrupções de hardware**: um dispositivo sinaliza a CPU (o SSD terminou uma leitura, chegou um pacote na placa de rede, o **timer** disparou). A CPU interrompe o que estava fazendo, troca para ring 0 e executa o *interrupt handler* registrado pelo kernel na tabela de interrupções (IDT em x86).
- **Exceções** (ou *traps*): geradas pela própria instrução em execução, como divisão por zero, instrução privilegiada em ring 3 ou **page fault** (acesso a uma página não mapeada ou ainda não carregada, tópico 1.2.8). A JVM HotSpot usa isso a seu favor: em vez de testar `if (obj == null)` antes de cada acesso, o código compilado acessa o endereço direto e, se for nulo, o page fault vira um `SIGSEGV` que a JVM captura e converte em `NullPointerException`.

O **timer** é a peça que torna possível a multitarefa **preemptiva**. Ele interrompe a CPU periodicamente (ou em instantes programados), e o kernel aproveita para executar o **escalonador**: se a thread atual já usou sua fatia de tempo e há outra pronta para rodar, o kernel salva o estado da atual e restaura o da próxima. Um laço infinito, portanto, não trava a máquina: ele é interrompido e as outras threads continuam recebendo CPU.

Em alto nível, o escalonador do Linux (CFS por muitos anos, substituído pelo **EEVDF** a partir do kernel 6.6) tenta dividir o tempo de CPU de forma justa, ponderada pela prioridade (`nice`), e escalona **threads**, não processos. Detalhes de como a troca acontece e quanto custa estão no tópico 1.2.5 (Context Switch).

## O que a JVM pede ao sistema operacional

A JVM é um processo comum. Tudo que ela faz de "mágico" é construído sobre syscalls:

| Recurso Java | O que a JVM pede ao kernel (Linux) |
|---|---|
| `new Thread(...).start()` | `pthread_create` na `libc`, que chama `clone`/`clone3` e `mmap` para a stack da thread |
| Heap (`-Xms`, `-Xmx`) | `mmap` reservando o espaço de endereçamento de `-Xmx` sem memória física, e *commit* de partes conforme o heap cresce; `madvise` para devolver memória |
| Metaspace, code cache, stacks | Mais regiões `mmap` |
| `synchronized`, `ReentrantLock` com disputa, `LockSupport.park` | `futex` (espera e acorda threads no kernel) |
| `FileInputStream`, `Files.*` | `openat`, `read`, `write`, `fstat`, `close` |
| `ServerSocket`, `Socket`, NIO | `socket`, `bind`, `listen`, `accept4`, `connect`, `recvfrom`, `sendto`; `epoll_create`/`epoll_ctl`/`epoll_wait` no `Selector` |
| `Thread.sleep` | `nanosleep`/`clock_nanosleep` ou espera em `futex` com timeout |
| `ProcessBuilder.start()` | `posix_spawn`/`vfork` + `execve` (tópico 1.2.2) |
| Shutdown hooks, `kill -3` | Tratadores de sinais instalados com `rt_sigaction` |

Entender essa tabela muda a forma de diagnosticar problemas. "Too many open files" é um limite do kernel sobre descritores (que incluem sockets). "unable to create native thread" é o kernel recusando um `clone` (tópico 1.2.3). Um processo Java morto com código 137 foi provavelmente morto pelo kernel por falta de memória (OOM killer) ou pelo orquestrador.

## Kernels monolíticos e microkernels

Há duas grandes filosofias para organizar o kernel:

- **Monolítico**: escalonador, memória, sistemas de arquivos, pilha de rede e drivers rodam todos em ring 0, no mesmo espaço de endereçamento. Uma chamada do sistema de arquivos ao driver de disco é uma chamada de função comum. **Vantagem**: desempenho. **Desvantagem**: um bug num driver pode corromper qualquer parte do kernel e derrubar a máquina (*kernel panic*). O **Linux** é monolítico, mas **modular**: drivers podem ser carregados e descarregados em tempo de execução (`lsmod`, `modprobe`), embora continuem rodando em ring 0.
- **Microkernel**: o kernel faz o mínimo (escalonamento, espaços de endereçamento, comunicação entre processos — IPC). Drivers, sistemas de arquivos e pilha de rede rodam como **processos em user space**, que conversam por mensagens. **Vantagem**: isolamento; um driver que falha pode ser reiniciado sem derrubar o sistema, e a base de código privilegiada é pequena o suficiente para ser verificada formalmente (caso do **seL4**). **Desvantagem**: cada operação de I/O envolve várias trocas de mensagens e de contexto. Exemplos: **QNX** (automotivo e embarcados), **MINIX 3**, seL4.
- **Híbridos**: **Windows NT** e o **XNU** (macOS/iOS) partiram de ideias de microkernel, mas colocaram muitos serviços de volta em kernel mode por desempenho.

Para um desenvolvedor backend, a consequência prática é que no Linux tudo que envolve rede e disco acontece dentro do kernel, com o custo de syscalls, mas sem trocas de mensagens extras.

## Containers: o SO dividido em fatias

Um **container** não é uma máquina virtual. Uma **VM** emula hardware (CPU virtual, disco virtual, placa de rede virtual) com ajuda de um **hypervisor**, e cada VM roda **seu próprio kernel**. Um container é apenas um **processo comum** do kernel do host, ao qual o kernel aplica duas restrições:

- **Namespaces**: mudam o que o processo **vê**. Cada tipo isola uma visão: `pid` (o processo vê a si mesmo como PID 1 e não enxerga os processos do host), `mnt` (sistema de arquivos próprio), `net` (interfaces de rede, portas e tabela de rotas próprias), `uts` (hostname), `ipc`, `user` (mapeamento de UIDs) e `cgroup`.
- **cgroups** (*control groups*): limitam o que o processo **usa**. Exemplos no cgroup v2: `memory.max` (limite de memória; ao ultrapassar, o OOM killer mata um processo do grupo), `cpu.max` (cota de CPU, por exemplo "200000 100000" = 2 CPUs a cada 100 ms), `pids.max` (número máximo de processos e threads).

```text
         VM                                Container
 ┌──────────────────────┐        ┌──────────────────────────┐
 │ App  │ libs          │        │ App  │ libs              │
 │ Kernel convidado     │        │ (sem kernel próprio)     │
 │ Hardware virtual     │        │ namespaces + cgroups     │
 ├──────────────────────┤        ├──────────────────────────┤
 │ Hypervisor           │        │ Kernel do host (único)   │
 │ Hardware físico      │        │ Hardware físico          │
 └──────────────────────┘        └──────────────────────────┘
```

Consequências: containers sobem em milissegundos (é só um `clone` com flags de namespace e um `execve`), têm overhead quase nulo de CPU, mas oferecem **isolamento mais fraco** do que VMs, porque todos compartilham o mesmo kernel; uma vulnerabilidade no kernel afeta todos. No Windows e no macOS, o Docker Desktop roda uma VM Linux leve por baixo, justamente porque containers Linux precisam de um kernel Linux.

### Por que a JVM precisa ser container-aware

A JVM decide muitos parâmetros olhando o "tamanho da máquina": o heap máximo padrão é uma fração da memória física (`MaxRAMPercentage`, 25% por padrão), e o número de threads do GC, do JIT e o paralelismo do `ForkJoinPool.commonPool()` derivam de `Runtime.availableProcessors()`.

Antes do suporte a containers, uma JVM num container limitado a 1 GB, rodando num host de 64 GB, lia `/proc/meminfo`, via 64 GB e escolhia um heap de 16 GB. O heap crescia além de 1 GB, o cgroup estourava e o kernel matava o processo com **OOM kill** (código de saída 137, `OOMKilled` no Kubernetes), sem nenhum `OutOfMemoryError` no log. Da mesma forma, ela via 64 CPUs e criava dezenas de threads de GC para uma cota de 2 CPUs, causando *throttling*.

A partir do JDK 10 (com backport para o 8u191), a opção `-XX:+UseContainerSupport` (ligada por padrão) faz a JVM ler os limites do cgroup (v1, e v2 a partir do JDK 15 e backports no 11 e 8). Boas práticas:

- Use JDK 11+ (de preferência 17 ou 21) em containers.
- Dimensione o heap relativo ao limite: `-XX:MaxRAMPercentage=75.0` costuma ser um ponto de partida, deixando espaço para metaspace, stacks de threads, code cache e buffers diretos, que ficam **fora** do heap mas **dentro** do limite do cgroup.
- Confira o que a JVM enxergou: `java -XshowSettings:system -version` ou `-Xlog:os+container=info`.

## Custos, limitações e uso em sistemas reais

- **Custo das syscalls**: cada cruzamento da fronteira custa de centenas de nanossegundos a microssegundos. Código de alto desempenho minimiza syscalls com buffers, lotes (`writev`, `epoll`, io_uring) e mecanismos como o vDSO.
- **Proteção tem preço**: as mitigações de Meltdown/Spectre aumentaram o custo das syscalls em cargas com muito I/O pequeno. Esse é um dos motivos pelos quais bancos de dados e proxies investem tanto em agrupar operações.
- **O kernel é compartilhado**: em containers, limites de descritores, de PIDs e parâmetros de rede (`somaxconn`, portas efêmeras) podem ser do host ou do namespace, e esquecer isso causa falhas difíceis de reproduzir.
- **Diagnóstico**: `strace` (o que o processo pede ao kernel), `/proc/<pid>/` (o que o kernel sabe sobre o processo, tópico 1.2.2), `top`/`vmstat` (tempo em user vs system: `us` alto é código da aplicação, `sy` alto indica muitas syscalls ou trocas de contexto) e `perf` são as ferramentas de base de qualquer investigação de desempenho.
- **I/O**: como o kernel entrega dados de disco e rede, e os modelos bloqueante, não bloqueante e assíncrono, são assunto do tópico 1.2.9.

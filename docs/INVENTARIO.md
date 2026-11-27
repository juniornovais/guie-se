# Inventário do Roadmap Java Backend

> Documento gerado automaticamente por `npm run inventory` a partir de `content/` — a mesma fonte usada pelo seed. Não edite à mão.

## Conferência

| Item | Roadmap oficial (contado) | Rodapé do roadmap | Inventário |
|---|---|---|---|
| Etapas | 6 | 6 | 6 |
| Módulos | 24 | 23 | 24 com descrição |
| Tópicos | 236 | 223 | 236 com objetivos e critérios |
| Desafios planejados | — | — | 1247 |
| Pré-requisitos | — | — | 457 |

O rodapé do roadmap declara 23 módulos e 223 tópicos, mas o corpo do documento contém 24 módulos e 236 tópicos (cada módulo confere com seu "**N tópicos**"). Prevalece o corpo: nenhum tópico foi omitido.

Legenda: **[req]** pré-requisito necessário · **[rec]** recomendado (não bloqueia). Níveis: 1 Entendimento, 2 Aplicação, 3 Aprofundamento, 4 Construção. Descrições de módulo, objetivos, critérios e desafios são **conteúdo complementar** (o roadmap original define etapas, descrições das etapas, módulos e tópicos).

## 01 — Fundamentos

*Como o computador executa um programa: CPU, memória, compilação, stack e heap, e o papel do sistema operacional com processos, threads e memória virtual. É a base para entender performance, concorrência e o comportamento da JVM.*

### 1.1 Como computadores executam programas (9 tópicos)

**[Adicional]** Explica como um programa sai do código-fonte e vira instruções executadas pela CPU, passando pela cadeia de compilação (preprocessing, compiling, assembling e linking). Cobre o modelo de memória que o programa enxerga — endereços, stack, heap e call stack — e os custos de cada região. É a base para entender, mais adiante, a JVM, o JIT, o Garbage Collector e erros como StackOverflowError e OutOfMemoryError.

Objetivos do módulo:
- Descrever o ciclo fetch-decode-execute e relacionar registradores, cache e RAM com o desempenho de um programa
- Explicar cada fase da cadeia de build (preprocessing, compiling, assembling, linking) e o artefato que ela produz
- Diferenciar compilação ahead-of-time, interpretação e JIT, situando o modelo da JVM
- Comparar stack e heap em custo de alocação, tempo de vida e gerenciamento
- Ler e interpretar um stack trace a partir do funcionamento da call stack

#### 1.1.1 CPU

Como a CPU executa instruções pelo ciclo fetch-decode-execute, usando registradores, ALU, pipeline e hierarquia de cache. Entender esse modelo explica por que localidade de dados, branches e cache misses dominam o desempenho real de código backend. _(~90 min)_

**Objetivos**
- Descrever o ciclo fetch-decode-execute e o papel do program counter, registradores e ALU
- Explicar a hierarquia L1/L2/L3/RAM e estimar a ordem de grandeza da latência de cada nível
- Explicar como pipelining e branch prediction aumentam o throughput e o que causa uma branch misprediction
- Diferenciar cores físicos, hyper-threading e clock, e por que mais GHz não implica proporcionalmente mais desempenho
- Relacionar localidade espacial e temporal com o desempenho de percorrer arrays versus estruturas encadeadas

**Desafios planejados**
- N1 · Conceitual — Descrever passo a passo o ciclo fetch-decode-execute de uma instrução ADD
- N2 · Experimento — Medir o tempo de percorrer uma matriz por linhas vs. por colunas e explicar a diferença por cache
- N3 · Experimento — Reproduzir o efeito de branch prediction somando elementos de um array ordenado vs. desordenado
- N3 · Entrevista — Explicar por que uma LinkedList costuma ser mais lenta que um ArrayList mesmo em operações O(n) equivalentes
- N4 · Implementação — Implementar um mini-interpretador de uma CPU fictícia com registradores, PC e 6 instruções

**Critérios de conclusão**
- [ ] Consigo explicar, sem consulta, o que acontece em um ciclo de instrução completo
- [ ] Sei citar valores aproximados de latência de L1, L2, L3 e RAM e usar isso para justificar uma escolha de estrutura de dados
- [ ] Medi experimentalmente o efeito de cache (acesso sequencial vs. aleatório) e interpretei o resultado
- [ ] Consigo explicar por que um array ordenado pode ser processado mais rápido que um desordenado em um loop com if

#### 1.1.2 RAM

O que é a RAM, como ela é organizada em bytes endereçáveis e como a CPU a acessa através do barramento e do controlador de memória. Importa porque a memória é volátil, finita e muito mais lenta que a CPU, o que molda decisões de cache, serialização e dimensionamento de heap. _(~60 min)_

**Objetivos**
- Explicar a RAM como sequência de bytes endereçáveis e diferenciar memória volátil de armazenamento persistente
- Comparar latência e largura de banda da RAM com cache da CPU e com SSD/disco
- Explicar o conceito de word size, alinhamento e por que leituras desalinhadas podem custar mais
- Relacionar o tamanho da RAM com limites práticos de processos, como -Xmx na JVM e limites de containers
- Explicar o que acontece com o sistema quando a memória física se esgota (swap, OOM killer)

**Pré-requisitos**
- [rec] 1.1.1 CPU — A RAM é entendida em relação à CPU e à hierarquia de cache

**Desafios planejados**
- N1 · Conceitual — Montar uma tabela de latências cache/RAM/SSD/rede e explicar o impacto de cada salto
- N2 · Experimento — Observar com ferramentas do SO (top, Task Manager, free) o consumo de RAM de uma aplicação Java ao alocar arrays grandes
- N3 · Análise de código — Calcular o tamanho em memória de um objeto Java com campos mistos considerando header e padding
- N3 · Entrevista — Explicar o que acontece quando um container com limite de 512 MB roda uma JVM com -Xmx de 1 GB
- N4 · Experimento — Medir a largura de banda de memória copiando grandes blocos de bytes e comparar com o valor nominal do hardware

**Critérios de conclusão**
- [ ] Consigo explicar por que dados em RAM se perdem ao desligar e o que isso implica para persistência
- [ ] Sei comparar ordens de grandeza de latência entre cache, RAM e SSD
- [ ] Consigo explicar o que é alinhamento de memória com um exemplo de struct ou objeto
- [ ] Sei descrever o comportamento do sistema quando um processo excede a memória disponível

#### 1.1.3 Código fonte e código de máquina

A diferença entre código-fonte legível por humanos, código intermediário (como bytecode) e código de máquina executado pela CPU. Entender essas camadas explica portabilidade, desempenho e por que a JVM executa o mesmo .class em arquiteturas diferentes. _(~60 min)_

**Objetivos**
- Diferenciar código-fonte, assembly, código de máquina e bytecode, indicando quem consome cada um
- Explicar o que é uma ISA (x86-64, ARM64) e por que binários nativos não são portáveis entre arquiteturas
- Explicar como o bytecode Java permite portabilidade e qual o custo disso (interpretação/JIT)
- Ler um trecho simples de assembly ou de bytecode e relacioná-lo com o código-fonte original
- Diferenciar linguagens compiladas, interpretadas e com JIT em termos de tempo de startup e desempenho de pico

**Pré-requisitos**
- [rec] 1.1.1 CPU — Código de máquina é o conjunto de instruções que a CPU executa

**Desafios planejados**
- N1 · Conceitual — Explicar as camadas código-fonte → bytecode → código de máquina para um Hello World em Java
- N2 · Análise de código — Inspecionar com javap -c o bytecode de um método com loop e mapear cada instrução para a linha Java
- N2 · Experimento — Compilar uma função C com gcc -S e comparar o assembly gerado com -O0 e -O2
- N3 · Entrevista — Responder: por que Java é ao mesmo tempo compilado e interpretado?
- N4 · Implementação — Escrever um pequeno compilador de expressões aritméticas que gera instruções para uma máquina de pilha

**Critérios de conclusão**
- [ ] Consigo explicar por que um executável Windows x86-64 não roda em um Mac ARM sem tradução
- [ ] Usei javap -c para inspecionar o bytecode de uma classe e identifiquei as instruções principais
- [ ] Consigo comparar startup e desempenho de pico de AOT, interpretação e JIT

#### 1.1.4 Compilação

O que um compilador faz: análise léxica, sintática e semântica, geração de código intermediário e otimizações. Importa para interpretar erros de compilação, entender otimizações que mudam o código executado e diferenciar o javac do JIT da JVM. _(~75 min)_

**Objetivos**
- Descrever as fases de um compilador (lexer, parser, análise semântica, geração e otimização de código)
- Diferenciar erros de compilação de erros de runtime e explicar por que tipagem estática antecipa falhas
- Explicar otimizações comuns (constant folding, inlining, dead code elimination) e seus efeitos observáveis
- Comparar o papel do javac (fonte → bytecode) com o do JIT (bytecode → código nativo em runtime)
- Explicar o trade-off entre compilação AOT (ex.: GraalVM native-image) e JIT em startup, memória e desempenho de pico

**Pré-requisitos**
- [rec] 1.1.3 Código fonte e código de máquina — É preciso distinguir as representações de código que o compilador transforma

**Desafios planejados**
- N1 · Conceitual — Classificar erros de exemplo como léxicos, sintáticos, semânticos ou de runtime
- N2 · Experimento — Observar constant folding comparando o bytecode de final static String concatenadas vs. não finais
- N3 · Experimento — Usar -XX:+PrintCompilation para observar métodos sendo compilados pelo JIT durante um warm-up
- N3 · Entrevista — Explicar por que benchmarks Java sem warm-up produzem resultados enganosos
- N4 · Implementação — Implementar um lexer e um parser recursivo descendente para expressões com precedência de operadores

**Critérios de conclusão**
- [ ] Consigo nomear e explicar as fases de um compilador com um exemplo de expressão
- [ ] Sei explicar por que javac faz poucas otimizações e o JIT faz a maior parte
- [ ] Consigo argumentar quando native-image é vantajoso para um serviço backend e quando não é

#### 1.1.5 Preprocessing, compiling, assembling e linking

A cadeia de build nativa: preprocessing expande macros e includes, compiling gera assembly, assembling produz object files e linking resolve símbolos em um executável ou biblioteca. Conhecer essa cadeia explica erros de linkagem, bibliotecas estáticas vs. dinâmicas e paralelos com classpath e class loading na JVM. _(~90 min)_

**Objetivos**
- Executar e explicar cada fase separadamente com gcc (-E, -S, -c e linkagem)
- Explicar o conteúdo de um object file: código, dados, tabela de símbolos e relocations
- Diferenciar linkagem estática e dinâmica em tamanho do binário, atualização e dependências em runtime
- Diagnosticar erros de undefined reference e símbolo duplicado identificando a fase onde ocorrem
- Comparar o linking nativo com a resolução tardia de classes pela JVM via classpath e class loaders

**Pré-requisitos**
- [req] 1.1.4 Compilação — As fases detalhadas aqui são o desdobramento prático do processo de compilação

**Desafios planejados**
- N1 · Conceitual — Desenhar o fluxo .c → .i → .s → .o → executável indicando a ferramenta de cada etapa
- N2 · Programação — Compilar um projeto C com dois arquivos separadamente e linká-los manualmente
- N2 · Identificação de bugs — Corrigir um build que falha com undefined reference por função declarada mas não linkada
- N3 · Experimento — Comparar tamanho e dependências (ldd) de um binário linkado estática e dinamicamente
- N3 · Entrevista — Explicar a causa de NoSuchMethodError em runtime quando o projeto compilou sem erros
- N4 · Projeto — Criar uma biblioteca compartilhada própria e carregá-la de um programa principal com um Makefile

**Critérios de conclusão**
- [ ] Gerei manualmente os artefatos .i, .s, .o e o executável de um programa C e sei explicar cada um
- [ ] Consigo ler a tabela de símbolos de um object file com nm ou objdump
- [ ] Sei corrigir um erro de linkagem identificando o símbolo ausente
- [ ] Consigo explicar o equivalente Java de um erro de linkagem (NoClassDefFoundError, NoSuchMethodError)

#### 1.1.6 Endereços de memória

Como cada byte da memória é identificado por um endereço, o que são ponteiros e referências e como dados multi-byte são dispostos (endianness). É a base para entender stack, heap, referências Java, NullPointerException e falhas como segmentation fault. _(~75 min)_

**Objetivos**
- Explicar endereço de memória, ponteiro e aritmética de ponteiros com exemplos em C
- Diferenciar ponteiros em C de referências em Java e explicar por que Java não expõe endereços
- Explicar little-endian vs. big-endian e onde isso importa (protocolos de rede, formatos binários)
- Explicar a relação entre tamanho de ponteiro (32 vs. 64 bits) e espaço endereçável, incluindo compressed oops na JVM
- Explicar o que é um null pointer e por que desreferenciá-lo gera segfault em C e NullPointerException em Java

**Pré-requisitos**
- [rec] 1.1.2 RAM — Endereços identificam posições na RAM

**Desafios planejados**
- N1 · Conceitual — Explicar com um diagrama a diferença entre o valor de uma variável e o seu endereço
- N2 · Programação — Percorrer um array em C usando aritmética de ponteiros e imprimir endereço e valor de cada elemento
- N2 · Entrevista — Explicar por que reatribuir um parâmetro objeto dentro de um método Java não afeta o chamador
- N3 · Experimento — Usar ByteBuffer em Java para observar a mesma int em BIG_ENDIAN e LITTLE_ENDIAN
- N4 · Identificação de bugs — Encontrar e corrigir um dangling pointer em um programa C que retorna endereço de variável local

**Critérios de conclusão**
- [ ] Consigo imprimir e interpretar endereços de variáveis em C
- [ ] Sei explicar por que Java é passado por valor mesmo quando o valor é uma referência
- [ ] Consigo converter um inteiro de 32 bits entre little-endian e big-endian manualmente
- [ ] Sei explicar o ganho de memória de compressed oops

#### 1.1.7 Stack

A stack como região de memória LIFO por thread, gerenciada por stack pointer e frames, onde vivem variáveis locais e endereços de retorno. Sua alocação é quase gratuita, mas o tamanho é limitado, o que explica StackOverflowError e o cuidado com recursão profunda. _(~75 min)_

**Objetivos**
- Explicar como o stack pointer avança e recua ao alocar e liberar um frame
- Explicar por que a alocação na stack é tão barata e por que o tempo de vida é limitado ao escopo da função
- Explicar por que cada thread tem sua própria stack e como -Xss afeta profundidade de recursão e memória total
- Identificar o que fica na stack em Java (primitivos locais, referências) e o que não fica (objetos)
- Explicar como escape analysis permite à JVM evitar alocações no heap em alguns casos

**Pré-requisitos**
- [rec] 1.1.6 Endereços de memória — A stack é manipulada por endereços e pelo stack pointer

**Desafios planejados**
- N1 · Conceitual — Desenhar os frames da stack durante a execução de três funções aninhadas
- N2 · Experimento — Provocar um StackOverflowError controlado e ler o stack trace
- N3 · Experimento — Medir a profundidade máxima de recursão com diferentes valores de -Xss
- N3 · Entrevista — Explicar por que variáveis locais são thread-safe e objetos referenciados por elas não necessariamente
- N4 · Implementação — Converter um algoritmo recursivo profundo em iterativo usando uma pilha explícita

**Critérios de conclusão**
- [ ] Consigo desenhar a stack de um programa com três chamadas aninhadas
- [ ] Provoquei um StackOverflowError e sei explicar por que ocorreu
- [ ] Sei explicar o efeito de alterar -Xss em um servidor com milhares de threads
- [ ] Consigo dizer onde cada variável de um método Java de exemplo é armazenada

#### 1.1.8 Heap

O heap como região de memória para alocação dinâmica com tempo de vida independente do escopo da função. Seu custo de alocação, fragmentação e liberação — manual em C, automática via Garbage Collector em Java — impacta latência e consumo de memória de qualquer serviço backend. _(~90 min)_

**Objetivos**
- Explicar como a alocação no heap difere da stack em custo, tempo de vida e gerenciamento, e por que isso motiva o GC
- Explicar memory leak, double free e use-after-free em C e o equivalente de leak em Java (referências retidas)
- Explicar fragmentação de memória e como alocadores e GCs compactadores lidam com ela
- Explicar por que a JVM aloca objetos rapidamente via TLAB e bump pointer
- Explicar o que causa OutOfMemoryError: Java heap space e como diagnosticar com heap dump

**Pré-requisitos**
- [rec] 1.1.7 Stack — O heap é entendido em contraste com a stack
- [rec] 1.1.6 Endereços de memória — Objetos no heap são acessados por ponteiros/referências

**Desafios planejados**
- N1 · Conceitual — Comparar stack e heap em uma tabela de custo, tempo de vida, tamanho e responsável pela liberação
- N2 · Identificação de bugs — Encontrar memory leak e use-after-free em um programa C usando AddressSanitizer
- N3 · Experimento — Provocar OutOfMemoryError com um cache estático sem limite e analisar o heap dump
- N3 · Entrevista — Explicar por que alocar objetos em Java é barato, mas criar muitos objetos de vida curta ainda tem custo
- N4 · Implementação — Implementar um alocador simples de bloco fixo (free list) em C e medir fragmentação

**Critérios de conclusão**
- [ ] Consigo justificar quando um dado precisa ir para o heap e não pode ficar na stack
- [ ] Escrevi um programa C com malloc/free sem leaks verificado por ferramenta (ex.: valgrind ou sanitizer)
- [ ] Provoquei um OutOfMemoryError em Java e identifiquei a causa em um heap dump
- [ ] Sei explicar um memory leak em Java mesmo com Garbage Collector

#### 1.1.9 Call Stack

A call stack como a sequência de frames ativos que registra quais funções chamaram quais, com seus parâmetros, locais e endereços de retorno. Dominar esse modelo é essencial para ler stack traces, depurar exceções, entender recursão e interpretar thread dumps e profilers. _(~75 min)_

**Objetivos**
- Explicar o que um stack frame contém e como o endereço de retorno permite voltar ao chamador
- Descrever o fluxo de chamada e retorno, incluindo como exceções desempilham frames até um handler
- Ler um stack trace Java identificando causa raiz, frames próprios vs. de bibliotecas e cláusulas Caused by
- Explicar o custo de chamadas de função e como inlining pelo JIT o elimina
- Interpretar um thread dump e um flame graph como fotografias da call stack

**Pré-requisitos**
- [req] 1.1.7 Stack — A call stack é a stack de frames; sem o modelo da stack não é possível entendê-la

**Desafios planejados**
- N1 · Conceitual — Desenhar a call stack de um fatorial recursivo para n = 4 em cada momento da execução
- N2 · Análise de código — Ler um stack trace real de uma aplicação Spring e apontar a causa raiz e o frame do código próprio
- N2 · Identificação de bugs — Corrigir uma exceção cujo stack trace é perdido por um catch que relança sem a causa
- N3 · Experimento — Capturar thread dumps com jstack de uma aplicação travada e identificar a thread bloqueada
- N4 · Experimento — Gerar um flame graph com async-profiler e identificar o método mais custoso

**Critérios de conclusão**
- [ ] Consigo prever o stack trace de um programa com chamadas aninhadas antes de executá-lo
- [ ] Sei encontrar a causa raiz em um stack trace com várias exceções encadeadas
- [ ] Gerei e interpretei um thread dump (jstack) de uma aplicação em execução
- [ ] Consigo explicar como uma exceção percorre a call stack até ser capturada

### 1.2 Sistema operacional, processos e memória (9 tópicos)

**[Adicional]** Apresenta o sistema operacional como gerenciador de CPU, memória e dispositivos, e as abstrações que ele oferece aos programas: processos, threads, address space e memória virtual. Aborda o custo real de context switches, o funcionamento de paging e o caminho de uma operação de I/O até o hardware. Esses conceitos explicam o comportamento de servidores Java sob carga, de thread pools, de virtual threads e de containers com limites de memória.

Objetivos do módulo:
- Explicar a separação entre user mode e kernel mode e o papel das system calls
- Comparar processos e threads em isolamento, custo de criação, comunicação e falhas
- Estimar o impacto de context switches e de excesso de threads no throughput de um servidor
- Descrever como memória virtual, page tables, TLB e page faults funcionam juntos
- Diferenciar I/O bloqueante e não bloqueante e relacionar isso ao modelo de concorrência de servidores backend

#### 1.2.1 Sistema operacional

O sistema operacional como camada que gerencia CPU, memória, armazenamento e dispositivos, isolando programas entre si. Entender kernel, user mode, kernel mode e system calls explica o custo de operações como I/O e criação de threads e o comportamento de containers. _(~75 min)_

**Objetivos**
- Explicar as responsabilidades do kernel: escalonamento, gerenciamento de memória, sistema de arquivos, drivers e rede
- Diferenciar user mode e kernel mode e explicar por que essa separação garante proteção
- Explicar o que é uma system call, como ocorre a transição de modo e por que ela tem custo
- Comparar kernels monolíticos e microkernels em desempenho e isolamento
- Explicar como containers usam recursos do kernel (namespaces e cgroups) sem virtualizar hardware

**Pré-requisitos**
- [rec] 1.1.1 CPU — Os modos de privilégio são um recurso da CPU que o SO utiliza

**Desafios planejados**
- N1 · Conceitual — Mapear quais responsabilidades do SO são acionadas ao executar um programa que lê um arquivo
- N2 · Experimento — Rastrear com strace as system calls de um programa Java que lê um arquivo e identificar open, read e close
- N3 · Experimento — Comparar o tempo de 1 milhão de escritas de 1 byte sem buffer vs. com BufferedOutputStream e explicar pelo custo de syscalls
- N3 · Entrevista — Explicar a diferença entre container e VM e por que a JVM precisa reconhecer limites de cgroups
- N4 · Implementação — Escrever um mini-shell em C que executa comandos usando fork, exec e wait

**Critérios de conclusão**
- [ ] Consigo listar as system calls feitas por um programa simples usando strace ou ferramenta equivalente
- [ ] Sei explicar por que um programa não pode acessar diretamente o disco ou a memória de outro processo
- [ ] Consigo explicar a diferença entre container e máquina virtual em termos de kernel

#### 1.2.2 Processo

O processo como programa em execução com address space próprio, recursos (file descriptors, sockets) e estado gerenciado pelo SO via PCB. É a unidade de isolamento: uma JVM é um processo, e falhas, limites de memória e sinais atuam sobre ele. _(~75 min)_

**Objetivos**
- Diferenciar programa (arquivo executável) de processo (instância em execução)
- Descrever o layout de memória de um processo: text, data, BSS, heap e stack
- Explicar os estados de um processo (new, ready, running, waiting, terminated) e as transições
- Explicar criação de processos (fork/exec, spawn), processos zumbi e órfãos
- Explicar sinais como SIGTERM e SIGKILL e sua relação com graceful shutdown de serviços Java

**Pré-requisitos**
- [rec] 1.1.8 Heap — O layout de memória do processo inclui as regiões de heap e stack
- [rec] 1.1.5 Preprocessing, compiling, assembling e linking — O processo nasce do carregamento de um executável produzido pelo linker

**Desafios planejados**
- N1 · Conceitual — Desenhar o diagrama de estados de um processo e descrever o evento de cada transição
- N2 · Experimento — Inspecionar o mapa de memória de um processo via /proc/<pid>/maps e identificar cada região
- N2 · Programação — Iniciar e monitorar um processo filho em Java com ProcessBuilder, lendo stdout e exit code
- N3 · Experimento — Comparar o comportamento de shutdown hooks ao enviar SIGTERM vs. SIGKILL para uma JVM
- N4 · Identificação de bugs — Diagnosticar processos zumbi gerados por um programa C que não chama wait

**Critérios de conclusão**
- [ ] Consigo desenhar o layout de memória de um processo e dizer onde ficam código, globais, heap e stack
- [ ] Sei listar processos, ver seus recursos e encerrá-los com sinais diferentes
- [ ] Implementei um shutdown hook em Java e observei a diferença entre SIGTERM e SIGKILL
- [ ] Consigo explicar o que é um processo zumbi e como evitá-lo

#### 1.2.3 Thread

A thread como unidade de execução escalonável dentro de um processo, com stack e registradores próprios mas compartilhando heap e recursos. Threads são a base da concorrência em servidores Java, e seu custo de memória e escalonamento explica thread pools e virtual threads. _(~90 min)_

**Objetivos**
- Explicar o que cada thread possui exclusivamente (stack, registradores, PC) e o que compartilha (heap, código, file descriptors)
- Explicar o mapeamento 1:1 de platform threads Java para threads do SO e seu custo de memória
- Explicar por que memória compartilhada gera race conditions e a necessidade de sincronização
- Descrever os estados de uma thread Java (NEW, RUNNABLE, BLOCKED, WAITING, TIMED_WAITING, TERMINATED)
- Explicar a motivação de thread pools e de virtual threads em servidores com muitas requisições simultâneas

**Pré-requisitos**
- [req] 1.2.2 Processo — Threads existem dentro de um processo e compartilham seus recursos
- [rec] 1.1.9 Call Stack — Cada thread tem a sua própria call stack

**Desafios planejados**
- N1 · Conceitual — Classificar stack, heap, PC, registradores e file descriptors como próprios da thread ou compartilhados
- N2 · Identificação de bugs — Reproduzir e corrigir uma race condition em um contador incrementado por 10 threads
- N3 · Experimento — Criar threads até falhar e observar o erro unable to create native thread e o consumo de memória
- N3 · Experimento — Comparar o tempo e a memória de 10.000 tarefas bloqueantes com platform threads vs. virtual threads
- N4 · Implementação — Implementar um thread pool simples com fila de tarefas e workers fixos

**Critérios de conclusão**
- [ ] Consigo dizer, para um trecho de código, quais dados são compartilhados entre threads e quais não são
- [ ] Reproduzi uma race condition em um contador e corrigi com sincronização
- [ ] Sei estimar a memória consumida por milhares de platform threads
- [ ] Consigo identificar estados de threads em um thread dump

#### 1.2.4 Process vs Thread

Comparação entre processos e threads em isolamento, custo de criação, comunicação, consumo de memória e impacto de falhas. Essa escolha aparece em decisões reais de arquitetura, como multi-process vs. multi-thread, workers isolados e o modelo de um serviço Java em um único processo. _(~60 min)_

**Objetivos**
- Comparar processos e threads em isolamento de memória, custo de criação e custo de troca
- Comparar mecanismos de comunicação: memória compartilhada entre threads vs. IPC entre processos (pipes, sockets, arquivos)
- Explicar o impacto de uma falha: crash de thread vs. crash de processo
- Analisar arquiteturas reais (ex.: Chrome multi-processo, Nginx workers, JVM multi-thread) e justificar suas escolhas
- Escolher entre processos e threads para um cenário dado justificando por segurança, desempenho e simplicidade

**Pré-requisitos**
- [req] 1.2.2 Processo — A comparação exige entender processos
- [req] 1.2.3 Thread — A comparação exige entender threads

**Desafios planejados**
- N1 · Conceitual — Construir uma tabela comparativa processo vs. thread em isolamento, custo, comunicação e falhas
- N2 · Experimento — Medir o tempo para criar 1.000 threads vs. 1.000 processos e explicar a diferença
- N3 · Entrevista — Justificar por que navegadores usam um processo por aba enquanto servidores Java usam threads
- N3 · Análise de código — Analisar o impacto de uma exceção não tratada em uma thread de pool vs. um System.exit em um worker
- N4 · Projeto — Implementar o mesmo processador de jobs com workers em threads e em processos e comparar throughput e isolamento

**Critérios de conclusão**
- [ ] Consigo montar uma tabela comparativa com pelo menos cinco critérios
- [ ] Medi o custo de criação de processos vs. threads em um experimento
- [ ] Consigo justificar a arquitetura de um sistema real conhecido em termos de processos e threads

#### 1.2.5 Context Switch

O context switch como a troca da thread em execução na CPU, salvando e restaurando registradores e possivelmente trocando o address space. Seu custo direto e indireto (cache e TLB frios) limita quantas threads um servidor consegue usar com eficiência. _(~60 min)_

**Objetivos**
- Descrever o que é salvo e restaurado em um context switch e quem o dispara (timer interrupt, bloqueio em I/O, yield)
- Diferenciar o custo de trocar entre threads do mesmo processo e entre processos diferentes
- Explicar o custo indireto do context switch: invalidação de cache e TLB
- Explicar escalonamento preemptivo vs. cooperativo e o papel do time slice
- Relacionar excesso de threads com perda de throughput e justificar o dimensionamento de thread pools

**Pré-requisitos**
- [rec] 1.2.3 Thread — O context switch troca threads em execução
- [rec] 1.1.1 CPU — O custo envolve registradores e cache da CPU

**Desafios planejados**
- N1 · Conceitual — Listar o estado salvo em um context switch e explicar por que trocar de processo custa mais
- N2 · Experimento — Observar a taxa de context switches com vmstat enquanto uma aplicação Java cria centenas de threads
- N3 · Experimento — Medir o throughput de uma tarefa CPU-bound com 1, N cores e 50x N cores de threads e explicar a curva
- N3 · Entrevista — Responder: por que aumentar o pool de threads de 200 para 2.000 piorou a latência do serviço?
- N4 · Implementação — Implementar um escalonador cooperativo de corrotinas simples e comparar com threads preemptivas

**Critérios de conclusão**
- [ ] Consigo explicar passo a passo o que acontece em um context switch
- [ ] Medi context switches de um processo com ferramentas do SO (vmstat, pidstat ou equivalente)
- [ ] Sei justificar um tamanho de thread pool para tarefas CPU-bound vs. I/O-bound

#### 1.2.6 Virtual Memory

A memória virtual como abstração que dá a cada processo a ilusão de uma memória contínua e exclusiva, traduzida para memória física pela MMU. Ela garante isolamento, permite overcommit e swap e explica a diferença entre memória reservada e residente de uma JVM. _(~75 min)_

**Objetivos**
- Explicar a tradução de endereço virtual para físico feita pela MMU e o papel do SO
- Explicar como a memória virtual garante isolamento e proteção entre processos
- Diferenciar memória virtual reservada (VSZ) de memória residente (RSS) e interpretar esses valores para uma JVM
- Explicar overcommit, swap e por que swap degrada drasticamente a latência
- Explicar memory-mapped files e seu uso em bancos de dados e na leitura de arquivos grandes

**Pré-requisitos**
- [rec] 1.1.6 Endereços de memória — A memória virtual é um mapeamento entre espaços de endereços
- [rec] 1.2.2 Processo — Cada processo tem sua própria visão de memória virtual

**Desafios planejados**
- N1 · Conceitual — Explicar com um diagrama como dois processos usam o mesmo endereço virtual apontando para frames físicos diferentes
- N2 · Experimento — Comparar VSZ e RSS de uma JVM antes e depois de tocar em um array grande alocado
- N3 · Experimento — Ler um arquivo grande com FileChannel.map e comparar com leitura via InputStream
- N3 · Entrevista — Explicar por que é recomendado desabilitar ou limitar swap em servidores de aplicação
- N4 · Programação — Escrever um programa C que reserva 10 GB com mmap sem usá-los e explicar por que não falha

**Critérios de conclusão**
- [ ] Consigo explicar por que dois processos podem usar o mesmo endereço virtual sem conflito
- [ ] Sei interpretar VSZ e RSS de uma JVM e explicar por que VSZ é muito maior
- [ ] Consigo explicar o impacto de swap em um serviço com requisitos de latência

#### 1.2.7 Address Space

O address space como o conjunto de endereços virtuais válidos de um processo, organizado em regiões (código, dados, heap, stack, bibliotecas, mapeamentos) com permissões próprias. Entendê-lo explica segmentation faults, ASLR e onde a JVM posiciona heap, metaspace e code cache. _(~60 min)_

**Objetivos**
- Descrever as regiões do address space e as permissões de cada uma (leitura, escrita, execução)
- Explicar como o tamanho do address space em 32 vs. 64 bits limita a memória utilizável
- Explicar por que acessar endereço não mapeado ou violar permissões gera segmentation fault
- Explicar ASLR e o bit NX como defesas contra exploração de memória
- Identificar no address space de uma JVM o heap Java, metaspace, code cache e stacks das threads

**Pré-requisitos**
- [req] 1.2.6 Virtual Memory — O address space é definido sobre a memória virtual
- [rec] 1.1.8 Heap — Heap e stack são regiões do address space

**Desafios planejados**
- N1 · Conceitual — Desenhar o address space de um processo 64 bits com as regiões e suas permissões
- N2 · Experimento — Executar o mesmo programa C várias vezes e observar a variação de endereços causada por ASLR
- N2 · Identificação de bugs — Diagnosticar um segmentation fault causado por escrita em string literal em região somente leitura
- N3 · Experimento — Usar Native Memory Tracking (-XX:NativeMemoryTracking) para mapear as áreas de memória de uma JVM
- N4 · Entrevista — Explicar por que uma JVM com -Xmx2g pode ocupar 3 GB de RSS em um container

**Critérios de conclusão**
- [ ] Consigo ler o mapa de memória de um processo e identificar cada região e suas permissões
- [ ] Sei explicar por que um processo 32 bits não usa mais que ~4 GB
- [ ] Consigo explicar uma causa concreta de segmentation fault em termos de address space

#### 1.2.8 Paging

Paging como mecanismo que divide a memória virtual em páginas e a física em frames, traduzindo endereços via page tables e acelerando a tradução com a TLB. Page faults, huge pages e thrashing explicam picos de latência e decisões de tuning em servidores e bancos de dados. _(~90 min)_

**Objetivos**
- Explicar como um endereço virtual é dividido em número de página e offset e traduzido via page table
- Explicar page tables multinível e por que existem
- Explicar o papel da TLB e o impacto de TLB misses no desempenho
- Diferenciar minor page fault e major page fault e estimar o custo de cada um
- Explicar thrashing, huge pages e quando habilitar huge pages para a JVM ou um banco de dados

**Pré-requisitos**
- [req] 1.2.6 Virtual Memory — Paging é a implementação da memória virtual
- [rec] 1.1.1 CPU — A TLB é um cache da CPU

**Desafios planejados**
- N1 · Conceitual — Traduzir manualmente endereços virtuais para físicos com páginas de 4 KB e uma page table dada
- N2 · Experimento — Medir minor e major page faults de um processo com /usr/bin/time -v ou perf
- N3 · Experimento — Comparar o tempo de inicialização de uma JVM com -XX:+AlwaysPreTouch e sem a flag e explicar pelos page faults
- N3 · Entrevista — Explicar como huge pages reduzem TLB misses e quais os riscos de transparent huge pages em bancos de dados
- N4 · Implementação — Implementar um simulador de paging com TLB e algoritmos de substituição FIFO e LRU

**Critérios de conclusão**
- [ ] Consigo traduzir manualmente um endereço virtual para físico dado tamanho de página e uma page table
- [ ] Sei diferenciar minor e major page faults e medi-los em um processo
- [ ] Consigo explicar o que é thrashing e como identificá-lo em um servidor

#### 1.2.9 I/O

Como programas realizam I/O com disco, rede e dispositivos através do SO: system calls, buffers, interrupções, DMA e page cache. A diferença entre I/O bloqueante, não bloqueante e multiplexado (epoll) é a base de modelos de servidor como thread-per-request, NIO, Netty e virtual threads. _(~90 min)_

**Objetivos**
- Descrever o caminho de uma leitura de arquivo desde a system call até o dispositivo, incluindo page cache e DMA
- Explicar o papel dos buffers em user space e kernel space e o custo de cópias entre eles
- Diferenciar I/O bloqueante, não bloqueante, multiplexado (select/epoll) e assíncrono
- Explicar por que threads bloqueadas em I/O desperdiçam recursos e como NIO e virtual threads abordam o problema
- Explicar fsync, durabilidade e por que um write bem-sucedido não garante dados no disco

**Pré-requisitos**
- [rec] 1.2.1 Sistema operacional — I/O é realizado via system calls e drivers do kernel
- [rec] 1.2.5 Context Switch — Bloqueio em I/O provoca context switches e influencia o modelo de threads

**Desafios planejados**
- N1 · Conceitual — Descrever o caminho completo de um read() de arquivo até o disco e de volta, incluindo page cache
- N2 · Experimento — Medir a leitura de um arquivo grande com cache frio vs. quente e explicar pelo page cache
- N2 · Programação — Comparar cópia de arquivo com buffers de 1 byte, 8 KB e 1 MB e explicar a curva de desempenho
- N3 · Entrevista — Explicar a diferença entre I/O não bloqueante e assíncrono e onde Netty e virtual threads se encaixam
- N4 · Projeto — Implementar um servidor echo TCP com Java NIO Selector e comparar com a versão thread-per-connection sob carga

**Critérios de conclusão**
- [ ] Consigo explicar por que a segunda leitura de um arquivo é mais rápida que a primeira
- [ ] Sei comparar o modelo thread-per-request com um event loop baseado em epoll
- [ ] Implementei um servidor que atende múltiplas conexões sem uma thread por conexão
- [ ] Consigo explicar quando um write está realmente durável

## 02 — LeetCode

*Estruturas de dados, algoritmos e análise de complexidade (Big O) aplicados aos problemas das entrevistas de código. O objetivo é reconhecer padrões como two pointers, sliding window, BFS/DFS e programação dinâmica, e resolver problemas Easy e Medium no tempo de uma entrevista.*

### 2.1 Big O e estruturas de dados fundamentais (9 tópicos)

**[Adicional]** Base de análise de algoritmos e das estruturas lineares sobre as quais todo o resto é construído. Introduz como medir custo de tempo e espaço (pior caso, caso médio, amortizado) e examina por dentro array, array dinâmico, lista ligada, stack, queue e deque, sempre relacionando o modelo de memória (contiguidade, ponteiros, cache) com o custo real de cada operação e com as implementações do Java (ArrayList, LinkedList, ArrayDeque).

Objetivos do módulo:
- Analisar a complexidade de tempo e espaço de um trecho de código, incluindo custo amortizado e espaço da recursão
- Usar Big O, Big Omega e Big Theta com rigor e saber quando as constantes e o hardware importam na prática
- Explicar o layout em memória de arrays e listas ligadas e o impacto disso em acesso, inserção e localidade de cache
- Comparar ArrayList, LinkedList e ArrayDeque do Java com base em custos reais, não em intuição
- Implementar do zero array dinâmico, lista ligada, stack, queue e deque com suas invariantes corretas

#### 2.1.1 Time Complexity

Como medir o crescimento do número de operações de um algoritmo em função do tamanho da entrada, considerando pior caso, caso médio e custo amortizado. É a ferramenta que permite comparar soluções antes de executá-las e justificar escolhas em entrevistas. _(~90 min)_

**Objetivos**
- Contar operações dominantes em laços simples, aninhados e dependentes (ex.: j de i até n)
- Diferenciar pior caso, melhor caso, caso médio e custo amortizado com exemplos
- Reconhecer as classes O(1), O(log n), O(n), O(n log n), O(n²), O(2^n) e O(n!) e estimar o n máximo viável para cada uma em ~1 segundo
- Analisar complexidade com múltiplas variáveis de entrada (ex.: O(n + m), O(n·m))
- Identificar custos escondidos em chamadas de biblioteca (String concatenation, list.contains, substring)

**Pré-requisitos**
- [rec] 1.1.1 CPU — Entender que a CPU executa instruções a uma taxa finita ajuda a relacionar contagem de operações com tempo real

**Desafios planejados**
- N1 · Conceitual — Explicar a diferença entre pior caso, caso médio e custo amortizado usando busca em array
- N2 · Análise de código — Determinar a complexidade de tempo de 8 trechos com laços aninhados, dependentes e logarítmicos
- N2 · Identificação de bugs — Encontrar o custo O(n²) escondido em um laço que concatena Strings e chama list.contains
- N3 · Experimento — Medir em Java o tempo de algoritmos O(n), O(n log n) e O(n²) para n crescente e plotar as curvas
- N3 · Entrevista — Dadas as restrições n ≤ 10^5, justificar por que uma solução O(n²) não passa e qual classe é necessária
- N4 · Implementação — Construir um mini-harness de benchmark que detecte empiricamente a classe de complexidade de uma função

**Critérios de conclusão**
- [ ] Determino a complexidade de tempo de 10 trechos de código variados sem errar a classe
- [ ] Explico por que dois laços aninhados nem sempre são O(n²)
- [ ] Estimo, a partir de restrições de um problema (ex.: n ≤ 10^5), qual complexidade é aceitável
- [ ] Aponto pelo menos dois custos escondidos de APIs do Java em código real

#### 2.1.2 Space Complexity

Quanto de memória adicional um algoritmo consome em função da entrada, incluindo estruturas auxiliares e a profundidade da pilha de chamadas. Importa porque memória é limitada, afeta cache e GC, e entrevistadores frequentemente pedem soluções in-place. _(~60 min)_

**Objetivos**
- Distinguir espaço de entrada, espaço auxiliar e espaço total
- Calcular o espaço consumido pela recursão a partir da profundidade máxima da call stack
- Explicar o trade-off tempo × espaço com exemplos (memoização, tabelas hash, pré-computação)
- Estimar o consumo real de memória de estruturas Java (overhead de objetos, boxing de Integer, referências)
- Reconhecer quando uma solução in-place é possível e quais riscos ela traz (mutação da entrada)

**Pré-requisitos**
- [rec] 1.1.9 Call Stack — O espaço da recursão é a profundidade da call stack
- [rec] 1.1.8 Heap — Estruturas auxiliares em Java vivem no heap e geram pressão no GC
- [rec] 2.1.1 Time Complexity — A mesma notação assintótica é usada para espaço

**Desafios planejados**
- N1 · Conceitual — Explicar a diferença entre espaço auxiliar e espaço total e por que a entrada geralmente não conta
- N2 · Análise de código — Calcular o espaço de versões recursiva e iterativa de fatorial, Fibonacci e soma de array
- N2 · Programação — Reverter um array in-place com espaço O(1) e comparar com a versão que aloca cópia
- N3 · Experimento — Medir com Runtime/JOL o consumo de int[] versus ArrayList<Integer> com 1 milhão de elementos
- N3 · Entrevista — Discutir o trade-off tempo × espaço ao usar memoização em Fibonacci versus a versão com duas variáveis
- N4 · Projeto — Construir um utilitário que estime e compare o footprint de memória de estruturas Java (arrays, ArrayList, HashMap) para n crescente

**Critérios de conclusão**
- [ ] Calculo o espaço auxiliar de soluções iterativas e recursivas, incluindo a pilha
- [ ] Explico por que int[] e List<Integer> com n elementos têm consumos muito diferentes
- [ ] Transformo uma solução com espaço O(n) em O(1) quando o problema permite

#### 2.1.3 Big O

A notação assintótica formal (O, Ω, Θ) e as regras de simplificação usadas para classificar algoritmos. Cobre também os limites da notação: constantes, termos de baixa ordem e efeitos de hardware que fazem um O(n log n) perder para um O(n²) em entradas pequenas. _(~75 min)_

**Objetivos**
- Definir formalmente O, Ω e Θ e aplicar as definições para provar limites simples
- Aplicar regras de simplificação: descartar constantes, termos dominados, soma e produto de custos
- Ordenar funções por taxa de crescimento (log n, √n, n, n log n, n², 2^n, n!)
- Explicar por que Big O descreve um limite superior e não necessariamente o caso real
- Reconhecer situações em que constantes e localidade de cache dominam a escolha prática (ex.: insertion sort em arrays pequenos no TimSort)

**Pré-requisitos**
- [req] 2.1.1 Time Complexity — A notação formaliza a análise de complexidade de tempo

**Desafios planejados**
- N1 · Conceitual — Diferenciar O, Ω e Θ e explicar por que 'busca binária é O(n)' é tecnicamente verdadeiro mas pouco útil
- N2 · Programação — Ordenar por crescimento um conjunto de 10 funções e justificar cada comparação
- N2 · Entrevista — Simplificar expressões de custo como O(2n + n log n + 100) e O(n·m + m²) explicando cada passo
- N3 · Experimento — Encontrar empiricamente o ponto de cruzamento entre insertion sort e merge sort em Java
- N4 · Projeto — Criar uma tabela de referência pessoal de complexidades das operações do Java Collections com justificativa de cada uma

**Critérios de conclusão**
- [ ] Ordeno corretamente 10 funções por taxa de crescimento
- [ ] Provo pela definição que 3n² + 5n + 2 é Θ(n²)
- [ ] Explico com um exemplo real quando o algoritmo assintoticamente pior vence na prática

#### 2.1.4 Array

Array como bloco contíguo de memória com elementos de tamanho fixo, o que permite acesso por índice em O(1) via cálculo de endereço. Entender sua representação explica os custos de inserção/remoção, a vantagem de localidade de cache e como arrays funcionam na JVM. _(~60 min)_

**Objetivos**
- Explicar o cálculo de endereço base + índice × tamanho do elemento e por que o acesso é O(1)
- Analisar o custo de inserção e remoção no meio, no início e no fim de um array
- Explicar a localidade espacial e o impacto do cache da CPU na iteração sobre arrays
- Descrever como arrays de primitivos e de referências são armazenados no heap da JVM (header, length, elementos)
- Usar corretamente System.arraycopy, Arrays.fill, Arrays.copyOf e arrays multidimensionais em Java

**Pré-requisitos**
- [rec] 1.1.6 Endereços de memória — O acesso por índice é aritmética de endereços de memória
- [rec] 1.1.2 RAM — Contiguidade e cache dependem do modelo de RAM

**Desafios planejados**
- N1 · Conceitual — Explicar como o endereço de arr[i] é calculado e por que isso exige tamanho fixo de elemento
- N2 · Programação — Implementar insertAt e removeAt em um int[] com deslocamento via System.arraycopy
- N2 · Identificação de bugs — Corrigir um laço de remoção em array que pula elementos e gera ArrayIndexOutOfBoundsException
- N3 · Experimento — Comparar o tempo de percorrer int[][] por linhas versus por colunas e explicar o resultado pelo cache
- N3 · Experimento — Medir a diferença de desempenho entre somar int[] e Integer[] com 10 milhões de elementos
- N4 · Implementação — Implementar uma matriz esparsa e uma matriz densa em array unidimensional (row-major) e comparar memória e tempo de acesso

**Critérios de conclusão**
- [ ] Explico por que o acesso por índice é O(1) e inserir no início é O(n)
- [ ] Diferencio em memória int[] de Integer[] e explico o custo de indireção
- [ ] Implemento inserção e remoção em posição arbitrária com deslocamento correto
- [ ] Explico por que percorrer uma matriz por linhas é mais rápido que por colunas em Java

#### 2.1.5 Dynamic Array

Array dinâmico (ArrayList) que cresce realocando um array interno maior e copiando os elementos. A análise amortizada mostra por que append continua O(1) em média, e entender capacidade, fator de crescimento e cópias evita armadilhas de desempenho. _(~75 min)_

**Objetivos**
- Explicar a diferença entre size e capacity e o processo de crescimento por realocação e cópia
- Demonstrar com análise amortizada (método agregado ou do banqueiro) que append é O(1) amortizado
- Explicar por que crescimento por fator multiplicativo é necessário e o que acontece com crescimento aditivo
- Descrever a implementação do ArrayList do Java (fator 1,5, ensureCapacity, trimToSize, modCount e fail-fast)
- Identificar o custo de remove(0), add(0, x) e remoção durante iteração

**Pré-requisitos**
- [req] 2.1.4 Array — O array dinâmico é construído sobre um array de tamanho fixo
- [rec] 2.1.1 Time Complexity — A análise amortizada é central para justificar o custo de append

**Desafios planejados**
- N1 · Conceitual — Explicar por que append em ArrayList é O(1) amortizado mesmo com cópias ocasionais O(n)
- N2 · Implementação — Implementar DynamicArray<T> com add, get, set, remove, crescimento por fator e encolhimento
- N2 · Identificação de bugs — Corrigir um código que remove elementos de ArrayList dentro de for-each e lança ConcurrentModificationException
- N3 · Experimento — Comparar o tempo de inserir 10 milhões de elementos com crescimento aditivo (+10) versus multiplicativo (×1,5)
- N3 · Análise de código — Ler o código-fonte de ArrayList.grow no JDK e explicar o cálculo da nova capacidade
- N4 · Entrevista — Explicar por que encolher a capacidade pela metade quando size = capacity/2 causa thrashing e como evitar

**Critérios de conclusão**
- [ ] Provo que n appends custam O(n) no total com crescimento por dobra
- [ ] Implemento um array dinâmico genérico com crescimento e encolhimento sem thrashing
- [ ] Explico quando usar new ArrayList<>(capacidade) e o ganho obtido
- [ ] Explico a origem de ConcurrentModificationException em iteração com remoção

#### 2.1.6 Linked List

Lista ligada como cadeia de nós alocados separadamente e ligados por referências, com variações simples, dupla e circular. Aqui o foco é a estrutura em si: custos de cada operação, overhead de memória e por que, na prática, ela costuma perder para arrays por causa do cache. _(~75 min)_

**Objetivos**
- Implementar listas simples e duplamente ligadas com nós sentinela (dummy head/tail)
- Analisar o custo de inserção, remoção e busca em cada posição, distinguindo 'remover dado o nó' de 'remover dado o valor'
- Explicar o overhead de memória por nó e o efeito de ponteiros espalhados no heap sobre o cache
- Descrever como java.util.LinkedList é implementada (duplamente ligada, implementa List e Deque)
- Justificar com dados quando LinkedList é ou não preferível a ArrayList

**Pré-requisitos**
- [rec] 1.1.8 Heap — Cada nó é um objeto alocado individualmente no heap
- [rec] 1.1.6 Endereços de memória — Referências entre nós são, conceitualmente, endereços de memória
- [rec] 2.1.4 Array — Comparar com o layout contíguo do array é essencial para entender os custos

**Desafios planejados**
- N1 · Conceitual — Comparar lista ligada e array quanto a acesso, inserção, memória e localidade de cache
- N2 · Implementação — Implementar uma DoublyLinkedList<T> com nós sentinela e Iterator próprio
- N2 · Identificação de bugs — Encontrar o erro de atualização de ponteiros que corrompe a lista ao remover o último nó
- N3 · Experimento — Medir iteração e inserção no meio em ArrayList versus LinkedList com 1 milhão de elementos
- N3 · Análise de código — Identificar por que um for indexado sobre LinkedList com get(i) é O(n²) e reescrevê-lo
- N4 · Implementação — Implementar uma lista ligada com free list própria (pool de nós em arrays paralelos) e comparar com java.util.LinkedList

**Critérios de conclusão**
- [ ] Implemento lista duplamente ligada com addFirst, addLast, remove(nó) e iteração sem vazamento de referências
- [ ] Explico por que get(i) em LinkedList é O(n) e por que isso torna for indexado O(n²)
- [ ] Apresento medição mostrando ArrayList vencendo LinkedList em iteração e inserção no fim

#### 2.1.7 Stack

Stack como tipo abstrato LIFO com push, pop e peek em O(1), implementável sobre array ou lista ligada. O tópico cobre a estrutura em si, sua relação com a call stack e por que em Java se usa ArrayDeque em vez da classe legada Stack. _(~45 min)_

**Objetivos**
- Definir a interface LIFO e as invariantes de push, pop e peek
- Implementar stack sobre array dinâmico e sobre lista ligada, comparando custos
- Relacionar a estrutura stack com a call stack de execução e com a conversão de recursão em iteração
- Explicar por que java.util.Stack (herda de Vector, sincronizada) é desaconselhada e ArrayDeque é a escolha padrão
- Tratar corretamente underflow e overflow

**Pré-requisitos**
- [rec] 1.1.7 Stack — A região de memória stack é a aplicação mais conhecida da estrutura LIFO
- [rec] 2.1.5 Dynamic Array — A implementação mais eficiente usa array dinâmico

**Desafios planejados**
- N1 · Conceitual — Explicar a relação e a diferença entre a estrutura de dados stack e a call stack
- N2 · Implementação — Implementar ArrayStack<T> com push, pop, peek e isEmpty, lançando exceção em underflow
- N2 · Programação — Converter uma travessia recursiva de árvore em iterativa usando uma stack explícita
- N3 · Experimento — Comparar o desempenho de java.util.Stack e ArrayDeque em 10 milhões de push/pop
- N3 · Entrevista — Responder por que a documentação do Java recomenda Deque em vez de Stack
- N4 · Projeto — Construir um editor de texto de linha com undo/redo usando duas stacks

**Critérios de conclusão**
- [ ] Implemento stack genérica sobre array com crescimento e tratamento de pilha vazia
- [ ] Explico a diferença entre a estrutura stack e a região stack de memória
- [ ] Justifico o uso de Deque<T> stack = new ArrayDeque<>() em código Java

#### 2.1.8 Queue

Queue como tipo abstrato FIFO com enqueue e dequeue em O(1), implementável com buffer circular ou lista ligada. Entender o buffer circular e as interfaces Queue do Java é base para BFS, filas de tarefas e sistemas produtor-consumidor. _(~50 min)_

**Objetivos**
- Definir a interface FIFO e as operações offer, poll e peek
- Implementar queue com array circular, controlando head, tail e size com aritmética modular
- Explicar por que remover do início de um array comum é O(n) e como o buffer circular resolve isso
- Diferenciar os métodos que lançam exceção (add/remove/element) dos que retornam valor especial (offer/poll/peek) na interface Queue
- Conhecer o papel de BlockingQueue em sistemas concorrentes e de filas em servidores reais

**Pré-requisitos**
- [rec] 2.1.4 Array — O buffer circular é um array com índices modulares

**Desafios planejados**
- N1 · Conceitual — Explicar por que usar ArrayList.remove(0) como fila é O(n) por operação
- N2 · Implementação — Implementar CircularQueue<T> com crescimento que reorganiza os elementos na ordem correta
- N2 · Identificação de bugs — Corrigir a condição de fila cheia/vazia em um buffer circular que perde elementos
- N3 · Programação — Implementar uma fila usando duas stacks e provar que dequeue é O(1) amortizado
- N4 · Projeto — Construir um simulador produtor-consumidor com ArrayBlockingQueue e medir throughput com diferentes capacidades

**Critérios de conclusão**
- [ ] Implemento um buffer circular com crescimento sem perder a ordem dos elementos
- [ ] Explico a diferença entre offer/poll e add/remove em Java
- [ ] Distingo fila cheia de fila vazia sem desperdiçar posição ou com contador explícito

#### 2.1.9 Deque

Deque (double-ended queue) permite inserção e remoção em O(1) nas duas pontas, servindo como stack e queue ao mesmo tempo. Em Java, ArrayDeque implementa um buffer circular redimensionável e é a estrutura padrão para pilhas, filas e janelas deslizantes. _(~50 min)_

**Objetivos**
- Definir as operações de deque e mostrar como ele generaliza stack e queue
- Implementar um deque com buffer circular e crescimento
- Explicar a implementação de ArrayDeque (capacidade, índices head/tail, proibição de null)
- Comparar ArrayDeque e LinkedList como Deque em memória e desempenho
- Identificar problemas que exigem deque, como monotonic queue em sliding window maximum

**Pré-requisitos**
- [rec] 2.1.7 Stack — Deque generaliza a stack
- [rec] 2.1.8 Queue — Deque generaliza a queue e reutiliza o buffer circular

**Desafios planejados**
- N1 · Conceitual — Mostrar como um deque pode emular stack e queue e quais métodos de ArrayDeque correspondem a cada uso
- N2 · Implementação — Implementar ArrayDequeLite<T> com buffer circular, crescimento e as quatro operações de ponta
- N2 · Identificação de bugs — Encontrar o erro em código que mistura push e offer no mesmo ArrayDeque e inverte a ordem esperada
- N3 · Experimento — Comparar ArrayDeque e LinkedList como fila em throughput e consumo de memória
- N3 · Análise de código — Ler o código de ArrayDeque no JDK e explicar como os índices circulam e como ocorre o resize
- N4 · Implementação — Implementar um histórico de navegação com limite de tamanho usando deque, descartando as entradas mais antigas

**Critérios de conclusão**
- [ ] Implemento deque circular com addFirst/addLast/pollFirst/pollLast em O(1)
- [ ] Explico por que ArrayDeque não aceita null
- [ ] Escolho corretamente entre push/pop e offer/poll ao usar ArrayDeque como stack ou queue

### 2.2 Algoritmos fundamentais (6 tópicos)

**[Adicional]** Algoritmos clássicos de busca e ordenação e as técnicas de raciocínio que os sustentam: recursão e divisão e conquista. O módulo cobre o funcionamento passo a passo, as invariantes que garantem correção, a análise de custo (inclusive via recorrências e Teorema Mestre) e como a biblioteca do Java implementa Arrays.sort e Collections.sort.

Objetivos do módulo:
- Escolher entre busca linear e binária conforme pré-condições e custo de preparação dos dados
- Implementar busca binária sem erros de borda usando invariantes explícitas
- Comparar algoritmos de ordenação quanto a tempo, espaço, estabilidade e comportamento em entradas reais
- Escrever funções recursivas corretas, identificando caso base, progresso e custo de pilha
- Modelar algoritmos de divisão e conquista com recorrências e resolvê-las

#### 2.2.1 Linear Search

Busca linear percorre a coleção elemento a elemento até encontrar o alvo, sem exigir ordenação. É o baseline de toda busca e, por localidade de cache e ausência de pré-processamento, frequentemente é a melhor opção para coleções pequenas ou buscas únicas. _(~30 min)_

**Objetivos**
- Implementar busca linear retornando índice, primeira e última ocorrência
- Analisar melhor, pior e caso médio da busca linear
- Explicar quando busca linear vence alternativas (n pequeno, busca única, dados não ordenados)
- Aplicar a técnica de sentinela e explicar seu ganho
- Reconhecer buscas lineares escondidas em APIs (List.contains, indexOf, String.indexOf)

**Pré-requisitos**
- [rec] 2.1.4 Array — A busca linear percorre arrays sequencialmente

**Desafios planejados**
- N1 · Conceitual — Calcular o número esperado de comparações da busca linear quando o alvo está em posição uniforme
- N2 · Programação — Implementar findFirst e findLast genéricos com Predicate<T>
- N2 · Análise de código — Encontrar a busca linear escondida que torna O(n²) a remoção de duplicatas com List.contains
- N3 · Entrevista — Decidir, dado o número k de consultas, quando vale ordenar (O(n log n)) e usar busca binária
- N3 · Experimento — Medir busca linear versus binária para n de 8 a 1 milhão e encontrar o ponto de cruzamento
- N4 · Implementação — Implementar busca linear com sentinela e versão com laço desenrolado, comparando tempo com JMH

**Critérios de conclusão**
- [ ] Implemento variações de busca linear com predicado genérico
- [ ] Explico quando ordenar para depois usar busca binária compensa em relação a k buscas lineares
- [ ] Identifico List.contains dentro de laço como causa de O(n²)

#### 2.2.2 Binary Search

Busca binária descarta metade do espaço de busca a cada comparação em um array ordenado, alcançando O(log n). Aqui o foco é o algoritmo em si: invariantes, variações lower/upper bound e os erros clássicos de borda e overflow. _(~75 min)_

**Objetivos**
- Implementar busca binária com intervalo fechado [lo, hi] e semiaberto [lo, hi) mantendo invariantes explícitas
- Implementar lower bound e upper bound para encontrar primeira e última ocorrência
- Explicar o bug de overflow em (lo + hi) / 2 e corrigi-lo com lo + (hi - lo) / 2 ou >>>
- Provar a terminação e a corretude por meio da invariante do laço
- Usar Arrays.binarySearch e Collections.binarySearch e interpretar o retorno negativo (-(ponto de inserção) - 1)

**Pré-requisitos**
- [rec] 2.2.1 Linear Search — A busca binária é a otimização da busca linear quando há ordenação
- [rec] 2.1.3 Big O — Entender O(log n) é central para justificar o algoritmo

**Desafios planejados**
- N1 · Conceitual — Explicar por que a busca binária é O(log n) e quantas iterações faz para n = 10^9
- N2 · Programação — Resolver 'Binary Search' (LeetCode 704) com intervalo fechado e semiaberto
- N2 · Identificação de bugs — Corrigir uma busca binária que entra em laço infinito quando lo = mid e falha com overflow em arrays grandes
- N3 · Programação — Resolver 'Find First and Last Position of Element in Sorted Array' com lower e upper bound
- N3 · Análise de código — Analisar a implementação de Arrays.binarySearch no JDK e explicar o retorno -(insertion point) - 1
- N4 · Implementação — Implementar uma busca binária genérica parametrizada por predicado monotônico e cobri-la com testes de propriedade

**Critérios de conclusão**
- [ ] Escrevo lower bound sem consulta e sem laço infinito em todos os casos de borda
- [ ] Explico a invariante que mantém minha implementação correta
- [ ] Interpreto corretamente o retorno negativo de Arrays.binarySearch
- [ ] Testo arrays vazios, de um elemento, com duplicatas e alvo fora do intervalo

#### 2.2.3 Sorting

Visão geral dos algoritmos de ordenação (bubble, selection, insertion, quick, heap, counting) e das propriedades que os distinguem: tempo, espaço, estabilidade e adaptatividade. Inclui o limite inferior Ω(n log n) para ordenação por comparação e as escolhas do Java (Dual-Pivot Quicksort e TimSort). _(~120 min)_

**Objetivos**
- Implementar insertion sort, selection sort e quicksort, explicando a invariante de cada um
- Comparar algoritmos quanto a tempo (melhor/médio/pior), espaço, estabilidade e comportamento em dados quase ordenados
- Explicar o limite inferior Ω(n log n) para ordenação por comparação e quando counting/radix sort o superam
- Explicar por que Arrays.sort usa Dual-Pivot Quicksort para primitivos e TimSort para objetos
- Implementar Comparator corretos e reconhecer violações do contrato (ex.: comparação por subtração com overflow)

**Pré-requisitos**
- [rec] 2.1.3 Big O — Comparar algoritmos de ordenação exige notação assintótica
- [rec] 2.1.4 Array — Ordenações in-place manipulam índices de arrays

**Desafios planejados**
- N1 · Conceitual — Explicar estabilidade de ordenação e por que TimSort é estável e quicksort não
- N2 · Implementação — Implementar insertion sort e quicksort com pivô aleatório e testar com entradas adversariais
- N2 · Identificação de bugs — Corrigir um Comparator que usa a - b e produz ordenação errada com valores extremos
- N3 · Programação — Resolver 'Sort Colors' (Dutch National Flag) em uma passada com espaço O(1)
- N3 · Experimento — Comparar quicksort ingênuo, Arrays.sort e insertion sort em dados aleatórios, ordenados e quase ordenados
- N4 · Implementação — Implementar counting sort para inteiros em faixa limitada e comparar com Arrays.sort

**Critérios de conclusão**
- [ ] Implemento quicksort com partição de Lomuto ou Hoare e explico o pior caso
- [ ] Explico estabilidade com um exemplo em que ela importa (ordenar por múltiplos critérios)
- [ ] Justifico por que Java usa algoritmos diferentes para int[] e Object[]
- [ ] Escrevo Comparators sem overflow usando Integer.compare ou Comparator.comparing

#### 2.2.4 Merge Sort

Merge Sort divide o array ao meio, ordena cada metade recursivamente e intercala os resultados, garantindo O(n log n) no pior caso e estabilidade ao custo de O(n) de espaço auxiliar. É o exemplo canônico de divisão e conquista e a base do TimSort. _(~90 min)_

**Objetivos**
- Implementar merge sort top-down recursivo e bottom-up iterativo
- Implementar a etapa de merge de forma estável e com um único buffer auxiliar
- Derivar o custo O(n log n) pela árvore de recursão e pela recorrência T(n) = 2T(n/2) + O(n)
- Explicar o custo de espaço O(n) e por que merge sort é preferido para listas ligadas e ordenação externa
- Relacionar merge sort com TimSort (runs naturais, galloping, insertion sort em runs pequenas)

**Pré-requisitos**
- [rec] 2.2.3 Sorting — Merge sort é comparado com os demais algoritmos de ordenação

**Desafios planejados**
- N1 · Conceitual — Explicar por que merge sort é O(n log n) em todos os casos usando a árvore de recursão
- N2 · Implementação — Implementar merge sort top-down com buffer auxiliar único e versão bottom-up iterativa
- N2 · Programação — Resolver 'Merge Sorted Array' (LeetCode 88) in-place preenchendo de trás para frente
- N3 · Programação — Contar inversões de um array em O(n log n) adaptando a etapa de merge
- N3 · Programação — Resolver 'Sort List' (LeetCode 148) com merge sort em lista ligada
- N4 · Projeto — Implementar ordenação externa: ordenar um arquivo maior que a memória dividindo em chunks e fazendo k-way merge

**Critérios de conclusão**
- [ ] Implemento merge sort estável que aloca o buffer uma única vez
- [ ] Desenho a árvore de recursão e justifico O(n log n)
- [ ] Uso o merge para resolver um problema derivado (contagem de inversões ou merge de listas)

#### 2.2.5 Recursion

Recursão resolve um problema reduzindo-o a instâncias menores de si mesmo até um caso base. Entender como cada chamada ocupa um frame na call stack explica custo de espaço, StackOverflowError e como converter recursão em iteração. _(~75 min)_

**Objetivos**
- Identificar caso base, passo recursivo e garantia de progresso em funções recursivas
- Rastrear a execução de uma recursão desenhando a call stack e a árvore de chamadas
- Calcular tempo e espaço de recursões lineares e com múltiplas chamadas (ex.: Fibonacci ingênuo O(2^n))
- Explicar por que a JVM não faz eliminação de tail call e como isso afeta recursões profundas
- Converter uma recursão em iteração com stack explícita

**Pré-requisitos**
- [req] 1.1.9 Call Stack — Sem entender a call stack não é possível raciocinar sobre o custo e os limites da recursão
- [rec] 2.1.7 Stack — A conversão de recursão em iteração usa uma stack explícita

**Desafios planejados**
- N1 · Conceitual — Explicar o que acontece na call stack em cada chamada de factorial(4)
- N2 · Programação — Implementar recursivamente potência rápida (Pow(x, n)) em O(log n) tratando expoente negativo
- N2 · Identificação de bugs — Encontrar a recursão sem progresso que causa StackOverflowError em uma soma de dígitos
- N3 · Experimento — Medir a profundidade máxima de recursão na JVM com diferentes valores de -Xss
- N3 · Programação — Resolver 'Reverse Linked List' recursivamente e iterativamente, comparando o espaço
- N4 · Implementação — Implementar um avaliador recursivo de expressões aritméticas com parênteses (recursive descent parser)

**Critérios de conclusão**
- [ ] Desenho a árvore de chamadas de Fibonacci ingênuo e explico o custo exponencial
- [ ] Provoco e explico um StackOverflowError controlado e ajusto -Xss para observar o efeito
- [ ] Reescrevo uma função recursiva como iterativa mantendo o mesmo resultado

#### 2.2.6 Divide and Conquer

Divisão e conquista quebra o problema em subproblemas independentes, resolve-os recursivamente e combina as soluções. O tópico cobre como modelar o custo com recorrências, resolvê-las pelo Teorema Mestre e reconhecer quando a técnica se aplica. _(~90 min)_

**Objetivos**
- Identificar as três fases (dividir, conquistar, combinar) em merge sort, quicksort e busca binária
- Escrever a recorrência de custo de um algoritmo de divisão e conquista
- Resolver recorrências com árvore de recursão e com o Teorema Mestre
- Distinguir divisão e conquista (subproblemas independentes) de programação dinâmica (subproblemas sobrepostos)
- Aplicar a técnica a problemas novos (maximum subarray, closest pair, quickselect)

**Pré-requisitos**
- [req] 2.2.5 Recursion — Divisão e conquista é implementada por recursão
- [rec] 2.2.4 Merge Sort — Merge sort é o exemplo canônico da técnica

**Desafios planejados**
- N1 · Conceitual — Identificar dividir, conquistar e combinar em merge sort, quicksort e busca binária
- N2 · Análise de código — Resolver pelo Teorema Mestre T(n) = 2T(n/2) + n, T(n) = T(n/2) + 1 e T(n) = 3T(n/2) + n
- N2 · Programação — Resolver 'Maximum Subarray' com divisão e conquista em O(n log n) e comparar com Kadane
- N3 · Programação — Resolver 'Kth Largest Element in an Array' com quickselect e analisar o caso médio
- N4 · Experimento — Paralelizar merge sort com ForkJoinPool e medir speedup em relação à versão sequencial

**Critérios de conclusão**
- [ ] Resolvo 5 recorrências pelo Teorema Mestre identificando o caso correto
- [ ] Explico por que quickselect é O(n) no caso médio e O(n²) no pior
- [ ] Explico a diferença entre divisão e conquista e programação dinâmica com exemplo

### 2.3 Estruturas e padrões de entrevista (6 tópicos)

**[Adicional]** Módulo voltado a padrões de entrevista: em vez de estudar a estrutura em si, treina reconhecer, a partir do enunciado, qual estrutura ou técnica resolve o problema. Cobre fast/slow pointers e manipulação in-place de listas, monotonic stack, filas para simulação e BFS, busca binária na resposta, heaps para top-k e merge de k fluxos, e problemas de intervalos.

Objetivos do módulo:
- Reconhecer sinais no enunciado que indicam cada padrão (lista ligada, stack, queue, binary search, heap, intervals)
- Resolver problemas clássicos LeetCode Easy/Medium de cada padrão dentro do tempo de uma entrevista
- Justificar a complexidade da solução e compará-la com a abordagem ingênua
- Comunicar o raciocínio em voz alta, tratando casos de borda antes de codificar
- Montar um repertório pessoal de templates reutilizáveis para cada padrão

#### 2.3.1 Linked List

Padrões de entrevista com listas ligadas: fast/slow pointers, dummy node, reversão in-place e merge. O foco não é a estrutura, mas reconhecer no enunciado qual técnica de manipulação de ponteiros resolve o problema em O(n) e O(1) de espaço. _(~120 min)_

**Objetivos**
- Aplicar fast/slow pointers para detectar ciclo, encontrar o meio e o n-ésimo nó a partir do fim
- Reverter lista ligada (inteira ou em sublista) in-place sem perder referências
- Usar dummy node para eliminar casos especiais na cabeça da lista
- Explicar matematicamente por que o algoritmo de Floyd encontra o início do ciclo
- Combinar técnicas em problemas compostos (ex.: palíndromo = meio + reversão + comparação)

**Pré-requisitos**
- [rec] 2.1.6 Linked List — Os padrões assumem domínio da estrutura de lista ligada e de seus ponteiros

**Desafios planejados**
- N1 · Conceitual — Explicar por que fast/slow pointers sempre se encontram se houver ciclo e por que o encontro ocorre em O(n)
- N2 · Programação — Resolver 'Linked List Cycle II' com o algoritmo de Floyd em O(1) de espaço
- N2 · Programação — Resolver 'Remove Nth Node From End of List' em uma passada com dummy node e dois ponteiros
- N3 · Programação — Resolver 'Palindrome Linked List' em O(n) tempo e O(1) espaço combinando meio e reversão
- N3 · Programação — Resolver 'Reorder List' (L0→Ln→L1→Ln-1...) in-place
- N4 · Entrevista — Simular entrevista resolvendo 'Reverse Nodes in k-Group' explicando o raciocínio em voz alta

**Critérios de conclusão**
- [ ] Resolvo Reverse Linked List, Linked List Cycle e Merge Two Sorted Lists em menos de 15 minutos cada
- [ ] Explico a prova do algoritmo de Floyd para encontrar o início do ciclo
- [ ] Reconheço quando usar dummy node e fast/slow pointers apenas pela leitura do enunciado

#### 2.3.2 Stack

Padrões de entrevista que usam stack: casamento de delimitadores, avaliação de expressões, monotonic stack para 'próximo maior/menor' e simulação de processos LIFO. O foco é reconhecer quando a natureza do problema é 'último aberto, primeiro fechado'. _(~120 min)_

**Objetivos**
- Reconhecer sinais de problema de stack: aninhamento, desfazer, próximo maior/menor elemento
- Aplicar monotonic stack para resolver 'next greater element' em O(n) e justificar o custo amortizado
- Avaliar expressões em notação polonesa reversa e com precedência de operadores
- Projetar stacks auxiliares para operações em O(1), como getMin
- Usar ArrayDeque como stack em Java de forma idiomática

**Pré-requisitos**
- [rec] 2.1.7 Stack — Os padrões pressupõem a estrutura stack e suas operações O(1)

**Desafios planejados**
- N1 · Conceitual — Explicar a invariante de uma monotonic stack decrescente e por que cada elemento entra e sai uma única vez
- N2 · Programação — Resolver 'Valid Parentheses' com ArrayDeque tratando os casos de borda
- N2 · Programação — Resolver 'Min Stack' com getMin em O(1)
- N3 · Programação — Resolver 'Daily Temperatures' com monotonic stack em O(n)
- N3 · Programação — Resolver 'Evaluate Reverse Polish Notation' e estender para expressões infixas com Shunting Yard
- N4 · Entrevista — Resolver 'Largest Rectangle in Histogram' em O(n) explicando o raciocínio em voz alta

**Critérios de conclusão**
- [ ] Resolvo Valid Parentheses e Min Stack sem consulta
- [ ] Explico por que monotonic stack é O(n) mesmo com o while interno
- [ ] Resolvo Daily Temperatures e Largest Rectangle in Histogram identificando o invariante da pilha

#### 2.3.3 Queue

Padrões de entrevista com filas: processamento em ordem de chegada, BFS por níveis, simulações temporais e monotonic queue para máximos em janelas. O foco é reconhecer problemas em que a ordem FIFO ou a exploração por camadas é a chave. _(~90 min)_

**Objetivos**
- Reconhecer problemas de fila: processamento por níveis, simulação por tempo, 'mais recentes dentro de uma janela'
- Aplicar BFS por níveis usando o tamanho da fila no início de cada nível
- Usar monotonic deque para máximo/mínimo de janela deslizante em O(n)
- Implementar estruturas derivadas, como stack com filas e fila com stacks
- Escolher entre Queue, Deque e PriorityQueue conforme a ordem de processamento exigida

**Pré-requisitos**
- [rec] 2.1.8 Queue — Os padrões pressupõem a estrutura queue e o buffer circular
- [rec] 2.1.9 Deque — A monotonic queue é implementada sobre um deque

**Desafios planejados**
- N1 · Conceitual — Explicar por que a ordem FIFO garante que BFS visite os nós em ordem de distância
- N2 · Programação — Resolver 'Implement Queue using Stacks' com operações O(1) amortizadas
- N2 · Programação — Resolver 'Number of Recent Calls' com fila descartando eventos fora da janela
- N3 · Programação — Resolver 'Sliding Window Maximum' com monotonic deque em O(n)
- N3 · Programação — Resolver 'Rotting Oranges' com BFS multi-fonte contando minutos por nível
- N4 · Projeto — Construir um rate limiter de janela deslizante (N requisições por segundo) baseado em fila de timestamps

**Critérios de conclusão**
- [ ] Resolvo Implement Queue using Stacks e Number of Recent Calls sem consulta
- [ ] Resolvo Sliding Window Maximum em O(n) com deque e explico a invariante
- [ ] Uso o padrão 'size do nível' para processar BFS por camadas

#### 2.3.4 Binary Search

Padrões de entrevista com busca binária além do array ordenado: arrays rotacionados, busca do primeiro elemento que satisfaz um predicado monotônico e 'binary search on answer'. O foco é reconhecer monotonicidade escondida no enunciado. _(~120 min)_

**Objetivos**
- Reformular problemas como 'encontrar o primeiro x em que predicado(x) é verdadeiro'
- Aplicar busca binária em arrays rotacionados identificando qual metade está ordenada
- Aplicar 'binary search on answer' em problemas de minimizar o máximo ou capacidade mínima
- Escolher o espaço de busca (índices ou valores) e seus limites corretamente
- Analisar o custo total como O(log(intervalo) × custo do predicado)

**Pré-requisitos**
- [rec] 2.2.2 Binary Search — Os padrões assumem domínio da implementação e das invariantes da busca binária

**Desafios planejados**
- N1 · Conceitual — Explicar o que é um predicado monotônico e por que ele permite busca binária sobre valores
- N2 · Programação — Resolver 'Search Insert Position' usando o template de lower bound
- N2 · Programação — Resolver 'Find Minimum in Rotated Sorted Array' em O(log n)
- N3 · Programação — Resolver 'Search in Rotated Sorted Array' identificando a metade ordenada a cada passo
- N3 · Programação — Resolver 'Koko Eating Bananas' com busca binária na resposta
- N4 · Entrevista — Resolver 'Capacity To Ship Packages Within D Days' explicando a escolha dos limites do espaço de busca

**Critérios de conclusão**
- [ ] Resolvo Search in Rotated Sorted Array e Find Minimum in Rotated Sorted Array sem erros de borda
- [ ] Resolvo Koko Eating Bananas identificando o predicado monotônico
- [ ] Explico como reconheço que um problema admite busca binária na resposta

#### 2.3.5 Heap / Priority Queue

Padrões de entrevista que usam heap/priority queue como ferramenta: top-k elementos, k-ésimo maior, merge de k listas ordenadas e two heaps para mediana em fluxo. O foco é reconhecer quando é preciso acesso repetido ao mínimo/máximo de um conjunto dinâmico; o funcionamento interno do heap é aprofundado em 2.4.7 e 2.4.8. _(~120 min)_

**Objetivos**
- Reconhecer sinais de heap no enunciado: 'k maiores', 'k-ésimo', 'mais frequente', 'mediana em fluxo', 'merge de k'
- Usar PriorityQueue do Java com Comparator para min-heap e max-heap
- Aplicar o truque do heap de tamanho k para top-k em O(n log k) e comparar com ordenação O(n log n)
- Aplicar two heaps para manter a mediana de um fluxo em O(log n) por inserção
- Fazer merge de k fluxos ordenados em O(N log k)

**Pré-requisitos**
- [rec] 2.2.3 Sorting — Comparar soluções com heap e com ordenação exige conhecer os custos de ordenar
- [rec] 2.2.4 Merge Sort — Merge k Sorted Lists generaliza a etapa de merge do merge sort

**Desafios planejados**
- N1 · Conceitual — Explicar por que um min-heap de tamanho k encontra os k maiores elementos em O(n log k)
- N2 · Programação — Resolver 'Kth Largest Element in a Stream' com PriorityQueue de tamanho k
- N2 · Programação — Resolver 'Top K Frequent Elements' combinando HashMap e heap
- N3 · Programação — Resolver 'Merge k Sorted Lists' com PriorityQueue e analisar O(N log k)
- N3 · Identificação de bugs — Corrigir um Comparator de max-heap escrito como (a, b) -> b - a que falha com overflow
- N4 · Entrevista — Resolver 'Find Median from Data Stream' com two heaps explicando o rebalanceamento

**Critérios de conclusão**
- [ ] Resolvo Kth Largest Element e Top K Frequent Elements com heap de tamanho k
- [ ] Resolvo Merge k Sorted Lists e justifico O(N log k)
- [ ] Implemento Find Median from Data Stream com two heaps balanceados
- [ ] Explico por que usar min-heap para encontrar os k maiores

#### 2.3.6 Intervals

Padrões de problemas com intervalos: ordenar por início ou fim, mesclar sobreposições, inserir intervalos e contar recursos simultâneos com sweep line. Aparecem com frequência em entrevistas e modelam problemas reais de agenda, reservas e alocação. _(~100 min)_

**Objetivos**
- Definir formalmente sobreposição de intervalos e tratar bordas abertas/fechadas
- Mesclar intervalos ordenando por início em O(n log n)
- Escolher ordenar por fim em problemas gulosos de remoção mínima de sobreposições
- Contar o máximo de intervalos simultâneos com sweep line ou min-heap de términos
- Inserir um intervalo em lista ordenada em O(n) sem reordenar

**Pré-requisitos**
- [rec] 2.2.3 Sorting — Quase todos os problemas de intervalos começam ordenando com Comparator
- [rec] 2.3.5 Heap / Priority Queue — Meeting Rooms II pode ser resolvido com min-heap de horários de término

**Desafios planejados**
- N1 · Conceitual — Escrever a condição exata de sobreposição entre [a, b] e [c, d] e testar os casos de borda
- N2 · Programação — Resolver 'Merge Intervals' ordenando por início
- N2 · Programação — Resolver 'Insert Interval' em O(n) aproveitando que a entrada já está ordenada
- N3 · Programação — Resolver 'Non-overlapping Intervals' com estratégia gulosa ordenando por fim
- N3 · Programação — Resolver 'Meeting Rooms II' com min-heap e com sweep line
- N4 · Projeto — Construir um verificador de conflitos de agenda que receba reservas e liste sobreposições e salas necessárias

**Critérios de conclusão**
- [ ] Resolvo Merge Intervals e Insert Interval sem consulta
- [ ] Explico por que Non-overlapping Intervals ordena por fim e não por início
- [ ] Resolvo Meeting Rooms II com heap e com sweep line e comparo as abordagens

### 2.4 Hash Tables, Trees, Heaps e Graphs (9 tópicos)

**[Adicional]** Estruturas não lineares essenciais: tabelas hash, árvores, heaps e grafos. O foco é o funcionamento interno e os custos — funções de hash, colisões, load factor e resize; formas e propriedades de árvores binárias e BSTs; heap binário em array; representações de grafos — conectando cada estrutura às implementações do Java (HashMap, HashSet, TreeMap, PriorityQueue).

Objetivos do módulo:
- Explicar como uma tabela hash atinge O(1) esperado e quando degrada, incluindo o tratamento de colisões no HashMap do Java
- Implementar e percorrer árvores binárias e BSTs, analisando o efeito da altura no custo
- Implementar um heap binário em array e explicar o custo de heapify e de cada operação
- Representar grafos com lista e matriz de adjacência e escolher a representação adequada
- Selecionar a estrutura correta do Java Collections para um requisito de acesso dado

#### 2.4.1 Hash Table

Tabela hash como estrutura que mapeia chaves para posições de um array via função de hash, obtendo busca, inserção e remoção em O(1) esperado. Cobre funções de hash, tratamento de colisões (encadeamento e endereçamento aberto), load factor, rehash e o pior caso. _(~100 min)_

**Objetivos**
- Explicar o caminho chave → hashCode → índice do bucket e as propriedades de uma boa função de hash
- Comparar encadeamento separado e endereçamento aberto (linear probing, quadratic probing, double hashing)
- Explicar o papel do load factor e o custo amortizado do rehash
- Descrever o pior caso O(n) e ataques de hash flooding
- Discutir o uso de tamanhos potência de 2 versus números primos para a tabela

**Pré-requisitos**
- [rec] 2.1.4 Array — A tabela hash é um array indexado pelo resultado da função de hash
- [rec] 2.1.5 Dynamic Array — O rehash usa a mesma análise amortizada do array dinâmico
- [rec] 2.1.6 Linked List — O encadeamento separado usa listas ligadas nos buckets

**Desafios planejados**
- N1 · Conceitual — Explicar o caminho completo de uma chave até seu bucket e o que caracteriza uma colisão
- N2 · Implementação — Implementar uma tabela hash com encadeamento separado, load factor 0,75 e rehash
- N3 · Implementação — Implementar uma tabela hash com linear probing e tombstones para remoção
- N3 · Experimento — Medir o comprimento médio das cadeias com uma função de hash ruim versus boa para 100 mil chaves
- N3 · Entrevista — Explicar o que é hash flooding e como linguagens e frameworks se defendem dele
- N4 · Projeto — Construir um benchmark comparando sua tabela hash com encadeamento, sua versão com linear probing e o HashMap do Java em diferentes load factors

**Critérios de conclusão**
- [ ] Implemento uma tabela hash com encadeamento e rehash funcionando
- [ ] Explico por que O(1) é esperado e não garantido
- [ ] Comparo encadeamento e endereçamento aberto quanto a cache, remoção e load factor máximo

#### 2.4.2 HashMap

Implementação concreta de tabela hash no Java: HashMap usa array de buckets com encadeamento, espalhamento de bits do hashCode, resize com dobra de capacidade e treeification de buckets em árvores rubro-negras. Entender esses detalhes e o contrato equals/hashCode evita bugs sutis e problemas de desempenho. _(~120 min)_

**Objetivos**
- Explicar a estrutura interna do HashMap: Node[] table, hash spreading (h ^ h >>> 16) e índice (n - 1) & hash
- Descrever o resize: capacidade inicial 16, load factor 0,75, threshold e redistribuição em lo/hi sem recalcular hash
- Explicar a treeification (TREEIFY_THRESHOLD = 8, MIN_TREEIFY_CAPACITY = 64) e por que ela limita o pior caso a O(log n)
- Aplicar corretamente o contrato equals/hashCode e reconhecer os riscos de chaves mutáveis
- Comparar HashMap, LinkedHashMap, TreeMap e ConcurrentHashMap quanto a ordem, custo e concorrência

**Pré-requisitos**
- [req] 2.4.1 Hash Table — HashMap é uma implementação de tabela hash; os conceitos de colisão e rehash são a base

**Desafios planejados**
- N1 · Conceitual — Explicar por que HashMap usa (n - 1) & hash e exige capacidade potência de 2
- N2 · Identificação de bugs — Encontrar por que objetos com equals sobrescrito mas sem hashCode não são encontrados no HashMap
- N2 · Programação — Resolver 'Two Sum' com HashMap em O(n) e explicar o custo de cada operação
- N3 · Análise de código — Ler HashMap.putVal e resize no código-fonte do JDK e documentar cada ramo
- N3 · Experimento — Forçar colisões com chaves de hashCode constante e medir o efeito da treeification com chaves Comparable
- N4 · Implementação — Implementar um LRU Cache com LinkedHashMap (accessOrder e removeEldestEntry) e depois do zero com HashMap + lista duplamente ligada

**Critérios de conclusão**
- [ ] Explico passo a passo o que acontece em put(k, v), incluindo colisão e resize
- [ ] Demonstro com código o bug de uma chave mutável que 'desaparece' do mapa
- [ ] Explico quando e por que um bucket vira árvore
- [ ] Escolho entre HashMap, LinkedHashMap e TreeMap justificando por requisitos

#### 2.4.3 HashSet

Conjunto sem duplicatas baseado em tabela hash; no Java, HashSet é um wrapper sobre HashMap com valor sentinela. Cobre custos, a dependência de equals/hashCode, operações de conjunto e quando preferir LinkedHashSet, TreeSet ou BitSet. _(~50 min)_

**Objetivos**
- Explicar que HashSet delega para um HashMap interno e o que isso implica em custo e memória
- Implementar operações de conjunto (união, interseção, diferença) com retainAll, addAll e removeAll e analisar seus custos
- Comparar HashSet, LinkedHashSet, TreeSet e BitSet quanto a ordem, custo e memória
- Usar HashSet para deduplicação e verificação de pertencimento em O(1) esperado
- Reconhecer quando um boolean[] ou BitSet é melhor que HashSet<Integer>

**Pré-requisitos**
- [rec] 2.4.2 HashMap — HashSet é implementado sobre HashMap

**Desafios planejados**
- N1 · Conceitual — Explicar como HashSet é implementado sobre HashMap e o papel do objeto PRESENT
- N2 · Programação — Resolver 'Contains Duplicate' e 'Intersection of Two Arrays' com HashSet
- N3 · Programação — Resolver 'Longest Consecutive Sequence' em O(n) com HashSet
- N3 · Experimento — Comparar memória e tempo de HashSet<Integer>, boolean[] e BitSet para 10 milhões de inteiros
- N3 · Identificação de bugs — Corrigir um HashSet que aceita 'duplicatas' por causa de objetos mutados após a inserção
- N4 · Implementação — Implementar um conjunto de inteiros com bitset próprio (long[]) com add, contains, union e intersection

**Critérios de conclusão**
- [ ] Explico o que add retorna e como isso é usado para detectar duplicatas
- [ ] Resolvo Contains Duplicate e Longest Consecutive Sequence com HashSet
- [ ] Justifico a escolha entre HashSet, TreeSet e BitSet para um caso dado

#### 2.4.4 Tree

Árvore como estrutura hierárquica acíclica com raiz, nós, arestas e subárvores. Cobre a terminologia (altura, profundidade, grau, folha), formas de representação e por que árvores modelam desde sistemas de arquivos até índices de bancos de dados. _(~45 min)_

**Objetivos**
- Definir raiz, pai, filho, folha, altura, profundidade, nível e grau com precisão
- Relacionar árvore com grafo conexo acíclico (n nós, n - 1 arestas)
- Representar árvores genéricas com lista de filhos e com primeiro-filho/próximo-irmão
- Calcular altura, tamanho e profundidade recursivamente
- Identificar árvores em sistemas reais (DOM, sistema de arquivos, B-trees em índices, AST de compiladores)

**Pré-requisitos**
- [rec] 2.2.5 Recursion — Quase todas as operações em árvores são naturalmente recursivas

**Desafios planejados**
- N1 · Conceitual — Diferenciar altura, profundidade e nível em uma árvore de exemplo
- N2 · Implementação — Implementar TreeNode genérico com lista de filhos e métodos size e height
- N2 · Programação — Resolver 'Maximum Depth of N-ary Tree' recursivamente
- N3 · Programação — Construir a árvore de diretórios a partir de uma lista de caminhos e imprimir no formato 'tree'
- N3 · Entrevista — Explicar por que bancos de dados usam B-trees e não árvores binárias para índices em disco
- N4 · Implementação — Implementar um Trie para autocompletar prefixos com insert, search e startsWith

**Critérios de conclusão**
- [ ] Defino corretamente altura e profundidade e calculo ambas em uma árvore dada
- [ ] Implemento uma árvore genérica com operações de tamanho e altura
- [ ] Explico por que árvores têm exatamente n - 1 arestas

#### 2.4.5 Binary Tree

Árvore binária, em que cada nó tem no máximo dois filhos, e suas travessias (pre-order, in-order, post-order, level-order). Cobre formas (completa, cheia, perfeita, balanceada), relação entre altura e número de nós e implementações recursivas e iterativas. _(~90 min)_

**Objetivos**
- Implementar as quatro travessias recursivamente e iterativamente
- Diferenciar árvore cheia, completa, perfeita e balanceada
- Relacionar altura e número de nós (mínimo log₂(n + 1), máximo n) e o impacto disso no custo
- Explicar o custo de espaço das travessias (O(h) para DFS, O(w) para BFS)
- Serializar e desserializar uma árvore binária

**Pré-requisitos**
- [rec] 2.4.4 Tree — Árvore binária é um caso particular de árvore
- [rec] 2.1.7 Stack — Travessias iterativas usam stack explícita
- [rec] 2.1.8 Queue — A travessia por nível usa fila

**Desafios planejados**
- N1 · Conceitual — Escrever a ordem de visita das quatro travessias para uma árvore dada
- N2 · Programação — Resolver 'Binary Tree Inorder Traversal' de forma iterativa com stack
- N2 · Programação — Resolver 'Invert Binary Tree' e 'Maximum Depth of Binary Tree'
- N3 · Programação — Resolver 'Serialize and Deserialize Binary Tree' com pre-order e marcadores de nulo
- N3 · Experimento — Medir a profundidade de recursão das travessias em árvore degenerada versus balanceada com 100 mil nós
- N4 · Projeto — Construir um visualizador de árvores binárias no terminal a partir de uma serialização em level-order

**Critérios de conclusão**
- [ ] Implemento as travessias in-order e pre-order iterativas sem consulta
- [ ] Classifico uma árvore como cheia, completa, perfeita ou balanceada
- [ ] Resolvo Invert Binary Tree e Maximum Depth of Binary Tree em poucos minutos

#### 2.4.6 Binary Search Tree

Binary Search Tree mantém a invariante esquerda < nó < direita, permitindo busca, inserção e remoção em O(h). Cobre as operações, o problema da degeneração em lista, a ideia de autobalanceamento (AVL, rubro-negra) e como TreeMap/TreeSet usam árvores rubro-negras. _(~110 min)_

**Objetivos**
- Implementar busca, inserção, remoção (incluindo nó com dois filhos via sucessor) e mínimo/máximo
- Explicar por que a travessia in-order de uma BST produz os elementos ordenados
- Explicar por que a altura determina o custo e como entradas ordenadas degeneram a árvore
- Descrever em alto nível rotações e as garantias de AVL e árvores rubro-negras
- Usar TreeMap/TreeSet (floorKey, ceilingKey, headMap, subMap) e comparar com HashMap

**Pré-requisitos**
- [req] 2.4.5 Binary Tree — BST é uma árvore binária com invariante de ordenação
- [rec] 2.2.2 Binary Search — A busca em BST segue a mesma lógica de descartar metade do espaço

**Desafios planejados**
- N1 · Conceitual — Explicar por que inserir dados ordenados transforma uma BST em lista ligada e o custo resultante
- N2 · Implementação — Implementar BST<K extends Comparable<K>> com insert, search, delete e inorder
- N2 · Identificação de bugs — Corrigir um isValidBST que compara apenas com os filhos diretos e aceita árvores inválidas
- N3 · Programação — Resolver 'Kth Smallest Element in a BST' e 'Lowest Common Ancestor of a BST'
- N3 · Programação — Resolver 'My Calendar I' usando TreeMap.floorKey e ceilingKey
- N4 · Implementação — Implementar uma árvore AVL com rotações simples e duplas e verificar a altura após 1 milhão de inserções ordenadas

**Critérios de conclusão**
- [ ] Implemento remoção em BST tratando os três casos corretamente
- [ ] Resolvo Validate Binary Search Tree sem cair na armadilha de comparar só com os filhos
- [ ] Demonstro a degeneração inserindo dados ordenados e medindo a altura
- [ ] Uso TreeMap.floorKey/ceilingKey para resolver um problema de consulta por faixa

#### 2.4.7 Heap

Heap binário como árvore completa armazenada em array, com a propriedade de heap (pai ≤ filhos no min-heap). Aqui o foco é a estrutura em si: índices pai/filho, sift-up, sift-down, heapify em O(n) e heapsort; os padrões de uso em entrevista foram vistos em 2.3.5. Não confundir com a região heap de memória. _(~90 min)_

**Objetivos**
- Explicar a representação em array e as fórmulas de índices pai = (i - 1) / 2 e filhos = 2i + 1, 2i + 2
- Implementar insert com sift-up e extract com sift-down, justificando O(log n)
- Provar que build-heap (heapify bottom-up) é O(n) e não O(n log n)
- Implementar heapsort e analisar por que ele é in-place, O(n log n) e não estável
- Diferenciar a estrutura de dados heap da região heap de memória

**Pré-requisitos**
- [rec] 2.4.5 Binary Tree — O heap é uma árvore binária completa
- [rec] 2.1.4 Array — A árvore é armazenada implicitamente em array
- [rec] 2.3.5 Heap / Priority Queue — Os padrões de uso de heap em entrevistas motivam o estudo da estrutura interna

**Desafios planejados**
- N1 · Conceitual — Explicar por que uma árvore completa pode ser armazenada em array sem ponteiros
- N2 · Implementação — Implementar MinHeap com insert (sift-up), extractMin (sift-down) e crescimento do array
- N2 · Identificação de bugs — Corrigir um sift-down que troca com o filho errado e quebra a propriedade de heap
- N3 · Conceitual — Demonstrar que heapify bottom-up é O(n) somando o trabalho por nível
- N3 · Implementação — Implementar heapsort in-place e compará-lo com Arrays.sort
- N4 · Implementação — Implementar um d-ary heap genérico com Comparator e medir o efeito de d em inserções e remoções

**Critérios de conclusão**
- [ ] Implemento um min-heap em array com insert, peek e extractMin corretos
- [ ] Explico a prova de que build-heap é O(n)
- [ ] Implemento heapsort in-place
- [ ] Explico por que o nome heap é usado tanto para a estrutura quanto para a memória sem relação entre eles

#### 2.4.8 Priority Queue

Priority Queue como tipo abstrato em que o próximo elemento removido é o de maior prioridade, normalmente implementado com heap binário. Cobre a PriorityQueue do Java por dentro (array, Comparator, custos de remove(Object), iteração não ordenada) e alternativas como TreeSet e PriorityBlockingQueue. _(~70 min)_

**Objetivos**
- Diferenciar o tipo abstrato priority queue de sua implementação com heap
- Explicar a implementação de java.util.PriorityQueue: array queue[], siftUp/siftDown, crescimento e custo de cada método
- Explicar por que o iterator e toString de PriorityQueue não retornam elementos ordenados
- Analisar por que remove(Object) e contains são O(n) e como contornar (lazy deletion, indexed heap)
- Comparar PriorityQueue, TreeSet e PriorityBlockingQueue e casos de uso reais (schedulers, timers, Dijkstra)

**Pré-requisitos**
- [req] 2.4.7 Heap — A PriorityQueue do Java é um heap binário

**Desafios planejados**
- N1 · Conceitual — Explicar por que imprimir uma PriorityQueue não mostra os elementos ordenados
- N2 · Programação — Resolver 'Last Stone Weight' com PriorityQueue como max-heap
- N2 · Análise de código — Ler PriorityQueue.offer e poll no JDK e comparar com sua implementação de heap
- N3 · Programação — Resolver 'Task Scheduler' com PriorityQueue e fila de espera
- N4 · Projeto — Construir um agendador de tarefas por prioridade e horário com PriorityQueue, desempate por ordem de chegada e cancelamento com lazy deletion

**Critérios de conclusão**
- [ ] Explico o custo de offer, poll, peek, remove(Object) e contains na PriorityQueue
- [ ] Uso Comparator para prioridade composta (ex.: prioridade e depois timestamp)
- [ ] Aplico lazy deletion para atualizar prioridades sem remove(Object)

#### 2.4.9 Graph

Grafo como conjunto de vértices e arestas, direcionado ou não, ponderado ou não. Cobre a terminologia, as representações (lista de adjacência, matriz de adjacência, lista de arestas) e seus custos, base para os algoritmos de travessia vistos em 2.6. _(~70 min)_

**Objetivos**
- Definir vértice, aresta, grau, caminho, ciclo, componente conexo, grafo direcionado, ponderado, denso e esparso
- Implementar grafo com lista de adjacência e com matriz de adjacência
- Comparar as representações em espaço (O(V + E) versus O(V²)) e no custo de verificar aresta e listar vizinhos
- Converter entradas típicas de problemas (lista de arestas, grid, pares de dependência) em grafo
- Reconhecer grafos implícitos em problemas reais (redes sociais, rotas, dependências de build)

**Pré-requisitos**
- [rec] 2.4.4 Tree — Árvore é um caso particular de grafo e facilita a generalização
- [rec] 2.4.2 HashMap — Listas de adjacência com vértices não inteiros usam Map<V, List<V>>

**Desafios planejados**
- N1 · Conceitual — Comparar lista e matriz de adjacência em espaço e custo de operações para grafo esparso e denso
- N2 · Implementação — Implementar Graph<V> genérico com lista de adjacência para grafos direcionados e não direcionados
- N2 · Programação — Resolver 'Find the Town Judge' calculando graus de entrada e saída
- N3 · Programação — Converter a entrada de 'Course Schedule' em grafo de dependências e calcular graus de entrada
- N3 · Entrevista — Modelar como grafo um problema real (rede de amigos ou dependências de build) e justificar a representação
- N4 · Projeto — Construir um carregador de grafos a partir de CSV de arestas que gere estatísticas (graus, densidade, componentes isolados)

**Critérios de conclusão**
- [ ] Construo um grafo a partir de uma lista de arestas nas duas representações
- [ ] Escolho a representação adequada justificando por densidade e operações
- [ ] Modelo um grid 2D como grafo implícito com vizinhos por direções

### 2.5 Arrays e Strings (6 tópicos)

**[Adicional]** Padrões mais frequentes em entrevistas sobre sequências: manipulação de arrays e strings, uso de hashing para contagem e busca, two pointers, sliding window e prefix sum. O módulo ensina a transformar soluções O(n²) em O(n) reconhecendo a estrutura do problema e mantendo invariantes ao percorrer a entrada.

Objetivos do módulo:
- Aplicar técnicas in-place em arrays e reconhecer quando ordenar simplifica o problema
- Manipular strings em Java com consciência de imutabilidade, StringBuilder e codificação de caracteres
- Usar hashing para contagem de frequência, agrupamento e complemento
- Resolver problemas com two pointers, sliding window (fixa e variável) e prefix sum, justificando a corretude
- Otimizar soluções de força bruta para tempo linear explicando o ganho

#### 2.5.1 Arrays

Padrões de entrevista com arrays: manipulação in-place, uso de índices como informação, ordenação como pré-processamento, rotação e matrizes. O foco é o raciocínio sobre problemas, aproveitando o que foi visto da estrutura array em 2.1.4. _(~110 min)_

**Objetivos**
- Aplicar manipulação in-place com ponteiro de escrita (remover duplicatas, mover zeros)
- Usar o próprio array como tabela hash quando os valores estão em [1, n] (marcação por sinal ou cyclic sort)
- Rotacionar arrays com a técnica das três reversões em O(1) de espaço
- Percorrer matrizes em espiral, transpor e rotacionar 90° in-place
- Reconhecer quando ordenar a entrada simplifica o problema e o custo disso

**Pré-requisitos**
- [rec] 2.1.4 Array — Os padrões assumem a compreensão do array como estrutura
- [rec] 2.2.3 Sorting — Ordenar como pré-processamento é recorrente nestes problemas

**Desafios planejados**
- N1 · Conceitual — Explicar a técnica do ponteiro de escrita para filtrar arrays in-place
- N2 · Programação — Resolver 'Move Zeroes' e 'Remove Duplicates from Sorted Array' in-place
- N2 · Programação — Resolver 'Rotate Array' com três reversões
- N3 · Programação — Resolver 'Product of Array Except Self' em O(n) sem divisão
- N3 · Programação — Resolver 'Find All Numbers Disappeared in an Array' usando marcação por sinal
- N4 · Entrevista — Resolver 'Rotate Image' e 'Spiral Matrix' explicando o tratamento das bordas

**Critérios de conclusão**
- [ ] Resolvo Remove Duplicates from Sorted Array e Move Zeroes in-place
- [ ] Resolvo Rotate Array com O(1) de espaço
- [ ] Resolvo Product of Array Except Self sem divisão em O(n)
- [ ] Resolvo Spiral Matrix sem erros de borda

#### 2.5.2 Strings

Padrões de entrevista com strings e o comportamento de String em Java: imutabilidade, String pool, custo de concatenação, StringBuilder, char versus code point e comparação. Inclui problemas clássicos de palíndromos, anagramas e parsing. _(~100 min)_

**Objetivos**
- Explicar a imutabilidade de String, o String pool e o custo de concatenação em laço
- Usar StringBuilder, toCharArray e int[26] para manipular strings eficientemente
- Diferenciar char (UTF-16) de code point e reconhecer problemas com emojis e caracteres suplementares
- Comparar strings corretamente (equals versus ==, compareTo, equalsIgnoreCase)
- Resolver problemas de palíndromo, anagrama, reversão de palavras e parsing de números

**Pré-requisitos**
- [rec] 2.5.1 Arrays — Strings são manipuladas como arrays de caracteres nos padrões de entrevista
- [rec] 2.1.1 Time Complexity — É preciso enxergar o custo escondido de substring e concatenação

**Desafios planejados**
- N1 · Conceitual — Explicar a imutabilidade de String e o funcionamento do String pool
- N2 · Programação — Resolver 'Valid Palindrome' com dois índices ignorando caracteres não alfanuméricos
- N2 · Identificação de bugs — Corrigir comparação de Strings com == que falha para valores lidos em tempo de execução
- N3 · Experimento — Medir concatenação com +, String.concat e StringBuilder para 100 mil iterações
- N3 · Programação — Resolver 'String to Integer (atoi)' tratando overflow sem usar long
- N3 · Programação — Resolver 'Reverse Words in a String' com e sem split
- N4 · Implementação — Implementar um compressor de strings por run-length encoding (encode/decode) tratando caracteres Unicode suplementares

**Critérios de conclusão**
- [ ] Explico por que concatenar em laço com + pode ser O(n²) e como StringBuilder resolve
- [ ] Resolvo Valid Anagram e Valid Palindrome sem consulta
- [ ] Explico por que == entre Strings às vezes 'funciona' e por que não confiar nisso
- [ ] Resolvo String to Integer (atoi) tratando sinal, espaços e overflow

#### 2.5.3 Hashing

Padrão de entrevista que usa HashMap/HashSet como ferramenta: contagem de frequência, busca de complemento, agrupamento por chave canônica e prefix hashing. O foco é reconhecer quando trocar espaço por tempo transforma O(n²) em O(n); o funcionamento interno das tabelas hash foi visto em 2.4.1 e 2.4.2. _(~90 min)_

**Objetivos**
- Aplicar contagem de frequência com HashMap.merge, getOrDefault ou int[] de alfabeto fixo
- Aplicar o padrão 'complemento visto antes' (Two Sum) em uma única passada
- Agrupar elementos por chave canônica (string ordenada ou assinatura de contagem)
- Escolher entre int[26], HashMap e HashSet conforme domínio das chaves
- Analisar o trade-off de espaço O(n) e os riscos do pior caso do hashing

**Pré-requisitos**
- [rec] 2.4.2 HashMap — Usar hashing com consciência de custo exige conhecer o HashMap por dentro
- [rec] 2.4.3 HashSet — Vários problemas usam HashSet para pertencimento

**Desafios planejados**
- N1 · Conceitual — Explicar como o hashing troca espaço por tempo no padrão do complemento
- N2 · Programação — Resolver 'Two Sum' em uma passada com HashMap
- N2 · Programação — Resolver 'Group Anagrams' com chave canônica por contagem de letras
- N3 · Programação — Resolver 'Ransom Note' e 'First Unique Character in a String' com int[26] e comparar com HashMap
- N3 · Análise de código — Analisar o custo real de usar List<Integer> e String como chaves de HashMap (hashCode e equals)
- N4 · Entrevista — Resolver 'Longest Consecutive Sequence' e 'Subarray Sum Equals K' em simulação de entrevista, justificando o uso de hashing

**Critérios de conclusão**
- [ ] Resolvo Two Sum, Valid Anagram e Group Anagrams com hashing
- [ ] Explico quando int[26] é preferível a HashMap<Character, Integer>
- [ ] Converto uma solução O(n²) de força bruta em O(n) com hashing e justifico

#### 2.5.4 Two Pointers

Técnica de dois ponteiros que percorrem a entrada em direções opostas ou na mesma direção, eliminando laços aninhados. Aplica-se a arrays ordenados, palíndromos, partição in-place e problemas de soma, reduzindo O(n²) para O(n). _(~100 min)_

**Objetivos**
- Distinguir as variantes: ponteiros opostos (convergentes) e ponteiros na mesma direção (leitura/escrita)
- Justificar por que mover um ponteiro descarta com segurança candidatos em arrays ordenados
- Resolver problemas de soma (2Sum ordenado, 3Sum) evitando duplicatas
- Aplicar two pointers para partição e remoção in-place
- Reconhecer pelo enunciado quando a técnica se aplica (entrada ordenada, pares, in-place)

**Pré-requisitos**
- [rec] 2.5.1 Arrays — A técnica é aplicada sobre arrays manipulados in-place
- [rec] 2.2.3 Sorting — Muitos problemas exigem ordenar antes de aplicar os ponteiros

**Desafios planejados**
- N1 · Conceitual — Explicar por que, em um array ordenado, mover o ponteiro esquerdo quando a soma é pequena não perde soluções
- N2 · Programação — Resolver 'Two Sum II - Input Array Is Sorted' com ponteiros opostos
- N2 · Programação — Resolver 'Squares of a Sorted Array' em O(n)
- N3 · Programação — Resolver '3Sum' em O(n²) evitando duplicatas
- N3 · Programação — Resolver 'Container With Most Water' justificando a escolha de qual ponteiro mover
- N4 · Entrevista — Resolver 'Trapping Rain Water' com two pointers em O(1) de espaço explicando a invariante

**Critérios de conclusão**
- [ ] Resolvo Two Sum II e Container With Most Water explicando por que mover o ponteiro é seguro
- [ ] Resolvo 3Sum em O(n²) sem triplas duplicadas
- [ ] Explico quando two pointers não se aplica e hashing é melhor

#### 2.5.5 Sliding Window

Sliding window mantém uma janela contígua sobre a entrada que se expande e contrai, atualizando o estado incrementalmente. Resolve em O(n) problemas de subarrays/substrings com restrição, como 'maior substring sem repetição' ou 'menor janela que contém'. _(~120 min)_

**Objetivos**
- Diferenciar janela de tamanho fixo e janela de tamanho variável
- Manter o estado da janela incrementalmente (soma, contagem de frequência, número de distintos)
- Definir a condição de validade e quando contrair a janela
- Justificar o custo O(n) observando que cada ponteiro avança no máximo n vezes
- Reconhecer quando sliding window falha (ex.: valores negativos em somas) e usar prefix sum ou outra técnica

**Pré-requisitos**
- [rec] 2.5.4 Two Pointers — Sliding window é uma especialização de dois ponteiros na mesma direção
- [rec] 2.5.3 Hashing — O estado da janela costuma ser uma contagem de frequências

**Desafios planejados**
- N1 · Conceitual — Explicar por que sliding window é O(n) mesmo com um while interno
- N2 · Programação — Resolver 'Maximum Average Subarray I' com janela fixa
- N2 · Programação — Resolver 'Longest Substring Without Repeating Characters' com sliding window em O(n)
- N3 · Programação — Resolver 'Longest Repeating Character Replacement' mantendo a frequência máxima da janela
- N3 · Identificação de bugs — Encontrar por que uma sliding window para 'soma igual a k' falha com números negativos
- N4 · Entrevista — Resolver 'Minimum Window Substring' em O(n) explicando a condição de validade

**Critérios de conclusão**
- [ ] Resolvo Longest Substring Without Repeating Characters em O(n) sem consulta
- [ ] Resolvo Minimum Window Substring controlando a contagem de caracteres faltantes
- [ ] Explico por que a técnica não funciona para soma alvo com números negativos

#### 2.5.6 Prefix Sum

Prefix sum pré-computa somas acumuladas para responder somas de intervalo em O(1). Combinada com HashMap, resolve contagens de subarrays com soma alvo mesmo com negativos; estende-se a matrizes 2D e a arrays de diferença para atualizações em faixa. _(~90 min)_

**Objetivos**
- Construir o array de prefixos com tamanho n + 1 e consultar sum(i, j) = prefix[j + 1] - prefix[i]
- Combinar prefix sum com HashMap para contar subarrays com soma k em O(n)
- Construir prefix sum 2D e consultar somas de retângulos em O(1)
- Aplicar difference array para múltiplas atualizações de intervalo em O(1) cada
- Reconhecer riscos de overflow e usar long quando necessário

**Pré-requisitos**
- [rec] 2.5.3 Hashing — O padrão 'subarray com soma k' combina prefix sum com hashing

**Desafios planejados**
- N1 · Conceitual — Explicar por que prefix sum troca pré-processamento O(n) por consultas O(1)
- N2 · Programação — Resolver 'Range Sum Query - Immutable' e 'Find Pivot Index'
- N3 · Programação — Resolver 'Subarray Sum Equals K' com prefix sum e HashMap
- N3 · Programação — Resolver 'Range Sum Query 2D - Immutable' com inclusão-exclusão
- N3 · Identificação de bugs — Corrigir uma solução de 'Subarray Sum Equals K' que esquece de inicializar o mapa com soma zero
- N4 · Programação — Resolver 'Corporate Flight Bookings' com difference array

**Critérios de conclusão**
- [ ] Resolvo Range Sum Query - Immutable e Subarray Sum Equals K sem consulta
- [ ] Explico por que o HashMap precisa começar com {0: 1}
- [ ] Resolvo Range Sum Query 2D com inclusão-exclusão

### 2.6 Trees, Graphs e problemas recursivos (7 tópicos)

**[Adicional]** Problemas recursivos e de busca em estruturas não lineares: padrões em árvores, DFS, BFS, grafos (componentes, ciclos, ordenação topológica), backtracking, algoritmos gulosos e programação dinâmica básica. O foco é escolher a estratégia de exploração certa, provar (ao menos informalmente) a corretude e controlar a complexidade.

Objetivos do módulo:
- Resolver problemas de árvore e grafo escolhendo entre DFS e BFS com justificativa
- Implementar DFS recursiva e iterativa e BFS por níveis sem erros de visitação
- Aplicar backtracking com poda para gerar combinações, permutações e subconjuntos
- Distinguir quando uma escolha gulosa é correta e quando é necessário programação dinâmica
- Formular estados, transições e casos base de problemas de DP básicos, com memoização e tabulação

#### 2.6.1 Trees

Padrões de entrevista com árvores binárias: recursão que retorna informação das subárvores (altura, balanceamento, diâmetro), passagem de estado para baixo (caminhos, limites de BST), LCA e construção a partir de travessias. Complementa a estrutura vista em 2.4.4–2.4.6 com o raciocínio de solução. _(~120 min)_

**Objetivos**
- Distinguir recursão top-down (passa estado aos filhos) de bottom-up (combina resultados dos filhos)
- Resolver problemas que retornam múltiplos valores das subárvores (ex.: altura e diâmetro simultâneos)
- Encontrar o Lowest Common Ancestor em árvore binária genérica e em BST
- Reconstruir árvores a partir de travessias pre-order e in-order
- Analisar tempo O(n) e espaço O(h) das soluções e o pior caso em árvores degeneradas

**Pré-requisitos**
- [rec] 2.4.4 Tree — Retoma a estrutura de árvore (2.4.4), agora com foco em padrões de solução
- [rec] 2.4.5 Binary Tree — Os padrões pressupõem árvores binárias e suas travessias
- [rec] 2.4.6 Binary Search Tree — Vários problemas exploram a invariante da BST

**Desafios planejados**
- N1 · Conceitual — Explicar a diferença entre recursão top-down e bottom-up em árvores com um exemplo de cada
- N2 · Programação — Resolver 'Same Tree', 'Symmetric Tree' e 'Path Sum'
- N2 · Programação — Resolver 'Diameter of Binary Tree' em O(n)
- N3 · Programação — Resolver 'Lowest Common Ancestor of a Binary Tree'
- N3 · Programação — Resolver 'Construct Binary Tree from Preorder and Inorder Traversal' com HashMap de índices
- N4 · Entrevista — Resolver 'Binary Tree Maximum Path Sum' explicando o que a função retorna versus o que ela atualiza

**Critérios de conclusão**
- [ ] Resolvo Diameter of Binary Tree e Balanced Binary Tree em O(n) com uma única travessia
- [ ] Resolvo Lowest Common Ancestor of a Binary Tree explicando o retorno de cada chamada
- [ ] Classifico um problema de árvore como top-down ou bottom-up antes de codificar

#### 2.6.2 DFS

Depth-First Search explora um caminho até o fim antes de retroceder, de forma recursiva ou com stack explícita. É a base para componentes conexos, detecção de ciclos, flood fill em grids e ordenação topológica. _(~110 min)_

**Objetivos**
- Implementar DFS recursiva e iterativa em grafos e grids, controlando visitados
- Explicar a complexidade O(V + E) e o espaço O(V) da pilha ou recursão
- Aplicar DFS para contar componentes conexos e fazer flood fill
- Detectar ciclos em grafos direcionados com três estados (branco, cinza, preto)
- Reconhecer o risco de StackOverflowError em grids grandes e converter para iterativa

**Pré-requisitos**
- [rec] 2.4.9 Graph — DFS opera sobre representações de grafo
- [rec] 2.2.5 Recursion — A versão natural da DFS é recursiva
- [rec] 2.1.7 Stack — A versão iterativa usa stack explícita

**Desafios planejados**
- N1 · Conceitual — Explicar por que DFS é O(V + E) com lista de adjacência e O(V²) com matriz
- N2 · Programação — Resolver 'Flood Fill' e 'Number of Islands' com DFS
- N2 · Identificação de bugs — Corrigir uma DFS em grid que entra em recursão infinita por marcar visitados tarde demais
- N3 · Programação — Resolver 'Course Schedule' detectando ciclo com DFS de três estados
- N3 · Experimento — Provocar StackOverflowError com DFS recursiva em grid 2000×2000 e reescrever de forma iterativa
- N4 · Programação — Resolver 'Pacific Atlantic Water Flow' com DFS a partir das bordas

**Critérios de conclusão**
- [ ] Resolvo Number of Islands com DFS recursiva e iterativa
- [ ] Detecto ciclo em grafo direcionado com o esquema de três cores
- [ ] Explico quando marcar como visitado (ao empilhar ou ao desempilhar) e as consequências

#### 2.6.3 BFS

Breadth-First Search explora o grafo em camadas usando uma fila, garantindo o caminho mais curto em número de arestas em grafos não ponderados. Inclui BFS por níveis, multi-fonte e em grids. _(~100 min)_

**Objetivos**
- Implementar BFS com fila e controle de visitados ao enfileirar
- Explicar por que BFS encontra a menor distância em grafos não ponderados e por que falha com pesos
- Processar BFS por níveis para retornar distâncias ou camadas
- Aplicar BFS multi-fonte e em grids com direções
- Comparar BFS e DFS quanto a memória, caminho mínimo e tipo de problema

**Pré-requisitos**
- [rec] 2.4.9 Graph — BFS opera sobre representações de grafo
- [rec] 2.3.3 Queue — O padrão de fila por níveis é a base da BFS

**Desafios planejados**
- N1 · Conceitual — Explicar por que a primeira vez que BFS alcança um nó é pelo caminho mais curto
- N2 · Programação — Resolver 'Binary Tree Level Order Traversal' e 'Binary Tree Right Side View'
- N2 · Programação — Resolver 'Shortest Path in Binary Matrix' com BFS em 8 direções
- N3 · Programação — Resolver '01 Matrix' com BFS multi-fonte
- N3 · Programação — Resolver 'Word Ladder' modelando palavras como grafo implícito
- N4 · Projeto — Construir um resolvedor de labirintos que leia um grid de arquivo e imprima o caminho mínimo reconstruído por array de pais

**Critérios de conclusão**
- [ ] Resolvo Binary Tree Level Order Traversal e Shortest Path in Binary Matrix
- [ ] Explico por que marcar visitado ao enfileirar evita trabalho duplicado
- [ ] Escolho entre BFS e DFS justificando pelo requisito do problema

#### 2.6.4 Graphs

Padrões de entrevista com grafos: modelagem de problemas como grafo, componentes conexos, ordenação topológica (Kahn), union-find, bipartição e uma introdução a Dijkstra. Complementa a representação vista em 2.4.9 com as técnicas de solução. _(~150 min)_

**Objetivos**
- Modelar problemas textuais como grafos (nós, arestas, direção, pesos)
- Implementar ordenação topológica com algoritmo de Kahn e com DFS
- Implementar Union-Find com path compression e union by rank e explicar o custo quase O(1)
- Verificar bipartição com BFS/DFS por coloração
- Explicar Dijkstra com PriorityQueue e por que ele exige pesos não negativos

**Pré-requisitos**
- [rec] 2.4.9 Graph — Os padrões partem da representação de grafo
- [rec] 2.6.2 DFS — Ordenação topológica e componentes usam DFS
- [rec] 2.6.3 BFS — Kahn e bipartição usam BFS
- [rec] 2.4.8 Priority Queue — Dijkstra depende de priority queue

**Desafios planejados**
- N1 · Conceitual — Explicar quando usar ordenação topológica, Union-Find, BFS ou Dijkstra a partir do enunciado
- N2 · Programação — Resolver 'Course Schedule II' com algoritmo de Kahn
- N2 · Implementação — Implementar Union-Find com path compression e union by rank
- N3 · Programação — Resolver 'Redundant Connection' e 'Is Graph Bipartite?'
- N3 · Programação — Resolver 'Clone Graph' com HashMap de nós originais para cópias
- N4 · Programação — Resolver 'Network Delay Time' com Dijkstra usando PriorityQueue

**Critérios de conclusão**
- [ ] Resolvo Course Schedule II com Kahn e devolvo uma ordem válida
- [ ] Implemento Union-Find e resolvo Number of Connected Components / Redundant Connection
- [ ] Resolvo Network Delay Time com Dijkstra e explico a lazy deletion na PriorityQueue

#### 2.6.5 Backtracking

Backtracking constrói soluções incrementalmente, desfazendo escolhas que não levam a resultado válido. É a técnica para gerar subconjuntos, permutações e combinações e para problemas de restrição como N-Queens, com custo exponencial controlado por poda. _(~130 min)_

**Objetivos**
- Aplicar o template escolher → explorar → desfazer com estado mutável compartilhado
- Gerar subconjuntos, permutações e combinações e calcular o número de soluções (2^n, n!, C(n, k))
- Tratar elementos duplicados ordenando e pulando escolhas repetidas no mesmo nível
- Aplicar poda para reduzir o espaço de busca e estimar o ganho
- Analisar a complexidade em termos de número de nós da árvore de decisão × custo por nó

**Pré-requisitos**
- [req] 2.2.5 Recursion — Backtracking é recursão com desfazer de estado
- [rec] 2.6.2 DFS — Backtracking é uma DFS sobre a árvore de decisões

**Desafios planejados**
- N1 · Conceitual — Desenhar a árvore de decisão de Subsets para [1, 2, 3] e relacionar com 2^n
- N2 · Programação — Resolver 'Subsets' e 'Permutations' com o template escolher-explorar-desfazer
- N2 · Identificação de bugs — Corrigir um backtracking que retorna listas vazias por adicionar a referência mutável ao resultado
- N3 · Programação — Resolver 'Combination Sum' e 'Subsets II' tratando reutilização e duplicatas
- N3 · Programação — Resolver 'Word Search' em grid com marcação temporária de visitados
- N4 · Implementação — Implementar um resolvedor de Sudoku com backtracking e poda por linhas, colunas e blocos

**Critérios de conclusão**
- [ ] Resolvo Subsets, Permutations e Combination Sum com o mesmo template
- [ ] Resolvo Subsets II sem gerar duplicatas
- [ ] Explico o bug de adicionar a lista mutável ao resultado sem copiar
- [ ] Resolvo N-Queens com poda por colunas e diagonais

#### 2.6.6 Greedy

Algoritmos gulosos fazem a melhor escolha local a cada passo sem reconsiderar. São simples e eficientes, mas só corretos quando o problema tem a propriedade de escolha gulosa; o tópico treina reconhecer esses casos e justificar a corretude com argumentos de troca. _(~100 min)_

**Objetivos**
- Definir propriedade de escolha gulosa e subestrutura ótima
- Justificar a corretude com argumento de troca (exchange argument) ou 'stays ahead'
- Construir contraexemplos para estratégias gulosas incorretas (ex.: troco com moedas arbitrárias)
- Aplicar greedy com ordenação a problemas de agendamento e intervalos
- Distinguir quando greedy basta e quando é necessário programação dinâmica

**Pré-requisitos**
- [rec] 2.2.3 Sorting — Muitas estratégias gulosas começam ordenando por um critério
- [rec] 2.3.6 Intervals — Problemas de intervalos são exemplos clássicos de greedy

**Desafios planejados**
- N1 · Conceitual — Construir um contraexemplo em que o troco guloso não minimiza o número de moedas
- N2 · Programação — Resolver 'Best Time to Buy and Sell Stock' e 'Assign Cookies'
- N2 · Programação — Resolver 'Jump Game' mantendo o alcance máximo
- N3 · Programação — Resolver 'Gas Station' e provar por que basta uma passada
- N3 · Entrevista — Provar com argumento de troca que selecionar atividades por menor término é ótimo
- N4 · Programação — Resolver 'Partition Labels' e 'Jump Game II' explicando a invariante

**Critérios de conclusão**
- [ ] Resolvo Jump Game e Gas Station justificando a escolha gulosa
- [ ] Apresento um contraexemplo em que o troco guloso falha
- [ ] Explico com argumento de troca por que ordenar por término é ótimo em seleção de atividades

#### 2.6.7 Dynamic Programming básico

Programação dinâmica resolve problemas com subproblemas sobrepostos e subestrutura ótima armazenando resultados já calculados. O tópico cobre DP básica 1D e 2D: definição de estado, transição, casos base, memoização (top-down), tabulação (bottom-up) e otimização de espaço. _(~180 min)_

**Objetivos**
- Identificar subproblemas sobrepostos e subestrutura ótima em um problema
- Definir estado, transição e casos base explicitamente antes de codificar
- Implementar a mesma solução com memoização e com tabulação e comparar custos
- Reduzir o espaço de DP 1D e 2D quando a transição depende apenas de linhas/posições anteriores
- Resolver problemas clássicos: escadas, house robber, coin change, LIS, LCS e unique paths

**Pré-requisitos**
- [req] 2.2.5 Recursion — A formulação top-down da DP é uma recursão com cache
- [rec] 2.2.6 Divide and Conquer — Contrastar com divisão e conquista esclarece o papel dos subproblemas sobrepostos
- [rec] 2.6.6 Greedy — Entender quando greedy falha motiva a DP

**Desafios planejados**
- N1 · Conceitual — Explicar subproblemas sobrepostos usando a árvore de chamadas de Fibonacci
- N2 · Programação — Resolver 'Climbing Stairs' e 'House Robber' com tabulação e espaço O(1)
- N2 · Programação — Resolver 'Unique Paths' com DP 2D e depois com uma única linha
- N3 · Programação — Resolver 'Coin Change' e explicar por que greedy falha nesse problema
- N3 · Programação — Resolver 'Longest Increasing Subsequence' em O(n²) e conhecer a versão O(n log n)
- N4 · Programação — Resolver 'Longest Common Subsequence' e reconstruir a subsequência a partir da tabela

**Critérios de conclusão**
- [ ] Resolvo Climbing Stairs, House Robber e Coin Change escrevendo estado e transição antes do código
- [ ] Converto uma solução memoizada em tabulada e reduzo o espaço para O(1) ou O(n)
- [ ] Resolvo Longest Common Subsequence com tabela 2D e explico cada célula
- [ ] Explico por que Fibonacci memoizado é O(n) e o ingênuo é O(2^n)

## 03 — Backend

*O que acontece por trás de uma API: redes e HTTP, bancos de dados relacionais (SQL, índices, transações e concorrência), autenticação e segurança, e como operar um serviço em produção com observabilidade e estratégias de deploy.*

### 3.1 Redes e HTTP (11 tópicos)

**[Adicional]** Como um byte sai de um processo Java e chega a outro processo em outra máquina: endereçamento IP, portas, resolução de nomes, transporte confiável (TCP) e não confiável (UDP), a abstração de sockets do sistema operacional e as camadas de segurança (TLS) e aplicação (HTTP). O foco é entender custos reais — round-trips, handshakes, head-of-line blocking, reutilização de conexões — que explicam a latência de qualquer API em produção.

Objetivos do módulo:
- Explicar o caminho completo de uma requisição HTTPS, do DNS até a resposta, contando os round-trips envolvidos
- Diferenciar TCP e UDP em garantias, custos e casos de uso reais
- Usar ferramentas de diagnóstico (dig, curl -v, ss/netstat, tcpdump/Wireshark, openssl s_client) para observar protocolos em funcionamento
- Relacionar sockets do sistema operacional com as APIs de rede do Java
- Entender como HTTP/1.1, HTTP/2 e HTTP/3 lidam com conexões persistentes e multiplexação
- Aplicar as restrições do estilo REST sobre a semântica do HTTP

#### 3.1.1 IP

IP é o protocolo da camada de rede responsável por endereçar e rotear pacotes entre hosts, sem garantia de entrega ou ordem. Envolve IPv4/IPv6, sub-redes (CIDR), roteamento, TTL, fragmentação/MTU e NAT. _(~90 min)_

**Objetivos**
- Explicar o modelo de camadas (TCP/IP) e o papel do IP como serviço best-effort
- Calcular rede, broadcast e quantidade de hosts a partir de uma notação CIDR
- Diferenciar IPv4 e IPv6, endereços públicos, privados e de loopback
- Explicar como roteadores encaminham pacotes por tabela de rotas e o papel do TTL
- Entender NAT e por que ele afeta conexões de entrada em servidores

**Pré-requisitos**
- [rec] 1.2.1 Sistema operacional — A pilha de rede é implementada pelo kernel do sistema operacional
- [rec] 1.2.9 I/O — Rede é uma forma de I/O mediada pelo sistema operacional

**Desafios planejados**
- N1 · Conceitual — Explicar por que o IP é best-effort e quem garante confiabilidade acima dele
- N2 · Programação — Implementar em Java uma calculadora CIDR (rede, broadcast, máscara, hosts)
- N2 · Experimento — Usar traceroute/tracert e interpretar cada salto e as variações de latência
- N3 · Entrevista — O que acontece quando um pacote excede a MTU do caminho e o bit DF está ligado?
- N4 · Implementação — Construir um verificador de IP (público/privado/loopback/IPv6) usando InetAddress

**Critérios de conclusão**
- [ ] Consigo calcular manualmente a faixa de hosts de 10.0.12.0/22
- [ ] Explico o que acontece com um pacote cujo TTL chega a zero e como o traceroute usa isso
- [ ] Consigo explicar por que um serviço atrás de NAT não recebe conexões sem port forwarding
- [ ] Leio a tabela de rotas da minha máquina (ip route / route print) e identifico o default gateway

#### 3.1.2 Portas

Portas são números de 16 bits que identificam processos/serviços em um host; junto com IPs e protocolo formam a 5-tupla que identifica uma conexão. Envolve portas conhecidas, efêmeras, bind e escuta. _(~45 min)_

**Objetivos**
- Explicar por que IP sozinho não basta e como a 5-tupla identifica uma conexão
- Diferenciar portas conhecidas, registradas e efêmeras
- Listar portas em escuta e conexões ativas com ss/netstat e associá-las a processos
- Explicar por que vários clientes podem conectar na mesma porta 443 de um servidor
- Entender o esgotamento de portas efêmeras em clientes com muitas conexões curtas

**Pré-requisitos**
- [rec] 1.2.2 Processo — Portas associam tráfego de rede a processos

**Desafios planejados**
- N1 · Conceitual — Explicar a 5-tupla e por que ela permite milhares de conexões na mesma porta do servidor
- N2 · Experimento — Mapear portas em escuta com ss -tlnp/netstat -ano e identificar os processos donos
- N2 · Identificação de bugs — Diagnosticar um Spring Boot que falha ao iniciar com BindException na porta 8080
- N3 · Entrevista — Por que um cliente HTTP sem reuso de conexão pode esgotar portas efêmeras?
- N4 · Implementação — Escrever um port scanner TCP simples em Java com timeout configurável

**Critérios de conclusão**
- [ ] Identifico qual processo está ouvindo em uma porta na minha máquina
- [ ] Explico o erro 'Address already in use' e como resolvê-lo
- [ ] Explico por que um servidor não esgota portas ao aceitar milhares de clientes, mas um cliente pode

#### 3.1.3 DNS

DNS é o sistema distribuído e hierárquico que traduz nomes em registros (A, AAAA, CNAME, MX, TXT). Envolve resolução recursiva e iterativa, cache com TTL e impactos de latência e falha em serviços backend. _(~60 min)_

**Objetivos**
- Descrever a resolução de um nome passando por resolver recursivo, root, TLD e autoritativo
- Diferenciar tipos de registro A, AAAA, CNAME, MX, TXT e NS
- Explicar o papel do TTL e os efeitos de cache em migrações e failover
- Usar dig/nslookup para inspecionar a cadeia de resolução
- Entender o cache de DNS da JVM (networkaddress.cache.ttl) e seus efeitos em produção

**Pré-requisitos**
- [rec] 3.1.1 IP — DNS resolve nomes para endereços IP

**Desafios planejados**
- N1 · Conceitual — Desenhar a resolução recursiva de api.exemplo.com.br do root até o autoritativo
- N2 · Experimento — Rodar dig +trace e comparar TTLs entre resolvers diferentes
- N3 · Identificação de bugs — Investigar um serviço Java que continua chamando um IP antigo após troca de DNS
- N3 · Entrevista — Por que DNS usa UDP na maioria das consultas e quando recorre a TCP?
- N4 · Implementação — Construir um resolvedor DNS mínimo em Java que monta e envia uma query UDP do tipo A

**Critérios de conclusão**
- [ ] Consigo seguir manualmente uma resolução com dig +trace e explicar cada etapa
- [ ] Explico por que uma mudança de DNS pode demorar a propagar
- [ ] Explico o risco de uma JVM com cache de DNS infinito diante de IPs que mudam (ex.: load balancers em nuvem)

#### 3.1.4 TCP

TCP fornece um fluxo de bytes confiável, ordenado e orientado a conexão sobre IP, usando three-way handshake, números de sequência, ACKs, retransmissão, controle de fluxo e controle de congestionamento. Também introduz head-of-line blocking e estados como TIME_WAIT. _(~150 min)_

**Objetivos**
- Explicar o three-way handshake e o encerramento com FIN/ACK, incluindo TIME_WAIT
- Explicar números de sequência, ACKs e retransmissão por timeout e fast retransmit
- Diferenciar controle de fluxo (janela do receptor) e controle de congestionamento (slow start, cwnd)
- Explicar head-of-line blocking no nível do TCP
- Entender o efeito do algoritmo de Nagle e do TCP_NODELAY em latência
- Estimar o custo em RTTs para abrir uma conexão e transferir dados

**Pré-requisitos**
- [req] 3.1.1 IP — TCP é transportado sobre IP
- [rec] 3.1.2 Portas — Conexões TCP são identificadas por pares de portas

**Desafios planejados**
- N1 · Conceitual — Explicar por que o handshake precisa de três mensagens e não duas
- N2 · Experimento — Capturar um handshake TCP com tcpdump/Wireshark e anotar flags, seq e ack
- N3 · Experimento — Simular perda de pacotes com tc netem (ou clumsy no Windows) e observar retransmissões e cwnd
- N3 · Identificação de bugs — Diagnosticar milhares de conexões em CLOSE_WAIT em um serviço que não fecha sockets
- N3 · Entrevista — Como TCP_NODELAY e o Nagle interagem com delayed ACK para causar latências de 40ms?
- N4 · Implementação — Implementar um protocolo de transferência confiável simplificado (stop-and-wait) sobre UDP

**Critérios de conclusão**
- [ ] Capturei e identifiquei SYN, SYN-ACK, ACK e o encerramento de uma conexão real
- [ ] Explico por que uma conexão nova é mais lenta no início (slow start)
- [ ] Explico por que uma perda de pacote atrasa todos os dados seguintes no mesmo fluxo
- [ ] Sei interpretar um grande número de conexões em TIME_WAIT ou CLOSE_WAIT

#### 3.1.5 UDP

UDP é um protocolo de transporte sem conexão que entrega datagramas sem garantia de entrega, ordem ou controle de congestionamento, com overhead mínimo. É a base de DNS, streaming, jogos e do QUIC/HTTP/3. _(~50 min)_

**Objetivos**
- Comparar UDP e TCP em garantias, overhead de cabeçalho e latência
- Explicar por que aplicações em tempo real preferem perder dados a esperar retransmissões
- Entender os limites de tamanho de datagrama e a relação com MTU
- Explicar como o QUIC reimplementa confiabilidade e criptografia sobre UDP

**Pré-requisitos**
- [rec] 3.1.4 TCP — UDP é melhor compreendido em contraste com as garantias do TCP

**Desafios planejados**
- N1 · Conceitual — Comparar os cabeçalhos UDP e TCP campo a campo e justificar o overhead
- N2 · Programação — Criar cliente e servidor UDP com DatagramSocket que numeram mensagens e detectam perdas
- N3 · Experimento — Enviar rajadas de datagramas sob perda simulada e medir taxa de entrega e reordenação
- N3 · Entrevista — Por que o QUIC escolheu UDP em vez de criar um novo protocolo de transporte?
- N4 · Implementação — Construir um serviço de heartbeat/métricas via UDP em Java tolerante a perdas

**Critérios de conclusão**
- [ ] Explico em quais cenários UDP é preferível a TCP, com exemplos reais
- [ ] Demonstrei perda ou reordenação de datagramas em um experimento
- [ ] Explico por que o HTTP/3 roda sobre QUIC/UDP

#### 3.1.6 Sockets

Sockets são a abstração do sistema operacional para comunicação em rede, expostos como file descriptors com chamadas socket, bind, listen, accept, connect, read e write. Incluem backlog, buffers do kernel, I/O bloqueante vs. não bloqueante e multiplexação (select/epoll). _(~120 min)_

**Objetivos**
- Descrever o ciclo de vida de um socket servidor e cliente nas syscalls do SO
- Explicar backlog de accept e buffers de envio/recepção do kernel
- Diferenciar I/O bloqueante, não bloqueante e multiplexado (epoll/kqueue)
- Relacionar ServerSocket/Socket e NIO (Selector, SocketChannel) com as syscalls subjacentes
- Entender o modelo thread-per-connection e seus limites de escala

**Pré-requisitos**
- [req] 3.1.4 TCP — Sockets de stream expõem conexões TCP
- [rec] 1.2.3 Thread — Modelos de servidor dependem de threads
- [rec] 1.2.9 I/O — Sockets são file descriptors e seguem o modelo de I/O do SO

**Desafios planejados**
- N1 · Conceitual — Mapear cada método de ServerSocket/Socket para a syscall correspondente
- N2 · Programação — Implementar um echo server TCP thread-per-connection em Java
- N2 · Identificação de bugs — Corrigir um protocolo que assume que um read() devolve a mensagem inteira
- N3 · Experimento — Observar as syscalls de um servidor Java com strace (ou Process Monitor) durante accept e read
- N4 · Implementação — Reescrever o echo server com Java NIO Selector em uma única thread

**Critérios de conclusão**
- [ ] Implementei um servidor TCP em Java que atende vários clientes simultaneamente
- [ ] Explico o que acontece quando o backlog enche
- [ ] Explico por que epoll escala melhor que uma thread por conexão bloqueada
- [ ] Sei que read() pode retornar menos bytes do que o solicitado e trato isso corretamente

#### 3.1.7 TLS

TLS protege comunicação com confidencialidade, integridade e autenticação do servidor, combinando troca de chaves (ECDHE), certificados X.509 e criptografia simétrica autenticada. Inclui o handshake do TLS 1.3, cadeia de confiança, SNI e mTLS. _(~120 min)_

**Objetivos**
- Explicar por que TLS usa criptografia assimétrica para troca de chaves e simétrica para dados
- Descrever o handshake TLS 1.3 e comparar seu custo em RTTs com o TLS 1.2
- Validar uma cadeia de certificados até uma CA raiz e explicar o papel do hostname
- Explicar forward secrecy e por que ECDHE a oferece
- Entender mTLS, keystores e truststores no Java

**Pré-requisitos**
- [req] 3.1.4 TCP — TLS opera sobre uma conexão TCP estabelecida

**Desafios planejados**
- N1 · Conceitual — Explicar como certificado, assinatura da CA e hostname garantem que falo com o servidor certo
- N2 · Experimento — Inspecionar handshake, versão, cipher suite e cadeia com openssl s_client -connect
- N2 · Experimento — Capturar um handshake TLS 1.3 no Wireshark e identificar ClientHello, SNI e ServerHello
- N3 · Identificação de bugs — Diagnosticar PKIX path building failed ao chamar uma API com certificado de CA interna
- N4 · Implementação — Configurar mTLS entre dois serviços Java com keystore e truststore próprios

**Critérios de conclusão**
- [ ] Inspecionei uma cadeia de certificados com openssl s_client e expliquei cada nível
- [ ] Explico o que um atacante na rede consegue e não consegue ver numa conexão TLS
- [ ] Resolvo um erro PKIX path building failed em uma aplicação Java
- [ ] Explico a diferença entre autenticação do servidor e mTLS

#### 3.1.8 HTTP

HTTP é o protocolo de aplicação requisição-resposta baseado em métodos, status codes, cabeçalhos e corpo. Abrange semântica dos métodos, cache, negociação de conteúdo e a evolução HTTP/1.1, HTTP/2 (multiplexação binária) e HTTP/3 (QUIC). _(~120 min)_

**Objetivos**
- Escrever uma requisição HTTP/1.1 manualmente e interpretar a resposta byte a byte
- Explicar a semântica dos métodos (safe, idempotente) e das classes de status code
- Usar cabeçalhos de cache (Cache-Control, ETag, If-None-Match) e de conteúdo
- Explicar como o HTTP/2 multiplexa streams e por que o head-of-line blocking do TCP persiste
- Explicar o que o HTTP/3 resolve ao usar QUIC

**Pré-requisitos**
- [req] 3.1.4 TCP — HTTP/1.1 e HTTP/2 rodam sobre TCP
- [rec] 3.1.3 DNS — Toda requisição a um host começa pela resolução do nome

**Desafios planejados**
- N1 · Conceitual — Classificar métodos HTTP como safe e/ou idempotentes e justificar
- N2 · Experimento — Enviar uma requisição GET manual com nc/telnet e analisar status line, headers e corpo
- N2 · Experimento — Comparar curl --http1.1 e --http2 com -v e observar a negociação via ALPN
- N3 · Entrevista — Por que o HTTP/2 ainda sofre head-of-line blocking e como o HTTP/3 resolve?
- N4 · Implementação — Implementar um servidor HTTP/1.1 mínimo sobre sockets em Java (parsing de request line e headers)

**Critérios de conclusão**
- [ ] Fiz uma requisição HTTP manual via telnet/nc e interpretei a resposta
- [ ] Escolho corretamente entre 400, 401, 403, 404, 409, 422 e 500 para cenários dados
- [ ] Explico como ETag permite respostas 304 Not Modified
- [ ] Explico a diferença entre head-of-line blocking no HTTP/1.1 e no HTTP/2

#### 3.1.9 HTTPS

HTTPS é HTTP transportado sobre TLS, combinando a semântica do HTTP com confidencialidade e autenticação. Abrange custo de conexão, terminação TLS em proxies/load balancers, HSTS e redirecionamentos seguros. _(~60 min)_

**Objetivos**
- Contar os RTTs de uma primeira requisição HTTPS (DNS, TCP, TLS, HTTP)
- Explicar terminação TLS em load balancer e as implicações para o backend (X-Forwarded-Proto)
- Explicar HSTS e o ataque de SSL stripping que ele previne
- Entender session resumption e 0-RTT e seus riscos de replay

**Pré-requisitos**
- [req] 3.1.7 TLS — HTTPS é HTTP sobre TLS
- [req] 3.1.8 HTTP — A camada de aplicação do HTTPS é o HTTP

**Desafios planejados**
- N1 · Conceitual — Listar o que fica visível a um observador de rede em uma requisição HTTPS (IP, SNI, tamanhos)
- N2 · Experimento — Medir time_namelookup, time_connect, time_appconnect e time_starttransfer com curl -w
- N3 · Identificação de bugs — Corrigir uma aplicação atrás de load balancer que gera redirects para http:// em vez de https://
- N3 · Entrevista — Quais os riscos do 0-RTT do TLS 1.3 para requisições não idempotentes?
- N4 · Projeto — Configurar um proxy reverso (nginx/Caddy) com TLS, HSTS e encaminhamento correto de headers para um app Java

**Critérios de conclusão**
- [ ] Medi o tempo de cada fase de uma requisição HTTPS com curl -w
- [ ] Explico por que uma aplicação atrás de um proxy pode gerar redirects http:// incorretos
- [ ] Explico o que o HSTS protege e o que ele não protege

#### 3.1.10 REST

REST é um estilo arquitetural definido por restrições (cliente-servidor, stateless, cache, interface uniforme, sistema em camadas) que se apoia na semântica do HTTP. Aqui o foco é o estilo e o uso correto do protocolo, não o design detalhado de APIs. _(~60 min)_

**Objetivos**
- Enumerar as restrições do REST definidas por Fielding e o propósito de cada uma
- Explicar como recursos, representações e métodos HTTP compõem a interface uniforme
- Diferenciar REST de RPC sobre HTTP com exemplos concretos
- Explicar o papel do cache e de intermediários (proxies, CDNs) no estilo REST
- Entender HATEOAS e o modelo de maturidade de Richardson

**Pré-requisitos**
- [req] 3.1.8 HTTP — REST é aplicado sobre a semântica dos métodos e status do HTTP

**Desafios planejados**
- N1 · Conceitual — Explicar cada restrição do REST e o que se perde ao violá-la
- N2 · Análise de código — Classificar uma API pública real nos níveis 0 a 3 de Richardson
- N2 · Programação — Converter uma lista de endpoints RPC em recursos e métodos HTTP apropriados
- N3 · Entrevista — Uma API que usa POST para tudo e sempre responde 200 é REST? Por quê?
- N4 · Projeto — Projetar uma API de biblioteca no nível 3 de Richardson com links HATEOAS

**Critérios de conclusão**
- [ ] Classifico uma API existente no modelo de maturidade de Richardson
- [ ] Reescrevo endpoints no estilo RPC (/criarPedido) como recursos REST
- [ ] Explico por que a restrição stateless favorece escala horizontal

#### 3.1.11 Keep-Alive

Keep-Alive (conexões persistentes) permite reutilizar uma conexão TCP/TLS para várias requisições HTTP, amortizando handshakes. Envolve timeouts de ociosidade, pools de conexão em clientes HTTP e interação com load balancers. _(~60 min)_

**Objetivos**
- Quantificar a economia de RTTs ao reutilizar conexões
- Explicar timeouts de keep-alive no cliente, servidor e load balancer e por que devem ser coerentes
- Configurar pools de conexão em clientes HTTP Java (HttpClient, Apache HttpClient)
- Diagnosticar erros de conexão resetada causados por timeouts incompatíveis
- Comparar keep-alive do HTTP/1.1 com multiplexação do HTTP/2

**Pré-requisitos**
- [req] 3.1.8 HTTP — Keep-Alive é um comportamento do protocolo HTTP
- [rec] 3.1.4 TCP — O ganho vem de evitar handshake e slow start do TCP

**Desafios planejados**
- N1 · Conceitual — Calcular os RTTs economizados ao fazer 10 requisições HTTPS em uma única conexão
- N2 · Experimento — Comparar com curl -v várias URLs na mesma conexão versus conexões separadas
- N3 · Identificação de bugs — Investigar 'Connection reset by peer' intermitente causado por idle timeout do load balancer menor que o do cliente
- N3 · Entrevista — Por que um serviço que cria um novo HttpClient por requisição degrada sob carga?
- N4 · Implementação — Benchmark em Java de um cliente HTTP com e sem pool, medindo latência p50/p99 e conexões abertas

**Critérios de conclusão**
- [ ] Medi a diferença de latência entre requisições com e sem reuso de conexão
- [ ] Explico por que o timeout de ociosidade do cliente deve ser menor que o do servidor/LB
- [ ] Configurei um pool de conexões HTTP com limites e timeouts explícitos

### 3.2 Banco de Dados II — Transações e concorrência (12 tópicos)

**[Adicional]** Transações e controle de concorrência em bancos relacionais: garantias ACID, níveis de isolamento e as anomalias que cada um permite, locks, deadlocks, estratégias otimista e pessimista, MVCC e replicação. Embora apareça antes no roadmap, recomenda-se estudar o módulo 3.4 (SQL, índices e performance) antes deste — os pré-requisitos dos tópicos apontam para ele. Os experimentos usam duas sessões psql simultâneas no PostgreSQL para reproduzir cada fenômeno na prática.

Objetivos do módulo:
- Explicar o que cada letra de ACID garante e como o banco implementa essas garantias (WAL, locks, MVCC)
- Reproduzir dirty read, non-repeatable read, phantom read e lost update com sessões concorrentes
- Escolher o nível de isolamento adequado conhecendo seu custo e as anomalias permitidas
- Diagnosticar e prevenir deadlocks e contenção de locks
- Implementar optimistic e pessimistic locking em SQL e entender seu equivalente no ecossistema Java
- Entender MVCC no PostgreSQL (xmin/xmax, snapshots, VACUUM) e os trade-offs de replicação síncrona e assíncrona

#### 3.2.1 Transactions

Uma transação agrupa operações em uma unidade lógica que é confirmada (COMMIT) ou desfeita (ROLLBACK) por inteiro. Envolve delimitação explícita, autocommit, savepoints e o custo de transações longas. _(~60 min)_

**Objetivos**
- Usar BEGIN, COMMIT, ROLLBACK e SAVEPOINT corretamente
- Explicar o modo autocommit e seus efeitos em JDBC
- Identificar o escopo correto de uma transação em um caso de negócio
- Explicar por que transações longas são prejudiciais (locks, bloat, conexões presas)
- Controlar transações manualmente via JDBC (setAutoCommit, commit, rollback)

**Pré-requisitos**
- [req] 3.4.2 SQL — Transações agrupam comandos SQL; é preciso dominar SQL antes
- [rec] 3.4.1 Modelo relacional — O modelo relacional dá contexto às regras de integridade protegidas por transações

**Desafios planejados**
- N1 · Conceitual — Explicar o que acontece com cada comando quando um erro ocorre no meio de uma transação no PostgreSQL
- N2 · Programação — Implementar transferência bancária em JDBC com controle manual de commit e rollback
- N2 · Identificação de bugs — Encontrar o bug de uma transferência que debita mas não credita por causa do autocommit
- N3 · Experimento — Deixar uma transação aberta 'idle in transaction' e observar seus efeitos em pg_stat_activity
- N4 · Implementação — Criar um pequeno helper Java 'inTransaction(lambda)' que garante commit/rollback e fechamento da conexão

**Critérios de conclusão**
- [ ] Implementei uma transferência entre contas em JDBC que faz rollback em caso de falha
- [ ] Explico o que acontece com uma transação aberta quando a conexão cai
- [ ] Uso savepoints para desfazer parte de uma transação

#### 3.2.2 ACID

ACID descreve as garantias de transações: atomicidade, consistência, isolamento e durabilidade. O foco é como bancos as implementam — write-ahead log (WAL), fsync, constraints, locks e MVCC. _(~75 min)_

**Objetivos**
- Definir cada propriedade ACID com precisão e exemplos de violação
- Explicar como o WAL garante atomicidade e durabilidade após crashes
- Diferenciar a consistência do ACID da consistência de sistemas distribuídos (CAP)
- Entender o custo de durabilidade (fsync, synchronous_commit) e seus trade-offs

**Pré-requisitos**
- [rec] 3.4.5 Foreign Key — Constraints como FK são o mecanismo concreto da consistência

**Desafios planejados**
- N1 · Conceitual — Dar um exemplo concreto de violação de cada letra de ACID
- N2 · Experimento — Medir o throughput de inserts com synchronous_commit on versus off
- N3 · Entrevista — Como o write-ahead log permite durabilidade sem gravar as páginas de dados a cada commit?
- N3 · Análise de código — Inspecionar registros do WAL com pg_waldump após uma transação simples
- N4 · Implementação — Implementar um key-value store em Java com log append-only e recuperação após crash

**Critérios de conclusão**
- [ ] Explico como o banco se recupera de um crash no meio de uma transação usando o WAL
- [ ] Diferencio o 'C' do ACID do 'C' do CAP
- [ ] Explico o que se perde ao desligar synchronous_commit

#### 3.2.3 Isolation Levels

Níveis de isolamento (Read Uncommitted, Read Committed, Repeatable Read, Serializable) definem quais anomalias de concorrência uma transação pode observar. Abrange o padrão SQL, as diferenças de implementação no PostgreSQL/MySQL e o custo de cada nível. _(~90 min)_

**Objetivos**
- Relacionar cada nível de isolamento às anomalias que ele previne segundo o padrão SQL
- Explicar como PostgreSQL implementa os níveis com snapshots e o SSI no Serializable
- Comparar defaults e comportamentos de PostgreSQL e MySQL/InnoDB
- Tratar falhas de serialização (SQLSTATE 40001) com retry
- Configurar o nível de isolamento via SQL e JDBC

**Pré-requisitos**
- [rec] 3.2.2 ACID — Isolamento é a letra I do ACID

**Desafios planejados**
- N1 · Conceitual — Construir a matriz nível de isolamento x anomalia e justificar cada célula
- N2 · Experimento — Abrir duas sessões psql e comparar leituras em READ COMMITTED versus REPEATABLE READ
- N3 · Experimento — Reproduzir write skew em REPEATABLE READ e mostrar que SERIALIZABLE o impede
- N3 · Entrevista — Por que o Repeatable Read do PostgreSQL não permite phantoms enquanto o padrão SQL permite?
- N4 · Implementação — Implementar em Java um executor de transação Serializable com retry em SQLSTATE 40001

**Critérios de conclusão**
- [ ] Monto a tabela nível x anomalia de memória e explico as diferenças do PostgreSQL
- [ ] Provoquei e tratei um erro de serialização em Serializable
- [ ] Justifico a escolha de um nível de isolamento para um caso de negócio

#### 3.2.4 Dirty Read

Dirty read ocorre quando uma transação lê dados escritos por outra ainda não confirmada, que pode fazer rollback. Ocorre apenas em Read Uncommitted e o PostgreSQL nunca o permite. _(~40 min)_

**Objetivos**
- Definir dirty read e mostrar por que ele leva a decisões baseadas em dados que nunca existiram
- Identificar em quais níveis e bancos o fenômeno é possível
- Reproduzir o fenômeno em um banco que o permite (MySQL em READ UNCOMMITTED)
- Explicar por que o PostgreSQL trata Read Uncommitted como Read Committed

**Pré-requisitos**
- [req] 3.2.3 Isolation Levels — O fenômeno é definido em relação aos níveis de isolamento

**Desafios planejados**
- N1 · Conceitual — Desenhar a linha do tempo de duas transações que produzem um dirty read
- N2 · Experimento — Reproduzir dirty read no MySQL com duas sessões em READ UNCOMMITTED
- N2 · Experimento — Tentar o mesmo no PostgreSQL e explicar por que não acontece
- N3 · Entrevista — Existe algum caso legítimo para usar READ UNCOMMITTED em produção?
- N4 · Implementação — Escrever um teste JDBC automatizado que verifica que o banco da aplicação nunca expõe dirty reads

**Critérios de conclusão**
- [ ] Reproduzi um dirty read e expliquei a linha do tempo das duas transações
- [ ] Explico por que o PostgreSQL não sofre dirty reads mesmo em READ UNCOMMITTED

#### 3.2.5 Non-repeatable Read

Non-repeatable read ocorre quando a mesma linha, lida duas vezes na mesma transação, retorna valores diferentes porque outra transação a alterou e confirmou entre as leituras. Afeta Read Committed e é eliminado com snapshots por transação. _(~40 min)_

**Objetivos**
- Definir non-repeatable read e distingui-lo de dirty read
- Reproduzir o fenômeno em READ COMMITTED no PostgreSQL
- Explicar por que snapshot por comando (Read Committed) versus por transação (Repeatable Read) muda o resultado
- Identificar bugs de negócio causados pelo fenômeno (ex.: relatórios inconsistentes)

**Pré-requisitos**
- [rec] 3.2.4 Dirty Read — Comparar com dirty read esclarece a diferença entre dados confirmados e não confirmados

**Desafios planejados**
- N1 · Conceitual — Explicar a diferença entre non-repeatable read e dirty read com um exemplo de saldo
- N2 · Experimento — Reproduzir um non-repeatable read com duas sessões psql em READ COMMITTED
- N3 · Identificação de bugs — Encontrar a causa de um relatório cujo total não bate com a soma das linhas
- N3 · Programação — Escrever um teste JDBC com duas conexões que demonstra o fenômeno de forma determinística
- N4 · Implementação — Gerar um relatório financeiro consistente em Java usando REPEATABLE READ READ ONLY

**Critérios de conclusão**
- [ ] Reproduzi um non-repeatable read com duas sessões psql
- [ ] Eliminei o fenômeno trocando o nível de isolamento e expliquei por quê

#### 3.2.6 Phantom Read

Phantom read ocorre quando uma consulta por predicado retorna um conjunto diferente de linhas na mesma transação porque outra inseriu ou removeu linhas que satisfazem o predicado. Relaciona-se com predicate locks, gap locks e Serializable. _(~50 min)_

**Objetivos**
- Definir phantom read e diferenciá-lo de non-repeatable read
- Reproduzir phantoms em READ COMMITTED no PostgreSQL
- Explicar como InnoDB usa gap/next-key locks e PostgreSQL usa snapshots/SSI
- Reconhecer padrões de check-then-insert vulneráveis a phantoms

**Pré-requisitos**
- [rec] 3.2.5 Non-repeatable Read — Phantom read é a generalização do non-repeatable read para conjuntos de linhas

**Desafios planejados**
- N1 · Conceitual — Explicar por que travar as linhas lidas não impede phantoms
- N2 · Experimento — Reproduzir um phantom read com duas sessões psql em READ COMMITTED
- N3 · Identificação de bugs — Corrigir um sistema de agendamento que permite duas reservas no mesmo horário
- N3 · Entrevista — Como o InnoDB evita phantoms em REPEATABLE READ usando next-key locks?
- N4 · Implementação — Implementar reservas sem sobreposição usando exclusion constraint do PostgreSQL

**Critérios de conclusão**
- [ ] Reproduzi um phantom read com duas sessões
- [ ] Explico por que um check-then-insert de reserva de horário pode gerar duplicidade
- [ ] Proponho ao menos duas soluções (constraint única, Serializable, lock explícito)

#### 3.2.7 Locks

Locks coordenam o acesso concorrente a dados: locks de linha, de tabela, compartilhados e exclusivos, adquiridos implícita ou explicitamente. Abrange modos de lock do PostgreSQL, filas de espera, lock_timeout e como índices afetam o escopo do lock. _(~75 min)_

**Objetivos**
- Diferenciar locks compartilhados e exclusivos e sua matriz de compatibilidade
- Identificar quais comandos adquirem quais locks (UPDATE, SELECT FOR UPDATE, ALTER TABLE)
- Inspecionar locks ativos e bloqueios com pg_locks e pg_blocking_pids
- Explicar por que um DDL pode travar toda a aplicação ao esperar na fila de locks
- Explicar como índices reduzem o número de linhas travadas

**Pré-requisitos**
- [rec] 3.2.3 Isolation Levels — Locks são um dos mecanismos que implementam isolamento
- [rec] 3.4.6 Indexes — O uso de índices determina quantas linhas uma operação precisa examinar e travar

**Desafios planejados**
- N1 · Conceitual — Montar a matriz de compatibilidade entre os principais modos de lock do PostgreSQL
- N2 · Experimento — Bloquear uma sessão com UPDATE não confirmado e encontrar o bloqueador via pg_blocking_pids
- N3 · Experimento — Mostrar um ALTER TABLE esperando um lock e enfileirando todos os SELECTs seguintes
- N3 · Entrevista — Por que uma migração em produção deve usar lock_timeout?
- N4 · Implementação — Criar uma consulta de monitoramento que lista cadeias de bloqueio com tempo de espera e SQL

**Critérios de conclusão**
- [ ] Identifiquei qual sessão bloqueia outra usando pg_locks
- [ ] Explico por que um ALTER TABLE simples pode derrubar a disponibilidade
- [ ] Uso lock_timeout e statement_timeout para limitar esperas

#### 3.2.8 Deadlocks

Deadlock é um ciclo de espera entre transações que mantêm locks e aguardam locks umas das outras. O banco detecta o ciclo e aborta uma vítima; a prevenção envolve ordem consistente de aquisição e transações curtas. _(~60 min)_

**Objetivos**
- Explicar as condições necessárias para deadlock e o grafo de espera
- Reproduzir um deadlock com duas sessões e ler a mensagem de erro do banco
- Explicar como o detector de deadlocks do PostgreSQL funciona (deadlock_timeout)
- Prevenir deadlocks com ordenação de acesso e retry na aplicação

**Pré-requisitos**
- [req] 3.2.7 Locks — Deadlocks surgem da forma como locks são adquiridos
- [rec] 2.4.9 Graph — Detecção de deadlock é detecção de ciclo em um grafo de espera

**Desafios planejados**
- N1 · Conceitual — Desenhar o grafo de espera de um deadlock entre duas transferências opostas
- N2 · Experimento — Reproduzir um deadlock com duas sessões psql atualizando duas contas em ordem inversa
- N3 · Identificação de bugs — Encontrar a causa de deadlocks intermitentes em um job de atualização em lote
- N3 · Programação — Corrigir transferências ordenando os locks por id da conta e provar com teste concorrente
- N4 · Implementação — Implementar em Java um detector de ciclos em grafo de espera simulado

**Critérios de conclusão**
- [ ] Reproduzi um deadlock e interpretei o log do PostgreSQL
- [ ] Corrigi um código que causava deadlock ordenando os acessos
- [ ] Implementei retry para a transação vítima

#### 3.2.9 Optimistic Locking

Optimistic locking assume que conflitos são raros: lê sem travar e valida no momento da escrita usando uma coluna de versão, rejeitando atualizações concorrentes. Resolve lost updates com baixo custo sob baixa contenção. _(~60 min)_

**Objetivos**
- Explicar o problema de lost update em fluxos ler-modificar-escrever
- Implementar versionamento com UPDATE ... WHERE id = ? AND version = ?
- Tratar conflitos (0 linhas afetadas) com retry ou resposta ao cliente
- Relacionar com @Version do JPA e ETag/If-Match em APIs HTTP
- Identificar quando a alta contenção torna a estratégia ineficiente

**Pré-requisitos**
- [rec] 3.2.3 Isolation Levels — Lost update é uma anomalia ligada ao nível de isolamento

**Desafios planejados**
- N1 · Conceitual — Explicar como dois usuários editando o mesmo registro perdem dados sem versionamento
- N2 · Programação — Implementar update otimista com coluna version em JDBC e detectar conflito
- N3 · Experimento — Medir taxa de conflitos e retries sob 50 threads disputando o mesmo registro
- N3 · Entrevista — Quando optimistic locking é pior que pessimistic locking?
- N4 · Implementação — Criar endpoint de edição com ETag/If-Match que responde 412 em conflito

**Critérios de conclusão**
- [ ] Reproduzi um lost update e o eliminei com coluna de versão
- [ ] Explico o que a aplicação deve fazer quando a atualização afeta 0 linhas
- [ ] Explico como ETag e 412 Precondition Failed aplicam a mesma ideia no HTTP

#### 3.2.10 Pessimistic Locking

Pessimistic locking trava explicitamente os dados antes de alterá-los (SELECT ... FOR UPDATE), serializando o acesso concorrente. Inclui NOWAIT, SKIP LOCKED e o uso como fila de trabalho. _(~60 min)_

**Objetivos**
- Usar SELECT ... FOR UPDATE / FOR SHARE corretamente dentro de transações
- Explicar NOWAIT e SKIP LOCKED e seus casos de uso
- Implementar uma fila de jobs concorrente com FOR UPDATE SKIP LOCKED
- Avaliar o impacto em throughput e risco de deadlock

**Pré-requisitos**
- [req] 3.2.7 Locks — Pessimistic locking é o uso explícito de locks de linha
- [rec] 3.2.9 Optimistic Locking — A comparação com a abordagem otimista orienta a escolha

**Desafios planejados**
- N1 · Conceitual — Comparar otimista e pessimista em contenção, latência e risco de deadlock
- N2 · Programação — Implementar reserva de estoque com SELECT ... FOR UPDATE em JDBC
- N2 · Experimento — Observar a diferença entre FOR UPDATE, NOWAIT e SKIP LOCKED com duas sessões
- N3 · Identificação de bugs — Corrigir um código que faz SELECT FOR UPDATE com autocommit ligado e não trava nada
- N4 · Projeto — Construir uma fila de jobs em PostgreSQL consumida por múltiplos workers Java com SKIP LOCKED

**Critérios de conclusão**
- [ ] Implementei decremento de estoque seguro com SELECT FOR UPDATE
- [ ] Implementei uma fila com SKIP LOCKED processada por vários workers sem duplicidade
- [ ] Explico quando prefiro otimista e quando prefiro pessimista

#### 3.2.11 MVCC

MVCC (Multi-Version Concurrency Control) mantém várias versões de cada linha para que leitores não bloqueiem escritores. No PostgreSQL, tuplas carregam xmin/xmax, a visibilidade é decidida por snapshots e versões mortas são removidas pelo VACUUM. _(~120 min)_

**Objetivos**
- Explicar como xmin, xmax e snapshots determinam a visibilidade de uma tupla
- Explicar por que um UPDATE no PostgreSQL cria uma nova versão da linha
- Entender bloat, VACUUM, autovacuum e HOT updates
- Explicar o risco de transaction ID wraparound
- Comparar MVCC do PostgreSQL (versões na tabela) com InnoDB (undo log)

**Pré-requisitos**
- [req] 3.2.3 Isolation Levels — MVCC é o mecanismo que implementa os níveis de isolamento por snapshot
- [rec] 3.4.6 Indexes — Novas versões de linha também afetam índices e motivam HOT updates
- [rec] 3.4.7 B+ Tree — Entender páginas e estrutura física ajuda a compreender bloat

**Desafios planejados**
- N1 · Conceitual — Explicar como leitores e escritores não se bloqueiam sob MVCC
- N2 · Experimento — Consultar xmin, xmax e ctid antes e depois de UPDATE em duas sessões psql
- N3 · Experimento — Usar pageinspect para ver tuplas mortas e o efeito do VACUUM na página
- N3 · Identificação de bugs — Investigar uma tabela que cresce sem parar por causa de uma transação 'idle in transaction'
- N3 · Entrevista — Compare o MVCC do PostgreSQL com o do InnoDB: onde ficam as versões antigas e qual o custo?
- N4 · Implementação — Implementar em Java um key-value store em memória com MVCC e snapshots por transação

**Critérios de conclusão**
- [ ] Observei xmin/xmax e ctid mudando após UPDATE e DELETE
- [ ] Expliquei por que uma transação longa impede o VACUUM de limpar tuplas mortas
- [ ] Medi bloat de uma tabela antes e depois do VACUUM
- [ ] Explico o que é wraparound e por que o autovacuum o previne

#### 3.2.12 Replication

Replicação mantém cópias dos dados em múltiplos servidores para disponibilidade e escala de leitura. Abrange replicação física por streaming de WAL, lógica, síncrona versus assíncrona, replication lag e failover. _(~90 min)_

**Objetivos**
- Explicar replicação primary-replica por streaming de WAL
- Comparar replicação síncrona e assíncrona em latência e risco de perda de dados
- Explicar replication lag e anomalias como 'ler minha própria escrita'
- Diferenciar replicação física e lógica
- Entender o roteamento de leituras para réplicas em aplicações Java

**Pré-requisitos**
- [rec] 3.2.2 ACID — Replicação física se baseia no WAL usado para durabilidade
- [rec] 3.2.11 MVCC — Consultas em réplicas sofrem conflitos com a limpeza de versões

**Desafios planejados**
- N1 · Conceitual — Comparar replicação síncrona e assíncrona em latência de commit e RPO
- N2 · Experimento — Subir primary e réplica PostgreSQL com Docker e acompanhar pg_stat_replication
- N3 · Identificação de bugs — Explicar por que o usuário não vê o pedido recém-criado ao ler de uma réplica
- N3 · Entrevista — Como você faria failover de um primary sem causar split-brain?
- N4 · Implementação — Implementar roteamento de leitura/escrita entre dois DataSources em Java

**Critérios de conclusão**
- [ ] Configurei uma réplica de streaming (ex.: com Docker) e medi o lag
- [ ] Explico quanto dado pode ser perdido em failover com replicação assíncrona
- [ ] Proponho solução para read-your-writes com réplicas de leitura

### 3.3 Backend em produção (11 tópicos)

**[Adicional]** O que é necessário para operar um serviço backend depois que ele sai da máquina do desenvolvedor: os três pilares da observabilidade (logs, métricas e tracing), health checks, definição de SLIs e SLOs, pipelines de CI/CD e estratégias de deploy e rollback. O objetivo é saber detectar, diagnosticar e reverter problemas em produção com o menor impacto possível para os usuários.

Objetivos do módulo:
- Produzir logs estruturados e correlacionáveis, sem vazar dados sensíveis
- Instrumentar métricas (contadores, gauges, histogramas) e calcular percentis de latência corretamente
- Propagar contexto de tracing distribuído entre serviços
- Definir SLIs, SLOs e error budgets a partir da experiência do usuário
- Montar um pipeline de CI/CD com testes e artefatos imutáveis
- Comparar rolling, blue/green e canary e planejar rollbacks seguros, inclusive com migrações de banco

#### 3.3.1 Logs

Logs registram eventos discretos da aplicação para diagnóstico. Abrange níveis, logs estruturados (JSON), correlation IDs, MDC no SLF4J/Logback, custo de logging e cuidados com dados sensíveis. _(~60 min)_

**Objetivos**
- Escolher níveis de log adequados (ERROR, WARN, INFO, DEBUG) com critério
- Produzir logs estruturados em JSON com campos consistentes
- Propagar um correlation ID por requisição usando MDC
- Evitar vazamento de dados sensíveis (senhas, tokens, PII)
- Entender o custo de logging síncrono e o uso de appenders assíncronos

**Pré-requisitos**
- [rec] 3.1.8 HTTP — Logs de serviços backend giram em torno do ciclo de requisições HTTP

**Desafios planejados**
- N1 · Conceitual — Definir critérios objetivos para ERROR versus WARN em um serviço de pagamentos
- N2 · Programação — Configurar Logback com saída JSON e correlation ID via MDC em um filtro HTTP
- N2 · Análise de código — Revisar logs de um serviço e apontar vazamentos de PII e tokens
- N3 · Identificação de bugs — Descobrir por que o correlation ID some em logs de código executado em outra thread
- N3 · Experimento — Medir o impacto de latência de logging síncrono em disco versus appender assíncrono
- N4 · Projeto — Centralizar logs JSON de dois serviços em Loki/ELK e buscar uma requisição pelo correlation ID

**Critérios de conclusão**
- [ ] Configurei logs JSON com correlation ID em uma aplicação Java
- [ ] Consigo rastrear todas as linhas de uma requisição específica pelo ID
- [ ] Revisei um código e removi logs com dados sensíveis

#### 3.3.2 Metrics

Métricas são medições numéricas agregadas ao longo do tempo (contadores, gauges, histogramas) usadas para monitorar e alertar. Abrange os métodos RED/USE, percentis, cardinalidade de labels e Micrometer/Prometheus. _(~75 min)_

**Objetivos**
- Diferenciar counter, gauge, histogram e summary e quando usar cada um
- Explicar por que média de latência engana e como percentis (p95, p99) são calculados
- Aplicar os métodos RED (rate, errors, duration) e USE (utilization, saturation, errors)
- Evitar explosão de cardinalidade em labels
- Expor métricas de uma aplicação Java com Micrometer para Prometheus

**Pré-requisitos**
- [rec] 3.3.1 Logs — Comparar logs e métricas esclarece quando usar cada sinal

**Desafios planejados**
- N1 · Conceitual — Explicar por que a latência média esconde problemas que o p99 revela
- N2 · Programação — Instrumentar um endpoint com Micrometer (counter de erros e timer com histograma)
- N2 · Experimento — Subir Prometheus localmente e escrever consultas rate() e histogram_quantile()
- N3 · Identificação de bugs — Diagnosticar um Prometheus sem memória causado por label com userId
- N4 · Projeto — Montar um dashboard RED com alertas para uma API de exemplo

**Critérios de conclusão**
- [ ] Expus métricas RED de um endpoint e consultei em PromQL
- [ ] Explico por que não se pode tirar a média de percentis entre instâncias
- [ ] Identifico um label que causaria explosão de cardinalidade

#### 3.3.3 Tracing

Tracing distribuído acompanha uma requisição através de vários serviços, registrando spans com relações causais e tempos. Abrange trace/span IDs, propagação de contexto (W3C traceparent), amostragem e OpenTelemetry. _(~75 min)_

**Objetivos**
- Explicar traces, spans, relações pai-filho e atributos
- Explicar como o contexto é propagado entre serviços via headers W3C traceparent
- Comparar estratégias de amostragem (head-based e tail-based)
- Instrumentar uma aplicação Java com o agente OpenTelemetry
- Usar um trace para localizar o serviço ou query responsável pela latência

**Pré-requisitos**
- [rec] 3.3.1 Logs — Tracing complementa logs correlacionados
- [rec] 3.1.8 HTTP — A propagação de contexto usa headers HTTP

**Desafios planejados**
- N1 · Conceitual — Desenhar a árvore de spans de uma requisição que passa por gateway, serviço e banco
- N2 · Experimento — Instrumentar dois serviços Java com o agente OpenTelemetry e visualizar no Jaeger
- N3 · Identificação de bugs — Descobrir por que o trace se quebra em dois ao passar por uma fila ou thread pool
- N3 · Entrevista — Quais os trade-offs entre amostragem head-based e tail-based?
- N4 · Implementação — Propagar manualmente o header traceparent em um cliente HTTP sem instrumentação automática

**Critérios de conclusão**
- [ ] Visualizei um trace envolvendo dois serviços e um banco no Jaeger/Tempo
- [ ] Explico como o trace ID atravessa uma chamada HTTP
- [ ] Liguei logs ao trace incluindo trace_id no MDC

#### 3.3.4 Observability

Observabilidade é a capacidade de entender o estado interno de um sistema a partir de seus sinais externos, permitindo investigar falhas desconhecidas. Integra logs, métricas e traces com correlação e investigação orientada a hipóteses. _(~60 min)_

**Objetivos**
- Diferenciar monitoramento (perguntas conhecidas) de observabilidade (perguntas novas)
- Combinar métricas, traces e logs em um fluxo de investigação
- Definir quais sinais instrumentar em um novo serviço
- Escrever alertas acionáveis baseados em sintomas, não em causas

**Pré-requisitos**
- [req] 3.3.1 Logs — Logs são um dos pilares
- [req] 3.3.2 Metrics — Métricas são um dos pilares
- [req] 3.3.3 Tracing — Traces são um dos pilares

**Desafios planejados**
- N1 · Conceitual — Explicar a diferença entre monitoramento e observabilidade com um incidente real
- N2 · Análise de código — Revisar um conjunto de alertas e reescrever os não acionáveis
- N3 · Experimento — Injetar latência em uma dependência e diagnosticá-la usando só os sinais disponíveis
- N4 · Projeto — Montar stack local (Prometheus, Grafana, Jaeger, Loki) para um app Java e correlacionar os três sinais

**Critérios de conclusão**
- [ ] Investiguei um problema partindo de um alerta de métrica até o log da causa via trace
- [ ] Escrevi um plano de instrumentação para um serviço novo
- [ ] Diferencio alerta por sintoma de alerta por causa

#### 3.3.5 Health Checks

Health checks expõem o estado de uma instância para orquestradores e load balancers. Abrange liveness, readiness e startup probes, dependências nos checks e os riscos de falhas em cascata. _(~50 min)_

**Objetivos**
- Diferenciar liveness, readiness e startup probes
- Decidir quais dependências devem afetar a readiness e nunca a liveness
- Configurar endpoints de health no Spring Boot Actuator
- Explicar como health checks mal projetados causam falhas em cascata
- Implementar graceful shutdown coordenado com readiness

**Pré-requisitos**
- [rec] 3.1.8 HTTP — Health checks são normalmente endpoints HTTP

**Desafios planejados**
- N1 · Conceitual — Explicar a diferença entre liveness e readiness e o que o orquestrador faz em cada falha
- N2 · Programação — Expor liveness e readiness com Spring Boot Actuator incluindo um indicador customizado
- N3 · Identificação de bugs — Analisar um incidente em que a queda do banco reiniciou todos os pods em loop
- N3 · Experimento — Testar graceful shutdown enviando SIGTERM durante requisições em andamento
- N4 · Implementação — Implementar readiness que reflete pool de banco esgotado e graceful shutdown com drenagem

**Critérios de conclusão**
- [ ] Explico por que checar o banco na liveness pode reiniciar todo o cluster
- [ ] Configurei probes separados em uma aplicação
- [ ] Implementei shutdown que para de receber tráfego antes de encerrar

#### 3.3.6 SLI / SLO

SLIs são indicadores quantitativos de qualidade do serviço (ex.: proporção de requisições bem-sucedidas abaixo de 300ms) e SLOs são metas sobre eles. Abrange error budget, burn rate e diferença para SLA. _(~60 min)_

**Objetivos**
- Definir SLIs a partir da experiência do usuário
- Estabelecer SLOs e calcular o error budget correspondente
- Diferenciar SLI, SLO e SLA
- Criar alertas por burn rate em múltiplas janelas
- Usar o error budget para decidir entre velocidade de entrega e estabilidade

**Pré-requisitos**
- [req] 3.3.2 Metrics — SLIs são calculados a partir de métricas

**Desafios planejados**
- N1 · Conceitual — Calcular o error budget mensal de SLOs de 99%, 99,9% e 99,99%
- N2 · Programação — Escrever consultas PromQL que calculam um SLI de disponibilidade e latência
- N3 · Entrevista — Por que um SLO de 100% é uma má ideia?
- N4 · Projeto — Definir SLOs e alertas multi-window burn rate para a API do módulo

**Critérios de conclusão**
- [ ] Calculo quanto downtime por mês um SLO de 99,9% permite
- [ ] Defini SLIs e SLOs para uma API de exemplo
- [ ] Explico um alerta de burn rate e por que ele é melhor que um limiar fixo

#### 3.3.7 CI/CD

CI/CD automatiza build, testes e entrega de software: integração contínua valida cada mudança e entrega/deploy contínuo leva artefatos imutáveis até produção. Abrange pipelines, estágios, artefatos versionados e gates de qualidade. _(~75 min)_

**Objetivos**
- Diferenciar continuous integration, continuous delivery e continuous deployment
- Montar um pipeline com build, testes, análise e publicação de artefato
- Explicar a importância de artefatos imutáveis promovidos entre ambientes
- Integrar testes com banco real (Testcontainers) no pipeline
- Gerenciar segredos no pipeline sem expô-los

**Desafios planejados**
- N1 · Conceitual — Diferenciar continuous delivery de continuous deployment com exemplos
- N2 · Implementação — Criar um workflow GitHub Actions que compila com Maven, roda testes e publica uma imagem Docker
- N3 · Identificação de bugs — Corrigir um pipeline que vaza um segredo nos logs
- N3 · Entrevista — Como tornar um pipeline lento (40 min) rápido sem perder confiança?
- N4 · Projeto — Pipeline completo com testes Testcontainers, versionamento semântico e deploy em ambiente de staging

**Critérios de conclusão**
- [ ] Criei um pipeline (ex.: GitHub Actions) que compila, testa e gera imagem Docker
- [ ] Explico por que não se deve reconstruir o artefato por ambiente
- [ ] O pipeline falha corretamente quando um teste quebra

#### 3.3.8 Rolling Deployment

Rolling deployment substitui instâncias gradualmente pela nova versão, mantendo capacidade durante a troca. Exige compatibilidade entre versões coexistentes, readiness correta e controle de maxSurge/maxUnavailable. _(~45 min)_

**Objetivos**
- Explicar como o rolling deployment substitui instâncias em lotes
- Configurar parâmetros como maxSurge e maxUnavailable
- Garantir compatibilidade entre a versão antiga e a nova rodando simultaneamente
- Identificar riscos de drenagem de conexões e requisições em andamento

**Pré-requisitos**
- [req] 3.3.5 Health Checks — O avanço do rollout depende da readiness das novas instâncias
- [rec] 3.3.7 CI/CD — Deploys são acionados pelo pipeline

**Desafios planejados**
- N1 · Conceitual — Descrever passo a passo um rolling update de 4 réplicas com maxSurge=1 e maxUnavailable=0
- N2 · Experimento — Fazer rolling update em um cluster local (kind/minikube) enquanto um script mede erros
- N3 · Identificação de bugs — Explicar erros 502 durante o rollout causados por ausência de graceful shutdown
- N3 · Entrevista — Como fazer rolling deploy de uma mudança que renomeia um campo da API?
- N4 · Projeto — Automatizar um rolling deploy com verificação pós-deploy e interrupção em caso de aumento de erros

**Critérios de conclusão**
- [ ] Executei um rolling update sem erros para o cliente
- [ ] Explico por que uma mudança de contrato incompatível quebra durante o rollout
- [ ] Configurei os parâmetros de surge e indisponibilidade

#### 3.3.9 Blue/Green Deployment

Blue/green deployment mantém dois ambientes completos e troca o tráfego de uma vez da versão atual (blue) para a nova (green), permitindo rollback instantâneo. Custa capacidade dobrada e exige cuidado com banco compartilhado. _(~45 min)_

**Objetivos**
- Explicar o fluxo blue/green e o ponto de troca de tráfego
- Comparar custo e risco com rolling deployment
- Lidar com banco de dados compartilhado e migrações compatíveis
- Validar o ambiente green antes da troca

**Pré-requisitos**
- [rec] 3.3.8 Rolling Deployment — A comparação com rolling esclarece trade-offs

**Desafios planejados**
- N1 · Conceitual — Comparar blue/green e rolling em custo, velocidade de rollback e risco
- N2 · Experimento — Simular blue/green com duas versões de um app e troca de upstream no nginx
- N3 · Entrevista — Como lidar com a migração de banco em um deploy blue/green?
- N3 · Identificação de bugs — Analisar sessões perdidas após troca blue/green em um app com sessão em memória
- N4 · Implementação — Script de troca blue/green com smoke tests no green e reversão automática

**Critérios de conclusão**
- [ ] Simulei uma troca blue/green com um proxy reverso
- [ ] Explico por que o rollback instantâneo pode falhar se o schema mudou
- [ ] Listo os custos operacionais da estratégia

#### 3.3.10 Canary Deployment

Canary deployment expõe a nova versão a uma pequena fração do tráfego, compara métricas com a versão estável e expande gradualmente. Depende de roteamento ponderado e análise automática baseada em SLIs. _(~50 min)_

**Objetivos**
- Explicar o fluxo canary e critérios de promoção e aborto
- Definir métricas comparativas entre canary e baseline
- Configurar roteamento ponderado de tráfego
- Entender limitações estatísticas com pouco tráfego

**Pré-requisitos**
- [rec] 3.3.6 SLI / SLO — A decisão de promover o canary usa SLIs
- [rec] 3.3.8 Rolling Deployment — Canary evolui as ideias do rollout gradual

**Desafios planejados**
- N1 · Conceitual — Explicar como um canary reduz o raio de impacto de um bug
- N2 · Experimento — Configurar split de tráfego 95/5 com nginx weight e comparar taxas de erro
- N3 · Entrevista — Quais métricas você compararia entre canary e baseline e por quê?
- N4 · Implementação — Escrever um script que analisa métricas do Prometheus e decide promover ou abortar o canary

**Critérios de conclusão**
- [ ] Defini critérios objetivos de aborto para um canary
- [ ] Configurei divisão de tráfego 95/5 entre duas versões
- [ ] Explico por que um canary com tráfego muito baixo pode dar falsa confiança

#### 3.3.11 Rollback

Rollback reverte um deploy problemático para a versão anterior conhecida como estável. Abrange rollback de código versus banco, migrações expand/contract, roll forward e feature flags. _(~50 min)_

**Objetivos**
- Planejar rollback antes de cada deploy
- Aplicar o padrão expand/contract para migrações reversíveis
- Decidir entre rollback e roll forward em um incidente
- Usar feature flags para desligar funcionalidades sem novo deploy

**Pré-requisitos**
- [rec] 3.3.8 Rolling Deployment — Rollback depende da estratégia de deploy usada
- [rec] 3.2.1 Transactions — Migrações de schema e dados envolvem transações

**Desafios planejados**
- N1 · Conceitual — Explicar por que migrações destrutivas impedem rollback
- N2 · Programação — Escrever migrações Flyway expand/contract para renomear uma coluna sem downtime
- N3 · Entrevista — Durante um incidente pós-deploy, quando escolher rollback e quando roll forward?
- N4 · Projeto — Elaborar um runbook de deploy e rollback para a API do módulo, incluindo banco e feature flags

**Critérios de conclusão**
- [ ] Planejei uma migração de renomeação de coluna em passos expand/contract
- [ ] Explico por que rollback de código não desfaz dados já gravados no formato novo
- [ ] Executei um rollback de versão em ambiente local

### 3.4 Banco de Dados I — SQL, índices e performance (11 tópicos)

**[Adicional]** A base do trabalho com bancos relacionais: o modelo relacional, a linguagem SQL, joins e chaves, e como o banco executa consultas por dentro — estruturas de índice (B+ Tree), planos de execução, o otimizador baseado em custo e a leitura do EXPLAIN. Termina com connection pools, ponto onde o banco encontra a aplicação. Este módulo é pré-requisito pedagógico recomendado do módulo 3.2.

Objetivos do módulo:
- Modelar dados de forma normalizada e expressar regras de integridade com chaves e constraints
- Escrever consultas SQL corretas, incluindo joins, agregações, subconsultas e window functions
- Explicar como um índice B+ Tree é organizado em páginas e por que acelera buscas e ordenações
- Ler planos de execução com EXPLAIN (ANALYZE, BUFFERS) e identificar gargalos
- Entender como o query planner estima custos usando estatísticas
- Dimensionar e configurar um connection pool (ex.: HikariCP) com base em métricas reais

#### 3.4.1 Modelo relacional

O modelo relacional representa dados como relações (tabelas) de tuplas com atributos tipados, manipuladas por álgebra relacional. Abrange chaves, dependências funcionais, normalização (1FN a 3FN/BCNF) e quando desnormalizar. _(~90 min)_

**Objetivos**
- Explicar relação, tupla, atributo e domínio
- Aplicar normalização até a 3FN identificando dependências funcionais
- Modelar relacionamentos 1:1, 1:N e N:N
- Relacionar operações da álgebra relacional (seleção, projeção, junção) com SQL
- Avaliar quando desnormalizar por desempenho

**Desafios planejados**
- N1 · Conceitual — Identificar anomalias de inserção, atualização e exclusão em uma tabela não normalizada
- N2 · Implementação — Normalizar uma planilha de pedidos até a 3FN e desenhar o diagrama ER
- N3 · Entrevista — Quando você desnormalizaria um modelo e como manteria a consistência?
- N4 · Projeto — Modelar o schema de um sistema de biblioteca com empréstimos, reservas e multas

**Critérios de conclusão**
- [ ] Normalizei uma planilha desnormalizada até a 3FN
- [ ] Modelei um domínio com relacionamento N:N via tabela associativa
- [ ] Justifico uma desnormalização com custo e benefício

#### 3.4.2 SQL

SQL é a linguagem declarativa para definir, consultar e manipular dados relacionais. Abrange DDL, DML, filtros, agregações, GROUP BY/HAVING, subconsultas, CTEs, window functions e a ordem lógica de avaliação de uma consulta. _(~150 min)_

**Objetivos**
- Escrever DDL (CREATE, ALTER) e DML (INSERT, UPDATE, DELETE) corretamente
- Usar agregações com GROUP BY e HAVING
- Explicar a ordem lógica de execução (FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY)
- Usar subconsultas, CTEs e window functions
- Entender a semântica de NULL e da lógica de três valores

**Pré-requisitos**
- [rec] 3.4.1 Modelo relacional — SQL opera sobre o modelo relacional

**Desafios planejados**
- N1 · Conceitual — Ordenar as cláusulas de um SELECT na ordem lógica de avaliação e justificar
- N2 · Programação — Resolver 10 consultas sobre um schema de e-commerce (agregações, HAVING, subconsultas)
- N2 · Identificação de bugs — Corrigir consultas com resultados errados por causa de NULL em NOT IN e comparações
- N3 · Programação — Calcular ranking e total acumulado de vendas por cliente com window functions
- N4 · Projeto — Criar um relatório analítico completo com CTEs encadeadas sobre o schema do módulo

**Critérios de conclusão**
- [ ] Resolvi consultas com agregação, CTE e window function sem consultar referência
- [ ] Explico por que WHERE col = NULL nunca retorna linhas
- [ ] Explico por que um alias do SELECT não pode ser usado no WHERE

#### 3.4.3 Joins

Joins combinam linhas de tabelas por uma condição: INNER, LEFT/RIGHT, FULL, CROSS, self-join, semi e anti-join. Inclui armadilhas como multiplicação de linhas e filtros no ON versus WHERE. _(~90 min)_

**Objetivos**
- Escolher o tipo de join correto para cada pergunta de negócio
- Explicar a diferença entre condição no ON e no WHERE em LEFT JOIN
- Identificar e corrigir duplicação de linhas causada por joins 1:N
- Implementar semi-join (EXISTS) e anti-join (NOT EXISTS)
- Usar self-join para hierarquias simples

**Pré-requisitos**
- [req] 3.4.2 SQL — Joins são uma construção da linguagem SQL

**Desafios planejados**
- N1 · Conceitual — Prever o resultado de INNER, LEFT e FULL JOIN entre duas tabelas pequenas
- N2 · Programação — Listar clientes sem pedidos de três formas (LEFT JOIN/IS NULL, NOT EXISTS, NOT IN)
- N3 · Identificação de bugs — Encontrar por que o faturamento total dobrou após adicionar um join com pagamentos
- N3 · Entrevista — Qual a diferença entre filtrar no ON e no WHERE de um LEFT JOIN?
- N4 · Projeto — Construir um relatório de vendas por categoria e cliente com joins múltiplos sem duplicação de valores

**Critérios de conclusão**
- [ ] Explico a diferença de resultado ao mover um filtro do ON para o WHERE num LEFT JOIN
- [ ] Corrigi uma soma inflada por join com tabela 1:N
- [ ] Escrevi um anti-join para encontrar clientes sem pedidos

#### 3.4.4 Primary Key

Primary key identifica unicamente cada linha, implicando NOT NULL e unicidade com um índice associado. Abrange chaves naturais versus surrogate, sequences/identity, UUID v4 versus v7 e impacto físico da escolha. _(~45 min)_

**Objetivos**
- Explicar as garantias de uma primary key e o índice criado automaticamente
- Comparar chaves naturais e surrogate
- Comparar BIGINT identity, UUID v4 e UUID v7 quanto a localidade de inserção no índice
- Definir chaves compostas quando apropriado

**Pré-requisitos**
- [rec] 3.4.1 Modelo relacional — Chaves são conceito central do modelo relacional

**Desafios planejados**
- N1 · Conceitual — Listar riscos de usar CPF ou e-mail como primary key
- N2 · Programação — Criar tabelas com IDENTITY, UUID e chave composta e inspecionar os índices gerados
- N3 · Experimento — Comparar tempo de inserção e tamanho do índice com PK BIGINT, UUID v4 e UUID v7 em 5 milhões de linhas
- N3 · Entrevista — Por que expor IDs sequenciais em uma API pode ser um problema e como mitigar?
- N4 · Implementação — Implementar em Java um gerador de UUID v7 e validar sua ordenação temporal

**Critérios de conclusão**
- [ ] Justifico a escolha do tipo de PK para uma tabela de alto volume
- [ ] Explico por que UUID aleatório fragmenta índices B+ Tree
- [ ] Sei quando uma chave composta é preferível

#### 3.4.5 Foreign Key

Foreign key garante integridade referencial entre tabelas, impedindo referências a linhas inexistentes. Abrange ações ON DELETE/ON UPDATE, custo de verificação, necessidade de índice na coluna referenciadora e constraints adiáveis. _(~45 min)_

**Objetivos**
- Explicar a integridade referencial garantida pela foreign key
- Escolher ações ON DELETE (RESTRICT, CASCADE, SET NULL) conforme o domínio
- Explicar por que a coluna da FK geralmente precisa de índice
- Usar constraints DEFERRABLE quando necessário
- Avaliar o custo das FKs em cargas de escrita intensa

**Pré-requisitos**
- [req] 3.4.4 Primary Key — Uma foreign key referencia uma chave primária ou única

**Desafios planejados**
- N1 · Conceitual — Explicar o que acontece ao deletar um cliente com pedidos em cada ação ON DELETE
- N2 · Programação — Definir FKs com ações adequadas para clientes, pedidos e itens
- N3 · Experimento — Medir o DELETE de linhas pai com e sem índice na coluna FK da tabela filha
- N3 · Entrevista — Algumas empresas não usam foreign keys em produção. Quais os argumentos e riscos?
- N4 · Projeto — Modelar o schema completo de pedidos com FKs, índices nas FKs e políticas ON DELETE documentadas

**Critérios de conclusão**
- [ ] Escolhi ações ON DELETE coerentes para um modelo de pedidos
- [ ] Mostrei com EXPLAIN o custo de deletar um pai sem índice na FK
- [ ] Explico quando CASCADE é perigoso

#### 3.4.6 Indexes

Índices são estruturas auxiliares que aceleram buscas ao evitar varredura completa, ao custo de espaço e escrita. Abrange índices compostos e a regra do prefixo à esquerda, seletividade, índices de cobertura, parciais, de expressão e tipos (B-tree, hash, GIN). _(~120 min)_

**Objetivos**
- Explicar o trade-off de leitura versus escrita e espaço
- Aplicar a regra do prefixo à esquerda em índices compostos
- Usar índices de cobertura (INCLUDE) para index-only scans
- Criar índices parciais e de expressão
- Identificar consultas que não usam índice (funções na coluna, baixa seletividade, LIKE '%x')

**Pré-requisitos**
- [req] 3.4.2 SQL — Índices servem às consultas SQL
- [rec] 2.4.6 Binary Search Tree — Árvores de busca são a base conceitual dos índices
- [rec] 2.4.1 Hash Table — Índices hash usam hash tables

**Desafios planejados**
- N1 · Conceitual — Explicar por que um índice (a, b) serve WHERE a = ? mas não WHERE b = ?
- N2 · Experimento — Medir uma consulta em 1 milhão de linhas antes e depois de criar o índice
- N2 · Identificação de bugs — Descobrir por que uma consulta com função sobre a coluna ignora o índice e corrigi-la
- N3 · Experimento — Medir o impacto de 0, 3 e 8 índices no throughput de INSERT
- N4 · Implementação — Definir a estratégia de índices para as 5 consultas principais do schema do módulo

**Critérios de conclusão**
- [ ] Projetei um índice composto adequado para uma consulta com filtro e ordenação
- [ ] Expliquei por que WHERE lower(email) = ? não usa índice em email
- [ ] Mostrei um index-only scan com EXPLAIN
- [ ] Explico o custo de índices excessivos em uma tabela de escrita intensa

#### 3.4.7 B+ Tree

B+ Tree é a árvore balanceada de alto fan-out usada pela maioria dos índices, com chaves em nós internos e dados/ponteiros nas folhas encadeadas. Seu desenho minimiza leituras de páginas em disco e favorece range scans. _(~120 min)_

**Objetivos**
- Descrever a estrutura de nós internos e folhas encadeadas de uma B+ Tree
- Explicar por que alto fan-out resulta em altura baixa e poucas leituras de página
- Comparar B+ Tree com BST e hash para busca pontual e por intervalo
- Explicar split de páginas e fragmentação
- Calcular a altura aproximada de um índice dado tamanho de página e chave

**Pré-requisitos**
- [req] 3.4.6 Indexes — B+ Tree é a estrutura interna dos índices
- [rec] 2.4.6 Binary Search Tree — A B+ Tree generaliza árvores de busca
- [rec] 1.2.8 Paging — Páginas de disco e memória explicam o desenho da estrutura

**Desafios planejados**
- N1 · Conceitual — Explicar por que uma BST balanceada é ruim para disco e a B+ Tree não
- N2 · Programação — Calcular altura e número de leituras de página de um índice para tamanhos variados
- N3 · Experimento — Usar pageinspect (bt_metap, bt_page_stats) para ver altura e níveis de um índice real
- N3 · Entrevista — Por que a B+ Tree guarda dados só nas folhas e as encadeia?
- N4 · Implementação — Implementar em Java uma B+ Tree em memória com inserção, busca e range scan

**Critérios de conclusão**
- [ ] Calculo quantos níveis tem um índice de 100 milhões de chaves BIGINT em páginas de 8 KB
- [ ] Explico por que bancos preferem B+ Tree a árvores binárias
- [ ] Explico por que range scans são eficientes nas folhas encadeadas
- [ ] Inspecionei a estrutura de um índice com pageinspect (bt_metap)

#### 3.4.8 Query Execution

Query execution é como o banco processa um plano: parsing, reescrita, planejamento e execução por operadores (seq scan, index scan, bitmap scan, nested loop, hash join, merge join, sort) no modelo iterador e com buffer cache. _(~90 min)_

**Objetivos**
- Descrever as fases parse, rewrite, plan e execute
- Explicar os métodos de acesso seq scan, index scan, index-only scan e bitmap scan
- Comparar nested loop, hash join e merge join e quando cada um é eficiente
- Explicar o papel do buffer cache (shared_buffers) e de work_mem em sorts e hashes

**Pré-requisitos**
- [rec] 3.4.3 Joins — Algoritmos de join executam os joins escritos em SQL
- [rec] 3.4.7 B+ Tree — Index scans percorrem a B+ Tree
- [rec] 2.1.3 Big O — Comparar algoritmos de join exige análise de complexidade

**Desafios planejados**
- N1 · Conceitual — Comparar nested loop, hash join e merge join em complexidade e uso de memória
- N2 · Experimento — Forçar cada algoritmo de join com enable_* e comparar tempos
- N3 · Experimento — Provocar um sort externo reduzindo work_mem e observar no EXPLAIN ANALYZE
- N4 · Implementação — Implementar hash join e nested loop join em Java sobre listas e comparar o desempenho

**Critérios de conclusão**
- [ ] Explico a complexidade de nested loop, hash join e merge join
- [ ] Identifico um sort que vaza para disco por falta de work_mem
- [ ] Explico por que um seq scan pode ser mais rápido que index scan

#### 3.4.9 Query Planner

O query planner é o otimizador baseado em custo que escolhe o plano mais barato estimando cardinalidades a partir de estatísticas (pg_statistic, histogramas, n_distinct). Estimativas erradas levam a planos ruins. _(~75 min)_

**Objetivos**
- Explicar como o planner estima custo e seletividade
- Entender o papel do ANALYZE e das estatísticas de colunas
- Identificar planos ruins causados por estimativas incorretas
- Usar estatísticas estendidas para colunas correlacionadas
- Entender o impacto de prepared statements e planos genéricos versus customizados

**Pré-requisitos**
- [req] 3.4.8 Query Execution — O planner escolhe entre os operadores de execução

**Desafios planejados**
- N1 · Conceitual — Explicar como o planner estima linhas de WHERE status = 'X' usando histogramas e MCV
- N2 · Experimento — Inserir dados em massa sem ANALYZE e comparar o plano antes e depois
- N3 · Identificação de bugs — Corrigir estimativa errada em filtro com colunas correlacionadas (cidade e estado) com CREATE STATISTICS
- N3 · Entrevista — Por que uma query parametrizada rápida no psql fica lenta via JDBC?
- N4 · Implementação — Criar um script que detecta divergências grandes entre linhas estimadas e reais em planos via EXPLAIN (FORMAT JSON)

**Critérios de conclusão**
- [ ] Comparei linhas estimadas e reais e expliquei a diferença
- [ ] Corrigi um plano ruim atualizando estatísticas ou criando estatísticas estendidas
- [ ] Explico por que um prepared statement pode ficar lento após algumas execuções

#### 3.4.10 EXPLAIN

EXPLAIN mostra o plano escolhido pelo planner e, com ANALYZE e BUFFERS, os tempos, linhas reais e páginas lidas de cada nó. É a principal ferramenta para diagnosticar consultas lentas. _(~90 min)_

**Objetivos**
- Ler um plano em árvore: custo inicial, custo total, rows e width
- Usar EXPLAIN (ANALYZE, BUFFERS) e interpretar loops, tempos e hits/reads
- Localizar o nó responsável pela maior parte do tempo
- Usar pg_stat_statements para encontrar as consultas que mais consomem
- Validar uma otimização comparando planos

**Pré-requisitos**
- [rec] 3.4.9 Query Planner — O EXPLAIN exibe as decisões do planner

**Desafios planejados**
- N1 · Conceitual — Explicar cada número de uma linha de nó do EXPLAIN (cost, rows, width, actual time, loops)
- N2 · Análise de código — Analisar 5 planos de execução reais e apontar o gargalo de cada um
- N3 · Identificação de bugs — Otimizar uma consulta de 8 segundos até menos de 50ms usando apenas EXPLAIN como guia
- N3 · Experimento — Habilitar pg_stat_statements, gerar carga e ranquear consultas por tempo total
- N4 · Projeto — Relatório de tuning do schema do módulo com planos antes/depois e justificativas

**Critérios de conclusão**
- [ ] Interpreto todos os campos de um EXPLAIN ANALYZE BUFFERS
- [ ] Encontrei a query mais custosa com pg_stat_statements e a otimizei
- [ ] Sei que EXPLAIN ANALYZE executa a consulta e cuido disso com DML

#### 3.4.11 Connection Pool

Connection pool mantém conexões de banco abertas e reutilizáveis, evitando o custo de handshake e autenticação a cada requisição. Abrange dimensionamento, timeouts, vazamentos de conexão, HikariCP e poolers externos como PgBouncer. _(~75 min)_

**Objetivos**
- Explicar o custo de abrir uma conexão PostgreSQL (TCP, TLS, autenticação, processo backend)
- Dimensionar o pool com base em núcleos, I/O e número de instâncias da aplicação
- Configurar HikariCP (maximumPoolSize, connectionTimeout, maxLifetime, leakDetectionThreshold)
- Diagnosticar esgotamento e vazamento de conexões
- Comparar pool na aplicação com PgBouncer (modos session e transaction)

**Pré-requisitos**
- [rec] 3.1.4 TCP — Cada conexão de banco é uma conexão TCP
- [rec] 3.1.11 Keep-Alive — Pool de banco aplica a mesma ideia de reutilização de conexões HTTP
- [rec] 1.2.2 Processo — O PostgreSQL cria um processo por conexão

**Desafios planejados**
- N1 · Conceitual — Listar tudo que acontece ao abrir uma conexão PostgreSQL do zero
- N2 · Experimento — Medir latência de 1000 consultas abrindo conexão a cada vez versus usando HikariCP
- N2 · Identificação de bugs — Encontrar o vazamento de conexão em um DAO que não fecha ResultSet/Connection em exceções
- N3 · Experimento — Variar maximumPoolSize sob carga e plotar throughput e latência p99
- N4 · Implementação — Implementar um connection pool simples em Java com BlockingQueue, timeout e validação

**Critérios de conclusão**
- [ ] Medi o tempo de abrir uma conexão versus obter uma do pool
- [ ] Detectei um vazamento de conexão com leakDetectionThreshold
- [ ] Justifico um tamanho de pool para N instâncias e um limite max_connections
- [ ] Explico por que um pool grande demais piora a latência

### 3.5 APIs, autenticação e segurança (12 tópicos)

**[Adicional]** Como projetar APIs HTTP seguras e robustas: design REST orientado a recursos, statelessness, autenticação e autorização, sessões, cookies e JWT, armazenamento seguro de senhas, CORS, idempotência e prevenção de SQL injection. Aqui REST é revisitado do ponto de vista do design de contratos e da segurança, complementando a visão de protocolo do módulo 3.1. Os exemplos se conectam ao ecossistema Java/Spring sem antecipar o aprofundamento da Etapa 04.

Objetivos do módulo:
- Projetar contratos REST consistentes (recursos, status codes, paginação, versionamento, erros)
- Diferenciar autenticação e autorização e aplicar modelos como RBAC e verificações por recurso
- Comparar sessões com estado no servidor e tokens JWT, incluindo revogação e armazenamento no cliente
- Armazenar senhas com algoritmos adequados (bcrypt, scrypt, Argon2) e entender o papel do salt
- Configurar CORS e cookies (HttpOnly, Secure, SameSite) entendendo as ameaças que mitigam
- Garantir idempotência em operações críticas e eliminar SQL injection com consultas parametrizadas

#### 3.5.1 REST

Design de APIs REST: modelagem de recursos e URIs, escolha de métodos e status codes, formato de erros (RFC 9457), paginação, filtros, versionamento e evolução compatível do contrato. Aqui o foco é o contrato e sua segurança, complementando a visão de protocolo de 3.1.10. _(~120 min)_

**Objetivos**
- Modelar recursos e sub-recursos com URIs consistentes
- Padronizar respostas de erro com Problem Details (RFC 9457)
- Implementar paginação por offset e por cursor e explicar seus trade-offs
- Definir estratégia de versionamento e mudanças compatíveis
- Documentar o contrato com OpenAPI
- Evitar exposição excessiva de dados (mass assignment, campos sensíveis)

**Pré-requisitos**
- [rec] 3.1.10 REST — Revisita REST do ponto de vista de design, partindo das restrições do estilo
- [req] 3.1.8 HTTP — O design de APIs REST depende da semântica do HTTP

**Desafios planejados**
- N1 · Conceitual — Classificar mudanças de contrato como compatíveis ou incompatíveis
- N2 · Análise de código — Revisar uma API mal projetada e listar violações de semântica HTTP e consistência
- N2 · Programação — Implementar paginação por cursor (keyset) e comparar com OFFSET em 1 milhão de linhas
- N3 · Identificação de bugs — Encontrar vulnerabilidade de mass assignment em um endpoint de atualização de usuário
- N4 · Projeto — Projetar e documentar em OpenAPI a API de um sistema de pedidos com erros RFC 9457

**Critérios de conclusão**
- [ ] Projetei a API de um domínio com recursos, status codes e erros padronizados
- [ ] Implementei paginação por cursor e expliquei por que offset degrada em tabelas grandes
- [ ] Listo mudanças de contrato compatíveis e incompatíveis
- [ ] Escrevi a especificação OpenAPI da API

#### 3.5.2 Stateless

Stateless significa que cada requisição carrega todo o contexto necessário, sem depender de estado mantido em memória no servidor entre requisições. Isso permite escala horizontal e balanceamento livre, deslocando o estado para cliente, banco ou cache. _(~40 min)_

**Objetivos**
- Explicar o que é estado de sessão e onde ele pode viver
- Relacionar statelessness com escala horizontal e load balancing
- Identificar estado oculto em memória (caches locais, sessões, uploads parciais)
- Avaliar o custo de carregar contexto em cada requisição

**Pré-requisitos**
- [rec] 3.5.1 REST — Statelessness é uma restrição central do design REST

**Desafios planejados**
- N1 · Conceitual — Explicar por que estado em memória impede escalar horizontalmente
- N2 · Experimento — Rodar duas instâncias de um app com sessão em memória atrás do nginx e observar o problema
- N3 · Análise de código — Encontrar estado oculto em um serviço (mapa estático, cache local, contador)
- N3 · Entrevista — Sticky sessions resolvem o problema de estado? Quais os riscos?
- N4 · Implementação — Refatorar um serviço com sessão em memória para estado externo e validar com três instâncias balanceadas

**Critérios de conclusão**
- [ ] Identifiquei estado em memória que quebra com duas instâncias atrás de um balanceador
- [ ] Explico por que sticky sessions são um paliativo e não solução
- [ ] Descrevo alternativas para externalizar o estado

#### 3.5.3 Authentication

Autenticação verifica a identidade de quem faz a requisição: credenciais, fatores múltiplos, tokens, API keys e delegação via OAuth 2.0/OpenID Connect. Inclui ataques comuns como brute force e credential stuffing. _(~90 min)_

**Objetivos**
- Diferenciar autenticação de autorização
- Comparar Basic, API keys, sessões e tokens bearer
- Explicar o fluxo Authorization Code com PKCE do OAuth 2.0 e o papel do OpenID Connect
- Proteger login contra brute force e enumeração de usuários
- Entender MFA e por que reduz risco

**Pré-requisitos**
- [req] 3.1.9 HTTPS — Credenciais só podem trafegar com segurança sobre HTTPS
- [rec] 3.5.2 Stateless — O modelo stateless influencia como a identidade é transportada

**Desafios planejados**
- N1 · Conceitual — Explicar por que OAuth 2.0 é delegação de autorização e não protocolo de autenticação
- N2 · Experimento — Executar o fluxo Authorization Code + PKCE manualmente com curl contra um Keycloak local
- N3 · Identificação de bugs — Encontrar a enumeração de usuários em um endpoint de login e recuperação de senha
- N3 · Entrevista — Como você protegeria um endpoint de login contra credential stuffing?
- N4 · Implementação — Implementar autenticação por API key com hash armazenado e rotação

**Critérios de conclusão**
- [ ] Desenho o fluxo Authorization Code + PKCE de memória
- [ ] Implementei login com rate limiting e mensagens que não revelam se o usuário existe
- [ ] Explico a diferença entre OAuth 2.0 e OpenID Connect

#### 3.5.4 Authorization

Autorização decide o que uma identidade autenticada pode fazer, com modelos como RBAC, ABAC e verificações de propriedade do recurso. Inclui falhas como IDOR/BOLA, a principal vulnerabilidade de APIs. _(~75 min)_

**Objetivos**
- Comparar RBAC, ABAC e controle por propriedade do recurso
- Identificar e corrigir IDOR/BOLA
- Aplicar o princípio do menor privilégio e negar por padrão
- Centralizar regras de autorização em vez de espalhá-las
- Escopar consultas ao tenant/usuário no nível do banco

**Pré-requisitos**
- [req] 3.5.3 Authentication — Autorização opera sobre uma identidade já autenticada

**Desafios planejados**
- N1 · Conceitual — Diferenciar 401 e 403 e quando cada um deve ser retornado
- N2 · Identificação de bugs — Explorar e corrigir um IDOR que permite ler pedidos de outros usuários
- N3 · Análise de código — Revisar uma API multi-tenant e encontrar consultas não escopadas por tenant
- N3 · Entrevista — RBAC ou ABAC para um sistema de documentos com compartilhamento? Justifique
- N4 · Implementação — Implementar um mecanismo de autorização por permissões com testes de acesso negado

**Critérios de conclusão**
- [ ] Explorei e corrigi um IDOR em um endpoint GET /pedidos/{id}
- [ ] Modelei papéis e permissões para um sistema multi-tenant
- [ ] Escrevi testes que verificam acesso negado para usuários sem permissão

#### 3.5.5 Sessions

Sessões mantêm o estado de autenticação no servidor, identificado por um session ID opaco enviado ao cliente. Abrange armazenamento (memória, Redis, banco), expiração, regeneração de ID e ataques como session fixation e hijacking. _(~60 min)_

**Objetivos**
- Explicar o fluxo de login baseado em sessão
- Gerar session IDs com entropia suficiente e regenerá-los no login
- Escolher armazenamento compartilhado para múltiplas instâncias
- Implementar expiração por inatividade e absoluta, além de logout real
- Explicar session fixation e session hijacking

**Pré-requisitos**
- [req] 3.5.3 Authentication — Sessões são um mecanismo de manter a autenticação
- [rec] 3.5.2 Stateless — Sessões introduzem estado no servidor que precisa ser externalizado

**Desafios planejados**
- N1 · Conceitual — Explicar por que o ID de sessão deve ser regenerado após o login
- N2 · Programação — Implementar sessões em Redis com expiração por inatividade em uma aplicação Java
- N3 · Identificação de bugs — Demonstrar session fixation em uma aplicação que reutiliza o ID pré-login
- N3 · Entrevista — Sessões ou JWT para uma aplicação web tradicional? Defenda sua escolha
- N4 · Implementação — Implementar login por sessão com regeneração de ID, expiração e logout de todas as sessões do usuário

**Critérios de conclusão**
- [ ] Implementei sessões armazenadas fora da instância e funcionando com duas réplicas
- [ ] Explico e previno session fixation
- [ ] Implementei revogação imediata de sessão no logout

#### 3.5.6 Cookies

Cookies são pares chave-valor que o navegador armazena e envia automaticamente por domínio e caminho. Atributos como HttpOnly, Secure, SameSite, Domain e Max-Age determinam sua segurança frente a XSS e CSRF. _(~60 min)_

**Objetivos**
- Explicar como Set-Cookie e o envio automático pelo navegador funcionam
- Configurar HttpOnly, Secure, SameSite, Domain, Path e expiração
- Explicar CSRF e como SameSite e tokens anti-CSRF o mitigam
- Explicar por que cookies HttpOnly reduzem o impacto de XSS
- Diferenciar cookies first-party e third-party

**Pré-requisitos**
- [req] 3.1.8 HTTP — Cookies são transportados por headers HTTP
- [rec] 3.5.5 Sessions — Cookies são o transporte usual de session IDs

**Desafios planejados**
- N1 · Conceitual — Explicar o que cada atributo de cookie protege e contra qual ataque
- N2 · Experimento — Inspecionar Set-Cookie e envio automático com curl e DevTools
- N3 · Experimento — Montar uma página maliciosa que executa CSRF e bloqueá-la com SameSite=Lax
- N3 · Entrevista — Guardar token em localStorage ou em cookie HttpOnly? Trade-offs de XSS e CSRF
- N4 · Implementação — Implementar proteção CSRF com double-submit token além de SameSite em uma API Java

**Critérios de conclusão**
- [ ] Configurei um cookie de sessão com atributos seguros e verifiquei no DevTools
- [ ] Demonstrei um ataque CSRF e o bloqueei com SameSite
- [ ] Explico a diferença entre SameSite=Lax, Strict e None

#### 3.5.7 JWT

JWT é um token compacto com header, payload e assinatura (HMAC ou assimétrica), permitindo validação sem consulta ao servidor. Assinatura garante integridade, não confidencialidade; envolve claims, expiração, refresh tokens, revogação e ataques como alg=none. _(~90 min)_

**Objetivos**
- Decodificar um JWT e explicar header, payload, assinatura e claims (exp, iat, iss, aud, sub)
- Diferenciar assinatura (JWS) de criptografia (JWE)
- Comparar HS256 e RS256/ES256 e o uso de JWKS
- Projetar estratégia de access token curto, refresh token e revogação
- Identificar vulnerabilidades: alg=none, confusão de algoritmo, segredo fraco, falta de validação de aud

**Pré-requisitos**
- [req] 3.5.3 Authentication — JWT é um mecanismo de transporte de identidade autenticada
- [rec] 3.5.5 Sessions — Comparar com sessões evidencia o problema de revogação
- [rec] 3.1.7 TLS — Assinaturas assimétricas e chaves públicas aparecem também no TLS

**Desafios planejados**
- N1 · Conceitual — Explicar por que um JWT assinado pode ser lido por qualquer um mas não alterado
- N2 · Programação — Gerar e validar JWT em Java com RS256, verificando exp, iss e aud
- N3 · Identificação de bugs — Explorar um validador que aceita alg=none ou confunde RS256 com HS256
- N3 · Entrevista — Como revogar um JWT antes da expiração sem perder a vantagem stateless?
- N4 · Implementação — Implementar fluxo de access + refresh token com rotação e detecção de reuso

**Critérios de conclusão**
- [ ] Decodifiquei um JWT manualmente e verifiquei sua assinatura em código
- [ ] Explico por que dados sensíveis não devem ir no payload de um JWS
- [ ] Projetei revogação de tokens (expiração curta, denylist ou rotação de refresh)
- [ ] Testei a rejeição de tokens com alg=none, expirados e com audience errada

#### 3.5.8 Password Hashing

Password hashing armazena senhas como derivações unidirecionais lentas e com custo ajustável (bcrypt, scrypt, Argon2id, PBKDF2), tornando ataques offline caros. Hashes rápidos como SHA-256 são inadequados para senhas. _(~60 min)_

**Objetivos**
- Diferenciar hash criptográfico rápido de função de derivação de senha
- Explicar por que lentidão e consumo de memória dificultam ataques com GPU
- Configurar bcrypt/Argon2id com fator de custo adequado
- Implementar rehash transparente ao aumentar o custo
- Comparar hashes em tempo constante

**Pré-requisitos**
- [rec] 2.4.1 Hash Table — Contrasta funções hash de estruturas de dados com hashes criptográficos
- [rec] 3.5.3 Authentication — Senhas são a credencial mais comum de autenticação

**Desafios planejados**
- N1 · Conceitual — Explicar por que funções lentas são desejáveis para senhas e indesejáveis para checksums
- N2 · Experimento — Medir hashes por segundo de SHA-256 versus bcrypt (custo 10, 12, 14) em Java
- N3 · Análise de código — Revisar um cadastro que usa MD5 e propor migração sem forçar reset de senhas
- N4 · Implementação — Implementar verificação com Argon2id e rehash automático quando o custo configurado aumenta

**Critérios de conclusão**
- [ ] Explico por que SHA-256 de senha é inseguro mesmo com salt
- [ ] Escolhi um fator de custo medindo o tempo de hash no servidor
- [ ] Implementei migração de hashes legados no login

#### 3.5.9 Salt

Salt é um valor aleatório único por senha combinado antes do hash, impedindo rainbow tables e que senhas iguais gerem hashes iguais. Pepper é um segredo adicional mantido fora do banco. _(~30 min)_

**Objetivos**
- Explicar como o salt anula rainbow tables e ataques em lote
- Gerar salts com SecureRandom e tamanho adequado
- Explicar onde o salt é armazenado em formatos como o do bcrypt
- Diferenciar salt de pepper e avaliar o uso de pepper

**Pré-requisitos**
- [req] 3.5.8 Password Hashing — Salt é um componente do hashing de senhas

**Desafios planejados**
- N1 · Conceitual — Explicar por que o salt pode ficar armazenado junto ao hash
- N2 · Análise de código — Decompor uma string bcrypt ($2b$12$...) em versão, custo, salt e hash
- N2 · Identificação de bugs — Encontrar o problema de um sistema que usa um salt fixo global para todas as senhas
- N3 · Entrevista — Vale a pena usar pepper? Onde guardá-lo e como rotacioná-lo?
- N4 · Implementação — Implementar hashing PBKDF2 manual com salt por usuário e pepper vindo de variável de ambiente

**Critérios de conclusão**
- [ ] Explico por que o salt não precisa ser secreto
- [ ] Identifiquei salt, custo e hash numa string bcrypt
- [ ] Explico a diferença entre salt e pepper

#### 3.5.10 CORS

CORS é o mecanismo pelo qual o servidor relaxa a same-origin policy do navegador, informando via headers quais origens, métodos e headers podem acessar respostas. Inclui requisições simples, preflight OPTIONS e credenciais. _(~50 min)_

**Objetivos**
- Explicar a same-origin policy e o que conta como origem
- Diferenciar requisições simples e com preflight
- Configurar Access-Control-Allow-Origin, -Methods, -Headers e -Credentials corretamente
- Explicar por que CORS não é mecanismo de autenticação nem protege o servidor de clientes não navegadores
- Identificar configurações perigosas (refletir qualquer Origin com credenciais)

**Pré-requisitos**
- [req] 3.1.8 HTTP — CORS é implementado com headers HTTP
- [rec] 3.5.6 Cookies — O envio de credenciais cross-origin envolve cookies

**Desafios planejados**
- N1 · Conceitual — Explicar por que CORS é aplicado pelo navegador e não pelo servidor
- N2 · Experimento — Provocar um preflight com header customizado e inspecionar a requisição OPTIONS no DevTools
- N3 · Identificação de bugs — Encontrar a falha de uma API que reflete qualquer Origin com Allow-Credentials: true
- N3 · Programação — Configurar CORS restrito por lista de origens em uma API Java
- N4 · Implementação — Implementar um filtro CORS próprio em Java que trata preflight, allowlist de origens e Vary: Origin

**Critérios de conclusão**
- [ ] Reproduzi e corrigi um erro de CORS com preflight
- [ ] Explico por que curl ignora CORS
- [ ] Identifico uma configuração CORS insegura

#### 3.5.11 Idempotência

Idempotência garante que repetir uma operação produz o mesmo efeito que executá-la uma vez, essencial diante de retries e timeouts. Abrange métodos idempotentes do HTTP e idempotency keys armazenadas para operações como pagamentos. _(~75 min)_

**Objetivos**
- Explicar por que timeouts tornam o resultado de uma requisição desconhecido
- Identificar métodos HTTP idempotentes por especificação
- Implementar idempotency keys com armazenamento e constraint única
- Tratar requisições concorrentes com a mesma chave
- Definir retenção e escopo das chaves

**Pré-requisitos**
- [rec] 3.1.8 HTTP — A semântica de idempotência dos métodos vem do HTTP
- [rec] 3.2.1 Transactions — Registrar a chave e o efeito exige atomicidade
- [rec] 3.4.4 Primary Key — A deduplicação se apoia em constraints de unicidade

**Desafios planejados**
- N1 · Conceitual — Explicar o cenário de timeout em que o cliente não sabe se o pagamento ocorreu
- N2 · Programação — Implementar Idempotency-Key em um POST /pagamentos com tabela e constraint única
- N3 · Identificação de bugs — Encontrar a condição de corrida em uma implementação de idempotência do tipo check-then-insert
- N3 · Entrevista — Como a Stripe implementa idempotency keys e o que acontece com o mesmo key e payload diferente?
- N4 · Implementação — Criar um teste de carga que dispara retries concorrentes e prova ausência de cobranças duplicadas

**Critérios de conclusão**
- [ ] Implementei um endpoint de pagamento com Idempotency-Key que não duplica cobranças
- [ ] Testei requisições concorrentes com a mesma chave
- [ ] Explico por que POST não é idempotente e como torná-lo

#### 3.5.12 SQL Injection

SQL injection ocorre quando entrada do usuário é concatenada em SQL e interpretada como código. A defesa principal são prepared statements com parâmetros vinculados, complementados por menor privilégio e cuidado com partes dinâmicas como ORDER BY. _(~60 min)_

**Objetivos**
- Explicar como a concatenação permite alterar a estrutura de uma consulta
- Explorar SQL injection clássica, baseada em UNION e blind em ambiente controlado
- Usar PreparedStatement corretamente e entender por que ele separa código de dados
- Tratar identificadores dinâmicos (colunas de ordenação) com allowlist
- Aplicar menor privilégio ao usuário de banco da aplicação

**Pré-requisitos**
- [req] 3.4.2 SQL — É preciso entender SQL para entender como a injeção altera a consulta

**Desafios planejados**
- N1 · Conceitual — Explicar por que parâmetros vinculados não podem ser interpretados como SQL
- N2 · Identificação de bugs — Explorar um login vulnerável com ' OR '1'='1 e corrigi-lo com PreparedStatement
- N3 · Experimento — Extrair dados de outra tabela via UNION injection em uma aplicação local vulnerável
- N3 · Análise de código — Revisar um DAO e encontrar injeções em ORDER BY, LIKE e IN dinâmicos
- N4 · Implementação — Implementar um construtor de filtros dinâmicos seguro com allowlist de colunas e parâmetros

**Critérios de conclusão**
- [ ] Explorei uma SQL injection em uma aplicação vulnerável local
- [ ] Corrigi a vulnerabilidade com PreparedStatement e expliquei por que funciona
- [ ] Protegi um ORDER BY dinâmico com allowlist
- [ ] Explico por que escapar strings manualmente não é a defesa adequada

## 04 — Java Backend

*Como o Java funciona por baixo: a JVM, o gerenciamento de memória e o garbage collector, concorrência (das threads às virtual threads) e o funcionamento interno do Spring e do JPA/Hibernate. São os assuntos clássicos das perguntas técnicas em vagas Java.*

### 4.1 JVM (14 tópicos)

**[Adicional]** Como a JVM transforma bytecode em código nativo e gerencia a memória do programa: carregamento de classes, interpretação e compilação JIT, áreas de memória (stacks, heap, Metaspace) e o funcionamento dos coletores de lixo. O módulo termina nos erros clássicos de memória e em como diagnosticá-los com as ferramentas do próprio JDK.

Objetivos do módulo:
- Explicar o caminho do .java até instruções de máquina executadas pela JVM.
- Descrever as áreas de memória da JVM e o que vive em cada uma.
- Entender como os coletores de lixo decidem o que é lixo e quanto isso custa em pausas e throughput.
- Diagnosticar memory leaks, OutOfMemoryError e StackOverflowError com jcmd, jstat, JFR, heap dumps e logs de GC.
- Escolher e ajustar flags básicas da JVM (heap, coletor, logs) com base em medições.

#### 4.1.1 JDK vs JRE vs JVM

O JDK contém o compilador (javac), ferramentas de diagnóstico (jcmd, jstack, javap) e a runtime; o JRE é a runtime (JVM + bibliotecas de classe); a JVM é a especificação e a implementação (HotSpot) que carrega e executa bytecode. Desde o Java 11 não existe JRE separado oficial, e o jlink gera runtimes customizados. _(~45 min)_

**Objetivos**
- Diferenciar JDK, JRE e JVM e dizer o que cada um contém.
- Explicar a diferença entre a especificação da JVM e implementações como HotSpot, OpenJ9 e GraalVM.
- Listar as ferramentas do JDK usadas para compilar, inspecionar e diagnosticar (javac, javap, jcmd, jstack, jstat, jfr).
- Explicar por que o Java 11+ não distribui mais um JRE e como o jlink cria runtimes mínimos.
- Explicar o que significa 'write once, run anywhere' e onde essa promessa tem limites (código nativo, JNI).

**Pré-requisitos**
- [rec] 1.1.3 Código fonte e código de máquina — Distinguir código fonte, código intermediário e código de máquina é a base para entender o papel da JVM.
- [rec] 1.1.4 Compilação — Ajuda a comparar a compilação javac (para bytecode) com a compilação tradicional para código nativo.

**Desafios planejados**
- N1 · Conceitual — Desenhar as camadas JDK, JRE e JVM com o conteúdo de cada uma
- N1 · Entrevista — Explicar a um entrevistador por que o Java 11+ não tem mais JRE separado
- N2 · Experimento — Inspecionar a JVM em execução com java -version, jcmd VM.version e jcmd VM.flags
- N3 · Experimento — Criar com jdeps e jlink um runtime mínimo para um app e comparar o tamanho com o JDK completo
- N4 · Projeto — Montar um Dockerfile multi-stage que compila com JDK e roda com runtime gerado por jlink

**Critérios de conclusão**
- [ ] Explica sem consultar o que há em cada camada (JDK, JRE, JVM).
- [ ] Identifica a versão e a implementação da JVM em uso com java -version e jcmd VM.version.
- [ ] Gera um runtime mínimo com jlink e explica o ganho de tamanho.

#### 4.1.2 Bytecode

Bytecode é o conjunto de instruções de uma máquina virtual baseada em pilha de operandos, armazenado em arquivos .class junto com o constant pool e metadados. Entender o bytecode revela o custo real de construções como concatenação de strings, autoboxing, lambdas (invokedynamic) e chamadas virtuais. _(~75 min)_

**Objetivos**
- Descrever a estrutura de um arquivo .class (magic number, versão, constant pool, campos, métodos, atributos).
- Ler a saída do javap -c e explicar instruções como iload, istore, invokevirtual, invokestatic, invokespecial e invokeinterface.
- Explicar como a pilha de operandos e as variáveis locais de um frame são usadas pelas instruções.
- Mostrar no bytecode o efeito de autoboxing, concatenação de strings (invokedynamic/StringConcatFactory) e lambdas.
- Explicar por que o bytecode é verificado (bytecode verifier) antes da execução.

**Pré-requisitos**
- [rec] 1.1.3 Código fonte e código de máquina — O bytecode é um código intermediário entre o fonte e o código de máquina.
- [rec] 4.1.1 JDK vs JRE vs JVM — É preciso saber quem gera (javac) e quem executa (JVM) o bytecode.

**Desafios planejados**
- N1 · Conceitual — Explicar a estrutura de um .class e o papel do constant pool
- N2 · Experimento — Desmontar com javap -c um laço com soma e anotar o estado da pilha de operandos a cada instrução
- N2 · Análise de código — Comparar o bytecode de Integer vs int em um loop e localizar o autoboxing
- N3 · Experimento — Comparar no javap a concatenação de strings no Java 8 (StringBuilder) e no Java 9+ (invokedynamic)
- N3 · Identificação de bugs — Diagnosticar um UnsupportedClassVersionError a partir do major version do .class
- N4 · Implementação — Escrever um leitor mínimo de .class que imprime magic, versão e tamanho do constant pool

**Critérios de conclusão**
- [ ] Lê a saída de javap -c -v de um método simples e explica cada instrução.
- [ ] Identifica no bytecode onde ocorre autoboxing e alocação implícita.
- [ ] Explica a diferença entre os quatro tipos de invoke e o papel do invokedynamic.
- [ ] Relaciona o número de versão do .class com UnsupportedClassVersionError.

#### 4.1.3 Class Loading

Classes são carregadas sob demanda por uma hierarquia de class loaders (Bootstrap, Platform, Application) que seguem o modelo de delegação ao pai, e passam por loading, linking (verificação, preparação, resolução) e inicialização. Uma classe é identificada pelo par nome + class loader, o que explica ClassCastException entre classes 'iguais' e leaks de class loaders em servidores de aplicação. _(~90 min)_

**Objetivos**
- Descrever as fases loading, linking (verification, preparation, resolution) e initialization.
- Explicar a hierarquia Bootstrap, Platform e Application class loader e o modelo de delegação ao pai.
- Explicar quando a inicialização de uma classe é disparada e a ordem dos blocos static.
- Diferenciar ClassNotFoundException de NoClassDefFoundError e diagnosticar cada um.
- Explicar por que a identidade de uma classe inclui o class loader e as consequências disso (ClassCastException, leaks em redeploy).

**Pré-requisitos**
- [rec] 4.1.2 Bytecode — O class loader carrega e verifica justamente o bytecode dos arquivos .class.

**Desafios planejados**
- N1 · Conceitual — Explicar o modelo de delegação parent-first dos class loaders
- N2 · Experimento — Rodar uma aplicação com -Xlog:class+load e contar quantas classes são carregadas até o main
- N2 · Análise de código — Prever a ordem de execução de blocos static em uma hierarquia de classes
- N3 · Identificação de bugs — Reproduzir NoClassDefFoundError causado por falha no inicializador static
- N3 · Entrevista — Explicar por que duas classes com o mesmo nome podem gerar ClassCastException entre si
- N4 · Implementação — Implementar um class loader customizado que carrega classes de um diretório e permite hot reload

**Critérios de conclusão**
- [ ] Explica o modelo de delegação e por que ele protege classes do java.lang.
- [ ] Prevê a ordem de inicialização de classes com blocos static e campos static final.
- [ ] Distingue ClassNotFoundException de NoClassDefFoundError com um exemplo reproduzível.
- [ ] Observa o carregamento de classes com -Xlog:class+load.

#### 4.1.4 JIT Compilation

O HotSpot começa interpretando o bytecode, coleta perfis de execução e compila os métodos quentes para código nativo com tiered compilation: C1 (rápido, poucas otimizações) e C2 (otimizações agressivas como inlining, escape analysis e loop unrolling). Otimizações especulativas podem ser desfeitas (deoptimization), o que explica warm-up e cuidados em benchmarks. _(~90 min)_

**Objetivos**
- Explicar por que a JVM combina interpretador e JIT em vez de compilar tudo antecipadamente.
- Descrever os níveis da tiered compilation e o papel de C1 e C2.
- Explicar inlining, escape analysis, eliminação de bounds check e OSR (on-stack replacement).
- Explicar deoptimization e por que otimizações especulativas podem ser desfeitas.
- Explicar por que microbenchmarks ingênuos mentem e como o JMH resolve warm-up e dead code elimination.
- Comparar JIT com compilação AOT (GraalVM Native Image) em startup, pico de desempenho e memória.

**Pré-requisitos**
- [rec] 1.1.4 Compilação — Entender compilação tradicional ajuda a comparar com compilação just-in-time.
- [req] 4.1.2 Bytecode — O JIT compila bytecode; sem entender bytecode o processo fica abstrato.

**Desafios planejados**
- N1 · Conceitual — Explicar a tiered compilation do HotSpot: interpretador, C1 e C2
- N2 · Experimento — Observar com -XX:+PrintCompilation um método quente sendo promovido de nível e compilado via OSR
- N2 · Experimento — Medir o tempo de cada iteração de um laço e plotar a curva de warm-up
- N3 · Identificação de bugs — Corrigir um microbenchmark ingênuo que mede código eliminado pelo JIT
- N3 · Entrevista — Explicar deoptimization e quando uma chamada megamórfica impede inlining
- N4 · Projeto — Benchmark com JMH comparando JIT (C2) e GraalVM Native Image em startup e throughput

**Critérios de conclusão**
- [ ] Lê a saída de -XX:+PrintCompilation e identifica níveis de compilação, OSR (%) e 'made not entrant'.
- [ ] Explica warm-up e a diferença de desempenho entre as primeiras e as últimas execuções.
- [ ] Escreve um benchmark com JMH evitando dead code elimination.
- [ ] Explica quando escape analysis evita uma alocação na heap.

#### 4.1.5 JVM Stack

Cada thread Java tem sua própria JVM Stack, composta de frames criados a cada chamada de método, contendo o array de variáveis locais, a pilha de operandos e a referência ao constant pool. Primitivos locais e referências vivem no frame; os objetos apontados ficam na heap (salvo quando escape analysis elimina a alocação). _(~60 min)_

**Objetivos**
- Explicar a estrutura de um frame: variáveis locais, pilha de operandos e dados do frame.
- Identificar o que fica na stack (primitivos locais, referências) e o que fica na heap (objetos).
- Explicar por que cada thread tem sua própria stack e por que variáveis locais são thread-safe por natureza.
- Configurar e explicar o efeito de -Xss no tamanho da stack e no número de threads.
- Ler um stack trace e relacioná-lo aos frames da call stack.

**Pré-requisitos**
- [req] 1.1.7 Stack — A JVM Stack é a aplicação do conceito de stack de execução já estudado.
- [rec] 1.1.9 Call Stack — Frames da JVM correspondem às chamadas na call stack.
- [rec] 4.1.2 Bytecode — Variáveis locais e pilha de operandos aparecem diretamente nas instruções do bytecode.

**Desafios planejados**
- N1 · Conceitual — Explicar a diferença entre stack e heap na JVM
- N1 · Análise de código — Identificar onde objetos e variáveis de um método são armazenados
- N2 · Programação — Criar um programa que demonstre o comportamento da memória entre chamadas de método
- N2 · Experimento — Capturar a stack de uma thread bloqueada com jstack e mapear cada frame ao código
- N3 · Experimento — Medir a profundidade máxima de recursão variando -Xss e o tamanho do frame
- N4 · Implementação — Implementar um interpretador mínimo baseado em pilha de operandos para expressões aritméticas

**Critérios de conclusão**
- [ ] Explica a diferença entre stack e heap usando um exemplo de código Java.
- [ ] Aponta, para cada variável de um trecho de código, onde ela e o objeto referenciado são armazenados.
- [ ] Explica por que variáveis locais não sofrem race condition, mas os objetos que referenciam podem sofrer.
- [ ] Captura e interpreta os frames de uma thread com jstack ou jcmd Thread.print.

#### 4.1.6 Heap

A heap é a área compartilhada entre todas as threads onde ficam os objetos e arrays; ela é dividida em regiões/gerações conforme o coletor e cresce entre -Xms e -Xmx. Alocações são muito baratas graças a bump-the-pointer em TLABs (Thread-Local Allocation Buffers), e o layout de um objeto inclui header (mark word + class pointer), campos e padding. _(~75 min)_

**Objetivos**
- Explicar o papel da heap como área compartilhada de objetos e por que isso exige coleta de lixo.
- Configurar -Xms, -Xmx e entender o comportamento da JVM em containers (MaxRAMPercentage).
- Explicar como TLAB e bump-the-pointer tornam a alocação quase gratuita.
- Descrever o layout de um objeto (mark word, class pointer, compressed oops, padding) e estimar seu tamanho.
- Comparar o custo de memória de int[] vs Integer[] vs List<Integer>.

**Pré-requisitos**
- [req] 1.1.8 Heap — O conceito geral de heap é a base para a heap da JVM.
- [rec] 4.1.5 JVM Stack — As referências na stack apontam para objetos na heap; os dois tópicos se complementam.

**Desafios planejados**
- N1 · Conceitual — Explicar o que vive na heap e por que ela é compartilhada entre threads
- N2 · Experimento — Acompanhar o crescimento da heap com jstat -gc enquanto um programa aloca objetos
- N2 · Experimento — Medir com JOL o layout e o tamanho de um objeto com e sem compressed oops
- N3 · Análise de código — Comparar o consumo de memória de int[], Integer[] e ArrayList<Integer> com 1 milhão de elementos
- N3 · Entrevista — Explicar como a JVM define o tamanho da heap dentro de um container Docker
- N4 · Projeto — Analisar um problema de consumo excessivo de memória e reduzir o footprint de uma estrutura de dados

**Critérios de conclusão**
- [ ] Explica por que a heap é compartilhada e a stack não.
- [ ] Estima o tamanho de um objeto e confere com JOL (Java Object Layout).
- [ ] Observa o uso da heap com jstat -gc ou jcmd GC.heap_info.
- [ ] Explica o que é TLAB e por que alocar é mais barato do que parece.

#### 4.1.7 Metaspace

Metaspace é a área de memória nativa (fora da heap) que guarda metadados de classes, substituindo a PermGen a partir do Java 8. Ela cresce conforme classes são carregadas e só é liberada quando o class loader inteiro se torna inalcançável, por isso geração dinâmica de classes e redeploys são as causas típicas de OutOfMemoryError: Metaspace. _(~50 min)_

**Objetivos**
- Explicar o que é armazenado no Metaspace e o que fica na heap (instâncias, Class mirrors, strings internadas).
- Explicar por que a PermGen foi substituída pelo Metaspace e quais problemas isso resolveu ou não.
- Configurar MaxMetaspaceSize e MetaspaceSize e entender o efeito no gatilho de GC.
- Explicar por que metadados só são liberados quando o class loader é coletado.
- Identificar fontes comuns de crescimento: proxies dinâmicos, CGLIB, bibliotecas de scripting, redeploy.

**Pré-requisitos**
- [req] 4.1.3 Class Loading — Metaspace guarda metadados de classes carregadas e sua liberação depende dos class loaders.
- [rec] 1.2.6 Virtual Memory — Metaspace usa memória nativa reservada via memória virtual, fora da heap.

**Desafios planejados**
- N1 · Conceitual — Explicar por que a PermGen foi substituída pelo Metaspace
- N2 · Experimento — Monitorar o Metaspace com jcmd VM.metaspace durante o carregamento de muitas classes
- N3 · Identificação de bugs — Provocar OutOfMemoryError: Metaspace gerando classes dinâmicas em loop com MaxMetaspaceSize baixo
- N3 · Entrevista — Explicar por que redeploys sucessivos em um servidor de aplicação vazam Metaspace
- N4 · Experimento — Usar Native Memory Tracking (-XX:NativeMemoryTracking) para separar heap, Metaspace, threads e code cache

**Critérios de conclusão**
- [ ] Explica a diferença entre heap e Metaspace e o que fica em cada um.
- [ ] Monitora o Metaspace com jcmd VM.metaspace ou jstat -gcmetacapacity.
- [ ] Reproduz e explica um OutOfMemoryError: Metaspace.

#### 4.1.8 Garbage Collection

O Garbage Collector existe para recuperar automaticamente a memória de objetos da heap que não são mais alcançáveis, eliminando use-after-free e double free ao custo de CPU, memória extra e pausas. Ele determina alcançabilidade a partir dos GC Roots, explora a hipótese geracional e usa fases Stop-the-World ou concorrentes conforme o coletor (Serial, Parallel, G1, ZGC, Shenandoah). _(~120 min)_

**Objetivos**
- Entender por que existe o Garbage Collector e quais problemas da gestão manual de memória ele resolve.
- Compreender a relação entre heap e coleta de lixo: alocação, alcançabilidade e recuperação de espaço.
- Conhecer os conceitos de GC Roots e alcançabilidade (reachability) como critério de lixo.
- Entender o funcionamento da coleta geracional (young/old, minor/major GC).
- Compreender Stop-the-World e o trade-off entre latência, throughput e footprint.
- Comparar os algoritmos mark-sweep, mark-compact e copying e os coletores Serial, Parallel, G1 (regions) e ZGC.

**Pré-requisitos**
- [req] 4.1.6 Heap — O GC atua sobre a heap; é preciso entender como objetos são alocados nela.
- [rec] 1.1.8 Heap — Comparar com gestão manual (malloc/free) mostra por que o GC existe.

**Desafios planejados**
- N1 · Conceitual — Explicar por que existe o Garbage Collector e o que significa um objeto ser lixo
- N1 · Entrevista — Comparar mark-sweep, mark-compact e copying em fragmentação e custo
- N2 · Experimento — Rodar um programa com -Xlog:gc* e interpretar cada linha do log de coleta
- N3 · Experimento — Comparar pausas e throughput de Parallel, G1 e ZGC no mesmo workload com JFR
- N3 · Análise de código — Analisar um gráfico de heap em dente de serra e diagnosticar alocação excessiva
- N4 · Implementação — Implementar um coletor mark-sweep simulado sobre um grafo de objetos em Java

**Critérios de conclusão**
- [ ] Explica sem consultar por que o GC existe e o critério de alcançabilidade.
- [ ] Lê um log -Xlog:gc* e identifica tipo de coleta, duração da pausa e heap antes/depois.
- [ ] Compara G1 e ZGC em latência e throughput e justifica a escolha para um cenário.
- [ ] Explica por que System.gc() e finalize() não são formas confiáveis de gestão de memória.

#### 4.1.9 GC Roots

GC Roots são as referências que o coletor considera vivas por definição — variáveis locais e operandos nas stacks das threads, campos static de classes carregadas, referências JNI e monitores em uso. Todo objeto alcançável a partir delas sobrevive; os tipos de referência (strong, soft, weak, phantom) alteram essa regra. _(~60 min)_

**Objetivos**
- Listar os principais tipos de GC Roots na HotSpot.
- Explicar a marcação por travessia do grafo a partir das raízes e por que ciclos de referência não impedem a coleta.
- Diferenciar strong, soft, weak e phantom references e seus usos (caches, WeakHashMap, Cleaner).
- Usar o caminho até GC Roots (path to GC roots) em um heap dump para explicar por que um objeto está vivo.
- Explicar por que campos static e ThreadLocal em threads de pool são raízes perigosas.

**Pré-requisitos**
- [req] 4.1.8 Garbage Collection — GC Roots são o ponto de partida do algoritmo de marcação do GC.
- [rec] 4.1.5 JVM Stack — Variáveis locais nas stacks das threads são a fonte mais comum de raízes.

**Desafios planejados**
- N1 · Conceitual — Listar os tipos de GC Roots e explicar por que cada um é uma raiz
- N2 · Análise de código — Determinar quais objetos de um grafo com ciclos são alcançáveis após uma atribuição a null
- N2 · Experimento — Observar uma WeakReference sendo limpa após um GC e comparar com SoftReference
- N3 · Experimento — Usar 'Path to GC Roots' no Eclipse MAT para explicar por que um objeto continua vivo
- N4 · Implementação — Implementar um cache com WeakHashMap ou SoftReference e medir seu comportamento sob pressão de memória

**Critérios de conclusão**
- [ ] Lista pelo menos quatro categorias de GC Roots.
- [ ] Explica por que dois objetos que se referenciam mutuamente podem ser coletados.
- [ ] Encontra em um heap dump (Eclipse MAT) o caminho de um objeto até sua raiz.
- [ ] Explica o comportamento de WeakReference e SoftReference sob pressão de memória.

#### 4.1.10 Generational GC

A coleta geracional parte da hipótese de que a maioria dos objetos morre jovem: novos objetos nascem no Eden, sobreviventes passam pelos Survivor spaces e, após certa idade (tenuring threshold), são promovidos à Old Generation. Isso torna minor GCs rápidos, mas exige card tables/remembered sets para rastrear referências old→young; o G1 aplica as gerações sobre regions e o ZGC é geracional desde o Java 21. _(~90 min)_

**Objetivos**
- Explicar a weak generational hypothesis e por que ela torna a coleta mais eficiente.
- Descrever o caminho de um objeto: Eden, Survivor (S0/S1), Old e o papel do tenuring threshold.
- Explicar como card tables e remembered sets resolvem referências da old para a young generation.
- Diferenciar minor, mixed e full GC no G1 e explicar como as regions funcionam.
- Explicar premature promotion e seu efeito no aumento de coletas da old generation.

**Pré-requisitos**
- [req] 4.1.8 Garbage Collection — A coleta geracional é uma estratégia de implementação do GC.
- [rec] 4.1.9 GC Roots — A marcação parte das raízes e precisa considerar referências entre gerações.

**Desafios planejados**
- N1 · Conceitual — Explicar a hipótese geracional e a jornada Eden → Survivor → Old
- N2 · Experimento — Acompanhar com jstat -gcutil a ocupação de Eden, Survivors e Old durante um workload
- N3 · Experimento — Usar -Xlog:gc+age para observar o tenuring threshold e provocar premature promotion
- N3 · Entrevista — Explicar como card tables evitam varrer toda a old generation em um minor GC
- N4 · Projeto — Ajustar o tamanho da young generation de um serviço e medir o efeito em frequência e duração de pausas

**Critérios de conclusão**
- [ ] Explica a jornada de um objeto pelas gerações.
- [ ] Lê jstat -gcutil e interpreta as colunas E, S0, S1, O e YGC/FGC.
- [ ] Observa com -Xlog:gc+age a distribuição de idades dos objetos sobreviventes.
- [ ] Explica o que é premature promotion e como reduzi-la.

#### 4.1.11 Stop-the-World

Stop-the-World é a suspensão de todas as threads da aplicação em um safepoint para que a JVM execute uma operação que exige uma visão consistente da heap, como fases de GC ou deoptimization. Coletores modernos (G1, ZGC, Shenandoah) movem a maior parte do trabalho para fases concorrentes usando barreiras de leitura/escrita, reduzindo pausas ao custo de throughput. _(~75 min)_

**Objetivos**
- Explicar o que é um safepoint e por que a JVM precisa parar as threads para certas operações.
- Explicar quais fases de cada coletor são Stop-the-World e quais são concorrentes.
- Explicar como barreiras (write barriers, load barriers, colored pointers no ZGC) permitem trabalho concorrente.
- Medir pausas e time-to-safepoint com logs (-Xlog:safepoint) e JFR.
- Relacionar pausas de GC com latência de cauda (p99/p999) de um serviço.

**Pré-requisitos**
- [req] 4.1.8 Garbage Collection — Pausas STW são uma propriedade dos algoritmos de coleta.
- [rec] 4.1.10 Generational GC — A frequência e o tipo de pausa dependem das gerações e do coletor.
- [rec] 1.2.3 Thread — STW consiste em suspender as threads da aplicação.

**Desafios planejados**
- N1 · Conceitual — Explicar Stop-the-World e o papel dos safepoints
- N2 · Experimento — Medir pausas com -Xlog:gc,safepoint em um programa com alta taxa de alocação
- N3 · Experimento — Comparar a latência p99 de um endpoint HTTP com G1 e com ZGC sob carga
- N3 · Entrevista — Explicar como o ZGC realoca objetos concorrentemente sem parar a aplicação
- N4 · Projeto — Construir um harness que correlaciona pausas de GC (JFR) com latência de requisições

**Critérios de conclusão**
- [ ] Explica o que é safepoint e time-to-safepoint.
- [ ] Identifica em um log de GC quais eventos pausaram a aplicação e por quanto tempo.
- [ ] Explica por que o ZGC tem pausas curtas mesmo em heaps grandes.
- [ ] Relaciona pausas de GC com picos de latência p99 de uma API.

#### 4.1.12 Memory Leaks

Em Java, um memory leak é um objeto que continua alcançável mas nunca mais será usado — o GC não pode coletá-lo. Causas típicas são coleções static que só crescem, caches sem política de expiração, listeners não removidos, ThreadLocal em threads de pool e class loaders retidos; o diagnóstico usa heap dumps, dominator tree e retained size. _(~90 min)_

**Objetivos**
- Explicar por que memory leak em Java é diferente de leak em linguagens com gestão manual.
- Reconhecer os padrões clássicos de leak (static collections, caches, listeners, ThreadLocal, inner classes não estáticas).
- Gerar heap dumps com jcmd GC.heap_dump e -XX:+HeapDumpOnOutOfMemoryError.
- Analisar heap dumps no Eclipse MAT usando dominator tree, retained heap e leak suspects.
- Diferenciar leak de dimensionamento inadequado observando a ocupação da old generation após full GCs.

**Pré-requisitos**
- [req] 4.1.9 GC Roots — Um leak é um objeto inútil ainda alcançável a partir de GC Roots.
- [rec] 4.1.10 Generational GC — O sintoma de leak aparece como old generation crescendo após cada coleta.

**Desafios planejados**
- N1 · Conceitual — Explicar por que um objeto alcançável e inútil é um memory leak em Java
- N2 · Identificação de bugs — Encontrar o leak em um cache estático baseado em HashMap sem expiração
- N3 · Experimento — Gerar um heap dump com jcmd e localizar o leak pela dominator tree do Eclipse MAT
- N3 · Identificação de bugs — Diagnosticar um leak de ThreadLocal em threads de um pool
- N4 · Projeto — Analisar um problema de consumo excessivo de memória em um serviço e documentar causa, evidências e correção

**Critérios de conclusão**
- [ ] Reproduz um leak e o identifica em um heap dump.
- [ ] Explica a diferença entre shallow heap e retained heap.
- [ ] Distingue um leak de uma heap pequena demais pelo comportamento pós-GC.
- [ ] Corrige um leak causado por ThreadLocal em thread pool.

#### 4.1.13 OutOfMemoryError

OutOfMemoryError é lançado quando a JVM não consegue satisfazer uma alocação mesmo após coletar, e a mensagem indica a área esgotada: Java heap space, GC overhead limit exceeded, Metaspace, Direct buffer memory, unable to create native thread ou Requested array size exceeds VM limit. Cada variante tem causa e diagnóstico diferentes, e após um OOM o estado da aplicação é pouco confiável. _(~75 min)_

**Objetivos**
- Diferenciar as principais mensagens de OutOfMemoryError e a área de memória de cada uma.
- Configurar a JVM para gerar evidências: HeapDumpOnOutOfMemoryError, HeapDumpPath, ExitOnOutOfMemoryError.
- Explicar por que capturar OutOfMemoryError e continuar é perigoso.
- Diagnosticar 'unable to create native thread' relacionando com limites do SO e -Xss.
- Explicar a relação entre limite de memória do container, heap e memória nativa (OOMKilled vs OOM da JVM).

**Pré-requisitos**
- [req] 4.1.6 Heap — A variante mais comum é a heap esgotada.
- [rec] 4.1.7 Metaspace — OutOfMemoryError: Metaspace depende do entendimento dessa área.
- [rec] 4.1.12 Memory Leaks — Leaks são uma das causas mais frequentes de OOM.

**Desafios planejados**
- N1 · Conceitual — Associar cada mensagem de OutOfMemoryError à área de memória esgotada
- N2 · Experimento — Provocar 'Java heap space' e 'GC overhead limit exceeded' com -Xmx baixo e gerar o heap dump
- N3 · Experimento — Provocar 'unable to create native thread' e relacionar com ulimit e -Xss
- N3 · Entrevista — Explicar por que um container é OOMKilled mesmo com -Xmx abaixo do limite
- N4 · Projeto — Configurar um serviço para coletar heap dump e JFR em OOM e escrever o runbook de investigação

**Critérios de conclusão**
- [ ] Reproduz pelo menos três variantes de OutOfMemoryError e explica cada causa.
- [ ] Configura a JVM para gerar heap dump automaticamente em OOM.
- [ ] Explica a diferença entre OutOfMemoryError da JVM e o container ser morto por OOMKilled.

#### 4.1.14 StackOverflowError

StackOverflowError ocorre quando a stack de uma thread não comporta mais frames, quase sempre por recursão infinita ou profunda demais. O limite depende de -Xss e do tamanho de cada frame; a JVM detecta o estouro com guard pages, e como é um Error e não uma Exception, capturá-lo raramente é apropriado. _(~50 min)_

**Objetivos**
- Explicar por que a recursão consome stack e quando ela estoura.
- Relacionar o limite de profundidade com -Xss e o tamanho do frame (variáveis locais, parâmetros).
- Provocar um StackOverflowError controlado e interpretar o stack trace repetitivo.
- Converter algoritmos recursivos profundos em iterativos com uma pilha explícita na heap.
- Reconhecer causas indiretas: toString/equals/hashCode recursivos, relacionamentos bidirecionais serializados em JSON.

**Pré-requisitos**
- [req] 4.1.5 JVM Stack — O erro é o esgotamento da JVM Stack de uma thread.
- [rec] 1.1.9 Call Stack — Cada chamada empilha um frame na call stack.

**Desafios planejados**
- N1 · Conceitual — Explicar por que recursão sem caso base gera StackOverflowError
- N2 · Experimento — Provocar um StackOverflowError controlado e medir a profundidade com diferentes valores de -Xss
- N2 · Programação — Reescrever uma DFS recursiva como iterativa usando ArrayDeque
- N3 · Identificação de bugs — Encontrar o StackOverflowError causado por toString recursivo entre duas classes
- N3 · Identificação de bugs — Corrigir o StackOverflowError na serialização JSON de entidades com relacionamento bidirecional
- N4 · Implementação — Implementar um avaliador de expressões aninhadas que suporta profundidade arbitrária sem recursão na stack

**Critérios de conclusão**
- [ ] Provoca um StackOverflowError controlado e explica o stack trace.
- [ ] Mede como a profundidade máxima muda com -Xss e com o tamanho do frame.
- [ ] Reescreve uma recursão profunda como iteração com pilha explícita.
- [ ] Identifica um StackOverflowError causado por serialização de entidades bidirecionais.

### 4.2 Spring e JPA por baixo (16 tópicos)

**[Adicional]** O que o Spring e o JPA/Hibernate fazem por trás das anotações: o container IoC que cria e conecta beans, o ciclo de vida e os escopos desses beans, o caminho de uma requisição HTTP até o controller e o mapeamento objeto-relacional com Persistence Context, dirty checking e carregamento lazy. Fecha com os dois problemas mais cobrados em entrevistas: N+1 e o comportamento real de @Transactional baseado em proxies.

Objetivos do módulo:
- Explicar como o ApplicationContext descobre, instancia, injeta e inicializa beans.
- Entender como o Spring cria proxies (JDK dynamic proxy vs CGLIB) e as consequências disso.
- Traçar o caminho de uma requisição pelo DispatcherServlet até a resposta.
- Descrever o Persistence Context, os estados de uma entidade e o momento do flush.
- Detectar e corrigir N+1 e configurar fetch adequado para cada caso de uso.
- Usar @Transactional sabendo propagação, rollback e por que self-invocation não funciona.

#### 4.2.1 IoC

Inversion of Control é o princípio em que o framework, e não o código da aplicação, controla a criação e a ligação dos objetos e o fluxo de execução ('Hollywood principle'). No Spring, o container IoC lê metadados (anotações, configuração Java), cria os objetos e entrega a eles suas dependências. _(~45 min)_

**Objetivos**
- Explicar Inversion of Control e o 'Hollywood principle'.
- Diferenciar IoC (princípio) de Dependency Injection (uma técnica de IoC) e de Service Locator.
- Explicar como IoC reduz acoplamento e facilita testes.
- Comparar uma aplicação com 'new' espalhado e uma aplicação com container IoC.

**Desafios planejados**
- N1 · Conceitual — Explicar Inversion of Control com o 'Hollywood principle'
- N1 · Entrevista — Diferenciar IoC, Dependency Injection e Service Locator
- N2 · Programação — Refatorar um código com 'new' acoplado para receber dependências de fora
- N3 · Análise de código — Identificar pontos de acoplamento rígido que impedem testes em um serviço legado
- N4 · Implementação — Implementar um container IoC mínimo que registra e resolve dependências por tipo

**Critérios de conclusão**
- [ ] Explica IoC com um exemplo de código antes e depois.
- [ ] Diferencia IoC de DI e de Service Locator.
- [ ] Implementa um container IoC mínimo.

#### 4.2.2 Dependency Injection

Dependency Injection é a técnica em que um objeto recebe suas dependências por construtor, setter ou campo em vez de criá-las. No Spring, a resolução é por tipo com desempate por @Qualifier/@Primary, e a injeção por construtor é preferida por permitir imutabilidade, deixar dependências explícitas e falhar cedo em dependências circulares. _(~60 min)_

**Objetivos**
- Comparar injeção por construtor, setter e campo e justificar a preferência por construtor.
- Explicar a resolução por tipo e o uso de @Qualifier, @Primary e injeção de List/Map de beans.
- Explicar por que dependências circulares falham com injeção por construtor e por que o Spring Boot 2.6+ as proíbe por padrão.
- Usar DI para substituir implementações em testes sem framework de mock.
- Explicar como o Spring descobre os parâmetros do construtor por reflexão.

**Pré-requisitos**
- [req] 4.2.1 IoC — DI é a forma concreta de IoC usada pelo Spring.

**Desafios planejados**
- N1 · Conceitual — Comparar injeção por construtor, setter e campo
- N2 · Programação — Resolver NoUniqueBeanDefinitionException com @Qualifier e @Primary
- N2 · Programação — Injetar uma List de estratégias e selecionar a implementação em tempo de execução
- N3 · Identificação de bugs — Diagnosticar e eliminar uma dependência circular entre dois serviços
- N4 · Implementação — Estender o container mínimo para injeção por construtor via reflexão

**Critérios de conclusão**
- [ ] Justifica a injeção por construtor com pelo menos três argumentos.
- [ ] Resolve uma ambiguidade de beans com @Qualifier ou @Primary.
- [ ] Explica e corrige uma dependência circular.

#### 4.2.3 Beans

Um bean é um objeto cuja criação, configuração e ciclo de vida são gerenciados pelo container Spring, descrito internamente por um BeanDefinition. Beans são registrados por component scanning (@Component e estereótipos) ou por métodos @Bean em classes @Configuration, que são proxiadas por CGLIB para garantir singletons. _(~60 min)_

**Objetivos**
- Explicar o que é um bean e o papel do BeanDefinition.
- Diferenciar @Component (e estereótipos @Service, @Repository, @Controller) de métodos @Bean.
- Explicar como o component scanning encontra classes anotadas.
- Explicar por que @Configuration é proxiada por CGLIB (modo full) e o que muda com proxyBeanMethods = false (lite).
- Registrar beans condicionalmente (@Conditional, @Profile) como faz a autoconfiguração do Spring Boot.

**Pré-requisitos**
- [rec] 4.2.2 Dependency Injection — Beans são os objetos que participam da injeção de dependências.

**Desafios planejados**
- N1 · Conceitual — Explicar o que torna um objeto um bean e o papel do BeanDefinition
- N2 · Programação — Registrar o mesmo serviço via @Component e via @Bean e comparar
- N3 · Experimento — Demonstrar que chamar um método @Bean dentro de @Configuration retorna o singleton e com proxyBeanMethods=false não
- N3 · Entrevista — Explicar como a autoconfiguração do Spring Boot decide registrar beans com @ConditionalOnMissingBean
- N4 · Implementação — Criar uma autoconfiguração própria com @Conditional para uma biblioteca interna

**Critérios de conclusão**
- [ ] Explica a diferença entre @Component e @Bean e quando usar cada um.
- [ ] Demonstra a diferença entre @Configuration full e lite.
- [ ] Lista os beans registrados em uma aplicação via ApplicationContext ou Actuator.

#### 4.2.4 ApplicationContext

O ApplicationContext é o container IoC completo do Spring: estende BeanFactory com eventos, internacionalização, acesso a recursos e Environment. O método refresh() executa a sequência de inicialização — carrega BeanDefinitions, aplica BeanFactoryPostProcessors, registra BeanPostProcessors e instancia os singletons não-lazy. _(~60 min)_

**Objetivos**
- Diferenciar BeanFactory e ApplicationContext.
- Descrever as etapas principais de refresh().
- Explicar o papel de BeanFactoryPostProcessor e BeanPostProcessor.
- Usar Environment, perfis e property sources na configuração.
- Publicar e consumir eventos de aplicação (ApplicationEvent, @EventListener).

**Pré-requisitos**
- [req] 4.2.3 Beans — O ApplicationContext é o registro e a fábrica dos beans.

**Desafios planejados**
- N1 · Conceitual — Diferenciar BeanFactory e ApplicationContext
- N2 · Programação — Inicializar um AnnotationConfigApplicationContext manualmente e listar seus beans
- N2 · Programação — Publicar e consumir um evento de domínio com @EventListener
- N3 · Análise de código — Seguir no código-fonte do Spring a sequência de AbstractApplicationContext.refresh()
- N4 · Implementação — Implementar um BeanFactoryPostProcessor que altera definições de beans antes da instanciação

**Critérios de conclusão**
- [ ] Explica as fases de refresh() em ordem.
- [ ] Diferencia BeanFactoryPostProcessor de BeanPostProcessor com exemplo.
- [ ] Cria um ApplicationContext manualmente sem Spring Boot.

#### 4.2.5 Bean Lifecycle

O ciclo de vida de um bean passa por instanciação, injeção de dependências, callbacks Aware, BeanPostProcessor (before), inicialização (@PostConstruct, InitializingBean, init-method), BeanPostProcessor (after) — onde proxies de AOP são criados — e destruição (@PreDestroy). Entender essa ordem explica por que o objeto injetado muitas vezes é um proxy e não a instância original. _(~75 min)_

**Objetivos**
- Listar a sequência completa de callbacks do ciclo de vida de um bean.
- Explicar em que momento os proxies de AOP são criados (postProcessAfterInitialization).
- Usar @PostConstruct e @PreDestroy corretamente e saber quando @PreDestroy não é chamado.
- Explicar a diferença entre JDK dynamic proxy e CGLIB e quando cada um é usado.
- Explicar por que chamar métodos de proxy dentro de @PostConstruct pode não ter o comportamento esperado.

**Pré-requisitos**
- [req] 4.2.4 ApplicationContext — O ciclo de vida é orquestrado pelo ApplicationContext e seus post-processors.

**Desafios planejados**
- N1 · Conceitual — Ordenar os callbacks do ciclo de vida de um bean
- N2 · Experimento — Instrumentar um bean com logs em cada callback e comparar com a ordem documentada
- N3 · Experimento — Imprimir getClass() de um bean com @Transactional e identificar o proxy CGLIB
- N3 · Entrevista — Explicar JDK dynamic proxy vs CGLIB e por que métodos final não são interceptados
- N4 · Implementação — Implementar um BeanPostProcessor que envolve beans anotados com um proxy de medição de tempo

**Critérios de conclusão**
- [ ] Registra a ordem real dos callbacks com logs e explica cada um.
- [ ] Mostra que o bean injetado é um proxy (getClass()) quando há AOP.
- [ ] Explica JDK dynamic proxy vs CGLIB e suas limitações (interfaces, final).

#### 4.2.6 Bean Scopes

O escopo define quantas instâncias de um bean existem e por quanto tempo: singleton (uma por container, padrão), prototype (uma por injeção/lookup) e os escopos web request, session e application. Injetar um bean de escopo menor em um singleton exige scoped proxy ou ObjectProvider; e como singletons são compartilhados por todas as threads de requisição, estado mutável neles é um problema de concorrência (aprofundado nos módulos 4.3 e 4.4). _(~60 min)_

**Objetivos**
- Diferenciar os escopos singleton, prototype, request, session e application.
- Explicar o problema de injetar prototype ou request em singleton e resolvê-lo com scoped proxy, ObjectProvider ou @Lookup.
- Explicar que o Spring não gerencia a destruição de beans prototype.
- Identificar estado mutável em singletons como risco quando várias requisições os usam ao mesmo tempo.
- Diferenciar o singleton do Spring do padrão de projeto Singleton.

**Pré-requisitos**
- [rec] 4.2.5 Bean Lifecycle — O escopo determina quando o ciclo de vida começa e termina.
- [rec] 3.5.5 Sessions — O escopo session depende do conceito de sessão HTTP.
- [rec] 1.2.3 Thread — Entender que várias threads atendem requisições explica o risco de estado em singletons.

**Desafios planejados**
- N1 · Conceitual — Comparar os escopos singleton, prototype, request e session
- N2 · Experimento — Mostrar que um prototype injetado em singleton é criado uma única vez
- N2 · Programação — Corrigir a injeção de prototype com ObjectProvider e com scoped proxy
- N3 · Identificação de bugs — Encontrar o bug de um controller singleton que guarda dados do usuário em campo de instância
- N4 · Implementação — Implementar um escopo customizado (por tenant) registrando um Scope no container

**Critérios de conclusão**
- [ ] Explica cada escopo e quando usá-lo.
- [ ] Resolve a injeção de um bean prototype em singleton com ObjectProvider.
- [ ] Identifica um singleton com estado mutável compartilhado entre requisições.

#### 4.2.7 Request Lifecycle

Uma requisição HTTP em uma aplicação Spring Boot passa pelo servidor embutido (Tomcat: conector, thread pool, parsing), pela cadeia de Servlet Filters (incluindo o Spring Security), pelo DispatcherServlet, por HandlerInterceptors, pelo controller e de volta pela serialização da resposta. Cada requisição ocupa uma thread do pool do Tomcat durante todo o processamento no modelo thread-per-request. _(~60 min)_

**Objetivos**
- Descrever o caminho de uma requisição do socket ao controller e de volta.
- Explicar o modelo thread-per-request do Tomcat e o efeito do tamanho do pool (server.tomcat.threads.max).
- Diferenciar Servlet Filter de HandlerInterceptor e saber onde cada um atua.
- Explicar onde o Spring Security se encaixa (DelegatingFilterProxy, SecurityFilterChain).
- Explicar como exceções são tratadas ao longo do caminho (@ControllerAdvice, error page).

**Pré-requisitos**
- [req] 3.1.8 HTTP — É preciso entender requisição e resposta HTTP antes do caminho interno.
- [rec] 1.2.3 Thread — Cada requisição é atendida por uma thread do pool do servidor.
- [rec] 4.2.4 ApplicationContext — Filtros, interceptors e controllers são beans do ApplicationContext.

**Desafios planejados**
- N1 · Conceitual — Desenhar o caminho de uma requisição do Tomcat até o controller
- N2 · Programação — Criar um Filter e um HandlerInterceptor que registram tempo e comparar a ordem de execução
- N3 · Experimento — Saturar o pool de threads do Tomcat com um endpoint lento e observar a fila com jstack
- N3 · Entrevista — Explicar a diferença entre Filter e HandlerInterceptor e quando usar cada um
- N4 · Implementação — Implementar propagação de correlation id do filtro até os logs via MDC

**Critérios de conclusão**
- [ ] Desenha o caminho completo de uma requisição com todos os componentes.
- [ ] Demonstra com logs a ordem entre filters, interceptors e controller.
- [ ] Explica o que acontece quando o pool de threads do Tomcat se esgota.

#### 4.2.8 Spring MVC

Spring MVC implementa o padrão Front Controller com o DispatcherServlet, que usa HandlerMapping para achar o handler, HandlerAdapter para invocá-lo, HandlerMethodArgumentResolvers para montar os parâmetros e HttpMessageConverters (Jackson) para serializar a resposta. Validação, tratamento de exceções e content negotiation são pontos de extensão desse pipeline. _(~75 min)_

**Objetivos**
- Explicar o papel do DispatcherServlet, HandlerMapping, HandlerAdapter e ViewResolver.
- Explicar como argumentos (@PathVariable, @RequestBody, @RequestParam) são resolvidos.
- Explicar como HttpMessageConverter e Jackson convertem JSON em objetos e vice-versa.
- Implementar tratamento global de erros com @RestControllerAdvice e ProblemDetail.
- Aplicar Bean Validation (@Valid) e entender onde ela é executada.

**Pré-requisitos**
- [req] 4.2.7 Request Lifecycle — Spring MVC é a parte do caminho da requisição a partir do DispatcherServlet.
- [rec] 3.1.10 REST — As APIs construídas com Spring MVC seguem princípios REST.

**Desafios planejados**
- N1 · Conceitual — Explicar o padrão Front Controller e os componentes do DispatcherServlet
- N2 · Programação — Construir um CRUD REST com @Valid e respostas de erro em ProblemDetail
- N3 · Implementação — Criar um HandlerMethodArgumentResolver que injeta o usuário autenticado no controller
- N3 · Identificação de bugs — Diagnosticar um 415 Unsupported Media Type e um 406 Not Acceptable
- N4 · Projeto — API REST de um domínio pequeno com validação, paginação, erros padronizados e testes com MockMvc

**Critérios de conclusão**
- [ ] Explica os componentes do DispatcherServlet e a ordem de atuação.
- [ ] Constrói uma API REST com validação e tratamento global de erros.
- [ ] Implementa um HandlerMethodArgumentResolver customizado.

#### 4.2.9 Spring Data

Spring Data JPA gera implementações de repositórios em tempo de execução: a interface é proxiada e os métodos são traduzidos a partir do nome (query derivation), de @Query ou de Specifications. SimpleJpaRepository delega ao EntityManager, e save() decide entre persist e merge com base em isNew(). _(~60 min)_

**Objetivos**
- Explicar como Spring Data cria a implementação de uma interface Repository via proxy.
- Usar query derivation, @Query (JPQL e nativa), projeções e paginação.
- Explicar o comportamento de save() (persist vs merge) e o custo de isNew() com IDs atribuídos manualmente.
- Explicar por que métodos de SimpleJpaRepository são transacionais por padrão.
- Identificar quando uma query derivada fica ilegível e deve virar @Query ou Specification.

**Pré-requisitos**
- [req] 3.4.2 SQL — Repositórios geram SQL; é preciso ler e avaliar o SQL produzido.
- [rec] 4.2.5 Bean Lifecycle — O repositório é um proxy criado pelo container.

**Desafios planejados**
- N1 · Conceitual — Explicar como uma interface Repository ganha implementação em tempo de execução
- N2 · Programação — Implementar consultas por query derivation, @Query e projeção com paginação
- N3 · Experimento — Habilitar o log de SQL e comparar save() de uma entidade com ID gerado e com ID atribuído
- N3 · Análise de código — Ler o código de SimpleJpaRepository.save() e explicar a decisão entre persist e merge
- N4 · Implementação — Implementar busca dinâmica com filtros opcionais usando Specifications

**Critérios de conclusão**
- [ ] Escreve repositórios com query derivation, @Query e paginação.
- [ ] Mostra no log o SQL gerado por cada método de repositório.
- [ ] Explica o SELECT extra gerado por save() com ID atribuído manualmente.

#### 4.2.10 JPA

JPA (Jakarta Persistence) é a especificação de mapeamento objeto-relacional do Java: define anotações de mapeamento, o EntityManager, a JPQL e o contrato do Persistence Context, sem implementá-los. Ela resolve o descompasso objeto-relacional (identidade, herança, associações), mas abstrai o SQL de um modo que esconde custos de acesso ao banco. _(~75 min)_

**Objetivos**
- Diferenciar a especificação JPA de implementações (Hibernate, EclipseLink).
- Mapear entidades com @Entity, @Id, estratégias de geração de ID e associações (@OneToMany, @ManyToOne).
- Explicar o object-relational impedance mismatch.
- Escrever consultas JPQL e explicar a diferença para SQL.
- Explicar o lado dono (owning side) de uma associação bidirecional e o papel de mappedBy.

**Pré-requisitos**
- [req] 3.4.1 Modelo relacional — JPA mapeia objetos para o modelo relacional.
- [rec] 3.4.5 Foreign Key — Associações JPA são implementadas com foreign keys.

**Desafios planejados**
- N1 · Conceitual — Explicar o object-relational impedance mismatch e o que a JPA padroniza
- N2 · Programação — Mapear Pedido e ItensPedido com associação bidirecional e mappedBy
- N3 · Identificação de bugs — Corrigir uma associação bidirecional em que o lado inverso é atualizado mas nada é salvo
- N3 · Entrevista — Comparar as estratégias de ID IDENTITY, SEQUENCE e UUID em desempenho e batch inserts
- N4 · Projeto — Modelar com JPA um domínio de e-commerce com herança, associações e consultas JPQL

**Critérios de conclusão**
- [ ] Mapeia um modelo com associações bidirecionais definindo corretamente o owning side.
- [ ] Explica as estratégias de geração de ID e o impacto de IDENTITY em batch inserts.
- [ ] Escreve consultas JPQL com join e explica o SQL gerado.

#### 4.2.11 Hibernate

Hibernate é a implementação de JPA mais usada: implementa o Session/EntityManager, gera SQL por dialeto, gerencia o first-level cache, oferece second-level cache, batching JDBC e enhancement de bytecode. Seus recursos e configurações explicam boa parte do comportamento de desempenho de uma aplicação Spring Data JPA. _(~60 min)_

**Objetivos**
- Explicar a relação entre Session do Hibernate e EntityManager da JPA.
- Explicar o papel do Dialect na geração de SQL.
- Configurar e observar batching JDBC (hibernate.jdbc.batch_size, order_inserts).
- Diferenciar first-level cache e second-level cache e os riscos deste último.
- Usar as estatísticas do Hibernate (generate_statistics) para medir queries por requisição.

**Pré-requisitos**
- [req] 4.2.10 JPA — Hibernate é a implementação da especificação JPA.
- [rec] 3.4.11 Connection Pool — O Hibernate obtém conexões de um pool (HikariCP) para executar o SQL.

**Desafios planejados**
- N1 · Conceitual — Explicar a relação entre JPA, Hibernate, Session e EntityManager
- N2 · Experimento — Ativar generate_statistics e contar queries e entidades carregadas em um endpoint
- N3 · Experimento — Comparar inserção de 10 mil entidades com e sem batching JDBC
- N3 · Entrevista — Explicar quando o second-level cache ajuda e quando gera dados desatualizados
- N4 · Projeto — Otimizar um importador em lote com batching, flush/clear periódico e StatelessSession

**Critérios de conclusão**
- [ ] Explica o que o Hibernate faz além da especificação JPA.
- [ ] Ativa batching e comprova pela contagem de statements.
- [ ] Mede o número de queries de um caso de uso com Hibernate statistics.

#### 4.2.12 Persistence Context

O Persistence Context é o conjunto de entidades gerenciadas por um EntityManager, funcionando como identity map (uma instância por linha) e cache de primeiro nível. Ele guarda snapshots das entidades para o dirty checking: no flush (antes de commit, antes de queries JPQL conflitantes ou manualmente) o Hibernate compara estado atual e snapshot e emite os UPDATEs necessários. _(~90 min)_

**Objetivos**
- Explicar o Persistence Context como identity map e first-level cache.
- Explicar dirty checking: snapshot, comparação no flush e geração de UPDATE.
- Descrever quando o flush acontece (FlushMode AUTO, COMMIT) e a diferença entre flush e commit.
- Explicar o escopo do Persistence Context em aplicações Spring (transaction-scoped) e o Open Session in View.
- Explicar o custo de memória e CPU de um Persistence Context com muitas entidades e quando usar clear().

**Pré-requisitos**
- [req] 4.2.11 Hibernate — O Persistence Context é implementado pela Session do Hibernate.
- [rec] 3.2.1 Transactions — O flush e o commit se relacionam com a transação do banco.

**Desafios planejados**
- N1 · Conceitual — Explicar o Persistence Context como identity map e cache de primeiro nível
- N2 · Experimento — Alterar uma entidade gerenciada sem chamar save() e observar o UPDATE no log
- N2 · Análise de código — Prever quantas queries um trecho com find() repetido e JPQL intermediária executa
- N3 · Identificação de bugs — Encontrar o UPDATE inesperado causado por dirty checking em um método de leitura
- N3 · Entrevista — Explicar por que o Open Session in View é considerado um anti-pattern
- N4 · Projeto — Processar 1 milhão de registros com flush/clear periódico e medir heap e tempo

**Critérios de conclusão**
- [ ] Demonstra que alterar uma entidade gerenciada gera UPDATE sem chamar save().
- [ ] Explica a diferença entre flush e commit.
- [ ] Demonstra que duas buscas do mesmo ID retornam a mesma instância.
- [ ] Explica os riscos do Open Session in View.

#### 4.2.13 Entity Lifecycle

Uma entidade JPA transita entre os estados transient (new), managed, detached e removed por meio de persist, merge, detach, remove e do fim do Persistence Context. Operações em cascata e orphanRemoval propagam essas transições, e merge copia o estado para uma instância gerenciada em vez de reanexar o objeto passado. _(~60 min)_

**Objetivos**
- Descrever os quatro estados de uma entidade e as operações que causam cada transição.
- Explicar a diferença entre persist e merge e por que merge retorna outra instância.
- Configurar cascade e orphanRemoval conscientemente.
- Explicar a LazyInitializationException como consequência do estado detached.
- Implementar equals/hashCode de entidades de forma consistente entre estados.

**Pré-requisitos**
- [req] 4.2.12 Persistence Context — Os estados são definidos em relação ao Persistence Context.

**Desafios planejados**
- N1 · Conceitual — Desenhar o diagrama de estados transient, managed, detached e removed
- N2 · Análise de código — Determinar o estado de cada entidade ao longo de um método transacional
- N3 · Identificação de bugs — Corrigir alterações perdidas por usar o objeto passado ao merge em vez do retornado
- N3 · Identificação de bugs — Encontrar a exclusão acidental causada por CascadeType.ALL em @ManyToOne
- N4 · Implementação — Implementar equals/hashCode de entidade estável em Set antes e depois do persist e testá-lo

**Critérios de conclusão**
- [ ] Desenha o diagrama de estados com todas as transições.
- [ ] Demonstra que merge retorna uma instância diferente da passada.
- [ ] Implementa equals/hashCode de entidade que funciona antes e depois de persistir.

#### 4.2.14 Lazy vs Eager

Lazy loading adia o carregamento de associações até o primeiro acesso usando proxies (para @ManyToOne) e coleções persistentes (para @OneToMany); eager carrega junto com a entidade. Os padrões da JPA (ToOne eager, ToMany lazy) costumam ser ruins: o recomendado é tudo lazy e buscar o necessário por caso de uso com JOIN FETCH, @EntityGraph ou projeções. _(~60 min)_

**Objetivos**
- Explicar como o Hibernate implementa lazy loading com proxies e PersistentCollection.
- Explicar os padrões de fetch da JPA e por que @ManyToOne EAGER é perigoso.
- Diagnosticar e corrigir LazyInitializationException sem recorrer a Open Session in View.
- Buscar associações por caso de uso com JOIN FETCH, @EntityGraph e DTO projections.
- Explicar o problema do produto cartesiano ao fazer fetch de múltiplas coleções (MultipleBagFetchException).

**Pré-requisitos**
- [req] 4.2.13 Entity Lifecycle — LazyInitializationException ocorre em entidades detached.
- [rec] 3.4.3 Joins — JOIN FETCH e eager loading são traduzidos em joins SQL.

**Desafios planejados**
- N1 · Conceitual — Explicar como o Hibernate implementa lazy loading com proxies
- N2 · Experimento — Imprimir a classe de uma associação @ManyToOne LAZY antes e depois do acesso
- N2 · Identificação de bugs — Corrigir uma LazyInitializationException ao serializar uma entidade no controller
- N3 · Análise de código — Analisar o SQL gerado ao fazer JOIN FETCH de duas coleções e explicar a explosão de linhas
- N4 · Implementação — Implementar três casos de uso com necessidades de dados diferentes usando @EntityGraph e projeções

**Critérios de conclusão**
- [ ] Explica como um proxy lazy é inicializado.
- [ ] Corrige uma LazyInitializationException com JOIN FETCH ou @EntityGraph.
- [ ] Explica por que fetch de duas coleções gera produto cartesiano.

#### 4.2.15 N+1

O problema N+1 ocorre quando uma consulta carrega N entidades e o acesso a uma associação lazy de cada uma dispara mais N consultas. As correções são JOIN FETCH/@EntityGraph, batch fetching (@BatchSize, default_batch_fetch_size), subselect ou projeções em DTO, e a detecção deve ser automatizada em testes contando queries. _(~75 min)_

**Objetivos**
- Explicar por que o N+1 surge com lazy e também com eager.
- Detectar N+1 no log de SQL e com Hibernate statistics.
- Corrigir com JOIN FETCH, @EntityGraph, @BatchSize e projeções e comparar trade-offs.
- Explicar por que JOIN FETCH com paginação gera aviso HHH90003004 e paginação em memória.
- Automatizar a detecção de N+1 com testes que afirmam o número de queries.

**Pré-requisitos**
- [req] 4.2.14 Lazy vs Eager — N+1 é consequência direta da estratégia de fetch das associações.
- [rec] 3.4.3 Joins — A correção principal transforma N consultas em uma consulta com join.

**Desafios planejados**
- N1 · Conceitual — Explicar a origem do problema N+1
- N1 · Entrevista — Responder 'o que é N+1 e como você resolveria?' com mais de uma estratégia
- N2 · Identificação de bugs — Encontrar o N+1 em um endpoint que lista pedidos com seus clientes
- N3 · Experimento — Comparar JOIN FETCH, @BatchSize e projeção DTO em número de queries e tempo
- N3 · Identificação de bugs — Corrigir uma listagem paginada com JOIN FETCH que paginava em memória
- N4 · Implementação — Criar um teste de integração que conta queries por endpoint e falha em regressões de N+1

**Critérios de conclusão**
- [ ] Reproduz um N+1 e mede o número de queries.
- [ ] Corrige com pelo menos duas técnicas e compara o SQL gerado.
- [ ] Explica o problema de JOIN FETCH com paginação e a alternativa.
- [ ] Escreve um teste que falha se o número de queries aumentar.

#### 4.2.16 @Transactional

@Transactional é implementado por um proxy (JDK dynamic proxy ou CGLIB) com TransactionInterceptor, que obtém uma transação do PlatformTransactionManager antes do método e faz commit ou rollback depois. Por isso self-invocation, métodos privados ou final ignoram a anotação; o rollback padrão só ocorre para RuntimeException e Error; e o contexto transacional fica preso à thread (ThreadLocal), não se propagando para outras threads. _(~90 min)_

**Objetivos**
- Explicar como o proxy e o TransactionInterceptor implementam @Transactional.
- Explicar por que self-invocation, métodos privados e final não são transacionais e como contornar.
- Explicar as regras de rollback (RuntimeException vs checked exception, rollbackFor).
- Diferenciar os modos de propagação (REQUIRED, REQUIRES_NEW, NESTED, MANDATORY) e o isolamento configurável.
- Explicar readOnly=true e seus efeitos no Hibernate (flush mode, dirty checking) e no driver.
- Explicar que a transação está vinculada à thread via TransactionSynchronizationManager.

**Pré-requisitos**
- [req] 3.2.1 Transactions — @Transactional delimita transações de banco de dados.
- [rec] 3.2.3 Isolation Levels — O atributo isolation mapeia diretamente para os níveis de isolamento.
- [req] 4.2.5 Bean Lifecycle — O comportamento depende do proxy criado no ciclo de vida do bean.
- [rec] 4.2.12 Persistence Context — Commit dispara o flush do Persistence Context.

**Desafios planejados**
- N1 · Conceitual — Explicar como o proxy transacional abre, confirma e desfaz transações
- N1 · Entrevista — Explicar por que self-invocation quebra @Transactional
- N2 · Identificação de bugs — Encontrar por que uma checked exception não causou rollback
- N3 · Experimento — Demonstrar REQUIRED vs REQUIRES_NEW registrando auditoria mesmo quando a operação principal falha
- N3 · Identificação de bugs — Diagnosticar esgotamento do pool de conexões causado por REQUIRES_NEW aninhado
- N4 · Implementação — Implementar um mini TransactionInterceptor com JDK dynamic proxy sobre JDBC puro

**Critérios de conclusão**
- [ ] Explica o funcionamento por proxy e reproduz a falha por self-invocation.
- [ ] Demonstra a diferença de rollback entre RuntimeException e checked exception.
- [ ] Explica REQUIRES_NEW e o risco de consumir duas conexões do pool.
- [ ] Explica o efeito de readOnly=true no Persistence Context.

### 4.3 Fundamentos de concorrência (11 tópicos)

**[Adicional]** Os conceitos de concorrência independentes de linguagem: o que significa várias threads compartilhando memória, a diferença entre concorrência e paralelismo e os problemas que surgem disso — race conditions, falta de atomicidade e de visibilidade, deadlocks. Também apresenta as primitivas clássicas de sincronização (mutex, locks, semáforos) que o módulo 4.4 mostra em Java.

Objetivos do módulo:
- Identificar estado compartilhado mutável e as seções críticas de um código.
- Explicar race condition, atomicidade e visibilidade como problemas distintos.
- Escolher entre mutex, lock e semáforo conforme o problema.
- Reconhecer as quatro condições de Coffman e estratégias para evitar deadlock.
- Raciocinar sobre interleavings possíveis de duas ou mais threads.

#### 4.3.1 Process vs Thread

Revisita processo vs thread com foco em concorrência: threads de um mesmo processo compartilham heap, código e descritores, mas têm stacks e registradores próprios. Esse compartilhamento de memória torna a comunicação barata e é exatamente a origem dos problemas de race condition, visibilidade e sincronização. _(~45 min)_

**Objetivos**
- Explicar o que threads de um processo compartilham (heap, dados estáticos, arquivos) e o que é privado (stack, registradores, PC).
- Explicar por que comunicação entre threads é barata e entre processos exige IPC.
- Relacionar memória compartilhada com a necessidade de sincronização.
- Comparar o custo de criação e de context switch de processos e threads.
- Explicar o mapeamento 1:1 entre threads de plataforma Java e threads do SO.

**Pré-requisitos**
- [req] 1.2.4 Process vs Thread — Este tópico aprofunda a comparação já estudada, com foco em compartilhamento de memória.
- [rec] 1.2.5 Context Switch — O custo do context switch influencia o desenho de sistemas concorrentes.
- [rec] 4.1.5 JVM Stack — Cada thread Java tem sua própria JVM Stack, enquanto a heap é compartilhada.

**Desafios planejados**
- N1 · Conceitual — Listar o que threads de um mesmo processo compartilham e o que é privado
- N2 · Programação — Criar duas threads que alteram um mesmo objeto e duas que só usam variáveis locais
- N2 · Experimento — Relacionar as threads de um jstack com as threads do SO (nid, top -H ou Process Explorer)
- N3 · Experimento — Medir o custo de criar 10 mil threads vs 10 mil processos curtos
- N3 · Entrevista — Explicar quando usar múltiplos processos em vez de múltiplas threads
- N4 · Implementação — Implementar o mesmo contador compartilhado com threads (memória comum) e com processos (arquivo ou socket) e comparar

**Critérios de conclusão**
- [ ] Explica o que é compartilhado e o que é privado entre threads de um processo.
- [ ] Mostra com código duas threads alterando o mesmo objeto da heap.
- [ ] Observa as threads do SO correspondentes às threads Java.

#### 4.3.2 Concurrency vs Parallelism

Concorrência é lidar com várias tarefas cujas execuções se sobrepõem no tempo (estrutura); paralelismo é executá-las literalmente ao mesmo tempo em vários núcleos (execução). Um sistema pode ser concorrente em um único núcleo via time slicing, e o ganho do paralelismo é limitado pela parte sequencial (Lei de Amdahl) e por contenção. _(~45 min)_

**Objetivos**
- Diferenciar concorrência de paralelismo com exemplos.
- Diferenciar workloads CPU-bound e I/O-bound e o tipo de ganho de cada um.
- Aplicar a Lei de Amdahl para estimar o speedup máximo.
- Explicar por que mais threads nem sempre aumentam desempenho (contenção, context switch, cache).

**Pré-requisitos**
- [rec] 4.3.1 Process vs Thread — Threads são a unidade de execução concorrente.
- [rec] 1.2.9 I/O — Workloads I/O-bound se beneficiam de concorrência mesmo sem paralelismo.

**Desafios planejados**
- N1 · Conceitual — Diferenciar concorrência de paralelismo com um exemplo do dia a dia e um de software
- N2 · Programação — Calcular com a Lei de Amdahl o speedup máximo de um processamento com 10% sequencial
- N3 · Experimento — Medir o tempo de tarefas CPU-bound e I/O-bound variando o número de threads de 1 a 64
- N3 · Entrevista — Explicar por que um servidor single-threaded pode ser altamente concorrente
- N4 · Implementação — Paralelizar um processamento CPU-bound e encontrar empiricamente o ponto de saturação

**Critérios de conclusão**
- [ ] Explica a diferença entre concorrência e paralelismo com exemplos próprios.
- [ ] Calcula o speedup máximo com a Lei de Amdahl.
- [ ] Mede o efeito do número de threads em tarefas CPU-bound e I/O-bound.

#### 4.3.3 Race Condition

Race condition é quando o resultado depende da ordem ou do entrelaçamento (interleaving) não determinístico de threads acessando estado compartilhado, como em read-modify-write (count++) e check-then-act (if not exists then create). Bugs de corrida são intermitentes, difíceis de reproduzir e frequentemente só aparecem sob carga. _(~60 min)_

**Objetivos**
- Definir race condition e diferenciar de data race.
- Reconhecer os padrões read-modify-write e check-then-act.
- Enumerar interleavings possíveis de duas threads e prever resultados.
- Explicar por que bugs de corrida são intermitentes e dependem de carga e hardware.
- Identificar race conditions também fora da memória (arquivos, banco de dados, APIs).

**Pré-requisitos**
- [req] 4.3.1 Process vs Thread — Race conditions surgem do compartilhamento de memória entre threads.

**Desafios planejados**
- N1 · Conceitual — Explicar read-modify-write e check-then-act como fontes de race condition
- N2 · Experimento — Incrementar um contador compartilhado com 4 threads e medir as atualizações perdidas
- N2 · Análise de código — Enumerar os interleavings possíveis de duas threads executando x = x + 1
- N3 · Identificação de bugs — Encontrar a race condition check-then-act em um cadastro que gera usuários duplicados
- N4 · Experimento — Usar o jcstress para revelar resultados de corrida em um caso de teste concorrente

**Critérios de conclusão**
- [ ] Reproduz uma race condition com count++ e explica o resultado.
- [ ] Lista os interleavings de duas threads executando read-modify-write.
- [ ] Identifica check-then-act em código real.

#### 4.3.4 Critical Section

Seção crítica é o trecho de código que acessa estado compartilhado e não pode ser executado por mais de uma thread ao mesmo tempo. Uma solução correta exige exclusão mútua, progresso e espera limitada, e o tamanho da seção crítica determina diretamente o nível de contenção e a escalabilidade. _(~45 min)_

**Objetivos**
- Identificar as seções críticas de um trecho de código.
- Explicar os requisitos de exclusão mútua, progresso e espera limitada (bounded waiting).
- Explicar por que seções críticas devem ser pequenas e não conter I/O.
- Analisar o algoritmo de Peterson e por que ele não funciona em hardware moderno sem barreiras.

**Pré-requisitos**
- [req] 4.3.3 Race Condition — Seções críticas são o trecho onde race conditions podem acontecer.

**Desafios planejados**
- N1 · Conceitual — Explicar exclusão mútua, progresso e espera limitada
- N2 · Análise de código — Marcar as seções críticas de uma classe de conta bancária
- N3 · Análise de código — Analisar o algoritmo de Peterson e explicar por que falha com reordenação de memória
- N3 · Experimento — Comparar a vazão de um serviço com I/O dentro e fora da seção crítica
- N4 · Implementação — Refatorar um cache para reduzir a seção crítica sem perder corretude

**Critérios de conclusão**
- [ ] Marca corretamente as seções críticas de um código.
- [ ] Explica os três requisitos de uma solução de seção crítica.
- [ ] Reduz uma seção crítica e mede o efeito na vazão.

#### 4.3.5 Thread Safety

Uma classe é thread-safe quando se comporta corretamente sob acesso concorrente sem coordenação adicional dos chamadores. As estratégias são não compartilhar (confinamento), não mutar (imutabilidade) ou sincronizar; thread safety de operações isoladas não garante a de operações compostas. _(~60 min)_

**Objetivos**
- Definir thread safety em termos de invariantes e corretude.
- Aplicar as estratégias: confinamento, imutabilidade, sincronização e delegação.
- Explicar por que compor operações thread-safe não gera uma operação thread-safe.
- Projetar classes imutáveis corretamente (final, cópias defensivas, publicação segura).
- Classificar classes do JDK por nível de thread safety (StringBuilder, SimpleDateFormat, HashMap, ConcurrentHashMap).

**Pré-requisitos**
- [rec] 4.3.4 Critical Section — Proteger seções críticas é uma das estratégias de thread safety.

**Desafios planejados**
- N1 · Conceitual — Explicar as quatro estratégias para obter thread safety
- N2 · Programação — Transformar uma classe mutável de valor monetário em imutável
- N3 · Identificação de bugs — Encontrar o bug de usar SimpleDateFormat compartilhado entre threads
- N3 · Análise de código — Mostrar por que containsKey seguido de put em um mapa sincronizado não é atômico
- N4 · Implementação — Projetar um contador de métricas thread-safe e documentar sua política de sincronização

**Critérios de conclusão**
- [ ] Explica as estratégias de thread safety com exemplos.
- [ ] Cria uma classe imutável correta.
- [ ] Identifica uma composição não thread-safe de operações thread-safe.

#### 4.3.6 Mutex

Mutex (mutual exclusion) é uma primitiva com dono que permite a apenas uma thread por vez entrar numa seção crítica: quem adquire é quem deve liberar. Implementações reais combinam operações atômicas de hardware (test-and-set, CAS) com espera ativa breve (spinning) e bloqueio no kernel (futex no Linux). _(~45 min)_

**Objetivos**
- Explicar a semântica de um mutex e o conceito de ownership.
- Explicar como instruções atômicas (test-and-set, CAS) permitem implementar um mutex.
- Comparar spinlock com mutex bloqueante e quando cada um é adequado.
- Explicar o custo de contenção: context switch, cache line bouncing.

**Pré-requisitos**
- [req] 4.3.4 Critical Section — O mutex é o mecanismo clássico para proteger seções críticas.
- [rec] 1.2.5 Context Switch — Bloquear em um mutex causa context switch.

**Desafios planejados**
- N1 · Conceitual — Explicar exclusão mútua e ownership de um mutex
- N2 · Programação — Proteger um contador compartilhado com um mutex e comprovar a corretude
- N3 · Implementação — Implementar um spinlock com AtomicBoolean.compareAndSet
- N3 · Experimento — Comparar o spinlock com um lock bloqueante sob contenção alta e baixa
- N3 · Entrevista — Explicar quando spinning é preferível a bloquear a thread
- N4 · Implementação — Implementar um mutex com spin curto seguido de bloqueio via LockSupport.park e fila de espera

**Critérios de conclusão**
- [ ] Explica ownership e por que outra thread não deve liberar o mutex.
- [ ] Implementa um spinlock com uma operação atômica.
- [ ] Compara spinlock e mutex bloqueante em cenários de alta e baixa contenção.

#### 4.3.7 Lock

Lock é o termo geral para mecanismos de exclusão, que variam em propriedades: reentrância, justiça (fairness), leitura/escrita (read-write lock), tentativa com timeout e granularidade. A escolha afeta corretude, contenção e o risco de starvation ou deadlock. _(~60 min)_

**Objetivos**
- Explicar reentrância e por que ela evita auto-deadlock em chamadas recursivas.
- Diferenciar locks justos e injustos e o trade-off com throughput.
- Explicar read-write locks e quando eles realmente ajudam.
- Comparar granularidade grossa e fina (lock striping) de locks.
- Relacionar locks em memória com locks de banco de dados.

**Pré-requisitos**
- [req] 4.3.6 Mutex — O mutex é o tipo mais básico de lock.
- [rec] 3.2.7 Locks — Os mesmos conceitos aparecem nos locks de banco de dados.

**Desafios planejados**
- N1 · Conceitual — Explicar reentrância, fairness e locks de leitura/escrita
- N2 · Programação — Proteger um mapa de configuração com read-write lock
- N3 · Experimento — Comparar lock global e lock striping em um mapa sob contenção
- N3 · Entrevista — Explicar quando um read-write lock é mais lento que um lock simples
- N4 · Implementação — Implementar um mapa com lock striping por segmentos de hash

**Critérios de conclusão**
- [ ] Explica reentrância, fairness e read-write locks.
- [ ] Escolhe a granularidade adequada para um cenário.
- [ ] Explica starvation causada por locks injustos ou por escritores em read-write locks.

#### 4.3.8 Semaphore

Semáforo é um contador de permissões com operações acquire (P/wait) e release (V/signal); diferente do mutex, não tem dono e permite até N threads simultâneas. Serve para limitar acesso a recursos escassos (conexões, chamadas externas) e para sinalização entre threads, como no problema produtor-consumidor. _(~45 min)_

**Objetivos**
- Explicar as operações P e V e o contador de permissões.
- Diferenciar semáforo binário de mutex (ownership).
- Usar semáforo para limitar concorrência a um recurso (bulkhead).
- Resolver produtor-consumidor com semáforos.

**Pré-requisitos**
- [req] 4.3.6 Mutex — Comparar com o mutex é essencial para entender o semáforo.
- [rec] 2.1.8 Queue — O problema produtor-consumidor usa uma fila limitada.

**Desafios planejados**
- N1 · Conceitual — Diferenciar semáforo de mutex
- N2 · Programação — Limitar a 5 as chamadas simultâneas a uma API externa com Semaphore
- N3 · Implementação — Resolver produtor-consumidor com buffer limitado usando dois semáforos e um mutex
- N3 · Identificação de bugs — Encontrar o vazamento de permissões de um semáforo sem release em finally
- N4 · Implementação — Implementar um pool de objetos genérico limitado por semáforo

**Critérios de conclusão**
- [ ] Explica a diferença entre semáforo e mutex.
- [ ] Limita chamadas concorrentes a um serviço com semáforo.
- [ ] Implementa produtor-consumidor com semáforos.

#### 4.3.9 Atomicity

Atomicidade é a propriedade de uma operação ser indivisível: outras threads a veem por completo ou não a veem. Operações aparentemente simples como i++ ou escrita de long/double de 64 bits em JVMs 32-bit não são atômicas; o hardware oferece instruções atômicas (CAS, fetch-and-add) que formam a base de algoritmos lock-free. _(~45 min)_

**Objetivos**
- Explicar atomicidade e por que i++ não é atômico.
- Explicar compare-and-swap e o loop de retry de algoritmos lock-free.
- Explicar o problema ABA.
- Diferenciar atomicidade em memória da atomicidade de transações (ACID).

**Pré-requisitos**
- [req] 4.3.3 Race Condition — A falta de atomicidade é a causa do read-modify-write com race.
- [rec] 3.2.2 ACID — Comparar com o 'A' de ACID evita confusão entre os conceitos.

**Desafios planejados**
- N1 · Conceitual — Explicar por que i++ não é uma operação atômica
- N2 · Análise de código — Identificar no bytecode (javap) as instruções separadas de um incremento de campo
- N3 · Implementação — Implementar um incremento lock-free com loop de compare-and-swap
- N3 · Entrevista — Explicar o problema ABA e como versionar referências o resolve
- N4 · Implementação — Implementar uma pilha lock-free (Treiber stack) e testá-la sob concorrência

**Critérios de conclusão**
- [ ] Explica por que i++ são três operações.
- [ ] Explica o funcionamento do CAS e o loop de retry.
- [ ] Explica o problema ABA com um exemplo.

#### 4.3.10 Visibility

Visibilidade é a garantia de que a escrita de uma thread seja observada por outras; sem ela, caches de CPU, store buffers e otimizações do compilador (manter valor em registrador, reordenar instruções) podem fazer uma thread ver valores antigos indefinidamente. Barreiras de memória e primitivas de sincronização estabelecem essa garantia. _(~60 min)_

**Objetivos**
- Explicar por que escritas podem não ser visíveis a outras threads (caches, store buffers, registradores).
- Explicar reordenação de instruções pelo compilador e pelo processador.
- Diferenciar visibilidade de atomicidade.
- Explicar o papel das memory barriers.
- Explicar coerência de cache e o custo de false sharing.

**Pré-requisitos**
- [rec] 4.3.9 Atomicity — Visibilidade e atomicidade são problemas distintos e frequentemente confundidos.
- [rec] 1.1.1 CPU — Caches de CPU explicam por que uma escrita pode não ser vista imediatamente.

**Desafios planejados**
- N1 · Conceitual — Explicar como caches e reordenação causam problemas de visibilidade
- N2 · Experimento — Reproduzir uma thread que nunca enxerga a flag de parada alterada por outra
- N3 · Experimento — Medir o impacto de false sharing em contadores adjacentes e corrigi-lo com padding
- N3 · Entrevista — Explicar por que visibilidade e atomicidade são garantias diferentes
- N4 · Experimento — Usar o jcstress para observar reordenações permitidas entre duas escritas

**Critérios de conclusão**
- [ ] Explica a diferença entre visibilidade e atomicidade.
- [ ] Reproduz um loop que nunca termina por falta de visibilidade.
- [ ] Explica false sharing e como medi-lo.

#### 4.3.11 Deadlock

Deadlock é um bloqueio permanente em que threads esperam umas pelas outras em ciclo; exige as quatro condições de Coffman (exclusão mútua, hold and wait, no preemption, circular wait). Prevenção atua em uma condição (ordem global de locks, timeouts com tryLock), e livelock e starvation são problemas vizinhos. _(~60 min)_

**Objetivos**
- Enumerar e explicar as quatro condições de Coffman.
- Prevenir deadlock com ordenação global de locks e aquisição com timeout.
- Detectar deadlocks em uma JVM com jstack ou ThreadMXBean.
- Diferenciar deadlock, livelock e starvation.
- Relacionar com deadlocks de banco de dados e como o SGBD os detecta.

**Pré-requisitos**
- [req] 4.3.7 Lock — Deadlocks surgem da aquisição de múltiplos locks.
- [rec] 3.2.8 Deadlocks — O mesmo fenômeno ocorre em bancos de dados, com detecção automática.

**Desafios planejados**
- N1 · Conceitual — Explicar as quatro condições de Coffman
- N2 · Programação — Provocar um deadlock clássico de transferência entre duas contas
- N2 · Experimento — Identificar o deadlock com jstack e com a seção 'Found one Java-level deadlock'
- N3 · Identificação de bugs — Corrigir o deadlock impondo uma ordem global de aquisição de locks
- N3 · Entrevista — Diferenciar deadlock, livelock e starvation com exemplos
- N4 · Implementação — Implementar um detector de deadlock que usa ThreadMXBean e gera alerta

**Critérios de conclusão**
- [ ] Reproduz um deadlock e o identifica no jstack.
- [ ] Corrige com ordenação de locks e explica qual condição foi quebrada.
- [ ] Diferencia deadlock de livelock e starvation.

### 4.4 Concorrência em Java (11 tópicos)

**[Adicional]** Como o Java implementa concorrência: o Java Memory Model e a relação happens-before, synchronized e monitores, volatile, CAS e tipos atômicos, locks explícitos, coleções concorrentes e a infraestrutura de execução (thread pools, ExecutorService, Future, CompletableFuture). Termina nas virtual threads do Java 21, montadas sobre carrier threads, e nos seus limites como pinning.

Objetivos do módulo:
- Explicar happens-before e por que código sem sincronização pode ver valores antigos ou reordenados.
- Escolher entre synchronized, volatile, Atomic* e ReentrantLock com base em custo e semântica.
- Explicar como ConcurrentHashMap e as filas bloqueantes funcionam internamente.
- Dimensionar e configurar thread pools e tratar rejeição, exceções e shutdown.
- Compor tarefas assíncronas com CompletableFuture sem bloquear threads indevidamente.
- Saber quando virtual threads ajudam, como funcionam por baixo e o que causa pinning.

#### 4.4.1 Java Memory Model

O Java Memory Model (JSR-133) define quais valores uma leitura pode observar em programas concorrentes por meio da relação happens-before: unlock→lock do mesmo monitor, escrita→leitura volatile, Thread.start, Thread.join e semântica de campos final. Um programa sem data races é sequencialmente consistente; com data races, reordenações permitidas podem produzir resultados surpreendentes. _(~90 min)_

**Objetivos**
- Explicar o que o JMM especifica e por que ele existe.
- Listar as regras de happens-before e aplicá-las a um trecho de código.
- Definir data race no sentido do JMM e a garantia de consistência sequencial para programas sem data race.
- Explicar a semântica especial de campos final e publicação segura.
- Explicar por que o double-checked locking sem volatile é incorreto.

**Pré-requisitos**
- [req] 4.3.10 Visibility — O JMM formaliza as garantias de visibilidade e ordenação.
- [rec] 4.3.9 Atomicity — Atomicidade e visibilidade são os problemas que o JMM organiza.

**Desafios planejados**
- N1 · Conceitual — Explicar a relação happens-before e listar suas regras principais
- N2 · Análise de código — Determinar, por happens-before, quais valores uma thread leitora pode observar
- N3 · Identificação de bugs — Explicar e corrigir o double-checked locking sem volatile
- N3 · Entrevista — Explicar publicação segura e a garantia de campos final
- N4 · Experimento — Escrever testes jcstress que demonstrem reordenação sem happens-before e sua ausência com volatile

**Critérios de conclusão**
- [ ] Aplica happens-before para determinar se uma leitura vê uma escrita.
- [ ] Explica o bug do double-checked locking sem volatile.
- [ ] Explica o que é publicação segura e as formas de obtê-la.

#### 4.4.2 synchronized

synchronized usa o monitor intrínseco de cada objeto para exclusão mútua reentrante e estabelece happens-before entre unlock e lock subsequente. No bytecode vira monitorenter/monitorexit (ou flag ACC_SYNCHRONIZED); a JVM usa thin locks no mark word e infla para monitores pesados sob contenção, e wait/notify implementam condições. _(~75 min)_

**Objetivos**
- Usar synchronized em métodos e blocos e escolher o objeto de lock.
- Explicar monitorenter/monitorexit e a reentrância do monitor.
- Explicar thin lock, inflação do monitor e o mark word.
- Usar wait/notify corretamente (laço while, condição, notifyAll).
- Explicar os perigos de sincronizar em objetos públicos, strings ou boxed values.

**Pré-requisitos**
- [req] 4.4.1 Java Memory Model — A semântica de memória do synchronized é definida pelo JMM.
- [rec] 4.3.6 Mutex — synchronized é a implementação de mutex embutida na linguagem.
- [rec] 4.1.2 Bytecode — monitorenter e monitorexit aparecem no bytecode.

**Desafios planejados**
- N1 · Conceitual — Explicar como synchronized garante exclusão mútua e visibilidade
- N2 · Experimento — Comparar no javap um método synchronized e um bloco synchronized
- N2 · Programação — Corrigir um contador com race condition usando synchronized
- N3 · Identificação de bugs — Encontrar o bug de sincronização em um Integer que é reatribuído
- N3 · Identificação de bugs — Corrigir um consumidor que usa if em vez de while ao redor de wait()
- N4 · Implementação — Implementar uma BlockingQueue limitada com synchronized, wait e notifyAll

**Critérios de conclusão**
- [ ] Corrige uma race condition com synchronized e comprova com testes.
- [ ] Mostra no javap as instruções monitorenter/monitorexit.
- [ ] Implementa uma fila bloqueante com wait/notifyAll.
- [ ] Explica por que wait deve estar dentro de while.

#### 4.4.3 volatile

volatile garante visibilidade e ordenação: toda escrita volatile happens-before as leituras subsequentes da mesma variável, e o compilador insere barreiras que impedem reordenações em torno dela. Não garante atomicidade de operações compostas, então serve para flags, publicação de referências imutáveis e double-checked locking, mas não para contadores. _(~45 min)_

**Objetivos**
- Explicar as garantias de visibilidade e ordenação do volatile.
- Explicar por que volatile não torna count++ atômico.
- Identificar casos de uso corretos: flags de parada, publicação de estado imutável, DCL.
- Explicar o custo do volatile em termos de barreiras de memória.

**Pré-requisitos**
- [req] 4.4.1 Java Memory Model — volatile só faz sentido à luz das regras de happens-before.
- [rec] 4.3.10 Visibility — volatile resolve o problema de visibilidade.

**Desafios planejados**
- N1 · Conceitual — Explicar o que volatile garante e o que não garante
- N2 · Programação — Corrigir com volatile uma flag de parada que nunca era vista pela thread trabalhadora
- N2 · Experimento — Demonstrar que volatile int com count++ ainda perde atualizações
- N3 · Análise de código — Decidir entre volatile, synchronized e Atomic para cinco trechos de código
- N4 · Implementação — Implementar recarga de configuração publicando um objeto imutável via referência volatile

**Critérios de conclusão**
- [ ] Corrige um loop sem visibilidade com volatile.
- [ ] Demonstra que volatile não corrige count++.
- [ ] Escolhe corretamente entre volatile e synchronized em cenários dados.

#### 4.4.4 Atomic Types

As classes de java.util.concurrent.atomic (AtomicInteger, AtomicLong, AtomicReference) oferecem operações atômicas lock-free baseadas em CAS do hardware, com semântica de memória de volatile. Sob alta contenção os retries de CAS degradam o desempenho, e LongAdder distribui o contador em células para escalar melhor. _(~60 min)_

**Objetivos**
- Usar AtomicInteger, AtomicLong e AtomicReference com incrementAndGet, compareAndSet e updateAndGet.
- Explicar como CAS é implementado (lock cmpxchg) e o loop de retry.
- Comparar AtomicLong e LongAdder sob contenção e explicar as células do LongAdder.
- Explicar VarHandle como API de baixo nível para operações atômicas.
- Explicar o problema ABA e AtomicStampedReference.

**Pré-requisitos**
- [req] 4.3.9 Atomicity — Tipos atômicos implementam a atomicidade via CAS.
- [rec] 4.4.3 volatile — Atomic* tem a mesma semântica de visibilidade do volatile.

**Desafios planejados**
- N1 · Conceitual — Explicar como AtomicInteger garante atomicidade sem locks
- N2 · Programação — Implementar um gerador de IDs sequenciais thread-safe com AtomicLong
- N3 · Experimento — Comparar com JMH AtomicLong, LongAdder e synchronized com 1, 4 e 16 threads
- N3 · Identificação de bugs — Corrigir um código que usa get() e set() separados em um AtomicInteger
- N4 · Implementação — Implementar um rate limiter token bucket lock-free com AtomicReference

**Critérios de conclusão**
- [ ] Corrige um contador com AtomicInteger.
- [ ] Mede AtomicLong vs LongAdder com várias threads usando JMH.
- [ ] Implementa uma atualização complexa com compareAndSet ou updateAndGet.

#### 4.4.5 ReentrantLock

ReentrantLock é um lock explícito baseado no AbstractQueuedSynchronizer (AQS), que mantém estado via CAS e uma fila de threads estacionadas com LockSupport.park. Oferece o que synchronized não oferece: tryLock com timeout, aquisição interrompível, fairness opcional e múltiplas Conditions; em troca, exige unlock em finally. _(~60 min)_

**Objetivos**
- Usar lock/unlock com try/finally, tryLock com timeout e lockInterruptibly.
- Explicar como o AQS implementa a fila de espera e o estado do lock.
- Usar Condition para múltiplas filas de espera.
- Comparar ReentrantLock e synchronized em recursos e desempenho.
- Conhecer ReentrantReadWriteLock e StampedLock (leitura otimista).

**Pré-requisitos**
- [req] 4.4.2 synchronized — ReentrantLock é a alternativa explícita ao synchronized.
- [rec] 4.3.7 Lock — Fairness, reentrância e read-write locks foram vistos conceitualmente.

**Desafios planejados**
- N1 · Conceitual — Comparar ReentrantLock e synchronized
- N2 · Programação — Evitar deadlock na transferência entre contas usando tryLock com timeout
- N3 · Implementação — Implementar uma fila limitada com ReentrantLock e as Conditions notFull e notEmpty
- N3 · Análise de código — Ler o código do AQS e explicar como uma thread é enfileirada e estacionada
- N4 · Experimento — Comparar ReentrantReadWriteLock e StampedLock em um cache com 95% de leituras

**Critérios de conclusão**
- [ ] Usa ReentrantLock com unlock em finally e tryLock com timeout.
- [ ] Implementa uma fila limitada com duas Conditions.
- [ ] Justifica quando escolher ReentrantLock em vez de synchronized.

#### 4.4.6 Concurrent Collections

As coleções concorrentes do java.util.concurrent oferecem thread safety com melhor escalabilidade que Collections.synchronized*: ConcurrentHashMap (CAS em buckets vazios e lock por bin, resize cooperativo, operações atômicas compute/merge), CopyOnWriteArrayList e as filas bloqueantes usadas por thread pools. Iteradores são fracamente consistentes em vez de fail-fast. _(~75 min)_

**Objetivos**
- Explicar a implementação do ConcurrentHashMap no Java 8+ (CAS, lock por bin, treeification).
- Usar operações atômicas compostas (computeIfAbsent, merge) em vez de check-then-act.
- Diferenciar iteradores fail-fast e weakly consistent.
- Escolher entre ArrayBlockingQueue, LinkedBlockingQueue, SynchronousQueue e ConcurrentLinkedQueue.
- Explicar quando CopyOnWriteArrayList é adequado e seu custo de escrita.

**Pré-requisitos**
- [req] 2.4.2 HashMap — ConcurrentHashMap é uma variação concorrente da estrutura do HashMap.
- [rec] 4.4.4 Atomic Types — A implementação usa CAS extensivamente.
- [rec] 4.3.5 Thread Safety — Delegar thread safety a coleções concorrentes é uma estratégia de thread safety.

**Desafios planejados**
- N1 · Conceitual — Explicar como o ConcurrentHashMap obtém concorrência sem lock global
- N2 · Identificação de bugs — Corrigir uma contagem de palavras com get + put em ConcurrentHashMap usando merge
- N2 · Identificação de bugs — Diagnosticar ConcurrentModificationException ao alterar um ArrayList durante iteração
- N3 · Experimento — Comparar com JMH Collections.synchronizedMap e ConcurrentHashMap com várias threads
- N3 · Entrevista — Explicar por que ConcurrentHashMap não aceita chaves e valores null
- N4 · Implementação — Implementar um cache memoizado thread-safe com computeIfAbsent evitando cálculo duplicado

**Critérios de conclusão**
- [ ] Explica como o ConcurrentHashMap evita um lock global.
- [ ] Substitui check-then-act por computeIfAbsent ou merge.
- [ ] Escolhe a fila bloqueante adequada para um cenário.

#### 4.4.7 Thread Pools

Thread pools reaproveitam um conjunto fixo de threads para executar tarefas de uma fila, evitando o custo de criar threads e limitando a concorrência. O ThreadPoolExecutor cria threads até corePoolSize, depois enfileira, só cresce até maxPoolSize quando a fila enche e então aplica a RejectedExecutionHandler — e filas ilimitadas escondem sobrecarga. _(~75 min)_

**Objetivos**
- Explicar os parâmetros do ThreadPoolExecutor e a ordem real de decisão (core → fila → max → rejeição).
- Dimensionar pools para workloads CPU-bound e I/O-bound (fórmula de Goetz).
- Explicar os riscos das fábricas Executors (fila ilimitada, threads ilimitadas).
- Escolher políticas de rejeição (Abort, CallerRuns, Discard) como mecanismo de backpressure.
- Explicar thread starvation deadlock em pools com tarefas dependentes.

**Pré-requisitos**
- [req] 4.3.2 Concurrency vs Parallelism — O dimensionamento depende de distinguir CPU-bound de I/O-bound.
- [rec] 4.4.6 Concurrent Collections — O pool usa uma BlockingQueue como fila de tarefas.
- [rec] 3.4.11 Connection Pool — Connection pools seguem a mesma lógica de reaproveitar recursos caros.

**Desafios planejados**
- N1 · Conceitual — Explicar a ordem de decisão do ThreadPoolExecutor entre core, fila e max
- N2 · Experimento — Prever e comprovar quantas threads um pool core=2, max=10 com fila ilimitada cria
- N3 · Identificação de bugs — Diagnosticar OutOfMemoryError causado por Executors.newFixedThreadPool com fila ilimitada
- N3 · Identificação de bugs — Reproduzir thread starvation deadlock com tarefas que esperam subtarefas no mesmo pool
- N4 · Projeto — Configurar e instrumentar um pool para um workload I/O-bound e medir throughput e latência

**Critérios de conclusão**
- [ ] Explica a ordem de decisão do ThreadPoolExecutor.
- [ ] Configura um pool com fila limitada e política de rejeição justificadas.
- [ ] Reproduz e explica thread starvation deadlock.

#### 4.4.8 ExecutorService

ExecutorService é a abstração que separa submissão de tarefas da sua execução, com submit, invokeAll, invokeAny e ciclo de vida (shutdown, shutdownNow, awaitTermination). Exceções em tarefas submetidas ficam capturadas no Future e somem silenciosamente se ninguém o consultar, e o encerramento correto exige tratar interrupção. _(~60 min)_

**Objetivos**
- Usar execute, submit, invokeAll e invokeAny e entender as diferenças.
- Implementar encerramento gracioso com shutdown, awaitTermination e shutdownNow.
- Explicar por que exceções de tarefas submetidas podem ser perdidas.
- Tratar InterruptedException corretamente (restaurar a flag de interrupção).
- Usar ScheduledExecutorService e entender fixedRate vs fixedDelay.

**Pré-requisitos**
- [req] 4.4.7 Thread Pools — ExecutorService é a interface implementada pelos thread pools.

**Desafios planejados**
- N1 · Conceitual — Explicar o ciclo de vida de um ExecutorService
- N2 · Programação — Implementar shutdown gracioso com awaitTermination e fallback para shutdownNow
- N3 · Identificação de bugs — Descobrir por que exceções de tarefas submetidas com submit nunca aparecem no log
- N3 · Identificação de bugs — Corrigir uma tarefa que engole InterruptedException e impede o encerramento do pool
- N4 · Implementação — Implementar um agendador de jobs com ScheduledExecutorService, retry e métricas

**Critérios de conclusão**
- [ ] Implementa shutdown gracioso com timeout.
- [ ] Demonstra a diferença de tratamento de exceção entre execute e submit.
- [ ] Trata InterruptedException sem engolir a interrupção.

#### 4.4.9 Future

Future representa o resultado de uma computação assíncrona, consultado com get() (bloqueante, com ou sem timeout), isDone() e cancel(). Sua limitação é não permitir composição nem callbacks: obter o resultado bloqueia a thread chamadora, o que motivou o CompletableFuture. _(~45 min)_

**Objetivos**
- Usar Callable e Future para obter resultados de tarefas assíncronas.
- Usar get com timeout e tratar ExecutionException e TimeoutException.
- Explicar a semântica de cancel(true) e sua dependência de interrupção.
- Explicar as limitações do Future (bloqueio, ausência de composição).

**Pré-requisitos**
- [req] 4.4.8 ExecutorService — Future é retornado por ExecutorService.submit.

**Desafios planejados**
- N1 · Conceitual — Explicar o que um Future representa e suas limitações
- N2 · Programação — Consultar três serviços simulados em paralelo e agregar os resultados com Future
- N3 · Experimento — Demonstrar que cancel(true) não interrompe uma tarefa que ignora interrupção
- N3 · Identificação de bugs — Corrigir um código que chama get() sem timeout e trava sob falha de dependência
- N4 · Implementação — Implementar um FutureTask simplificado com wait/notify

**Critérios de conclusão**
- [ ] Executa tarefas em paralelo e agrega resultados com Future.
- [ ] Trata timeout e cancela tarefas corretamente.
- [ ] Explica por que Future não permite composição não bloqueante.

#### 4.4.10 CompletableFuture

CompletableFuture permite compor computações assíncronas de forma declarativa (thenApply, thenCompose, thenCombine, allOf, anyOf), tratar erros (exceptionally, handle) e aplicar timeouts (orTimeout). Por padrão usa o ForkJoinPool.commonPool, inadequado para I/O bloqueante; a escolha do executor e de onde cada estágio roda é decisiva. _(~75 min)_

**Objetivos**
- Compor etapas com thenApply, thenCompose e thenCombine e explicar a diferença.
- Combinar múltiplas chamadas com allOf/anyOf.
- Tratar erros com exceptionally, handle e whenComplete.
- Explicar em qual thread cada estágio executa e os riscos do commonPool para I/O.
- Aplicar timeouts com orTimeout e completeOnTimeout.

**Pré-requisitos**
- [req] 4.4.9 Future — CompletableFuture estende Future com composição e callbacks.
- [rec] 4.4.7 Thread Pools — A escolha do executor define onde os estágios rodam.

**Desafios planejados**
- N1 · Conceitual — Diferenciar thenApply, thenCompose e thenCombine
- N2 · Programação — Agregar dados de três serviços com allOf e timeout por chamada
- N3 · Identificação de bugs — Diagnosticar a saturação do commonPool causada por chamadas bloqueantes
- N3 · Análise de código — Determinar em qual thread cada estágio de uma cadeia de CompletableFuture executa
- N4 · Projeto — Construir um agregador de APIs com fallback, timeout, executor dedicado e métricas

**Critérios de conclusão**
- [ ] Compõe chamadas assíncronas dependentes e independentes corretamente.
- [ ] Trata erros e timeouts sem bloquear threads.
- [ ] Explica por que I/O bloqueante não deve rodar no commonPool.

#### 4.4.11 Virtual Threads

Virtual threads (Java 21, JEP 444) são threads leves gerenciadas pela JVM: são montadas em carrier threads de um ForkJoinPool e, ao bloquear em I/O, têm a stack salva na heap e são desmontadas, liberando a carrier. Isso torna viável uma thread por tarefa com milhões de threads, mas não acelera trabalho CPU-bound, e pinning (synchronized até o Java 23, código nativo) impede a desmontagem. _(~90 min)_

**Objetivos**
- Explicar como virtual threads são montadas e desmontadas em carrier threads (continuations).
- Explicar por que virtual threads ajudam em workloads I/O-bound e não em CPU-bound.
- Explicar pinning, suas causas e como detectá-lo (-Djdk.tracePinnedThreads, JFR jdk.VirtualThreadPinned) e a mudança do JEP 491 no Java 24.
- Explicar por que não se faz pool de virtual threads e como limitar concorrência (Semaphore).
- Explicar os riscos de ThreadLocal com milhões de threads e o papel de Scoped Values.
- Habilitar virtual threads no Spring Boot e avaliar o efeito no pool de conexões do banco.

**Pré-requisitos**
- [req] 4.4.7 Thread Pools — Virtual threads mudam o modelo de thread pools e thread-per-request.
- [rec] 4.4.2 synchronized — synchronized é a causa clássica de pinning.
- [rec] 1.2.5 Context Switch — Virtual threads evitam context switches do SO ao trocar de tarefa.
- [rec] 1.2.9 I/O — O ganho vem de liberar a carrier durante I/O bloqueante.

**Desafios planejados**
- N1 · Conceitual — Explicar como virtual threads são montadas em carrier threads
- N1 · Entrevista — Explicar quando virtual threads não trazem ganho
- N2 · Experimento — Criar 1 milhão de virtual threads com sleep e comparar memória e tempo com threads de plataforma
- N3 · Experimento — Detectar pinning com JFR (jdk.VirtualThreadPinned) em código com synchronized e I/O
- N3 · Identificação de bugs — Diagnosticar esgotamento do pool de conexões após migrar um serviço para virtual threads
- N4 · Projeto — Migrar um serviço Spring Boot para virtual threads e comparar throughput e latência com o modelo de pool

**Critérios de conclusão**
- [ ] Explica montagem, desmontagem e carrier threads.
- [ ] Cria um milhão de virtual threads e compara com threads de plataforma.
- [ ] Detecta pinning com JFR ou jdk.tracePinnedThreads e corrige.
- [ ] Explica por que virtual threads não melhoram tarefas CPU-bound.

## 05 — Sistemas Distribuídos

*O que muda quando o sistema roda em várias máquinas: comunicação assíncrona com filas e Kafka, falhas parciais, retries e idempotência, consistência entre réplicas e transações que atravessam serviços (2PC, Outbox e Saga).*

### 5.1 Mensageria e Event-Driven Architecture (13 tópicos)

**[Adicional]** Comunicação assíncrona entre serviços: filas, Pub/Sub e arquitetura orientada a eventos, com Kafka como estudo de caso principal. Cobre o log particionado, offsets, consumer groups e rebalanceamento, garantias de ordenação e as semânticas de entrega (at-most-once, at-least-once e exactly-once), incluindo o que cada uma custa em latência, throughput e complexidade.

Objetivos do módulo:
- Decidir entre comunicação síncrona e assíncrona com base em acoplamento, latência e disponibilidade
- Diferenciar Message Queue, Pub/Sub e event streaming e escolher o modelo adequado a um caso real
- Explicar o funcionamento interno do Kafka: log particionado, réplicas, ISR, acks e retenção
- Operar consumer groups entendendo atribuição de partições, rebalanceamento e commit de offsets
- Garantir ordenação onde ela é necessária por meio da escolha da chave de partição
- Escolher e implementar a semântica de entrega correta (at-most-once, at-least-once, exactly-once) e justificar o custo

#### 5.1.1 Synchronous vs Asynchronous

Na comunicação síncrona o chamador bloqueia esperando a resposta e herda a disponibilidade e a latência do chamado; na assíncrona, um intermediário (fila ou log) desacopla produtor e consumidor no tempo, ao custo de consistência eventual e maior complexidade operacional. _(~60 min)_

**Objetivos**
- Explicar acoplamento temporal e como ele afeta a disponibilidade composta de uma cadeia de chamadas síncronas
- Calcular a disponibilidade de uma cadeia de N serviços síncronos dado o SLA de cada um
- Distinguir I/O assíncrono dentro do processo (CompletableFuture, non-blocking) de comunicação assíncrona entre serviços
- Identificar quando o cliente precisa de resposta imediata e quando aceita processamento posterior (202 Accepted)
- Listar os custos da assincronia: depuração, ordenação, duplicatas e consistência eventual

**Pré-requisitos**
- [rec] 3.1.8 HTTP — A comunicação síncrona entre serviços normalmente é feita sobre HTTP
- [rec] 4.4.10 CompletableFuture — Ajuda a separar assincronia no processo de assincronia entre serviços

**Desafios planejados**
- N1 · Conceitual — Explicar acoplamento temporal e calcular a disponibilidade de uma cadeia de 4 serviços síncronos a 99,9%
- N2 · Análise de código — Classificar as chamadas de um fluxo de pedido em Java entre síncronas necessárias e candidatas a assíncronas
- N2 · Entrevista — Entrevista: quando você NÃO usaria comunicação assíncrona entre serviços?
- N3 · Experimento — Medir em Java o impacto de uma dependência lenta numa chamada HTTP síncrona versus envio para fila
- N4 · Implementação — Converter um endpoint síncrono em 202 Accepted com processamento em fila e endpoint de status

**Critérios de conclusão**
- [ ] Calculo a disponibilidade efetiva de uma cadeia síncrona e explico por que ela cai com cada dependência
- [ ] Justifico, para um fluxo de checkout, quais etapas devem ser síncronas e quais assíncronas
- [ ] Explico por que CompletableFuture não elimina o acoplamento temporal entre serviços
- [ ] Descrevo como o cliente acompanha o resultado de uma operação assíncrona (polling, webhook, eventos)

#### 5.1.2 Message Queue

Uma Message Queue entrega cada mensagem a um único consumidor dentre os concorrentes (competing consumers), com confirmação (ack), redelivery e dead-letter queue; após o ack a mensagem é removida, o que a diferencia de um log replayable. _(~75 min)_

**Objetivos**
- Descrever o ciclo de vida de uma mensagem: publish, entrega, ack/nack, redelivery e DLQ
- Explicar o padrão competing consumers e seu efeito na ordenação
- Configurar visibility timeout/prefetch e explicar seu impacto em duplicatas e throughput
- Projetar uma estratégia de DLQ com limite de tentativas e reprocessamento
- Comparar brokers de fila (RabbitMQ, SQS) com um log distribuído (Kafka)

**Pré-requisitos**
- [rec] 2.1.8 Queue — O comportamento FIFO da estrutura Queue é a base do modelo
- [rec] 5.1.1 Synchronous vs Asynchronous — Filas são o principal mecanismo de comunicação assíncrona

**Desafios planejados**
- N1 · Conceitual — Descrever o ciclo publish → deliver → ack/nack → redelivery → DLQ
- N2 · Programação — Implementar em Java uma fila em memória com competing consumers, ack manual e redelivery por timeout
- N2 · Identificação de bugs — Encontrar o bug: consumidor que dá ack antes de processar e perde mensagens em crash
- N3 · Experimento — Subir RabbitMQ local e observar redelivery e DLQ ao rejeitar mensagens com prefetch variado
- N4 · Implementação — Construir um worker de envio de e-mails com retries limitados, DLQ e ferramenta de reprocessamento

**Critérios de conclusão**
- [ ] Explico o que acontece com uma mensagem quando o consumidor morre antes de dar ack
- [ ] Justifico o valor de max-retries antes de mover para a DLQ em um caso concreto
- [ ] Explico por que competing consumers quebram a ordem global
- [ ] Diferencio fila (mensagem removida após ack) de log (mensagem retida e relida por offset)

#### 5.1.3 Pub/Sub

No Pub/Sub o publicador envia para um tópico e cada assinatura recebe sua própria cópia, desacoplando produtor de quantos e quais consumidores existem; o fan-out custa armazenamento, controle de assinantes lentos e ausência de resposta ao publicador. _(~60 min)_

**Objetivos**
- Diferenciar Pub/Sub de point-to-point em termos de entrega e acoplamento
- Explicar fan-out e o problema de assinantes lentos (backpressure, retenção)
- Diferenciar assinaturas duráveis de efêmeras e o impacto em perda de mensagens
- Combinar Pub/Sub com filas por assinante (ex.: SNS → SQS, exchange fanout no RabbitMQ)
- Avaliar filtragem de mensagens no broker versus no consumidor

**Pré-requisitos**
- [rec] 5.1.2 Message Queue — Pub/Sub é contrastado com o modelo point-to-point de filas

**Desafios planejados**
- N1 · Conceitual — Comparar point-to-point e Pub/Sub para o evento PedidoCriado consumido por 3 serviços
- N2 · Programação — Implementar um event bus Pub/Sub em memória em Java com assinantes síncronos e assíncronos
- N2 · Entrevista — Entrevista: como lidar com um assinante lento que atrasa os demais?
- N3 · Experimento — Configurar exchange fanout no RabbitMQ e comparar filas duráveis e exclusivas após reinício do consumidor
- N4 · Implementação — Construir notificações multicanal (e-mail, SMS, push) via Pub/Sub com filas independentes por canal

**Critérios de conclusão**
- [ ] Explico por que o publicador não deve conhecer seus assinantes
- [ ] Descrevo o que acontece com um assinante não durável desconectado durante a publicação
- [ ] Desenho uma topologia fan-out com uma fila por serviço consumidor e justifico
- [ ] Explico como Kafka implementa Pub/Sub com múltiplos consumer groups

#### 5.1.4 Event-Driven Architecture

Event-Driven Architecture organiza o sistema em torno de fatos ocorridos (eventos) publicados por quem detém o dado, permitindo que outros serviços reajam sem acoplamento direto; exige cuidado com contrato de eventos, versionamento, consistência eventual e rastreabilidade. _(~90 min)_

**Objetivos**
- Diferenciar evento, comando e query e as implicações de cada um
- Comparar event notification, event-carried state transfer e event sourcing
- Projetar o schema de um evento com id, tipo, versão, timestamp e correlation id
- Versionar eventos de forma compatível (backward/forward compatibility, schema registry)
- Rastrear um fluxo assíncrono ponta a ponta com propagação de contexto de tracing

**Pré-requisitos**
- [rec] 5.1.3 Pub/Sub — EDA usa Pub/Sub como mecanismo de distribuição de eventos
- [rec] 3.3.3 Tracing — Fluxos assíncronos exigem tracing distribuído para depuração

**Desafios planejados**
- N1 · Conceitual — Classificar 10 mensagens de um e-commerce como evento, comando ou query
- N2 · Análise de código — Avaliar um record Java de evento e apontar campos ausentes para versionamento e rastreabilidade
- N3 · Identificação de bugs — Identificar a quebra de compatibilidade ao renomear um campo de evento consumido por outro serviço
- N3 · Entrevista — Entrevista: event notification ou event-carried state transfer para sincronizar dados de cliente?
- N4 · Projeto — Modelar e implementar o fluxo de pedido orientado a eventos (Pedido, Pagamento, Estoque) com correlation id

**Critérios de conclusão**
- [ ] Classifico mensagens de um domínio como eventos ou comandos e justifico
- [ ] Escrevo um schema de evento versionado e explico que mudanças são compatíveis
- [ ] Explico os trade-offs entre notification e event-carried state transfer
- [ ] Descrevo como propagar traceId por headers de mensagens

#### 5.1.5 Kafka

Kafka é um log distribuído, particionado e replicado: produtores fazem append em partições, brokers persistem segmentos em disco com escrita sequencial e page cache, e consumidores leem por offset em modelo pull, o que permite retenção longa e replay. _(~150 min)_

**Objetivos**
- Descrever a arquitetura do Kafka: brokers, tópicos, partições, réplicas, líder, ISR e controller (KRaft)
- Explicar por que escrita sequencial, page cache, batching e zero-copy dão alto throughput
- Configurar acks (0, 1, all) e min.insync.replicas e explicar o trade-off durabilidade vs latência
- Explicar retenção por tempo/tamanho e log compaction
- Produzir e consumir mensagens com o client Java oficial

**Pré-requisitos**
- [rec] 5.1.3 Pub/Sub — Kafka implementa Pub/Sub sobre um log
- [rec] 1.2.9 I/O — O desempenho do Kafka depende de I/O sequencial e page cache
- [rec] 3.2.12 Replication — Kafka replica partições entre brokers no modelo líder-seguidor

**Desafios planejados**
- N1 · Conceitual — Explicar líder, réplicas, ISR e high watermark de uma partição
- N2 · Programação — Escrever producer e consumer Java com KafkaProducer/KafkaConsumer e serialização JSON
- N3 · Experimento — Derrubar um broker com acks=1 e acks=all e verificar perda de mensagens
- N3 · Experimento — Medir o throughput do producer variando batch.size, linger.ms e compression.type
- N3 · Entrevista — Entrevista: por que o Kafka é rápido mesmo persistindo tudo em disco?
- N4 · Implementação — Usar um tópico compactado como tabela de estado atual de preços e reconstruí-la em memória

**Critérios de conclusão**
- [ ] Explico o caminho de uma mensagem do producer até ser considerada committed com acks=all
- [ ] Explico o que acontece quando uma réplica sai do ISR e como min.insync.replicas reage
- [ ] Diferencio retenção por tempo de log compaction e dou um caso de uso de cada
- [ ] Subo um cluster local, produzo e consumo mensagens em Java

#### 5.1.6 Topics

Um tópico no Kafka é um nome lógico para um conjunto de partições; sua configuração (número de partições, replication factor, retenção, cleanup.policy) define paralelismo, durabilidade e custo de armazenamento. _(~60 min)_

**Objetivos**
- Criar e configurar tópicos com kafka-topics e AdminClient em Java
- Escolher replication factor e min.insync.replicas para tolerar falhas de broker
- Definir cleanup.policy (delete, compact) e retention de acordo com o caso de uso
- Aplicar convenções de nomes e granularidade de tópicos (por entidade, por evento)
- Explicar o custo de muitos tópicos/partições no cluster

**Pré-requisitos**
- [req] 5.1.5 Kafka — Tópicos são um conceito interno do Kafka

**Desafios planejados**
- N1 · Conceitual — Explicar a relação entre tópico, partição, segmento e réplica
- N2 · Programação — Criar e descrever tópicos via AdminClient em Java com configurações customizadas
- N2 · Entrevista — Entrevista: um tópico por tipo de evento ou um tópico por agregado?
- N3 · Experimento — Alterar retention.ms de um tópico e observar a remoção de segmentos no disco
- N4 · Implementação — Escrever um provisionador de tópicos idempotente em Java a partir de um arquivo de configuração

**Critérios de conclusão**
- [ ] Crio um tópico com configurações explícitas via AdminClient
- [ ] Justifico replication factor 3 com min.insync.replicas 2
- [ ] Decido entre um tópico por tipo de evento e um tópico por entidade em um cenário
- [ ] Explico quando usar compact em vez de delete

#### 5.1.7 Partitions

Partições são a unidade de paralelismo, ordenação e replicação do Kafka: a chave da mensagem determina a partição via hash, cada partição é consumida por no máximo um consumidor do grupo, e aumentar partições depois altera o mapeamento chave→partição. _(~75 min)_

**Objetivos**
- Explicar o particionador padrão (murmur2 da chave, sticky partitioner sem chave)
- Dimensionar o número de partições com base em throughput alvo e número de consumidores
- Identificar hot partitions causadas por chaves desbalanceadas
- Explicar o efeito de aumentar partições na ordenação por chave
- Implementar um Partitioner customizado em Java

**Pré-requisitos**
- [rec] 5.1.6 Topics — Partições compõem a configuração de um tópico

**Desafios planejados**
- N1 · Conceitual — Explicar como a chave define a partição e o papel do sticky partitioner
- N2 · Programação — Implementar um Partitioner Java que isola clientes VIP em partições dedicadas
- N3 · Experimento — Produzir com chaves enviesadas e medir a distribuição e o lag por partição
- N3 · Identificação de bugs — Diagnosticar a perda de ordem por conta após aumento de partições de um tópico
- N3 · Entrevista — Entrevista: como você escolheria o número de partições para 50 mil msgs/s?
- N4 · Implementação — Construir ferramenta Java que analisa a distribuição de chaves e recomenda número de partições e chave composta

**Critérios de conclusão**
- [ ] Calculo quantas partições são necessárias para um throughput dado
- [ ] Explico por que adicionar partições quebra a garantia de ordem por chave existente
- [ ] Diagnostico uma hot partition a partir de métricas de lag por partição
- [ ] Explico por que mais consumidores que partições não aumentam o paralelismo

#### 5.1.8 Offsets

O offset é a posição sequencial de cada mensagem numa partição; o consumidor controla o próprio progresso commitando offsets no tópico __consumer_offsets, e o momento do commit em relação ao processamento define perda ou duplicação. _(~75 min)_

**Objetivos**
- Explicar offset, committed offset, high watermark e consumer lag
- Comparar enable.auto.commit com commitSync/commitAsync manual
- Relacionar o momento do commit com perda (commit antes) ou duplicação (commit depois)
- Usar auto.offset.reset e seek para replay e recuperação
- Monitorar consumer lag como indicador de saúde

**Pré-requisitos**
- [rec] 5.1.7 Partitions — Offsets são definidos por partição

**Desafios planejados**
- N1 · Conceitual — Diferenciar offset atual, committed offset, high watermark e lag
- N2 · Programação — Implementar consumer Java com enable.auto.commit=false e commit por lote após processamento
- N2 · Identificação de bugs — Encontrar a causa de mensagens perdidas em um consumer com auto commit e processamento assíncrono
- N3 · Experimento — Reprocessar eventos de ontem usando offsetsForTimes e seek
- N4 · Implementação — Construir um monitor de consumer lag em Java com AdminClient e alerta por limite

**Critérios de conclusão**
- [ ] Explico o que acontece com auto commit se o consumidor cair após poll e antes de processar
- [ ] Implemento commit manual após processamento com commitSync
- [ ] Faço replay de uma partição a partir de um timestamp com offsetsForTimes e seek
- [ ] Calculo e interpreto o consumer lag de um grupo

#### 5.1.9 Consumer Groups

Consumer groups distribuem as partições de um tópico entre instâncias para escalar o consumo; o group coordinator detecta entradas e saídas via heartbeats e max.poll.interval.ms e dispara rebalanceamento, que pode pausar o consumo e gerar duplicatas. _(~120 min)_

**Objetivos**
- Explicar o papel do group coordinator e do líder do grupo na atribuição de partições
- Comparar estratégias de atribuição: range, round-robin, sticky e cooperative-sticky
- Explicar as causas de rebalanceamento: session.timeout.ms, heartbeat e max.poll.interval.ms
- Usar ConsumerRebalanceListener para commitar offsets antes da revogação
- Reduzir o impacto de rebalances com static membership e rebalanceamento incremental

**Pré-requisitos**
- [req] 5.1.8 Offsets — Rebalanceamento só é compreensível entendendo commit de offsets
- [rec] 4.4.7 Thread Pools — Processamento paralelo dentro do consumidor costuma usar thread pools

**Desafios planejados**
- N1 · Conceitual — Explicar como partições são redistribuídas quando um consumidor entra ou sai do grupo
- N2 · Experimento — Subir Kafka local e observar rebalanceamento ao adicionar e remover consumidores
- N3 · Identificação de bugs — Diagnosticar rebalances em loop causados por processamento acima de max.poll.interval.ms
- N3 · Programação — Implementar ConsumerRebalanceListener que commita offsets processados antes da revogação
- N3 · Entrevista — Entrevista: diferença entre eager e cooperative-sticky rebalancing e quando importa
- N4 · Implementação — Construir um consumidor Java com pool de workers por partição preservando ordem e commit seguro

**Critérios de conclusão**
- [ ] Explico por que um processamento lento dentro do poll causa rebalance
- [ ] Implemento ConsumerRebalanceListener commitando offsets em onPartitionsRevoked
- [ ] Comparo stop-the-world (eager) com cooperative rebalancing
- [ ] Explico como dois consumer groups leem o mesmo tópico de forma independente

#### 5.1.10 Ordering

Kafka garante ordem apenas dentro de uma partição; ordem por entidade exige mesma chave, e retries do producer, processamento paralelo no consumidor e reprocessamento podem reordenar mensagens se não forem controlados. _(~75 min)_

**Objetivos**
- Explicar por que não há ordem global entre partições e quando isso é aceitável
- Escolher chaves de partição que preservem ordem por entidade
- Explicar como max.in.flight.requests e retries afetam a ordem e como o idempotent producer a preserva
- Tratar eventos fora de ordem no consumidor com versões ou números de sequência
- Avaliar o custo de ordem estrita no throughput

**Pré-requisitos**
- [rec] 5.1.9 Consumer Groups — Paralelismo de consumo afeta diretamente a ordenação

**Desafios planejados**
- N1 · Conceitual — Explicar o escopo da garantia de ordem no Kafka
- N2 · Análise de código — Analisar um producer Java e indicar quais configurações podem reordenar mensagens
- N3 · Identificação de bugs — Encontrar por que eventos SaldoAtualizado são aplicados fora de ordem num consumidor multithread
- N3 · Programação — Implementar no consumidor descarte de eventos desatualizados usando versão por agregado
- N4 · Experimento — Comparar throughput de um tópico com 1 partição (ordem global) e 12 partições (ordem por chave)

**Critérios de conclusão**
- [ ] Escolho a chave correta para garantir ordem dos eventos de uma conta
- [ ] Explico o cenário em que retry com in-flight > 1 inverte duas mensagens sem idempotência
- [ ] Implemento descarte de eventos antigos por número de versão no consumidor
- [ ] Justifico quando ordem global vale uma partição única

#### 5.1.11 At-most-once

At-most-once entrega cada mensagem zero ou uma vez: o progresso é registrado antes do processamento (ou não há retry), então falhas causam perda, mas nunca duplicação; é aceitável apenas quando a perda é tolerável. _(~45 min)_

**Objetivos**
- Definir at-most-once e identificar onde a perda pode ocorrer (producer e consumer)
- Configurar producer (acks=0, retries=0) e consumer (commit antes de processar) para at-most-once
- Identificar casos de uso adequados: métricas de alta frequência, telemetria, logs não críticos
- Explicar por que at-most-once tem menor latência e custo

**Pré-requisitos**
- [req] 5.1.8 Offsets — A semântica no consumidor depende do momento do commit de offsets

**Desafios planejados**
- N1 · Conceitual — Desenhar a linha do tempo de uma falha que perde uma mensagem em at-most-once
- N2 · Programação — Configurar um consumer Java que commita antes de processar e provocar perda por crash
- N2 · Entrevista — Entrevista: cite sistemas onde at-most-once é a escolha correta
- N3 · Experimento — Medir latência e perda de um producer com acks=0 sob falha de broker
- N4 · Implementação — Construir pipeline de telemetria at-most-once em Java com acks=0 e medir taxa de perda aceitável

**Critérios de conclusão**
- [ ] Descrevo exatamente em que ponto uma mensagem é perdida em at-most-once
- [ ] Configuro producer e consumer Java para at-most-once
- [ ] Justifico um caso de uso real em que a perda é aceitável

#### 5.1.12 At-least-once

At-least-once garante que nenhuma mensagem se perca, registrando progresso apenas após o processamento e usando retries, o que torna duplicatas inevitáveis; o consumidor precisa ser idempotente para que o efeito seja correto. _(~60 min)_

**Objetivos**
- Definir at-least-once e identificar as fontes de duplicação (retry do producer, crash antes do commit, rebalance)
- Configurar producer (acks=all, retries) e consumer (commit após processar) para at-least-once
- Implementar deduplicação no consumidor com chave de idempotência persistida
- Explicar por que at-least-once + idempotência é o padrão mais usado na indústria

**Pré-requisitos**
- [rec] 5.1.11 At-most-once — Contraste direto com a semântica anterior
- [rec] 3.5.11 Idempotência — Idempotência é o complemento necessário do at-least-once

**Desafios planejados**
- N1 · Conceitual — Listar e explicar as três origens de duplicatas em at-least-once
- N2 · Programação — Implementar consumer Java com commit pós-processamento e tabela de eventos processados
- N3 · Experimento — Provocar duplicatas matando o consumidor entre processamento e commit e medir o efeito
- N3 · Identificação de bugs — Encontrar o bug de cobrança duplicada em um consumidor at-least-once sem deduplicação
- N4 · Implementação — Construir consumidor de pagamentos que grava efeito e marca de processamento na mesma transação

**Critérios de conclusão**
- [ ] Descrevo três cenários distintos que geram duplicatas em at-least-once
- [ ] Implemento um consumidor que commita após processar e deduplica por eventId
- [ ] Explico por que deduplicar em memória não basta após restart ou rebalance

#### 5.1.13 Exactly-once

Exactly-once no Kafka combina idempotent producer (PID + sequence number por partição), transações que gravam mensagens e offsets atomicamente e consumidores com isolation.level=read_committed; vale para pipelines Kafka→Kafka, enquanto efeitos externos exigem idempotência no destino. _(~120 min)_

**Objetivos**
- Explicar como o idempotent producer elimina duplicatas de retry usando producer id e sequence numbers
- Explicar transações Kafka: transactional.id, transaction coordinator, markers e sendOffsetsToTransaction
- Configurar isolation.level=read_committed e explicar o last stable offset
- Delimitar o escopo do exactly-once e por que ele não se estende a bancos ou APIs externas
- Avaliar o custo de latência e throughput das transações

**Pré-requisitos**
- [req] 5.1.12 At-least-once — Exactly-once é construído sobre at-least-once com deduplicação
- [rec] 3.2.1 Transactions — Transações Kafka seguem a ideia de atomicidade de transações

**Desafios planejados**
- N1 · Conceitual — Explicar idempotent producer, transações e read_committed e o papel de cada um
- N2 · Programação — Implementar consume-transform-produce transacional em Java com sendOffsetsToTransaction
- N3 · Experimento — Abortar transações e comparar o que consumidores read_uncommitted e read_committed enxergam
- N3 · Entrevista — Entrevista: exactly-once existe de verdade em sistemas distribuídos?
- N4 · Análise de código — Revisar um pipeline que grava no PostgreSQL e no Kafka e propor como obter efeito exactly-once

**Critérios de conclusão**
- [ ] Explico o que o broker faz ao receber uma mensagem com sequence number repetido
- [ ] Implemento um pipeline consume-transform-produce transacional em Java
- [ ] Explico por que exactly-once 'efetivo' para um banco externo exige idempotência ou Outbox
- [ ] Explico o papel do transactional.id em fencing de producers zumbis

### 5.2 Falhas e confiabilidade (9 tópicos)

**[Adicional]** Em sistemas distribuídos, falhas são parciais e ambíguas: um nó lento é indistinguível de um nó morto. Este módulo trata dos mecanismos que tornam serviços resilientes — timeouts, retries com exponential backoff e jitter, idempotência sob entrega at-least-once, circuit breaker, rate limiting — e de como combiná-los em uma estratégia de fault tolerance sem amplificar falhas.

Objetivos do módulo:
- Reconhecer falhas parciais e a ambiguidade de resultado de uma chamada remota
- Configurar timeouts de conexão, leitura e deadlines de ponta a ponta de forma coerente
- Implementar retries seguros com exponential backoff e jitter, evitando retry storms e thundering herd
- Tornar operações idempotentes para suportar retries e entrega duplicada
- Aplicar circuit breaker e rate limiting entendendo seus estados, algoritmos e parâmetros
- Projetar fault tolerance combinando redundância, bulkheads, fallback e degradação graciosa

#### 5.2.1 Partial Failures

Falha parcial é quando parte do sistema falha enquanto o resto continua funcionando; como a rede não distingue lentidão, perda de pacote e crash, toda chamada remota tem resultado potencialmente desconhecido. _(~60 min)_

**Objetivos**
- Listar modos de falha: crash, omissão, lentidão, partição de rede e falhas bizantinas
- Explicar por que uma chamada sem resposta pode ter sido executada (resultado ambíguo)
- Explicar as falácias da computação distribuída e seu impacto em projeto
- Identificar falhas em cascata causadas por esgotamento de recursos (threads, conexões)
- Usar health checks e métricas para detectar degradação

**Pré-requisitos**
- [rec] 3.1.4 TCP — Entender TCP ajuda a ver por que perda de conexão não indica o estado do servidor
- [rec] 3.3.5 Health Checks — Health checks são o primeiro mecanismo de detecção de falhas

**Desafios planejados**
- N1 · Conceitual — Explicar por que um timeout não informa se a operação foi executada
- N2 · Análise de código — Analisar um serviço Spring que chama outro sem timeout e prever o comportamento sob lentidão
- N3 · Experimento — Simular latência e perda com Toxiproxy entre dois serviços Java e observar a cascata
- N3 · Entrevista — Entrevista: quais falácias da computação distribuída você já viu causar incidente?
- N4 · Projeto — Montar um laboratório de chaos com Docker e Toxiproxy para os próximos tópicos do módulo

**Critérios de conclusão**
- [ ] Explico os três desfechos possíveis de uma requisição que deu timeout
- [ ] Descrevo como uma dependência lenta esgota o thread pool de um serviço e causa cascata
- [ ] Classifico incidentes reais nos modos de falha estudados

#### 5.2.2 Timeout

Timeouts limitam quanto tempo um recurso fica preso esperando uma dependência; precisam ser definidos por camada (conexão, leitura, pool, requisição total) e coerentes com a cadeia de chamadas por meio de deadlines propagados. _(~60 min)_

**Objetivos**
- Diferenciar connect timeout, read/socket timeout, timeout de aquisição de pool e timeout total
- Definir valores de timeout a partir de percentis de latência (p99) e do orçamento do chamador
- Propagar deadlines por uma cadeia de serviços para evitar trabalho inútil
- Configurar timeouts em HttpClient, RestClient/WebClient, JDBC/Hikari e Kafka client
- Explicar o risco de timeouts infinitos (padrão de muitas bibliotecas)

**Pré-requisitos**
- [rec] 5.2.1 Partial Failures — Timeouts são a principal defesa contra falhas parciais por lentidão
- [rec] 3.1.11 Keep-Alive — Conexões persistentes e pools influenciam os tipos de timeout

**Desafios planejados**
- N1 · Conceitual — Diferenciar connect, read, pool acquisition e request timeout
- N2 · Programação — Configurar timeouts no HttpClient do Java e no HikariCP e testar com servidor lento
- N3 · Identificação de bugs — Encontrar o timeout ausente que trava todas as threads do Tomcat sob dependência lenta
- N3 · Experimento — Medir o impacto de timeouts muito curtos na taxa de erro com latência de cauda
- N4 · Implementação — Implementar propagação de deadline por header entre serviços Spring

**Critérios de conclusão**
- [ ] Configuro connect e read timeout distintos no java.net.http.HttpClient
- [ ] Justifico valores de timeout a partir do p99 da dependência
- [ ] Explico por que o timeout do serviço interno deve ser menor que o do chamador
- [ ] Identifico bibliotecas com timeout padrão infinito no meu projeto

#### 5.2.3 Retry

Retry repete uma operação que falhou por erro transitório; é seguro apenas para operações idempotentes e erros retentáveis, e precisa de limite de tentativas e orçamento para não amplificar carga em dependências já sobrecarregadas. _(~60 min)_

**Objetivos**
- Classificar erros em retentáveis (timeout, 503, conexão recusada) e não retentáveis (400, 409 de negócio)
- Explicar a amplificação de retries em cadeias de serviços (retry storm)
- Aplicar limite de tentativas e retry budget
- Decidir em qual camada fazer retry para evitar retries aninhados
- Implementar retry com Resilience4j ou Spring Retry

**Pré-requisitos**
- [rec] 5.2.2 Timeout — Retry normalmente é disparado por timeout
- [rec] 3.5.11 Idempotência — Só operações idempotentes podem ser repetidas com segurança

**Desafios planejados**
- N1 · Conceitual — Classificar 12 erros como retentáveis ou não e justificar
- N2 · Programação — Implementar um RetryExecutor genérico em Java com predicado de exceções retentáveis
- N3 · Identificação de bugs — Encontrar o retry que duplica pedidos ao repetir um POST não idempotente
- N3 · Entrevista — Entrevista: por que retries em todas as camadas podem derrubar o sistema?
- N4 · Implementação — Implementar retry budget (proporção máxima de retries por janela) em Java

**Critérios de conclusão**
- [ ] Classifico corretamente códigos HTTP e exceções como retentáveis ou não
- [ ] Calculo a amplificação de carga com 3 camadas fazendo 3 tentativas cada
- [ ] Configuro retry com Resilience4j limitado a exceções específicas

#### 5.2.4 Exponential Backoff

Exponential backoff aumenta a espera entre tentativas geometricamente (base × 2^n, com teto), dando tempo para a dependência se recuperar e reduzindo a carga gerada por clientes em falha. _(~45 min)_

**Objetivos**
- Calcular a sequência de esperas para base, multiplicador e teto dados
- Explicar por que intervalos fixos prolongam a sobrecarga
- Definir teto de espera e tempo máximo total compatíveis com o SLA do chamador
- Respeitar sinais do servidor como Retry-After e 429

**Pré-requisitos**
- [req] 5.2.3 Retry — Backoff é uma política de espera entre retries

**Desafios planejados**
- N1 · Conceitual — Calcular esperas e tempo total de backoff com base 100ms, fator 2 e teto 5s
- N2 · Programação — Implementar retry com exponential backoff e teto em Java respeitando Retry-After
- N3 · Experimento — Comparar backoff fixo e exponencial na recuperação de um servidor sobrecarregado simulado
- N3 · Análise de código — Avaliar uma configuração de backoff que excede o timeout do cliente HTTP chamador
- N4 · Implementação — Criar biblioteca Java de BackoffPolicy configurável com deadline total e testes determinísticos com Clock fake

**Critérios de conclusão**
- [ ] Calculo o tempo total gasto em 6 tentativas com backoff exponencial e teto
- [ ] Implemento backoff exponencial com teto em Java
- [ ] Explico como combinar backoff com o deadline da requisição original

#### 5.2.5 Jitter

Jitter adiciona aleatoriedade ao backoff para dessincronizar clientes que falharam ao mesmo tempo, evitando thundering herd — ondas sincronizadas de retries que voltam a sobrecarregar o servidor a cada intervalo. _(~45 min)_

**Objetivos**
- Explicar thundering herd e por que backoff exponencial sem jitter ainda sincroniza clientes
- Comparar full jitter, equal jitter e decorrelated jitter
- Implementar jitter usando ThreadLocalRandom
- Aplicar jitter também a tarefas agendadas, expiração de cache e reconexões

**Pré-requisitos**
- [req] 5.2.4 Exponential Backoff — Jitter é aplicado sobre o backoff exponencial

**Desafios planejados**
- N1 · Conceitual — Explicar thundering herd e por que jitter resolve onde o backoff sozinho falha
- N2 · Programação — Implementar retry com exponential backoff e full jitter em Java
- N3 · Experimento — Simular 1.000 clientes e plotar a carga por segundo sem jitter, com full e com decorrelated jitter
- N3 · Identificação de bugs — Diagnosticar picos periódicos de carga causados por TTL de cache idêntico em todas as chaves
- N2 · Entrevista — Entrevista: qual variante de jitter você escolheria e por quê?
- N4 · Implementação — Adicionar jitter configurável à BackoffPolicy e aos agendamentos de reconexão de um consumer Kafka

**Critérios de conclusão**
- [ ] Explico com um gráfico de requisições por segundo o efeito do jitter
- [ ] Implemento full jitter e decorrelated jitter em Java
- [ ] Identifico outros pontos do sistema sujeitos a thundering herd (TTL de cache, cron)

#### 5.2.6 Idempotência

Sob retries e entrega at-least-once, a mesma requisição ou mensagem chega mais de uma vez; idempotência garante que o efeito seja aplicado uma única vez, via idempotency keys, constraints únicas, operações naturalmente idempotentes e registro de processamento na mesma transação do efeito. _(~90 min)_

**Objetivos**
- Diferenciar operações naturalmente idempotentes (set) de não idempotentes (incremento, criação)
- Implementar idempotency key em API HTTP com armazenamento da resposta original
- Implementar deduplicação de mensagens com tabela de processadas e constraint única
- Tratar a condição de corrida de duas requisições duplicadas simultâneas
- Definir janela de retenção das chaves e seus custos

**Pré-requisitos**
- [rec] 3.5.11 Idempotência — Este tópico aprofunda a idempotência vista em APIs para o cenário de retries e at-least-once
- [rec] 5.2.3 Retry — Retries são a principal origem de requisições duplicadas
- [rec] 4.3.3 Race Condition — Duplicatas simultâneas criam race conditions na verificação de idempotência
- [rec] 4.2.16 @Transactional — Efeito e marca de processamento devem estar na mesma transação

**Desafios planejados**
- N1 · Conceitual — Classificar operações como naturalmente idempotentes ou não e propor como torná-las idempotentes
- N2 · Programação — Implementar filtro Spring de Idempotency-Key com cache da resposta no banco
- N3 · Identificação de bugs — Encontrar a race condition em check-then-insert de idempotência sob requisições paralelas
- N3 · Experimento — Reentregar mensagens Kafka duplicadas e verificar que o saldo final permanece correto
- N4 · Implementação — Construir consumidor idempotente de pagamentos com tabela processed_messages e constraint única

**Critérios de conclusão**
- [ ] Implemento idempotency key que devolve a mesma resposta para requisições repetidas
- [ ] Explico por que 'verificar e depois inserir' sem constraint única falha sob concorrência
- [ ] Gravo efeito e registro de mensagem processada na mesma transação
- [ ] Justifico por quanto tempo reter chaves de idempotência

#### 5.2.7 Circuit Breaker

Circuit breaker interrompe chamadas a uma dependência com alta taxa de falha, alternando entre Closed, Open e Half-Open, para falhar rápido, liberar recursos e dar tempo de recuperação à dependência. _(~75 min)_

**Objetivos**
- Descrever os estados Closed, Open e Half-Open e as transições entre eles
- Configurar janela deslizante (por contagem ou tempo), failure rate threshold e slow call threshold
- Definir fallback adequado por caso de uso
- Combinar circuit breaker com retry e timeout na ordem correta
- Usar Resilience4j e expor métricas de estado

**Pré-requisitos**
- [rec] 5.2.3 Retry — Circuit breaker complementa e limita retries
- [rec] 5.2.2 Timeout — Chamadas lentas que estouram timeout contam como falha

**Desafios planejados**
- N1 · Conceitual — Desenhar a máquina de estados Closed/Open/Half-Open com as condições de transição
- N2 · Programação — Implementar um circuit breaker thread-safe em Java com janela por contagem
- N3 · Experimento — Configurar Resilience4j num serviço Spring e observar as transições com Toxiproxy
- N3 · Análise de código — Analisar a ordem de decorators Retry, CircuitBreaker, TimeLimiter e Bulkhead e seus efeitos
- N3 · Entrevista — Entrevista: qual fallback é aceitável quando o serviço de preços está fora?
- N4 · Implementação — Construir cliente HTTP resiliente em Java com circuit breaker próprio, fallback e endpoint de métricas de estado

**Critérios de conclusão**
- [ ] Desenho a máquina de estados com condições de transição
- [ ] Implemento um circuit breaker simples em Java thread-safe
- [ ] Explico por que retry deve ficar dentro ou fora do circuit breaker
- [ ] Configuro Resilience4j com fallback e verifico transições nas métricas

#### 5.2.8 Rate Limiting

Rate limiting limita quantas requisições um cliente pode fazer por período para proteger recursos e garantir justiça; algoritmos como token bucket, leaky bucket, fixed window e sliding window diferem em tolerância a bursts, precisão e custo de memória, e a versão distribuída exige estado compartilhado. _(~90 min)_

**Objetivos**
- Comparar token bucket, leaky bucket, fixed window, sliding window log e sliding window counter
- Explicar o problema de borda da fixed window e como a sliding window resolve
- Implementar rate limiting distribuído com Redis e operações atômicas
- Responder corretamente com 429 e cabeçalhos de limite/Retry-After
- Diferenciar rate limiting (cliente) de load shedding (servidor)

**Pré-requisitos**
- [rec] 5.2.5 Jitter — Clientes limitados devem reagir com backoff e jitter
- [rec] 4.3.3 Race Condition — Contadores compartilhados exigem operações atômicas

**Desafios planejados**
- N1 · Conceitual — Comparar token bucket e sliding window em tolerância a burst, precisão e memória
- N2 · Programação — Implementar token bucket thread-safe em Java com refill preguiçoso
- N3 · Programação — Implementar sliding window counter e demonstrar a correção do problema de borda
- N3 · Identificação de bugs — Encontrar a race condition de um rate limiter distribuído com GET e SET separados no Redis
- N4 · Implementação — Construir rate limiter por cliente em filtro Spring com Redis, 429 e Retry-After

**Critérios de conclusão**
- [ ] Explico quando o token bucket permite burst e o leaky bucket não
- [ ] Implemento token bucket thread-safe em Java
- [ ] Mostro o problema de dupla taxa na borda da fixed window
- [ ] Descrevo como garantir atomicidade de um limitador distribuído no Redis

#### 5.2.9 Fault Tolerance

Fault tolerance é a capacidade de continuar operando aceitavelmente diante de falhas, combinando redundância, isolamento (bulkheads), detecção, failover, fallback, load shedding e degradação graciosa, sem que os próprios mecanismos amplifiquem o problema. _(~90 min)_

**Objetivos**
- Diferenciar alta disponibilidade, fault tolerance e resiliência
- Aplicar bulkhead com thread pools ou semáforos isolados por dependência
- Projetar degradação graciosa e load shedding para picos
- Combinar timeout, retry, circuit breaker, rate limiting e bulkhead em uma política coerente
- Validar a estratégia com testes de caos

**Pré-requisitos**
- [rec] 5.2.7 Circuit Breaker — Fault tolerance combina os mecanismos anteriores do módulo
- [rec] 5.2.8 Rate Limiting — Rate limiting e load shedding fazem parte da estratégia
- [rec] 4.4.7 Thread Pools — Bulkheads costumam ser implementados com thread pools isolados

**Desafios planejados**
- N1 · Conceitual — Explicar como bulkhead impede que uma dependência lenta derrube as demais
- N2 · Programação — Implementar bulkhead com thread pools separados por dependência em Java
- N3 · Entrevista — Entrevista: desenhe a estratégia de resiliência de um checkout com 5 dependências
- N3 · Experimento — Executar game day com Toxiproxy derrubando dependências e medir degradação graciosa
- N4 · Projeto — Construir serviço de catálogo resiliente combinando timeout, retry com jitter, circuit breaker, bulkhead e fallback em cache

**Critérios de conclusão**
- [ ] Proponho política de resiliência completa para uma dependência crítica e justifico cada parâmetro
- [ ] Implemento bulkhead isolando duas dependências e demonstro o isolamento
- [ ] Defino o comportamento degradado de cada funcionalidade quando dependências falham
- [ ] Executo um experimento de caos e documento o resultado

### 5.3 Consistência e transações distribuídas (10 tópicos)

**[Adicional]** Como manter dados coerentes quando eles vivem em várias máquinas ou em vários serviços. Cobre replicação e modelos de consistência (forte e eventual), quorums R+W>N, consenso em alto nível (Raft), e as alternativas para transações que atravessam serviços: 2PC e seus bloqueios, Transactional Outbox para publicar eventos de forma confiável e Saga com compensações, orquestrada ou coreografada.

Objetivos do módulo:
- Explicar replicação líder-seguidor, multi-líder e leaderless e o impacto de replication lag
- Diferenciar consistência forte (linearizability) e eventual e relacionar com o teorema CAP e PACELC
- Calcular configurações de quorum e explicar quando R+W>N garante leitura do último valor
- Descrever eleição de líder e replicação de log no Raft em alto nível
- Comparar 2PC, Transactional Outbox e Saga quanto a consistência, disponibilidade e acoplamento
- Implementar Outbox e Saga com compensações em Java, escolhendo entre orquestração e coreografia

#### 5.3.1 Replication

Replicação mantém cópias dos dados em vários nós para disponibilidade, tolerância a falhas e escala de leitura; o modelo (líder-seguidor, multi-líder, leaderless) e o modo (síncrono, assíncrono, semissíncrono) determinam quais garantias de consistência os clientes observam. _(~90 min)_

**Objetivos**
- Comparar replicação líder-seguidor, multi-líder e leaderless
- Explicar replicação síncrona, assíncrona e semissíncrona e o risco de perda no failover
- Identificar anomalias de replication lag: read-your-writes, monotonic reads, consistent prefix
- Explicar resolução de conflitos em multi-líder (last-write-wins, version vectors, CRDTs)
- Descrever failover e o risco de split-brain

**Pré-requisitos**
- [rec] 3.2.12 Replication — Este tópico aprofunda a replicação de banco vista antes para replicação entre nós e modelos de consistência
- [rec] 3.2.11 MVCC — MVCC e WAL ajudam a entender como mudanças são enviadas às réplicas

**Desafios planejados**
- N1 · Conceitual — Comparar líder-seguidor, multi-líder e leaderless quanto a conflitos e disponibilidade
- N2 · Experimento — Subir PostgreSQL primário + réplica com Docker e medir replication lag sob carga
- N3 · Identificação de bugs — Diagnosticar usuário que não vê o próprio comentário após salvar (leitura em réplica atrasada)
- N3 · Entrevista — Entrevista: o que pode dar errado no failover automático de um banco?
- N4 · Implementação — Implementar roteamento leitura/escrita em Spring com read-your-writes por sessão

**Critérios de conclusão**
- [ ] Explico a perda de escritas confirmadas no failover com replicação assíncrona
- [ ] Descrevo uma solução para read-your-writes com réplicas de leitura
- [ ] Comparo last-write-wins e version vectors na resolução de conflitos
- [ ] Explico como split-brain acontece e como fencing o previne

#### 5.3.2 Strong Consistency

Consistência forte (linearizability) faz o sistema se comportar como se houvesse uma única cópia: toda leitura vê a escrita mais recente confirmada; exige coordenação (líder único, quorum ou consenso), com custo de latência e indisponibilidade em partições de rede. _(~75 min)_

**Objetivos**
- Definir linearizability e diferenciá-la de serializability
- Explicar o teorema CAP corretamente (escolha durante partição) e o PACELC
- Identificar operações que exigem consistência forte: locks, unicidade, saldo
- Explicar o custo de latência da consistência forte entre regiões

**Pré-requisitos**
- [req] 5.3.1 Replication — Consistência é uma propriedade do sistema replicado
- [rec] 3.2.3 Isolation Levels — Isolation levels ajudam a diferenciar serializability de linearizability

**Desafios planejados**
- N1 · Conceitual — Diferenciar linearizability e serializability com um exemplo de histórico de operações
- N2 · Análise de código — Analisar históricos de leitura/escrita e decidir se são linearizáveis
- N3 · Entrevista — Entrevista: explique CAP e PACELC e classifique PostgreSQL, Cassandra e etcd
- N3 · Experimento — Medir a latência de escrita com replicação síncrona versus assíncrona no PostgreSQL
- N4 · Implementação — Implementar verificação de unicidade de e-mail linearizável usando constraint única e lock no líder

**Critérios de conclusão**
- [ ] Diferencio linearizability de serializability com exemplos
- [ ] Explico CAP sem o erro de 'escolha 2 de 3'
- [ ] Identifico num sistema quais operações precisam de consistência forte e justifico
- [ ] Estimo a latência mínima de uma escrita linearizável entre duas regiões

#### 5.3.3 Eventual Consistency

Consistência eventual garante apenas que, sem novas escritas, as réplicas convergem; permite alta disponibilidade e baixa latência, mas exige lidar com leituras desatualizadas, conflitos e garantias de sessão no nível da aplicação. _(~60 min)_

**Objetivos**
- Definir consistência eventual e a janela de inconsistência
- Explicar garantias intermediárias: read-your-writes, monotonic reads, causal consistency
- Projetar a UX e a lógica de negócio tolerantes a leituras desatualizadas
- Explicar mecanismos de convergência: anti-entropy, read repair, CRDTs

**Pré-requisitos**
- [rec] 5.3.2 Strong Consistency — Consistência eventual é entendida em contraste com a forte

**Desafios planejados**
- N1 · Conceitual — Explicar a janela de inconsistência e as garantias de sessão
- N2 · Programação — Implementar um G-Counter CRDT em Java e demonstrar convergência entre réplicas
- N3 · Entrevista — Entrevista: o contador de likes pode ser eventual? E o estoque de um produto?
- N3 · Experimento — Medir o tempo de convergência entre serviço de pedidos e read model atualizado via Kafka
- N4 · Projeto — Construir read model eventual de pedidos via Kafka com indicação de status pendente na API

**Critérios de conclusão**
- [ ] Identifico funcionalidades que toleram consistência eventual e outras que não
- [ ] Explico como read repair e anti-entropy fazem réplicas convergirem
- [ ] Proponho mitigação de UX para leitura desatualizada após escrita
- [ ] Explico por que eventos assíncronos entre serviços geram consistência eventual

#### 5.3.4 Quorums

Em sistemas leaderless, quorums exigem W confirmações de escrita e R respostas de leitura entre N réplicas; com R+W>N os conjuntos se sobrepõem e a leitura encontra a versão mais recente, mas ainda há casos-limite com sloppy quorum, escritas concorrentes e falhas parciais. _(~75 min)_

**Objetivos**
- Explicar por que R+W>N garante sobreposição entre conjuntos de leitura e escrita
- Escolher N, R e W para otimizar leitura, escrita ou disponibilidade
- Explicar sloppy quorum e hinted handoff
- Identificar casos em que quorum não garante linearizability
- Relacionar com os níveis de consistência do Cassandra (ONE, QUORUM, ALL)

**Pré-requisitos**
- [rec] 5.3.3 Eventual Consistency — Quorums ajustam o ponto entre consistência eventual e forte

**Desafios planejados**
- N1 · Conceitual — Calcular tolerância a falhas e garantias para várias combinações de N, R e W
- N2 · Programação — Simular em Java um store leaderless com N réplicas, quorum configurável e versões
- N3 · Identificação de bugs — Encontrar o cenário em que um quorum R+W>N retorna valor antigo após escrita parcial
- N3 · Entrevista — Entrevista: que configuração de quorum você usaria para um carrinho de compras?
- N4 · Implementação — Adicionar read repair ao store leaderless simulado e medir convergência

**Critérios de conclusão**
- [ ] Calculo quantas falhas são toleradas para leitura e escrita com N=5, R=2, W=4
- [ ] Explico por que R+W>N não basta quando a escrita falha parcialmente
- [ ] Explico hinted handoff e seu impacto na consistência

#### 5.3.5 Consensus básico

Consenso permite que nós concordem sobre um valor mesmo com falhas; Raft faz isso elegendo um líder por termo e replicando um log que só é commitado após maioria, base de sistemas como etcd, ZooKeeper (ZAB) e o KRaft do Kafka. _(~120 min)_

**Objetivos**
- Explicar o problema do consenso e por que maioria (2f+1 nós para f falhas) é necessária
- Descrever eleição de líder no Raft: termos, timeouts aleatórios e votos
- Descrever replicação de log e regra de commit por maioria
- Explicar como consenso evita split-brain
- Identificar usos práticos: eleição de líder, locks distribuídos, configuração

**Pré-requisitos**
- [rec] 5.3.4 Quorums — Consenso usa o raciocínio de maioria dos quorums
- [rec] 5.2.5 Jitter — Raft usa election timeouts aleatórios pelo mesmo motivo do jitter

**Desafios planejados**
- N1 · Conceitual — Explicar por que consenso exige maioria e calcular falhas toleradas para 3, 4 e 5 nós
- N2 · Experimento — Usar o visualizador do Raft para provocar eleições, votos divididos e partição de rede
- N3 · Entrevista — Entrevista: como o Raft impede dois líderes no mesmo termo?
- N3 · Experimento — Subir cluster etcd de 3 nós, derrubar o líder e observar reeleição e indisponibilidade de escrita sem maioria
- N4 · Implementação — Implementar em Java a eleição de líder do Raft simulada com nós em threads

**Critérios de conclusão**
- [ ] Explico uma eleição Raft passo a passo, incluindo voto dividido
- [ ] Explico por que um cluster de 4 nós não tolera mais falhas que um de 3
- [ ] Explico por que uma entrada só é commitada após replicação na maioria
- [ ] Cito onde consenso é usado no Kafka e no Kubernetes

#### 5.3.6 Distributed Transactions

Transações distribuídas buscam atomicidade quando uma operação altera dados em vários bancos ou serviços; como não existe um único log de commit, é preciso escolher entre coordenação síncrona (2PC/XA) e abordagens baseadas em eventos e compensação com consistência eventual. _(~60 min)_

**Objetivos**
- Explicar por que @Transactional local não cobre chamadas a outros serviços
- Identificar o problema do dual write (banco + broker, banco + API)
- Comparar 2PC, Outbox e Saga em consistência, disponibilidade e acoplamento
- Decidir quando reestruturar fronteiras de serviço para evitar a transação distribuída

**Pré-requisitos**
- [req] 3.2.2 ACID — É preciso entender ACID local para ver o que se perde na distribuição
- [rec] 4.2.16 @Transactional — Mostra o limite do @Transactional ao envolver outros recursos
- [rec] 5.3.3 Eventual Consistency — As alternativas ao 2PC aceitam consistência eventual

**Desafios planejados**
- N1 · Conceitual — Explicar por que ACID não se estende naturalmente a vários serviços
- N2 · Identificação de bugs — Encontrar o dual write em um método @Transactional que salva no banco e publica no Kafka
- N3 · Entrevista — Entrevista: transferência entre contas em serviços diferentes — como garantir consistência?
- N3 · Análise de código — Analisar as falhas possíveis em cada linha de um fluxo que chama 3 serviços dentro de @Transactional
- N4 · Projeto — Redesenhar uma transferência entre serviços usando Outbox e Saga em vez de chamadas dentro de @Transactional

**Critérios de conclusão**
- [ ] Explico os modos de falha de um dual write e suas consequências
- [ ] Identifico em código uma transação distribuída disfarçada
- [ ] Escolho a abordagem adequada para três cenários diferentes e justifico

#### 5.3.7 Two-Phase Commit

Two-Phase Commit coordena participantes em uma fase de prepare (votação com recursos bloqueados) e uma de commit/abort; garante atomicidade, mas o coordenador é ponto único de bloqueio: se falhar após o prepare, participantes ficam em dúvida segurando locks. _(~75 min)_

**Objetivos**
- Descrever as fases prepare e commit e o que cada participante persiste
- Explicar o estado in-doubt e por que participantes não podem decidir sozinhos
- Explicar o impacto de locks mantidos durante o protocolo em throughput
- Relacionar 2PC com XA/JTA em Java e com o 3PC
- Explicar por que 2PC é pouco usado entre microsserviços

**Pré-requisitos**
- [rec] 5.3.6 Distributed Transactions — 2PC é a abordagem clássica para transações distribuídas
- [rec] 3.2.7 Locks — Os participantes mantêm locks entre as fases
- [rec] 4.3.11 Deadlock — Locks distribuídos mantidos por longos períodos podem gerar deadlocks e contenção

**Desafios planejados**
- N1 · Conceitual — Desenhar o diagrama de sequência do 2PC com commit e com abort
- N2 · Experimento — Usar PREPARE TRANSACTION e COMMIT PREPARED no PostgreSQL e observar locks em dúvida
- N3 · Programação — Simular coordenador e participantes 2PC em Java e injetar falha do coordenador após o prepare
- N3 · Entrevista — Entrevista: por que 2PC é chamado de protocolo bloqueante?
- N4 · Implementação — Adicionar log de decisão e recuperação do coordenador ao simulador 2PC em Java

**Critérios de conclusão**
- [ ] Desenho a sequência de mensagens do 2PC com sucesso e com abort
- [ ] Explico o que acontece se o coordenador cai após todos votarem sim
- [ ] Justifico por que 2PC reduz disponibilidade
- [ ] Explico o PREPARE TRANSACTION do PostgreSQL

#### 5.3.8 Transactional Outbox

O Transactional Outbox resolve o dual write gravando o evento numa tabela outbox na mesma transação local da mudança de estado; um relay (polling ou CDC com Debezium lendo o WAL) publica no broker com entrega at-least-once. _(~120 min)_

**Objetivos**
- Explicar como a outbox garante atomicidade entre estado e evento
- Implementar relay por polling com SELECT ... FOR UPDATE SKIP LOCKED
- Explicar CDC com Debezium e comparar com polling (latência, carga, operação)
- Garantir ordem por agregado e idempotência no consumidor
- Definir limpeza e retenção da tabela outbox

**Pré-requisitos**
- [req] 5.3.6 Distributed Transactions — Outbox é a solução para o problema do dual write
- [rec] 5.1.12 At-least-once — O relay entrega at-least-once
- [rec] 5.2.6 Idempotência — Consumidores da outbox precisam ser idempotentes
- [rec] 3.2.7 Locks — Polling concorrente usa locks com SKIP LOCKED

**Desafios planejados**
- N1 · Conceitual — Explicar por que a outbox resolve o dual write e onde a duplicação ainda ocorre
- N2 · Programação — Implementar em Spring a gravação do pedido e do evento na tabela outbox na mesma transação
- N3 · Programação — Implementar relay por polling com FOR UPDATE SKIP LOCKED publicando no Kafka
- N3 · Identificação de bugs — Encontrar o bug de eventos fora de ordem em um relay multi-instância
- N4 · Experimento — Configurar Debezium sobre o WAL do PostgreSQL e comparar latência com o relay por polling

**Critérios de conclusão**
- [ ] Implemento a escrita do evento na outbox dentro do mesmo @Transactional
- [ ] Implemento um relay por polling que suporta múltiplas instâncias
- [ ] Explico quando o relay pode publicar duplicatas e como o consumidor lida
- [ ] Comparo polling e CDC para um caso concreto

#### 5.3.9 Saga

Saga divide uma transação de negócio em uma sequência de transações locais, cada uma com uma compensação semântica que desfaz seu efeito em caso de falha; troca isolamento por disponibilidade e exige lidar com anomalias como dirty reads entre etapas. _(~120 min)_

**Objetivos**
- Modelar uma Saga com transações locais e compensações correspondentes
- Diferenciar transações compensáveis, pivot e retentáveis
- Projetar compensações idempotentes e semanticamente corretas (estorno, não delete)
- Mitigar a falta de isolamento com semantic locks, estados pendentes e reordenação de passos
- Persistir o estado da Saga para recuperação após falha

**Pré-requisitos**
- [rec] 5.3.8 Transactional Outbox — Passos da Saga publicam eventos de forma confiável via Outbox
- [rec] 5.2.6 Idempotência — Passos e compensações são reexecutados e precisam ser idempotentes

**Desafios planejados**
- N1 · Conceitual — Modelar passos, compensações e pivot da Saga de reserva de viagem
- N2 · Programação — Implementar em Java uma Saga de pedido com reserva de estoque, pagamento e compensações
- N3 · Identificação de bugs — Encontrar a compensação não idempotente que estorna o pagamento duas vezes
- N3 · Entrevista — Entrevista: como lidar com a falta de isolamento entre passos de uma Saga?
- N4 · Projeto — Construir Saga de checkout com estado persistido e recuperação após crash do serviço

**Critérios de conclusão**
- [ ] Modelo uma Saga de pedido com passos, compensações e pivot
- [ ] Explico por que compensação não é rollback
- [ ] Identifico uma anomalia por falta de isolamento e proponho contramedida
- [ ] Implemento compensações idempotentes

#### 5.3.10 Choreography vs Orchestration

Sagas podem ser coordenadas por coreografia (serviços reagem a eventos uns dos outros, sem coordenador) ou orquestração (um orquestrador envia comandos e mantém a máquina de estados); a escolha afeta acoplamento, visibilidade do fluxo e facilidade de evolução. _(~90 min)_

**Objetivos**
- Comparar coreografia e orquestração em acoplamento, visibilidade e testabilidade
- Identificar o risco de dependências cíclicas e fluxo implícito na coreografia
- Implementar um orquestrador como máquina de estados persistida
- Conhecer ferramentas de orquestração (Temporal, Camunda) e quando adotá-las
- Escolher a abordagem para um fluxo dado e justificar

**Pré-requisitos**
- [req] 5.3.9 Saga — São estilos de coordenação de uma Saga
- [rec] 5.1.4 Event-Driven Architecture — Coreografia é uma aplicação direta de Event-Driven Architecture

**Desafios planejados**
- N1 · Conceitual — Comparar coreografia e orquestração para a Saga de pedido
- N2 · Análise de código — Mapear o fluxo implícito de uma Saga coreografada a partir dos listeners Kafka de 4 serviços
- N3 · Entrevista — Entrevista: quando a coreografia vira um 'event spaghetti' e como migrar?
- N3 · Programação — Implementar um orquestrador de Saga em Java como máquina de estados persistida
- N4 · Projeto — Implementar o checkout coreografado e depois orquestrado, comparando rastreabilidade e esforço de mudança

**Critérios de conclusão**
- [ ] Desenho o mesmo fluxo nas duas abordagens e aponto diferenças
- [ ] Explico como rastrear o andamento de uma Saga coreografada
- [ ] Implemento um orquestrador com estado persistido
- [ ] Justifico a escolha para um fluxo com 3 e outro com 8 passos

## 06 — System Design

*Projetar sistemas escaláveis numa entrevista: levantar requisitos, estimar capacidade, desenhar a arquitetura e discutir trade-offs de cache, particionamento, replicação e disponibilidade, praticando com problemas clássicos e simulações completas.*

### 6.1 Fundamentos de System Design (11 tópicos)

**[Adicional]** Estabelece o método de uma entrevista de System Design: levantar requisitos funcionais e não funcionais, estimar capacidade com números de ordem de grandeza, definir API e modelo de dados e chegar a uma arquitetura de alto nível. Em seguida cobre os blocos de construção usados em praticamente todo desenho escalável — escala horizontal, load balancer, cache e CDN — sempre com foco em quando usar cada um e qual custo cada escolha traz.

Objetivos do módulo:
- Conduzir uma entrevista de System Design em etapas com gestão explícita do tempo de 45 minutos
- Transformar um enunciado vago em requisitos funcionais e não funcionais priorizados e mensuráveis
- Estimar QPS, armazenamento e banda com back-of-the-envelope e usar os números para justificar decisões
- Definir API e modelo de dados coerentes com os padrões de acesso do sistema
- Desenhar uma arquitetura de alto nível com load balancer, serviços stateless, cache e CDN
- Justificar cada componente adicionado por um requisito ou por um gargalo identificado

#### 6.1.1 Como conduzir uma entrevista de System Design

Roteiro para conduzir uma entrevista de System Design: esclarecer escopo, estimar, propor API e dados, desenhar alto nível, aprofundar componentes críticos e fechar com trade-offs, tudo dentro de ~45 minutos e com comunicação contínua. _(~60 min)_

**Objetivos**
- Descrever as fases da entrevista (requisitos, estimativas, API, dados, alto nível, deep dive, wrap-up) e o tempo-alvo de cada uma
- Fazer perguntas de esclarecimento que reduzam o escopo a um MVP defensável
- Narrar o raciocínio em voz alta e confirmar suposições com o entrevistador antes de avançar
- Reconhecer sinais do entrevistador para mudar de profundidade ou de componente
- Listar os erros mais comuns: pular requisitos, desenhar cedo demais, ignorar números e não discutir trade-offs

**Desafios planejados**
- N1 · Conceitual — Montar o roteiro de 45 minutos com orçamento de tempo por fase
- N2 · Entrevista — Primeiros 8 minutos: esclarecer escopo de "desenhe o YouTube" e fechar o MVP
- N2 · Análise de código — Analisar a transcrição de uma entrevista e apontar os 5 erros de condução
- N3 · Experimento — Gravar uma simulação de 20 minutos e medir o tempo gasto em cada fase
- N4 · Projeto — Criar um template pessoal de quadro (whiteboard) reutilizável para entrevistas

**Critérios de conclusão**
- [ ] Consigo escrever de memória o roteiro de fases com o orçamento de minutos de cada uma
- [ ] Conduzi ao menos uma simulação curta respeitando o tempo de cada fase
- [ ] Sei listar 5 perguntas de esclarecimento genéricas que se aplicam a quase qualquer problema
- [ ] Identifico numa gravação ou transcrição onde o candidato perdeu tempo ou deixou de justificar uma decisão

#### 6.1.2 Functional Requirements

Requisitos funcionais definem o que o sistema faz: casos de uso, atores e operações principais. Delimitá-los cedo e priorizá-los evita desenhar funcionalidades que não serão avaliadas. _(~45 min)_

**Objetivos**
- Extrair casos de uso centrais a partir de um enunciado ambíguo
- Separar funcionalidades core, desejáveis e fora de escopo de forma explícita
- Expressar requisitos como operações verificáveis (ex.: "usuário cria URL curta com alias opcional")
- Identificar atores e padrões de interação (leitura vs escrita, síncrono vs assíncrono)
- Relacionar cada requisito funcional a pelo menos um endpoint ou fluxo da arquitetura

**Pré-requisitos**
- [rec] 6.1.1 Como conduzir uma entrevista de System Design — Requisitos são a primeira fase do roteiro da entrevista

**Desafios planejados**
- N1 · Conceitual — Classificar 15 requisitos de um app de delivery em core, desejável e fora de escopo
- N2 · Entrevista — Levantar requisitos funcionais do Instagram em 5 minutos
- N2 · Identificação de bugs — Encontrar requisitos ambíguos ou não verificáveis numa especificação de chat
- N3 · Conceitual — Mapear requisitos funcionais do Uber para fluxos de leitura e escrita
- N4 · Projeto — Escrever a especificação funcional de um sistema de reservas de ingressos

**Critérios de conclusão**
- [ ] Para um enunciado novo, produzo em até 5 minutos uma lista de 3–5 requisitos core e itens fora de escopo
- [ ] Cada requisito que escrevo é verificável e não ambíguo
- [ ] Consigo justificar por que deixei uma funcionalidade fora do escopo

#### 6.1.3 Non-Functional Requirements

Requisitos não funcionais — escala, latência, disponibilidade, consistência, durabilidade, segurança — definem como o sistema deve se comportar e são os que mais influenciam a arquitetura. _(~60 min)_

**Objetivos**
- Quantificar requisitos não funcionais (ex.: p99 < 200 ms, 99,95% de disponibilidade, RPO de 0)
- Converter percentuais de disponibilidade em downtime permitido por mês e por ano
- Decidir entre consistência forte e eventual por funcionalidade, não pelo sistema inteiro
- Identificar requisitos não funcionais conflitantes e explicitar qual priorizar
- Relacionar cada requisito não funcional a decisões de arquitetura concretas

**Pré-requisitos**
- [rec] 6.1.2 Functional Requirements — Requisitos não funcionais qualificam os casos de uso já definidos
- [rec] 3.3.6 SLI / SLO — SLI/SLO fornecem a linguagem para quantificar latência e disponibilidade
- [rec] 5.3.3 Eventual Consistency — Necessário para decidir onde consistência eventual é aceitável

**Desafios planejados**
- N1 · Conceitual — Tabela de "noves": converter disponibilidade em downtime mensal e anual
- N2 · Entrevista — Definir NFRs quantificados para um sistema de pagamentos e para um feed social
- N3 · Conceitual — Resolver conflito entre latência p99 baixa e consistência forte em leitura de saldo
- N3 · Análise de código — Avaliar uma especificação com NFRs vagos e reescrevê-los com métricas
- N4 · Projeto — Documento de NFRs com SLOs, orçamento de erro e impacto arquitetural para um e-commerce

**Critérios de conclusão**
- [ ] Converto 99,9%, 99,95% e 99,99% em minutos de downtime por mês sem consultar
- [ ] Para um sistema dado, escrevo NFRs com números e unidade, nunca adjetivos vagos
- [ ] Explico como um NFR específico mudou uma decisão de arquitetura

#### 6.1.4 Capacity Estimation

Capacity estimation (back-of-the-envelope) usa ordens de grandeza para estimar QPS médio e de pico, armazenamento, banda e memória de cache, transformando requisitos em números que justificam a arquitetura. _(~90 min)_

**Objetivos**
- Calcular QPS médio e de pico a partir de DAU e ações por usuário (1 dia ≈ 10^5 s)
- Estimar armazenamento em 5 anos considerando tamanho de registro, replicação e índices
- Estimar banda de entrada e saída e memória de cache pela regra 80/20
- Usar latency numbers (memória, SSD, rede intra e inter-datacenter) para avaliar viabilidade
- Decidir com base nos números se o sistema é read-heavy, write-heavy ou precisa de sharding

**Pré-requisitos**
- [rec] 6.1.3 Non-Functional Requirements — As estimativas partem dos requisitos de escala definidos como NFRs

**Desafios planejados**
- N1 · Conceitual — Memorizar latency numbers e potências de 2 com flashcards de ordem de grandeza
- N2 · Entrevista — Estimar QPS, armazenamento em 5 anos e banda do Twitter com 300M DAU
- N2 · Identificação de bugs — Encontrar os erros de unidade e ordem de grandeza numa estimativa pronta
- N3 · Conceitual — Dimensionar o cluster de cache para servir 80% das leituras de um URL Shortener
- N4 · Programação — Implementar em Java uma calculadora de capacidade parametrizável (DAU, ações, payload, retenção)

**Critérios de conclusão**
- [ ] Faço a estimativa completa (QPS, storage, banda, cache) de um problema novo em menos de 5 minutos
- [ ] Sei de memória potências de 2 e 10 úteis e latency numbers principais
- [ ] Explico qual decisão de arquitetura cada número da estimativa sustentou
- [ ] Meus resultados ficam na ordem de grandeza correta quando comparados a uma referência

#### 6.1.5 API Design

API design define o contrato entre clientes e sistema: recursos, verbos, payloads, paginação, versionamento e idempotência, escolhidos de acordo com os casos de uso e o perfil de tráfego. _(~60 min)_

**Objetivos**
- Derivar endpoints REST diretamente dos requisitos funcionais
- Escolher paginação por cursor versus offset justificando consistência e desempenho
- Projetar operações de escrita idempotentes com Idempotency-Key quando há retries
- Comparar REST, gRPC, GraphQL e WebSocket por caso de uso
- Definir códigos de status, erros e versionamento de forma consistente

**Pré-requisitos**
- [rec] 3.5.1 REST — Base de design REST aplicada aqui no contexto de entrevista
- [rec] 3.5.11 Idempotência — Idempotência é decisiva em APIs de escrita sujeitas a retry
- [rec] 6.1.2 Functional Requirements — A API é derivada dos requisitos funcionais

**Desafios planejados**
- N1 · Conceitual — Comparar paginação offset e cursor em um feed com inserções frequentes
- N2 · Entrevista — Desenhar a API de um sistema de reservas de hotel em 7 minutos
- N2 · Identificação de bugs — Encontrar falhas de idempotência e de semântica HTTP numa API de pagamentos
- N3 · Conceitual — Escolher entre REST, gRPC e WebSocket para cliente móvel, serviço interno e chat
- N4 · Implementação — Implementar em Spring um endpoint POST idempotente com Idempotency-Key e paginação por cursor

**Critérios de conclusão**
- [ ] Para um problema novo, escrevo 3–6 endpoints com método, path, payload e resposta
- [ ] Justifico a escolha de paginação e de protocolo para cada caso de uso
- [ ] Explico como minha API se comporta diante de um retry de cliente

#### 6.1.6 Data Model

O modelo de dados define entidades, relacionamentos, chaves e índices a partir dos padrões de acesso, e orienta a escolha entre bancos relacionais, key-value, wide-column ou documentos. _(~60 min)_

**Objetivos**
- Modelar entidades e chaves a partir das queries mais frequentes (access-pattern-first)
- Escolher entre SQL e NoSQL justificando consistência, joins, escala de escrita e flexibilidade
- Definir índices e chaves de partição que suportem as queries críticas
- Avaliar quando desnormalizar para reduzir latência de leitura
- Estimar o tamanho de um registro e conectar ao cálculo de armazenamento

**Pré-requisitos**
- [rec] 3.4.6 Indexes — Índices determinam se o modelo suporta as queries críticas
- [rec] 6.1.4 Capacity Estimation — O tamanho dos registros alimenta a estimativa de armazenamento
- [rec] 6.1.5 API Design — Os endpoints revelam os padrões de acesso a modelar

**Desafios planejados**
- N1 · Conceitual — Relacionar 6 padrões de acesso ao tipo de banco mais adequado
- N2 · Entrevista — Modelar os dados de um sistema de chat: mensagens, conversas e participantes
- N3 · Análise de código — Avaliar um schema relacional normalizado e propor desnormalização para leitura de feed
- N3 · Identificação de bugs — Encontrar a query sem índice e a chave de partição ruim num modelo de e-commerce
- N4 · Implementação — Implementar e comparar no PostgreSQL dois modelos para timeline com EXPLAIN ANALYZE

**Critérios de conclusão**
- [ ] Para um problema novo, listo as queries críticas antes de desenhar tabelas
- [ ] Justifico a escolha do tipo de banco com pelo menos dois critérios técnicos
- [ ] Defino a chave de partição e os índices que atendem cada query crítica

#### 6.1.7 High-Level Architecture

A arquitetura de alto nível conecta clientes, entrada (DNS, CDN, load balancer, API gateway), serviços, armazenamento, cache e processamento assíncrono num diagrama que atende os requisitos e serve de base para os deep dives. _(~60 min)_

**Objetivos**
- Desenhar um diagrama de alto nível com fluxo de leitura e de escrita claramente separados
- Posicionar API gateway, load balancer, serviços stateless, banco, cache e filas com justificativa
- Percorrer uma requisição de ponta a ponta explicando cada salto
- Decidir o que é síncrono e o que é assíncrono no fluxo principal
- Apontar no diagrama os componentes candidatos a deep dive

**Pré-requisitos**
- [rec] 6.1.6 Data Model — A arquitetura organiza os componentes em torno do modelo de dados
- [rec] 5.1.2 Message Queue — Filas são o principal mecanismo para tirar trabalho do caminho síncrono

**Desafios planejados**
- N1 · Conceitual — Explicar o papel de cada caixa num diagrama de referência de aplicação web
- N2 · Entrevista — Desenhar o alto nível do Dropbox separando metadados e blocos de arquivo
- N2 · Identificação de bugs — Encontrar o ponto único de falha e a dependência síncrona desnecessária num diagrama
- N3 · Conceitual — Decidir o que mover para processamento assíncrono no checkout de um e-commerce
- N4 · Projeto — Documentar a arquitetura de alto nível de um projeto próprio no modelo C4 (níveis 1 e 2)

**Critérios de conclusão**
- [ ] Desenho em 10 minutos um diagrama de alto nível que atende todos os requisitos core
- [ ] Explico o caminho de uma requisição de leitura e de uma de escrita sem lacunas
- [ ] Cada componente do diagrama tem uma justificativa associada a requisito ou número

#### 6.1.8 Horizontal Scaling

Horizontal scaling adiciona instâncias em vez de máquinas maiores; exige serviços stateless, externalização de sessão e estado, e traz custos de coordenação e consistência. _(~60 min)_

**Objetivos**
- Comparar vertical e horizontal scaling por custo, limite físico e disponibilidade
- Tornar um serviço stateless movendo sessão e estado para armazenamento externo
- Calcular o número de instâncias necessárias a partir do QPS de pico e da capacidade por instância
- Explicar como autoscaling reage a métricas e os riscos de oscilação e cold start
- Identificar o que não escala horizontalmente com facilidade (banco primário, locks, estado local)

**Pré-requisitos**
- [rec] 6.1.7 High-Level Architecture — Escalar horizontalmente pressupõe uma arquitetura com camadas bem definidas
- [rec] 6.1.4 Capacity Estimation — O dimensionamento de instâncias parte do QPS estimado

**Desafios planejados**
- N1 · Conceitual — Comparar scale-up e scale-out em custo, limite e tolerância a falhas
- N2 · Identificação de bugs — Encontrar o estado local que quebra um serviço Spring ao rodar com 3 réplicas
- N2 · Entrevista — Dimensionar a frota de API para 50k QPS de pico com p99 de 100 ms
- N3 · Experimento — Escalar um serviço com Docker Compose de 1 para 4 réplicas e medir throughput com k6
- N4 · Implementação — Migrar sessão HTTP em memória para Spring Session com Redis e validar com múltiplas instâncias

**Critérios de conclusão**
- [ ] Calculo quantas instâncias atendem um pico dado com margem de segurança
- [ ] Explico como externalizar sessão e por que estado local impede escalar
- [ ] Aponto o próximo gargalo quando a camada de aplicação já escala horizontalmente

#### 6.1.9 Load Balancer

Load balancers distribuem tráfego entre instâncias em L4 ou L7, com algoritmos (round robin, least connections, consistent hashing), health checks e terminação TLS, e precisam eles próprios ser redundantes. _(~60 min)_

**Objetivos**
- Diferenciar balanceamento L4 e L7 e quando usar cada um
- Comparar round robin, weighted, least connections e consistent hashing por cenário
- Configurar health checks ativos e passivos e explicar o impacto de intervalos e thresholds
- Discutir sticky sessions e por que geralmente são um sinal de estado mal posicionado
- Projetar redundância do próprio load balancer (active-passive, DNS, anycast)

**Pré-requisitos**
- [rec] 6.1.8 Horizontal Scaling — Load balancer é o que viabiliza a escala horizontal
- [rec] 3.1.3 DNS — DNS é a primeira camada de distribuição de tráfego
- [rec] 3.1.8 HTTP — Balanceamento L7 opera sobre a semântica HTTP

**Desafios planejados**
- N1 · Conceitual — Comparar L4 e L7: o que cada camada enxerga e pode decidir
- N2 · Implementação — Configurar Nginx como load balancer L7 com health check e least_conn para 3 instâncias
- N2 · Entrevista — Escolher o algoritmo de balanceamento para conexões WebSocket de longa duração
- N3 · Experimento — Derrubar uma instância sob carga e medir erros durante a janela de detecção do health check
- N4 · Programação — Implementar em Java um balanceador com round robin ponderado e remoção por health check

**Critérios de conclusão**
- [ ] Escolho e justifico algoritmo e camada (L4/L7) para três cenários distintos
- [ ] Explico o que acontece com requisições em andamento quando uma instância falha no health check
- [ ] Mostro como o load balancer deixa de ser ponto único de falha

#### 6.1.10 Cache

Cache como bloco de construção: onde colocá-lo (cliente, CDN, aplicação, cache distribuído), padrões cache-aside, read-through e write-through, TTL e invalidação, dimensionados pelo working set. _(~60 min)_

**Objetivos**
- Posicionar camadas de cache e explicar o que cada uma economiza (latência, carga no banco, banda)
- Comparar cache-aside, read-through, write-through e write-behind
- Escolher TTL e estratégia de invalidação de acordo com a tolerância a dados obsoletos
- Dimensionar memória do cache pelo working set e estimar hit ratio
- Explicar política de eviction LRU/LFU e seu efeito no hit ratio

**Pré-requisitos**
- [rec] 6.1.4 Capacity Estimation — O tamanho do cache é dimensionado pela estimativa de working set
- [rec] 2.4.1 Hash Table — Hash table é a estrutura base de caches em memória

**Desafios planejados**
- N1 · Conceitual — Comparar cache-aside, read-through e write-through em consistência e complexidade
- N2 · Implementação — Implementar cache-aside com Spring Cache e Redis com TTL por tipo de dado
- N2 · Entrevista — Dimensionar o cache para 10M perfis de usuário com hit ratio alvo de 90%
- N3 · Experimento — Medir latência e carga no banco com e sem cache sob carga com k6
- N4 · Programação — Implementar em Java um cache LRU com TTL e métricas de hit ratio

**Critérios de conclusão**
- [ ] Desenho onde ficam as camadas de cache num sistema read-heavy e justifico cada uma
- [ ] Escolho padrão de escrita e TTL para dois tipos de dado com tolerâncias distintas
- [ ] Calculo a memória necessária para um hit ratio alvo

#### 6.1.11 CDN

CDN aproxima conteúdo estático e cacheável dos usuários por meio de edge servers, reduzindo latência e banda na origem, com controle via Cache-Control, invalidação e modelos push e pull. _(~45 min)_

**Objetivos**
- Explicar como uma requisição chega ao edge mais próximo (DNS geográfico, anycast)
- Comparar CDN push e pull e quando cada um é adequado
- Configurar Cache-Control, ETag e versionamento de assets para controlar cache no edge
- Estimar a economia de banda na origem a partir do hit ratio da CDN
- Discutir invalidação, conteúdo dinâmico e custos de egress

**Pré-requisitos**
- [rec] 6.1.10 Cache — CDN é uma camada de cache distribuída geograficamente
- [rec] 3.1.3 DNS — DNS direciona o cliente ao edge mais próximo

**Desafios planejados**
- N1 · Conceitual — Comparar CDN push e pull para catálogo de vídeos e para site de notícias
- N2 · Identificação de bugs — Encontrar o erro de Cache-Control que serve dados de um usuário para outro
- N2 · Entrevista — Estimar banda de origem de um serviço de imagens com e sem CDN a 95% de hit ratio
- N3 · Experimento — Inspecionar cabeçalhos de cache de sites reais e explicar a estratégia de cada um
- N4 · Implementação — Configurar fingerprinting de assets e cabeçalhos de cache numa aplicação Spring atrás de um proxy

**Critérios de conclusão**
- [ ] Explico o caminho de uma requisição de imagem com cache miss e com cache hit no edge
- [ ] Defino cabeçalhos de cache corretos para HTML, assets versionados e API
- [ ] Calculo banda de origem economizada para um hit ratio dado

### 6.2 Prática de System Design I (4 tópicos)

**[Adicional]** Primeira bateria de problemas clássicos, de complexidade crescente: URL Shortener, Rate Limiter, Distributed Message Queue e Notification/Webhook System. Cada problema é resolvido de ponta a ponta com o método do módulo 6.1 — requisitos, estimativas, API, modelo de dados, arquitetura e deep dives — e inclui a implementação em Java de um componente central para conectar o desenho ao código.

Objetivos do módulo:
- Resolver problemas clássicos de ponta a ponta dentro de 45 minutos seguindo um roteiro consistente
- Escolher estratégias de geração de IDs, algoritmos de rate limiting e semânticas de entrega justificando os trade-offs
- Aplicar Redis, filas e logs particionados como blocos de construção em desenhos concretos
- Projetar entrega confiável com retries, backoff, idempotência e dead letter queue
- Implementar em Java um componente central de cada problema com testes
- Identificar gargalos de cada desenho e propor como evoluí-lo com 10x de carga

#### 6.2.1 URL Shortener

URL Shortener é o problema clássico read-heavy: gerar chaves curtas únicas (base62 de contador vs hash), redirecionar com baixa latência via cache e escolher entre 301 e 302 conforme a necessidade de analytics. _(~150 min)_

**Objetivos**
- Levantar requisitos (criar, redirecionar, alias customizado, expiração) e estimar QPS de escrita e leitura com razão 100:1
- Calcular o tamanho da chave: 62^7 ≈ 3,5 trilhões de combinações e o armazenamento em 5 anos
- Comparar geração por contador distribuído + base62, hash truncado (MD5/SHA) com tratamento de colisão e Key Generation Service
- Projetar o caminho de leitura com cache e CDN e justificar 301 vs 302
- Discutir modelo de dados key-value, sharding pela chave curta e proteção contra abuso
- Identificar gargalos (gerador de IDs, hot URLs) e evolução para 10x de tráfego

**Pré-requisitos**
- [rec] 6.1.4 Capacity Estimation — A estimativa de keyspace e armazenamento guia o tamanho da chave
- [rec] 6.1.10 Cache — O caminho de redirect depende de cache para baixa latência
- [rec] 2.4.1 Hash Table — Funções de hash e colisões são centrais na estratégia de geração por hash

**Desafios planejados**
- N1 · Conceitual — Calcular keyspace de 6, 7 e 8 caracteres base62 e o tempo até esgotar a 1.000 escritas/s
- N2 · Programação — Implementar encoder/decoder base62 em Java com testes de propriedade de ida e volta
- N2 · Entrevista — Mock interview cronometrado de 45 minutos: URL Shortener com 100M URLs novas por mês
- N3 · Conceitual — Comparar contador + base62, hash truncado com retry e Key Generation Service pré-alocado
- N3 · Identificação de bugs — Encontrar a condição de corrida na verificação de colisão de alias customizado
- N4 · Projeto — Construir um URL Shortener em Spring Boot com PostgreSQL, Redis cache-aside e redirect 302 com contagem de cliques

**Critérios de conclusão**
- [ ] Resolvo o problema completo em 45 minutos cobrindo requisitos, estimativas, API, dados, arquitetura e deep dive
- [ ] Justifico a estratégia de geração de IDs comparando colisões, previsibilidade e coordenação
- [ ] Explico quando usar 301 e quando usar 302 e o impacto em cache e analytics
- [ ] Tenho um encoder base62 em Java com testes de ida e volta

#### 6.2.2 Rate Limiter

Rate Limiter distribuído protege serviços limitando requisições por cliente: escolha de algoritmo (token bucket, leaky bucket, fixed e sliding window), estado compartilhado em Redis com scripts Lua atômicos e comportamento sob falha. _(~150 min)_

**Objetivos**
- Levantar requisitos: chave de limitação, regras configuráveis, latência adicional < 5 ms e resposta 429 com cabeçalhos
- Comparar token bucket, leaky bucket, fixed window, sliding window log e sliding window counter em precisão e memória
- Projetar token bucket distribuído em Redis com script Lua para atomicidade de leitura e atualização
- Estimar memória de Redis para milhões de chaves e QPS de verificação
- Decidir posição (gateway, sidecar, biblioteca) e política fail-open vs fail-closed
- Discutir sincronização entre regiões, clock skew e limites aproximados

**Pré-requisitos**
- [rec] 5.2.8 Rate Limiting — Rate limiting como padrão de resiliência já foi introduzido; aqui é desenhado como sistema distribuído
- [rec] 6.1.10 Cache — O estado do limitador vive num armazenamento em memória do tipo cache
- [rec] 6.1.9 Load Balancer — Ajuda a decidir em que camada de entrada o limitador fica

**Desafios planejados**
- N1 · Conceitual — Comparar os 5 algoritmos de rate limiting em precisão, memória e tolerância a bursts
- N2 · Programação — Implementar token bucket em memória em Java com Clock injetável e testes de refill
- N2 · Entrevista — Mock interview cronometrado de 45 minutos: rate limiter para API pública com 1M de clientes
- N3 · Identificação de bugs — Encontrar a race condition num rate limiter Redis com GET/INCR/EXPIRE separados
- N3 · Experimento — Medir o burst permitido na borda de janela do fixed window versus sliding window counter
- N4 · Implementação — Implementar token bucket distribuído com Redis + script Lua como filtro Spring com cabeçalhos X-RateLimit

**Critérios de conclusão**
- [ ] Resolvo o problema em 45 minutos com escolha de algoritmo justificada
- [ ] Explico por que GET + SET separados no Redis causam race condition e como Lua resolve
- [ ] Defino e defendo a política de falha quando o Redis está indisponível
- [ ] Tenho um token bucket em Java testado com relógio controlado

#### 6.2.3 Distributed Message Queue

Distributed Message Queue desenhada do zero: log particionado e replicado, offsets e consumer groups, garantias de entrega, retenção e ordenação, inspirada em Kafka e comparada a filas tradicionais. _(~180 min)_

**Objetivos**
- Levantar requisitos: throughput de escrita, retenção, ordenação por chave e semântica de entrega
- Projetar armazenamento como append-only log segmentado com índice de offsets
- Explicar particionamento por chave, consumer groups e rebalanceamento
- Projetar replicação com líder, ISR e acks e o trade-off entre durabilidade e latência
- Comparar at-most-once, at-least-once e exactly-once e o custo de cada uma
- Estimar armazenamento e banda para 1M mensagens/s com retenção de 7 dias

**Pré-requisitos**
- [rec] 5.1.5 Kafka — Kafka é a referência de design discutida no problema
- [rec] 5.1.7 Partitions — Partições são a unidade de paralelismo e ordenação
- [rec] 5.3.1 Replication — Replicação do log determina durabilidade
- [rec] 6.1.4 Capacity Estimation — Estimativas de throughput e retenção dimensionam o cluster

**Desafios planejados**
- N1 · Conceitual — Comparar fila tradicional (RabbitMQ) e log distribuído (Kafka) em modelo de consumo e retenção
- N2 · Entrevista — Mock interview cronometrado de 45 minutos: fila distribuída com 1M msg/s e retenção de 7 dias
- N2 · Programação — Implementar em Java um append-only log segmentado com índice esparso de offsets
- N3 · Conceitual — Analisar perda de mensagens com acks=1 durante failover de líder versus acks=all com min.insync.replicas=2
- N3 · Experimento — Medir efeito de batch.size e linger.ms no throughput e latência de um produtor Kafka local
- N4 · Projeto — Construir um broker mínimo com partições, consumer groups e commit de offset via HTTP

**Critérios de conclusão**
- [ ] Resolvo o problema em 45 minutos cobrindo armazenamento, particionamento, replicação e entrega
- [ ] Explico por que append-only com leitura sequencial atinge alto throughput
- [ ] Justifico a configuração de acks e réplicas para um requisito de durabilidade dado
- [ ] Implementei um log segmentado mínimo em Java com leitura por offset

#### 6.2.4 Notification / Webhook System

Notification/Webhook System entrega eventos a canais (push, e-mail, SMS) e endpoints externos com confiabilidade: filas por canal, retries com backoff exponencial, idempotência no receptor, assinatura HMAC, DLQ e isolamento de clientes lentos. _(~150 min)_

**Objetivos**
- Levantar requisitos: canais, preferências do usuário, prioridade, latência e garantia at-least-once
- Projetar pipeline com fila por canal/prioridade, workers e integração com provedores externos
- Definir política de retry com backoff exponencial e jitter, limite de tentativas e dead letter queue
- Garantir segurança e deduplicação de webhooks com assinatura HMAC, timestamp e event id
- Isolar destinatários lentos ou indisponíveis com circuit breaker e filas por tenant
- Estimar volume diário e picos de campanhas e o impacto nos provedores

**Pré-requisitos**
- [rec] 5.2.3 Retry — Retry com backoff é a base da entrega confiável
- [rec] 5.2.6 Idempotência — Entrega at-least-once exige idempotência no receptor
- [rec] 5.2.7 Circuit Breaker — Circuit breaker isola endpoints de webhook com falha
- [rec] 6.2.3 Distributed Message Queue — O sistema se apoia numa fila distribuída para desacoplar produção e entrega

**Desafios planejados**
- N1 · Conceitual — Explicar por que webhooks são at-least-once e o que isso exige do receptor
- N2 · Programação — Implementar em Java cálculo de backoff exponencial com full jitter e limite de tentativas
- N2 · Entrevista — Mock interview cronometrado de 45 minutos: sistema de notificações com 100M envios/dia
- N3 · Identificação de bugs — Encontrar a falha de segurança na verificação de assinatura HMAC de um webhook (comparação não constante e replay)
- N3 · Conceitual — Projetar isolamento por tenant para que um endpoint fora do ar não bloqueie a fila
- N4 · Implementação — Construir dispatcher de webhooks em Spring com outbox, retries agendados, DLQ e assinatura HMAC

**Critérios de conclusão**
- [ ] Resolvo o problema em 45 minutos com política de retry e DLQ explícitas
- [ ] Explico como um receptor valida assinatura e descarta duplicatas
- [ ] Mostro como um cliente com endpoint lento não degrada a entrega para os demais
- [ ] Implementei agendamento de retries com backoff exponencial e jitter em Java

### 6.3 Escala, dados e trade-offs (11 tópicos)

**[Adicional]** Aprofunda as decisões de dados e confiabilidade que diferenciam um desenho mediano de um bom: replicação, particionamento, sharding, caching, filas, consistência, disponibilidade, CAP, hotspots, pontos únicos de falha e tolerância a falhas. Vários temas já apareceram nas etapas 03 e 05; aqui o foco é a ótica de design — como escolher, quantificar e defender cada trade-off diante de requisitos concretos numa entrevista ou num projeto real.

Objetivos do módulo:
- Escolher topologias de replicação e estratégias de particionamento a partir dos padrões de acesso e dos requisitos de consistência
- Projetar sharding com chave adequada, rebalanceamento e tratamento de hotspots
- Posicionar caches e filas na arquitetura e explicar seus modos de falha
- Argumentar com CAP e PACELC sobre consistência versus disponibilidade e latência por caso de uso
- Calcular disponibilidade composta e eliminar pontos únicos de falha
- Projetar degradação graciosa e tolerância a falhas mensurável contra SLOs

#### 6.3.1 Replication

Replication sob a ótica de design: escolher entre líder único, multi-líder e leaderless, replicação síncrona ou assíncrona, e quantificar o impacto em latência, durabilidade (RPO), failover (RTO) e leituras obsoletas. _(~60 min)_

**Objetivos**
- Escolher topologia de replicação a partir de requisitos de escrita, geografia e consistência
- Quantificar o trade-off síncrono vs assíncrono em latência de escrita e RPO
- Projetar read replicas para escalar leitura e tratar replication lag (read-your-writes, monotonic reads)
- Explicar failover, split-brain e fencing e o RTO esperado
- Defender numa entrevista a configuração de réplicas para um caso concreto

**Pré-requisitos**
- [rec] 5.3.1 Replication — Mecânica de replicação já estudada; aqui o foco é escolha e trade-off de design
- [rec] 3.2.12 Replication — Visão introdutória de replicação de banco
- [rec] 6.1.3 Non-Functional Requirements — RPO, RTO e latência são requisitos não funcionais que guiam a escolha

**Desafios planejados**
- N1 · Conceitual — Comparar líder único, multi-líder e leaderless em conflitos, latência e disponibilidade
- N2 · Entrevista — Escolher a replicação de um sistema de perfis com usuários em 3 continentes
- N3 · Identificação de bugs — Encontrar o bug de read-after-write causado por leitura em réplica atrasada
- N3 · Experimento — Configurar PostgreSQL primário + réplica, induzir lag e medir leituras obsoletas
- N4 · Implementação — Implementar roteamento de leitura em Spring que usa o primário por N segundos após escrita do usuário

**Critérios de conclusão**
- [ ] Escolho e justifico a topologia de replicação para três sistemas com requisitos diferentes
- [ ] Explico como garantir read-your-writes com read replicas assíncronas
- [ ] Relaciono configuração de replicação a RPO e RTO numéricos

#### 6.3.2 Partitioning

Partitioning divide dados em partes menores por range, hash ou lista para distribuir carga e armazenamento; a escolha da estratégia define quais queries são eficientes e onde surgem hotspots. _(~60 min)_

**Objetivos**
- Comparar particionamento por range, hash e lista em distribuição e suporte a range queries
- Diferenciar particionamento horizontal e vertical e particionamento dentro de um nó versus entre nós
- Explicar consistent hashing com virtual nodes e o volume de dados movido ao adicionar um nó
- Avaliar índices secundários locais versus globais em sistemas particionados
- Escolher chave de particionamento a partir dos padrões de acesso

**Pré-requisitos**
- [rec] 6.1.6 Data Model — A chave de partição deriva do modelo de dados e dos padrões de acesso
- [rec] 5.1.7 Partitions — Partições de tópico ilustram particionamento por chave na prática

**Desafios planejados**
- N1 · Conceitual — Comparar range e hash partitioning para logs ordenados por tempo
- N2 · Programação — Implementar consistent hashing com virtual nodes em Java usando TreeMap
- N3 · Experimento — Medir a fração de chaves remapeadas ao adicionar um nó: hash modular vs consistent hashing
- N3 · Entrevista — Escolher chave de partição para pedidos consultados por cliente e por loja
- N4 · Implementação — Configurar particionamento declarativo por range de data no PostgreSQL e comparar planos de execução

**Critérios de conclusão**
- [ ] Escolho a estratégia de particionamento para três cargas distintas justificando queries suportadas
- [ ] Explico quanto dado é movido ao adicionar um nó com hash modular versus consistent hashing
- [ ] Descrevo o custo de uma query por índice secundário global

#### 6.3.3 Sharding

Sharding distribui partições entre múltiplos bancos independentes; exige escolher shard key, roteamento, estratégia de rebalanceamento e lidar com queries e transações cross-shard. _(~75 min)_

**Objetivos**
- Escolher shard key avaliando cardinalidade, distribuição e localidade das queries
- Comparar roteamento por lookup table, hash e range e onde fica a lógica de roteamento
- Planejar resharding com mínima indisponibilidade (dual-write, backfill, cutover)
- Explicar os custos de joins, agregações e transações cross-shard
- Estimar quando o volume justifica sharding em vez de escala vertical ou read replicas

**Pré-requisitos**
- [req] 6.3.2 Partitioning — Sharding é a aplicação de particionamento entre bancos distintos
- [rec] 6.1.4 Capacity Estimation — A decisão de shardear parte das estimativas de volume e throughput

**Desafios planejados**
- N1 · Conceitual — Listar sinais de que um banco precisa de sharding e alternativas a tentar antes
- N2 · Entrevista — Escolher a shard key de um sistema multi-tenant SaaS com tenants de tamanhos muito diferentes
- N3 · Identificação de bugs — Encontrar o problema numa shard key baseada em timestamp que concentra escritas
- N3 · Conceitual — Planejar migração de 4 para 16 shards com dual-write e backfill
- N4 · Implementação — Implementar em Spring um roteador de DataSource por shard key com AbstractRoutingDataSource

**Critérios de conclusão**
- [ ] Defendo uma shard key para um sistema dado e aponto o pior caso de distribuição
- [ ] Descrevo um plano de resharding passo a passo sem downtime
- [ ] Explico como tratar uma query que precisa de dados de vários shards

#### 6.3.4 Caching

Caching sob a ótica de escala e trade-offs: consistência entre cache e banco, invalidação distribuída, cache stampede, hot keys, cache de múltiplas camadas e o que acontece quando o cache falha. _(~75 min)_

**Objetivos**
- Analisar inconsistências entre cache e banco em escritas concorrentes e como mitigá-las
- Prevenir cache stampede com request coalescing, locks, TTL com jitter e refresh antecipado
- Tratar hot keys com cache local, replicação de chave e sharding do cache
- Projetar o comportamento do sistema quando o cluster de cache cai (cold start, proteção do banco)
- Decidir entre cache local, distribuído e multicamada com base em latência e consistência

**Pré-requisitos**
- [req] 6.1.10 Cache — Pressupõe padrões básicos de cache; aqui o foco é falhas e escala
- [rec] 6.3.2 Partitioning — Caches distribuídos são particionados por consistent hashing

**Desafios planejados**
- N1 · Conceitual — Explicar cache stampede, cache penetration e cache avalanche com exemplos
- N2 · Identificação de bugs — Encontrar a race condition entre update no banco e delete no cache que deixa valor obsoleto
- N3 · Experimento — Provocar stampede expirando uma chave quente sob carga e medir o pico no banco
- N3 · Entrevista — Projetar o cache de um placar ao vivo com uma única chave recebendo 500k leituras/s
- N4 · Programação — Implementar request coalescing em Java com ConcurrentHashMap e CompletableFuture

**Critérios de conclusão**
- [ ] Explico a sequência de eventos que deixa um valor obsoleto no cache após update e como evitá-la
- [ ] Descrevo três técnicas contra stampede e quando usar cada uma
- [ ] Projeto a proteção do banco para o cenário de perda total do cache

#### 6.3.5 Queues

Queues como ferramenta de design: absorver picos (load leveling), desacoplar serviços, distribuir trabalho e controlar backpressure, avaliando latência adicional, ordenação, duplicatas e crescimento de backlog. _(~60 min)_

**Objetivos**
- Identificar quando uma fila melhora o desenho (picos, trabalho lento, desacoplamento) e quando só adiciona latência
- Dimensionar consumidores a partir da taxa de chegada, tempo de processamento e SLA de backlog
- Projetar backpressure e limites de fila para evitar crescimento ilimitado
- Tratar mensagens venenosas com retries limitados e DLQ
- Escolher entre fila de trabalho e pub/sub conforme o padrão de consumo

**Pré-requisitos**
- [rec] 5.1.2 Message Queue — Fundamentos de message queue
- [rec] 5.1.3 Pub/Sub — Diferença entre fila de trabalho e pub/sub
- [rec] 6.2.3 Distributed Message Queue — O desenho interno de uma fila distribuída explica seus limites

**Desafios planejados**
- N1 · Conceitual — Explicar load leveling com um pico de Black Friday e uma fila na frente do processamento
- N2 · Entrevista — Dimensionar workers de transcodificação de vídeo para 10k uploads/hora com SLA de 15 minutos
- N3 · Conceitual — Aplicar a Lei de Little para relacionar backlog, taxa de chegada e tempo de espera
- N3 · Identificação de bugs — Encontrar a mensagem venenosa que trava uma partição e propor a correção
- N4 · Implementação — Implementar consumidor com retries limitados, DLQ e métrica de lag em Spring Kafka

**Critérios de conclusão**
- [ ] Calculo quantos consumidores drenam um backlog dado dentro de um SLA
- [ ] Explico como o sistema se comporta se os consumidores ficarem 1 hora fora do ar
- [ ] Justifico quando não usar fila num fluxo síncrono

#### 6.3.6 Consistency

Consistency sob a ótica de design: escolher o modelo de consistência por operação (linearizável, read-your-writes, causal, eventual) e justificar o custo em latência e disponibilidade diante dos requisitos do produto. _(~60 min)_

**Objetivos**
- Ordenar modelos de consistência do mais forte ao mais fraco e o que cada um garante ao usuário
- Escolher consistência por funcionalidade num mesmo sistema (saldo vs contador de likes)
- Usar quorums R + W > N para ajustar consistência em sistemas leaderless
- Explicar consistência entre serviços com outbox e sagas em vez de transações distribuídas
- Comunicar ao entrevistador o impacto visível ao usuário de cada escolha

**Pré-requisitos**
- [rec] 5.3.2 Strong Consistency — Base de strong consistency; aqui o foco é a escolha por caso de uso
- [rec] 5.3.3 Eventual Consistency — Base de eventual consistency
- [rec] 5.3.4 Quorums — Quorums permitem ajustar consistência por operação
- [rec] 6.3.1 Replication — Replicação é a origem das anomalias de consistência

**Desafios planejados**
- N1 · Conceitual — Classificar 8 funcionalidades de uma rede social pelo modelo de consistência necessário
- N2 · Entrevista — Escolher a consistência do estoque num e-commerce com reservas no checkout
- N3 · Identificação de bugs — Encontrar a anomalia causal: resposta de comentário visível antes do comentário original
- N3 · Conceitual — Calcular combinações de N, R e W para leitura forte e para alta disponibilidade de escrita
- N4 · Implementação — Implementar consistência entre pedido e estoque com Transactional Outbox e consumidor idempotente

**Critérios de conclusão**
- [ ] Atribuo e justifico um modelo de consistência para cada funcionalidade de um sistema dado
- [ ] Explico uma anomalia concreta de consistência eventual e como o usuário a perceberia
- [ ] Calculo configurações de quorum que garantem leitura da última escrita

#### 6.3.7 Availability

Availability mede a fração do tempo em que o sistema responde corretamente; é projetada com redundância, eliminação de dependências críticas e failover, e calculada para componentes em série e em paralelo. _(~60 min)_

**Objetivos**
- Calcular disponibilidade composta de componentes em série e em paralelo
- Relacionar disponibilidade a MTBF e MTTR e mostrar por que reduzir MTTR é eficaz
- Projetar redundância active-active e active-passive e comparar custos
- Definir disponibilidade em termos de SLI/SLO e orçamento de erro
- Avaliar disponibilidade multi-AZ e multi-região versus complexidade operacional

**Pré-requisitos**
- [rec] 3.3.6 SLI / SLO — SLI/SLO são a forma de medir disponibilidade
- [rec] 6.1.3 Non-Functional Requirements — Disponibilidade é um requisito não funcional central

**Desafios planejados**
- N1 · Conceitual — Calcular disponibilidade de 3 serviços de 99,9% em série e de 2 réplicas em paralelo
- N2 · Entrevista — Atingir 99,99% num serviço que depende de um banco de 99,95%
- N3 · Conceitual — Comparar o efeito de dobrar MTBF versus reduzir MTTR pela metade
- N3 · Análise de código — Analisar o grafo de dependências de um checkout e identificar o que derruba o SLO
- N4 · Programação — Implementar em Java uma calculadora de disponibilidade composta a partir de um grafo de dependências

**Critérios de conclusão**
- [ ] Calculo a disponibilidade de uma cadeia de 4 serviços em série e com redundância
- [ ] Explico por que adicionar dependências síncronas reduz a disponibilidade total
- [ ] Escolho entre active-active e active-passive para um caso concreto

#### 6.3.8 CAP Theorem

CAP Theorem afirma que, durante uma partição de rede, um sistema distribuído escolhe entre consistência e disponibilidade; PACELC estende a análise para o trade-off entre latência e consistência sem partição. _(~45 min)_

**Objetivos**
- Enunciar CAP corretamente e explicar por que P não é opcional em sistemas distribuídos
- Classificar sistemas reais (bancos, filas, coordenação) como CP ou AP durante partições
- Aplicar PACELC para discutir latência vs consistência em operação normal
- Identificar usos incorretos de CAP em argumentos de entrevista
- Escolher comportamento CP ou AP por funcionalidade e justificar

**Pré-requisitos**
- [rec] 6.3.6 Consistency — CAP é um caso específico do trade-off entre modelos de consistência
- [rec] 6.3.7 Availability — O A de CAP é diferente da disponibilidade operacional medida em noves

**Desafios planejados**
- N1 · Conceitual — Desmontar o mito do "escolha 2 de 3" com um cenário de partição de rede
- N2 · Entrevista — Decidir comportamento CP ou AP para carrinho, pagamento e catálogo durante partição
- N3 · Conceitual — Classificar PostgreSQL com réplica síncrona, Cassandra e ZooKeeper em PACELC
- N3 · Experimento — Simular partição num cluster Redis ou etcd com Docker e observar o comportamento
- N4 · Projeto — Escrever um ADR justificando escolhas CAP/PACELC para cada armazenamento de um sistema

**Critérios de conclusão**
- [ ] Explico CAP sem cair no erro de "escolher 2 de 3" livremente
- [ ] Classifico três sistemas conhecidos em PACELC com justificativa
- [ ] Decido o comportamento de uma funcionalidade durante partição de rede

#### 6.3.9 Hotspots

Hotspots são concentrações de carga numa chave, partição ou nó (celebridades, eventos virais, chaves sequenciais) que anulam a escala horizontal; são mitigados com salting, cache, replicação de leitura e redesenho da chave. _(~60 min)_

**Objetivos**
- Identificar fontes de hotspot: chaves populares, chaves monotônicas e distribuição Zipf
- Detectar hotspots com métricas por partição e por chave
- Mitigar hot writes com key salting e agregação local
- Mitigar hot reads com cache local, replicação de chave e CDN
- Explicar o custo de cada mitigação em complexidade de leitura e consistência

**Pré-requisitos**
- [rec] 6.3.3 Sharding — Hotspots surgem da escolha de shard key
- [rec] 6.3.4 Caching — Cache é a principal mitigação de hot reads

**Desafios planejados**
- N1 · Conceitual — Explicar a distribuição Zipf e por que 1% das chaves recebe a maior parte do tráfego
- N2 · Entrevista — Tratar o contador de likes de um post viral com 1M de likes por minuto
- N3 · Experimento — Gerar carga Zipf contra um sistema particionado simulado e medir a carga por partição
- N3 · Identificação de bugs — Encontrar o hotspot causado por shard key com prefixo de data
- N4 · Programação — Implementar contador distribuído com key salting e agregação periódica em Java + Redis

**Critérios de conclusão**
- [ ] Explico por que uma chave sequencial cria hotspot de escrita
- [ ] Proponho mitigação para hot read e para hot write com seus custos
- [ ] Sei quais métricas mostram que há um hotspot

#### 6.3.10 Single Point of Failure

Single Point of Failure é qualquer componente cuja falha derruba o sistema; eliminá-lo exige redundância em todas as camadas, incluindo dependências escondidas como DNS, configuração, certificados e pessoas. _(~45 min)_

**Objetivos**
- Mapear SPOFs em todas as camadas: rede, LB, aplicação, dados, configuração e terceiros
- Propor redundância para cada SPOF e avaliar custo versus risco
- Identificar SPOFs ocultos (certificados, DNS, coordenação, região única, deploy)
- Explicar como failover pode criar novos riscos (split-brain, thundering herd)
- Priorizar a eliminação de SPOFs pelo impacto no SLO

**Pré-requisitos**
- [rec] 6.3.7 Availability — SPOFs são o principal limitador da disponibilidade composta
- [rec] 6.1.9 Load Balancer — Redundância do próprio load balancer é um caso clássico

**Desafios planejados**
- N1 · Conceitual — Listar SPOFs em cada camada de uma aplicação web típica
- N2 · Identificação de bugs — Encontrar os 6 SPOFs, incluindo os ocultos, num diagrama de arquitetura
- N3 · Conceitual — Estudar um postmortem público e identificar o SPOF que causou o incidente
- N3 · Entrevista — Eliminar SPOFs de um sistema single-region sem dobrar o custo
- N4 · Experimento — Executar um game day local derrubando componentes um a um e registrar o impacto

**Critérios de conclusão**
- [ ] Encontro todos os SPOFs de um diagrama de referência, incluindo os não óbvios
- [ ] Proponho e priorizo mitigações com estimativa de custo
- [ ] Explico um risco introduzido pelo próprio mecanismo de failover

#### 6.3.11 Fault Tolerance

Fault tolerance sob a ótica de design: decidir quais falhas o sistema deve tolerar, projetar degradação graciosa, bulkheads e redundância por camada, e validar com testes de caos contra SLOs. _(~75 min)_

**Objetivos**
- Definir o modelo de falhas a tolerar (nó, AZ, região, dependência, dados corrompidos)
- Projetar degradação graciosa e fallbacks por funcionalidade
- Combinar timeouts, retries, circuit breakers e bulkheads de forma coerente numa cadeia de chamadas
- Evitar falhas em cascata e retry storms com orçamento de retry
- Validar tolerância a falhas com chaos engineering e medir contra SLO

**Pré-requisitos**
- [rec] 5.2.9 Fault Tolerance — Padrões de tolerância a falhas já estudados; aqui o foco é decidir o que tolerar e como no desenho
- [rec] 5.2.7 Circuit Breaker — Circuit breaker é peça central contra falhas em cascata
- [rec] 6.3.10 Single Point of Failure — Tolerância a falhas começa pela eliminação de SPOFs

**Desafios planejados**
- N1 · Conceitual — Diferenciar fault tolerance, alta disponibilidade e resiliência com exemplos
- N2 · Entrevista — Projetar degradação graciosa da home de um e-commerce quando o serviço de recomendações cai
- N3 · Identificação de bugs — Encontrar o retry storm causado por retries em todas as camadas com timeouts invertidos
- N3 · Experimento — Injetar latência com Toxiproxy numa dependência e medir o efeito com e sem bulkhead
- N4 · Implementação — Implementar fallback, bulkhead e orçamento de retry com Resilience4j numa cadeia de serviços Spring

**Critérios de conclusão**
- [ ] Defino o modelo de falhas e o comportamento degradado de cada funcionalidade de um sistema
- [ ] Configuro timeouts e retries numa cadeia de 3 serviços sem amplificação de carga
- [ ] Executei um experimento de falha e comparei o resultado ao esperado

### 6.4 Prática de System Design II (8 tópicos)

**[Adicional]** Segunda bateria de problemas, mais abertos e com maior exigência de deep dive: feed social, chat em tempo real, armazenamento distribuído e sistema de pagamentos. O módulo fecha com as habilidades transversais de uma entrevista de nível sênior — mock interviews cronometradas, explicação clara de trade-offs, identificação de gargalos e evolução da arquitetura conforme a escala cresce de milhares para centenas de milhões de usuários.

Objetivos do módulo:
- Resolver problemas abertos de grande escala com deep dives justificados por números
- Projetar fan-out, entrega em tempo real, replicação por quorum e consistência financeira em contextos concretos
- Garantir correção em pagamentos com idempotency keys, ledger de dupla entrada e reconciliação
- Conduzir e avaliar mock interviews cronometradas com rubrica explícita
- Comunicar trade-offs de forma estruturada: opções, critério, decisão e custo aceito
- Diagnosticar gargalos e planejar a evolução incremental de uma arquitetura por ordem de grandeza

#### 6.4.1 Feed / Social Network

Feed / Social Network exige gerar timelines personalizadas em baixa latência: fan-out on write vs on read, modelo híbrido para celebridades, armazenamento de grafo social, ranking e cache de timeline. _(~180 min)_

**Objetivos**
- Levantar requisitos (postar, seguir, timeline, likes) e estimar QPS de leitura de timeline e de escrita de posts para 300M DAU
- Comparar fan-out on write, fan-out on read e o modelo híbrido para contas com milhões de seguidores
- Projetar armazenamento de posts, grafo social e timelines pré-computadas em cache
- Estimar memória de timelines em cache (N posts por usuário ativo) e custo de fan-out
- Discutir paginação por cursor, ranking e consistência eventual da timeline
- Identificar gargalos (celebridades, hot posts) e a evolução da arquitetura com o crescimento

**Pré-requisitos**
- [rec] 6.1.4 Capacity Estimation — O fan-out é decidido com base em estimativas de leitura e escrita
- [rec] 6.3.4 Caching — Timelines pré-computadas dependem de cache em escala
- [rec] 6.3.9 Hotspots — Celebridades são o hotspot central do problema
- [rec] 6.3.5 Queues — O fan-out on write é executado de forma assíncrona por filas

**Desafios planejados**
- N1 · Conceitual — Comparar fan-out on write e on read em latência de leitura, custo de escrita e armazenamento
- N2 · Entrevista — Mock interview cronometrado de 45 minutos: timeline do Twitter com 300M DAU
- N2 · Programação — Implementar em Java o merge k-way de timelines ordenadas com PriorityQueue e paginação por cursor
- N3 · Conceitual — Calcular o custo de fan-out de um post de conta com 50M de seguidores e definir o limiar do híbrido
- N3 · Identificação de bugs — Encontrar duplicatas e itens perdidos numa paginação por offset de timeline
- N4 · Projeto — Construir um serviço de feed com fan-out on write via Kafka e timelines em Redis Sorted Sets

**Critérios de conclusão**
- [ ] Resolvo o problema em 45 minutos com estimativas e escolha de fan-out justificada
- [ ] Explico o modelo híbrido e o limiar para tratar uma conta como celebridade
- [ ] Calculo memória necessária para timelines em cache
- [ ] Implementei um merge de timelines em Java

#### 6.4.2 Chat / Realtime System

Chat / Realtime System exige conexões persistentes em escala: WebSockets, roteamento de mensagens entre servidores de conexão, ordenação por conversa, entrega offline, presença e confirmações de leitura. _(~180 min)_

**Objetivos**
- Levantar requisitos (1:1, grupos, histórico, presença, recibos) e estimar conexões simultâneas e mensagens/s
- Comparar polling, long polling, SSE e WebSocket para entrega em tempo real
- Projetar servidores de conexão stateful, registro de sessão e roteamento via pub/sub
- Garantir ordenação por conversa com IDs sequenciais por canal ou Snowflake IDs
- Projetar armazenamento de mensagens wide-column particionado por conversa e entrega offline com push
- Discutir presença com heartbeats, fan-out em grupos grandes e reconexão em massa

**Pré-requisitos**
- [rec] 5.1.3 Pub/Sub — Pub/sub roteia mensagens entre servidores de conexão
- [rec] 6.1.9 Load Balancer — Balancear conexões de longa duração exige estratégia específica
- [rec] 6.3.2 Partitioning — Mensagens são particionadas por conversa
- [rec] 6.2.4 Notification / Webhook System — Entrega offline reutiliza o sistema de notificações

**Desafios planejados**
- N1 · Conceitual — Comparar polling, long polling, SSE e WebSocket em latência, overhead e escalabilidade
- N2 · Entrevista — Mock interview cronometrado de 45 minutos: WhatsApp com 50M conexões simultâneas
- N2 · Programação — Implementar em Java um gerador Snowflake ID thread-safe com tratamento de clock skew
- N3 · Conceitual — Projetar a reconexão de 500k clientes após queda de servidor sem thundering herd
- N3 · Identificação de bugs — Encontrar a causa de mensagens fora de ordem ao usar timestamp do cliente
- N4 · Projeto — Construir chat em Spring WebSocket com múltiplas instâncias roteando via Redis Pub/Sub

**Critérios de conclusão**
- [ ] Resolvo o problema em 45 minutos com roteamento entre servidores de conexão explicado
- [ ] Explico como garanto ordem e ausência de duplicatas numa conversa
- [ ] Descrevo o que acontece quando um servidor com 500k conexões cai
- [ ] Implementei um gerador de IDs ordenáveis em Java

#### 6.4.3 Distributed Storage

Distributed Storage (key-value ou object storage) combina particionamento por consistent hashing, replicação com quorums, detecção de falhas, reparo anti-entropia e resolução de conflitos, no estilo Dynamo e S3. _(~210 min)_

**Objetivos**
- Levantar requisitos (get/put, tamanho de objetos, durabilidade de 11 noves, disponibilidade) e estimar capacidade e número de nós
- Projetar particionamento com consistent hashing e virtual nodes e replicação em N nós
- Configurar quorums R/W e explicar sloppy quorum e hinted handoff
- Explicar detecção de falhas com gossip e reparo com Merkle trees
- Comparar resolução de conflitos com vector clocks e last-write-wins
- Separar metadados e dados em object storage e discutir erasure coding versus replicação

**Pré-requisitos**
- [rec] 5.3.4 Quorums — Quorums são o mecanismo central de consistência ajustável
- [rec] 6.3.1 Replication — Escolha de topologia de replicação leaderless
- [req] 6.3.2 Partitioning — Consistent hashing é a base do posicionamento de dados
- [rec] 6.3.8 CAP Theorem — O sistema é desenhado como AP com consistência ajustável

**Desafios planejados**
- N1 · Conceitual — Explicar o caminho de um put com N=3, W=2 e um nó indisponível (hinted handoff)
- N2 · Entrevista — Mock interview cronometrado de 45 minutos: key-value store distribuído estilo Dynamo
- N2 · Programação — Implementar em Java comparação de Merkle trees para detectar divergência entre réplicas
- N3 · Conceitual — Comparar replicação 3x e erasure coding 6+3 em custo, durabilidade e latência de leitura
- N3 · Identificação de bugs — Encontrar a perda de escrita causada por last-write-wins com clock skew
- N4 · Projeto — Construir key-value store em Java com consistent hashing, replicação e quorum R/W configurável

**Critérios de conclusão**
- [ ] Resolvo o problema em 45 minutos cobrindo particionamento, replicação, falhas e conflitos
- [ ] Explico como o sistema continua aceitando escritas com um nó fora do ar
- [ ] Comparo custo de armazenamento de replicação 3x e erasure coding
- [ ] Implementei um key-value store com quorum simulado em Java

#### 6.4.4 Payment System

Payment System prioriza correção sobre latência: idempotency keys contra cobranças duplicadas, ledger de dupla entrada imutável, máquina de estados de pagamento, integração assíncrona com PSPs e reconciliação diária. _(~210 min)_

**Objetivos**
- Levantar requisitos (cobrar, estornar, consultar, payout) e NFRs de correção, auditoria e conformidade PCI
- Projetar idempotency keys de ponta a ponta para evitar cobrança dupla em retries e timeouts
- Modelar ledger de dupla entrada imutável onde a soma de débitos e créditos é sempre zero
- Projetar a máquina de estados do pagamento e o tratamento de callbacks assíncronos do PSP
- Projetar reconciliação entre ledger interno, PSP e extrato bancário e o tratamento de divergências
- Discutir consistência com sagas e outbox, valores monetários em BigDecimal/centavos e trilha de auditoria

**Pré-requisitos**
- [rec] 3.5.11 Idempotência — Idempotência de APIs é o primeiro requisito de correção
- [rec] 5.3.8 Transactional Outbox — Outbox garante publicação confiável de eventos de pagamento
- [rec] 5.3.9 Saga — Sagas coordenam cobrança, ledger e serviços dependentes
- [rec] 6.3.6 Consistency — Exige escolher consistência forte onde há dinheiro envolvido

**Desafios planejados**
- N1 · Conceitual — Explicar dupla entrada com os lançamentos de uma compra com taxa do PSP e estorno parcial
- N2 · Entrevista — Mock interview cronometrado de 45 minutos: sistema de pagamentos de um marketplace
- N2 · Programação — Implementar em Java um ledger imutável de dupla entrada com invariante de soma zero e BigDecimal
- N3 · Identificação de bugs — Encontrar a cobrança dupla causada por retry após timeout sem idempotency key persistida
- N3 · Conceitual — Projetar o job de reconciliação diária entre ledger, relatório do PSP e extrato bancário
- N4 · Projeto — Construir serviço de pagamentos em Spring com idempotency keys, máquina de estados, ledger e outbox

**Critérios de conclusão**
- [ ] Resolvo o problema em 45 minutos com idempotência, ledger e reconciliação explicados
- [ ] Explico o que acontece num timeout após o PSP ter cobrado e como evito cobrança dupla
- [ ] Modelo lançamentos de dupla entrada para cobrança, taxa e estorno
- [ ] Implementei um ledger em Java com invariante de soma zero testada

#### 6.4.5 Mock Interviews

Mock interviews cronometradas simulam a entrevista real de ponta a ponta, com rubrica de avaliação (requisitos, estimativas, desenho, profundidade, trade-offs, comunicação) e revisão estruturada para corrigir pontos fracos. _(~240 min)_

**Objetivos**
- Executar simulações completas de 45 minutos sem consultar material
- Aplicar uma rubrica de avaliação a si mesmo e a outros candidatos
- Atuar como entrevistador conduzindo perguntas de aprofundamento
- Registrar e acompanhar a evolução dos pontos fracos entre simulações
- Ajustar a profundidade conforme o nível da vaga (pleno, sênior, staff)

**Pré-requisitos**
- [req] 6.1.1 Como conduzir uma entrevista de System Design — A mock interview aplica o roteiro de condução da entrevista
- [rec] 6.2.1 URL Shortener — Ter resolvido problemas clássicos antes dá repertório para a simulação

**Desafios planejados**
- N1 · Conceitual — Construir a rubrica de avaliação com critérios e níveis por dimensão
- N2 · Entrevista — Mock interview cronometrado de 45 minutos: Google Drive (problema não praticado antes)
- N2 · Análise de código — Avaliar com a rubrica a gravação de uma entrevista de System Design pública
- N3 · Entrevista — Mock interview cronometrado de 45 minutos: Ticketmaster com venda concorrente de assentos
- N3 · Experimento — Conduzir uma simulação como entrevistador com perguntas de aprofundamento preparadas
- N4 · Projeto — Montar um diário de mock interviews com rubrica, pontuações e plano de melhoria por semana

**Critérios de conclusão**
- [ ] Completei ao menos 3 mock interviews cronometradas com problemas diferentes
- [ ] Avaliei cada simulação com rubrica escrita e registrei ações de melhoria
- [ ] Atuei como entrevistador ao menos uma vez
- [ ] Meu tempo nas fases iniciais está dentro do orçamento planejado

#### 6.4.6 Explicar trade-offs

Explicar trade-offs é a habilidade central avaliada em System Design: apresentar alternativas, critérios de decisão, a escolha feita e o custo aceito, ligando cada decisão a requisitos e números. _(~60 min)_

**Objetivos**
- Estruturar explicações no formato opções → critérios → decisão → custo aceito → quando mudaria
- Identificar o eixo de cada trade-off clássico (consistência vs disponibilidade, latência vs custo, simplicidade vs escala)
- Ligar cada trade-off a um requisito não funcional ou a uma estimativa
- Antecipar contra-argumentos do entrevistador e responder sem abandonar a decisão sem motivo
- Registrar decisões em ADRs com contexto, alternativas e consequências

**Pré-requisitos**
- [rec] 6.3.8 CAP Theorem — CAP/PACELC é o trade-off mais citado e mais mal explicado
- [rec] 6.3.6 Consistency — Consistência é eixo recorrente dos trade-offs

**Desafios planejados**
- N1 · Conceitual — Catalogar 10 trade-offs clássicos com o eixo de decisão de cada um
- N2 · Entrevista — Defender SQL vs NoSQL para um catálogo de produtos diante de contra-argumentos do entrevistador
- N2 · Análise de código — Reescrever justificativas vagas ("porque escala") em trade-offs estruturados
- N3 · Entrevista — Explicar em 2 minutos o trade-off de fan-out híbrido e quando voltaria a fan-out on read
- N4 · Projeto — Escrever 3 ADRs para decisões de um dos problemas práticos resolvidos na etapa

**Critérios de conclusão**
- [ ] Explico 5 trade-offs clássicos no formato estruturado em menos de 2 minutos cada
- [ ] Cada trade-off que apresento cita o requisito ou número que o decide
- [ ] Escrevi ao menos um ADR completo para uma decisão real ou simulada

#### 6.4.7 Identificar gargalos

Identificar gargalos é localizar o componente que limita throughput ou latência (CPU, I/O, banco, rede, locks, hot keys) usando estimativas e métricas, e propor a correção de menor custo antes de redesenhar tudo. _(~75 min)_

**Objetivos**
- Usar estimativas para prever qual componente satura primeiro
- Diagnosticar gargalos com métricas USE/RED, latência por percentil e profiling
- Distinguir gargalos de CPU, memória, I/O, rede, contenção de locks e pool de conexões
- Propor correções em ordem de custo: tuning, cache, índices, réplicas, filas, sharding
- Explicar como resolver um gargalo desloca o limite para o próximo componente

**Pré-requisitos**
- [rec] 6.1.4 Capacity Estimation — Estimativas permitem prever gargalos antes de medi-los
- [rec] 3.3.6 SLI / SLO — SLIs indicam quando um gargalo viola o objetivo
- [rec] 6.3.9 Hotspots — Hotspots são uma classe frequente de gargalo

**Desafios planejados**
- N1 · Conceitual — Aplicar métodos USE e RED para classificar sinais de saturação
- N2 · Entrevista — Encontrar o gargalo de um sistema de 20k QPS com um único PostgreSQL e pool de 50 conexões
- N3 · Experimento — Sob carga com k6, identificar via Actuator e profiler se o limite é CPU, pool ou banco
- N3 · Identificação de bugs — Encontrar o lock contencioso que limita o throughput de um serviço Java
- N4 · Projeto — Relatório de gargalos de um projeto próprio com medições antes e depois de cada correção

**Critérios de conclusão**
- [ ] Aponto o primeiro gargalo de um desenho dado usando apenas números
- [ ] Diagnostiquei um gargalo real com métricas e profiling e documentei a causa
- [ ] Proponho correções ordenadas por custo e explico o próximo gargalo

#### 6.4.8 Evoluir arquitetura conforme a escala

Evoluir a arquitetura conforme a escala é planejar a progressão de um monólito com um banco até um sistema distribuído multi-região, adicionando cada componente apenas quando um gargalo ou requisito o justifica. _(~90 min)_

**Objetivos**
- Descrever a evolução típica de 1k a 100M usuários e o gatilho de cada mudança
- Associar cada etapa (réplicas, cache, CDN, filas, sharding, multi-região) a um gargalo medido
- Planejar migrações incrementais sem downtime (strangler fig, dual-write, feature flags)
- Evitar overengineering explicando o custo operacional de cada componente adicionado
- Responder a "e se o tráfego crescer 10x?" com um plano concreto e priorizado

**Pré-requisitos**
- [rec] 6.4.7 Identificar gargalos — Cada passo de evolução é disparado por um gargalo identificado
- [rec] 6.3.3 Sharding — Sharding é um dos passos mais caros da evolução
- [rec] 6.1.8 Horizontal Scaling — Escala horizontal da aplicação é o primeiro passo típico

**Desafios planejados**
- N1 · Conceitual — Mapear a evolução de 1k para 100M usuários e o gatilho de cada componente
- N2 · Entrevista — Responder "e se crescer 10x?" para o URL Shortener e o Rate Limiter já desenhados
- N3 · Análise de código — Avaliar uma arquitetura superdimensionada para 10k usuários e propor a versão mínima
- N3 · Conceitual — Planejar a migração de monólito para serviços com strangler fig sem downtime
- N4 · Projeto — Documentar o roadmap arquitetural de um projeto próprio para 3 ordens de grandeza de crescimento

**Critérios de conclusão**
- [ ] Desenho a evolução de um sistema em 4 estágios de escala com o gatilho de cada um
- [ ] Respondo "e se crescer 10x?" para um problema praticado com plano priorizado
- [ ] Descrevo uma migração incremental sem downtime passo a passo

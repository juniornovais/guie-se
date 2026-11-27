## Montar uma tabela de latências cache/RAM/SSD/rede e explicar o impacto de cada salto

```meta
{"type": "conceptual", "level": 1, "required": true, "knowledge": ["Hierarquia de memória", "Latência", "DRAM", "SSD", "Rede"]}
```

### Enunciado

Monte, de memória e depois conferindo com fontes, uma tabela com a ordem de grandeza da latência de: registrador, L1, L2, L3, RAM, leitura aleatória em SSD NVMe, *seek* em HDD, ida e volta de rede dentro de um datacenter e ida e volta entre continentes. Em seguida, use a tabela para responder a três perguntas de projeto.

### Objetivo

Internalizar as ordens de grandeza da hierarquia de memória e de I/O, e usá-las para justificar decisões de arquitetura.

### Instruções

1. Monte a tabela com três colunas: operação, latência aproximada e "quantas vezes mais lento que o L1".
2. Crie uma quarta coluna em escala humana: se um acesso ao L1 levasse 1 segundo, quanto tempo levaria cada operação?
3. Responda: um endpoint faz 200 leituras de um `HashMap` local e uma chamada ao Redis. Qual parte domina o tempo?
4. Responda: por que uma busca em uma árvore com 1 milhão de nós espalhados pelo heap pode ser mais lenta que uma busca binária num array ordenado com o mesmo número de elementos, se ambas são O(log n)?
5. Responda: por que um banco de dados tenta manter o índice inteiro em RAM (buffer pool)?
6. Cite de onde vieram seus números e por que eles são aproximados.

### Dicas

- A tabela "Latency Numbers Every Programmer Should Know", popularizada por Jeff Dean e Peter Norvig, é o ponto de partida clássico; os números de disco e rede dela são antigos, então compare com fontes recentes.
- Entre cada nível da hierarquia, o salto é de cerca de uma ordem de grandeza (às vezes duas ou três).
- Na pergunta 3, compare 200 × (algumas dezenas de ns) com uma ida e volta de rede de algumas centenas de µs.

### Critérios de avaliação

- A tabela tem todas as operações pedidas, com ordens de grandeza corretas (L1 ~1 ns, RAM ~100 ns, SSD dezenas de µs, HDD ms, rede local centenas de µs, intercontinental ~100 ms).
- A coluna em escala humana está coerente com as razões.
- A resposta 3 identifica que a chamada de rede domina por ordens de grandeza.
- A resposta 4 usa localidade e cache misses (cada nó um miss provável, contra acessos que convergem para a mesma região do array).
- A resposta 5 relaciona RAM vs SSD e o custo de cada I/O de página.
- Indica que os números são aproximados e variam por hardware, citando a origem.

### Solução de referência

Valores **aproximados** de ordem de grandeza, compilados de documentação de fabricantes (Intel, AMD), da tabela de Dean/Norvig e de medições publicadas. Variam por geração de hardware e configuração.

| Operação | Latência aproximada | × L1 | Se L1 = 1 s |
|---|---|---|---|
| Registrador | < 0,3 ns | < 1× | instantâneo |
| L1 | ~1 ns | 1× | 1 s |
| L2 | ~4 ns | ~4× | 4 s |
| L3 | ~15 ns | ~15× | 15 s |
| RAM (DRAM) | ~100 ns | ~100× | ~1,5 min |
| Leitura aleatória 4 KB em SSD NVMe | ~50 µs | ~50.000× | ~14 horas |
| Ida e volta no mesmo datacenter | ~500 µs | ~500.000× | ~6 dias |
| *Seek* + leitura em HDD | ~5 ms | ~5.000.000× | ~2 meses |
| Ida e volta São Paulo ↔ Europa | ~150 ms | ~150.000.000× | ~5 anos |

**Impacto de cada salto.** De L1 para RAM (~100×), o custo vem de sair do chip: o dado viaja até o controlador de memória e a DRAM precisa ativar uma linha. De RAM para SSD (~500×), entra o SO (system call, driver, fila do dispositivo) e a física da flash. De RAM para rede, somam-se a pilha TCP/IP dos dois lados, serialização e a distância física (a luz na fibra percorre ~200 km por milissegundo, então cruzar um oceano tem um piso físico de dezenas de ms).

**3.** 200 leituras de `HashMap` local, cada uma com alguns acessos à memória (talvez alguns misses), somam da ordem de 200 × 50-100 ns = 10-20 µs. A chamada ao Redis custa centenas de µs só de rede, mesmo com o Redis respondendo em microssegundos. A chamada remota domina por uma ou duas ordens de grandeza. Daí a prática de caches locais (Caffeine) na frente de caches remotos para dados muito quentes.

**4.** Ambas fazem ~20 comparações (log₂ 1.000.000 ≈ 20). Na árvore com nós espalhados, cada passo segue um ponteiro para um lugar imprevisível: são ~20 misses prováveis em série, cada um com custo de até ~100 ns. Na busca binária, os primeiros passos também saltam pela memória, mas os últimos acontecem dentro de poucas linhas de cache vizinhas, e as posições centrais mais visitadas tendem a ficar no cache entre buscas. Não há objeto por elemento, header nem indireção.

**5.** Uma consulta por índice B-tree visita algumas páginas (raiz, nós internos, folha). Se elas estão em RAM, cada visita custa nanossegundos a microssegundos; se precisam vir do SSD, cada uma custa dezenas de µs, e de um HDD, milissegundos. Manter o *working set* em RAM transforma uma consulta de milissegundos numa de microssegundos. É por isso que o tamanho do buffer pool (`innodb_buffer_pool_size`, `shared_buffers`) é o primeiro parâmetro de tuning de um banco.

## Observar com ferramentas do SO (top, Task Manager, free) o consumo de RAM de uma aplicação Java ao alocar arrays grandes

```meta
{"type": "experiment", "level": 2, "required": true, "knowledge": ["RSS", "Heap da JVM", "Memória virtual", "Ferramentas do SO", "-Xmx"]}
```

### Enunciado

Escreva um programa Java que aloque arrays grandes em etapas, pausando entre elas, e observe com ferramentas do sistema operacional como a memória do processo e a memória do sistema evoluem. Compare o que o SO mostra com o que a própria JVM reporta.

### Objetivo

Distinguir heap usado, heap comprometido, `-Xmx` e memória residente do processo, e aprender a ler as ferramentas de memória do seu SO.

### Instruções

1. Escreva um programa que imprima o PID e, em etapas, aloque 8 blocos de `byte[100 MB]`, guardando-os numa lista. Pause (esperando ENTER) no início, após as alocações e após limpar a lista e chamar `System.gc()`.
2. Em cada etapa, imprima `Runtime.totalMemory()`, `freeMemory()` e `maxMemory()`.
3. Rode com `java -Xmx1g Alocador`. Em cada pausa, observe o processo:
   - Linux: `top -p <pid>` (coluna RES), `free -h` (coluna `available`) e `cat /proc/<pid>/status | grep -E 'VmRSS|VmSize'`;
   - macOS: Monitor de Atividade ou `top -pid <pid>`;
   - Windows: Gerenciador de Tarefas, aba Detalhes, colunas "Memória (conjunto de trabalho privado)" e "Tamanho da confirmação".
4. Anote numa tabela: heap usado, heap comprometido, RSS (ou conjunto de trabalho) e memória virtual (VIRT/VmSize ou tamanho da confirmação).
5. Repita com `java -Xms1g -Xmx1g -XX:+AlwaysPreTouch Alocador` e compare a etapa inicial.
6. Explique: por que VIRT é muito maior que RES? Por que RES é maior que o heap usado? A memória volta ao SO depois do GC?

### Dicas

- `new byte[n]` é zerado pela JVM, então as páginas do array são de fato tocadas e passam a ocupar RAM física.
- A JVM reserva espaço de endereçamento para o heap máximo logo no início, mas o SO só entrega páginas físicas quando são tocadas.
- Depois de um GC completo, o G1 pode reduzir o heap comprometido e devolver memória ao SO; um GC parcial normalmente não faz isso de imediato.

### Critérios de avaliação

- O programa aloca em etapas, mantém referências, pausa e imprime as métricas da JVM.
- A tabela compara pelo menos três momentos com métricas da JVM e do SO.
- Explica que a memória virtual inclui reservas não tocadas (heap máximo, stacks, code cache), por isso é muito maior que a residente.
- Explica que o RSS inclui memória fora do heap (Metaspace, code cache, stacks, GC, bibliotecas), por isso supera o heap usado.
- Compara corretamente o efeito de `-Xms` igual a `-Xmx` com `AlwaysPreTouch` (RSS alto desde o início).
- Descreve o que observou após o `System.gc()` e explica por que a memória pode ou não ter sido devolvida.

### Solução de referência

```java
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class Alocador {
    static final int MB = 1024 * 1024;

    static void status(String etapa) {
        Runtime rt = Runtime.getRuntime();
        System.out.printf("%-32s heap usado %5d MB | heap comprometido %5d MB | máximo %5d MB%n",
            etapa,
            (rt.totalMemory() - rt.freeMemory()) / MB,
            rt.totalMemory() / MB,
            rt.maxMemory() / MB);
    }

    static void esperar(Scanner in, String msg) {
        System.out.println(">> " + msg + " — observe o SO e pressione ENTER");
        in.nextLine();
    }

    public static void main(String[] args) {
        System.out.println("PID: " + ProcessHandle.current().pid());
        Scanner in = new Scanner(System.in);
        List<byte[]> blocos = new ArrayList<>();
        status("início");
        esperar(in, "início");

        for (int i = 1; i <= 8; i++) {
            byte[] bloco = new byte[100 * MB];    // a JVM zera o array: as páginas são tocadas
            blocos.add(bloco);
            status("após alocar " + (i * 100) + " MB");
        }
        esperar(in, "800 MB alocados e referenciados");

        blocos.clear();
        status("após clear() (ainda sem GC)");
        System.gc();
        status("após System.gc()");
        esperar(in, "referências removidas e GC executado");
    }
}
```

Saída ilustrativa da JVM (Java 21, G1, Windows, ~20 GB de RAM; seus valores serão diferentes):

```text
início                           heap usado     2 MB | heap comprometido   316 MB | máximo  1024 MB
após alocar 300 MB               heap usado   304 MB | heap comprometido   509 MB | máximo  1024 MB
após alocar 800 MB               heap usado   810 MB | heap comprometido  1024 MB | máximo  1024 MB
após clear() (ainda sem GC)      heap usado   810 MB | heap comprometido  1024 MB | máximo  1024 MB
após System.gc()                 heap usado     1 MB | heap comprometido     8 MB | máximo  1024 MB
```

Tabela típica do que se observa (valores ilustrativos):

| Momento | Heap usado | Heap comprometido | RSS / conjunto de trabalho | Virtual |
|---|---|---|---|---|
| Início | ~2 MB | ~316 MB | ~40-60 MB | vários GB |
| 800 MB alocados | ~810 MB | 1024 MB | ~850-900 MB | vários GB |
| Após `System.gc()` | ~1 MB | ~8 MB | cai para dezenas de MB (às vezes com atraso) | vários GB |

**Interpretação:**

- **Virtual ≫ residente.** No início, a JVM reserva espaço de endereçamento para o heap máximo, para as stacks de dezenas de threads internas, o code cache e o Metaspace. Reservar não consome RAM; só as páginas tocadas viram memória física. No Linux, VIRT costuma mostrar alguns GB mesmo para um programa trivial.
- **Comprometido ≠ residente.** No início, o heap comprometido é de ~316 MB (o `-Xms` padrão é 1/64 da RAM física), mas o RSS é bem menor, porque o heap comprometido ainda não foi tocado. Ao alocar os arrays, a JVM os zera, as páginas são tocadas e o RSS cresce junto com o heap usado.
- **RSS > heap usado.** Mesmo com 810 MB de heap usado, o RSS é maior: há a memória do JIT (code cache), Metaspace, as estruturas internas do G1 (remembered sets, card table), as stacks das threads e as bibliotecas nativas carregadas. Para ver a divisão exata, rode com `-XX:NativeMemoryTracking=summary` e use `jcmd <pid> VM.native_memory summary`.
- **Com `-Xms1g -XX:+AlwaysPreTouch`**, a JVM toca todas as páginas do heap na inicialização: o RSS já começa em ~1 GB e o startup fica mais lento. Em produção, isso evita a latência de *page faults* durante o tráfego e garante que a memória realmente existe desde o começo.
- **Após o `System.gc()`**, os arrays deixam de ser alcançáveis e o heap usado cai. Nesta execução, o GC completo do G1 também reduziu o heap comprometido e devolveu memória ao SO, por isso o RSS caiu. Isso não é garantido: depende do coletor, da versão e de flags como `-XX:G1PeriodicGCInterval`. Muitas JVMs em produção mantêm o RSS alto depois de um pico, o que é normal e não indica vazamento.
- **Memória do sistema.** No Linux, `free -h` mostra `available` diminuindo ~800 MB durante a alocação e voltando depois. A coluna `buff/cache` não diminui necessariamente: o SO só descarta page cache se precisar.

## Calcular o tamanho em memória de um objeto Java com campos mistos considerando header e padding

```meta
{"type": "code_analysis", "level": 3, "required": false, "knowledge": ["Header de objeto", "Compressed oops", "Alinhamento", "Padding", "Shallow size"]}
```

### Enunciado

Calcule, sem executar, o tamanho raso (*shallow size*) de cada objeto abaixo numa HotSpot de 64 bits com as configurações padrão (heap menor que 32 GB, compressed oops e compressed class pointers ativos, alinhamento de 8 bytes). Depois calcule quanto ocupa, no total, um `ArrayList<Leitura>` com 1.000 leituras.

```java
class Leitura {
    boolean valida;
    long timestamp;
    byte sensor;
    Object origem;
    int valor;
}

class Ponto {
    int x;
    int y;
}

class Sozinho {
    byte b;
}
```

### Objetivo

Aplicar as regras de header, alinhamento de campos e padding da JVM, e entender quanto do consumo de memória de uma aplicação Java é overhead de representação.

### Instruções

1. Lembre o tamanho do header de objeto nessas configurações.
2. Para cada classe, determine onde cada campo provavelmente fica (offset), considerando que a JVM reordena campos e alinha cada tipo pelo próprio tamanho.
3. Arredonde o total para múltiplo de 8.
4. Para o `ArrayList<Leitura>` com 1.000 elementos e capacidade exata 1.000, some: o objeto `ArrayList`, o array `Object[]` interno e os 1.000 objetos `Leitura` (ignore o objeto `origem`).
5. Calcule o percentual de "dados úteis" de `Leitura` em relação ao tamanho total.
6. Explique como o tamanho de `Leitura` muda com `-XX:-UseCompressedOops`.
7. Opcional: confira com a biblioteca JOL (`org.openjdk.jol:jol-core:0.17`).

### Dicas

- O header tem 8 bytes de *mark word* + 4 bytes de ponteiro de classe comprimido. Que tamanho de campo cabe na lacuna até o offset 16?
- Campos de 8 bytes precisam estar em offsets múltiplos de 8; referências comprimidas, em múltiplos de 4.
- Um array tem header de 16 bytes (12 + 4 do campo de tamanho), e cada referência comprimida ocupa 4 bytes.

### Critérios de avaliação

- Usa header de 12 bytes e alinhamento final de 8 bytes.
- `Leitura` = 32 bytes, com uma disposição de campos coerente.
- `Ponto` = 24 bytes e `Sozinho` = 16 bytes.
- Total do `ArrayList` com 1.000 elementos calculado corretamente (~36 KB).
- Calcula o percentual de dados úteis (18 de 32 bytes, ~56%).
- Explica que sem compressed oops a referência passa a 8 bytes e `Leitura` vai a 40 bytes (e o array interno dobra).

### Solução de referência

**`Leitura`** (offsets medidos numa HotSpot 21 com configurações padrão; verifique na sua com JOL):

```text
offset tam  campo
  0     8   mark word
  8     4   class pointer comprimido
 12     4   int valor            ← preenche a lacuna antes do offset 16
 16     8   long timestamp       ← precisa de offset múltiplo de 8
 24     1   boolean valida
 25     1   byte sensor
 26     2   (lacuna)
 28     4   Object origem        ← referência comprimida, múltiplo de 4
 32         total = 32 bytes
```

Dados úteis: 1 + 8 + 1 + 4 + 4 = 18 bytes, ou ~56% de 32. O resto é header (12) e lacuna (2).

**`Ponto`**: header 12 + `x` no offset 12 + `y` no offset 16 = 20 bytes → arredonda para **24 bytes**. Com cabeçalhos compactos (`-XX:+UseCompactObjectHeaders`, experimental no JDK 24+), o header cai para 8 bytes e `Ponto` passa a 16.

**`Sozinho`**: header 12 + 1 byte = 13 → **16 bytes**. Um único `byte` custa 16 bytes de heap.

**`ArrayList<Leitura>` com 1.000 elementos:**

| Parte | Cálculo | Bytes |
|---|---|---|
| Objeto `ArrayList` | header 12 + `modCount` (int) 4 + `size` (int) 4 + `elementData` (ref) 4 = 24 | 24 |
| `Object[1000]` | header 16 + 1.000 × 4 | 4.016 → 4.016 (já múltiplo de 8) |
| 1.000 × `Leitura` | 1.000 × 32 | 32.000 |
| **Total** | | **~36.040 bytes (~35 KB)** |

Os dados úteis são 1.000 × 18 = 18.000 bytes: metade do total é overhead de representação. Se a capacidade não fosse exata, o array interno teria folga (o `ArrayList` cresce em ~50% a cada redimensionamento).

**Sem compressed oops** (`-XX:-UseCompressedOops`, ou automaticamente com heap ≥ ~32 GB): a referência `origem` passa a ter 8 bytes e precisa de offset múltiplo de 8. Os campos ficam: `valor` em 12, `timestamp` em 16, `valida` em 24, `sensor` em 25, `origem` em 32 → total 40 bytes. O `Object[1000]` passa a ter 1.000 × 8 bytes. É por isso que se recomenda não configurar heaps um pouco acima de 32 GB: perde-se a compressão e a memória efetiva pode até diminuir.

Para conferir com JOL:

```java
// dependência: org.openjdk.jol:jol-core:0.17
import org.openjdk.jol.info.ClassLayout;
import org.openjdk.jol.info.GraphLayout;

System.out.println(ClassLayout.parseClass(Leitura.class).toPrintable());
System.out.println(GraphLayout.parseInstance(lista).totalSize());   // tamanho retido do grafo
```

## Explicar o que acontece quando um container com limite de 512 MB roda uma JVM com -Xmx de 1 GB

```meta
{"type": "interview", "level": 3, "required": false, "knowledge": ["cgroups", "OOM killer", "OutOfMemoryError", "Memória fora do heap", "MaxRAMPercentage"]}
```

### Enunciado

Em uma entrevista, perguntam: *"Um serviço Java roda no Kubernetes com limite de memória de 512 MiB e foi configurado com `-Xmx1g`. O que acontece? Como você diagnosticaria e como corrigiria?"*

Escreva a resposta como faria na entrevista.

### Objetivo

Diferenciar os limites impostos pela JVM e pelo kernel, e saber dimensionar corretamente a memória de uma JVM em container.

### Instruções

1. Descreva o que acontece na inicialização da JVM.
2. Descreva o que acontece conforme a aplicação recebe carga e o heap cresce.
3. Explique quem mata o processo, como e o que se observa (logs, status do pod, código de saída).
4. Compare com um `OutOfMemoryError`.
5. Proponha a correção, incluindo a memória fora do heap.

### Dicas

- O `-Xmx` só reserva espaço virtual; o limite do cgroup conta memória física efetivamente usada.
- A detecção automática de container da JVM só define valores **padrão**; um `-Xmx` explícito prevalece.
- O código de saída 137 é 128 + 9. Que sinal é o 9?

### Critérios de avaliação

- Explica que a JVM inicia normalmente, pois reservar 1 GB de espaço virtual não ultrapassa o limite.
- Explica que, conforme heap e memória nativa são tocados, o uso físico ultrapassa 512 MiB e o kernel (OOM killer do cgroup) mata o processo com SIGKILL.
- Cita os sinais observáveis: `OOMKilled`, exit code 137, ausência de stack trace e de heap dump, restarts em loop.
- Diferencia de `OutOfMemoryError` (lançado pela JVM quando o heap dela se esgota, com o processo ainda vivo).
- Propõe heap como fração do limite (`-XX:MaxRAMPercentage` ou `-Xmx` bem abaixo do limite) e considera Metaspace, stacks, code cache e buffers diretos.

### Solução de referência

"Na inicialização, nada de errado acontece. A JVM **reserva** 1 GB de espaço de endereçamento para o heap, mas reservar não é usar: o cgroup conta páginas físicas efetivamente ocupadas. O heap comprometido inicial é pequeno e a aplicação sobe.

Sob carga, o heap cresce. Como o `-Xmx` permite até 1 GB, o GC não tem pressa em coletar: ele expande o heap antes de fazer coletas mais agressivas. Some-se a isso a memória fora do heap, que é Metaspace, code cache, as stacks das threads, as estruturas do GC e buffers diretos do Netty, que facilmente somam 100 a 200 MB. Em algum momento, o uso físico total do processo ultrapassa os 512 MiB.

Quem age não é a JVM, é o **kernel**. O controlador de memória do cgroup tenta recuperar páginas e, sem conseguir, aciona o OOM killer, que mata o processo com `SIGKILL`. Não há chance de reação: nada de exceção, de log da JVM, nem de *heap dump*. O que se vê é o pod com `Last State: Terminated, Reason: OOMKilled, Exit Code: 137` (128 + 9, sinal SIGKILL) e reinícios em sequência. O padrão costuma ser 'funciona por um tempo e morre sob carga'.

Isso é diferente de um `OutOfMemoryError`: este é a JVM dizendo que o **heap dela** chegou ao `-Xmx` e não há mais espaço após o GC. O processo continua vivo, há stack trace e, com `-XX:+HeapDumpOnOutOfMemoryError`, um dump para análise. Paradoxalmente, nesse cenário seria melhor ter um `OutOfMemoryError`.

A JVM é container-aware desde o JDK 10 (backport no 8u191): ela lê o limite do cgroup e, sem `-Xmx`, usa `MaxRAMPercentage`, que vale 25% por padrão. Mas um `-Xmx` explícito **sobrescreve** essa detecção.

Para corrigir, eu removeria o `-Xmx` fixo e usaria `-XX:MaxRAMPercentage=60` a `75`, ou um `-Xmx` em torno de 300 a 350 MB, deixando espaço para a memória nativa. Também limitaria o que cresce fora do heap quando fizer sentido: `-XX:MaxMetaspaceSize`, `-XX:MaxDirectMemorySize`, `-Xss` se houver muitas threads. Para diagnosticar, ativaria o Native Memory Tracking e compararia o RSS do processo com o heap usado. Se o serviço realmente precisa de 1 GB de heap, o caminho é aumentar o limite do container, não mentir para a JVM."

## Medir a largura de banda de memória copiando grandes blocos de bytes e comparar com o valor nominal do hardware

```meta
{"type": "experiment", "level": 4, "required": false, "knowledge": ["Largura de banda", "DDR", "Canais de memória", "Hierarquia de cache", "Paralelismo de memória"]}
```

### Enunciado

Construa um pequeno benchmark em Java que meça a largura de banda de cópia de memória com `System.arraycopy`, variando o tamanho do bloco (de 16 KB até 256 MB) e o número de threads. Compare os resultados com a largura de banda teórica da memória da sua máquina e explique as diferenças.

### Objetivo

Medir na prática a diferença entre largura de banda de cache e de DRAM, entender como calcular o valor nominal da RAM e por que um núcleo sozinho raramente o alcança.

### Instruções

1. Descubra a configuração da sua RAM: tipo (DDR4/DDR5/LPDDR), velocidade (MT/s) e número de canais. Linux: `sudo dmidecode -t memory`; Windows: Gerenciador de Tarefas → Desempenho → Memória, ou `wmic memorychip get speed,capacity`; macOS: "Sobre este Mac" e especificações do chip.
2. Calcule a largura de banda teórica: MT/s × 8 bytes × número de canais de 64 bits (no DDR5, cada módulo tem dois subcanais de 32 bits, o que dá o mesmo total por módulo).
3. Implemente a medição: dois `byte[]` do mesmo tamanho, preencha ambos antes de medir, copie repetidamente e calcule `GB/s = 2 × tamanho × repetições ÷ tempo` (leitura + escrita).
4. Meça para blocos de 16 KB, 256 KB, 4 MB, 32 MB e 256 MB, com aquecimento e o melhor de várias rodadas.
5. Meça com 1, 2, 4 e N threads (N = núcleos lógicos), cada uma copiando seus próprios blocos grandes.
6. Faça um gráfico ou tabela e explique: por que blocos pequenos são tão rápidos? Onde está o "joelho" da curva? Quanto do valor teórico você atingiu com 1 thread e com N?

### Dicas

- Compare os tamanhos de bloco com os tamanhos de L1, L2 e L3 da sua CPU (no Linux, `lscpu`; no Windows, o Gerenciador de Tarefas mostra L1/L2/L3 na aba de CPU).
- Cada núcleo consegue manter só um número limitado de misses pendentes ao mesmo tempo. Banda ≈ misses simultâneos × 64 bytes ÷ latência.
- Escrever num endereço que não está no cache normalmente exige trazer a linha primeiro (*read for ownership*), então uma cópia pode gerar mais tráfego real que `2 × tamanho`.
- Use `-Xmx` suficiente para os arrays; notebooks em modo de economia de energia reduzem o desempenho de memória.

### Critérios de avaliação

- Calcula corretamente a banda teórica a partir de MT/s, largura do canal e número de canais.
- O benchmark pré-toca os arrays, aquece, repete e reporta o melhor resultado.
- A tabela mostra banda muito maior para blocos que cabem no L1/L2 e uma queda nítida quando o bloco excede o L3.
- Compara a banda com 1 thread e com várias threads e explica o limite por núcleo (misses pendentes, latência).
- Explica por que o valor medido fica abaixo do nominal (overhead de protocolo, refresh, row conflicts, RFO, contagem de tráfego).

### Solução de referência

```java
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class Banda {
    static final int MB = 1024 * 1024;

    /** Copia 'origem' em 'destino' 'repeticoes' vezes e devolve GB/s (contando leitura + escrita). */
    static double medirCopia(byte[] origem, byte[] destino, int repeticoes) {
        long inicio = System.nanoTime();
        for (int r = 0; r < repeticoes; r++) {
            System.arraycopy(origem, 0, destino, 0, origem.length);
        }
        double segundos = (System.nanoTime() - inicio) / 1e9;
        double bytesMovidos = 2.0 * origem.length * repeticoes;   // lê origem + escreve destino
        return bytesMovidos / segundos / 1e9;
    }

    static double medirTamanho(int tamanhoBytes, long totalAlvo) {
        byte[] a = new byte[tamanhoBytes];
        byte[] b = new byte[tamanhoBytes];
        Arrays.fill(a, (byte) 1);                 // toca todas as páginas antes de medir
        Arrays.fill(b, (byte) 2);
        int reps = (int) Math.max(1, totalAlvo / tamanhoBytes);
        medirCopia(a, b, reps);                   // aquecimento
        double melhor = 0;
        for (int i = 0; i < 5; i++) melhor = Math.max(melhor, medirCopia(a, b, reps));
        return melhor;
    }

    static double medirParalelo(int threads, int tamanhoPorThread, int reps) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<byte[][]> buffers = new ArrayList<>();
        for (int t = 0; t < threads; t++) {
            byte[] a = new byte[tamanhoPorThread], b = new byte[tamanhoPorThread];
            Arrays.fill(a, (byte) 1); Arrays.fill(b, (byte) 2);
            buffers.add(new byte[][] {a, b});
        }
        double melhor = 0;
        for (int rodada = 0; rodada < 4; rodada++) {
            List<Future<?>> fs = new ArrayList<>();
            long inicio = System.nanoTime();
            for (byte[][] buf : buffers)
                fs.add(pool.submit(() -> { for (int r = 0; r < reps; r++) System.arraycopy(buf[0], 0, buf[1], 0, buf[0].length); }));
            for (Future<?> f : fs) f.get();
            double s = (System.nanoTime() - inicio) / 1e9;
            double gbs = 2.0 * tamanhoPorThread * reps * threads / s / 1e9;
            if (rodada > 0) melhor = Math.max(melhor, gbs);  // rodada 0 = aquecimento
        }
        pool.shutdown();
        return melhor;
    }

    public static void main(String[] args) throws Exception {
        long alvo = 4L * 1024 * MB;  // ~4 GB copiados por medição
        int[] tamanhosKb = {16, 256, 4 * 1024, 32 * 1024, 256 * 1024};
        System.out.println("Cópia de um único thread (melhor de 5):");
        for (int kb : tamanhosKb) {
            System.out.printf("  bloco %8d KB -> %6.1f GB/s%n", kb, medirTamanho(kb * 1024, alvo));
        }
        int nucleos = Runtime.getRuntime().availableProcessors();
        int[] contagens = java.util.stream.IntStream.of(1, 2, 4, nucleos)
            .filter(t -> t <= nucleos).distinct().toArray();
        for (int t : contagens) {
            System.out.printf("Paralelo, %2d threads x 32 MB -> %6.1f GB/s%n", t, medirParalelo(t, 32 * MB, 20));
        }
    }
}
```

Rode com `java -Xmx3g Banda` (com muitos núcleos, ajuste o `-Xmx`: cada thread usa 64 MB).

**Resultado ilustrativo** de um notebook comum (Java 21, Windows; seus valores serão diferentes):

```text
Cópia de um único thread (melhor de 5):
  bloco       16 KB ->  181,7 GB/s
  bloco      256 KB ->   57,2 GB/s
  bloco     4096 KB ->   11,7 GB/s
  bloco    32768 KB ->   10,9 GB/s
  bloco   262144 KB ->   10,3 GB/s
Paralelo,  1 threads x 32 MB ->   10,1 GB/s
Paralelo,  2 threads x 32 MB ->   10,1 GB/s
Paralelo,  4 threads x 32 MB ->   10,3 GB/s
```

**Valor teórico.** Exemplo: DDR4-3200 em dois canais = 3.200 × 10⁶ × 8 B × 2 = 51,2 GB/s. Com um único canal (comum em notebooks com um só módulo), 25,6 GB/s.

**Interpretação:**

- **16 KB** cabe no L1d: os dois arrays somam 32 KB, e a cópia roda na velocidade das unidades de load/store com instruções vetoriais. Centenas de GB/s são possíveis.
- **256 KB** cabe no L2: ainda rápido, mas menos.
- **4 MB a 256 MB** excedem o L2 e logo o L3: o "joelho" da curva aparece quando o conjunto de trabalho passa do tamanho do último nível de cache, e a medição passa a refletir a DRAM.
- **Fração do nominal.** Os ~10 GB/s medidos são uma fração do teórico. Os motivos: (1) um núcleo só sustenta um número limitado de misses pendentes; com ~100 ns de latência, isso limita a banda de uma thread; (2) a contagem `2 × tamanho` subestima o tráfego real, porque escrever no destino exige ler a linha antes (RFO), totalizando ~3 × tamanho, a menos que a implementação use *non-temporal stores*; (3) a DRAM perde ciclos com refresh, troca entre leitura e escrita no barramento e conflitos de linha; (4) notebooks podem ter um único canal e limitar a frequência para economizar energia.
- **Várias threads.** Em desktops e servidores com vários canais, mais threads costumam aumentar a banda até saturar os canais (às vezes chegando a 70%-90% do nominal). Nesta máquina, a banda não aumentou com mais threads, sinal de que o barramento já estava saturado por uma thread, típico de memória de canal único. Esse é um resultado legítimo e deve ser explicado, não escondido.

**Para ir além:** compare com ferramentas dedicadas, como o STREAM benchmark (C, multiplataforma) ou o Intel Memory Latency Checker (`mlc`), que medem latência e banda com mais controle.

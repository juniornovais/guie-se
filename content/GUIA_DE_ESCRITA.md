# Guia de escrita de conteúdo

Como escrever o conteúdo técnico (`content.md`) e os desafios (`challenges.md`) de um tópico. Vale para pessoas e agentes. O modelo de referência é `content/topics/1.1.7/` (e os demais tópicos da Etapa 01).

## Fontes obrigatórias por tópico

- `content/ROADMAP_JAVA_BACKEND.md`: fonte oficial. Não altere.
- `content/meta/0X.json` → `topics["<chave>"]`:
  - `objectives`: o conteúdo **deve cobrir todos**.
  - `plannedChallenges`: implemente **todos**, com **o mesmo título, level e type, na mesma ordem**.
  - `checklist` e `prerequisites`: usados como referência de escopo e de ligação entre tópicos.
- `docs/instrucoes/01-contexto.md`: exigências pedagógicas (seções 3 e 6).

## Profundidade exigida

Explicar como funciona internamente, como é implementado, que problemas resolve, quais são as limitações, os custos computacionais (tempo, espaço, constantes, cache) e o uso em sistemas reais. Nada de definições de uma linha. Conecte com Java e a JVM sempre que fizer sentido. Ao remeter a outro tópico, cite a chave (ex.: "tópico 4.1.8") em vez de reexplicar.

## content.md

- 7 a 12 seções `## Título`, em progressão: problema → funcionamento interno → detalhes → custos e limitações → uso real. Os títulos começam com letra maiúscula.
- Prefixos especiais: `## Exemplo: Título`, `## Diagrama: Título` (diagrama ASCII em bloco ```` ```text ````) e `## [Adicional] Título` (complemento além do escopo do roadmap). Cada tópico precisa de **pelo menos 1 Exemplo e 1 Diagrama**.
- Sem `# ` (h1). Use parágrafos, listas, tabelas, blocos de código com linguagem (`java`, `c`, `text`, `bash`) e `###` para subseções.
- Alvo: 1.800 a 3.000 palavras de texto.

## challenges.md

Um desafio por `## Título` (idêntico ao `plannedChallenges`):

````markdown
## Título idêntico ao inventário

```meta
{"type": "coding", "level": 2, "required": true, "knowledge": ["Two pointers", "Arrays"]}
```

### Enunciado
### Objetivo
### Instruções
### Dicas
- dica 1 (sutil)
- dica 2
- dica 3 (mais reveladora)
### Critérios de avaliação
- critério verificável
### Solução de referência
````

- As subseções aceitas são exatamente: Enunciado, Objetivo, Instruções, Dicas, Critérios de avaliação e Solução de referência. Escreva todas.
- Dicas e critérios são listas `- ` de primeiro nível. Podem usar `código` inline.
- Exatamente **2 desafios com `"required": true`** por tópico: os de nível 1 e 2 mais essenciais.
- A solução de referência é completa e correta:
  - código Java 21 compilável, com análise de complexidade de tempo e espaço quando houver algoritmo;
  - respostas conceituais completas.
- Problemas no estilo LeetCode: **escreva o enunciado com suas próprias palavras**, com exemplos de entrada e saída próprios. Pode citar o nome do problema clássico, mas não copie o texto de plataformas.
- Números de medição (tempos, tamanhos, saídas de ferramentas) são ilustrativos: diga de onde vêm e que variam conforme o ambiente. Nunca apresente como exato um número que você não mediu.

## Regras de ambiente (obrigatórias)

- **Proibido usar Docker** (`docker run`/`pull`) e **proibido instalar ou baixar** qualquer coisa: pacotes, imagens, jars, toolchains. O disco da máquina é limitado.
- Para compilar e testar código Java, use o JDK instalado (`javac`/`java`) dentro de **uma subpasta própria** do scratchpad com nome único (ex.: `scratchpad/c-2-4-1`). Nunca rode `rm -rf` em pastas que não criou.
- Escreva **somente** os arquivos dos seus tópicos em `content/topics/<chave>/`. Não rode o seed nem mexa no banco.
- Código que não puder ser executado (C, ferramentas só de Linux) deve ser revisado à mão, e as saídas marcadas como ilustrativas.

## Validação antes de entregar

```bash
npx tsx scripts/check-content.ts --strict       # deve imprimir OK
npx vitest run tests/content.test.ts            # regras de qualidade (níveis, obrigatórios, solução, exemplo, diagrama, títulos do inventário)
```

Também confira que cada arquivo seu tem tamanho maior que zero e termina no texto esperado. Se a validação falhar por causa de um tópico de **outra pessoa ou agente**, verifique os seus com o parser e siga em frente:

```bash
npx tsx -e "const {parseContentMarkdown,parseChallengesMarkdown}=require('./src/lib/content/parse-topic-files');const fs=require('fs');for(const k of ['X.Y.Z']){const s=parseContentMarkdown(fs.readFileSync('content/topics/'+k+'/content.md','utf8'));const c=parseChallengesMarkdown(fs.readFileSync('content/topics/'+k+'/challenges.md','utf8'),k);console.log(k,s.length,'seções',c.length,'desafios',c.filter(x=>x.required).length,'obrigatórios')}"
```

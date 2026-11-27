# Roadmap Java Backend

## 01 — Fundamentos

Como o computador executa um programa: CPU, memória, compilação, stack e heap, e o papel do sistema operacional com processos, threads e memória virtual. É a base para entender performance, concorrência e o comportamento da JVM.

### 1.1 Como computadores executam programas

**9 tópicos**

1. CPU
2. RAM
3. Código fonte e código de máquina
4. Compilação
5. Preprocessing, compiling, assembling e linking
6. Endereços de memória
7. Stack
8. Heap
9. Call Stack

### 1.2 Sistema operacional, processos e memória

**9 tópicos**

1. Sistema operacional
2. Processo
3. Thread
4. Process vs Thread
5. Context Switch
6. Virtual Memory
7. Address Space
8. Paging
9. I/O

---

## 02 — LeetCode

Estruturas de dados, algoritmos e análise de complexidade (Big O) aplicados aos problemas das entrevistas de código. O objetivo é reconhecer padrões como two pointers, sliding window, BFS/DFS e programação dinâmica, e resolver problemas Easy e Medium no tempo de uma entrevista.

### 2.1 Big O e estruturas de dados fundamentais

**9 tópicos**

1. Time Complexity
2. Space Complexity
3. Big O
4. Array
5. Dynamic Array
6. Linked List
7. Stack
8. Queue
9. Deque

### 2.2 Algoritmos fundamentais

**6 tópicos**

1. Linear Search
2. Binary Search
3. Sorting
4. Merge Sort
5. Recursion
6. Divide and Conquer

### 2.3 Estruturas e padrões de entrevista

**6 tópicos**

1. Linked List
2. Stack
3. Queue
4. Binary Search
5. Heap / Priority Queue
6. Intervals

### 2.4 Hash Tables, Trees, Heaps e Graphs

**9 tópicos**

1. Hash Table
2. HashMap
3. HashSet
4. Tree
5. Binary Tree
6. Binary Search Tree
7. Heap
8. Priority Queue
9. Graph

### 2.5 Arrays e Strings

**6 tópicos**

1. Arrays
2. Strings
3. Hashing
4. Two Pointers
5. Sliding Window
6. Prefix Sum

### 2.6 Trees, Graphs e problemas recursivos

**7 tópicos**

1. Trees
2. DFS
3. BFS
4. Graphs
5. Backtracking
6. Greedy
7. Dynamic Programming básico

---

## 03 — Backend

O que acontece por trás de uma API: redes e HTTP, bancos de dados relacionais (SQL, índices, transações e concorrência), autenticação e segurança, e como operar um serviço em produção com observabilidade e estratégias de deploy.

### 3.1 Redes e HTTP

**11 tópicos**

1. IP
2. Portas
3. DNS
4. TCP
5. UDP
6. Sockets
7. TLS
8. HTTP
9. HTTPS
10. REST
11. Keep-Alive

### 3.2 Banco de Dados II — Transações e concorrência

**12 tópicos**

1. Transactions
2. ACID
3. Isolation Levels
4. Dirty Read
5. Non-repeatable Read
6. Phantom Read
7. Locks
8. Deadlocks
9. Optimistic Locking
10. Pessimistic Locking
11. MVCC
12. Replication

### 3.3 Backend em produção

**11 tópicos**

1. Logs
2. Metrics
3. Tracing
4. Observability
5. Health Checks
6. SLI / SLO
7. CI/CD
8. Rolling Deployment
9. Blue/Green Deployment
10. Canary Deployment
11. Rollback

### 3.4 Banco de Dados I — SQL, índices e performance

**11 tópicos**

1. Modelo relacional
2. SQL
3. Joins
4. Primary Key
5. Foreign Key
6. Indexes
7. B+ Tree
8. Query Execution
9. Query Planner
10. EXPLAIN
11. Connection Pool

### 3.5 APIs, autenticação e segurança

**12 tópicos**

1. REST
2. Stateless
3. Authentication
4. Authorization
5. Sessions
6. Cookies
7. JWT
8. Password Hashing
9. Salt
10. CORS
11. Idempotência
12. SQL Injection

---

## 04 — Java Backend

Como o Java funciona por baixo: a JVM, o gerenciamento de memória e o garbage collector, concorrência (das threads às virtual threads) e o funcionamento interno do Spring e do JPA/Hibernate. São os assuntos clássicos das perguntas técnicas em vagas Java.

### 4.1 JVM

**14 tópicos**

1. JDK vs JRE vs JVM
2. Bytecode
3. Class Loading
4. JIT Compilation
5. JVM Stack
6. Heap
7. Metaspace
8. Garbage Collection
9. GC Roots
10. Generational GC
11. Stop-the-World
12. Memory Leaks
13. OutOfMemoryError
14. StackOverflowError

### 4.2 Spring e JPA por baixo

**16 tópicos**

1. IoC
2. Dependency Injection
3. Beans
4. ApplicationContext
5. Bean Lifecycle
6. Bean Scopes
7. Request Lifecycle
8. Spring MVC
9. Spring Data
10. JPA
11. Hibernate
12. Persistence Context
13. Entity Lifecycle
14. Lazy vs Eager
15. N+1
16. @Transactional

### 4.3 Fundamentos de concorrência

**11 tópicos**

1. Process vs Thread
2. Concurrency vs Parallelism
3. Race Condition
4. Critical Section
5. Thread Safety
6. Mutex
7. Lock
8. Semaphore
9. Atomicity
10. Visibility
11. Deadlock

### 4.4 Concorrência em Java

**11 tópicos**

1. Java Memory Model
2. synchronized
3. volatile
4. Atomic Types
5. ReentrantLock
6. Concurrent Collections
7. Thread Pools
8. ExecutorService
9. Future
10. CompletableFuture
11. Virtual Threads

---

## 05 — Sistemas Distribuídos

O que muda quando o sistema roda em várias máquinas: comunicação assíncrona com filas e Kafka, falhas parciais, retries e idempotência, consistência entre réplicas e transações que atravessam serviços (2PC, Outbox e Saga).

### 5.1 Mensageria e Event-Driven Architecture

**13 tópicos**

1. Synchronous vs Asynchronous
2. Message Queue
3. Pub/Sub
4. Event-Driven Architecture
5. Kafka
6. Topics
7. Partitions
8. Offsets
9. Consumer Groups
10. Ordering
11. At-most-once
12. At-least-once
13. Exactly-once

### 5.2 Falhas e confiabilidade

**9 tópicos**

1. Partial Failures
2. Timeout
3. Retry
4. Exponential Backoff
5. Jitter
6. Idempotência
7. Circuit Breaker
8. Rate Limiting
9. Fault Tolerance

### 5.3 Consistência e transações distribuídas

**10 tópicos**

1. Replication
2. Strong Consistency
3. Eventual Consistency
4. Quorums
5. Consensus básico
6. Distributed Transactions
7. Two-Phase Commit
8. Transactional Outbox
9. Saga
10. Choreography vs Orchestration

---

## 06 — System Design

Projetar sistemas escaláveis numa entrevista: levantar requisitos, estimar capacidade, desenhar a arquitetura e discutir trade-offs de cache, particionamento, replicação e disponibilidade, praticando com problemas clássicos e simulações completas.

### 6.1 Fundamentos de System Design

**11 tópicos**

1. Como conduzir uma entrevista de System Design
2. Functional Requirements
3. Non-Functional Requirements
4. Capacity Estimation
5. API Design
6. Data Model
7. High-Level Architecture
8. Horizontal Scaling
9. Load Balancer
10. Cache
11. CDN

### 6.2 Prática de System Design I

**4 tópicos**

1. URL Shortener
2. Rate Limiter
3. Distributed Message Queue
4. Notification / Webhook System

### 6.3 Escala, dados e trade-offs

**11 tópicos**

1. Replication
2. Partitioning
3. Sharding
4. Caching
5. Queues
6. Consistency
7. Availability
8. CAP Theorem
9. Hotspots
10. Single Point of Failure
11. Fault Tolerance

### 6.4 Prática de System Design II

**8 tópicos**

1. Feed / Social Network
2. Chat / Realtime System
3. Distributed Storage
4. Payment System
5. Mock Interviews
6. Explicar trade-offs
7. Identificar gargalos
8. Evoluir arquitetura conforme a escala

---

## Regras de utilização deste roadmap

1. Preservar integralmente as seis etapas.
2. Preservar a descrição de cada etapa.
3. Preservar todos os módulos e seus tópicos.
4. Manter a ordem original dos módulos e tópicos.
5. Não eliminar tópicos repetidos: eles podem ser estudados em contextos diferentes.
6. Permitir adicionar explicações, exemplos, materiais e desafios sem alterar o conteúdo original.
7. Permitir acompanhar o progresso individual de cada tópico.
8. Utilizar este documento como fonte oficial para a carga inicial do banco de dados.

**Total: 6 etapas, 23 módulos e 223 tópicos.**
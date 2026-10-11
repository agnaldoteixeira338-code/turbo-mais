# ADR-009 — Escalabilidade horizontal: API stateless + estado compartilhado no Redis

- **Status:** Aceita
- **Data:** 2026-09-05

## Contexto

Queremos poder rodar N réplicas da API atrás de um load balancer, sem sticky session, e escalar os workers de forma independente.

## Decisão — onde mora cada estado

| Estado | Onde | Por que funciona com N réplicas |
|---|---|---|
| Sessão | JWT (stateless) + refresh token no Postgres | qualquer réplica valida |
| Cache de cotações | Redis | compartilhado; lock NX evita revalidação duplicada |
| Rate limit | Redis (`rate-limit-redis`) | com store em memória, 3 réplicas = 3× o limite |
| Bloqueio de login | Redis | contador único por conta |
| Idempotency-Key | Redis | retry pode cair em outra réplica |
| WebSocket | Redis adapter / emitter | evento emitido em qualquer réplica (ou no worker) chega ao socket |
| Jobs | BullMQ (Redis) | execução única por job |
| Catálogo de ativos | memória local (5 min) | dado de referência quase estático; inconsistência de minutos é aceitável |

A API não guarda nada em disco nem em memória que outra réplica precise ver.

## Gargalos conhecidos e como escalar cada um

1. **Conexões Postgres**: `max=10` por réplica. Neon free aceita ~100 conexões diretas → até ~8 réplicas + workers. Além disso: usar o **pooler do Neon (PgBouncer)** na `DATABASE_URL` da API (modo transação; não usamos prepared statements nomeados nem `SET` de sessão, então é compatível) e conexão direta só para migrations.
2. **Redis**: um único nó cobre milhares de req/s. Upstash escala sob demanda; Redis Cluster exigiria hash tags nas chaves do BullMQ.
3. **Cotas das APIs externas**: não escalam com réplicas — o cache compartilhado é o que torna o consumo independente do nº de usuários (ADR-003).
4. **priceWatcher**: `concurrency 1` por design. O custo cresce com o nº de **tickers distintos com alerta** (limite de 50 alertas/usuário). Para escalar: particionar o ciclo em jobs por lote de tickers (fan-out), processados em paralelo por vários workers.
5. **Socket.IO long-polling**: com várias réplicas, o transporte de fallback exige **sticky session** (as requisições de polling de um cliente precisam cair na mesma réplica). WebSocket puro não exige. No Render, uma réplica não tem esse problema; em escala, habilitar afinidade de sessão no LB ou usar só WebSocket + fallback REST.

## Trade-off de custo: workers no processo da API

O plano gratuito do Render não tem background worker. `RUN_WORKERS_IN_PROCESS=true` sobe os workers dentro da API:
- (+) Deploy de demonstração com custo zero.
- (−) Picos de e-mail/priceWatcher competem com requisições HTTP; não dá para escalar API e workers separadamente; com N réplicas da API teríamos N workers (o BullMQ ainda garante execução única de cada job, então é **seguro**, só desperdiça recursos).
Em produção real: `false` + serviço worker dedicado (já previsto no `render.yaml` comentado).

## Validação

`tests/load/load-test.js` (k6): rampa até **1000 usuários virtuais simultâneos** com SLO de p95 < 500 ms e erro < 1 %. O teste de carga roda contra o ambiente com `MARKET_DATA_MODE=mock` (para medir *nossa* capacidade, não a das APIs externas) e com rate limit desligado (todos os VUs saem de um IP).

## Consequências

- (+) Escalar = aumentar o nº de instâncias. Deploys são rolling sem perder sessões.
- (+) Graceful shutdown: `/ready` responde 503 durante o encerramento, o LB tira a réplica, conexões em andamento terminam (prazo 15 s).
- (−) Redis vira dependência de quase tudo. Mitigação: degradações explícitas (cache pass-through, rate limit e bloqueio de login fail-open — ver SECURITY.md para o trade-off de segurança).

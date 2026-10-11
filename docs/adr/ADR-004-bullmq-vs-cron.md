# ADR-004 — BullMQ (filas no Redis) em vez de cron/setInterval

- **Status:** Aceita
- **Data:** 2026-09-02

## Contexto

Dois trabalhos não devem rodar no ciclo da requisição HTTP:

1. **Envio de e-mail** (reset de senha, código 2FA): depende de provedor externo, pode falhar e não pode ser enviado duas vezes.
2. **priceWatcher**: a cada 60 s, avalia todos os alertas ativos e gera notificações.

Requisitos: retry com backoff, visibilidade de falhas, **execução única** mesmo com várias réplicas, e processos que escalam separados da API.

## Decisão

- **BullMQ** sobre o mesmo Redis, com três filas: `email`, `price-watcher` e `dead-letter`.
- **Workers em processo separado** (`node src/worker.js`) — mesma imagem Docker, outro comando.
- `email`: 3 tentativas, backoff exponencial (2 s, 4 s, 8 s), `jobId` = chave de idempotência, limiter de 10 e-mails/s.
- `price-watcher`: job repetível via `upsertJobScheduler` (idempotente: N réplicas registrando = 1 agendamento), `concurrency: 1`, `attempts: 1` (o próximo ciclo corrige).
- **Dead Letter Queue**: quando um job esgota as tentativas, um listener copia metadados (sem PII) para `dead-letter`, onde ficam para inspeção/reprocessamento e alimentam a métrica `turbo_mais_queue_jobs{fila="dead-letter"}`.

## Alternativas consideradas

| Opção | Problema |
|---|---|
| `node-cron` / `setInterval` na API | Com 3 réplicas, o priceWatcher roda 3×; sem retry; morre junto com a API em cada deploy; compete pelo event loop com requisições. |
| Cron do sistema / Render Cron Job | Granularidade de minutos ok, mas sem retry/DLQ e cold start a cada execução. |
| RabbitMQ / SQS | Robustos, mas mais uma infraestrutura para operar. Já temos Redis por causa do cache e do rate limit. |
| Enviar e-mail direto na requisição | A latência e a indisponibilidade do provedor viram latência e erro 500 da API. |

## Consequências

**Positivas**
- A API responde `202` ao "esqueci minha senha" em milissegundos; o e-mail tem retry e fallback de provedor.
- Execução única garantida pelo BullMQ (lock por job), não por "torcer para ter uma réplica só".
- Falha permanente é **visível** (DLQ + métrica), não um log perdido.

**Negativas**
- O Redis vira dependência crítica para os workers e precisa de `maxmemory-policy noeviction` (configurado no compose; no Upstash é o padrão).
- Exactly-once **não** é garantido pela fila (é at-least-once). Por isso a idempotência real fica no banco (ADR-008).
- Plano gratuito do Render não tem background worker: há o modo `RUN_WORKERS_IN_PROCESS=true` (trade-off discutido na ADR-009).

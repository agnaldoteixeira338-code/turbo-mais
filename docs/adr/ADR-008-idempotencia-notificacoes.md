# ADR-008 — Idempotência: notificações, e-mails e POSTs

- **Status:** Aceita
- **Data:** 2026-09-04

## Contexto

Filas e redes entregam **pelo menos uma vez**, nunca "exatamente uma vez":
- o BullMQ pode reexecutar um job (retry, worker morto no meio, lock expirado);
- num deploy, duas réplicas de worker podem processar ciclos próximos;
- o cliente HTTP refaz um POST quando a resposta se perde.

Sem cuidado: o usuário recebe "PETR4 caiu 3 %" três vezes, dois e-mails de reset, ou cria dois alertas iguais.

## Decisão

### 1. Notificações — idempotência garantida pelo BANCO

```
hash_idempotencia = sha256(alertaId : direcao : floor(agora / janela))
```

- Coluna `notificacoes.hash_idempotencia CHAR(64) UNIQUE`.
- Gravação com `INSERT ... ON CONFLICT (hash_idempotencia) DO NOTHING RETURNING *`.
- **Só emite** no socket se o INSERT retornou linha (notificação nova).
- Janela configurável (`ALERTA_JANELA_MINUTOS`, padrão 60): no máximo **1 notificação por alerta, por direção, por hora**.

O "exatamente uma vez" observável pelo usuário vem da constraint, não da fila — que pode repetir à vontade.

### 2. E-mails — `jobId` determinístico

O `jobId` do BullMQ é a chave de idempotência (`reset-<jti>`, `2fa-<idDoCodigo>`): um `add` com `jobId` existente é ignorado.

### 3. POSTs da API — header `Idempotency-Key`

Middleware (`shared/idempotency.js`) para `POST /favoritos`, `/alertas`, `/ideias`:

| Situação | Resposta |
|---|---|
| 1ª requisição | `SET NX` "processando" → executa → guarda status + corpo por 24 h |
| retry com mesma chave e mesmo corpo | **mesma resposta**, header `Idempotent-Replayed: true` |
| concorrente (ainda processando) | 409 |
| mesma chave, corpo diferente | 422 (uso indevido) |
| resposta 5xx | chave liberada (pode tentar de novo) |

O front gera a chave por ação do usuário e a **reutiliza** no retry após refresh de token.

### 4. Idempotência natural onde dá

- `POST /favoritos`: `UNIQUE(usuario_id, ticker)` + `ON CONFLICT DO NOTHING` → 201 na primeira vez, 200 depois.
- `DELETE /favoritos/:ticker` e `PATCH /notificacoes/:id/lida`: idempotentes por semântica.
- Seeds e migrations: reexecutáveis (`ON CONFLICT DO UPDATE`, `_prisma_migrations`).

## Trade-offs

- **Janela fixa ("balde" de 60 min)** em vez de janela deslizante: se o preço cruza o gatilho às 13:59 e às 14:01, o usuário recebe 2 notificações (baldes diferentes). Aceito pela simplicidade (hash puro, sem estado extra). Alternativa futura: guardar `ultimo_disparo_em` no alerta e exigir intervalo mínimo.
- Respostas idempotentes ficam 24 h no Redis (memória). Payloads são pequenos.

## Consequências

- (+) Testado nos três níveis: unitário (`ProcessarAlerta` duas vezes → 1 notificação), integração (UNIQUE real no Postgres) e middleware.
- (+) Retries ficam seguros em todas as camadas — o que permite retries agressivos sem medo.

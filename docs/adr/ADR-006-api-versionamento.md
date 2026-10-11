# ADR-006 — Versionamento da API por prefixo de URL (`/api/v1`) e contrato de resposta

- **Status:** Aceita
- **Data:** 2026-09-03

## Contexto

A API é consumida pelo SPA hoje e, no roadmap, por um app mobile — que **não** atualiza junto com o deploy do backend. Mudanças incompatíveis precisam conviver com clientes antigos por um período.

## Decisão

1. **Versão no caminho**: todas as rotas de negócio em `/api/v1/...`. Uma v2 seria outro router montado em `/api/v2` convivendo com a v1 durante a depreciação.
2. Rotas operacionais **sem versão** (`/live`, `/ready`, `/health`, `/metrics`, `/api/docs`) — são contratos com a infraestrutura, não com clientes.
3. **Envelope único** de resposta: `{ success, data, error, meta }`.
   - `error.code` é o contrato estável (`CONTA_BLOQUEADA`, `SESSAO_REVOGADA`, `IDEMPOTENCY_KEY_REUTILIZADA`...). O front decide pelo código, nunca pela mensagem.
   - `error.requestId` permite ao suporte achar a requisição nos logs.
   - `meta` carrega paginação (`page`, `limit`, `total`, `totalPages`) e extras (`naoLidas`).
4. **Códigos HTTP com semântica**: 400 (formato inválido — Zod), 401, 403 (CSRF), 404 (também para recurso de outro usuário — não confirmamos existência), 409 (conflito), 422 (regra de negócio), 429 (+ `Retry-After`), 500 (genérico), 503 (`/ready` em shutdown).
5. **Paginação** `?page&limit` com `limit ≤ 100`.
6. **Política de compatibilidade da v1**: só mudanças aditivas (novos campos, novas rotas, novos códigos de erro). Remover/renomear campo = v2.
7. OpenAPI 3 em `/api/docs`, com `x-rate-limit` por operação.

## Alternativas consideradas

- **Header `Accept: application/vnd.turbomais.v1+json`**: mais "REST purista", porém invisível em logs, difícil de testar no navegador e de rotear em CDN/proxy.
- **Query string `?v=1`**: fácil de esquecer e de cachear errado.
- **Sem versão + evolução só aditiva**: funciona até o primeiro breaking change inevitável.

## Consequências

- (+) Roteamento, logs e métricas mostram a versão explicitamente.
- (+) Rollback do backend não quebra clientes (v1 continua igual).
- (−) Duplicação temporária de código quando houver v2. Mitigação: v2 reaproveita os mesmos casos de uso; só controllers/presenters mudam.

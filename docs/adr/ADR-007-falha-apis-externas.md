# ADR-007 — O que acontece quando uma API externa falha

- **Status:** Aceita
- **Data:** 2026-09-04

## Contexto

Dependemos de três APIs gratuitas que **vão** falhar: brapi (B3), CoinGecko (cripto) e Alpha Vantage (ações globais — 25 req/dia no plano free, e responde **HTTP 200** com `{"Note": ...}` quando a cota estoura). Uma API lenta é pior que uma API fora: prende conexões e o event loop da nossa API.

## Decisão — cadeia de defesa (de fora para dentro)

```
requisição
  └─ cache fresco? ─────────────────────────────▶ responde (≈1 ms)
  └─ cache stale? ── responde + revalida em 2º plano
  └─ origem:
       circuit breaker (opossum) ── aberto? ──▶ falha rápida
         └─ retry (p-retry): 2 retentativas, backoff 200 ms → 1,5 s + jitter
              └─ fetch com timeout explícito (4–6 s) + validação de contrato (Zod)
  └─ falhou? último valor conhecido (lkg) ──▶ responde marcado "desatualizado"
  └─ sem lkg? [dev] simulado marcado | [prod] cotação "indisponível"
```

### Parâmetros e a conta por trás deles

- **Timeout por tentativa:** 4 s (Alpha Vantage 6 s).
- **Retry:** só para rede/timeout, 5xx e 429; **nunca** para 4xx (determinístico) nem para contrato quebrado. Pior caso ≈ 3 × 4 s + 1,7 s de backoff ≈ 13,7 s → por isso o **timeout do breaker é 8 s por chamada lógica e o breaker envolve o retry** (`breaker(retry(fetch))`): ele conta **uma** falha por chamada lógica, não uma por tentativa.
- **Breaker:** abre com ≥ 50 % de falhas numa janela de 60 s (mínimo de 5 chamadas, para não abrir com um erro isolado); fica aberto 30 s; depois meio-aberto (1 chamada de teste).
- **404 não conta** como falha da dependência (ticker inexistente é resposta válida).
- **Cota estourada** (Alpha Vantage `Note`) vira 429 **não retentável** — repetir só gasta mais cota — mas conta para o breaker.

### Contrato da porta

`MarketDataGateway.obterCotacao` **nunca lança**. Uma API fora degrada um card, não a tela. Cada cotação carrega `desatualizado`, `indisponivel` e `simulado`, e o front mostra um selo correspondente — **degradar, sim; enganar, nunca**.

### Política para alertas

O priceWatcher **ignora** cotações desatualizadas ou indisponíveis. Um "PETR4 caiu 5 %" baseado em dado velho é pior do que um alerta atrasado.

### Detecção de mudança de contrato

Os mesmos schemas Zod que validam respostas em produção rodam:
- em todo PR contra **fixtures gravadas**;
- **diariamente contra as APIs reais** (job `contrato-ao-vivo` do CI). Se a brapi renomear um campo, o CI acusa antes do usuário.

## Alternativas consideradas

- **Só retry**: amplifica o problema quando a API está sobrecarregada (retry storm).
- **Só cache longo**: preço velho demais em dia normal.
- **Provedor pago com SLA**: solução correta em produção real; fora do orçamento de um portfólio. A arquitetura permite trocar o adaptador sem tocar no domínio.

## Consequências

- (+) A API do Turbo Mais continua respondendo (com dados marcados) mesmo com as três APIs fora.
- (+) Estado dos breakers em `/health` e em `turbo_mais_circuit_breaker_state`.
- (−) Complexidade: três camadas de resiliência para entender. Mitigação: testes unitários de cada camada (`resiliencia.test.js`, `CacheService.test.js`, `MarketDataGateway.test.js`).
- (−) Com breaker aberto e sem `lkg`, ativos aparecem como "indisponível" por até 30 s mesmo que a API já tenha voltado.

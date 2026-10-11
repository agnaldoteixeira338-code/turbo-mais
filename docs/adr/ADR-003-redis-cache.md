# ADR-003 — Cache de cotações no Redis com stale-while-revalidate

- **Status:** Aceita
- **Data:** 2026-09-02

## Contexto

- As APIs de mercado têm **cotas pequenas** (Alpha Vantage free: 25 req/dia; brapi free: limitado por minuto) e latência variável (200 ms a vários segundos).
- O mesmo ticker é pedido por muitos usuários e pelo priceWatcher a cada 60 s.
- Cotação de "há 60 segundos" é perfeitamente aceitável para um painel de consulta (não é home broker).
- Com N réplicas da API, cache em memória local multiplicaria as chamadas por N.

## Decisão

`CacheService.obterComRevalidacao(chave, buscar, { ttl, stale })` no Redis compartilhado:

| Idade do dado | Comportamento |
|---|---|
| `< ttl` (60 s) | **fresco**: devolve do cache |
| `ttl..ttl+stale` (até 11 min) | **stale**: devolve na hora o valor antigo e revalida em segundo plano |
| expirado | busca na origem; se falhar, usa o **último valor conhecido** (`lkg:`, 7 dias), marcado como desatualizado |

Proteções:
- **Single-flight em memória**: 50 requisições simultâneas pelo mesmo ticker no mesmo processo = 1 chamada à API.
- **Lock entre réplicas** (`SET lock:<chave> NX EX 30`): só uma réplica revalida por vez.
- **Redis fora do ar → pass-through**: o cache degrada para chamada direta, não derruba a API.
- TTLs por natureza do dado: cotação 60 s, histórico 1 h, indicadores 24 h.

## Alternativas consideradas

- **Cache-aside simples (TTL fixo)**: no instante em que expira, a próxima requisição paga a latência da API — e, sob carga, N requisições pagam juntas (cache stampede).
- **Cache em memória (LRU) por processo**: rápido, mas inconsistente entre réplicas e multiplica a cota usada por N.
- **Pré-aquecimento ativo (worker que atualiza tudo a cada minuto)**: gastaria cota com tickers que ninguém está olhando. O priceWatcher já mantém quentes os tickers com alertas.

## Consequências

**Positivas**
- Latência p95 dominada pelo Redis (~1 ms) e não pela API externa.
- Consumo de cota proporcional ao nº de *tickers distintos*, não ao nº de usuários.
- Base para o fallback da ADR-007.

**Negativas**
- O usuário pode ver um preço de até ~11 min durante uma revalidação lenta. Mitigação: o front exibe a hora da cotação e o selo "desatualizado" quando aplicável.
- O Redis passa a guardar dados que também ficam no `lkg:` por 7 dias (memória). Volume é pequeno (dezenas de tickers × poucos KB).

## Métricas

`turbo_mais_cache_results_total{resultado="hit|stale|miss|ultimo-conhecido"}` permite acompanhar a taxa de acerto e detectar quando estamos vivendo de `ultimo-conhecido` (API externa degradada).

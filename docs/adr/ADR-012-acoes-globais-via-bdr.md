# ADR-012 — Ações globais cotadas por BDR (brapi), Alpha Vantage como reserva

- **Status:** Aceita (substitui a Alpha Vantage como fonte principal de ações globais)
- **Data:** 2026-10-19

## Contexto

O plano original (ADR-007) usava a **Alpha Vantage** para as 7 ações globais (AAPL, MSFT, NVDA, GOOGL, AMZN, TSLA, NU). Em produção:

1. A primeira falha veio do limite de **~1 req/s**: 7 cotações em paralelo abriam o circuit breaker. Corrigido com fila espaçada (ADR-007, seção do incidente).
2. Mesmo com a fila, **toda** chamada feita a partir da Render voltava `{"Information": ...}` (cota excedida) — enquanto a mesma chave, chamada de uma máquina local, respondia normalmente. A Alpha Vantage gratuita também limita por **IP**, e os IPs de saída compartilhados da Render chegam com a cota esgotada por outros clientes.

Não é um problema que código resolve: é uma restrição do provedor no ambiente de nuvem.

## Decisão

- Ações globais passam a ser cotadas pelos **BDRs negociados na B3** (AAPL34, MSFT34, NVDC34, GOGL34, AMZO34, TSLA34, ROXO34), via **brapi** — a mesma API e a mesma chave das ações brasileiras.
- O ticker exibido continua o original (`AAPL`); o código do BDR fica em `ativos_educativos.codigo_externo` e o nome mostra os dois (`Apple Inc. · BDR AAPL34`), em **R$**.
- A Alpha Vantage **continua no código como provedor reserva** (`criarProvedorComFallback([brapi, alphaVantage])`): se a brapi falhar, tenta a Alpha Vantage (que responde em ambientes com IP próprio, como uma máquina local).

## Alternativas consideradas

| Opção | Por que não |
|---|---|
| Insistir na Alpha Vantage com cache longo | Não resolve: a cota já chega esgotada no IP da Render. |
| Finnhub (cotação em USD) | Exige mais uma conta; o plano gratuito não tem histórico — o gráfico dessas ações ficaria vazio. |
| Plano pago / IP dedicado | Fora do orçamento de um portfólio. |
| Mostrar "indisponível" e documentar | Funcional, mas deixa uma aba inteira vazia para quem visita. |

## Consequências

**Positivas**
- Cotação **e histórico** reais para as 7 empresas, funcionando a partir da nuvem, sem conta nova.
- Faz sentido para o público do produto: é exatamente assim que o investidor brasileiro compra essas empresas sem conta no exterior.
- O provedor composto torna trivial adicionar/trocar fontes por tipo de ativo.

**Negativas / trade-offs**
- O preço é o do **BDR em reais**, não o da ação em Nova York em dólares: incorpora o câmbio e a razão do BDR (ex.: 1 AAPL34 = 0,05 ação). A interface deixa isso explícito no nome do ativo.
- BDRs só negociam no **horário da B3**; fora dele, a variação é a do último pregão brasileiro.
- Se a brapi cair, a reserva Alpha Vantage devolveria preço em **US$** — o campo `moeda` acompanha a cotação, então o valor é exibido com o símbolo correto.

## Quando revisitar

Com orçamento para um provedor pago de ações americanas (ou um IP de saída dedicado), voltar a cotar a ação original em USD e manter o BDR como informação complementar.

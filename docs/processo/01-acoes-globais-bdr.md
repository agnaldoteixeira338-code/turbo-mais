# 1. Ações americanas "indisponíveis" em produção

**Decisão registrada em:** [ADR-007](../adr/ADR-007-falha-apis-externas.md) (seção do incidente) e [ADR-012](../adr/ADR-012-acoes-globais-via-bdr.md)

## Contexto

As 7 ações americanas (Apple, Microsoft, NVIDIA, Google, Amazon, Tesla e Nubank) eram cotadas pela Alpha Vantage, no plano gratuito. Localmente, tudo funcionava.

## O que aconteceu

No ar, as 7 apareciam como "indisponível". Uma chamada isolada à API funcionava. Foram duas causas, uma depois da outra:

1. O plano gratuito aceita cerca de **1 requisição por segundo**. O app buscava as 7 cotações em paralelo, as excedentes eram recusadas e o circuit breaker abria para todas.
2. Com as chamadas já espaçadas, **todas** as requisições feitas a partir da Render continuavam recusadas, enquanto a mesma chave funcionava de uma máquina local. A Alpha Vantage também limita **por IP**, e o IP compartilhado da Render já chega sem cota.

## Como foi resolvido

- Fila espaçada por provedor (1,2 s entre chamadas) e cache mais longo para as ações globais.
- Como a segunda causa não tinha solução em código, as ações passaram a ser cotadas pelo **BDR na B3, via brapi** (AAPL34, MSFT34...), com a Alpha Vantage mantida como reserva.

## Quem fez o quê

- **Eu:** configurei a chave da Alpha Vantage, testei em produção e escolhi a solução entre as opções apresentadas (insistir na Alpha Vantage, outro provedor, plano pago ou BDR).
- **IA:** diagnosticou as duas causas, implementou a fila espaçada e o provedor com reserva, e documentou o incidente.

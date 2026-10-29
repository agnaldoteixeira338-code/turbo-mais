# Processo: como os problemas foram resolvidos

Registro de casos reais do desenvolvimento do Turbo Mais: o que aconteceu, como foi diagnosticado, como foi resolvido e quem fez o quê. O projeto foi construído em par com uma IA (Claude Code), e estes registros mostram como foi essa divisão de trabalho na prática.

As decisões técnicas em si ficam nos [ADRs](../adr). Aqui fica o caminho até elas.

| # | Caso | Tipo | Onde está a decisão |
|---|---|---|---|
| 1 | [Ações americanas "indisponíveis" em produção](01-acoes-globais-bdr.md) | incidente | [ADR-007](../adr/ADR-007-falha-apis-externas.md), [ADR-012](../adr/ADR-012-acoes-globais-via-bdr.md) |
| 2 | [Tempo real apontando para `wss://sensitive`](02-websocket-sensitive.md) | incidente | [ADR-011](../adr/ADR-011-hospedagem-vercel-render.md) |
| 3 | [API não subia por causa de aspas na URL do Redis](03-redis-aspas-e-log.md) | incidente | `backend/src/config/env.js`, `pinoLogger.js` |
| 4 | [E-mails não saíam da Render](04-email-smtp-bloqueado.md) | incidente | [DEPLOY.md](../DEPLOY.md) |
| 5 | [Badge de deploy vermelho](05-deploy-vermelho.md) | incidente | [ADR-010](../adr/ADR-010-estrategia-rollback.md) |
| 6 | [Manter a API acordada sem estourar o plano gratuito](06-limite-de-horas-render.md) | decisão | [DEPLOY.md](../DEPLOY.md), [ADR-011](../adr/ADR-011-hospedagem-vercel-render.md) |
| 7 | [Conta de visitante compartilhada](07-conta-demo-compartilhada.md) | funcionalidade | [ADR-013](../adr/ADR-013-restauracao-conta-demo.md) |
| 8 | [Prazo mínimo da LCI/LCA no simulador](08-carencia-lci-lca.md) | correção de regra | [ADR-014](../adr/ADR-014-simulador-de-investimentos.md) |

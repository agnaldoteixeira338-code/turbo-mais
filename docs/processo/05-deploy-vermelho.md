# 5. Badge de deploy vermelho

**Decisão registrada em:** [ADR-010](../adr/ADR-010-estrategia-rollback.md) · correção no PR #31

## Contexto

O deploy automático publica a API na Render, espera ela ficar no ar e, se algo falhar, volta para a versão anterior (rollback).

## O que aconteceu

Depois de um merge que só alterava o README, o badge de deploy ficou vermelho. Eram dois problemas:

1. O deploy na Render passou de 15 minutos "em andamento" (lentidão do plano gratuito) e o script desistiu.
2. O rollback falhou com **HTTP 400**. Como a versão nova nunca chegou a entrar no ar, a anterior continuava rodando, e a Render recusa "voltar" para o deploy que já está ativo.

O site nunca ficou fora do ar.

## Como foi resolvido

- O script passou a **cancelar** o deploy travado e a **pular o rollback** quando a versão anterior continua ativa, com um aviso explicando. Uma falha real de rollback vira erro claro.
- O ADR-010 ganhou esse caso.
- Depois, o CD passou a **ignorar pushes que só mudam documentação** (`paths-ignore`), já que eles não mudam nada do que roda em produção.

## Quem fez o quê

- **Eu:** notei o badge vermelho e pedi a correção.
- **IA:** leu os logs do pipeline e da Render, encontrou o bug do rollback e corrigiu o script.

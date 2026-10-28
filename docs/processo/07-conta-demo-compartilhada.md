# 7. Conta de visitante compartilhada

**Decisão registrada em:** [ADR-013](../adr/ADR-013-restauracao-conta-demo.md) · PRs #32 e #34

## Contexto

Para facilitar a vida de quem visita (inclusive recrutadores), a tela de login ganhou o botão **"Entrar como visitante"**, que entra numa conta de demonstração sem senha.

## O que aconteceu

Todos os visitantes usam a mesma conta. Favoritos, alertas e, principalmente, os textos livres da tela "Ideia" deixados por um visitante apareciam para o próximo. Além disso, pedir "Ativar 2FA" ou "Esqueci a senha" na conta demo mandava e-mail para um endereço que não existe, o que prejudica a reputação de envio no provedor de e-mail.

## Como foi resolvido

- Um job agendado no BullMQ **restaura a conta demo a cada hora** para um estado de exemplo, numa única transação, sem tocar em outros usuários nem no audit log.
- "Ativar 2FA" é bloqueado na conta demo, com uma explicação na tela. "Esqueci a senha" não envia nada, mas responde igual a sempre, para não revelar quais contas existem.
- Testes de integração com Postgres real conferem a transação, a idempotência e o isolamento entre usuários.

## Quem fez o quê

- **Eu:** identifiquei o problema da conta compartilhada e defini os requisitos: restaurar sozinha, em transação, sem mexer em outros usuários, e bloquear os e-mails da conta demo.
- **IA:** implementou o caso de uso, o agendamento, as proteções e os testes, e escreveu o ADR-013.

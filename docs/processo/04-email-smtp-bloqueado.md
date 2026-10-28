# 4. E-mails não saíam da Render

**Onde está documentado:** [DEPLOY.md](../DEPLOY.md) (provedores de e-mail e limitações do plano gratuito)

## Contexto

O app envia e-mails de recuperação de senha e códigos do 2FA. A primeira configuração usava SMTP.

## O que aconteceu

Os e-mails não saíam. O plano gratuito da Render **bloqueia as portas de SMTP** desde setembro de 2025. Depois da troca para um provedor por API, a primeira chave criada na Brevo foi recusada com **HTTP 403**: ela não tinha permissão para envio transacional.

## Como foi resolvido

- O código passou a tentar provedores por **API HTTP** antes do SMTP (Resend → Brevo → SMTP), cada um com circuit breaker. Erros 4xx da Brevo não são retentados, porque repetir não resolve.
- Uma nova chave da Brevo, restrita a "E-mails transacionais", substituiu a antiga, que foi apagada.
- O envio foi confirmado nos logs da Render ("e-mail entregue ao provedor").

## Quem fez o quê

- **Eu:** criei as contas e as chaves, escolhi a Brevo entre as opções e criei a chave com a permissão certa.
- **IA:** identificou o bloqueio de SMTP e o motivo do 403, implementou o provedor da Brevo com reserva e conferiu a entrega nos logs.

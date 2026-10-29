# 3. API não subia por causa de aspas na URL do Redis

**Onde está no código:** `backend/src/config/env.js` (validação das URLs de conexão) e `backend/src/infrastructure/logger/pinoLogger.js` (máscara de credenciais)

## Contexto

As URLs de conexão do banco e do Redis são configuradas no painel da Render, copiando do painel de cada serviço (Neon e Upstash).

## O que aconteceu

No primeiro deploy, a API não subia. A URL do Redis tinha sido colada **com aspas**, e o cliente interpretou o texto como um caminho de arquivo (erro `ENOENT`). Pior: a mensagem de erro no log mostrava a URL inteira, **com a senha**.

## Como foi resolvido

- O `env.js` remove aspas e espaços colados por engano e, se o formato continuar errado, falha na inicialização com uma mensagem clara (ex.: "REDIS_URL deve começar com redis:// ou rediss://").
- O logger passou a mascarar credenciais em URLs (`//usuario:***@host`) na mensagem, no stack trace e nos campos extras do erro.
- Testes cobrem os dois comportamentos.

## Quem fez o quê

- **Eu:** configurei as variáveis na Render e acompanhei o deploy até a API subir.
- **IA:** leu os logs, identificou as aspas e o vazamento da senha e implementou a validação e a máscara.

# 2. Tempo real apontando para `wss://sensitive`

**Decisão registrada em:** [ADR-011](../adr/ADR-011-hospedagem-vercel-render.md) e [DEPLOY.md](../DEPLOY.md) (seção da Vercel)

## Contexto

O frontend precisa saber o endereço do WebSocket da API (`VITE_SOCKET_URL`). Esse valor era configurado como variável de ambiente na Vercel e lido no build feito pelo deploy automático (CD).

## O que aconteceu

O app em produção caía para o modo de compatibilidade do tempo real (polling) em vez de usar WebSocket. Abrindo o site num navegador automatizado, apareceu a causa: o WebSocket tentava conectar em `wss://sensitive/`. A Vercel marca variáveis novas como **Sensitive**, e o `vercel pull` do CD recebe o texto `sensitive` no lugar do valor real.

## Como foi resolvido

- A configuração **pública** do build passou a ser versionada no repositório (`frontend/.env.production`). Não é segredo: o endereço da API aparece de qualquer jeito no navegador.
- A variável foi apagada da Vercel, e o DEPLOY.md avisa para não recriá-la.

## Quem fez o quê

- **Eu:** configurei as variáveis na Vercel e validei a correção no site publicado.
- **IA:** investigou com o navegador automatizado, encontrou o valor `sensitive` e propôs versionar a configuração pública.

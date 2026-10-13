# ADR-005 — WebSocket (Socket.IO) com degradação em três níveis

- **Status:** Aceita
- **Data:** 2026-09-03

## Contexto

Alertas disparados e cotações dos favoritos são mais úteis em tempo real. Mas:
- proxies corporativos e algumas redes móveis bloqueiam WebSocket;
- o Render reinicia instâncias a cada deploy (todas as conexões caem ao mesmo tempo);
- a sessão do usuário pode expirar com o socket aberto;
- com várias réplicas, o evento precisa chegar ao socket conectado em *outra* réplica — e o worker (que gera as notificações) nem tem servidor Socket.IO.

## Decisão

**Servidor**
- Autenticação **JWT no handshake** (`auth.token`), não por cookie → imune a Cross-Site WebSocket Hijacking.
- O socket é derrubado quando o access token expira (`sessao:expirada`); o cliente renova e reconecta. Sessão revogada não continua recebendo eventos.
- Rooms `usuario:<id>` (notificações) e `ticker:<X>` (cotações); máximo 50 tickers por socket.
- **Redis adapter** (réplicas compartilham eventos) + **redis-emitter** no worker.
- Heartbeat nativo: `pingInterval 25s` + `pingTimeout 20s` → conexão morta detectada em ≤ 45 s.

**Cliente — degradação**
1. **WebSocket** (padrão).
2. Após **3 falhas seguidas** → força transporte **HTTP long-polling** do Socket.IO (passa por quase qualquer proxy).
3. Após **6 falhas** → **polling REST** de `/notificacoes` a cada 30 s.

Reconexão com **backoff exponencial + jitter** (1 s → 30 s, fator aleatório 0,5): depois de um deploy, milhares de clientes não reconectam no mesmo milissegundo (thundering herd).

O header mostra o modo atual ("Tempo real", "modo compatível", "Atualização a cada 30s").

## Por que a API continua sendo a fonte da verdade

A notificação é gravada no banco **antes** de ser emitida. O socket só "avisa antes"; se o evento se perder, a lista vem pela API no próximo carregamento/polling. Emitir é *best-effort* — falha de emissão nunca falha o job.

## Alternativas consideradas

- **Server-Sent Events**: mais simples e unidirecional (suficiente aqui), mas sem fallback automático de transporte e com limite de conexões por domínio em HTTP/1.1.
- **Só polling**: simples e robusto, porém atrasa alertas e gera carga constante.
- **Push nativo (Web Push + Service Worker)**: melhor para app fechado; fica no roadmap.

## Consequências

- (+) Funciona em redes hostis e degrada de forma visível, sem quebrar.
- (+) Escala horizontal sem sticky session *para WebSocket puro*. Atenção: o transporte long-polling exige sticky session com várias réplicas — documentado na ADR-009.
- (−) Mais estados para testar (coberto em `frontend/tests/socket.test.js`).
- (−) Em produção o frontend está na Vercel e a API na Render ([ADR-011](ADR-011-hospedagem-vercel-render.md)). O rewrite da Vercel não faz upgrade de conexão, então o socket conecta direto no domínio da API (`VITE_SOCKET_URL`), com CORS restrito ao domínio do front. As chamadas REST continuam na mesma origem, via rewrite.

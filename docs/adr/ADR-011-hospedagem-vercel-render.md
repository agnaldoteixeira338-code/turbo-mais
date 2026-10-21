# ADR-011 — Hospedagem: frontend na Vercel, backend na Render

- **Status:** Aceita
- **Data:** 2026-10-13

## Contexto

O Turbo Mais tem duas partes com necessidades de execução muito diferentes:

| Parte | Precisa de |
|---|---|
| **Frontend** (SPA React) | servir arquivos estáticos rápido, perto do usuário; cabeçalhos de segurança; build por commit |
| **Backend** (API + workers) | processo **sempre ligado**: conexões WebSocket abertas por horas, workers BullMQ consumindo filas e o priceWatcher a cada 60 s, pool de conexões com Postgres/Redis |

## Decisão

| Componente | Plataforma | Configuração |
|---|---|---|
| Frontend | **Vercel** | `frontend/vercel.json` |
| API + workers | **Render** (Web Service Docker) | `render.yaml` |
| PostgreSQL | **Neon** | migrations pelo `cd.yml` |
| Redis | **Upstash** | — |

### Por que NÃO tudo na Vercel

A Vercel executa o backend como **funções serverless**: cada requisição liga uma função de vida curta, que é desligada em seguida. Isso é incompatível com três peças centrais do projeto:

1. **Socket.IO** precisa de conexões persistentes (ADR-005).
2. **Workers BullMQ** precisam de um processo consumindo a fila continuamente (ADR-004).
3. O **pool de conexões** com Postgres/Redis pressupõe um processo de vida longa; funções serverless abririam conexões a cada invocação.

Reescrever para serverless (cron da Vercel + push via serviço terceiro) trocaria decisões de arquitetura por limitações de plataforma.

### Por que NÃO tudo na Render

Seria mais simples (um painel), e a Render também serve sites estáticos. A Vercel foi escolhida para o frontend por:
- **Preview automático por pull request**: cada PR ganha uma URL para revisar a interface antes do merge;
- **CDN global** com cache de borda para os assets com hash;
- **Rollback instantâneo** (`vercel rollback`), usado pelo CD.

## Como as duas plataformas se conectam

```
navegador ──HTTPS──▶ Vercel (SPA + CSP)
    │                   └── rewrite /api/* ──▶ Render (API) ──▶ Neon / Upstash
    └──WSS (direto, token no handshake)──────▶ Render (Socket.IO)
```

1. **Mesma origem para a API** — o `vercel.json` repassa `/api/*` para a Render. Para o navegador, a API está no mesmo domínio do site, então:
   - o cookie de refresh continua `SameSite=Strict` e com `Path=/api/v1/auth` ([SECURITY.md §3](../SECURITY.md));
   - não há CORS com credenciais nas chamadas REST.
2. **WebSocket direto na Render** — rewrites da Vercel não fazem upgrade de conexão. O socket conecta em `VITE_SOCKET_URL` e se autentica pelo **token no handshake**, não por cookie (imune a CSWSH). `CORS_ORIGINS` na API lista o domínio da Vercel.
3. **Mesmos cabeçalhos de segurança** do Nginx local: CSP sem `unsafe-inline`, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` — agora no `vercel.json`. O smoke test do CD verifica que eles estão no ar.
4. **Deploy controlado pelo CD**, não pela integração Git da Vercel: `git.deploymentEnabled.main = false`. A produção só muda **depois** do CI verde, das migrations e do deploy da API — nunca um front novo contra uma API velha. PRs continuam ganhando previews automáticos.

## Consequências

**Positivas**
- Cada parte roda no tipo de plataforma para o qual foi projetada.
- Previews por PR para o frontend.
- Rollback independente: front e back têm rollback automático próprio no CD.

**Negativas / trade-offs aceitos**
- **Dois provedores** para operar (dois painéis, dois tokens no CI).
- **Um salto a mais** nas chamadas REST (Vercel → Render): alguns ms de latência. Aceitável para um painel de consulta.
- **IP real do usuário**: com dois proxies, a API usa `TRUST_PROXY=2`. Efeito colateral: quem chamar o domínio `onrender.com` **diretamente** pode forjar o header `X-Forwarded-For` e driblar o rate limit **por IP**. Continuam valendo o bloqueio por conta, o limite por usuário autenticado e o custo do bcrypt. Mitigação futura: domínio próprio com a API acessível só através do proxy (ou validação de um segredo injetado pela borda).
- **Previews chamam a API de produção** pelo mesmo rewrite. Aceitável num portfólio; em um produto real, previews apontariam para uma API de staging. Nos previews, o tempo real pode cair para o polling REST se a origem não estiver em `CORS_ORIGINS` — a degradação da ADR-005 cobre esse caso.
- **Plano gratuito da Render dorme após 15 min sem tráfego**: o primeiro acesso leva ~30–50 s e o priceWatcher pausa enquanto a API dorme. O frontend na Vercel nunca dorme, então a tela abre na hora e mostra o carregamento até a API acordar. Solução definitiva: plano Starter da Render.

## Incidente (2026-10-21): variável "Sensitive" quebrando o WebSocket

No primeiro deploy feito pelo CD (build no GitHub Actions com `vercel pull` + `vercel build`), o tempo real caiu para o modo de compatibilidade. Diagnóstico com o Edge em modo headless mostrou o socket tentando `wss://sensitive/socket.io` — bloqueado pela própria CSP.

**Causa:** `VITE_SOCKET_URL` tinha sido criada na Vercel, que marca variáveis novas como *Sensitive*; o `vercel pull` não revela valores sensíveis, e o build recebeu o literal `sensitive`.

**Correção:** valores **públicos** do build (toda `VITE_*` vai para o navegador) passaram a ser versionados em `frontend/.env.production`, a mesma fonte de verdade do `vercel.json`. A variável foi removida da Vercel. Lição: segredo vai em variável de ambiente; configuração pública vai no repositório.

## Quando revisitar

- Se o backend for reescrito para serverless (improvável, pelos motivos acima).
- Se o custo de dois provedores superar o benefício dos previews — mover o front para o Static Site da Render é trivial: o Nginx/Docker já replica toda a configuração.

# Deploy — Vercel (frontend) + Render (backend) + Neon + Upstash

| Componente | Plataforma | Arquivo de configuração |
|---|---|---|
| Frontend (SPA React) | **Vercel** | [`frontend/vercel.json`](../frontend/vercel.json) |
| API + workers | **Render** | [`render.yaml`](../render.yaml) |
| PostgreSQL | **Neon** | migrations aplicadas pelo [`cd.yml`](../.github/workflows/cd.yml) |
| Redis | **Upstash** | — |

Por que essa divisão: [ADR-011](adr/ADR-011-hospedagem-vercel-render.md). Custo: **zero** nos planos gratuitos (com as limitações descritas na seção 9). Tempo estimado: 40 min na primeira vez.

```
merge na main ─▶ CI verde ─▶ migrations (Neon) ─▶ API (Render) ─▶ healthcheck ─▶ front (Vercel) ─▶ healthcheck ─▶ smoke test
                                                     └─ falhou? rollback           └─ falhou? rollback
```

**Ordem recomendada:** banco e Redis → backend na Render → frontend na Vercel → ligar as URLs nos dois lados → GitHub (secrets e branch protection).

---

## 1. Banco — Neon (PostgreSQL)

1. [neon.tech](https://neon.tech) → **New Project**. Use a **mesma região** da API na Render (este projeto: Neon `us-east-2` ↔ Render **Ohio**). Regiões diferentes somam dezenas de ms a cada query.
2. Em **Connection Details**, copie **duas** strings (ambas com `?sslmode=require`):
   - **Pooled** (host com `-pooler`) → `DATABASE_URL` da API.
   - **Direct** (sem `-pooler`) → secret `NEON_DATABASE_URL_DIRECT` do GitHub (migrations).
3. O restore para um instante anterior já vem habilitado: é a rede de segurança da [ADR-010](adr/ADR-010-estrategia-rollback.md).

## 2. Redis — Upstash

1. [upstash.com](https://upstash.com) → **Create Database** (Redis, mesma região, TLS ligado).
2. Copie `rediss://default:<senha>@<host>:6379` → `REDIS_URL` da API.
3. Confirme que a política de eviction não despeja chaves (exigência do BullMQ).

## 3. E-mail e dados de mercado (opcionais)

| Variável | Onde obter | Sem ela |
|---|---|---|
| `RESEND_API_KEY` + `EMAIL_FROM` | [resend.com](https://resend.com) (verifique um domínio) | e-mails de reset/2FA não são entregues em produção |
| `BRAPI_TOKEN` | brapi.dev | só PETR4, VALE3 e ITUB4 funcionam; ações globais (BDRs) ficam "indisponível" |
| `ALPHA_VANTAGE_API_KEY` | alphavantage.co | sem reserva para as ações globais (a fonte principal é o BDR via brapi — ADR-012) |
| `COINGECKO_API_KEY` | coingecko.com (plano Demo) | funciona com limite menor |

---

## 4. Backend — Render

1. Faça push do repositório para o GitHub.
2. Render → **New → Blueprint** → selecione o repositório. O `render.yaml` cria o serviço **`turbo-mais-api`** (Web Service Docker, healthcheck `/ready`, deploy automático desligado).
3. Preencha as variáveis marcadas como `sync: false`:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | string **pooled** do Neon |
| `REDIS_URL` | URL do Upstash |
| `CORS_ORIGINS` | URL do front na Vercel, ex.: `https://turbo-mais.vercel.app` *(preencha depois do passo 5)* |
| `FRONTEND_URL` | a mesma URL (usada nos links dos e-mails) |
| `RESEND_API_KEY`, `EMAIL_FROM`, chaves de mercado | da seção 3 |

Os segredos JWT/HMAC e o `METRICS_TOKEN` são gerados automaticamente pela Render. `TRUST_PROXY=2` já vem configurado (Vercel + Render na frente da API).

4. Anote a URL da API, ex.: `https://turbo-mais-api.onrender.com`, e confira `https://turbo-mais-api.onrender.com/health`.

> Se o nome do serviço for outro, a URL muda: atualize `frontend/vercel.json` (rewrite e `connect-src` da CSP).

> **Plano free:** não há background worker, então `RUN_WORKERS_IN_PROCESS=true` roda os workers dentro da API ([ADR-009](adr/ADR-009-escalabilidade-horizontal.md)).

---

## 5. Frontend — Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório.
2. **Root Directory: `frontend`**. O framework (Vite), o build e a pasta `dist` vêm do `vercel.json`.
3. **Environment Variables: nenhuma.** A configuração pública do build (`VITE_SOCKET_URL` = URL da API na Render; `VITE_API_URL` vazio = mesma origem via rewrite) está versionada em [`frontend/.env.production`](../frontend/.env.production).
   > ⚠️ Não crie essas variáveis na Vercel: ela as marca como **Sensitive** por padrão, e variáveis sensíveis chegam ao `vercel pull` do CD com o texto `sensitive` no lugar do valor — o WebSocket passa a apontar para `wss://sensitive/` e o app cai para o modo de compatibilidade (incidente real, ver [ADR-011](adr/ADR-011-hospedagem-vercel-render.md)).

4. **Deploy**. A URL de produção será algo como `https://turbo-mais.vercel.app`.
5. Volte à Render e preencha `CORS_ORIGINS` e `FRONTEND_URL` com essa URL.
6. Em **Settings → General**, anote o **Project ID**; em **Account/Team Settings**, o **Team/User ID** (vão para o GitHub como `VERCEL_PROJECT_ID` e `VERCEL_ORG_ID`). Crie um token em **Account Settings → Tokens** (`VERCEL_TOKEN`).

O que o `vercel.json` já faz:
- **Rewrite `/api/*` → Render**: a API fica na mesma origem do site, então o cookie de sessão (`SameSite=Strict`) funciona.
- **Fallback do SPA**: qualquer rota volta para o `index.html` (React Router).
- **Cabeçalhos de segurança**: CSP sem `unsafe-inline`, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- **Cache**: assets com hash por 1 ano; `index.html` sem cache.
- **`git.deploymentEnabled.main = false`**: a produção só é publicada pelo CD, depois do CI e da API. Pull requests continuam ganhando **previews automáticos**.

---

## 6. GitHub — CI/CD

### 6.1 Secrets (Settings → Secrets and variables → Actions → Secrets)

| Secret | Para quê |
|---|---|
| `NEON_DATABASE_URL_DIRECT` | migrations e seeds |
| `RENDER_API_KEY` | deploy/rollback da API (Render → Account Settings → API Keys) |
| `RENDER_SERVICE_ID_API` | ID `srv-...` da API (aparece na URL do serviço) |
| `RENDER_SERVICE_ID_WORKER` | só se tiver worker dedicado |
| `VERCEL_TOKEN` | deploy/rollback do front |
| `VERCEL_ORG_ID` | Team ID (`team_...`) ou User ID da conta pessoal |
| `VERCEL_PROJECT_ID` | Project ID (`prj_...`) |
| `SNYK_TOKEN` | scan do Snyk (opcional) |
| `BRAPI_TOKEN`, `ALPHA_VANTAGE_API_KEY`, `COINGECKO_API_KEY` | teste de contrato diário (opcional) |
| `DEMO_USER_PASSWORD` | se quiser o usuário demo em produção |

### 6.2 Variables (mesma tela → aba Variables)

| Variable | Exemplo |
|---|---|
| `API_URL` | `https://turbo-mais-api.onrender.com` |
| `FRONTEND_URL` | `https://turbo-mais.vercel.app` |
| `RENDER_HAS_WORKER` | `false` |
| `SEED_DEMO_USER` | `true` para criar o usuário demo |

### 6.3 Environment

Crie o environment **`producao`** (Settings → Environments). Opcional: exigir aprovação manual antes do deploy.

### 6.4 Branch protection (Settings → Branches → `main`)

- Require a pull request before merging (+ review from Code Owners)
- Require status checks: `Backend — lint, testes e auditoria`, `Frontend — lint, testes, build e auditoria`, `Consistência entre camadas`, `Build das imagens Docker`, `CodeQL (JavaScript)`, `Trivy — imagem api`
- Require branches to be up to date · Do not allow bypassing

---

## 7. O primeiro deploy pelo pipeline

1. Merge na `main` → **Actions → CD**.
2. Jobs, em ordem: `CI` → `Migrations no Neon` → `Deploy da API na Render` → `Deploy do frontend na Vercel` → `Smoke test`.
3. O smoke test confere: `/health` da API, rotas do SPA, cabeçalhos de segurança e um login (esperando 401) **passando pelo rewrite** Vercel → Render.

## 8. Rollback

**Automático**
- **API:** se o deploy falhar na Render ou o `/ready` não responder em 2 min, o `render-deploy.sh` chama `POST /services/:id/rollback` para o deploy anterior.
- **Frontend:** se a home ou o rewrite `/api` não responderem em 2 min, o `vercel-deploy.sh` executa `vercel rollback` para o deploy de produção anterior.

**Manual**
- Render → serviço → **Events** → deploy anterior → **Rollback**.
- Vercel → projeto → **Deployments** → deploy anterior → **Instant Rollback** (ou `vercel rollback <id>`).

**Banco:** migrations são só aditivas (expand/contract), então o código antigo funciona com o schema novo — rollback de código não exige rollback de banco. Em desastre, use o **restore do Neon** e corrija com uma nova migration.

## 9. Limitações do plano gratuito

| Limitação | Efeito | Solução |
|---|---|---|
| API na Render **dorme após 15 min** sem tráfego | primeiro acesso leva ~30–50 s; alertas pausam enquanto dorme | plano Starter da Render |
| Sem background worker na Render | workers rodam no processo da API | plano pago + serviço worker (`render.yaml`) |
| Alpha Vantage gratuita limita por IP; da Render a cota já chega esgotada | não serve como fonte principal na nuvem | ações globais cotadas por BDR via brapi ([ADR-012](adr/ADR-012-acoes-globais-via-bdr.md)) |

O frontend na Vercel não dorme: a tela abre na hora e mostra o carregamento enquanto a API acorda.

## 10. Checklist pós-deploy

- [ ] `https://<api>/health` → `status: ok` (ou `degradado` se uma API externa estiver fora)
- [ ] `https://<front>/api/docs.json` responde (rewrite funcionando)
- [ ] `curl -I https://<front>` mostra CSP, HSTS e `X-Frame-Options: DENY`
- [ ] Cadastro, login, F5 sem perder a sessão (cookie via rewrite) e "esqueci a senha"
- [ ] Indicador "Tempo real" no cabeçalho (WebSocket direto na Render)
- [ ] Criar alerta com gatilho baixo e receber a notificação em até ~1 min
- [ ] `/metrics` com `Authorization: Bearer <METRICS_TOKEN>`

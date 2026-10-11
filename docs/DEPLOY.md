# Deploy — Render + Neon + Upstash

Custo: **R$ 0** nos planos gratuitos (com as limitações de cada um). Tempo estimado: 30–40 min na primeira vez.

```
GitHub (main) ──CI verde──▶ cd.yml ──▶ migrations (Neon) ──▶ deploy API (Render) ──▶ healthcheck ──▶ deploy front
                                                                     └── falhou? rollback automático
```

## 1. Banco — Neon (PostgreSQL)

1. Crie uma conta em [neon.tech](https://neon.tech) → **New Project** (região mais próxima do Render, ex.: `us-west-2` para Render Oregon).
2. Em **Connection Details**, copie **duas** strings:
   - **Pooled** (host com `-pooler`): usada pela API → `DATABASE_URL`.
   - **Direct** (sem `-pooler`): usada pelas migrations → secret `NEON_DATABASE_URL_DIRECT`.
   Ambas com `?sslmode=require`.
3. Point-in-time restore já vem habilitado (plano free: 24 h). É a rede de segurança da ADR-010.

## 2. Redis — Upstash

1. [upstash.com](https://upstash.com) → **Create Database** (Redis, mesma região, TLS ligado).
2. Copie a URL `rediss://default:<senha>@<host>:6379` → `REDIS_URL`.
3. A política de eviction padrão do Upstash é compatível com BullMQ (não despeja chaves). Confirme em *Configuration*.

## 3. E-mail — Resend (opcional, recomendado)

1. [resend.com](https://resend.com) → API Key → `RESEND_API_KEY`.
2. Verifique um domínio para `EMAIL_FROM` (sem domínio verificado, só é possível enviar para o seu próprio e-mail).

## 4. Chaves das APIs de mercado (opcional)

| Variável | Onde obter | Sem ela |
|---|---|---|
| `BRAPI_TOKEN` | brapi.dev | alguns tickers (PETR4, VALE3, ITUB4) funcionam sem token |
| `ALPHA_VANTAGE_API_KEY` | alphavantage.co | ações globais ficam "indisponível" |
| `COINGECKO_API_KEY` | coingecko.com (Demo) | funciona com limite menor |

## 5. Render

### 5.1 Via Blueprint (recomendado)

1. Faça push do repositório para o GitHub.
2. Render → **New → Blueprint** → selecione o repositório. O `render.yaml` cria:
   - `turbo-mais-api` (Web Service Docker, healthcheck `/ready`);
   - `turbo-mais` (Static Site com rewrite `/api/*` → API e headers de segurança).
3. Preencha as variáveis marcadas como `sync: false`:
   - API: `DATABASE_URL` (pooled), `REDIS_URL`, `CORS_ORIGINS` e `FRONTEND_URL` (URL do site, ex.: `https://turbo-mais.onrender.com`), `RESEND_API_KEY`, `EMAIL_FROM`, chaves de mercado.
   - Site: `VITE_SOCKET_URL` = URL da API (o rewrite do site estático não faz upgrade de WebSocket).
4. Se o nome da API não for `turbo-mais-api`, ajuste a URL no `render.yaml` (rewrite e CSP `connect-src`).

> **Plano free:** não há background worker, então `RUN_WORKERS_IN_PROCESS=true` roda os workers dentro da API (trade-off na ADR-009). A instância free "dorme" após 15 min sem tráfego — o primeiro acesso leva ~30–50 s.

### 5.2 HTTPS e domínio próprio (opcional)

HTTPS é automático (Let's Encrypt) nos domínios `onrender.com`. Para domínio próprio: *Settings → Custom Domains* em cada serviço, crie o CNAME indicado no seu DNS e atualize `CORS_ORIGINS`, `FRONTEND_URL`, o rewrite e a CSP.

## 6. GitHub — CI/CD

### 6.1 Secrets (Settings → Secrets and variables → Actions → Secrets)

| Secret | Valor |
|---|---|
| `RENDER_API_KEY` | Render → Account Settings → API Keys |
| `RENDER_SERVICE_ID_API` | ID `srv-...` da API (aparece na URL do serviço) |
| `RENDER_SERVICE_ID_FRONTEND` | ID do site estático |
| `RENDER_SERVICE_ID_WORKER` | (só se tiver worker dedicado) |
| `NEON_DATABASE_URL_DIRECT` | string **direta** do Neon |
| `SNYK_TOKEN` | snyk.io → Account settings (opcional) |
| `BRAPI_TOKEN`, `ALPHA_VANTAGE_API_KEY`, `COINGECKO_API_KEY` | para o teste de contrato diário (opcional) |
| `DEMO_USER_PASSWORD` | se quiser um usuário demo em produção |

### 6.2 Variables (mesma tela → aba Variables)

| Variable | Exemplo |
|---|---|
| `API_URL` | `https://turbo-mais-api.onrender.com` |
| `FRONTEND_URL` | `https://turbo-mais.onrender.com` |
| `RENDER_HAS_WORKER` | `false` |
| `SEED_DEMO_USER` | `true` para criar o usuário demo |

### 6.3 Environment

Crie o environment **`producao`** (Settings → Environments). Opcional: exigir aprovação manual antes do deploy.

### 6.4 Branch protection (Settings → Branches → main)

- Require a pull request before merging (+ review from Code Owners)
- Require status checks: `Backend — lint, testes e auditoria`, `Frontend — lint, testes, build e auditoria`, `Consistência entre camadas`, `Build das imagens Docker`, `CodeQL (JavaScript)`, `Trivy — imagem api`
- Require branches to be up to date · Do not allow bypassing

## 7. O primeiro deploy

1. Desative o *Auto-Deploy* nos serviços do Render (o Blueprint já cria com `autoDeploy: false`).
2. Merge na `main` → acompanhe a aba **Actions → CD**.
3. Ao final, o job **Smoke test** valida `/health`, Swagger e a home.

## 8. Rollback

**Automático:** se o deploy falhar no Render ou o `/ready` não responder em 2 min, o `render-deploy.sh` chama `POST /services/:id/rollback` para o deploy que estava no ar.

**Manual:**
- Render → serviço → **Events** → deploy anterior → **Rollback**; ou
- `curl -X POST -H "Authorization: Bearer $RENDER_API_KEY" -H "Content-Type: application/json" https://api.render.com/v1/services/$SERVICE_ID/rollback -d '{"deployId":"dep-..."}'`

**Banco:** migrations são só aditivas (expand/contract) — o código antigo continua funcionando com o schema novo, então rollback de código não exige rollback de banco. Para desastre (migration destrutiva), use o **restore do Neon** (Branches → Restore a um instante anterior) e corrija com uma nova migration.

## 9. Checklist pós-deploy

- [ ] `GET /health` → `status: ok` (ou `degradado` se alguma API externa estiver fora)
- [ ] `GET /metrics` com `Authorization: Bearer <METRICS_TOKEN>`
- [ ] Cadastro, login e "esqueci a senha" (e-mail chega)
- [ ] Criar alerta com gatilho baixo e ver a notificação em até ~1 min
- [ ] Headers: `curl -I https://turbo-mais.onrender.com` mostra CSP, X-Frame-Options e HSTS

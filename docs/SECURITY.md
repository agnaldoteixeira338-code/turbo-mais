# Segurança do Turbo Mais

> Escopo: o Turbo Mais **não movimenta dinheiro** e não guarda dados de pagamento, CPF ou nome. Os ativos a proteger são: contas (e-mail, celular, senha), sessões, a watchlist/alertas do usuário e a disponibilidade do serviço. A análise STRIDE completa está em [threat-model/THREAT-MODEL.md](threat-model/THREAT-MODEL.md).

## 1. Princípios

1. **Defesa em profundidade** — nenhuma proteção é a única (ex.: XSS é barrado pelo React, pela sanitização de entrada e pela CSP).
2. **Mínimo de dados** — sem nome/CPF; JWT só com `sub`; logs com redação.
3. **Fail fast na configuração, fail-safe na operação** — a API não sobe com segredo fraco; em produção, a falha de uma dependência degrada a funcionalidade em vez de expor dados.
4. **Segredos fora do código** — `.env` no `.gitignore`; produção usa variáveis do Render/GitHub Secrets.

## 2. OWASP Top 10 (2021) — como cada item é tratado

| # | Risco | Controles no Turbo Mais |
|---|---|---|
| A01 | Quebra de controle de acesso | Todas as queries de recurso filtram por `usuario_id` do token (nunca do corpo). Recurso de outro usuário → **404** (não confirma existência). `authMiddleware` em todas as rotas de dados. Testado (IDOR) na integração. |
| A02 | Falhas criptográficas | Bcrypt custo 12; refresh tokens opacos de 384 bits guardados como sha256; códigos 2FA como **HMAC** com pepper; JWT HS256 com **segredo por finalidade**, `algorithms` fixado, `iss`/`aud` verificados; HSTS em produção; cookies `Secure`. |
| A03 | Injeção | SQL 100% parametrizado (`$1..$n`); `LIKE` com curingas escapados; Zod `.strict()` em todas as entradas; sanitização de texto livre (xss) e remoção de caracteres de controle; templates de e-mail com escape de HTML. |
| A04 | Design inseguro | Threat model STRIDE; anti-enumeração no "esqueci a senha"; desafio 2FA exige senha prévia; rotação com detecção de reuso; limite de alertas por usuário. |
| A05 | Configuração incorreta | Helmet com **CSP real** (`default-src 'none'` na API; CSP estrita sem `unsafe-inline` no SPA); CORS por whitelist; `x-powered-by` desligado; validação de env com Zod (produção exige `COOKIE_SECURE=true`); Swagger com CSP própria; stack trace nunca vai ao cliente. |
| A06 | Componentes vulneráveis | `npm audit` (bloqueia crítica) no CI; Snyk em todo PR; Trivy nas imagens; CodeQL; Dependency Review; Dependabot semanal. Imagens Alpine mínimas, sem devDependencies. |
| A07 | Falhas de autenticação | Política de senha (8+, maiúscula, minúscula, número, especial, ≤ 72 bytes); bloqueio após **5 falhas** (15 min, por conta, no Redis); rate limit por IP nas rotas de auth; mensagem genérica + hash isca contra timing; 2FA por e-mail; reset de senha de uso único que **revoga todas as sessões**. |
| A08 | Integridade de software/dados | `npm ci` com lockfile; CI obrigatório antes do merge; CODEOWNERS em áreas sensíveis; deploy só pelo pipeline; migrations versionadas. |
| A09 | Falhas de log e monitoramento | Audit log de ações críticas (login ok/falha/bloqueio, logout, reuso de refresh, reset/troca de senha, 2FA, criação/edição/remoção de alerta, favoritos); logs JSON com `requestId`; métricas de erro por código; redação automática de dados sensíveis. |
| A10 | SSRF | A API só chama URLs fixas de provedores configurados; o usuário nunca fornece URL. Ticker validado por regex e `encodeURIComponent` antes de compor a URL. |

## 3. Sessão e tokens

| Item | Onde vive | Duração | Proteção |
|---|---|---|---|
| Access token (JWT) | **memória** do SPA | 15 min | não persiste (XSS não lê storage); vai no header → imune a CSRF |
| Refresh token (opaco) | cookie `httpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth` | 7 dias | rotação a cada uso; reuso revoga a família; hash no banco |
| Cookie CSRF | cookie legível (`__Host-csrf` em produção) | 7 dias | double-submit no header `X-CSRF-Token` para `/refresh` e `/logout` |
| Token de reset | link no **fragmento** (`#token=`) | 15 min | uso único (UPDATE atômico); fragmento não vai para logs nem Referer; a página limpa a URL |
| Desafio 2FA | resposta do login | 5 min | segredo próprio; só emitido após senha correta |
| Código 2FA | e-mail | 10 min | HMAC no banco; 5 tentativas por código; novo código invalida o anterior |

**Trade-off documentado:** não mantemos denylist de access tokens. Após logout, um access token roubado vale por até 15 min. Aceito em troca de validação stateless; o WebSocket é derrubado na expiração do token.

## 4. Rate limiting

| Perfil | Limite | Chave |
|---|---|---|
| global | 300 req / 15 min | IP (IPv6 por sub-rede /56) |
| auth (cadastro, login, 2FA) | 10 req / 15 min | IP |
| sensível (esqueci/resetar senha) | 5 req / hora | IP |
| usuário (rotas autenticadas) | 120 req / min | id do usuário |

Store no Redis (global entre réplicas). **Fail-open** se o Redis cair: preferimos disponibilidade; a força bruta continua limitada pelo custo do bcrypt e pelo bloqueio de conta (que também é fail-open — risco aceito e monitorado via `/health`).

## 5. Logs e privacidade

Redação automática (Pino `redact`) de: `authorization`, `cookie`, `set-cookie`, `x-csrf-token`, `senha`, `token`, `refreshToken`, `codigo`, `celular`, `link` e hashes. E-mails são **mascarados** (`an***@gmail.com`). O Redis guarda o contador de falhas por `sha256(email)`, nunca o e-mail.

## 6. Segurança automatizada (CI)

| Ferramenta | Quando | Bloqueia merge? |
|---|---|---|
| `npm audit --audit-level=critical` | todo PR (ci + security) | sim |
| Snyk (`SNYK_TOKEN`) | todo PR + semanal | sim, severidade ≥ high |
| Trivy (imagens API e web) | todo PR + semanal | sim, CRITICAL com correção disponível |
| CodeQL `security-extended` | todo PR + push + semanal | via Code Scanning |
| Dependency Review | todo PR | sim, ≥ high ou licença GPL/AGPL |
| Dependabot | semanal | — (abre PRs) |

Para ativar o Snyk: crie a conta em snyk.io, gere um token e salve como secret `SNYK_TOKEN`. Sem o token, o job emite um aviso e é pulado.

## 7. Como reportar uma vulnerabilidade

Não abra issue pública. Envie e-mail para o mantenedor (ver README) com passos para reproduzir. Resposta em até 72 h.

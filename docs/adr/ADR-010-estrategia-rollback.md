# ADR-010 — Estratégia de deploy e rollback

- **Status:** Aceita
- **Data:** 2026-09-05

## Contexto

Deploy automático a cada merge só é seguro se: (1) um deploy ruim é detectado em minutos; (2) voltar atrás é automático; (3) voltar atrás **não quebra o banco**.

O ponto (3) é o difícil: o código pode voltar em segundos; o schema, não.

## Decisão

### Pipeline (`cd.yml`)

1. **CI completo** (reutilizado): lint, unitários (≥ 80 %), contrato, integração, E2E, build, audit.
2. **Migrations no Neon** (`prisma migrate deploy`, conexão direta) **antes** do deploy do código.
3. **Backend na Render** ([ADR-011](ADR-011-hospedagem-vercel-render.md)) — `render-deploy.sh`:
   - guarda o ID do deploy *live* atual e dispara o deploy do commit;
   - espera ficar `live` (a Render só troca o tráfego após o `healthCheckPath: /ready` passar);
   - healthcheck externo (`/ready`, 12 tentativas × 10 s);
   - falhou → **`POST /services/:id/rollback`** para o deploy guardado e o job falha com erro explícito.
   O worker dedicado (quando existir) usa o mesmo script.
4. **Frontend na Vercel**, só depois da API — `vercel-deploy.sh`:
   - guarda o deploy de produção atual;
   - `vercel build` + `vercel deploy --prebuilt --prod` (o artefato publicado é exatamente o que foi construído no CI);
   - healthcheck da home **e** de `/api/docs.json` através do rewrite (prova que a ponte Vercel → Render funciona);
   - falhou → **`vercel rollback`** para o deploy guardado.
5. **Smoke test** ponta a ponta: `/health` da API, rotas do SPA, cabeçalhos de segurança e um login (esperando 401) passando pelo rewrite.
6. `concurrency: deploy-producao` sem cancelamento: nunca há dois deploys simultâneos nem deploy interrompido no meio.

A ordem API → front garante que um frontend novo nunca chama uma API antiga. No sentido inverso (API nova, front antigo durante alguns segundos), a compatibilidade é garantida pela evolução apenas aditiva da v1 ([ADR-006](ADR-006-api-versionamento.md)).

### Regra de ouro das migrations: **expand / contract**

Como o código antigo roda durante o deploy — e de novo após um rollback — **toda migration precisa ser compatível com a versão anterior do código**:

| Mudança desejada | Como fazer |
|---|---|
| Adicionar coluna | `ADD COLUMN ... NULL` ou com `DEFAULT` (expand) — seguro |
| Renomear coluna | 3 deploys: adiciona nova + escreve nas duas → backfill + lê da nova → remove a antiga (contract) |
| Remover coluna | só depois que nenhuma versão em produção (nem a de rollback) a usa |
| Criar índice | `CREATE INDEX CONCURRENTLY` em tabelas grandes (fora de transação) |

Consequência: **não existe "down migration" no fluxo normal**. O rollback é do código; o schema só anda para frente. Uma migration destrutiva errada se corrige com uma nova migration (forward fix), apoiada no **point-in-time restore do Neon** (branch a partir de um instante anterior) para o pior caso.

A migration `20260901000100_audit_log_retencao` é um exemplo de migration aditiva segura.

### Seeds

Idempotentes (`ON CONFLICT DO UPDATE`) e executados a cada deploy — o CI roda `db:seed` duas vezes seguidas para provar.

## Alternativas consideradas

- **Blue/green com dois bancos**: rollback instantâneo de schema, mas custo e complexidade de sincronização desproporcionais.
- **Down migrations automáticas no rollback**: perigosas (perda de dados ao desfazer `ADD COLUMN` já populada) e raramente testadas.
- **Deploy manual**: lento e propenso a esquecer migrations.
- **Canary**: ideal em produção com tráfego relevante; a Render não oferece divisão de tráfego nativa para a API. Fica no roadmap.

## Consequências

- (+) Tempo médio de recuperação de um deploy ruim: ~2–3 min, sem humano.
- (+) Rollback seguro por construção, porque o schema é sempre compatível com a versão N-1.
- (−) Mudanças de schema "grandes" levam vários deploys (expand/contract). É o preço da segurança.
- (−) Healthcheck verde não pega bug de lógica. Mitigação: smoke test + E2E no CI + alarmes de taxa de erro (`turbo_mais_http_requests_total{status=~"5.."}`).

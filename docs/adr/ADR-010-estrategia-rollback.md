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
3. **Deploy da API** via API do Render, guardando antes o ID do deploy *live* atual.
4. Espera o deploy ficar `live` (Render só troca o tráfego após o `healthCheckPath: /ready` passar).
5. **Healthcheck externo** (`/ready`, 12 tentativas × 10 s).
6. Falhou em 4 ou 5 → **`POST /services/:id/rollback`** para o deploy guardado + job falha com erro explícito.
7. Frontend e worker seguem o mesmo script; **smoke test** final (`/health` completo, Swagger, home).
8. `concurrency: deploy-producao` sem cancelamento: nunca há dois deploys simultâneos nem deploy interrompido no meio.

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
- **Canary**: ideal em produção com tráfego relevante; o Render não oferece divisão de tráfego nativa. Fica no roadmap.

## Consequências

- (+) Tempo médio de recuperação de um deploy ruim: ~2–3 min, sem humano.
- (+) Rollback seguro por construção, porque o schema é sempre compatível com a versão N-1.
- (−) Mudanças de schema "grandes" levam vários deploys (expand/contract). É o preço da segurança.
- (−) Healthcheck verde não pega bug de lógica. Mitigação: smoke test + E2E no CI + alarmes de taxa de erro (`turbo_mais_http_requests_total{status=~"5.."}`).

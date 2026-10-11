# ADR-001 — SQL puro (pg) para acesso a dados; Prisma apenas para migrations

- **Status:** Aceita
- **Data:** 2026-09-01
- **Decisores:** time de backend

## Contexto

O Turbo Mais tem um modelo de dados pequeno (11 tabelas), mas com consultas onde o *como* importa:

- `INSERT ... ON CONFLICT (hash_idempotencia) DO NOTHING RETURNING` é o **mecanismo** de idempotência das notificações (ADR-008);
- `SELECT ... FOR UPDATE` serializa a rotação de refresh tokens;
- `UPDATE ... WHERE usado = FALSE RETURNING` consome tokens de reset/2FA de forma atômica;
- `COUNT(*) OVER ()` traz o total da paginação na mesma ida ao banco;
- `INSERT ... SELECT FROM UNNEST(...)` grava as 10 sugestões de uma ideia em um round-trip;
- índices parciais (`WHERE ativo = TRUE`, `WHERE lida = FALSE`) desenhados para queries específicas.

Precisamos também de migrations versionadas, revisáveis em PR e aplicadas exatamente uma vez por ambiente.

## Decisão

1. **Acesso a dados com `pg` e SQL parametrizado** (`$1, $2...`) em repositórios que implementam interfaces do domínio.
2. **Prisma usado só como motor de migrations** (`prisma migrate deploy`). O `schema.prisma` contém apenas o `datasource` — **sem models** — e as migrations são SQL escrito à mão em `database/migrations/*/migration.sql`.
3. `database/schema.sql` é a "foto" legível do schema; o CI garante que ela bate com a migration inicial.

## Alternativas consideradas

| Opção | Por que não |
|---|---|
| Prisma Client como ORM | Esconde exatamente as construções acima (ON CONFLICT com RETURNING parcial, FOR UPDATE, UNNEST) ou exige `$queryRaw`, perdendo o benefício. Gera um client de ~MBs e um passo de `generate` no build. |
| Knex (query builder) | Bom meio-termo, mas adiciona uma DSL para aprender sem ganho real num schema deste tamanho. |
| node-pg-migrate / Flyway | Válidos. Prisma Migrate foi escolhido pela ferramenta de *diff* e por registrar o histórico em `_prisma_migrations`, útil no CD. |
| TypeORM/Sequelize | Mesmos problemas do ORM, com mais mágica (decorators, lazy loading, N+1 acidental). |

## Consequências

**Positivas**
- O SQL que roda em produção é o SQL que está no código — revisão de PR e `EXPLAIN` diretos.
- Zero risco de SQL injection por construção: nenhuma concatenação; o ESLint e a revisão procuram template strings em `query(...)`.
- Repositórios são finos e substituíveis (os testes unitários usam fakes em memória que estendem as mesmas interfaces).

**Negativas / custos aceitos**
- Mapeamento manual `snake_case → camelCase` (funções `paraEntidade`).
- Sem verificação de tipos das queries em tempo de compilação. Mitigação: testes de integração contra Postgres real no CI.
- Duas fontes descrevem o schema (migrations + `schema.sql`). Mitigação: verificação automática no CI (`consistencia`).

## Nota: Bcrypt

Usamos `bcryptjs` (implementação JS do mesmo algoritmo/formato `$2b$`) em vez do binding nativo `bcrypt`. Motivo: elimina toolchain C++ no build Alpine e no Windows. Custo: ~30% mais lento por hash, aceitável porque só ocorre em cadastro/login/reset. Os hashes são intercambiáveis; trocar pelo nativo não exige migração de dados.

## Quando revisitar

Se o número de tabelas/consultas crescer a ponto de o mapeamento manual virar fonte de bugs, avaliar **Kysely** (query builder tipado) mantendo SQL explícito.

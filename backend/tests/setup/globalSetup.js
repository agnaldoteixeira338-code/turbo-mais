/**
 * Prepara o banco de TESTE antes da suíte de integração/e2e:
 * recria o schema público, aplica schema.sql, as migrations POSTERIORES à
 * inicial e por fim seeds.sql.
 *
 * schema.sql é idêntico à migration inicial (o CI confere); as migrations
 * seguintes são aditivas e precisam ser aplicadas por cima, na mesma ordem que
 * o `prisma migrate deploy` usa em produção. Sem isso, o seed quebraria assim
 * que uma migration nova adicionasse uma coluna que ele preenche.
 * Em CI o Postgres sobe como service container; localmente, via docker compose.
 */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const MIGRATION_INICIAL = '20260901000000_init';

module.exports = async function globalSetup() {
  require('./env');
  const url = process.env.DATABASE_URL;
  if (!/test/.test(url)) {
    throw new Error(`Recusando preparar um banco que não parece ser de teste: ${url}`);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    const dir = path.resolve(__dirname, '../../../database');
    await client.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));

    const migrations = fs
      .readdirSync(path.join(dir, 'migrations'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== MIGRATION_INICIAL)
      .map((e) => e.name)
      .sort();
    for (const nome of migrations) {
      await client.query(fs.readFileSync(path.join(dir, 'migrations', nome, 'migration.sql'), 'utf8'));
    }

    await client.query(fs.readFileSync(path.join(dir, 'seeds.sql'), 'utf8'));
  } finally {
    await client.end();
  }
};

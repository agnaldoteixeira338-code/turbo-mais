/**
 * Prepara o banco de TESTE antes da suíte de integração/e2e:
 * recria o schema público e aplica schema.sql + seeds.sql.
 * Em CI o Postgres sobe como service container; localmente, via docker compose.
 */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

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
    await client.query(fs.readFileSync(path.join(dir, 'seeds.sql'), 'utf8'));
  } finally {
    await client.end();
  }
};

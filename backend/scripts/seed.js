/**
 * Aplica /database/seeds.sql (idempotente) e, se SEED_DEMO_USER=true, cria o
 * usuário de demonstração. Uso: npm run db:seed
 */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

if (process.env.NODE_ENV !== 'production') require('dotenv').config({ quiet: true });

const CANDIDATOS = [path.resolve(__dirname, '../../database/seeds.sql'), '/database/seeds.sql'];

async function main() {
  const arquivo = CANDIDATOS.find((p) => fs.existsSync(p));
  if (!arquivo) throw new Error('seeds.sql não encontrado');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  try {
    await client.query(fs.readFileSync(arquivo, 'utf8'));
    console.log('✅ catálogo de ativos aplicado');

    if (process.env.SEED_DEMO_USER === 'true') {
      const email = process.env.DEMO_USER_EMAIL ?? 'demo@turbomais.dev';
      const senha = process.env.DEMO_USER_PASSWORD ?? 'Demo@12345';
      const hash = await bcrypt.hash(senha, 12);
      const { rows } = await client.query(
        `INSERT INTO usuarios (email, celular, senha_hash) VALUES ($1, '+5511999990000', $2)
         ON CONFLICT ((lower(email))) DO NOTHING RETURNING id`,
        [email, hash],
      );
      const id = rows[0]?.id ?? (await client.query('SELECT id FROM usuarios WHERE lower(email) = lower($1)', [email])).rows[0].id;
      await client.query(
        `INSERT INTO favoritos (usuario_id, ticker, tipo) VALUES ($1, 'PETR4', 'acao_br'), ($1, 'NVDA', 'acao_global'), ($1, 'BTC', 'cripto')
         ON CONFLICT DO NOTHING`,
        [id],
      );
      await client.query(
        `INSERT INTO alertas (usuario_id, ticker, gatilho_percentual, direcao) VALUES ($1, 'PETR4', 2, 'ambas'), ($1, 'BTC', 3, 'ambas')
         ON CONFLICT DO NOTHING`,
        [id],
      );
      console.log(`✅ usuário demo pronto: ${email}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ seed falhou:', err.message);
  process.exit(1);
});

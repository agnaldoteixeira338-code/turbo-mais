const { Pool } = require('pg');

/**
 * Pool de conexões PostgreSQL.
 *
 * Cada limite existe por um motivo:
 *  - max: conexões por réplica. No Neon free (~100 conexões), 10 × N réplicas
 *    + workers precisa caber; em escala, usar o pooler (PgBouncer) do Neon.
 *  - connectionTimeoutMillis: falha rápido se o banco não aceitar conexão
 *    (em vez de enfileirar requisições para sempre).
 *  - statement_timeout: nenhuma query roda mais de 10s — protege o banco
 *    de uma query patológica segurando locks.
 */
function criarPool({ connectionString, max = 10, ssl = false, logger }) {
  const pool = new Pool({
    connectionString,
    max,
    ssl: ssl ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
    query_timeout: 12_000,
    application_name: 'turbo-mais',
  });

  // Erro em cliente OCIOSO (ex.: banco reiniciou). Sem este listener o
  // processo inteiro cairia com "Unhandled 'error' event".
  pool.on('error', (err) => logger?.error({ err }, 'erro em conexão ociosa do pool PostgreSQL'));
  return pool;
}

/** Executa `fn(client)` dentro de BEGIN/COMMIT, com ROLLBACK em qualquer erro. */
async function comTransacao(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { criarPool, comTransacao };

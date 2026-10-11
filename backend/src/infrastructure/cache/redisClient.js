const Redis = require('ioredis');

/**
 * Fábrica de conexões Redis.
 *
 * Usamos conexões separadas por papel, porque têm requisitos diferentes:
 *  - geral (cache, rate limit, idempotência): falha rápido (maxRetriesPerRequest
 *    baixo) — melhor degradar do que travar a requisição HTTP;
 *  - BullMQ: maxRetriesPerRequest = null é OBRIGATÓRIO para workers (comandos
 *    bloqueantes como BRPOPLPUSH);
 *  - pub/sub do Socket.IO: uma conexão em modo subscribe não pode emitir
 *    outros comandos.
 *
 * Funciona igual com Redis local (redis://) e Upstash (rediss:// com TLS).
 */
function criarConexaoRedis(url, { papel = 'geral', logger } = {}) {
  const ehBull = papel === 'bullmq';
  const cliente = new Redis(url, {
    connectionName: `turbo-mais:${papel}`,
    maxRetriesPerRequest: ehBull ? null : 2,
    enableReadyCheck: true,
    connectTimeout: 5000,
    // Reconexão com backoff exponencial limitado a 5s
    retryStrategy: (tentativa) => Math.min(2 ** tentativa * 50, 5000),
    lazyConnect: false,
  });

  cliente.on('error', (err) => logger?.error({ err: { message: err.message, code: err.code }, papel }, 'erro na conexão Redis'));
  cliente.on('reconnecting', () => logger?.warn({ papel }, 'reconectando ao Redis'));
  return cliente;
}

module.exports = { criarConexaoRedis };

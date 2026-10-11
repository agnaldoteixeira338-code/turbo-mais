const pRetry = require('p-retry');

/**
 * Retry com backoff exponencial + jitter.
 *
 * Só repete o que PODE dar certo na segunda vez: erros de rede, timeouts,
 * 5xx e 429. Um 400/404 é determinístico — repetir só gasta cota da API.
 * Para isso, o cliente marca o erro com `retryable = false`.
 *
 * Valores padrão (≈ 200ms → 400ms, com jitter) mantêm o pior caso abaixo do
 * timeout do circuit breaker; ver ADR-007 para a conta completa.
 */
const PADRAO = Object.freeze({ retries: 2, factor: 2, minTimeout: 200, maxTimeout: 1500, randomize: true });

function comRetry(fn, { nome, logger, ...opcoes } = {}) {
  return pRetry(
    async (tentativa) => {
      try {
        return await fn(tentativa);
      } catch (err) {
        if (err && err.retryable === false) throw new pRetry.AbortError(err);
        throw err;
      }
    },
    {
      ...PADRAO,
      ...opcoes,
      onFailedAttempt: (erro) => {
        logger?.warn(
          { dependencia: nome, tentativa: erro.attemptNumber, restantes: erro.retriesLeft, erro: erro.message },
          'chamada externa falhou; aplicando backoff',
        );
      },
    },
  );
}

module.exports = { comRetry, PADRAO };

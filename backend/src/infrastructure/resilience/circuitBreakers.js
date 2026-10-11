const CircuitBreaker = require('opossum');
const { comRetry } = require('./retryPolicy');

/**
 * Circuit breakers (opossum) — um por dependência externa.
 *
 * Política (ADR-007): se ≥50% das chamadas falharem numa janela de 60s
 * (com no mínimo 5 chamadas, para não abrir com 1 erro isolado), o circuito
 * ABRE e por 30s rejeitamos instantaneamente, sem tocar a API. Depois,
 * MEIO-ABERTO: uma chamada de teste decide se fecha ou reabre.
 *
 * Por que isso importa: sem breaker, uma API lenta prende conexões e event
 * loop da NOSSA API (falha em cascata). Com breaker, falhamos rápido e o
 * cache stale-while-revalidate cobre o buraco.
 */
const OPCOES_PADRAO = Object.freeze({
  timeout: 8000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  rollingCountTimeout: 60_000,
  rollingCountBuckets: 6,
  volumeThreshold: 5,
});

const registro = new Map();

function estadoDe(breaker) {
  if (breaker.opened) return 'aberto';
  if (breaker.halfOpen) return 'meio-aberto';
  return 'fechado';
}

function criarCircuitBreaker(nome, acao, { logger, opcoes } = {}) {
  const breaker = new CircuitBreaker(acao, {
    ...OPCOES_PADRAO,
    // 404 "ticker não existe" é resposta válida, não falha da dependência
    errorFilter: (err) => err?.status === 404,
    ...opcoes,
    name: nome,
  });
  breaker.on('open', () => logger?.error({ circuito: nome }, 'circuit breaker ABERTO — chamadas suspensas'));
  breaker.on('halfOpen', () => logger?.warn({ circuito: nome }, 'circuit breaker MEIO-ABERTO — testando dependência'));
  breaker.on('close', () => logger?.info({ circuito: nome }, 'circuit breaker FECHADO — dependência recuperada'));
  registro.set(nome, breaker);
  return breaker;
}

/**
 * Compõe breaker(retry(fn)): o breaker conta UMA falha por chamada lógica
 * (após esgotar os retries), não uma por tentativa.
 * @returns {(fn: () => Promise<any>) => Promise<any>}
 */
function criarChamadaResiliente(nome, { logger, opcoesRetry, opcoesBreaker } = {}) {
  const breaker = criarCircuitBreaker(nome, (fn) => comRetry(fn, { nome, logger, ...opcoesRetry }), {
    logger,
    opcoes: opcoesBreaker,
  });
  const chamar = (fn) => breaker.fire(fn);
  chamar.breaker = breaker;
  return chamar;
}

function estadoDosCircuitos() {
  return [...registro.entries()].map(([nome, breaker]) => ({
    nome,
    estado: estadoDe(breaker),
    estatisticas: {
      sucessos: breaker.stats.successes,
      falhas: breaker.stats.failures,
      rejeicoes: breaker.stats.rejects,
      timeouts: breaker.stats.timeouts,
    },
  }));
}

function encerrarCircuitos() {
  for (const breaker of registro.values()) breaker.shutdown();
  registro.clear();
}

module.exports = { criarCircuitBreaker, criarChamadaResiliente, estadoDosCircuitos, encerrarCircuitos, OPCOES_PADRAO };

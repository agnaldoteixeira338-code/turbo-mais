const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { TooManyRequestsError } = require('../../../application/errors');

/**
 * Rate limiting com store no REDIS: o limite é global entre réplicas
 * (com store em memória, 3 réplicas = 3x o limite — ver ADR-009).
 *
 * Perfis (documentados no Swagger, extensão x-rate-limit):
 *   global     300 req / 15 min por IP     — todas as rotas
 *   auth        10 req / 15 min por IP     — cadastro, login, 2FA
 *   sensivel     5 req / 60 min por IP     — esqueci-senha, resetar-senha
 *   usuario    120 req /  1 min por usuário — rotas autenticadas
 *
 * passOnStoreError: se o Redis cair, o limitador deixa passar (fail-open).
 * Trade-off consciente: disponibilidade > proteção momentânea; o bloqueio de
 * conta e o bcrypt continuam limitando força bruta.
 */
const PERFIS = Object.freeze({
  global: { windowMs: 15 * 60 * 1000, limit: 300 },
  auth: { windowMs: 15 * 60 * 1000, limit: 10 },
  sensivel: { windowMs: 60 * 60 * 1000, limit: 5 },
  usuario: { windowMs: 60 * 1000, limit: 120 },
});

function criarRateLimiters({ redis, desabilitado = false } = {}) {
  const criar = (nome, { porUsuario = false } = {}) => {
    const { windowMs, limit } = PERFIS[nome];
    return rateLimit({
      windowMs,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: () => desabilitado,
      passOnStoreError: true,
      keyGenerator: (req) => (porUsuario && req.usuario ? `u:${req.usuario.id}` : `ip:${ipKeyGenerator(req.ip)}`),
      store: redis && !desabilitado ? new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix: `rl:${nome}:` }) : undefined,
      handler: (req, res, next, opcoes) => {
        const retryAfter = Math.ceil(opcoes.windowMs / 1000);
        next(new TooManyRequestsError('Muitas requisições. Tente novamente mais tarde.', retryAfter));
      },
    });
  };

  return {
    global: criar('global'),
    auth: criar('auth'),
    sensivel: criar('sensivel'),
    usuario: criar('usuario', { porUsuario: true }),
  };
}

module.exports = { criarRateLimiters, PERFIS };

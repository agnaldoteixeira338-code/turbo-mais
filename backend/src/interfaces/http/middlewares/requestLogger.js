const crypto = require('node:crypto');
const pinoHttp = require('pino-http');
const { executarComContexto } = require('../../../shared/requestContext');

// Aceita um X-Request-Id vindo do proxy/cliente, mas só se for "bem-comportado"
// (evita log injection e IDs gigantes).
const ID_VALIDO = /^[A-Za-z0-9._-]{8,64}$/;
const ROTAS_SILENCIOSAS = new Set(['/health', '/live', '/ready', '/metrics']);

/**
 * 1) Gera/propaga o Request ID (header X-Request-Id na resposta)
 * 2) Abre o contexto AsyncLocalStorage da requisição (correlação de logs)
 * 3) Loga a requisição com pino-http (JSON, com redação de dados sensíveis)
 */
function requestLogger(logger) {
  const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => req.id,
    autoLogging: { ignore: (req) => ROTAS_SILENCIOSAS.has(req.url) },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.remoteAddress }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });

  return (req, res, next) => {
    const recebido = req.get('x-request-id');
    req.id = recebido && ID_VALIDO.test(recebido) ? recebido : crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    executarComContexto({ requestId: req.id }, () => httpLogger(req, res, next));
  };
}

module.exports = { requestLogger };

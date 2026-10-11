const pino = require('pino');
const { obterContexto } = require('../../shared/requestContext');
const { mascararEmail } = require('../../shared/utils');

/**
 * Caminhos redigidos automaticamente em QUALQUER log (OWASP A09).
 * Melhor redigir demais do que vazar um token num agregador de logs que
 * meio time tem acesso.
 */
const CAMPOS_SENSIVEIS = [
  'senha', 'novaSenha', 'password', 'senhaHash', 'senha_hash',
  'token', 'accessToken', 'refreshToken', 'desafioToken', 'token_hash', 'tokenHash',
  'codigo', 'codigoHash', 'codigo_hash', 'celular', 'link',
];

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  ...CAMPOS_SENSIVEIS,
  ...CAMPOS_SENSIVEIS.map((c) => `*.${c}`),
  ...CAMPOS_SENSIVEIS.map((c) => `*.*.${c}`),
  'email', '*.email', '*.*.email', 'para', '*.para',
];

function censurar(valor, caminho) {
  const ultimo = caminho[caminho.length - 1];
  if ((ultimo === 'email' || ultimo === 'para') && typeof valor === 'string') return mascararEmail(valor);
  return '[REDACTED]';
}

function criarLogger({ level = process.env.LOG_LEVEL ?? 'info', nome = 'turbo-mais-api' } = {}) {
  return pino({
    name: nome,
    level,
    redact: { paths: REDACT_PATHS, censor: censurar },
    base: { servico: nome, pid: process.pid, versao: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    // Correlação: todo log sai com o requestId/usuarioId do contexto atual
    mixin() {
      const { requestId, usuarioId, jobId } = obterContexto();
      return { requestId, usuarioId, jobId };
    },
    serializers: { err: pino.stdSerializers.err },
  });
}

module.exports = { criarLogger, REDACT_PATHS };

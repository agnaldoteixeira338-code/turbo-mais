const { sha256 } = require('./utils');
const { ConflictError, UnprocessableError } = require('../application/errors');

const CHAVE_VALIDA = /^[A-Za-z0-9_-]{8,128}$/;
const TTL_SEGUNDOS = 24 * 3600;

/**
 * Middleware de IDEMPOTÊNCIA para POSTs (padrão "Idempotency-Key", IETF draft).
 *
 * Problema: o usuário clica "Criar alerta", a rede cai antes da resposta, o
 * cliente faz retry → dois alertas. Com o header `Idempotency-Key`:
 *
 *   1ª requisição  → SET NX "processando" → executa → guarda status + corpo
 *   retry          → devolve a MESMA resposta (header Idempotent-Replayed: true)
 *   concorrente    → 409 (a primeira ainda está processando)
 *   mesma chave com corpo diferente → 422 (uso indevido da chave)
 *
 * Respostas 5xx não são guardadas (a chave é liberada para novo retry).
 * O header é OPCIONAL: sem ele, a rota funciona normalmente.
 */
function idempotency({ redis, logger }) {
  return async (req, res, next) => {
    const chave = req.get('idempotency-key');
    if (!chave || !redis) return next();
    if (!CHAVE_VALIDA.test(chave)) {
      return next(new UnprocessableError('Idempotency-Key inválida (8-128 caracteres alfanuméricos)', 'IDEMPOTENCY_KEY_INVALIDA'));
    }

    const chaveRedis = `idem:${req.usuario?.id ?? 'anon'}:${req.method}:${req.baseUrl}${req.path}:${chave}`;
    const impressaoDigital = sha256(JSON.stringify(req.body ?? {}));

    let existente;
    try {
      const reservado = await redis.set(chaveRedis, JSON.stringify({ estado: 'processando', impressaoDigital }), 'EX', TTL_SEGUNDOS, 'NX');
      if (reservado === 'OK') {
        interceptarResposta(res, redis, chaveRedis, impressaoDigital, logger);
        return next();
      }
      existente = JSON.parse(await redis.get(chaveRedis));
    } catch (err) {
      logger?.warn({ err }, 'idempotência indisponível — seguindo sem proteção');
      return next();
    }

    if (!existente) return next();
    if (existente.impressaoDigital !== impressaoDigital) {
      return next(new UnprocessableError('Idempotency-Key já usada com outro conteúdo', 'IDEMPOTENCY_KEY_REUTILIZADA'));
    }
    if (existente.estado === 'processando') {
      return next(new ConflictError('Requisição idêntica ainda em processamento', 'REQUISICAO_EM_ANDAMENTO'));
    }
    res.setHeader('Idempotent-Replayed', 'true');
    return res.status(existente.status).json(existente.corpo);
  };
}

function interceptarResposta(res, redis, chaveRedis, impressaoDigital, logger) {
  const jsonOriginal = res.json.bind(res);
  res.json = (corpo) => {
    const status = res.statusCode;
    const operacao =
      status >= 500
        ? redis.del(chaveRedis)
        : redis.set(chaveRedis, JSON.stringify({ estado: 'concluido', impressaoDigital, status, corpo }), 'EX', TTL_SEGUNDOS);
    operacao.catch((err) => logger?.warn({ err }, 'falha ao gravar resposta idempotente'));
    return jsonOriginal(corpo);
  };
}

module.exports = { idempotency };

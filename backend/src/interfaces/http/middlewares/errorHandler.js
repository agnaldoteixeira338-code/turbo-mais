const { AppError, NotFoundError } = require('../../../application/errors');
const { DomainValidationError } = require('../../../domain/errors/DomainValidationError');
const { falha } = require('../resposta');

/**
 * Tradução ÚNICA de erros → HTTP. Nenhum controller tem try/catch.
 *
 *   AppError               → status/código do próprio erro (esperado)
 *   DomainValidationError  → 422 (regra de negócio violada)
 *   JSON malformado        → 400
 *   corpo grande demais    → 413
 *   qualquer outra coisa   → 500 com mensagem GENÉRICA (é bug)
 *
 * Stack trace NUNCA vai para o cliente — nem em desenvolvimento (fica só no
 * log, correlacionado pelo requestId que o cliente recebe).
 */
function errorHandler({ logger, metrics }) {
  // Express identifica error handlers pela aridade (4 parâmetros), por isso o _next
  return (err, req, res, _next) => {
    const requestId = req.id;
    let resposta;

    if (err instanceof AppError) {
      resposta = { status: err.statusCode, code: err.code, message: err.message, details: err.details };
      if (err.retryAfterSeconds) res.setHeader('Retry-After', String(err.retryAfterSeconds));
    } else if (err instanceof DomainValidationError) {
      resposta = {
        status: 422,
        code: 'REGRA_DE_NEGOCIO',
        message: err.message,
        details: err.campo ? [{ campo: err.campo, mensagem: err.message }] : undefined,
      };
    } else if (err?.type === 'entity.parse.failed') {
      resposta = { status: 400, code: 'JSON_INVALIDO', message: 'Corpo da requisição não é um JSON válido' };
    } else if (err?.type === 'entity.too.large') {
      resposta = { status: 413, code: 'CORPO_GRANDE_DEMAIS', message: 'Corpo da requisição excede o limite permitido' };
    } else {
      resposta = { status: 500, code: 'ERRO_INTERNO', message: 'Erro interno. Tente novamente em instantes.' };
    }

    if (resposta.status >= 500) {
      logger.error({ err, requestId }, 'erro não tratado');
    } else {
      logger.debug({ code: resposta.code, status: resposta.status }, 'erro de requisição');
    }
    metrics?.errosAplicacao?.inc({ codigo: resposta.code, status: String(resposta.status) });

    return falha(res, { ...resposta, requestId });
  };
}

function notFoundHandler(req, _res, next) {
  next(new NotFoundError(`Rota ${req.method} ${req.path} não encontrada`));
}

module.exports = { errorHandler, notFoundHandler };

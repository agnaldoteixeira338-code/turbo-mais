/**
 * Envelope padrão de TODAS as respostas da API:
 *   { success, data, error, meta }
 * O front trata um único formato; `error.code` é o contrato estável.
 */
function sucesso(res, data, { status = 200, meta = null } = {}) {
  return res.status(status).json({ success: true, data: data ?? null, error: null, meta });
}

function falha(res, { status, code, message, details, requestId }) {
  return res.status(status).json({
    success: false,
    data: null,
    error: { code, message, ...(details ? { details } : {}), requestId },
    meta: null,
  });
}

/** Contexto que os casos de uso recebem para auditoria — sem acoplar ao Express. */
function contextoDe(req) {
  return { ip: req.ip, userAgent: req.get('user-agent'), requestId: req.id };
}

module.exports = { sucesso, falha, contextoDe };

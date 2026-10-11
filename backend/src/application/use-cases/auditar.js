/**
 * Atalho para registrar no audit log a partir de um caso de uso.
 * `ctx` é o contexto da requisição ({ ip, userAgent, requestId }) que o
 * controller repassa — o use case não conhece o objeto `req` do Express.
 */
function auditar(auditLog, acao, ctx = {}, { usuarioId, metadados } = {}) {
  return auditLog.registrar({
    usuarioId: usuarioId ?? null,
    acao,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
    metadados: metadados ?? {},
  });
}

module.exports = { auditar };

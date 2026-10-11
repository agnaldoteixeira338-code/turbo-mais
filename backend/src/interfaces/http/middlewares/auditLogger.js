const { contextoDe } = require('../resposta');

/**
 * Auditoria declarativa por rota: `auditLogger(auditLog, 'FAVORITO_ADICIONADO')`.
 * Registra APÓS a resposta, e só se ela foi bem-sucedida (2xx) — assim a
 * gravação não adiciona latência ao usuário.
 *
 * Fluxos de autenticação NÃO usam este middleware: eles precisam auditar
 * também as falhas (ex.: LOGIN_FALHOU) e por isso auditam no próprio use case.
 */
function auditLogger(auditLog, acao, extrairMetadados = (req) => ({ ...req.valido?.params })) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const ctx = contextoDe(req);
      auditLog.registrar({
        usuarioId: req.usuario?.id,
        acao,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
        metadados: { ...extrairMetadados(req), status: res.statusCode },
      });
    });
    next();
  };
}

module.exports = { auditLogger };

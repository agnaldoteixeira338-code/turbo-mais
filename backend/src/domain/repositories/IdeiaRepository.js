/* eslint-disable no-unused-vars */
const { naoImplementado } = require('./contrato');

/** @interface */
class IdeiaRepository {
  /** @returns {Promise<Ideia>} */
  async criar({ usuarioId, textoDescrito, palavrasChave }) { naoImplementado('IdeiaRepository', 'criar'); }
  /** @returns {Promise<Sugestao[]>} */
  async adicionarSugestoes(ideiaId, sugestoes) { naoImplementado('IdeiaRepository', 'adicionarSugestoes'); }
  /** @returns {Promise<{itens: Ideia[], total: number}>} ideias com suas sugestões */
  async listar(usuarioId, { limit, offset }) { naoImplementado('IdeiaRepository', 'listar'); }
  /** Remove as ideias do usuário e, junto, as sugestões delas. @returns {Promise<number>} ideias removidas */
  async removerTodasDoUsuario(usuarioId) { naoImplementado('IdeiaRepository', 'removerTodasDoUsuario'); }
}

/** @interface Trilha de auditoria append-only. */
class AuditLogRepository {
  async registrar({ usuarioId, acao, ip, userAgent, requestId, metadados }) { naoImplementado('AuditLogRepository', 'registrar'); }
}

module.exports = { IdeiaRepository, AuditLogRepository };

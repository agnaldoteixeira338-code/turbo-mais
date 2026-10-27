/* eslint-disable no-unused-vars */
const { naoImplementado } = require('./contrato');

/** @interface */
class NotificacaoRepository {
  /**
   * INSERT ... ON CONFLICT (hash_idempotencia) DO NOTHING.
   * @returns {Promise<Notificacao|null>} null quando já existia (duplicata ignorada)
   */
  async criarSeNaoExistir(dados) { naoImplementado('NotificacaoRepository', 'criarSeNaoExistir'); }
  /** @returns {Promise<{itens: Notificacao[], total: number, naoLidas: number}>} */
  async listar(usuarioId, { apenasNaoLidas, limit, offset }) { naoImplementado('NotificacaoRepository', 'listar'); }
  /** @returns {Promise<Notificacao|null>} */
  async marcarComoLida(id, usuarioId) { naoImplementado('NotificacaoRepository', 'marcarComoLida'); }
  /** @returns {Promise<number>} quantas foram removidas */
  async removerTodasDoUsuario(usuarioId) { naoImplementado('NotificacaoRepository', 'removerTodasDoUsuario'); }
}

module.exports = { NotificacaoRepository };

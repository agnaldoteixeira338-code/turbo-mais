/* eslint-disable no-unused-vars */
const { naoImplementado } = require('./contrato');

/** @interface */
class AlertaRepository {
  /** @returns {Promise<Alerta>} lança ConflictError se já existir alerta idêntico */
  async criar({ usuarioId, ticker, gatilhoPercentual, direcao }) { naoImplementado('AlertaRepository', 'criar'); }
  /** Sempre filtra por dono — previne IDOR (OWASP A01). */
  async buscarPorId(id, usuarioId) { naoImplementado('AlertaRepository', 'buscarPorId'); }
  async atualizar(id, usuarioId, campos) { naoImplementado('AlertaRepository', 'atualizar'); }
  /** @returns {Promise<boolean>} */
  async remover(id, usuarioId) { naoImplementado('AlertaRepository', 'remover'); }
  /** @returns {Promise<{itens: Alerta[], total: number}>} */
  async listar(usuarioId, { limit, offset }) { naoImplementado('AlertaRepository', 'listar'); }
  async contarPorUsuario(usuarioId) { naoImplementado('AlertaRepository', 'contarPorUsuario'); }
  /** @returns {Promise<string[]>} tickers com ao menos um alerta ativo */
  async listarTickersComAlertasAtivos() { naoImplementado('AlertaRepository', 'listarTickersComAlertasAtivos'); }
  /** @returns {Promise<Alerta[]>} */
  async listarAtivosPorTicker(ticker) { naoImplementado('AlertaRepository', 'listarAtivosPorTicker'); }
  /** @returns {Promise<number>} quantos foram removidos */
  async removerTodosDoUsuario(usuarioId) { naoImplementado('AlertaRepository', 'removerTodosDoUsuario'); }
}

module.exports = { AlertaRepository };

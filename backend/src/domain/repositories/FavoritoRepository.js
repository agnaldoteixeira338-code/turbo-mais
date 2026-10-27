/* eslint-disable no-unused-vars */
const { naoImplementado } = require('./contrato');

/** @interface */
class FavoritoRepository {
  /** Idempotente. @returns {Promise<{favorito: Favorito, criado: boolean}>} */
  async adicionar({ usuarioId, ticker, tipo }) { naoImplementado('FavoritoRepository', 'adicionar'); }
  /** @returns {Promise<boolean>} true se algo foi removido */
  async remover(usuarioId, ticker) { naoImplementado('FavoritoRepository', 'remover'); }
  /** @returns {Promise<{itens: Favorito[], total: number}>} */
  async listar(usuarioId, { tipo, limit, offset }) { naoImplementado('FavoritoRepository', 'listar'); }
  /** @returns {Promise<number>} quantos foram removidos */
  async removerTodosDoUsuario(usuarioId) { naoImplementado('FavoritoRepository', 'removerTodosDoUsuario'); }
}

module.exports = { FavoritoRepository };

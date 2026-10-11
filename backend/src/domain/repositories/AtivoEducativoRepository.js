/* eslint-disable no-unused-vars */
const { naoImplementado } = require('./contrato');

/** @interface */
class AtivoEducativoRepository {
  /** @returns {Promise<AtivoEducativo|null>} */
  async buscarPorTicker(ticker) { naoImplementado('AtivoEducativoRepository', 'buscarPorTicker'); }
  /** @returns {Promise<AtivoEducativo[]>} */
  async buscarPorTickers(tickers) { naoImplementado('AtivoEducativoRepository', 'buscarPorTickers'); }
  /** @returns {Promise<{itens: AtivoEducativo[], total: number}>} */
  async buscar({ termo, tipo, setor, limit, offset }) { naoImplementado('AtivoEducativoRepository', 'buscar'); }
  /** Catálogo completo (pequeno, cacheável) — usado pelo motor de sugestões. */
  async listarTodos() { naoImplementado('AtivoEducativoRepository', 'listarTodos'); }
}

module.exports = { AtivoEducativoRepository };

/** Entidade Favorito: um ativo na watchlist do usuário. */
class Favorito {
  constructor({ id, usuarioId, ticker, tipo, criadoEm = new Date() }) {
    this.id = id;
    this.usuarioId = usuarioId;
    this.ticker = ticker;
    this.tipo = tipo;
    this.criadoEm = criadoEm;
  }
}

module.exports = { Favorito };

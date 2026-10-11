const { Ticker } = require('../../../domain/value-objects/Ticker');

/**
 * DELETE idempotente: remover algo que já não está na lista não é erro
 * (RFC 9110 §9.2.2). Evita 404 espúrio quando o usuário clica duas vezes
 * ou quando o cliente faz retry após timeout.
 */
class RemoverFavorito {
  constructor({ favoritoRepository }) {
    this.favoritoRepository = favoritoRepository;
  }

  async execute({ usuarioId, ticker }) {
    const { valor } = Ticker.criar(ticker);
    const removido = await this.favoritoRepository.remover(usuarioId, valor);
    return { removido };
  }
}

module.exports = { RemoverFavorito };

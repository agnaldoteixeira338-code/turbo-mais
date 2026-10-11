const { Ticker } = require('../../../domain/value-objects/Ticker');
const { NotFoundError } = require('../../errors');

/**
 * Idempotente por natureza: favoritar duas vezes o mesmo ativo não duplica
 * (UNIQUE(usuario_id, ticker) + ON CONFLICT DO NOTHING). O retorno `criado`
 * permite ao controller responder 201 na primeira vez e 200 nas seguintes.
 */
class AdicionarFavorito {
  constructor({ favoritoRepository, ativoRepository }) {
    this.favoritoRepository = favoritoRepository;
    this.ativoRepository = ativoRepository;
  }

  async execute({ usuarioId, ticker }) {
    const { valor } = Ticker.criar(ticker);
    const ativo = await this.ativoRepository.buscarPorTicker(valor);
    if (!ativo) throw new NotFoundError(`Ativo ${valor} não encontrado`);
    return this.favoritoRepository.adicionar({ usuarioId, ticker: ativo.ticker, tipo: ativo.tipo });
  }
}

module.exports = { AdicionarFavorito };

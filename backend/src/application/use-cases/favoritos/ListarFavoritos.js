const { paginar, metaPaginacao } = require('../../../shared/utils');

/** Lista a watchlist já enriquecida com a cotação atual de cada ativo. */
class ListarFavoritos {
  constructor({ favoritoRepository, ativoRepository, marketData }) {
    this.favoritoRepository = favoritoRepository;
    this.ativoRepository = ativoRepository;
    this.marketData = marketData;
  }

  async execute({ usuarioId, tipo, page, limit }) {
    const { offset } = paginar({ page, limit });
    const { itens, total } = await this.favoritoRepository.listar(usuarioId, { tipo, limit, offset });

    const ativos = await this.ativoRepository.buscarPorTickers(itens.map((f) => f.ticker));
    const porTicker = new Map(ativos.map((a) => [a.ticker, a]));
    const cotacoes = await this.marketData.obterCotacoes(ativos);
    const cotacaoPorTicker = new Map(cotacoes.map((c) => [c.ticker, c]));

    return {
      itens: itens.map((favorito) => ({
        favorito,
        ativo: porTicker.get(favorito.ticker) ?? null,
        cotacao: cotacaoPorTicker.get(favorito.ticker) ?? null,
      })),
      meta: metaPaginacao({ page, limit, total }),
    };
  }
}

module.exports = { ListarFavoritos };

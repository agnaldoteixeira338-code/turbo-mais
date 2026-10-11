const { paginar, metaPaginacao } = require('../../../shared/utils');

/**
 * Busca no catálogo + cotação de cada resultado.
 * O MarketDataGateway nunca lança: se uma API cair, o item volta com
 * `cotacao.indisponivel = true` e a listagem continua funcionando
 * (degradação graciosa — uma API ruim não derruba a tela inteira).
 */
class BuscarAtivos {
  constructor({ ativoRepository, marketData }) {
    this.ativoRepository = ativoRepository;
    this.marketData = marketData;
  }

  async execute({ termo, tipo, setor, page = 1, limit = 20 } = {}) {
    const { offset } = paginar({ page, limit });
    const { itens, total } = await this.ativoRepository.buscar({ termo, tipo, setor, limit, offset });
    const cotacoes = await this.marketData.obterCotacoes(itens);
    const porTicker = new Map(cotacoes.map((c) => [c.ticker, c]));

    return {
      itens: itens.map((ativo) => ({ ativo, cotacao: porTicker.get(ativo.ticker) ?? null })),
      meta: metaPaginacao({ page, limit, total }),
    };
  }
}

module.exports = { BuscarAtivos };

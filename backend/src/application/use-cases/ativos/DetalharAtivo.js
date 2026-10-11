const { Ticker } = require('../../../domain/value-objects/Ticker');
const { NotFoundError } = require('../../errors');

/**
 * Página educativa do ativo: catálogo + cotação + histórico + indicadores.
 *
 * As três fontes externas rodam em PARALELO e com allSettled: se o histórico
 * falhar, a página ainda mostra preço e conteúdo educativo. Cada bloco informa
 * seu próprio estado (desatualizado/indisponível) para o front sinalizar.
 */
class DetalharAtivo {
  constructor({ ativoRepository, marketData, logger }) {
    this.ativoRepository = ativoRepository;
    this.marketData = marketData;
    this.logger = logger;
  }

  async execute({ ticker, dias = 30 }) {
    const { valor } = Ticker.criar(ticker);
    const ativo = await this.ativoRepository.buscarPorTicker(valor);
    if (!ativo) throw new NotFoundError(`Ativo ${valor} não encontrado`);

    const [cotacao, historico, indicadores] = await Promise.allSettled([
      this.marketData.obterCotacao(ativo),
      this.marketData.obterHistorico(ativo, dias),
      this.marketData.obterIndicadores(ativo),
    ]);

    const valorOuNulo = (resultado, parte) => {
      if (resultado.status === 'fulfilled') return resultado.value;
      this.logger?.warn({ err: resultado.reason, ticker: valor, parte }, 'parte do detalhe do ativo indisponível');
      return null;
    };

    return {
      ativo,
      cotacao: valorOuNulo(cotacao, 'cotacao'),
      historico: valorOuNulo(historico, 'historico'),
      indicadores: valorOuNulo(indicadores, 'indicadores'),
    };
  }
}

module.exports = { DetalharAtivo };

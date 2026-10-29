const { Ticker } = require('../../../domain/value-objects/Ticker');
const { NotFoundError } = require('../../errors');

const DIAS_DO_COMPORTAMENTO = 365;

/**
 * Página educativa do ativo: catálogo + cotação + histórico + indicadores +
 * comportamento no último ano (ADR-015).
 *
 * As fontes externas rodam em PARALELO e com allSettled: se o histórico
 * falhar, a página ainda mostra preço e conteúdo educativo. Cada bloco informa
 * seu próprio estado (desatualizado/indisponível) para o front sinalizar.
 *
 * O comportamento usa SEMPRE 1 ano de histórico, independente do período do
 * gráfico: quando o gráfico já é de 1 ano, reaproveita a mesma série. O
 * histórico fica 6 h em cache, então isso não multiplica as chamadas às APIs.
 */
class DetalharAtivo {
  constructor({ ativoRepository, marketData, analisadorDeComportamento, logger }) {
    this.ativoRepository = ativoRepository;
    this.marketData = marketData;
    this.analisadorDeComportamento = analisadorDeComportamento;
    this.logger = logger;
  }

  async execute({ ticker, dias = 30 }) {
    const { valor } = Ticker.criar(ticker);
    const ativo = await this.ativoRepository.buscarPorTicker(valor);
    if (!ativo) throw new NotFoundError(`Ativo ${valor} não encontrado`);

    const historicoDoGrafico = this.marketData.obterHistorico(ativo, dias);
    const historicoDoAno = dias === DIAS_DO_COMPORTAMENTO ? historicoDoGrafico : this.#historicoDoAno(ativo);
    const [cotacao, historico, indicadores, ano] = await Promise.allSettled([
      this.marketData.obterCotacao(ativo),
      historicoDoGrafico,
      this.marketData.obterIndicadores(ativo),
      historicoDoAno,
    ]);

    const valorOuNulo = (resultado, parte) => {
      if (resultado.status === 'fulfilled') return resultado.value;
      this.logger?.warn({ err: resultado.reason, ticker: valor, parte }, 'parte do detalhe do ativo indisponível');
      return null;
    };

    const historicoAnual = valorOuNulo(ano, 'comportamento');
    return {
      ativo,
      cotacao: valorOuNulo(cotacao, 'cotacao'),
      historico: valorOuNulo(historico, 'historico'),
      indicadores: valorOuNulo(indicadores, 'indicadores'),
      // Renda fixa não tem histórico de preço; sem dados suficientes, o analisador devolve null
      comportamento: ativo.ehRendaFixa() || !historicoAnual ? null : this.analisadorDeComportamento.analisar(historicoAnual.pontos),
    };
  }

  #historicoDoAno(ativo) {
    return ativo.ehRendaFixa() ? Promise.resolve(null) : this.marketData.obterHistorico(ativo, DIAS_DO_COMPORTAMENTO);
  }
}

module.exports = { DetalharAtivo, DIAS_DO_COMPORTAMENTO };

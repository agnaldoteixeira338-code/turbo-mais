/**
 * Taxas de juros vigentes para o simulador (implementa a porta TaxasDeJurosGateway).
 *
 * Mesma cadeia de resiliência das cotações (ADR-007), com cache LONGO porque
 * Selic, CDI e TR mudam raramente (a meta Selic, só nas reuniões do Copom):
 *
 *   cache fresco (12 h) ──▶ stale (mais 12 h, revalida em 2º plano) ──▶ Banco Central
 *                                                                     │ breaker(retry(fetch + Zod))
 *                                                                     ▼ falhou?
 *                                          último valor conhecido (90 dias, "desatualizado")
 *                                                                     ▼ não há?
 *                                 valores padrão do env.js, marcados como "taxas de referência"
 *
 * Contrato: `obterTaxas` NUNCA lança. O simulador sempre calcula, e o front
 * mostra de onde vieram as taxas (degradar, sim; enganar, nunca).
 */
const CHAVE_CACHE = 'taxas:banco-central';

class TaxasDeJurosGateway {
  constructor({ bancoCentral, cache, logger, padrao, ttlSegundos = 12 * 3600, staleSegundos = 12 * 3600, lkgSegundos = 90 * 24 * 3600 }) {
    this.bancoCentral = bancoCentral;
    this.cache = cache;
    this.logger = logger;
    this.padrao = padrao;
    this.opcoesCache = { ttlSegundos, staleSegundos, lkgSegundos };
  }

  /**
   * @returns {Promise<{selicMeta: number, cdi: number, trMensal: number, dataReferencia: string|null,
   *   origem: 'banco-central'|'cache'|'padrao', referencia: boolean, desatualizado: boolean}>} taxas em %
   */
  async obterTaxas() {
    try {
      const { valor, origem } = await this.cache.obterComRevalidacao(CHAVE_CACHE, () => this.bancoCentral.buscarTaxas(), this.opcoesCache);
      const datas = [valor.selicMeta.data, valor.cdi.data, valor.trMensal.data].sort();
      return {
        selicMeta: valor.selicMeta.valor,
        cdi: valor.cdi.valor,
        trMensal: valor.trMensal.valor,
        dataReferencia: datas.at(-1),
        origem: origem === 'origem' ? 'banco-central' : 'cache',
        referencia: false,
        desatualizado: origem === 'ultimo-conhecido',
      };
    } catch (err) {
      this.logger?.warn({ erro: err.message }, 'Banco Central indisponível e sem último valor conhecido; usando taxas de referência');
      return { ...this.padrao, dataReferencia: null, origem: 'padrao', referencia: true, desatualizado: false };
    }
  }
}

module.exports = { TaxasDeJurosGateway, CHAVE_CACHE };

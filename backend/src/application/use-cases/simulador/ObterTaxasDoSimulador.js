/**
 * Taxas vigentes usadas pelo simulador (Selic meta, CDI e TR), com a data de
 * referência e a origem (banco-central, cache ou padrao). Nunca falha: sem
 * Banco Central nem cache, o gateway devolve as taxas de referência.
 */
class ObterTaxasDoSimulador {
  constructor({ taxasGateway }) {
    this.taxasGateway = taxasGateway;
  }

  execute() {
    return this.taxasGateway.obterTaxas();
  }
}

module.exports = { ObterTaxasDoSimulador };

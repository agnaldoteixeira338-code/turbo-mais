/**
 * "Quanto renderia?": busca as taxas vigentes e entrega ao serviço de domínio
 * SimuladorDeInvestimentos, que faz toda a conta. Não grava nada: o resultado
 * depende só dos parâmetros e das taxas do dia (ADR-014).
 *
 * As taxas chegam em % (13,75) e o domínio trabalha em fração (0,1375): a
 * conversão fica aqui, na fronteira, para o domínio não conhecer o formato
 * do Banco Central.
 */
class SimularInvestimento {
  constructor({ taxasGateway, simulador }) {
    this.taxasGateway = taxasGateway;
    this.simulador = simulador;
  }

  async execute({ valorInicial, aporteMensal = 0, prazoMeses }) {
    const taxas = await this.taxasGateway.obterTaxas();
    const resultado = this.simulador.simular({
      valorInicial,
      aporteMensal,
      prazoMeses,
      taxas: { selicMeta: taxas.selicMeta / 100, cdi: taxas.cdi / 100, trMensal: taxas.trMensal / 100 },
    });
    return { ...resultado, taxas };
  }
}

module.exports = { SimularInvestimento };

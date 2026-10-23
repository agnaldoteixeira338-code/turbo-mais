const { sucesso } = require('../resposta');

class SimuladorController {
  constructor({ useCases }) {
    this.uc = useCases;
  }

  taxas = async (_req, res) => sucesso(res, await this.uc.obterTaxasDoSimulador.execute());

  simular = async (req, res) => sucesso(res, await this.uc.simularInvestimento.execute(req.valido.body));
}

module.exports = { SimuladorController };

const { paginar, metaPaginacao } = require('../../../shared/utils');

class ListarAlertas {
  constructor({ alertaRepository }) {
    this.alertaRepository = alertaRepository;
  }

  async execute({ usuarioId, page, limit }) {
    const { offset } = paginar({ page, limit });
    const { itens, total } = await this.alertaRepository.listar(usuarioId, { limit, offset });
    return { itens, meta: metaPaginacao({ page, limit, total }) };
  }
}

module.exports = { ListarAlertas };

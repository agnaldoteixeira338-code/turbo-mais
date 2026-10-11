const { paginar, metaPaginacao } = require('../../../shared/utils');

class ListarIdeias {
  constructor({ ideiaRepository }) {
    this.ideiaRepository = ideiaRepository;
  }

  async execute({ usuarioId, page, limit }) {
    const { offset } = paginar({ page, limit });
    const { itens, total } = await this.ideiaRepository.listar(usuarioId, { limit, offset });
    return { itens, meta: metaPaginacao({ page, limit, total }) };
  }
}

module.exports = { ListarIdeias };

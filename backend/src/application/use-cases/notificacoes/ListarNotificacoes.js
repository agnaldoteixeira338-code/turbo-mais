const { paginar, metaPaginacao } = require('../../../shared/utils');

class ListarNotificacoes {
  constructor({ notificacaoRepository }) {
    this.notificacaoRepository = notificacaoRepository;
  }

  async execute({ usuarioId, apenasNaoLidas = false, page, limit }) {
    const { offset } = paginar({ page, limit });
    const { itens, total, naoLidas } = await this.notificacaoRepository.listar(usuarioId, { apenasNaoLidas, limit, offset });
    return { itens, meta: { ...metaPaginacao({ page, limit, total }), naoLidas } };
  }
}

module.exports = { ListarNotificacoes };

const { NotFoundError } = require('../../errors');

/** PATCH idempotente: marcar como lida algo já lido devolve o mesmo estado. */
class MarcarComoLida {
  constructor({ notificacaoRepository }) {
    this.notificacaoRepository = notificacaoRepository;
  }

  async execute({ id, usuarioId }) {
    const notificacao = await this.notificacaoRepository.marcarComoLida(id, usuarioId);
    if (!notificacao) throw new NotFoundError('Notificação não encontrada');
    return notificacao;
  }
}

module.exports = { MarcarComoLida };

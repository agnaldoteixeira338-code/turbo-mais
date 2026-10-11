const { NotFoundError } = require('../../errors');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

class RemoverAlerta {
  constructor({ alertaRepository, auditLog }) {
    this.alertaRepository = alertaRepository;
    this.auditLog = auditLog;
  }

  async execute({ id, usuarioId }, ctx = {}) {
    const removido = await this.alertaRepository.remover(id, usuarioId);
    if (!removido) throw new NotFoundError('Alerta não encontrado');
    await auditar(this.auditLog, ACOES_AUDITORIA.ALERTA_REMOVIDO, ctx, { usuarioId, metadados: { alertaId: id } });
  }
}

module.exports = { RemoverAlerta };

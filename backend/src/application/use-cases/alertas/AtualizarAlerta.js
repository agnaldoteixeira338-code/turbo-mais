const { Alerta } = require('../../../domain/entities/Alerta');
const { NotFoundError } = require('../../errors');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

class AtualizarAlerta {
  constructor({ alertaRepository, auditLog }) {
    this.alertaRepository = alertaRepository;
    this.auditLog = auditLog;
  }

  async execute({ id, usuarioId, campos }, ctx = {}) {
    // 404 (e não 403) para alerta de outro usuário: não confirmamos que o ID existe
    const atual = await this.alertaRepository.buscarPorId(id, usuarioId);
    if (!atual) throw new NotFoundError('Alerta não encontrado');

    const proximo = {
      gatilhoPercentual: campos.gatilhoPercentual ?? atual.gatilhoPercentual,
      direcao: campos.direcao ?? atual.direcao,
      ativo: campos.ativo ?? atual.ativo,
    };
    Alerta.validar(proximo);

    const atualizado = await this.alertaRepository.atualizar(id, usuarioId, proximo);
    await auditar(this.auditLog, ACOES_AUDITORIA.ALERTA_ATUALIZADO, ctx, { usuarioId, metadados: { alertaId: id, ...proximo } });
    return atualizado;
  }
}

module.exports = { AtualizarAlerta };

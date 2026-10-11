const { Alerta } = require('../../../domain/entities/Alerta');
const { Ticker } = require('../../../domain/value-objects/Ticker');
const { NotFoundError, UnprocessableError } = require('../../errors');
const { LIMITES, ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

class CriarAlerta {
  constructor({ alertaRepository, ativoRepository, auditLog, limitePorUsuario = LIMITES.ALERTAS_POR_USUARIO }) {
    this.alertaRepository = alertaRepository;
    this.ativoRepository = ativoRepository;
    this.auditLog = auditLog;
    this.limitePorUsuario = limitePorUsuario;
  }

  async execute({ usuarioId, ticker, gatilhoPercentual, direcao }, ctx = {}) {
    const { valor } = Ticker.criar(ticker);
    Alerta.validar({ gatilhoPercentual, direcao });

    const ativo = await this.ativoRepository.buscarPorTicker(valor);
    if (!ativo) throw new NotFoundError(`Ativo ${valor} não encontrado`);
    if (ativo.ehRendaFixa()) {
      throw new UnprocessableError('Alertas de variação não se aplicam a renda fixa', 'ALERTA_NAO_SUPORTADO');
    }

    // Limite por usuário: protege o priceWatcher (custo cresce com nº de alertas)
    const quantidade = await this.alertaRepository.contarPorUsuario(usuarioId);
    if (quantidade >= this.limitePorUsuario) {
      throw new UnprocessableError(`Limite de ${this.limitePorUsuario} alertas atingido`, 'LIMITE_ALERTAS');
    }

    const alerta = await this.alertaRepository.criar({
      usuarioId,
      ticker: valor,
      gatilhoPercentual: Number(gatilhoPercentual),
      direcao,
    });

    await auditar(this.auditLog, ACOES_AUDITORIA.ALERTA_CRIADO, ctx, {
      usuarioId,
      metadados: { alertaId: alerta.id, ticker: valor, gatilhoPercentual: alerta.gatilhoPercentual, direcao },
    });
    return alerta;
  }
}

module.exports = { CriarAlerta };

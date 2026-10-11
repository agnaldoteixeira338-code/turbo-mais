const crypto = require('node:crypto');

/**
 * Entidade Notificacao.
 *
 * Idempotência (ADR-008): o hash é derivado de (alerta, direção, janela de
 * tempo). Se o priceWatcher rodar duas vezes na mesma janela — retry do
 * BullMQ, duas réplicas, deploy no meio do job — o UNIQUE do banco garante
 * uma única notificação. O "exatamente uma vez" vem do banco, não da fila.
 */
class Notificacao {
  constructor({ id, usuarioId, alertaId, ticker, variacao, direcao, preco, lida = false, hashIdempotencia, criadoEm = new Date() }) {
    this.id = id;
    this.usuarioId = usuarioId;
    this.alertaId = alertaId;
    this.ticker = ticker;
    this.variacao = Number(variacao);
    this.direcao = direcao;
    this.preco = preco == null ? null : Number(preco);
    this.lida = Boolean(lida);
    this.hashIdempotencia = hashIdempotencia;
    this.criadoEm = criadoEm;
  }

  /**
   * @param {object} p
   * @param {string} p.alertaId
   * @param {'alta'|'baixa'} p.direcao
   * @param {Date} p.momento instante da avaliação
   * @param {number} p.janelaMinutos tamanho da janela de deduplicação
   */
  static gerarHashIdempotencia({ alertaId, direcao, momento, janelaMinutos }) {
    const janelaMs = janelaMinutos * 60 * 1000;
    const balde = Math.floor(momento.getTime() / janelaMs);
    return crypto.createHash('sha256').update(`${alertaId}:${direcao}:${balde}`).digest('hex');
  }
}

module.exports = { Notificacao };

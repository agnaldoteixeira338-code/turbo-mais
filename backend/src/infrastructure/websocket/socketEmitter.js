const { Emitter } = require('@socket.io/redis-emitter');

/**
 * Implementação da porta Notificador para processos SEM servidor Socket.IO
 * (o worker). Publica no Redis no formato do redis-adapter; as réplicas da
 * API entregam aos sockets conectados.
 */
class SocketIoNotificador {
  constructor(redisClient) {
    this.emitter = new Emitter(redisClient);
  }

  emitirCotacao(cotacao) {
    this.emitter.to(`ticker:${cotacao.ticker}`).emit('cotacao', {
      ticker: cotacao.ticker,
      preco: cotacao.preco,
      variacaoPercentual: cotacao.variacaoPercentual,
      moeda: cotacao.moeda,
      atualizadoEm: cotacao.atualizadoEm,
      fonte: cotacao.fonte,
    });
  }

  notificarUsuario(usuarioId, notificacao) {
    this.emitter.to(`usuario:${usuarioId}`).emit('notificacao', {
      id: notificacao.id,
      ticker: notificacao.ticker,
      variacao: notificacao.variacao,
      direcao: notificacao.direcao,
      preco: notificacao.preco,
      lida: notificacao.lida,
      criadoEm: notificacao.criadoEm,
    });
  }
}

/** Notificador nulo (testes / quando o tempo real está desligado). */
class NotificadorNulo {
  emitirCotacao() {}
  notificarUsuario() {}
}

module.exports = { SocketIoNotificador, NotificadorNulo };

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { Ticker } = require('../../domain/value-objects/Ticker');

const MAX_TICKERS_POR_SOCKET = 50;

/**
 * Servidor Socket.IO (ADR-005).
 *
 *  - Autenticação JWT no HANDSHAKE (`auth.token`): conexão sem token válido
 *    nem chega a existir. Não usamos cookie aqui → imune a CSWSH.
 *  - O socket é derrubado quando o access token expira; o cliente renova o
 *    token e reconecta. Sem isso, uma sessão revogada continuaria recebendo
 *    eventos indefinidamente.
 *  - Rooms: `usuario:<id>` (notificações privadas) e `ticker:<X>` (cotações).
 *  - Redis adapter: um evento emitido em qualquer réplica (ou pelo worker,
 *    via redis-emitter) chega aos sockets de TODAS as réplicas.
 *  - Heartbeat nativo (ping/pong): conexão morta é detectada em ≤ 45s.
 */
function criarSocketServer(httpServer, { tokenService, corsOrigins, pubClient, subClient, logger, metrics }) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: corsOrigins, credentials: true },
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1e4, // clientes só mandam listas de tickers
    serveClient: false,
  });

  if (pubClient && subClient) io.adapter(createAdapter(pubClient, subClient));

  io.use((socket, next) => {
    try {
      const payload = tokenService.verificarAccessToken(socket.handshake.auth?.token);
      socket.data.usuarioId = payload.sub;
      socket.data.expiraEm = payload.exp * 1000;
      next();
    } catch {
      next(new Error('NAO_AUTENTICADO'));
    }
  });

  io.on('connection', (socket) => {
    const { usuarioId, expiraEm } = socket.data;
    socket.join(`usuario:${usuarioId}`);
    metrics?.websocketConexoes?.inc();

    const msAteExpirar = Math.max(expiraEm - Date.now(), 0);
    const timerExpiracao = setTimeout(() => {
      socket.emit('sessao:expirada');
      socket.disconnect(true);
    }, msAteExpirar);

    socket.on('assinar', (tickers, ack) => {
      if (!Array.isArray(tickers)) return ack?.({ ok: false, erro: 'Formato inválido' });
      const validos = [...new Set(tickers.filter(Ticker.ehValido).map((t) => t.trim().toUpperCase()))].slice(0, MAX_TICKERS_POR_SOCKET);

      for (const sala of socket.rooms) {
        if (sala.startsWith('ticker:') && !validos.includes(sala.slice(7))) socket.leave(sala);
      }
      validos.forEach((t) => socket.join(`ticker:${t}`));
      ack?.({ ok: true, tickers: validos });
    });

    socket.on('disconnect', (motivo) => {
      clearTimeout(timerExpiracao);
      metrics?.websocketConexoes?.dec();
      logger.debug({ usuarioId, motivo }, 'socket desconectado');
    });
  });

  return io;
}

module.exports = { criarSocketServer, MAX_TICKERS_POR_SOCKET };

import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/env';

/**
 * Conexão em tempo real com DEGRADAÇÃO EM 3 NÍVEIS (ADR-005):
 *
 *   1. WebSocket                      (padrão — menor latência)
 *   2. HTTP long-polling do Socket.IO (após 3 falhas seguidas de WebSocket:
 *                                      proxies corporativos costumam bloquear WS)
 *   3. polling REST da API            (após mais 3 falhas: o app continua útil,
 *                                      buscando notificações a cada 30s)
 *
 * Reconexão automática com backoff exponencial + jitter (1s → 30s), para que
 * milhares de clientes não reconectem todos no mesmo instante após um deploy.
 * O heartbeat (ping/pong) é do próprio Socket.IO: conexão morta cai em ≤ 45s.
 */
export const MODOS = Object.freeze({
  CONECTANDO: 'conectando',
  WEBSOCKET: 'websocket',
  LONG_POLLING: 'long-polling',
  REST_POLLING: 'rest-polling',
});

export const FALHAS_PARA_LONG_POLLING = 3;
export const FALHAS_PARA_REST = 6;

export function criarConexaoTempoReal({ obterToken, renovarToken, aoMudarModo, fabrica = io }) {
  let falhas = 0;
  const socket = fabrica(SOCKET_URL || undefined, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    // função: um token NOVO é lido a cada tentativa de (re)conexão
    auth: (cb) => cb({ token: obterToken() }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
    timeout: 10_000,
  });

  socket.on('connect', () => {
    falhas = 0;
    aoMudarModo(socket.io.engine?.transport?.name === 'polling' ? MODOS.LONG_POLLING : MODOS.WEBSOCKET);
  });

  socket.on('connect_error', async (erro) => {
    falhas += 1;
    if (erro?.message === 'NAO_AUTENTICADO') {
      // Access token expirou entre reconexões: renova e tenta de novo
      try {
        await renovarToken();
      } catch {
        socket.disconnect();
        return;
      }
    }
    if (falhas === FALHAS_PARA_LONG_POLLING) {
      socket.io.opts.transports = ['polling'];
      aoMudarModo(MODOS.LONG_POLLING);
    }
    if (falhas >= FALHAS_PARA_REST) aoMudarModo(MODOS.REST_POLLING);
  });

  // O servidor derruba o socket quando o access token expira
  socket.on('sessao:expirada', async () => {
    try {
      await renovarToken();
      socket.connect();
    } catch {
      /* sessão realmente acabou: o AuthContext cuida do logout */
    }
  });

  socket.on('disconnect', (motivo) => {
    if (motivo === 'io server disconnect') return; // tratado em sessao:expirada
    aoMudarModo(MODOS.CONECTANDO);
  });

  return socket;
}

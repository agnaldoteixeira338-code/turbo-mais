import { criarConexaoTempoReal, MODOS, FALHAS_PARA_LONG_POLLING, FALHAS_PARA_REST } from '../src/services/socket';

/** Socket falso: guarda handlers e permite disparar eventos. */
function fabricaFalsa() {
  const handlers = {};
  const socket = {
    opcoes: null,
    io: { opts: { transports: ['websocket'] }, engine: { transport: { name: 'websocket' } } },
    on: (evento, fn) => { handlers[evento] = fn; },
    connect: jest.fn(),
    disconnect: jest.fn(),
    disparar: (evento, ...args) => handlers[evento]?.(...args),
  };
  const fabrica = jest.fn((_url, opcoes) => {
    socket.opcoes = opcoes;
    socket.io.opts = { ...opcoes };
    return socket;
  });
  return { socket, fabrica };
}

describe('conexão em tempo real com degradação', () => {
  it('lê um token NOVO a cada (re)conexão e reconecta com backoff + jitter', () => {
    const { socket, fabrica } = fabricaFalsa();
    let token = 't1';
    criarConexaoTempoReal({ obterToken: () => token, renovarToken: jest.fn(), aoMudarModo: jest.fn(), fabrica });
    const cb = jest.fn();
    socket.opcoes.auth(cb);
    token = 't2';
    socket.opcoes.auth(cb);
    expect(cb.mock.calls.map((c) => c[0].token)).toEqual(['t1', 't2']);
    expect(socket.opcoes).toMatchObject({ reconnection: true, reconnectionDelayMax: 30_000, randomizationFactor: 0.5, transports: ['websocket'] });
  });

  it(`WebSocket → long-polling após ${FALHAS_PARA_LONG_POLLING} falhas → REST após ${FALHAS_PARA_REST}`, async () => {
    const { socket, fabrica } = fabricaFalsa();
    const modos = [];
    criarConexaoTempoReal({ obterToken: () => 't', renovarToken: jest.fn(), aoMudarModo: (m) => modos.push(m), fabrica });

    for (let i = 0; i < FALHAS_PARA_LONG_POLLING; i += 1) await socket.disparar('connect_error', new Error('websocket error'));
    expect(socket.io.opts.transports).toEqual(['polling']);
    expect(modos.at(-1)).toBe(MODOS.LONG_POLLING);

    for (let i = FALHAS_PARA_LONG_POLLING; i < FALHAS_PARA_REST; i += 1) await socket.disparar('connect_error', new Error('xhr poll error'));
    expect(modos.at(-1)).toBe(MODOS.REST_POLLING);
  });

  it('conectar zera as falhas e informa o transporte em uso', () => {
    const { socket, fabrica } = fabricaFalsa();
    const aoMudarModo = jest.fn();
    criarConexaoTempoReal({ obterToken: () => 't', renovarToken: jest.fn(), aoMudarModo, fabrica });
    socket.disparar('connect');
    expect(aoMudarModo).toHaveBeenLastCalledWith(MODOS.WEBSOCKET);
    socket.io.engine.transport.name = 'polling';
    socket.disparar('connect');
    expect(aoMudarModo).toHaveBeenLastCalledWith(MODOS.LONG_POLLING);
  });

  it('token expirado: renova e reconecta; se não der, desiste', async () => {
    const { socket, fabrica } = fabricaFalsa();
    const renovarToken = jest.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('x'));
    criarConexaoTempoReal({ obterToken: () => 't', renovarToken, aoMudarModo: jest.fn(), fabrica });
    await socket.disparar('sessao:expirada');
    expect(socket.connect).toHaveBeenCalled();
    await socket.disparar('connect_error', new Error('NAO_AUTENTICADO'));
    expect(socket.disconnect).toHaveBeenCalled();
  });
});

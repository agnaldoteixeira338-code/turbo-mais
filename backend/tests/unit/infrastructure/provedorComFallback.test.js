const { criarProvedorComFallback } = require('../../../src/infrastructure/external-apis/provedorComFallback');

const provedor = (nome, comportamento) => ({
  nome,
  buscarCotacao: jest.fn(comportamento),
  buscarHistorico: jest.fn(comportamento),
  buscarIndicadores: jest.fn(comportamento),
});

describe('provedorComFallback (ADR-012)', () => {
  it('usa o primeiro provedor quando ele responde e não toca o reserva', async () => {
    const principal = provedor('brapi', async () => ({ preco: 86.8, fonte: 'brapi' }));
    const reserva = provedor('alpha-vantage', async () => ({ preco: 230, fonte: 'alpha-vantage' }));
    const p = criarProvedorComFallback([principal, reserva]);
    await expect(p.buscarCotacao({ ticker: 'AAPL' })).resolves.toEqual({ preco: 86.8, fonte: 'brapi' });
    expect(reserva.buscarCotacao).not.toHaveBeenCalled();
    expect(p.nome).toBe('brapi+alpha-vantage');
  });

  it('cai para o reserva quando o principal falha (em todos os métodos)', async () => {
    const logger = { warn: jest.fn() };
    const principal = provedor('brapi', async () => { throw new Error('brapi fora'); });
    const reserva = provedor('alpha-vantage', async () => ({ fonte: 'alpha-vantage' }));
    const p = criarProvedorComFallback([principal, reserva], { logger });
    for (const metodo of ['buscarCotacao', 'buscarHistorico', 'buscarIndicadores']) {
      await expect(p[metodo]({ ticker: 'AAPL' }, 30)).resolves.toEqual({ fonte: 'alpha-vantage' });
    }
    expect(reserva.buscarHistorico).toHaveBeenCalledWith({ ticker: 'AAPL' }, 30);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ provedor: 'brapi' }), expect.any(String));
  });

  it('propaga o erro do último quando todos falham; exige ao menos um provedor', async () => {
    const p = criarProvedorComFallback([
      provedor('a', async () => { throw new Error('a'); }),
      provedor('b', async () => { throw new Error('b'); }),
    ]);
    await expect(p.buscarCotacao({})).rejects.toThrow('b');
    expect(() => criarProvedorComFallback([])).toThrow(/ao menos um/);
  });
});

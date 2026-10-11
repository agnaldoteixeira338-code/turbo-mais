const RedisMock = require('ioredis-mock');
const { MarketDataGateway } = require('../../../src/infrastructure/external-apis/MarketDataGateway');
const { criarMockMarketData } = require('../../../src/infrastructure/external-apis/mockMarketData');
const { CacheService } = require('../../../src/infrastructure/cache/CacheService');
const { CATALOGO } = require('../../helpers/fakes');

const [PETR4, , , NVDA, , BTC, CDB] = CATALOGO();

function montar({ provedor, modo = 'live', fallbackSimulado = false } = {}) {
  const redis = new RedisMock();
  const cache = new CacheService({ redis });
  const p = provedor ?? {
    nome: 'fake',
    buscarCotacao: jest.fn(async (a) => ({ ticker: a.ticker, preco: 10, variacaoPercentual: 1, fonte: 'fake' })),
    buscarHistorico: jest.fn(async () => [{ data: '2026-10-01', preco: 10 }]),
    buscarIndicadores: jest.fn(async () => ({ pl: 5, dividendYield: 1, marketCap: 10 })),
  };
  const gateway = new MarketDataGateway({
    provedores: { acao_br: p, acao_global: p, cripto: p },
    simulado: criarMockMarketData({ clock: () => 1_700_000_000_000 }),
    cache,
    modo,
    fallbackSimulado,
    logger: { warn: jest.fn() },
  });
  return { gateway, provedor: p, redis };
}

describe('MarketDataGateway', () => {
  beforeEach(async () => new RedisMock().flushall());

  it('cotação normal passa pelo cache (2ª chamada não vai à origem)', async () => {
    const { gateway, provedor } = montar();
    await expect(gateway.obterCotacao(PETR4)).resolves.toMatchObject({ preco: 10, desatualizado: false, indisponivel: false });
    await gateway.obterCotacao(PETR4);
    expect(provedor.buscarCotacao).toHaveBeenCalledTimes(1);
  });

  it('NUNCA lança: origem fora e sem cache → cotação marcada indisponível', async () => {
    const provedor = { nome: 'quebrado', buscarCotacao: jest.fn().mockRejectedValue(new Error('api fora')) };
    const { gateway } = montar({ provedor });
    await expect(gateway.obterCotacao(NVDA)).resolves.toMatchObject({ ticker: 'NVDA', preco: null, indisponivel: true, desatualizado: true, fonte: 'quebrado' });
  });

  it('com fallback simulado (dev), devolve dado simulado marcado como desatualizado', async () => {
    const provedor = { nome: 'quebrado', buscarCotacao: jest.fn().mockRejectedValue(new Error('api fora')) };
    const { gateway } = montar({ provedor, fallbackSimulado: true });
    await expect(gateway.obterCotacao(NVDA)).resolves.toMatchObject({ simulado: true, desatualizado: true, fonte: 'simulado' });
  });

  it('CDB não consulta API: devolve rendimento de referência', async () => {
    const { gateway, provedor } = montar();
    await expect(gateway.obterCotacao(CDB)).resolves.toMatchObject({ preco: null, rendimento: '100% do CDI', fonte: 'referencia' });
    await expect(gateway.obterHistorico(CDB)).resolves.toMatchObject({ pontos: [] });
    await expect(gateway.obterIndicadores(CDB)).resolves.toBeNull();
    expect(provedor.buscarCotacao).not.toHaveBeenCalled();
  });

  it('obterCotacoes preserva a ordem e respeita a concorrência', async () => {
    const { gateway } = montar();
    gateway.concorrencia = 2;
    const r = await gateway.obterCotacoes([PETR4, NVDA, BTC, CDB]);
    expect(r.map((c) => c.ticker)).toEqual(['PETR4', 'NVDA', 'BTC', 'CDB-LIQ-100']);
    await expect(gateway.obterCotacoes([])).resolves.toEqual([]);
  });

  it('histórico e indicadores: cache + fallback + erro propagado quando não há plano B', async () => {
    const { gateway } = montar();
    await expect(gateway.obterHistorico(PETR4, 30)).resolves.toMatchObject({ pontos: [{ preco: 10 }], desatualizado: false, fonte: 'fake' });
    await expect(gateway.obterIndicadores(PETR4)).resolves.toMatchObject({ pl: 5, desatualizado: false });

    const quebrado = { nome: 'q', buscarHistorico: jest.fn().mockRejectedValue(new Error('x')), buscarIndicadores: jest.fn().mockRejectedValue(new Error('x')) };
    const semPlanoB = montar({ provedor: quebrado }).gateway;
    await expect(semPlanoB.obterHistorico(NVDA, 30)).rejects.toThrow('x');
    const comPlanoB = montar({ provedor: quebrado, fallbackSimulado: true }).gateway;
    await expect(comPlanoB.obterHistorico(NVDA, 10)).resolves.toMatchObject({ desatualizado: true, fonte: 'simulado' });
    await expect(comPlanoB.obterIndicadores(NVDA)).resolves.toMatchObject({ desatualizado: true });
  });

  it('modo mock usa o provedor simulado para tudo', async () => {
    const { gateway, provedor } = montar({ modo: 'mock' });
    await expect(gateway.obterCotacao(BTC)).resolves.toMatchObject({ simulado: true, desatualizado: false });
    expect(provedor.buscarCotacao).not.toHaveBeenCalled();
  });

  it('tipo sem provedor configurado → indisponível (não explode)', async () => {
    const { gateway } = montar();
    await expect(gateway.obterCotacao({ ticker: 'X', tipo: 'fundo' })).resolves.toMatchObject({ indisponivel: true });
  });
});

describe('mockMarketData (determinístico)', () => {
  it('mesmo minuto → mesmo preço; preços plausíveis em torno da referência', async () => {
    const mock = criarMockMarketData({ clock: () => 1_700_000_000_000 });
    const a = await mock.buscarCotacao(PETR4);
    const b = await mock.buscarCotacao(PETR4);
    expect(a).toEqual(b);
    expect(Math.abs(a.variacaoPercentual)).toBeLessThanOrEqual(3);
    expect(a.preco).toBeGreaterThan(0);
    expect(a.fonte).toBe('simulado');
  });

  it('gera N dias de histórico e indicadores apenas para ações', async () => {
    const mock = criarMockMarketData({ clock: () => 1_700_000_000_000 });
    const pontos = await mock.buscarHistorico(NVDA, 30);
    expect(pontos).toHaveLength(30);
    expect(pontos[0].data < pontos[29].data).toBe(true);
    expect((await mock.buscarIndicadores(NVDA)).pl).toEqual(expect.any(Number));
    expect((await mock.buscarIndicadores(BTC)).pl).toBeNull();
    const semReferencia = await mock.buscarCotacao({ ticker: 'ZZZ', tipo: 'acao_br' });
    expect(semReferencia.preco).toBeGreaterThan(0);
  });
});

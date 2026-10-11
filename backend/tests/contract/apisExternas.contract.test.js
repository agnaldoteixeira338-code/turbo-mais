/**
 * TESTES DE CONTRATO das APIs externas (consumer-driven).
 *
 * Modo padrão (CI em todo PR): valida FIXTURES gravadas contra os mesmos
 * schemas Zod que o código de produção usa — garante que nosso parser e nosso
 * contrato concordam, sem rede e sem gastar cota.
 *
 * Modo ao vivo (CONTRACT_LIVE=true, job agendado diário no CI): bate nas APIs
 * REAIS e valida a resposta contra o contrato. Se a brapi mudar um campo, o
 * job falha ANTES de algum usuário ver um card quebrado.
 */
const brapi = require('../../src/infrastructure/external-apis/brapi');
const coingecko = require('../../src/infrastructure/external-apis/coingecko');
const alpha = require('../../src/infrastructure/external-apis/alphaVantage');
const { encerrarCircuitos } = require('../../src/infrastructure/resilience/circuitBreakers');

const fixture = (nome) => require(`./fixtures/${nome}.json`);
const AO_VIVO = process.env.CONTRACT_LIVE === 'true';
const vivo = AO_VIVO ? it : it.skip;

const PETR4 = { ticker: 'PETR4', nome: 'Petrobras PN', tipo: 'acao_br' };
const BTC = { ticker: 'BTC', nome: 'Bitcoin', tipo: 'cripto', codigoExterno: 'bitcoin' };
const NVDA = { ticker: 'NVDA', nome: 'NVIDIA', tipo: 'acao_global' };

function respostaFetch(corpo) {
  return jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => corpo });
}

describe('Contrato: brapi', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; encerrarCircuitos(); });

  it('fixture satisfaz o schema', () => {
    expect(brapi.schemas.cotacao.safeParse(fixture('brapi-quote')).success).toBe(true);
  });

  it('o cliente traduz a resposta para o modelo interno', async () => {
    global.fetch = respostaFetch(fixture('brapi-quote'));
    const cliente = brapi.criarBrapiClient({});
    await expect(cliente.buscarCotacao(PETR4)).resolves.toMatchObject({ ticker: 'PETR4', preco: 37.95, variacaoPercentual: 0.211, moeda: 'BRL', fonte: 'brapi' });
    const historico = await cliente.buscarHistorico(PETR4, 30);
    expect(historico).toEqual([{ data: expect.any(String), preco: 37.4 }, { data: expect.any(String), preco: 37.87 }]);
    await expect(cliente.buscarIndicadores(PETR4)).resolves.toMatchObject({ pl: 4.31, marketCap: 494238000000 });
  });

  it('detecta quebra de contrato (campo renomeado)', async () => {
    const quebrada = { results: [{ symbol: 'PETR4', price: 37.95 }] };
    expect(brapi.schemas.cotacao.safeParse(quebrada).success).toBe(false);
    global.fetch = respostaFetch(quebrada);
    await expect(brapi.criarBrapiClient({}).buscarCotacao(PETR4)).rejects.toThrow(/contrato quebrado/);
  });

  vivo('API real responde conforme o contrato', async () => {
    const r = await brapi.criarBrapiClient({ token: process.env.BRAPI_TOKEN }).buscarCotacao(PETR4);
    expect(r.preco).toBeGreaterThan(0);
  }, 20_000);
});

describe('Contrato: CoinGecko', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; encerrarCircuitos(); });

  it('fixtures satisfazem os schemas', () => {
    expect(coingecko.schemas.mercados.safeParse(fixture('coingecko-markets')).success).toBe(true);
    expect(coingecko.schemas.grafico.safeParse(fixture('coingecko-chart')).success).toBe(true);
  });

  it('o cliente traduz cotação, histórico (1 ponto por dia) e indicadores', async () => {
    global.fetch = respostaFetch(fixture('coingecko-markets'));
    const cliente = coingecko.criarCoinGeckoClient({});
    await expect(cliente.buscarCotacao(BTC)).resolves.toMatchObject({ preco: 612345.12, variacaoPercentual: -1.8734, moeda: 'BRL' });
    await expect(cliente.buscarIndicadores(BTC)).resolves.toMatchObject({ marketCap: 12134567890123 });
    global.fetch = respostaFetch(fixture('coingecko-chart'));
    const pontos = await cliente.buscarHistorico(BTC, 30);
    expect(new Set(pontos.map((p) => p.data)).size).toBe(pontos.length);
  });

  it('ativo sem codigo_externo falha sem chamar a rede; lista vazia = 404', async () => {
    global.fetch = jest.fn();
    await expect(coingecko.criarCoinGeckoClient({}).buscarCotacao({ ticker: 'X', tipo: 'cripto' })).rejects.toMatchObject({ status: 404 });
    expect(global.fetch).not.toHaveBeenCalled();
    global.fetch = respostaFetch([]);
    await expect(coingecko.criarCoinGeckoClient({}).buscarCotacao(BTC)).rejects.toMatchObject({ status: 404 });
  });

  vivo('API real responde conforme o contrato', async () => {
    const r = await coingecko.criarCoinGeckoClient({ apiKey: process.env.COINGECKO_API_KEY }).buscarCotacao(BTC);
    expect(r.preco).toBeGreaterThan(0);
  }, 20_000);
});

describe('Contrato: Alpha Vantage', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; encerrarCircuitos(); });

  it('fixtures satisfazem os schemas', () => {
    expect(alpha.schemas.cotacao.safeParse(fixture('alphavantage-quote')).success).toBe(true);
    expect(alpha.schemas.serie.safeParse(fixture('alphavantage-daily')).success).toBe(true);
    expect(alpha.schemas.visaoGeral.safeParse(fixture('alphavantage-overview')).success).toBe(true);
  });

  it('o cliente traduz cotação ("1.5987%" → 1.5987), série ordenada e DY em %', async () => {
    const cliente = alpha.criarAlphaVantageClient({ apiKey: 'teste' });
    global.fetch = respostaFetch(fixture('alphavantage-quote'));
    await expect(cliente.buscarCotacao(NVDA)).resolves.toMatchObject({ preco: 181.76, variacaoPercentual: 1.5987, moeda: 'USD' });
    global.fetch = respostaFetch(fixture('alphavantage-daily'));
    const serie = await cliente.buscarHistorico(NVDA, 30);
    expect(serie.map((p) => p.data)).toEqual(['2026-10-03', '2026-10-06', '2026-10-07']);
    global.fetch = respostaFetch(fixture('alphavantage-overview'));
    await expect(cliente.buscarIndicadores(NVDA)).resolves.toMatchObject({ pl: 51.2, dividendYield: 0.02, marketCap: 4430000000000 });
  });

  it('cota estourada ("Note") vira 429 não retentável; sem chave nem chama a rede', async () => {
    global.fetch = respostaFetch({ Note: 'Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.' });
    await expect(alpha.criarAlphaVantageClient({ apiKey: 'teste' }).buscarCotacao(NVDA)).rejects.toMatchObject({ status: 429, retryable: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    global.fetch = jest.fn();
    await expect(alpha.criarAlphaVantageClient({}).buscarCotacao(NVDA)).rejects.toThrow(/não configurada/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  const vivoComChave = AO_VIVO && process.env.ALPHA_VANTAGE_API_KEY ? it : it.skip;
  vivoComChave('API real responde conforme o contrato', async () => {
    const r = await alpha.criarAlphaVantageClient({ apiKey: process.env.ALPHA_VANTAGE_API_KEY }).buscarCotacao(NVDA);
    expect(r.preco).toBeGreaterThan(0);
  }, 20_000);
});

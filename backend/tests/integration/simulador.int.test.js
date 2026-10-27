const request = require('supertest');
const { criarAppDeTeste } = require('../helpers/app');
const { CHAVE_CACHE } = require('../../src/infrastructure/external-apis/TaxasDeJurosGateway');

const fixture = (nome) => require(`../contract/fixtures/${nome}.json`);
const FIXTURES = { 432: 'bcb-sgs-selic-meta', 4389: 'bcb-sgs-cdi', 7811: 'bcb-sgs-tr' };

/**
 * Rota do simulador com o app REAL (Postgres + Redis): gateway, cache no Redis,
 * caso de uso e domínio. Só a resposta do Banco Central é simulada (fetch),
 * para o CI não depender da rede. O supertest usa http, não fetch.
 * O cenário "Banco Central fora" fica por último: as falhas contam para o
 * circuit breaker real e poderiam abri-lo para os testes seguintes.
 */
describe('Integração — simulador (Postgres + Redis reais)', () => {
  let t;
  let token;
  const fetchOriginal = global.fetch;

  beforeAll(async () => {
    t = await criarAppDeTeste();
    ({ token } = await t.novoUsuario());
  });
  afterAll(async () => {
    global.fetch = fetchOriginal;
    await t.fechar();
  });
  beforeEach(async () => {
    await t.container.redis.del(CHAVE_CACHE, `lkg:${CHAVE_CACHE}`);
  });

  const comToken = (req) => req.set('authorization', `Bearer ${token}`);
  const bancoCentralOk = () => {
    global.fetch = jest.fn(async (url) => ({ ok: true, status: 200, json: async () => fixture(FIXTURES[/sgs\.(\d+)/.exec(url)[1]]) }));
  };
  const bancoCentralFora = () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
  };

  it('exige autenticação', async () => {
    await request(t.app).get('/api/v1/simulador/taxas').expect(401);
    await request(t.app).post('/api/v1/simulador').send({ valorInicial: 1000, prazoMeses: 12 }).expect(401);
  });

  it('GET /taxas: taxas do Banco Central e, na 2ª vez, do cache no Redis', async () => {
    bancoCentralOk();
    const r1 = await comToken(request(t.app).get('/api/v1/simulador/taxas')).expect(200);
    expect(r1.body.data).toMatchObject({ selicMeta: 13.75, cdi: 13.65, trMensal: 0.1616, origem: 'banco-central', referencia: false });
    const r2 = await comToken(request(t.app).get('/api/v1/simulador/taxas')).expect(200);
    expect(r2.body.data.origem).toBe('cache');
    expect(global.fetch).toHaveBeenCalledTimes(3); // 3 séries, uma vez só
  });

  it('POST: compara as 5 modalidades, com série mês a mês, sem gravar nada no banco', async () => {
    bancoCentralOk();
    const contar = async () => (await t.container.pool.query('SELECT (SELECT COUNT(*) FROM ideias) + (SELECT COUNT(*) FROM favoritos) + (SELECT COUNT(*) FROM alertas) AS n')).rows[0].n;
    const antes = await contar();

    const r = await comToken(request(t.app).post('/api/v1/simulador').send({ valorInicial: 10000, aporteMensal: 500, prazoMeses: 24 })).expect(200);

    const { data } = r.body;
    expect(data.totalInvestido).toBe(22000);
    expect(data.modalidades.map((m) => m.id)).toEqual(['poupanca', 'cdb-100', 'cdb-110', 'tesouro-selic', 'lci-lca']);
    for (const m of data.modalidades) {
      expect(m.serie).toHaveLength(25);
      expect(m.valorLiquido).toBeGreaterThan(22000);
    }
    expect(data.modalidades.find((m) => m.id === data.melhor).valorLiquido).toBe(Math.max(...data.modalidades.map((m) => m.valorLiquido)));
    expect(data.taxas).toMatchObject({ origem: 'banco-central', selicMeta: 13.75 });
    expect(await contar()).toBe(antes);
  });

  it('POST: 400 para campo desconhecido, texto no lugar de número ou prazo fora do limite; 422 para tudo zerado', async () => {
    bancoCentralOk();
    const post = (body) => comToken(request(t.app).post('/api/v1/simulador').send(body));
    expect((await post({ valorInicial: 1000, prazoMeses: 12, admin: true })).status).toBe(400);
    expect((await post({ valorInicial: '1000', prazoMeses: 12 })).status).toBe(400);
    expect((await post({ valorInicial: 1000, prazoMeses: 361 })).status).toBe(400);
    expect((await post({ valorInicial: 1000, prazoMeses: 12.5 })).status).toBe(400);
    expect((await post({ valorInicial: 50_000_000, prazoMeses: 12 })).status).toBe(400);
    const zerado = await post({ valorInicial: 0, aporteMensal: 0, prazoMeses: 12 });
    expect(zerado.status).toBe(422);
    expect(zerado.body.error.message).toMatch(/valor inicial ou um aporte/);
  });

  it('Banco Central fora (503) e sem cache: responde com as taxas de referência do env, e a simulação continua', async () => {
    bancoCentralFora();
    const taxas = await comToken(request(t.app).get('/api/v1/simulador/taxas')).expect(200);
    expect(taxas.body.data).toMatchObject({ origem: 'padrao', referencia: true, dataReferencia: null, selicMeta: t.container.env.TAXA_SELIC_PADRAO });
    // a falha foi retentada (retry), não desistiu na primeira
    expect(global.fetch.mock.calls.length).toBeGreaterThan(3);

    const simulacao = await comToken(request(t.app).post('/api/v1/simulador').send({ valorInicial: 1000, prazoMeses: 12 })).expect(200);
    expect(simulacao.body.data.taxas.referencia).toBe(true);
  }, 30_000);
});

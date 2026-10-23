const RedisMock = require('ioredis-mock');
const { criarBancoCentralClient } = require('../../../src/infrastructure/external-apis/bancoCentral');
const { TaxasDeJurosGateway, CHAVE_CACHE } = require('../../../src/infrastructure/external-apis/TaxasDeJurosGateway');
const { CacheService } = require('../../../src/infrastructure/cache/CacheService');
const { encerrarCircuitos } = require('../../../src/infrastructure/resilience/circuitBreakers');

const fixture = (nome) => require(`../../contract/fixtures/${nome}.json`);
const HOJE = () => new Date('2026-10-23T15:00:00Z');
const PADRAO = { selicMeta: 13.75, cdi: 13.65, trMensal: 0.16 };

/** fetch falso que responde por série do SGS (432, 4389, 7811). */
function fetchDoBancoCentral(respostas) {
  return jest.fn(async (url) => {
    const codigo = /bcdata\.sgs\.(\d+)/.exec(url)[1];
    const r = respostas[codigo];
    if (r instanceof Error) throw r;
    return { ok: r.status === undefined, status: r.status ?? 200, json: async () => r.corpo ?? r };
  });
}
const SUCESSO = { 432: fixture('bcb-sgs-selic-meta'), 4389: fixture('bcb-sgs-cdi'), 7811: fixture('bcb-sgs-tr') };

describe('Cliente do Banco Central (SGS)', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; encerrarCircuitos(); });

  it('busca as 3 séries por intervalo de datas e devolve o último valor vigente de cada uma', async () => {
    global.fetch = fetchDoBancoCentral(SUCESSO);
    const taxas = await criarBancoCentralClient({ clock: HOJE }).buscarTaxas();
    expect(taxas).toEqual({
      selicMeta: { valor: 13.75, data: '2026-10-23' },
      cdi: { valor: 13.65, data: '2026-10-22' },
      trMensal: { valor: 0.1616, data: '2026-10-01' },
    });
    const urls = global.fetch.mock.calls.map(([url]) => url);
    expect(urls).toEqual(expect.arrayContaining([expect.stringContaining('bcdata.sgs.432/dados?formato=json&dataInicial=24/08/2026&dataFinal=23/10/2026')]));
    expect(urls).toHaveLength(3);
  });

  it('ignora datas futuras e não depende da ordem da resposta', async () => {
    const embaralhada = [
      { data: '04/11/2026', valor: '99.00' }, // futuro: meta até a próxima reunião do Copom
      { data: '23/10/2026', valor: '13.75' },
      { data: '01/09/2026', valor: '14.00' },
    ];
    global.fetch = fetchDoBancoCentral({ ...SUCESSO, 432: embaralhada });
    const { selicMeta } = await criarBancoCentralClient({ clock: HOJE }).buscarTaxas();
    expect(selicMeta).toEqual({ valor: 13.75, data: '2026-10-23' });
  });

  it('contrato quebrado (campo renomeado) falha de forma explícita e sem retry', async () => {
    global.fetch = fetchDoBancoCentral({ ...SUCESSO, 4389: [{ dia: '22/10/2026', taxa: 13.65 }] });
    await expect(criarBancoCentralClient({ clock: HOJE }).buscarTaxas()).rejects.toThrow(/contrato quebrado/);
    expect(global.fetch.mock.calls.filter(([u]) => u.includes('sgs.4389'))).toHaveLength(1);
  });

  it('resposta vazia (sem valor vigente) é erro do Banco Central', async () => {
    global.fetch = fetchDoBancoCentral({ ...SUCESSO, 7811: [{ data: '01/12/2026', valor: '0.2' }] });
    await expect(criarBancoCentralClient({ clock: HOJE }).buscarTaxas()).rejects.toThrow(/sem valor vigente/);
  });
});

describe('TaxasDeJurosGateway', () => {
  let redis;
  beforeEach(async () => {
    redis = new RedisMock();
    await redis.flushall();
  });

  function montar(bancoCentral) {
    const logger = { warn: jest.fn() };
    const gateway = new TaxasDeJurosGateway({ bancoCentral, cache: new CacheService({ redis, logger }), logger, padrao: PADRAO });
    return { gateway, logger };
  }
  const TAXAS_BCB = { selicMeta: { valor: 13.75, data: '2026-10-23' }, cdi: { valor: 13.65, data: '2026-10-22' }, trMensal: { valor: 0.1616, data: '2026-10-01' } };

  it('sucesso: taxas do Banco Central com a data mais recente; a 2ª chamada vem do cache', async () => {
    const bancoCentral = { buscarTaxas: jest.fn().mockResolvedValue(TAXAS_BCB) };
    const { gateway } = montar(bancoCentral);

    await expect(gateway.obterTaxas()).resolves.toEqual({
      selicMeta: 13.75, cdi: 13.65, trMensal: 0.1616, dataReferencia: '2026-10-23', origem: 'banco-central', referencia: false, desatualizado: false,
    });
    await expect(gateway.obterTaxas()).resolves.toMatchObject({ origem: 'cache', referencia: false, desatualizado: false });
    expect(bancoCentral.buscarTaxas).toHaveBeenCalledTimes(1);
  });

  it('Banco Central fora, mas com último valor conhecido: usa o cache marcado como desatualizado', async () => {
    const bancoCentral = { buscarTaxas: jest.fn().mockResolvedValueOnce(TAXAS_BCB).mockRejectedValue(new Error('banco-central: HTTP 503')) };
    const { gateway } = montar(bancoCentral);
    await gateway.obterTaxas();
    await redis.del(CHAVE_CACHE); // cache principal expirou; sobra só o "lkg:"

    await expect(gateway.obterTaxas()).resolves.toMatchObject({ selicMeta: 13.75, origem: 'cache', referencia: false, desatualizado: true });
  });

  it('Banco Central fora e nada em cache: taxas padrão do env, marcadas como de referência (nunca lança)', async () => {
    const { gateway, logger } = montar({ buscarTaxas: jest.fn().mockRejectedValue(new Error('banco-central: timeout')) });
    await expect(gateway.obterTaxas()).resolves.toEqual({ ...PADRAO, dataReferencia: null, origem: 'padrao', referencia: true, desatualizado: false });
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ erro: 'banco-central: timeout' }), expect.stringContaining('referência'));
  });

  it('Redis fora do ar: o cache vira pass-through e as taxas ainda vêm do Banco Central', async () => {
    const quebrado = { get: () => Promise.reject(new Error('redis')), multi: () => ({ set() { return this; }, exec: () => Promise.reject(new Error('redis')) }) };
    const gateway = new TaxasDeJurosGateway({ bancoCentral: { buscarTaxas: async () => TAXAS_BCB }, cache: new CacheService({ redis: quebrado }), padrao: PADRAO });
    await expect(gateway.obterTaxas()).resolves.toMatchObject({ origem: 'banco-central', selicMeta: 13.75 });
  });
});

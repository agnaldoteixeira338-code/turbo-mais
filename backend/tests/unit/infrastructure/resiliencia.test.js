const { comRetry } = require('../../../src/infrastructure/resilience/retryPolicy');
const {
  criarChamadaResiliente, criarCircuitBreaker, estadoDosCircuitos, encerrarCircuitos,
} = require('../../../src/infrastructure/resilience/circuitBreakers');
const { ExternalApiError, obterJson, validarContrato } = require('../../../src/infrastructure/external-apis/httpClient');
const { z } = require('zod');

const RAPIDO = { minTimeout: 1, maxTimeout: 2, randomize: false };

afterEach(() => encerrarCircuitos());

describe('retryPolicy', () => {
  it('repete erros transitórios e devolve o sucesso', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new ExternalApiError('503', { status: 503 })).mockResolvedValue('ok');
    const logger = { warn: jest.fn() };
    await expect(comRetry(fn, { nome: 'x', logger, ...RAPIDO })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ dependencia: 'x', tentativa: 1 }), expect.any(String));
  });

  it('NÃO repete erros determinísticos (4xx) — preserva o erro original', async () => {
    const erro = new ExternalApiError('404', { status: 404 });
    const fn = jest.fn().mockRejectedValue(erro);
    await expect(comRetry(fn, RAPIDO)).rejects.toBe(erro);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('desiste após esgotar as tentativas', async () => {
    const fn = jest.fn().mockRejectedValue(new ExternalApiError('timeout'));
    await expect(comRetry(fn, { ...RAPIDO, retries: 2 })).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('ExternalApiError — classificação', () => {
  it.each([[undefined, true], [500, true], [503, true], [429, true], [400, false], [404, false]])('status %p → retryable %p', (status, esperado) => {
    expect(new ExternalApiError('x', { status }).retryable).toBe(esperado);
  });
});

describe('circuit breaker', () => {
  it('abre após falhas acima do limiar e passa a rejeitar sem chamar a origem', async () => {
    const chamar = criarChamadaResiliente('teste-abre', {
      opcoesRetry: { retries: 0 },
      opcoesBreaker: { volumeThreshold: 2, errorThresholdPercentage: 50, resetTimeout: 60_000 },
    });
    const falha = jest.fn().mockRejectedValue(new ExternalApiError('500', { status: 500 }));
    await expect(chamar(falha)).rejects.toThrow();
    await expect(chamar(falha)).rejects.toThrow();
    expect(estadoDosCircuitos().find((c) => c.nome === 'teste-abre').estado).toBe('aberto');

    const origem = jest.fn().mockResolvedValue('ok');
    await expect(chamar(origem)).rejects.toThrow(/Breaker is open/);
    expect(origem).not.toHaveBeenCalled();
  });

  it('404 (errorFilter) não conta como falha da dependência', async () => {
    const chamar = criarChamadaResiliente('teste-404', { opcoesRetry: { retries: 0 }, opcoesBreaker: { volumeThreshold: 1 } });
    const naoEncontrado = () => Promise.reject(new ExternalApiError('404', { status: 404 }));
    for (let i = 0; i < 5; i += 1) await expect(chamar(naoEncontrado)).rejects.toThrow();
    expect(estadoDosCircuitos().find((c) => c.nome === 'teste-404').estado).toBe('fechado');
  });

  it('emite eventos de estado para o logger e reporta estatísticas', async () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
    const breaker = criarCircuitBreaker('teste-eventos', async () => 'ok', { logger });
    breaker.open();
    breaker.close();
    expect(logger.error).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
    await breaker.fire();
    expect(estadoDosCircuitos().find((c) => c.nome === 'teste-eventos').estatisticas.sucessos).toBe(1);
  });
});

describe('httpClient', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });

  it('converte HTTP não-2xx em ExternalApiError com status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(obterJson('http://x', { dependencia: 'dep' })).rejects.toMatchObject({ status: 503, retryable: true, dependencia: 'dep' });
  });

  it('converte falha de rede/timeout em erro retentável', async () => {
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    await expect(obterJson('http://x', { dependencia: 'dep', timeoutMs: 10 })).rejects.toMatchObject({ retryable: true, message: expect.stringMatching(/timeout/) });
  });

  it('JSON inválido não é retentável; JSON válido é devolvido', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('x')) });
    await expect(obterJson('http://x', { dependencia: 'dep' })).rejects.toMatchObject({ retryable: false });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ a: 1 }) });
    await expect(obterJson('http://x', { dependencia: 'dep' })).resolves.toEqual({ a: 1 });
  });

  it('validarContrato falha alto quando a API muda o formato', () => {
    const schema = z.object({ preco: z.number() });
    expect(validarContrato(schema, { preco: 1 }, 'dep')).toEqual({ preco: 1 });
    expect(() => validarContrato(schema, { preco: '1' }, 'dep')).toThrow(/contrato quebrado/);
  });
});

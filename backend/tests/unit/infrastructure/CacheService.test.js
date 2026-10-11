const RedisMock = require('ioredis-mock');
const { CacheService } = require('../../../src/infrastructure/cache/CacheService');

const OPCOES = { ttlSegundos: 60, staleSegundos: 600 };
const esperar = () => new Promise((r) => setImmediate(r));

describe('CacheService — stale-while-revalidate', () => {
  let redis;
  let agora;
  let cache;

  beforeEach(async () => {
    redis = new RedisMock();
    await redis.flushall();
    agora = 1_000_000;
    cache = new CacheService({ redis, clock: () => agora });
  });

  it('MISS → busca na origem e grava (com cópia "último valor conhecido")', async () => {
    const buscar = jest.fn().mockResolvedValue({ preco: 10 });
    await expect(cache.obterComRevalidacao('k', buscar, OPCOES)).resolves.toEqual({ valor: { preco: 10 }, stale: false, origem: 'origem' });
    expect(JSON.parse(await redis.get('lkg:k')).v).toEqual({ preco: 10 });
  });

  it('FRESCO → não toca a origem', async () => {
    const buscar = jest.fn().mockResolvedValue({ preco: 10 });
    await cache.obterComRevalidacao('k', buscar, OPCOES);
    agora += 30_000;
    await expect(cache.obterComRevalidacao('k', buscar, OPCOES)).resolves.toMatchObject({ stale: false, origem: 'cache' });
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('STALE → devolve na hora o valor antigo e revalida em segundo plano', async () => {
    const buscar = jest.fn().mockResolvedValueOnce({ preco: 10 }).mockResolvedValueOnce({ preco: 11 });
    await cache.obterComRevalidacao('k', buscar, OPCOES);
    agora += 61_000;
    await expect(cache.obterComRevalidacao('k', buscar, OPCOES)).resolves.toEqual({ valor: { preco: 10 }, stale: true, origem: 'stale' });
    await esperar();
    await esperar();
    await expect(cache.obterComRevalidacao('k', buscar, OPCOES)).resolves.toMatchObject({ valor: { preco: 11 }, stale: false });
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('STALE + revalidação falhando → continua servindo o stale, sem lançar', async () => {
    const logger = { warn: jest.fn() };
    cache = new CacheService({ redis, logger, clock: () => agora });
    const buscar = jest.fn().mockResolvedValueOnce({ preco: 10 }).mockRejectedValue(new Error('api fora'));
    await cache.obterComRevalidacao('k', buscar, OPCOES);
    agora += 61_000;
    await expect(cache.obterComRevalidacao('k', buscar, OPCOES)).resolves.toMatchObject({ valor: { preco: 10 }, stale: true });
    await esperar();
    await esperar();
    expect(logger.warn).toHaveBeenCalled();
    expect(await redis.get('lock:k')).toBeNull(); // lock liberado
  });

  it('EXPIRADO + origem fora → usa o último valor conhecido (lkg)', async () => {
    await redis.set('lkg:k', JSON.stringify({ v: { preco: 9 }, t: 0 }));
    const buscar = jest.fn().mockRejectedValue(new Error('api fora'));
    await expect(cache.obterComRevalidacao('k', buscar, OPCOES)).resolves.toEqual({ valor: { preco: 9 }, stale: true, origem: 'ultimo-conhecido' });
  });

  it('EXPIRADO + origem fora + sem lkg → propaga o erro', async () => {
    await expect(cache.obterComRevalidacao('k', () => Promise.reject(new Error('api fora')), OPCOES)).rejects.toThrow('api fora');
  });

  it('SINGLE-FLIGHT: 50 requisições simultâneas = 1 chamada à origem', async () => {
    let resolver;
    const buscar = jest.fn(() => new Promise((r) => { resolver = r; }));
    const promessas = Array.from({ length: 50 }, () => cache.obterComRevalidacao('k', buscar, OPCOES));
    await esperar();
    resolver({ preco: 10 });
    const resultados = await Promise.all(promessas);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(resultados.every((r) => r.valor.preco === 10)).toBe(true);
  });

  it('LOCK entre réplicas: se outra réplica já está revalidando, esta não revalida', async () => {
    const buscar = jest.fn().mockResolvedValue({ preco: 10 });
    await cache.obterComRevalidacao('k', buscar, OPCOES);
    await redis.set('lock:k', '1', 'EX', 30);
    agora += 61_000;
    await cache.obterComRevalidacao('k', buscar, OPCOES);
    await esperar();
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('Redis FORA → vira pass-through para a origem (não derruba a API)', async () => {
    const quebrado = { get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')), set: jest.fn().mockRejectedValue(new Error('x')), del: jest.fn().mockRejectedValue(new Error('x')), multi: () => ({ set() { return this; }, exec: () => Promise.reject(new Error('x')) }) };
    const logger = { warn: jest.fn() };
    const c = new CacheService({ redis: quebrado, logger });
    await expect(c.obterComRevalidacao('k', async () => 42, OPCOES)).resolves.toMatchObject({ valor: 42 });
    await expect(c.definirJson('k', 1, 10)).resolves.toBeUndefined();
    await expect(c.remover('k')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('get/set/remover JSON e métricas de resultado', async () => {
    const inc = jest.fn();
    const c = new CacheService({ redis, metrics: { cacheResultados: { inc } }, clock: () => agora });
    await c.definirJson('x', { a: 1 }, 10);
    expect(await c.obterJson('x')).toEqual({ a: 1 });
    await c.remover('x');
    expect(await c.obterJson('x')).toBeNull();
    await c.obterComRevalidacao('m', async () => 1, OPCOES);
    expect(inc).toHaveBeenCalledWith({ resultado: 'miss' });
  });
});

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const RedisMock = require('ioredis-mock');
const { z } = require('zod');
const { errorHandler, notFoundHandler } = require('../../../src/interfaces/http/middlewares/errorHandler');
const { validateInput } = require('../../../src/interfaces/http/middlewares/validateInput');
const { authMiddleware } = require('../../../src/interfaces/http/middlewares/authMiddleware');
const { csrfProtection, emitirCookieCsrf } = require('../../../src/interfaces/http/middlewares/csrfProtection');
const { auditLogger } = require('../../../src/interfaces/http/middlewares/auditLogger');
const { criarRateLimiters } = require('../../../src/interfaces/http/middlewares/rateLimiter');
const { requestLogger } = require('../../../src/interfaces/http/middlewares/requestLogger');
const { httpMetrics } = require('../../../src/interfaces/http/middlewares/httpMetrics');
const { cspMiddleware } = require('../../../src/interfaces/http/middlewares/cspMiddleware');
const { idempotency } = require('../../../src/shared/idempotency');
const { JwtTokenService } = require('../../../src/infrastructure/security/JwtTokenService');
const { criarLogger } = require('../../../src/infrastructure/logger/pinoLogger');
const errors = require('../../../src/application/errors');
const { DomainValidationError } = require('../../../src/domain/errors/DomainValidationError');

const logger = criarLogger({ level: 'silent' });

/** Monta um mini-app com os middlewares sob teste + errorHandler real. */
function app(configurar) {
  const a = express();
  a.use(express.json({ limit: '1kb' }));
  a.use(cookieParser());
  a.use((req, _res, next) => { req.id = 'req-teste'; next(); });
  configurar(a);
  a.use(notFoundHandler);
  a.use(errorHandler({ logger }));
  return a;
}

describe('errorHandler', () => {
  const lancar = (erro) => app((a) => a.get('/x', () => { throw erro; }));

  it.each([
    [new errors.ValidationError('x', [{ campo: 'a' }]), 400, 'DADOS_INVALIDOS'],
    [new errors.UnauthorizedError(), 401, 'NAO_AUTENTICADO'],
    [new errors.ForbiddenError(), 403, 'ACESSO_NEGADO'],
    [new errors.NotFoundError(), 404, 'NAO_ENCONTRADO'],
    [new errors.ConflictError(), 409, 'CONFLITO'],
    [new errors.UnprocessableError('x'), 422, 'REGRA_DE_NEGOCIO'],
    [new DomainValidationError('Senha fraca', 'senha'), 422, 'REGRA_DE_NEGOCIO'],
    [new errors.ServiceUnavailableError(), 503, 'SERVICO_INDISPONIVEL'],
  ])('%p → %i', async (erro, status, code) => {
    const r = await request(lancar(erro)).get('/x');
    expect(r.status).toBe(status);
    expect(r.body).toMatchObject({ success: false, data: null, meta: null, error: { code, requestId: 'req-teste' } });
  });

  it('429 inclui Retry-After', async () => {
    const r = await request(lancar(new errors.TooManyRequestsError('calma', 120))).get('/x');
    expect(r.status).toBe(429);
    expect(r.headers['retry-after']).toBe('120');
  });

  it('erro inesperado vira 500 GENÉRICO, sem stack trace nem mensagem interna', async () => {
    const r = await request(lancar(new Error('senha do banco: hunter2'))).get('/x');
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toMatch(/hunter2|stack|at /);
    expect(r.body.error.code).toBe('ERRO_INTERNO');
  });

  it('JSON malformado → 400 e corpo grande → 413', async () => {
    const a = app((x) => x.post('/x', (_req, res) => res.json({})));
    const malformado = await request(a).post('/x').set('content-type', 'application/json').send('{"a":');
    expect(malformado.status).toBe(400);
    expect(malformado.body.error.code).toBe('JSON_INVALIDO');
    const grande = await request(a).post('/x').send({ texto: 'x'.repeat(2000) });
    expect(grande.status).toBe(413);
  });

  it('rota inexistente → 404 padronizado', async () => {
    const r = await request(app(() => {})).get('/nada');
    expect(r.status).toBe(404);
    expect(r.body.error.message).toMatch(/GET \/nada/);
  });
});

describe('validateInput', () => {
  const a = app((x) =>
    x.post(
      '/x/:id',
      validateInput({ params: z.object({ id: z.string().uuid() }), query: z.object({ page: z.coerce.number().default(1) }), body: z.object({ nome: z.string() }).strict() }),
      (req, res) => res.json(req.valido),
    ),
  );

  it('entrega dados convertidos em req.valido', async () => {
    const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const r = await request(a).post(`/x/${id}?page=3`).send({ nome: 'ana' });
    expect(r.body).toEqual({ params: { id }, query: { page: 3 }, body: { nome: 'ana' } });
  });

  it('agrega erros de todas as partes e rejeita campos extras (mass assignment)', async () => {
    const r = await request(a).post('/x/nao-uuid').send({ nome: 1, admin: true });
    expect(r.status).toBe(400);
    expect(r.body.error.details.map((d) => d.local)).toEqual(expect.arrayContaining(['params', 'body']));
  });
});

describe('authMiddleware', () => {
  const tokens = new JwtTokenService({ accessSecret: 'a'.repeat(32), resetSecret: 'r'.repeat(32), doisFatoresSecret: 'd'.repeat(32), codigoHmacSecret: 'h'.repeat(32), issuer: 't', accessTtlSegundos: 60, resetTtlMinutos: 1 });
  const a = app((x) => x.get('/x', authMiddleware(tokens), (req, res) => res.json(req.usuario)));

  it('aceita Bearer válido', async () => {
    const r = await request(a).get('/x').set('authorization', `Bearer ${tokens.gerarAccessToken({ id: 'u1' }).token}`);
    expect(r.body).toEqual({ id: 'u1' });
  });

  it.each([undefined, 'Basic abc', 'Bearer', 'Bearer lixo'])('rejeita %p com 401', async (header) => {
    const req = request(a).get('/x');
    if (header) req.set('authorization', header);
    expect((await req).status).toBe(401);
  });
});

describe('csrfProtection (double-submit)', () => {
  const a = app((x) => {
    // 1 min de validade: com 1 s, o cookie expirava entre o GET e o POST em CI lento (teste instável)
    x.get('/token', (_req, res) => res.json({ token: emitirCookieCsrf(res, { seguro: false, maxAgeMs: 60_000 }) }));
    x.post('/protegida', csrfProtection({ seguro: false }), (_req, res) => res.json({ ok: true }));
  });

  it('aceita quando header == cookie; rejeita ausente ou divergente', async () => {
    const agente = request.agent(a);
    const { body } = await agente.get('/token');
    expect((await agente.post('/protegida').set('x-csrf-token', body.token)).status).toBe(200);
    expect((await agente.post('/protegida')).status).toBe(403);
    expect((await agente.post('/protegida').set('x-csrf-token', 'outro')).status).toBe(403);
  });

  it('cookie em modo seguro usa prefixo __Host-', async () => {
    const b = app((x) => x.get('/t', (_req, res) => { emitirCookieCsrf(res, { seguro: true, maxAgeMs: 1000 }); res.end(); }));
    const r = await request(b).get('/t');
    expect(r.headers['set-cookie'][0]).toMatch(/^__Host-csrf=.*Secure.*SameSite=Strict/);
  });
});

describe('idempotency (Idempotency-Key)', () => {
  let redis;
  let contador;
  beforeEach(async () => {
    redis = new RedisMock();
    await redis.flushall();
    contador = 0;
  });

  const montar = (status = 201) =>
    app((x) =>
      x.post('/x', idempotency({ redis, logger }), (req, res) => {
        contador += 1;
        res.status(status).json({ n: contador, corpo: req.body });
      }),
    );

  it('repete a MESMA resposta para a mesma chave, sem reexecutar', async () => {
    const a = montar();
    const r1 = await request(a).post('/x').set('Idempotency-Key', 'chave-12345').send({ a: 1 });
    const r2 = await request(a).post('/x').set('Idempotency-Key', 'chave-12345').send({ a: 1 });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r2.body).toEqual(r1.body);
    expect(r2.headers['idempotent-replayed']).toBe('true');
    expect(contador).toBe(1);
  });

  it('mesma chave com corpo diferente → 422; chave inválida → 422; sem chave → executa normal', async () => {
    const a = montar();
    await request(a).post('/x').set('Idempotency-Key', 'chave-12345').send({ a: 1 });
    expect((await request(a).post('/x').set('Idempotency-Key', 'chave-12345').send({ a: 2 })).status).toBe(422);
    expect((await request(a).post('/x').set('Idempotency-Key', 'curta').send({})).status).toBe(422);
    await request(a).post('/x').send({});
    await request(a).post('/x').send({});
    expect(contador).toBe(3);
  });

  it('requisição concorrente ainda em processamento → 409', async () => {
    await redis.set('idem:anon:POST:/x:chave-12345', JSON.stringify({ estado: 'processando', impressaoDigital: require('../../../src/shared/utils').sha256('{}') }));
    expect((await request(montar()).post('/x').set('Idempotency-Key', 'chave-12345').send({})).status).toBe(409);
  });

  it('respostas 5xx liberam a chave para novo retry', async () => {
    const a = montar(500);
    await request(a).post('/x').set('Idempotency-Key', 'chave-12345').send({});
    await new Promise((r) => setImmediate(r));
    expect(await redis.get('idem:anon:POST:/x:chave-12345')).toBeNull();
  });

  it('Redis fora → segue sem proteção (não derruba a rota)', async () => {
    redis = { set: () => Promise.reject(new Error('x')) };
    expect((await request(montar()).post('/x').set('Idempotency-Key', 'chave-12345').send({})).status).toBe(201);
  });
});

describe('auditLogger', () => {
  it('audita só respostas 2xx, após o envio', async () => {
    const auditLog = { registrar: jest.fn() };
    const a = app((x) => {
      x.post('/ok', auditLogger(auditLog, 'ACAO_OK', () => ({ extra: 1 })), (_req, res) => res.status(201).json({}));
      x.post('/falha', auditLogger(auditLog, 'ACAO_FALHA'), () => { throw new errors.NotFoundError(); });
    });
    await request(a).post('/ok');
    await request(a).post('/falha');
    expect(auditLog.registrar).toHaveBeenCalledTimes(1);
    expect(auditLog.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'ACAO_OK', requestId: 'req-teste', metadados: { extra: 1, status: 201 } }));
  });
});

describe('rateLimiter', () => {
  it('bloqueia acima do limite com 429 padronizado e headers RateLimit', async () => {
    const rl = criarRateLimiters({});
    const a = app((x) => x.post('/login', rl.auth, (_req, res) => res.json({ ok: true })));
    let ultima;
    for (let i = 0; i < 11; i += 1) ultima = await request(a).post('/login');
    expect(ultima.status).toBe(429);
    expect(ultima.body.error.code).toBe('LIMITE_EXCEDIDO');
    expect(ultima.headers.ratelimit).toBeDefined();
  });

  it('pode ser desabilitado (testes/carga)', async () => {
    const rl = criarRateLimiters({ desabilitado: true });
    const a = app((x) => x.post('/login', rl.auth, (_req, res) => res.json({ ok: true })));
    for (let i = 0; i < 12; i += 1) expect((await request(a).post('/login')).status).toBe(200);
  });
});

describe('requestLogger + httpMetrics + cspMiddleware', () => {
  it('propaga X-Request-Id válido, gera um novo se inválido, aplica CSP e mede a rota', async () => {
    const observe = jest.fn();
    const inc = jest.fn();
    const a = express();
    a.use(requestLogger(logger));
    a.use(httpMetrics({ httpDuracao: { observe }, httpTotal: { inc } }));
    a.use(cspMiddleware({ producao: true }));
    a.get('/x/:id', (req, res) => res.json({ id: req.id }));

    const valido = await request(a).get('/x/1').set('x-request-id', 'abc-12345678');
    expect(valido.headers['x-request-id']).toBe('abc-12345678');
    expect(valido.headers['content-security-policy']).toContain("default-src 'none'");
    expect(valido.headers['strict-transport-security']).toBeDefined();
    expect(valido.headers['x-powered-by']).toBeUndefined();

    const injetado = await request(a).get('/x/1').set('x-request-id', '<script>id-gigante-e-invalido</script>');
    expect(injetado.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(observe).toHaveBeenCalledWith(expect.objectContaining({ rota: '/x/:id', status: '200' }), expect.any(Number));
  });
});

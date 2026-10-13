const { sanitizarTexto } = require('../../../src/shared/sanitizar');
const utils = require('../../../src/shared/utils');
const { executarComContexto, obterContexto, definirNoContexto } = require('../../../src/shared/requestContext');
const { carregarEnv } = require('../../../src/config/env');
const { criarDocumentoOpenApi } = require('../../../src/config/swagger');
const { auditar } = require('../../../src/application/use-cases/auditar');
const { naoImplementado } = require('../../../src/domain/repositories/contrato');
const { UsuarioRepository } = require('../../../src/domain/repositories/UsuarioRepository');

describe('sanitizarTexto (XSS)', () => {
  it.each([
    ['<script>alert(1)</script>oi', 'oi'],
    ['<img src=x onerror=alert(1)>texto', 'texto'],
    ['<b>negrito</b>', 'negrito'],
    ['<a href="javascript:alert(1)">clique</a>', 'clique'],
    ['texto normal com acentuação', 'texto normal com acentuação'],
    ['  com\u0000controle\u0007  ', 'comcontrole'],
  ])('%p → %p', (entrada, esperado) => {
    expect(sanitizarTexto(entrada)).toBe(esperado);
  });

  it('não-string vira vazio', () => {
    expect(sanitizarTexto(undefined)).toBe('');
    expect(sanitizarTexto({})).toBe('');
  });
});

describe('utils', () => {
  it('paginação e meta', () => {
    expect(utils.paginar({ page: 3, limit: 10 })).toEqual({ page: 3, limit: 10, offset: 20 });
    expect(utils.paginar()).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(utils.metaPaginacao({ page: 1, limit: 20, total: 0 })).toEqual({ page: 1, limit: 20, total: 0, totalPages: 1 });
    expect(utils.metaPaginacao({ page: 1, limit: 20, total: 41 }).totalPages).toBe(3);
  });

  it('compararSeguro, hashes e máscara de e-mail', () => {
    expect(utils.compararSeguro('abc', 'abc')).toBe(true);
    expect(utils.compararSeguro('abc', 'abd')).toBe(false);
    expect(utils.compararSeguro('abc', 'abcd')).toBe(false);
    expect(utils.compararSeguro(undefined, null)).toBe(true);
    expect(utils.sha256('x')).toHaveLength(64);
    expect(utils.hmacSha256('k', 'x')).not.toBe(utils.sha256('x'));
    expect(utils.mascararEmail('ana@gmail.com')).toBe('an***@gmail.com');
    expect(utils.mascararEmail(null)).toBe('[REDACTED]');
  });

  it('comTimeout resolve a tempo ou rejeita', async () => {
    await expect(utils.comTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
    await expect(utils.comTimeout(new Promise(() => {}), 10, 'estourou')).rejects.toThrow('estourou');
  });
});

describe('requestContext (AsyncLocalStorage)', () => {
  it('propaga o contexto por awaits e permite enriquecer', async () => {
    await executarComContexto({ requestId: 'r1' }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      definirNoContexto('usuarioId', 'u1');
      expect(obterContexto()).toEqual({ requestId: 'r1', usuarioId: 'u1' });
    });
    expect(obterContexto()).toEqual({});
    expect(() => definirNoContexto('x', 1)).not.toThrow();
  });
});

describe('config/env (fail fast)', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_RESET_SECRET: 'b'.repeat(32), JWT_2FA_SECRET: 'c'.repeat(32), CODE_HMAC_SECRET: 'd'.repeat(32),
  };
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));

  it('aplica defaults e converte tipos', () => {
    const env = carregarEnv({ ...base, CORS_ORIGINS: 'http://a.com, http://b.com', COOKIE_SECURE: 'true' });
    expect(env).toMatchObject({ PORT: 3333, BCRYPT_SALT_ROUNDS: 12, ACCESS_TOKEN_TTL_SECONDS: 900, COOKIE_SECURE: true, CORS_ORIGINS: ['http://a.com', 'http://b.com'] });
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('remove aspas coladas por engano nas URLs de conexão (caso real no deploy)', () => {
    const env = carregarEnv({ ...base, DATABASE_URL: ' "postgresql://u:p@h/db" ', REDIS_URL: '"rediss://default:s@h:6379"' });
    expect(env.DATABASE_URL).toBe('postgresql://u:p@h/db');
    expect(env.REDIS_URL).toBe('rediss://default:s@h:6379');
    expect(carregarEnv(base).REDIS_URL).toBe('redis://localhost:6379');
  });

  it('rejeita URL de conexão com protocolo errado, com mensagem clara', () => {
    expect(() => carregarEnv({ ...base, REDIS_URL: 'http://h:6379' })).toThrow('Configuração de ambiente inválida');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('REDIS_URL deve começar com redis:// ou rediss://'));
  });

  it('falha com segredo curto ou URL ausente', () => {
    expect(() => carregarEnv({ ...base, JWT_ACCESS_SECRET: 'curto' })).toThrow('Configuração de ambiente inválida');
    expect(() => carregarEnv({ ...base, DATABASE_URL: undefined })).toThrow();
  });

  it('em produção exige cookie seguro e proíbe fallback simulado', () => {
    expect(() => carregarEnv({ ...base, NODE_ENV: 'production' })).toThrow(/COOKIE_SECURE/);
    expect(() => carregarEnv({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'true', MARKET_DATA_FALLBACK_SIMULADO: 'true' })).toThrow(/SIMULADO/);
  });
});

describe('OpenAPI', () => {
  it('documenta todas as rotas da v1 e o rate limit de cada operação autenticada', () => {
    const doc = criarDocumentoOpenApi();
    const rotas = Object.keys(doc.paths);
    for (const r of ['/api/v1/auth/login', '/api/v1/favoritos', '/api/v1/alertas/{id}', '/api/v1/ideias', '/api/v1/ativos/{ticker}', '/health', '/metrics']) {
      expect(rotas).toContain(r);
    }
    const operacoesApi = Object.entries(doc.paths).filter(([p]) => p.startsWith('/api/v1')).flatMap(([, ops]) => Object.values(ops));
    expect(operacoesApi.every((op) => op['x-rate-limit'])).toBe(true);
  });
});

describe('contratos de repositório', () => {
  it('métodos não implementados falham alto', async () => {
    expect(() => naoImplementado('X', 'y')).toThrow('X.y() não implementado');
    await expect(new UsuarioRepository().buscarPorId('1')).rejects.toThrow(/não implementado/);
  });

  it('auditar repassa o contexto da requisição', async () => {
    const auditLog = { registrar: jest.fn() };
    await auditar(auditLog, 'ACAO', { ip: '1.1.1.1', userAgent: 'ua', requestId: 'r' });
    expect(auditLog.registrar).toHaveBeenCalledWith({ usuarioId: null, acao: 'ACAO', ip: '1.1.1.1', userAgent: 'ua', requestId: 'r', metadados: {} });
  });
});

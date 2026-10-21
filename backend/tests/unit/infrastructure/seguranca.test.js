const jwt = require('jsonwebtoken');
const RedisMock = require('ioredis-mock');
const { JwtTokenService } = require('../../../src/infrastructure/security/JwtTokenService');
const { BcryptPasswordHasher } = require('../../../src/infrastructure/security/BcryptPasswordHasher');
const { RedisLoginAttemptTracker } = require('../../../src/infrastructure/security/RedisLoginAttemptTracker');
const { AuditLogService } = require('../../../src/infrastructure/security/AuditLogService');
const { renderizar } = require('../../../src/infrastructure/email/EmailService');

const servico = () =>
  new JwtTokenService({
    accessSecret: 'a'.repeat(32), resetSecret: 'r'.repeat(32), doisFatoresSecret: 'd'.repeat(32), codigoHmacSecret: 'h'.repeat(32),
    issuer: 'teste', accessTtlSegundos: 900, resetTtlMinutos: 15,
  });

describe('JwtTokenService', () => {
  it('access token contém só o sub (sem PII) e expira em 15 min', () => {
    const s = servico();
    const { token, expiresIn } = s.gerarAccessToken({ id: 'u1', email: 'ana@x.com' });
    const payload = jwt.decode(token);
    expect(payload).toMatchObject({ sub: 'u1', typ: 'access', iss: 'teste' });
    expect(payload.email).toBeUndefined();
    expect(payload.exp - payload.iat).toBe(900);
    expect(expiresIn).toBe(900);
  });

  it('rejeita "alg: none" e tokens assinados com outro segredo', () => {
    const s = servico();
    const none = jwt.sign({ typ: 'access', sub: 'u1' }, '', { algorithm: 'none' });
    expect(() => s.verificarAccessToken(none)).toThrow('Token inválido');
    const outro = jwt.sign({ typ: 'access' }, 'x'.repeat(32), { subject: 'u1', issuer: 'teste', audience: 'turbo-mais:access' });
    expect(() => s.verificarAccessToken(outro)).toThrow('Token inválido');
    expect(() => s.verificarAccessToken(undefined)).toThrow('Token inválido');
  });

  it('não confunde finalidades: desafio 2FA não vale como access, nem reset como 2FA', () => {
    const s = servico();
    expect(() => s.verificarAccessToken(s.gerarDesafio2FA('u1'))).toThrow();
    expect(() => s.verificarDesafio2FA(s.gerarTokenRecuperacao('u1').token)).toThrow();
    expect(s.verificarTokenRecuperacao(s.gerarTokenRecuperacao('u1').token)).toMatchObject({ sub: 'u1', jti: expect.any(String) });
  });

  it('rejeita claim typ adulterado mesmo com segredo correto', () => {
    const forjado = jwt.sign({ typ: 'reset' }, 'a'.repeat(32), { subject: 'u1', issuer: 'teste', audience: 'turbo-mais:access' });
    expect(() => servico().verificarAccessToken(forjado)).toThrow();
  });

  it('refresh opaco tem alta entropia; hashToken/hashCodigo são determinísticos', () => {
    const s = servico();
    const tokens = new Set(Array.from({ length: 100 }, () => s.gerarTokenOpaco()));
    expect(tokens.size).toBe(100);
    expect(s.hashToken('x')).toBe(s.hashToken('x'));
    expect(s.hashCodigo('123456')).toMatch(/^[a-f0-9]{64}$/);
    expect(s.hashCodigo('123456')).not.toBe(s.hashToken('123456')); // HMAC ≠ sha256
  });
});

describe('BcryptPasswordHasher', () => {
  it('gera hash $2 com o custo configurado e compara', async () => {
    const h = new BcryptPasswordHasher({ saltRounds: 4 });
    const hash = await h.hash('Senha@Forte123');
    expect(hash).toMatch(/^\$2[aby]\$04\$/);
    await expect(h.compare('Senha@Forte123', hash)).resolves.toBe(true);
    await expect(h.compare('outra', hash)).resolves.toBe(false);
  });
});

describe('RedisLoginAttemptTracker', () => {
  it('bloqueia ao atingir o limite e libera ao limpar', async () => {
    const redis = new RedisMock();
    await redis.flushall();
    const t = new RedisLoginAttemptTracker({ redis, maxTentativas: 3, janelaSegundos: 900 });
    await t.registrarFalha('ana@x.com');
    await t.registrarFalha('ana@x.com');
    expect((await t.verificarBloqueio('ana@x.com')).bloqueado).toBe(false);
    const terceira = await t.registrarFalha('ana@x.com');
    expect(terceira).toMatchObject({ tentativas: 3, bloqueado: true });
    expect(terceira.retryAfterSeconds).toBeGreaterThan(0);
    expect((await t.verificarBloqueio('ana@x.com')).bloqueado).toBe(true);
    // a chave no Redis é o hash do e-mail, não o e-mail
    expect((await redis.keys('*')).some((k) => k.includes('ana@x.com'))).toBe(false);
    await t.limpar('ana@x.com');
    expect((await t.verificarBloqueio('ana@x.com')).bloqueado).toBe(false);
  });

  it('fail-open se o Redis cair (login legítimo não é impedido)', async () => {
    const quebrado = { get: () => Promise.reject(new Error('x')), ttl: () => Promise.reject(new Error('x')), incr: () => Promise.reject(new Error('x')), del: () => Promise.reject(new Error('x')) };
    const logger = { warn: jest.fn() };
    const t = new RedisLoginAttemptTracker({ redis: quebrado, logger });
    await expect(t.verificarBloqueio('a')).resolves.toEqual({ bloqueado: false, retryAfterSeconds: 0 });
    await expect(t.registrarFalha('a')).resolves.toMatchObject({ bloqueado: false });
    await expect(t.limpar('a')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(3);
  });
});

describe('AuditLogService', () => {
  it('nunca propaga erro do repositório (loga e segue)', async () => {
    const logger = { error: jest.fn() };
    const s = new AuditLogService({ auditLogRepository: { registrar: jest.fn().mockRejectedValue(new Error('db fora')) }, logger });
    await expect(s.registrar({ acao: 'X' })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ auditoria: true, acao: 'X' }), expect.any(String));
  });
});

describe('Logger — senhas em URLs dentro de erros', () => {
  const { mascararCredenciais, criarLogger } = require('../../../src/infrastructure/logger/pinoLogger');

  it('mascara a senha e preserva usuário e host', () => {
    expect(mascararCredenciais('connect ENOENT //default:SENHA123@host.upstash.io:6379')).toBe('connect ENOENT //default:***@host.upstash.io:6379');
    expect(mascararCredenciais('postgresql://neondb_owner:npg_x@ep.neon.tech/db')).toBe('postgresql://neondb_owner:***@ep.neon.tech/db');
    expect(mascararCredenciais('sem credenciais aqui')).toBe('sem credenciais aqui');
  });

  it('aplica a máscara em message, stack e campos extras do erro logado', () => {
    const linhas = [];
    const logger = criarLogger({ level: 'error' });
    const destino = require('pino')({ serializers: logger[Symbol.for('pino.serializers')] }, { write: (l) => linhas.push(l) });
    const err = Object.assign(new Error('connect ENOENT //default:SEGREDO@h:6379'), { address: '//default:SEGREDO@h:6379' });
    destino.error({ err }, 'falhou');
    expect(linhas.join('')).not.toContain('SEGREDO');
    expect(linhas.join('')).toContain('//default:***@h:6379');
  });
});

describe('EmailService — provedor Brevo e fallback', () => {
  const { EmailService, separarRemetente } = require('../../../src/infrastructure/email/EmailService');
  const { encerrarCircuitos } = require('../../../src/infrastructure/resilience/circuitBreakers');
  const original = global.fetch;
  afterEach(() => { global.fetch = original; encerrarCircuitos(); });

  it('separa nome e e-mail do remetente', () => {
    expect(separarRemetente('Turbo Mais <a@b.com>')).toEqual({ name: 'Turbo Mais', email: 'a@b.com' });
    expect(separarRemetente('"Turbo Mais" <a@b.com>')).toEqual({ name: 'Turbo Mais', email: 'a@b.com' });
    expect(separarRemetente('a@b.com')).toEqual({ email: 'a@b.com' });
  });

  it('envia pela API da Brevo com o payload esperado (sem expor a chave no corpo)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    const s = new EmailService({ from: 'Turbo Mais <a@b.com>', brevoApiKey: 'xkeysib-teste', ambiente: 'production' });
    expect(s.provedores.map((p) => p.nome)).toEqual(['brevo']);
    await expect(s.enviar({ tipo: '2fa', para: 'ana@x.com', dados: { codigo: '123456', validadeMinutos: 10 } })).resolves.toEqual({ provedor: 'brevo' });
    const [url, opcoes] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(opcoes.headers['api-key']).toBe('xkeysib-teste');
    const corpo = JSON.parse(opcoes.body);
    expect(corpo).toMatchObject({ sender: { name: 'Turbo Mais', email: 'a@b.com' }, to: [{ email: 'ana@x.com' }] });
    expect(corpo.htmlContent).toContain('123456');
    expect(opcoes.body).not.toContain('xkeysib-teste');
  });

  it('erro 4xx da Brevo (ex.: remetente não verificado) não é retentado e cai para o próximo provedor', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => '{"message":"sender not valid"}' });
    const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
    const s = new EmailService({ from: 'a@b.com', brevoApiKey: 'k', smtp: { host: 'localhost', port: 1 }, logger, ambiente: 'production' });
    s.provedores[1].enviar = jest.fn().mockResolvedValue({}); // SMTP simulado
    await expect(s.enviar({ tipo: '2fa', para: 'x@y.com', dados: { codigo: '1', validadeMinutos: 1 } })).resolves.toEqual({ provedor: 'smtp' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ provedor: 'brevo', erro: expect.stringContaining('HTTP 400') }), expect.any(String));
  });

  it('sem nenhum provedor em produção, falha alto (vai para retry/DLQ)', async () => {
    const s = new EmailService({ from: 'a@b.com', ambiente: 'production' });
    await expect(s.enviar({ tipo: '2fa', para: 'x@y.com', dados: {} })).rejects.toThrow('Nenhum provedor');
  });
});

describe('Templates de e-mail', () => {
  it('escapam HTML nos dados (sem injeção no e-mail)', () => {
    const { html, texto, assunto } = renderizar('2fa', { codigo: '<b>123</b>', validadeMinutos: 10 });
    expect(html).toContain('&lt;b&gt;123&lt;/b&gt;');
    expect(html).not.toContain('<b>123</b>');
    expect(texto).toContain('10 minutos');
    expect(assunto).toMatch(/código/);
  });

  it('reset de senha contém o link e template desconhecido falha alto', () => {
    expect(renderizar('reset-senha', { link: 'https://x/#token=abc', validadeMinutos: 15 }).html).toContain('https://x/#token=abc');
    expect(() => renderizar('desconhecido', {})).toThrow(/desconhecido/);
  });
});

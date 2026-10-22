const { CadastrarUsuario } = require('../../../src/application/use-cases/auth/CadastrarUsuario');
const { Login } = require('../../../src/application/use-cases/auth/Login');
const { EmitirSessao } = require('../../../src/application/use-cases/auth/EmitirSessao');
const { RefreshToken } = require('../../../src/application/use-cases/auth/RefreshToken');
const { Logout } = require('../../../src/application/use-cases/auth/Logout');
const { EsqueciSenha } = require('../../../src/application/use-cases/auth/EsqueciSenha');
const { ResetarSenha } = require('../../../src/application/use-cases/auth/ResetarSenha');
const { EnviarCodigo2FA } = require('../../../src/application/use-cases/auth/EnviarCodigo2FA');
const { VerificarCodigo2FA } = require('../../../src/application/use-cases/auth/VerificarCodigo2FA');
const { Ativar2FA } = require('../../../src/application/use-cases/auth/Ativar2FA');
const { Validar2FA } = require('../../../src/application/use-cases/auth/Validar2FA');
const { EntrarComoVisitante } = require('../../../src/application/use-cases/auth/EntrarComoVisitante');
const { JwtTokenService } = require('../../../src/infrastructure/security/JwtTokenService');
const { DomainValidationError } = require('../../../src/domain/errors/DomainValidationError');
const {
  FakeUsuarioRepository, FakeRefreshTokenRepository, FakeTokenRecuperacaoRepository, FakeToken2faRepository,
  fakeHasher, fakeLoginTracker, fakeAuditLog, fakeEmailQueue, fakeUnitOfWork,
} = require('../../helpers/fakes');

const SENHA = 'Senha@Forte123';
const ctx = { ip: '10.0.0.1', userAgent: 'jest', requestId: 'req-1' };

function montar() {
  const usuarios = new FakeUsuarioRepository();
  const refreshTokens = new FakeRefreshTokenRepository();
  const tokensRecuperacao = new FakeTokenRecuperacaoRepository();
  const tokens2fa = new FakeToken2faRepository();
  const auditLog = fakeAuditLog();
  const emailQueue = fakeEmailQueue();
  const tracker = fakeLoginTracker({ max: 5 });
  const tokenService = new JwtTokenService({
    accessSecret: 'a'.repeat(32), resetSecret: 'r'.repeat(32), doisFatoresSecret: 'd'.repeat(32), codigoHmacSecret: 'h'.repeat(32),
    issuer: 'teste', accessTtlSegundos: 900, resetTtlMinutos: 15,
  });
  const unitOfWork = fakeUnitOfWork({ usuarios, refreshTokens, tokensRecuperacao, tokens2fa });
  const emitirSessao = new EmitirSessao({ refreshTokenRepository: refreshTokens, tokenService, refreshTokenTtlDias: 7 });
  const enviarCodigo2FA = new EnviarCodigo2FA({ token2faRepository: tokens2fa, tokenService, emailQueue, validadeMinutos: 10 });
  const verificarCodigo2FA = new VerificarCodigo2FA({ token2faRepository: tokens2fa, tokenService, maxTentativas: 5 });

  return {
    usuarios, refreshTokens, tokensRecuperacao, tokens2fa, auditLog, emailQueue, tracker, tokenService,
    cadastrar: new CadastrarUsuario({ usuarioRepository: usuarios, passwordHasher: fakeHasher, auditLog }),
    login: new Login({ usuarioRepository: usuarios, passwordHasher: fakeHasher, loginAttemptTracker: tracker, emitirSessao, enviarCodigo2FA, tokenService, auditLog }),
    refresh: new RefreshToken({ unitOfWork, tokenService, emitirSessao, auditLog }),
    logout: new Logout({ refreshTokenRepository: refreshTokens, tokenService, auditLog }),
    esqueci: new EsqueciSenha({ usuarioRepository: usuarios, tokenRecuperacaoRepository: tokensRecuperacao, tokenService, emailQueue, auditLog, frontendUrl: 'http://front', validadeMinutos: 15 }),
    resetar: new ResetarSenha({ unitOfWork, tokenService, passwordHasher: fakeHasher, auditLog }),
    ativar2FA: new Ativar2FA({ usuarioRepository: usuarios, enviarCodigo2FA, verificarCodigo2FA, auditLog }),
    validar2FA: new Validar2FA({ usuarioRepository: usuarios, tokenService, verificarCodigo2FA, emitirSessao, auditLog }),
    visitante: (emailDemo = 'Demo@Exemplo.com') => new EntrarComoVisitante({ usuarioRepository: usuarios, emitirSessao, auditLog, emailDemo }),
  };
}

const acoes = (auditLog) => auditLog.entradas.map((e) => e.acao);

describe('CadastrarUsuario', () => {
  it('cria o usuário com e-mail/celular normalizados e senha com hash', async () => {
    const s = montar();
    const u = await s.cadastrar.execute({ email: 'Ana@Exemplo.com', celular: '(11) 98765-4321', senha: SENHA }, ctx);
    expect(u).toMatchObject({ email: 'ana@exemplo.com', celular: '+5511987654321', senhaHash: `hash:${SENHA}` });
    expect(acoes(s.auditLog)).toEqual(['USUARIO_CADASTRADO']);
    expect(s.auditLog.entradas[0]).toMatchObject({ ip: '10.0.0.1', requestId: 'req-1' });
  });

  it('rejeita e-mail duplicado com 409', async () => {
    const s = montar();
    await s.cadastrar.execute({ email: 'ana@exemplo.com', celular: '11987654321', senha: SENHA });
    await expect(s.cadastrar.execute({ email: 'ANA@exemplo.com', celular: '11987654321', senha: SENHA })).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_JA_CADASTRADO',
    });
  });

  it('rejeita senha fraca ANTES de qualquer acesso ao banco', async () => {
    const s = montar();
    const spy = jest.spyOn(s.usuarios, 'buscarPorEmail');
    await expect(s.cadastrar.execute({ email: 'ana@exemplo.com', celular: '11987654321', senha: 'fraca' })).rejects.toBeInstanceOf(DomainValidationError);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('EntrarComoVisitante', () => {
  it('abre sessão na conta demo sem senha e audita como LOGIN_VISITANTE', async () => {
    const s = montar();
    const demo = await s.cadastrar.execute({ email: 'demo@exemplo.com', celular: '11987654321', senha: SENHA });
    const r = await s.visitante().execute(ctx);
    expect(r.usuario.id).toBe(demo.id);
    expect(s.tokenService.verificarAccessToken(r.accessToken).sub).toBe(demo.id);
    expect(s.refreshTokens.itens[0].tokenHash).toBe(s.tokenService.hashToken(r.refreshToken));
    expect(acoes(s.auditLog)).toContain('LOGIN_VISITANTE');
  });

  it('funciona mesmo com a conta demo bloqueada por senhas erradas e ignora o 2FA', async () => {
    const s = montar();
    const demo = await s.cadastrar.execute({ email: 'demo@exemplo.com', celular: '11987654321', senha: SENHA });
    demo.twoFactorAtivo = true;
    for (let i = 0; i < 5; i += 1) await s.login.execute({ email: 'demo@exemplo.com', senha: 'Errada@123' }).catch(() => {});
    await expect(s.login.execute({ email: 'demo@exemplo.com', senha: SENHA })).rejects.toMatchObject({ code: 'CONTA_BLOQUEADA' });
    await expect(s.visitante().execute(ctx)).resolves.toMatchObject({ accessToken: expect.any(String) });
    expect(s.emailQueue.jobs).toHaveLength(0);
  });

  it('responde 404 se a conta demo não existir ou o recurso estiver desligado', async () => {
    const s = montar();
    await expect(s.visitante().execute(ctx)).rejects.toMatchObject({ statusCode: 404 });
    await expect(s.visitante(null).execute(ctx)).rejects.toMatchObject({ statusCode: 404 });
    expect(s.refreshTokens.itens).toHaveLength(0);
  });
});

describe('Login', () => {
  async function comUsuario(over = {}) {
    const s = montar();
    const u = await s.cadastrar.execute({ email: 'ana@exemplo.com', celular: '11987654321', senha: SENHA });
    Object.assign(u, over);
    return { s, u };
  }

  it('emite access token + refresh token opaco e audita sucesso', async () => {
    const { s, u } = await comUsuario();
    const r = await s.login.execute({ email: 'ANA@exemplo.com', senha: SENHA }, ctx);
    expect(r.requer2FA).toBe(false);
    expect(s.tokenService.verificarAccessToken(r.accessToken).sub).toBe(u.id);
    expect(r.refreshToken).toMatch(/^[A-Za-z0-9_-]{64}$/);
    // só o HASH do refresh token é persistido
    expect(s.refreshTokens.itens[0].tokenHash).toBe(s.tokenService.hashToken(r.refreshToken));
    expect(s.refreshTokens.itens[0].tokenHash).not.toBe(r.refreshToken);
    expect(acoes(s.auditLog)).toContain('LOGIN_SUCESSO');
  });

  it('usa mensagem genérica para senha errada E para e-mail inexistente', async () => {
    const { s } = await comUsuario();
    const errado = s.login.execute({ email: 'ana@exemplo.com', senha: 'Errada@123' });
    const inexistente = s.login.execute({ email: 'ninguem@exemplo.com', senha: SENHA });
    const invalido = s.login.execute({ email: 'nao-e-email', senha: SENHA });
    for (const p of [errado, inexistente, invalido]) {
      await expect(p).rejects.toMatchObject({ statusCode: 401, message: 'E-mail ou senha incorretos' });
    }
  });

  it('compara contra hash "isca" quando o usuário não existe (anti timing attack)', async () => {
    const { s } = await comUsuario();
    fakeHasher.compare.mockClear();
    await expect(s.login.execute({ email: 'ninguem@exemplo.com', senha: SENHA })).rejects.toThrow();
    expect(fakeHasher.compare).toHaveBeenCalledTimes(1);
  });

  it('bloqueia na 5ª falha e continua bloqueado mesmo com a senha certa', async () => {
    const { s } = await comUsuario();
    for (let i = 0; i < 4; i += 1) {
      await expect(s.login.execute({ email: 'ana@exemplo.com', senha: 'Errada@123' })).rejects.toMatchObject({ statusCode: 401 });
    }
    await expect(s.login.execute({ email: 'ana@exemplo.com', senha: 'Errada@123' })).rejects.toMatchObject({ statusCode: 429, code: 'CONTA_BLOQUEADA' });
    await expect(s.login.execute({ email: 'ana@exemplo.com', senha: SENHA })).rejects.toMatchObject({ statusCode: 429, retryAfterSeconds: 900 });
    expect(acoes(s.auditLog)).toContain('LOGIN_BLOQUEADO');
  });

  it('zera o contador de falhas após login bem-sucedido', async () => {
    const { s } = await comUsuario();
    await expect(s.login.execute({ email: 'ana@exemplo.com', senha: 'Errada@123' })).rejects.toThrow();
    await s.login.execute({ email: 'ana@exemplo.com', senha: SENHA });
    expect(s.tracker.limpar).toHaveBeenCalledWith('ana@exemplo.com');
  });

  it('com 2FA ativo, NÃO emite sessão: envia código e devolve desafio', async () => {
    const { s, u } = await comUsuario({ twoFactorAtivo: true });
    const r = await s.login.execute({ email: 'ana@exemplo.com', senha: SENHA }, ctx);
    expect(r).toEqual({ requer2FA: true, desafioToken: expect.any(String) });
    expect(s.refreshTokens.itens).toHaveLength(0);
    expect(s.emailQueue.jobs[0]).toMatchObject({ tipo: '2fa', para: u.email });
    expect(s.emailQueue.jobs[0].dados.codigo).toMatch(/^\d{6}$/);
    expect(s.tokenService.verificarDesafio2FA(r.desafioToken).sub).toBe(u.id);
  });
});

describe('RefreshToken (rotação + detecção de reuso)', () => {
  async function logado() {
    const s = montar();
    await s.cadastrar.execute({ email: 'ana@exemplo.com', celular: '11987654321', senha: SENHA });
    const sessao = await s.login.execute({ email: 'ana@exemplo.com', senha: SENHA });
    return { s, sessao };
  }

  it('rotaciona: revoga o antigo, cria um novo na MESMA família', async () => {
    const { s, sessao } = await logado();
    const nova = await s.refresh.execute({ refreshToken: sessao.refreshToken }, ctx);
    expect(nova.refreshToken).not.toBe(sessao.refreshToken);
    const [antigo, atual] = s.refreshTokens.itens;
    expect(antigo).toMatchObject({ revogado: true, substituidoPor: atual.id });
    expect(atual.familiaId).toBe(antigo.familiaId);
    expect(atual.revogado).toBe(false);
  });

  it('REUSO de token rotacionado revoga a família inteira e audita', async () => {
    const { s, sessao } = await logado();
    const nova = await s.refresh.execute({ refreshToken: sessao.refreshToken });
    await expect(s.refresh.execute({ refreshToken: sessao.refreshToken }, ctx)).rejects.toMatchObject({ statusCode: 401, code: 'SESSAO_REVOGADA' });
    // o token "legítimo" mais novo também morreu
    await expect(s.refresh.execute({ refreshToken: nova.refreshToken })).rejects.toMatchObject({ code: 'SESSAO_REVOGADA' });
    expect(s.refreshTokens.itens.every((t) => t.revogado)).toBe(true);
    expect(acoes(s.auditLog)).toContain('REFRESH_TOKEN_REUTILIZADO');
  });

  it('rejeita token ausente, desconhecido ou expirado', async () => {
    const { s, sessao } = await logado();
    await expect(s.refresh.execute({})).rejects.toMatchObject({ code: 'SESSAO_EXPIRADA' });
    await expect(s.refresh.execute({ refreshToken: 'inexistente' })).rejects.toMatchObject({ code: 'SESSAO_EXPIRADA' });
    s.refreshTokens.itens[0].expiraEm = new Date(Date.now() - 1000);
    await expect(s.refresh.execute({ refreshToken: sessao.refreshToken })).rejects.toMatchObject({ code: 'SESSAO_EXPIRADA' });
  });

  it('rejeita se o usuário não existe mais', async () => {
    const { s, sessao } = await logado();
    s.usuarios.itens = [];
    await expect(s.refresh.execute({ refreshToken: sessao.refreshToken })).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('Logout', () => {
  it('revoga o refresh token e é idempotente sem token', async () => {
    const s = montar();
    await s.cadastrar.execute({ email: 'ana@exemplo.com', celular: '11987654321', senha: SENHA });
    const sessao = await s.login.execute({ email: 'ana@exemplo.com', senha: SENHA });
    await s.logout.execute({ refreshToken: sessao.refreshToken });
    expect(s.refreshTokens.itens[0].revogado).toBe(true);
    await expect(s.logout.execute({})).resolves.toBeUndefined();
    expect(acoes(s.auditLog).filter((a) => a === 'LOGOUT')).toHaveLength(2);
  });
});

describe('EsqueciSenha + ResetarSenha', () => {
  async function pedido() {
    const s = montar();
    const u = await s.cadastrar.execute({ email: 'ana@exemplo.com', celular: '11987654321', senha: SENHA });
    await s.esqueci.execute({ email: 'ana@exemplo.com' }, ctx);
    const link = s.emailQueue.jobs[0].dados.link;
    const token = decodeURIComponent(link.split('#token=')[1]);
    return { s, u, token, link };
  }

  it('enfileira e-mail com link em FRAGMENTO (#token) e guarda só o hash', async () => {
    const { s, link, token } = await pedido();
    expect(link.startsWith('http://front/resetar-senha#token=')).toBe(true);
    expect(s.tokensRecuperacao.itens[0].tokenHash).toBe(s.tokenService.hashToken(token));
    expect(s.emailQueue.jobs[0].chaveIdempotencia).toMatch(/^reset-/);
  });

  it('responde igual (sem erro, sem e-mail) para e-mail inexistente ou inválido', async () => {
    const s = montar();
    await expect(s.esqueci.execute({ email: 'ninguem@exemplo.com' })).resolves.toBeUndefined();
    await expect(s.esqueci.execute({ email: 'invalido' })).resolves.toBeUndefined();
    expect(s.emailQueue.jobs).toHaveLength(0);
  });

  it('novo pedido invalida o link anterior', async () => {
    const { s, token } = await pedido();
    await s.esqueci.execute({ email: 'ana@exemplo.com' });
    await expect(s.resetar.execute({ token, novaSenha: 'Nova@Senha456' })).rejects.toMatchObject({ code: 'TOKEN_INVALIDO' });
  });

  it('troca a senha, revoga todas as sessões e o token não pode ser reutilizado', async () => {
    const { s, u, token } = await pedido();
    await s.login.execute({ email: 'ana@exemplo.com', senha: SENHA });
    await s.resetar.execute({ token, novaSenha: 'Nova@Senha456' }, ctx);
    expect(u.senhaHash).toBe('hash:Nova@Senha456');
    expect(s.refreshTokens.itens.every((t) => t.revogado)).toBe(true);
    await expect(s.resetar.execute({ token, novaSenha: 'Outra@Senha789' })).rejects.toMatchObject({ statusCode: 401 });
    expect(acoes(s.auditLog)).toContain('SENHA_REDEFINIDA');
  });

  it('rejeita token adulterado e nova senha fraca', async () => {
    const { s, token } = await pedido();
    await expect(s.resetar.execute({ token: `${token}x`, novaSenha: 'Nova@Senha456' })).rejects.toMatchObject({ statusCode: 401 });
    await expect(s.resetar.execute({ token, novaSenha: 'fraca' })).rejects.toBeInstanceOf(DomainValidationError);
  });

  it('não aceita access token no lugar do token de reset', async () => {
    const { s, u } = await pedido();
    const { token: access } = s.tokenService.gerarAccessToken(u);
    await expect(s.resetar.execute({ token: access, novaSenha: 'Nova@Senha456' })).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('2FA por e-mail', () => {
  async function comUsuario() {
    const s = montar();
    const u = await s.cadastrar.execute({ email: 'ana@exemplo.com', celular: '11987654321', senha: SENHA });
    return { s, u };
  }
  const ultimoCodigo = (s) => s.emailQueue.jobs.at(-1).dados.codigo;

  it('ativação em duas etapas: envia código → confirma → ativa', async () => {
    const { s, u } = await comUsuario();
    await expect(s.ativar2FA.execute({ usuarioId: u.id })).resolves.toEqual({ status: 'codigo_enviado' });
    expect(s.tokens2fa.itens[0].codigoHash).not.toBe(ultimoCodigo(s)); // HMAC, não o código
    await expect(s.ativar2FA.execute({ usuarioId: u.id, codigo: ultimoCodigo(s) }, ctx)).resolves.toEqual({ status: 'ativado' });
    expect(u.twoFactorAtivo).toBe(true);
    await expect(s.ativar2FA.execute({ usuarioId: u.id })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('código errado conta tentativa; após o limite o código é queimado', async () => {
    const { s, u } = await comUsuario();
    await s.ativar2FA.execute({ usuarioId: u.id });
    const errado = ultimoCodigo(s) === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) {
      await expect(s.ativar2FA.execute({ usuarioId: u.id, codigo: errado })).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' });
    }
    await expect(s.ativar2FA.execute({ usuarioId: u.id, codigo: ultimoCodigo(s) })).rejects.toMatchObject({ statusCode: 429 });
    await expect(s.ativar2FA.execute({ usuarioId: u.id, codigo: ultimoCodigo(s) })).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' });
    expect(acoes(s.auditLog)).toContain('DOIS_FATORES_FALHOU');
  });

  it('código expirado é rejeitado', async () => {
    const { s, u } = await comUsuario();
    await s.ativar2FA.execute({ usuarioId: u.id });
    s.tokens2fa.itens[0].expiraEm = new Date(Date.now() - 1);
    await expect(s.ativar2FA.execute({ usuarioId: u.id, codigo: ultimoCodigo(s) })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('login com 2FA: valida o código e então emite a sessão (uso único)', async () => {
    const { s, u } = await comUsuario();
    u.twoFactorAtivo = true;
    const { desafioToken } = await s.login.execute({ email: 'ana@exemplo.com', senha: SENHA });
    const codigo = ultimoCodigo(s);
    const sessao = await s.validar2FA.execute({ desafioToken, codigo }, ctx);
    expect(sessao.usuario.id).toBe(u.id);
    expect(sessao.accessToken).toEqual(expect.any(String));
    await expect(s.validar2FA.execute({ desafioToken, codigo })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejeita desafio inválido, usuário inexistente e usuário inexistente na ativação', async () => {
    const { s, u } = await comUsuario();
    await expect(s.validar2FA.execute({ desafioToken: 'lixo', codigo: '123456' })).rejects.toMatchObject({ code: 'DESAFIO_INVALIDO' });
    const desafio = s.tokenService.gerarDesafio2FA('00000000-0000-0000-0000-000000000000');
    await expect(s.validar2FA.execute({ desafioToken: desafio, codigo: '123456' })).rejects.toMatchObject({ statusCode: 401 });
    await expect(s.ativar2FA.execute({ usuarioId: 'nao-existe' })).rejects.toMatchObject({ statusCode: 404 });
    u.twoFactorAtivo = true;
    const { desafioToken } = await s.login.execute({ email: 'ana@exemplo.com', senha: SENHA });
    await expect(s.validar2FA.execute({ desafioToken, codigo: '999999' === ultimoCodigo(s) ? '888888' : '999999' })).rejects.toMatchObject({ code: 'CODIGO_INVALIDO' });
  });
});

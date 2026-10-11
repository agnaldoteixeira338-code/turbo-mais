const { Email } = require('../../../domain/value-objects/Email');
const { UnauthorizedError, TooManyRequestsError } = require('../../errors');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

const MENSAGEM_GENERICA = 'E-mail ou senha incorretos';

/**
 * Login com:
 *  - bloqueio após N falhas (por e-mail, janela deslizante no Redis)
 *  - mensagem genérica (não revela se o e-mail existe)
 *  - comparação bcrypt mesmo quando o usuário NÃO existe (hash "isca"),
 *    para que o tempo de resposta não denuncie contas válidas
 *  - desvio para 2FA quando o usuário tem a verificação em duas etapas ativa
 */
class Login {
  constructor({ usuarioRepository, passwordHasher, loginAttemptTracker, emitirSessao, enviarCodigo2FA, tokenService, auditLog }) {
    this.usuarioRepository = usuarioRepository;
    this.passwordHasher = passwordHasher;
    this.loginAttemptTracker = loginAttemptTracker;
    this.emitirSessao = emitirSessao;
    this.enviarCodigo2FA = enviarCodigo2FA;
    this.tokenService = tokenService;
    this.auditLog = auditLog;
    this.hashIsca = null;
  }

  async #obterHashIsca() {
    // Gerado uma vez por processo com o MESMO custo do bcrypt real
    this.hashIsca ??= await this.passwordHasher.hash(`isca-${Date.now()}-${Math.random()}`);
    return this.hashIsca;
  }

  async execute({ email, senha }, ctx = {}) {
    let emailNormalizado;
    try {
      emailNormalizado = Email.criar(email).valor;
    } catch {
      throw new UnauthorizedError(MENSAGEM_GENERICA, 'CREDENCIAIS_INVALIDAS');
    }

    const bloqueio = await this.loginAttemptTracker.verificarBloqueio(emailNormalizado);
    if (bloqueio.bloqueado) {
      await auditar(this.auditLog, ACOES_AUDITORIA.LOGIN_BLOQUEADO, ctx, { metadados: { motivo: 'conta_bloqueada' } });
      throw new TooManyRequestsError(
        'Muitas tentativas de login. Conta temporariamente bloqueada.',
        bloqueio.retryAfterSeconds,
        'CONTA_BLOQUEADA',
      );
    }

    const usuario = await this.usuarioRepository.buscarPorEmail(emailNormalizado);
    const hash = usuario?.senhaHash ?? (await this.#obterHashIsca());
    const senhaConfere = await this.passwordHasher.compare(String(senha ?? ''), hash);

    if (!usuario || !senhaConfere) {
      const falha = await this.loginAttemptTracker.registrarFalha(emailNormalizado);
      await auditar(this.auditLog, ACOES_AUDITORIA.LOGIN_FALHOU, ctx, {
        usuarioId: usuario?.id,
        metadados: { tentativas: falha.tentativas },
      });
      if (falha.bloqueado) {
        throw new TooManyRequestsError(
          'Muitas tentativas de login. Conta temporariamente bloqueada.',
          falha.retryAfterSeconds,
          'CONTA_BLOQUEADA',
        );
      }
      throw new UnauthorizedError(MENSAGEM_GENERICA, 'CREDENCIAIS_INVALIDAS');
    }

    await this.loginAttemptTracker.limpar(emailNormalizado);

    if (usuario.exigeSegundoFator()) {
      await this.enviarCodigo2FA.execute({ usuario, finalidade: 'login' });
      await auditar(this.auditLog, ACOES_AUDITORIA.LOGIN_2FA_PENDENTE, ctx, { usuarioId: usuario.id });
      return { requer2FA: true, desafioToken: this.tokenService.gerarDesafio2FA(usuario.id) };
    }

    const sessao = await this.emitirSessao.execute(usuario, ctx);
    await auditar(this.auditLog, ACOES_AUDITORIA.LOGIN_SUCESSO, ctx, { usuarioId: usuario.id });
    return { requer2FA: false, usuario, ...sessao };
  }
}

module.exports = { Login };

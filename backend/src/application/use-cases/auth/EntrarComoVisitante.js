const { Email } = require('../../../domain/value-objects/Email');
const { NotFoundError } = require('../../errors');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

/**
 * "Entrar como visitante": abre uma sessão na conta de demonstração sem senha,
 * para quem quer conhecer o app sem criar conta.
 *
 * - Não passa pelo Login: assim, erros de senha de terceiros na conta demo
 *   (que é pública) não bloqueiam o botão por 15 min.
 * - Sem 2FA: ninguém recebe os e-mails da conta demo. Pelo mesmo motivo, um
 *   visitante não consegue ATIVAR o 2FA nela (a ativação exige o código).
 * - Só vale para o e-mail configurado em DEMO_USER_EMAIL; sem ele, a rota some.
 */
class EntrarComoVisitante {
  constructor({ usuarioRepository, emitirSessao, auditLog, emailDemo }) {
    this.usuarioRepository = usuarioRepository;
    this.emitirSessao = emitirSessao;
    this.auditLog = auditLog;
    this.emailDemo = emailDemo ? Email.criar(emailDemo).valor : null;
  }

  async execute(ctx = {}) {
    const usuario = this.emailDemo ? await this.usuarioRepository.buscarPorEmail(this.emailDemo) : null;
    if (!usuario) throw new NotFoundError('O acesso de visitante não está disponível no momento');

    const sessao = await this.emitirSessao.execute(usuario, ctx);
    await auditar(this.auditLog, ACOES_AUDITORIA.LOGIN_VISITANTE, ctx, { usuarioId: usuario.id });
    return { usuario, ...sessao };
  }
}

module.exports = { EntrarComoVisitante };

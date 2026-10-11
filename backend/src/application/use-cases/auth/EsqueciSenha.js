const { Email } = require('../../../domain/value-objects/Email');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

/**
 * Passo 1 da recuperação de senha.
 *
 * - Resposta SEMPRE igual (existindo ou não o e-mail) → sem enumeração.
 * - O e-mail é enviado por um WORKER (BullMQ), não na requisição: a latência
 *   e as falhas do provedor de e-mail não afetam a API, e o job tem retry.
 * - O link usa FRAGMENTO (#token=...) e não query string: fragmentos não vão
 *   para o servidor, para logs de proxy nem para o header Referer.
 * - Só o link mais recente vale: pedidos anteriores são invalidados.
 */
class EsqueciSenha {
  constructor({ usuarioRepository, tokenRecuperacaoRepository, tokenService, emailQueue, auditLog, frontendUrl, validadeMinutos }) {
    this.usuarioRepository = usuarioRepository;
    this.tokenRecuperacaoRepository = tokenRecuperacaoRepository;
    this.tokenService = tokenService;
    this.emailQueue = emailQueue;
    this.auditLog = auditLog;
    this.frontendUrl = frontendUrl;
    this.validadeMinutos = validadeMinutos;
  }

  async execute({ email }, ctx = {}) {
    let emailNormalizado;
    try {
      emailNormalizado = Email.criar(email).valor;
    } catch {
      return; // mesma resposta para entrada inválida
    }

    const usuario = await this.usuarioRepository.buscarPorEmail(emailNormalizado);
    if (!usuario) return;

    const { token, jti, expiraEm } = this.tokenService.gerarTokenRecuperacao(usuario.id);
    await this.tokenRecuperacaoRepository.invalidarPendentes(usuario.id);
    await this.tokenRecuperacaoRepository.criar({
      usuarioId: usuario.id,
      tokenHash: this.tokenService.hashToken(token),
      expiraEm,
    });

    await this.emailQueue.enfileirar({
      tipo: 'reset-senha',
      para: usuario.email,
      dados: {
        link: `${this.frontendUrl}/resetar-senha#token=${encodeURIComponent(token)}`,
        validadeMinutos: this.validadeMinutos,
      },
      chaveIdempotencia: `reset-${jti}`,
    });

    await auditar(this.auditLog, ACOES_AUDITORIA.SENHA_RECUPERACAO_SOLICITADA, ctx, { usuarioId: usuario.id });
  }
}

module.exports = { EsqueciSenha };

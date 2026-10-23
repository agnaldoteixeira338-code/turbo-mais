const { ConflictError, ForbiddenError, NotFoundError } = require('../../errors');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');
const { normalizarEmailDemo, ehContaDemo } = require('../contaDemo');

/**
 * Ativação do 2FA em duas chamadas ao mesmo endpoint:
 *   1. sem `codigo` → envia código por e-mail (prova de posse da caixa)
 *   2. com `codigo` → valida e liga o 2FA
 * Só ativamos depois de provar que o e-mail recebe códigos — caso contrário
 * o usuário poderia se trancar fora da própria conta.
 *
 * Na conta demo (compartilhada) é bloqueado: ninguém recebe o código, e cada
 * tentativa mandaria e-mail para um endereço inexistente, o que derruba a
 * reputação de envio no provedor (ADR-013).
 */
class Ativar2FA {
  constructor({ usuarioRepository, enviarCodigo2FA, verificarCodigo2FA, auditLog, emailDemo }) {
    this.usuarioRepository = usuarioRepository;
    this.enviarCodigo2FA = enviarCodigo2FA;
    this.verificarCodigo2FA = verificarCodigo2FA;
    this.auditLog = auditLog;
    this.emailDemo = normalizarEmailDemo(emailDemo);
  }

  async execute({ usuarioId, codigo }, ctx = {}) {
    const usuario = await this.usuarioRepository.buscarPorId(usuarioId);
    if (!usuario) throw new NotFoundError('Usuário não encontrado');
    if (ehContaDemo(usuario, this.emailDemo)) {
      await auditar(this.auditLog, ACOES_AUDITORIA.CONTA_DEMO_ACAO_BLOQUEADA, ctx, { usuarioId, metadados: { acao: 'ativar_2fa' } });
      throw new ForbiddenError(
        'A conta de demonstração é compartilhada e não pode ativar a verificação em duas etapas. Crie sua conta para testar o 2FA.',
        'CONTA_DEMO_PROTEGIDA',
      );
    }
    if (usuario.twoFactorAtivo) throw new ConflictError('A verificação em duas etapas já está ativa', '2FA_JA_ATIVO');

    if (!codigo) {
      await this.enviarCodigo2FA.execute({ usuario, finalidade: 'ativacao' });
      return { status: 'codigo_enviado' };
    }

    try {
      await this.verificarCodigo2FA.execute({ usuarioId, codigo, finalidade: 'ativacao' });
    } catch (err) {
      await auditar(this.auditLog, ACOES_AUDITORIA.DOIS_FATORES_FALHOU, ctx, { usuarioId, metadados: { finalidade: 'ativacao' } });
      throw err;
    }
    await this.usuarioRepository.atualizarDoisFatores(usuarioId, true);
    await auditar(this.auditLog, ACOES_AUDITORIA.DOIS_FATORES_ATIVADO, ctx, { usuarioId });
    return { status: 'ativado' };
  }
}

module.exports = { Ativar2FA };

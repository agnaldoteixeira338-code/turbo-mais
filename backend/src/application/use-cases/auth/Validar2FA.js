const { UnauthorizedError } = require('../../errors');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

/**
 * Segunda etapa do login com 2FA.
 * O `desafioToken` (JWT de 5 min, tipo "2fa") prova que a SENHA já foi
 * validada — sem ele, o endpoint seria um oráculo de força bruta de códigos.
 */
class Validar2FA {
  constructor({ usuarioRepository, tokenService, verificarCodigo2FA, emitirSessao, auditLog }) {
    this.usuarioRepository = usuarioRepository;
    this.tokenService = tokenService;
    this.verificarCodigo2FA = verificarCodigo2FA;
    this.emitirSessao = emitirSessao;
    this.auditLog = auditLog;
  }

  async execute({ desafioToken, codigo }, ctx = {}) {
    const { sub: usuarioId } = this.tokenService.verificarDesafio2FA(desafioToken);
    const usuario = await this.usuarioRepository.buscarPorId(usuarioId);
    if (!usuario) throw new UnauthorizedError('Sessão de verificação inválida', 'DESAFIO_INVALIDO');

    try {
      await this.verificarCodigo2FA.execute({ usuarioId, codigo, finalidade: 'login' });
    } catch (err) {
      await auditar(this.auditLog, ACOES_AUDITORIA.DOIS_FATORES_FALHOU, ctx, { usuarioId, metadados: { finalidade: 'login' } });
      throw err;
    }

    const sessao = await this.emitirSessao.execute(usuario, ctx);
    await auditar(this.auditLog, ACOES_AUDITORIA.LOGIN_SUCESSO, ctx, { usuarioId, metadados: { doisFatores: true } });
    return { usuario, ...sessao };
  }
}

module.exports = { Validar2FA };

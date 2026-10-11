const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

/**
 * Logout idempotente: revoga o refresh token se existir; se não existir (já
 * revogado, cookie ausente), responde sucesso do mesmo jeito. O access token
 * expira sozinho em até 15 min — trade-off documentado em SECURITY.md (sem
 * denylist de JWT para manter a validação stateless).
 */
class Logout {
  constructor({ refreshTokenRepository, tokenService, auditLog }) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
    this.auditLog = auditLog;
  }

  async execute({ refreshToken, usuarioId }, ctx = {}) {
    if (refreshToken) {
      await this.refreshTokenRepository.revogarPorHash(this.tokenService.hashToken(refreshToken));
    }
    await auditar(this.auditLog, ACOES_AUDITORIA.LOGOUT, ctx, { usuarioId });
  }
}

module.exports = { Logout };

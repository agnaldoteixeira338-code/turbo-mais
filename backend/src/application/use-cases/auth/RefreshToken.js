const { UnauthorizedError } = require('../../errors');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

/**
 * Rotação de refresh token com DETECÇÃO DE REUSO (RFC 6819 / OAuth BCP).
 *
 * A cada uso, o refresh token atual é revogado e um novo é emitido na mesma
 * família. Se um token JÁ REVOGADO for apresentado de novo, alguém copiou
 * o token (o usuário legítimo já o trocou): revogamos a família inteira e
 * forçamos novo login em todos os dispositivos dessa sessão.
 *
 * Detalhe importante: a revogação da família precisa ser COMMITADA antes de
 * lançarmos o erro — lançar dentro da transação faria rollback da própria
 * revogação. Por isso a transação devolve um "veredito" e o erro é lançado
 * fora dela.
 */
class RefreshToken {
  constructor({ unitOfWork, tokenService, emitirSessao, auditLog, clock = () => new Date() }) {
    this.unitOfWork = unitOfWork;
    this.tokenService = tokenService;
    this.emitirSessao = emitirSessao;
    this.auditLog = auditLog;
    this.clock = clock;
  }

  async execute({ refreshToken }, ctx = {}) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedError('Sessão expirada', 'SESSAO_EXPIRADA');
    }
    const tokenHash = this.tokenService.hashToken(refreshToken);

    const veredito = await this.unitOfWork.run(async ({ refreshTokens, usuarios }) => {
      const atual = await refreshTokens.buscarPorHashParaAtualizacao(tokenHash);
      if (!atual) return { tipo: 'invalido' };

      if (atual.revogado) {
        await refreshTokens.revogarFamilia(atual.familiaId);
        return { tipo: 'reuso', usuarioId: atual.usuarioId, familiaId: atual.familiaId };
      }
      if (atual.expiraEm.getTime() <= this.clock().getTime()) return { tipo: 'expirado' };

      const usuario = await usuarios.buscarPorId(atual.usuarioId);
      if (!usuario) return { tipo: 'invalido' };

      const sessao = await this.emitirSessao.execute(usuario, ctx, {
        familiaId: atual.familiaId,
        refreshTokenRepository: refreshTokens,
      });
      await refreshTokens.revogar(atual.id, { substituidoPor: sessao.refreshTokenId });
      return { tipo: 'ok', usuario, sessao };
    });

    if (veredito.tipo === 'reuso') {
      await auditar(this.auditLog, ACOES_AUDITORIA.REFRESH_TOKEN_REUTILIZADO, ctx, {
        usuarioId: veredito.usuarioId,
        metadados: { familiaId: veredito.familiaId },
      });
      throw new UnauthorizedError('Sessão invalidada por segurança. Faça login novamente.', 'SESSAO_REVOGADA');
    }
    if (veredito.tipo !== 'ok') {
      throw new UnauthorizedError('Sessão expirada', 'SESSAO_EXPIRADA');
    }
    return { usuario: veredito.usuario, ...veredito.sessao };
  }
}

module.exports = { RefreshToken };

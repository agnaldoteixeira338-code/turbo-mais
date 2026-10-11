const crypto = require('node:crypto');

/**
 * Serviço de aplicação interno: emite o par access + refresh token.
 *
 * - Access token: JWT curto (15 min), vai no header Authorization.
 * - Refresh token: string aleatória OPACA (não-JWT), vai em cookie httpOnly.
 *   Guardamos só o sha256 dele. Opaco porque precisa ser revogável no
 *   servidor de qualquer jeito — um JWT aqui só adicionaria superfície.
 * - familiaId agrupa todos os refresh tokens derivados de um mesmo login;
 *   é o que permite revogar a sessão inteira se detectarmos reuso.
 */
class EmitirSessao {
  constructor({ refreshTokenRepository, tokenService, refreshTokenTtlDias, clock = () => new Date() }) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
    this.refreshTokenTtlDias = refreshTokenTtlDias;
    this.clock = clock;
  }

  async execute(usuario, ctx = {}, { familiaId, refreshTokenRepository } = {}) {
    const repo = refreshTokenRepository ?? this.refreshTokenRepository;
    const refreshToken = this.tokenService.gerarTokenOpaco();
    const refreshExpiraEm = new Date(this.clock().getTime() + this.refreshTokenTtlDias * 24 * 60 * 60 * 1000);

    const registro = await repo.criar({
      usuarioId: usuario.id,
      tokenHash: this.tokenService.hashToken(refreshToken),
      familiaId: familiaId ?? crypto.randomUUID(),
      expiraEm: refreshExpiraEm,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ? String(ctx.userAgent).slice(0, 255) : null,
    });

    const { token: accessToken, expiresIn } = this.tokenService.gerarAccessToken(usuario);
    return { accessToken, expiresIn, refreshToken, refreshExpiraEm, refreshTokenId: registro.id };
  }
}

module.exports = { EmitirSessao };

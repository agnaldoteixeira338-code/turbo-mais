const { Senha } = require('../../../domain/value-objects/Senha');
const { UnauthorizedError } = require('../../errors');
const { ACOES_AUDITORIA } = require('../../../shared/constants');
const { auditar } = require('../auditar');

/**
 * Passo 2 da recuperação: define a nova senha.
 *
 * Duas verificações independentes do token:
 *   1. assinatura + expiração do JWT (stateless, barato)
 *   2. registro no banco ainda não usado (stateful, garante USO ÚNICO)
 * Em uma única transação: consome o token, troca a senha e revoga TODAS as
 * sessões (quem pediu reset pode estar com a conta comprometida).
 */
class ResetarSenha {
  constructor({ unitOfWork, tokenService, passwordHasher, auditLog }) {
    this.unitOfWork = unitOfWork;
    this.tokenService = tokenService;
    this.passwordHasher = passwordHasher;
    this.auditLog = auditLog;
  }

  async execute({ token, novaSenha }, ctx = {}) {
    const payload = this.tokenService.verificarTokenRecuperacao(token);
    const senha = Senha.criar(novaSenha);
    const senhaHash = await this.passwordHasher.hash(senha.valor);
    const tokenHash = this.tokenService.hashToken(token);

    await this.unitOfWork.run(async ({ tokensRecuperacao, usuarios, refreshTokens }) => {
      const registro = await tokensRecuperacao.consumir(tokenHash);
      if (!registro || registro.usuarioId !== payload.sub) {
        throw new UnauthorizedError('Link inválido ou expirado. Solicite um novo.', 'TOKEN_INVALIDO');
      }
      await usuarios.atualizarSenha(payload.sub, senhaHash);
      await refreshTokens.revogarTodosDoUsuario(payload.sub);
    });

    await auditar(this.auditLog, ACOES_AUDITORIA.SENHA_REDEFINIDA, ctx, { usuarioId: payload.sub });
  }
}

module.exports = { ResetarSenha };

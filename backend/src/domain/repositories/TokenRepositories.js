/* eslint-disable no-unused-vars */
const { naoImplementado } = require('./contrato');

/** @interface Refresh tokens com rotação e revogação por família. */
class RefreshTokenRepository {
  async criar({ usuarioId, tokenHash, familiaId, expiraEm, ip, userAgent }) { naoImplementado('RefreshTokenRepository', 'criar'); }
  /** Deve travar a linha (SELECT ... FOR UPDATE) para evitar rotação concorrente. */
  async buscarPorHashParaAtualizacao(tokenHash) { naoImplementado('RefreshTokenRepository', 'buscarPorHashParaAtualizacao'); }
  async revogar(id, { substituidoPor } = {}) { naoImplementado('RefreshTokenRepository', 'revogar'); }
  async revogarPorHash(tokenHash) { naoImplementado('RefreshTokenRepository', 'revogarPorHash'); }
  async revogarFamilia(familiaId) { naoImplementado('RefreshTokenRepository', 'revogarFamilia'); }
  async revogarTodosDoUsuario(usuarioId) { naoImplementado('RefreshTokenRepository', 'revogarTodosDoUsuario'); }
}

/** @interface Tokens de recuperação de senha (uso único). */
class TokenRecuperacaoRepository {
  async criar({ usuarioId, tokenHash, expiraEm }) { naoImplementado('TokenRecuperacaoRepository', 'criar'); }
  async invalidarPendentes(usuarioId) { naoImplementado('TokenRecuperacaoRepository', 'invalidarPendentes'); }
  /** Marca como usado de forma ATÔMICA e retorna o registro, ou null se inválido/expirado/já usado. */
  async consumir(tokenHash) { naoImplementado('TokenRecuperacaoRepository', 'consumir'); }
}

/** @interface Códigos 2FA enviados por e-mail. */
class Token2faRepository {
  async criar({ usuarioId, codigoHash, finalidade, expiraEm }) { naoImplementado('Token2faRepository', 'criar'); }
  async invalidarPendentes(usuarioId, finalidade) { naoImplementado('Token2faRepository', 'invalidarPendentes'); }
  async buscarPendente(usuarioId, finalidade) { naoImplementado('Token2faRepository', 'buscarPendente'); }
  async incrementarTentativas(id) { naoImplementado('Token2faRepository', 'incrementarTentativas'); }
  /** Marca como usado de forma atômica. @returns {Promise<boolean>} */
  async consumir(id) { naoImplementado('Token2faRepository', 'consumir'); }
}

module.exports = { RefreshTokenRepository, TokenRecuperacaoRepository, Token2faRepository };

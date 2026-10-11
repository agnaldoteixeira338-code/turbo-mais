const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../../application/errors');
const { sha256, hmacSha256 } = require('../../shared/utils');

/**
 * Emissão e verificação de tokens.
 *
 * Defesas aplicadas (OWASP A02/A07 + "JWT pitfalls"):
 *  - UM SEGREDO POR FINALIDADE (access, reset, 2fa): um token de reset nunca
 *    é aceito como access token, mesmo que alguém troque o claim `typ`.
 *  - algorithms fixado em HS256: impede o ataque "alg: none" / troca de algoritmo.
 *  - issuer + audience verificados.
 *  - payload mínimo: só `sub` (UUID) — nenhum dado pessoal no JWT, que é
 *    apenas codificado (base64), não criptografado.
 */
class JwtTokenService {
  constructor({ accessSecret, resetSecret, doisFatoresSecret, codigoHmacSecret, issuer, accessTtlSegundos, resetTtlMinutos, desafioTtlMinutos = 5 }) {
    this.segredos = { access: accessSecret, reset: resetSecret, '2fa': doisFatoresSecret };
    this.codigoHmacSecret = codigoHmacSecret;
    this.issuer = issuer;
    this.ttl = { access: accessTtlSegundos, reset: resetTtlMinutos * 60, '2fa': desafioTtlMinutos * 60 };
  }

  #assinar(tipo, sub, extras = {}) {
    return jwt.sign({ typ: tipo, ...extras }, this.segredos[tipo], {
      algorithm: 'HS256',
      subject: sub,
      issuer: this.issuer,
      audience: `turbo-mais:${tipo}`,
      expiresIn: this.ttl[tipo],
    });
  }

  #verificar(tipo, token, mensagem, code) {
    try {
      const payload = jwt.verify(String(token ?? ''), this.segredos[tipo], {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: `turbo-mais:${tipo}`,
      });
      if (payload.typ !== tipo) throw new Error('tipo de token incorreto');
      return payload;
    } catch {
      throw new UnauthorizedError(mensagem, code);
    }
  }

  gerarAccessToken(usuario) {
    return { token: this.#assinar('access', usuario.id), expiresIn: this.ttl.access };
  }

  verificarAccessToken(token) {
    return this.#verificar('access', token, 'Token inválido ou expirado', 'TOKEN_INVALIDO');
  }

  gerarTokenRecuperacao(usuarioId) {
    const jti = crypto.randomUUID();
    const token = this.#assinar('reset', usuarioId, { jti });
    return { token, jti, expiraEm: new Date(Date.now() + this.ttl.reset * 1000) };
  }

  verificarTokenRecuperacao(token) {
    return this.#verificar('reset', token, 'Link inválido ou expirado. Solicite um novo.', 'TOKEN_INVALIDO');
  }

  gerarDesafio2FA(usuarioId) {
    return this.#assinar('2fa', usuarioId);
  }

  verificarDesafio2FA(token) {
    return this.#verificar('2fa', token, 'Verificação expirada. Faça login novamente.', 'DESAFIO_INVALIDO');
  }

  /** Refresh token opaco: 384 bits de entropia, URL-safe. */
  gerarTokenOpaco() {
    return crypto.randomBytes(48).toString('base64url');
  }

  hashToken(valor) {
    return sha256(valor);
  }

  hashCodigo(codigo) {
    return hmacSha256(this.codigoHmacSecret, codigo);
  }
}

module.exports = { JwtTokenService };

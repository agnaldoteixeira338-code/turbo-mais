const { DomainValidationError } = require('../errors/DomainValidationError');

const MINIMO = 8;
// Bcrypt ignora silenciosamente tudo após 72 BYTES. Rejeitar senhas maiores
// evita a falsa sensação de segurança de uma senha "longa" truncada.
const MAXIMO_BYTES = 72;

/**
 * Value Object: senha em TEXTO PURO, validada contra a política.
 * Existe só em memória, durante o cadastro/reset — nunca é persistida nem logada.
 */
class Senha {
  #valor;

  constructor(valor) {
    if (typeof valor !== 'string' || valor.length === 0) {
      throw new DomainValidationError('Senha é obrigatória', 'senha');
    }
    const problemas = Senha.verificarPolitica(valor);
    if (problemas.length > 0) {
      throw new DomainValidationError(`Senha fraca: ${problemas.join(', ')}`, 'senha');
    }
    this.#valor = valor;
    Object.freeze(this);
  }

  static criar(valor) {
    return new Senha(valor);
  }

  /** @returns {string[]} lista de requisitos não atendidos (vazia = ok) */
  static verificarPolitica(valor) {
    const problemas = [];
    if (valor.length < MINIMO) problemas.push(`mínimo de ${MINIMO} caracteres`);
    if (Buffer.byteLength(valor, 'utf8') > MAXIMO_BYTES) problemas.push(`máximo de ${MAXIMO_BYTES} bytes`);
    if (!/[a-z]/.test(valor)) problemas.push('uma letra minúscula');
    if (!/[A-Z]/.test(valor)) problemas.push('uma letra maiúscula');
    if (!/\d/.test(valor)) problemas.push('um número');
    if (!/[^A-Za-z0-9]/.test(valor)) problemas.push('um caractere especial');
    return problemas;
  }

  get valor() {
    return this.#valor;
  }

  // Defesa extra: se alguém logar o objeto por engano, nada vaza.
  toJSON() {
    return '[REDACTED]';
  }

  toString() {
    return '[REDACTED]';
  }
}

module.exports = { Senha };

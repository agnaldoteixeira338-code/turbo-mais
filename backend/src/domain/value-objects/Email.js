const { DomainValidationError } = require('../errors/DomainValidationError');

// Validação pragmática: RFC 5322 completa aceita coisas que nenhum provedor
// real entrega. A prova definitiva de que o e-mail existe é o envio.
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
const TAMANHO_MAXIMO = 254;

/** Value Object imutável: e-mail normalizado (trim + minúsculas). */
class Email {
  constructor(valor) {
    if (typeof valor !== 'string') {
      throw new DomainValidationError('E-mail é obrigatório', 'email');
    }
    const normalizado = valor.trim().toLowerCase();
    if (normalizado.length > TAMANHO_MAXIMO || !EMAIL_REGEX.test(normalizado)) {
      throw new DomainValidationError('E-mail inválido', 'email');
    }
    this.valor = normalizado;
    Object.freeze(this);
  }

  static criar(valor) {
    return new Email(valor);
  }

  /** Versão segura para logs: "an***@gmail.com" */
  mascarado() {
    const [local, dominio] = this.valor.split('@');
    return `${local.slice(0, 2)}***@${dominio}`;
  }

  equals(outro) {
    return outro instanceof Email && outro.valor === this.valor;
  }

  toString() {
    return this.valor;
  }
}

module.exports = { Email };

const { DomainValidationError } = require('../errors/DomainValidationError');

/**
 * Value Object: celular brasileiro, armazenado em E.164 (+55DDNNNNNNNNN).
 *
 * Aceita entradas como "(11) 98765-4321", "11987654321" ou "+55 11 98765-4321".
 * Regra: DDD de 11 a 99 (sem zero) + 9 dígitos começando com 9 (padrão Anatel).
 */
class Celular {
  constructor(valor) {
    if (typeof valor !== 'string' && typeof valor !== 'number') {
      throw new DomainValidationError('Celular é obrigatório', 'celular');
    }
    let digitos = String(valor).replace(/\D/g, '');
    if (digitos.length === 13 && digitos.startsWith('55')) {
      digitos = digitos.slice(2);
    }
    const valido = /^[1-9][1-9]9\d{8}$/.test(digitos);
    if (!valido) {
      throw new DomainValidationError('Celular inválido. Use DDD + número com 9 dígitos', 'celular');
    }
    this.valor = `+55${digitos}`;
    Object.freeze(this);
  }

  static criar(valor) {
    return new Celular(valor);
  }

  /** "+55 (11) 9****-4321" — para exibição em logs e telas de confirmação */
  mascarado() {
    const ddd = this.valor.slice(3, 5);
    const final = this.valor.slice(-4);
    return `+55 (${ddd}) 9****-${final}`;
  }

  toString() {
    return this.valor;
  }
}

module.exports = { Celular };

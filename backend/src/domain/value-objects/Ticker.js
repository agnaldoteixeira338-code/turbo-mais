const { DomainValidationError } = require('../errors/DomainValidationError');

// Aceita tickers da B3 (PETR4, SANB11), EUA (AAPL, BRK.B), cripto (BTC)
// e códigos internos de renda fixa (CDB-LIQ-100).
const TICKER_REGEX = /^[A-Z0-9][A-Z0-9.-]{0,19}$/;

/** Value Object: código de negociação normalizado em maiúsculas. */
class Ticker {
  constructor(valor) {
    if (typeof valor !== 'string') {
      throw new DomainValidationError('Ticker é obrigatório', 'ticker');
    }
    const normalizado = valor.trim().toUpperCase();
    if (!TICKER_REGEX.test(normalizado)) {
      throw new DomainValidationError('Ticker inválido', 'ticker');
    }
    this.valor = normalizado;
    Object.freeze(this);
  }

  static criar(valor) {
    return new Ticker(valor);
  }

  static ehValido(valor) {
    return typeof valor === 'string' && TICKER_REGEX.test(valor.trim().toUpperCase());
  }

  equals(outro) {
    return outro instanceof Ticker && outro.valor === this.valor;
  }

  toString() {
    return this.valor;
  }
}

module.exports = { Ticker, TICKER_REGEX };

const { Email } = require('../../domain/value-objects/Email');

/**
 * A conta de demonstração (botão "Entrar como visitante") é pública por
 * definição e ninguém recebe os e-mails dela. Estes helpers centralizam
 * "qual é a conta demo" para os casos de uso que a tratam de forma especial.
 */

/** E-mail da conta demo normalizado, ou null quando o recurso está desligado. */
function normalizarEmailDemo(emailDemo) {
  return emailDemo ? Email.criar(emailDemo).valor : null;
}

/** @param {{email: string}|null} usuario @param {string|null} emailDemoNormalizado */
function ehContaDemo(usuario, emailDemoNormalizado) {
  return Boolean(usuario && emailDemoNormalizado && usuario.email === emailDemoNormalizado);
}

module.exports = { normalizarEmailDemo, ehContaDemo };

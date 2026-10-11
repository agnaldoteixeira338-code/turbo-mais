const crypto = require('node:crypto');
const { ForbiddenError } = require('../../../application/errors');
const { compararSeguro } = require('../../../shared/utils');

/**
 * Proteção CSRF por DOUBLE-SUBMIT COOKIE, aplicada nas rotas que dependem do
 * cookie de refresh (/auth/refresh e /auth/logout).
 *
 * Camadas:
 *  1. Cookie de refresh com SameSite=Strict (já barra CSRF nos navegadores atuais)
 *  2. Double-submit: o JS do nosso domínio lê o cookie CSRF e o repete no
 *     header X-CSRF-Token; um site atacante não consegue ler o cookie.
 *  3. Em produção o cookie usa o prefixo __Host- (exige Secure, Path=/ e
 *     proíbe Domain) — impede "cookie tossing" a partir de subdomínios.
 */
function nomeCookieCsrf(seguro) {
  return seguro ? '__Host-csrf' : 'csrf_token';
}

function emitirCookieCsrf(res, { seguro, maxAgeMs }) {
  const token = crypto.randomBytes(32).toString('base64url');
  res.cookie(nomeCookieCsrf(seguro), token, {
    httpOnly: false, // precisa ser lido pelo JS do frontend
    secure: seguro,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  });
  return token;
}

function csrfProtection({ seguro }) {
  return (req, _res, next) => {
    const cookie = req.cookies?.[nomeCookieCsrf(seguro)];
    const header = req.get('x-csrf-token');
    if (!cookie || !header || !compararSeguro(cookie, header)) {
      return next(new ForbiddenError('Token CSRF ausente ou inválido', 'CSRF_INVALIDO'));
    }
    return next();
  };
}

module.exports = { csrfProtection, emitirCookieCsrf, nomeCookieCsrf };

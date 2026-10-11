const helmet = require('helmet');

/**
 * Cabeçalhos de segurança (Helmet) com CSP REAL.
 *
 * A API só devolve JSON, então a CSP dela é a mais restritiva possível:
 * `default-src 'none'` — se alguém conseguir fazer o navegador renderizar uma
 * resposta da API como HTML, nada executa. A CSP do SPA (que precisa de
 * scripts/estilos próprios) é aplicada pelo Nginx do frontend.
 */
function cspMiddleware({ producao }) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: producao ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
  });
}

/** CSP relaxada SÓ para o Swagger UI (precisa de scripts/estilos do próprio pacote). */
function cspSwagger() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });
}

module.exports = { cspMiddleware, cspSwagger };

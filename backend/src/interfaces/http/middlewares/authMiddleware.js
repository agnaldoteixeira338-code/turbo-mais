const { UnauthorizedError } = require('../../../application/errors');
const { definirNoContexto } = require('../../../shared/requestContext');

/**
 * Exige `Authorization: Bearer <access token>`.
 *
 * O access token vai no HEADER (não em cookie) de propósito: requisições
 * cross-site forjadas não conseguem adicionar headers, então as rotas de API
 * ficam imunes a CSRF por construção. O cookie só existe para o refresh token.
 */
function authMiddleware(tokenService) {
  return (req, _res, next) => {
    const [esquema, token] = (req.get('authorization') ?? '').split(' ');
    if (esquema !== 'Bearer' || !token) {
      return next(new UnauthorizedError('Autenticação necessária', 'NAO_AUTENTICADO'));
    }
    const payload = tokenService.verificarAccessToken(token);
    req.usuario = { id: payload.sub };
    definirNoContexto('usuarioId', payload.sub);
    return next();
  };
}

module.exports = { authMiddleware };

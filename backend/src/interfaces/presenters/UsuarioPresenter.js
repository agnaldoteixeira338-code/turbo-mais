/**
 * Presenter = WHITELIST do que sai na API. Campos novos na entidade (ex.:
 * senhaHash) nunca vazam por acidente, porque só o que está listado aqui é
 * serializado (OWASP API3 — Excessive Data Exposure).
 */
const UsuarioPresenter = {
  paraHttp(usuario) {
    return {
      id: usuario.id,
      email: usuario.email,
      celular: usuario.celular,
      twoFactorAtivo: usuario.twoFactorAtivo,
      criadoEm: usuario.criadoEm,
    };
  },
};

module.exports = { UsuarioPresenter };

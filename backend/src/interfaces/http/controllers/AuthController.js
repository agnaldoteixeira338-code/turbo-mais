const { sucesso, contextoDe } = require('../resposta');
const { UsuarioPresenter } = require('../../presenters/UsuarioPresenter');
const { emitirCookieCsrf } = require('../middlewares/csrfProtection');

const COOKIE_REFRESH = 'refresh_token';
const CAMINHO_COOKIE_REFRESH = '/api/v1/auth';

/**
 * Controllers são FINOS: traduzem HTTP ↔ caso de uso. Sem regra de negócio,
 * sem try/catch (o errorHandler centraliza).
 */
class AuthController {
  constructor({ useCases, cookieSeguro, refreshTtlDias, usuarioRepository }) {
    this.uc = useCases;
    this.cookieSeguro = cookieSeguro;
    this.refreshMaxAgeMs = refreshTtlDias * 24 * 60 * 60 * 1000;
    this.usuarioRepository = usuarioRepository;
  }

  #definirSessao(res, { refreshToken, refreshExpiraEm }) {
    // httpOnly: JS não lê (XSS não rouba). Path restrito: só vai para /auth.
    res.cookie(COOKIE_REFRESH, refreshToken, {
      httpOnly: true,
      secure: this.cookieSeguro,
      sameSite: 'strict',
      path: CAMINHO_COOKIE_REFRESH,
      expires: refreshExpiraEm,
    });
    emitirCookieCsrf(res, { seguro: this.cookieSeguro, maxAgeMs: this.refreshMaxAgeMs });
  }

  #limparSessao(res) {
    res.clearCookie(COOKIE_REFRESH, { path: CAMINHO_COOKIE_REFRESH, httpOnly: true, secure: this.cookieSeguro, sameSite: 'strict' });
  }

  #respostaSessao(res, resultado, status = 200) {
    this.#definirSessao(res, resultado);
    return sucesso(
      res,
      { usuario: UsuarioPresenter.paraHttp(resultado.usuario), accessToken: resultado.accessToken, expiresIn: resultado.expiresIn },
      { status },
    );
  }

  cadastrar = async (req, res) => {
    const usuario = await this.uc.cadastrarUsuario.execute(req.valido.body, contextoDe(req));
    return sucesso(res, { usuario: UsuarioPresenter.paraHttp(usuario) }, { status: 201 });
  };

  login = async (req, res) => {
    const resultado = await this.uc.login.execute(req.valido.body, contextoDe(req));
    if (resultado.requer2FA) {
      return sucesso(res, { requer2FA: true, desafioToken: resultado.desafioToken });
    }
    return this.#respostaSessao(res, resultado);
  };

  visitante = async (req, res) => {
    const resultado = await this.uc.entrarComoVisitante.execute(contextoDe(req));
    return this.#respostaSessao(res, resultado);
  };

  refresh = async (req, res) => {
    try {
      const resultado = await this.uc.refreshToken.execute({ refreshToken: req.cookies?.[COOKIE_REFRESH] }, contextoDe(req));
      return this.#respostaSessao(res, resultado);
    } catch (err) {
      this.#limparSessao(res); // cookie inválido não deve ficar sendo reenviado
      throw err;
    }
  };

  logout = async (req, res) => {
    await this.uc.logout.execute({ refreshToken: req.cookies?.[COOKIE_REFRESH], usuarioId: req.usuario?.id }, contextoDe(req));
    this.#limparSessao(res);
    return res.status(204).end();
  };

  esqueciSenha = async (req, res) => {
    await this.uc.esqueciSenha.execute(req.valido.body, contextoDe(req));
    // 202 + mensagem idêntica exista ou não a conta (anti-enumeração)
    return sucesso(res, { mensagem: 'Se o e-mail estiver cadastrado, você receberá um link em instantes.' }, { status: 202 });
  };

  resetarSenha = async (req, res) => {
    await this.uc.resetarSenha.execute(req.valido.body, contextoDe(req));
    this.#limparSessao(res);
    return sucesso(res, { mensagem: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
  };

  ativar2FA = async (req, res) => {
    const resultado = await this.uc.ativar2FA.execute({ usuarioId: req.usuario.id, codigo: req.valido.body.codigo }, contextoDe(req));
    return sucesso(res, resultado, { status: resultado.status === 'codigo_enviado' ? 202 : 200 });
  };

  validar2FA = async (req, res) => {
    const resultado = await this.uc.validar2FA.execute(req.valido.body, contextoDe(req));
    return this.#respostaSessao(res, resultado);
  };

  eu = async (req, res) => {
    const usuario = await this.usuarioRepository.buscarPorId(req.usuario.id);
    return sucesso(res, { usuario: UsuarioPresenter.paraHttp(usuario) });
  };
}

module.exports = { AuthController, COOKIE_REFRESH };

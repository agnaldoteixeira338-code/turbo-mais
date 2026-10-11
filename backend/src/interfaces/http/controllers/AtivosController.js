const { sucesso } = require('../resposta');
const { AtivoPresenter } = require('../../presenters/AtivoPresenter');

class AtivosController {
  constructor({ useCases }) {
    this.uc = useCases;
  }

  #responderLista(res, { itens, meta }) {
    // Sinaliza para o cliente/CDN que a lista pode ser cacheada por pouco tempo
    res.setHeader('Cache-Control', 'private, max-age=15');
    return sucesso(res, itens.map(AtivoPresenter.resumo), { meta });
  }

  buscar = async (req, res) => {
    const { q, ...filtros } = req.valido.query;
    return this.#responderLista(res, await this.uc.buscarAtivos.execute({ termo: q, ...filtros }));
  };

  /** Fábrica para as rotas por categoria (/acoes-brasileiras, /criptomoedas...). */
  porCategoria = (categoria) => async (req, res) => {
    const { q, page, limit } = req.valido.query;
    const filtros = { termo: q, page, limit };
    const casos = {
      acoesBrasileiras: () => this.uc.buscarAcoesBrasileiras.execute(filtros),
      acoesGlobais: () => this.uc.buscarAcoesGlobais.execute(filtros),
      criptomoedas: () => this.uc.buscarAtivos.execute({ ...filtros, tipo: 'cripto' }),
      cdbs: () => this.uc.buscarAtivos.execute({ ...filtros, tipo: 'cdb' }),
      bancos: () => this.uc.buscarAtivos.execute({ ...filtros, setor: 'Bancos' }),
    };
    return this.#responderLista(res, await casos[categoria]());
  };

  detalhar = async (req, res) => {
    const resultado = await this.uc.detalharAtivo.execute({ ticker: req.valido.params.ticker, dias: req.valido.query.dias });
    res.setHeader('Cache-Control', 'private, max-age=15');
    return sucesso(res, AtivoPresenter.detalhe(resultado));
  };
}

module.exports = { AtivosController };

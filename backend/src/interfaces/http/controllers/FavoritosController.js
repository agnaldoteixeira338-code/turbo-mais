const { sucesso } = require('../resposta');
const { AtivoPresenter } = require('../../presenters/AtivoPresenter');

class FavoritosController {
  constructor({ useCases }) {
    this.uc = useCases;
  }

  listar = async (req, res) => {
    const { itens, meta } = await this.uc.listarFavoritos.execute({ usuarioId: req.usuario.id, ...req.valido.query });
    return sucesso(res, itens.map(AtivoPresenter.favorito), { meta });
  };

  adicionar = async (req, res) => {
    const { favorito, criado } = await this.uc.adicionarFavorito.execute({ usuarioId: req.usuario.id, ticker: req.valido.body.ticker });
    return sucesso(res, AtivoPresenter.favorito({ favorito }), { status: criado ? 201 : 200 });
  };

  remover = async (req, res) => {
    await this.uc.removerFavorito.execute({ usuarioId: req.usuario.id, ticker: req.valido.params.ticker });
    return res.status(204).end();
  };
}

module.exports = { FavoritosController };

const { sucesso } = require('../resposta');
const { AtivoPresenter } = require('../../presenters/AtivoPresenter');

class NotificacoesController {
  constructor({ useCases }) {
    this.uc = useCases;
  }

  listar = async (req, res) => {
    const { page, limit, naoLidas } = req.valido.query;
    const { itens, meta } = await this.uc.listarNotificacoes.execute({
      usuarioId: req.usuario.id,
      apenasNaoLidas: naoLidas,
      page,
      limit,
    });
    return sucesso(res, itens.map(AtivoPresenter.notificacao), { meta });
  };

  marcarComoLida = async (req, res) => {
    const notificacao = await this.uc.marcarComoLida.execute({ id: req.valido.params.id, usuarioId: req.usuario.id });
    return sucesso(res, AtivoPresenter.notificacao(notificacao));
  };
}

module.exports = { NotificacoesController };

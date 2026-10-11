const { sucesso, contextoDe } = require('../resposta');
const { AtivoPresenter } = require('../../presenters/AtivoPresenter');

class AlertasController {
  constructor({ useCases }) {
    this.uc = useCases;
  }

  listar = async (req, res) => {
    const { itens, meta } = await this.uc.listarAlertas.execute({ usuarioId: req.usuario.id, ...req.valido.query });
    return sucesso(res, itens.map(AtivoPresenter.alerta), { meta });
  };

  criar = async (req, res) => {
    const alerta = await this.uc.criarAlerta.execute({ usuarioId: req.usuario.id, ...req.valido.body }, contextoDe(req));
    return sucesso(res, AtivoPresenter.alerta(alerta), { status: 201 });
  };

  atualizar = async (req, res) => {
    const alerta = await this.uc.atualizarAlerta.execute(
      { id: req.valido.params.id, usuarioId: req.usuario.id, campos: req.valido.body },
      contextoDe(req),
    );
    return sucesso(res, AtivoPresenter.alerta(alerta));
  };

  remover = async (req, res) => {
    await this.uc.removerAlerta.execute({ id: req.valido.params.id, usuarioId: req.usuario.id }, contextoDe(req));
    return res.status(204).end();
  };
}

module.exports = { AlertasController };

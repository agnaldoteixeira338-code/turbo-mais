const { sucesso } = require('../resposta');
const { AtivoPresenter } = require('../../presenters/AtivoPresenter');

class IdeiasController {
  constructor({ useCases }) {
    this.uc = useCases;
  }

  criar = async (req, res) => {
    const ideia = await this.uc.gerarSugestoes.execute({ usuarioId: req.usuario.id, texto: req.valido.body.texto });
    return sucesso(res, AtivoPresenter.ideia(ideia), { status: 201 });
  };

  listar = async (req, res) => {
    const { itens, meta } = await this.uc.listarIdeias.execute({ usuarioId: req.usuario.id, ...req.valido.query });
    return sucesso(res, itens.map(AtivoPresenter.ideia), { meta });
  };
}

module.exports = { IdeiasController };

/** Especialização de BuscarAtivos: ações negociadas no exterior (EUA). */
class BuscarAcoesGlobais {
  constructor({ buscarAtivos }) {
    this.buscarAtivos = buscarAtivos;
  }

  execute({ termo, setor, page, limit } = {}) {
    return this.buscarAtivos.execute({ termo, setor, page, limit, tipo: 'acao_global' });
  }
}

module.exports = { BuscarAcoesGlobais };

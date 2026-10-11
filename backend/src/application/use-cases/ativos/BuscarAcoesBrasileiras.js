/** Especialização de BuscarAtivos: ações negociadas na B3. */
class BuscarAcoesBrasileiras {
  constructor({ buscarAtivos }) {
    this.buscarAtivos = buscarAtivos;
  }

  execute({ termo, setor, page, limit } = {}) {
    return this.buscarAtivos.execute({ termo, setor, page, limit, tipo: 'acao_br' });
  }
}

module.exports = { BuscarAcoesBrasileiras };

/** Entidade Sugestao: um ativo ranqueado para uma Ideia, com justificativa. */
class Sugestao {
  constructor({ id, ideiaId, ticker, nome, tipo, score, posicao, justificativa, criadoEm = new Date() }) {
    this.id = id;
    this.ideiaId = ideiaId;
    this.ticker = ticker;
    this.nome = nome;
    this.tipo = tipo;
    this.score = Number(score);
    this.posicao = posicao;
    this.justificativa = justificativa;
    this.criadoEm = criadoEm;
  }
}

module.exports = { Sugestao };

/** Entidade Ideia: o que o usuário descreveu em texto livre. */
class Ideia {
  constructor({ id, usuarioId, textoDescrito, palavrasChave = [], sugestoes = [], criadoEm = new Date() }) {
    this.id = id;
    this.usuarioId = usuarioId;
    this.textoDescrito = textoDescrito;
    this.palavrasChave = palavrasChave;
    this.sugestoes = sugestoes;
    this.criadoEm = criadoEm;
  }
}

module.exports = { Ideia };

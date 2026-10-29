const TIPOS_ATIVO = Object.freeze(['acao_br', 'acao_global', 'cripto', 'cdb']);
const PERFIS_RISCO = Object.freeze(['conservador', 'moderado', 'arrojado']);

/** Entidade AtivoEducativo: catálogo com explicações em linguagem simples. */
class AtivoEducativo {
  constructor({
    id, ticker, nome, tipo, oQueFaz, papelSociedade, setor, pais, fundacao,
    perfilRisco, rendimentoMedio, tags = [], codigoExterno = null, precoReferencia = null, moeda = 'BRL',
    fatoresAlta = [], fatoresBaixa = [],
  }) {
    this.id = id;
    this.ticker = ticker;
    this.nome = nome;
    this.tipo = tipo;
    this.oQueFaz = oQueFaz;
    this.papelSociedade = papelSociedade;
    this.setor = setor;
    this.pais = pais;
    this.fundacao = fundacao;
    this.perfilRisco = perfilRisco;
    this.rendimentoMedio = rendimentoMedio;
    this.tags = tags;
    this.codigoExterno = codigoExterno;
    this.precoReferencia = precoReferencia == null ? null : Number(precoReferencia);
    this.moeda = moeda;
    // O que costuma fazer o preço subir / cair (renda fixa: render mais / menos). ADR-015
    this.fatoresAlta = fatoresAlta;
    this.fatoresBaixa = fatoresBaixa;
  }

  ehRendaFixa() {
    return this.tipo === 'cdb';
  }
}

module.exports = { AtivoEducativo, TIPOS_ATIVO, PERFIS_RISCO };

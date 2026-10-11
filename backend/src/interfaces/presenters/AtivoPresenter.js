/** Formata ativos, cotações, alertas, notificações e ideias para a API. */

function cotacaoParaHttp(c) {
  if (!c) return null;
  return {
    preco: c.preco,
    variacaoPercentual: c.variacaoPercentual,
    moeda: c.moeda,
    rendimento: c.rendimento ?? null,
    atualizadoEm: c.atualizadoEm,
    fonte: c.fonte,
    desatualizado: Boolean(c.desatualizado),
    indisponivel: Boolean(c.indisponivel),
    simulado: Boolean(c.simulado),
  };
}

const AtivoPresenter = {
  resumo({ ativo, cotacao }) {
    return {
      ticker: ativo.ticker,
      nome: ativo.nome,
      tipo: ativo.tipo,
      setor: ativo.setor,
      pais: ativo.pais,
      perfilRisco: ativo.perfilRisco,
      rendimentoMedio: ativo.rendimentoMedio,
      cotacao: cotacaoParaHttp(cotacao),
    };
  },

  detalhe({ ativo, cotacao, historico, indicadores }) {
    return {
      ...AtivoPresenter.resumo({ ativo, cotacao }),
      oQueFaz: ativo.oQueFaz,
      papelSociedade: ativo.papelSociedade,
      fundacao: ativo.fundacao,
      tags: ativo.tags,
      historico: historico
        ? { pontos: historico.pontos, desatualizado: Boolean(historico.desatualizado), fonte: historico.fonte }
        : null,
      indicadores: indicadores
        ? {
            pl: indicadores.pl,
            dividendYield: indicadores.dividendYield,
            marketCap: indicadores.marketCap,
            desatualizado: Boolean(indicadores.desatualizado),
          }
        : null,
    };
  },

  favorito({ favorito, ativo, cotacao }) {
    return {
      id: favorito.id,
      ticker: favorito.ticker,
      tipo: favorito.tipo,
      criadoEm: favorito.criadoEm,
      ativo: ativo ? AtivoPresenter.resumo({ ativo, cotacao }) : null,
    };
  },

  alerta(a) {
    return {
      id: a.id,
      ticker: a.ticker,
      gatilhoPercentual: a.gatilhoPercentual,
      direcao: a.direcao,
      ativo: a.ativo,
      criadoEm: a.criadoEm,
    };
  },

  notificacao(n) {
    return {
      id: n.id,
      ticker: n.ticker,
      variacao: n.variacao,
      direcao: n.direcao,
      preco: n.preco,
      lida: n.lida,
      criadoEm: n.criadoEm,
    };
  },

  ideia(i) {
    return {
      id: i.id,
      texto: i.textoDescrito,
      palavrasChave: i.palavrasChave,
      criadoEm: i.criadoEm,
      sugestoes: (i.sugestoes ?? []).map((s) => ({
        ticker: s.ticker,
        nome: s.nome,
        tipo: s.tipo,
        score: s.score,
        posicao: s.posicao,
        justificativa: s.justificativa,
      })),
    };
  },
};

module.exports = { AtivoPresenter };

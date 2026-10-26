/**
 * Identidade visual de cada modalidade do simulador. Fica fora do gráfico de
 * propósito: a página usa as cores nos cards sem puxar o Recharts (chunk à parte).
 * Cor E padrão de traço: a cor nunca é o único sinal (daltonismo, impressão P&B).
 */
export const ESTILO_MODALIDADE = Object.freeze({
  poupanca: { cor: '#d97706', traco: '6 4', termo: 'Poupança' },
  'cdb-100': { cor: '#2563eb', traco: '0', termo: 'CDB' },
  'cdb-110': { cor: '#820ad1', traco: '0', termo: 'CDB' },
  'tesouro-selic': { cor: '#0e9f6e', traco: '2 3', termo: 'Tesouro Selic' },
  'lci-lca': { cor: '#db2777', traco: '10 3 2 3', termo: 'LCI/LCA' },
});

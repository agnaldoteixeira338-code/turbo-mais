const crypto = require('node:crypto');

/**
 * Provedor SIMULADO e determinístico (MARKET_DATA_MODE=mock).
 *
 * Para que serve:
 *  - rodar o projeto inteiro sem chaves de API (docker compose up "funciona");
 *  - testes E2E e de carga (k6) sem depender de — nem gastar cota de — APIs reais;
 *  - fallback opcional em DEV quando a API real cai.
 *
 * Os preços oscilam de forma pseudoaleatória mas REPRODUTÍVEL (seed = ticker
 * + minuto), então dois processos/réplicas veem o mesmo número no mesmo minuto.
 * Toda cotação sai com `fonte: 'simulado'` — o front exibe um selo explícito.
 */
function pseudoAleatorio(semente) {
  const hash = crypto.createHash('sha256').update(semente).digest();
  return hash.readUInt32BE(0) / 0xffffffff; // [0, 1]
}

function volatilidadePorTipo(tipo) {
  return { cripto: 6, acao_global: 3, acao_br: 3 }[tipo] ?? 0;
}

function criarMockMarketData({ clock = () => Date.now() } = {}) {
  function variacaoDoMomento(ativo, minuto) {
    const amplitude = volatilidadePorTipo(ativo.tipo);
    return Number(((pseudoAleatorio(`${ativo.ticker}:${minuto}`) * 2 - 1) * amplitude).toFixed(2));
  }

  return {
    nome: 'simulado',

    async buscarCotacao(ativo) {
      const minuto = Math.floor(clock() / 60_000);
      const base = ativo.precoReferencia ?? 100;
      const variacaoPercentual = variacaoDoMomento(ativo, minuto);
      return {
        ticker: ativo.ticker,
        nome: ativo.nome,
        tipo: ativo.tipo,
        preco: Number((base * (1 + variacaoPercentual / 100)).toFixed(2)),
        variacaoPercentual,
        moeda: ativo.moeda ?? 'BRL',
        atualizadoEm: new Date(minuto * 60_000).toISOString(),
        fonte: 'simulado',
        simulado: true,
      };
    },

    async buscarHistorico(ativo, dias) {
      const hoje = Math.floor(clock() / 86_400_000);
      let preco = ativo.precoReferencia ?? 100;
      const pontos = [];
      for (let d = dias - 1; d >= 0; d -= 1) {
        const dia = hoje - d;
        const passo = (pseudoAleatorio(`${ativo.ticker}:dia:${dia}`) * 2 - 1) * (volatilidadePorTipo(ativo.tipo) / 2);
        preco = Math.max(0.01, preco * (1 + passo / 100));
        pontos.push({ data: new Date(dia * 86_400_000).toISOString().slice(0, 10), preco: Number(preco.toFixed(2)) });
      }
      return pontos;
    },

    async buscarIndicadores(ativo) {
      const r = pseudoAleatorio(`${ativo.ticker}:indicadores`);
      const ehAcao = ativo.tipo === 'acao_br' || ativo.tipo === 'acao_global';
      return {
        pl: ehAcao ? Number((5 + r * 30).toFixed(1)) : null,
        dividendYield: ehAcao ? Number((r * 10).toFixed(2)) : null,
        marketCap: Math.round((ativo.precoReferencia ?? 100) * 1e9 * (1 + r)),
        fonte: 'simulado',
      };
    },
  };
}

module.exports = { criarMockMarketData };

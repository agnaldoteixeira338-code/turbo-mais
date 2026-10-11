const { z } = require('zod');
const { obterJson, validarContrato, ExternalApiError } = require('./httpClient');
const { criarChamadaResiliente } = require('../resilience/circuitBreakers');

/** CoinGecko — cotações de criptomoedas em BRL. */
const schemas = {
  mercados: z
    .array(
      z
        .object({
          id: z.string(),
          symbol: z.string(),
          name: z.string(),
          current_price: z.number(),
          price_change_percentage_24h: z.number().nullish(),
          market_cap: z.number().nullish(),
          last_updated: z.string().nullish(),
        })
        .passthrough(),
    ),
  grafico: z.object({ prices: z.array(z.tuple([z.number(), z.number()])) }).passthrough(),
};

function criarCoinGeckoClient({ apiKey, baseUrl = 'https://api.coingecko.com/api/v3', logger } = {}) {
  const chamar = criarChamadaResiliente('coingecko', { logger });
  const headers = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};

  function idDe(ativo) {
    if (!ativo.codigoExterno) {
      throw new ExternalApiError(`coingecko: ${ativo.ticker} sem codigo_externo`, { dependencia: 'coingecko', status: 404, retryable: false });
    }
    return ativo.codigoExterno;
  }

  async function mercado(ativo) {
    const url = `${baseUrl}/coins/markets?vs_currency=brl&ids=${encodeURIComponent(idDe(ativo))}`;
    const dados = await chamar(() => obterJson(url, { dependencia: 'coingecko', headers }));
    const [moeda] = validarContrato(schemas.mercados, dados, 'coingecko');
    if (!moeda) throw new ExternalApiError(`coingecko: ${ativo.ticker} não encontrado`, { dependencia: 'coingecko', status: 404 });
    return moeda;
  }

  return {
    nome: 'coingecko',

    async buscarCotacao(ativo) {
      const m = await mercado(ativo);
      return {
        ticker: ativo.ticker,
        nome: ativo.nome,
        tipo: ativo.tipo,
        preco: m.current_price,
        variacaoPercentual: m.price_change_percentage_24h ?? 0,
        moeda: 'BRL',
        atualizadoEm: m.last_updated ?? new Date().toISOString(),
        fonte: 'coingecko',
      };
    },

    async buscarHistorico(ativo, dias) {
      const url = `${baseUrl}/coins/${encodeURIComponent(idDe(ativo))}/market_chart?vs_currency=brl&days=${dias}&interval=daily`;
      const dados = await chamar(() => obterJson(url, { dependencia: 'coingecko', headers }));
      const { prices } = validarContrato(schemas.grafico, dados, 'coingecko');
      // A API pode devolver mais de um ponto por dia; mantemos o último de cada dia
      const porDia = new Map(prices.map(([ms, preco]) => [new Date(ms).toISOString().slice(0, 10), preco]));
      return [...porDia.entries()].map(([data, preco]) => ({ data, preco })).slice(-dias);
    },

    async buscarIndicadores(ativo) {
      const m = await mercado(ativo);
      return { pl: null, dividendYield: null, marketCap: m.market_cap ?? null, fonte: 'coingecko' };
    },
  };
}

module.exports = { criarCoinGeckoClient, schemas };

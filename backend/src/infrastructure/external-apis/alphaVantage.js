const { z } = require('zod');
const { obterJson, validarContrato, ExternalApiError } = require('./httpClient');
const { criarChamadaResiliente } = require('../resilience/circuitBreakers');

/**
 * Alpha Vantage — ações globais.
 *
 * Peculiaridade: quando a cota estoura, a API responde HTTP 200 com
 * { "Note": ... } ou { "Information": ... }. Tratamos como 429 NÃO retentável
 * (repetir só consome mais cota) — mas que CONTA para o circuit breaker.
 */
const numeroEmTexto = z.string().regex(/^-?\d+(\.\d+)?$/);

const schemas = {
  cotacao: z.object({
    'Global Quote': z
      .object({
        '01. symbol': z.string(),
        '05. price': numeroEmTexto,
        '07. latest trading day': z.string(),
        '10. change percent': z.string().regex(/^-?\d+(\.\d+)?%$/),
      })
      .passthrough(),
  }).passthrough(),
  serie: z.object({
    'Time Series (Daily)': z.record(z.string(), z.object({ '4. close': numeroEmTexto }).passthrough()),
  }).passthrough(),
  visaoGeral: z
    .object({
      Symbol: z.string(),
      PERatio: z.string().nullish(),
      DividendYield: z.string().nullish(),
      MarketCapitalization: z.string().nullish(),
    })
    .passthrough(),
};

function numeroOuNulo(texto) {
  const n = Number(texto);
  return texto == null || texto === 'None' || texto === '-' || !Number.isFinite(n) ? null : n;
}

function criarAlphaVantageClient({ apiKey, baseUrl = 'https://www.alphavantage.co/query', logger } = {}) {
  const chamar = criarChamadaResiliente('alpha-vantage', { logger });

  async function consultar(parametros) {
    if (!apiKey) {
      throw new ExternalApiError('alpha-vantage: ALPHA_VANTAGE_API_KEY não configurada', { dependencia: 'alpha-vantage', retryable: false });
    }
    const url = `${baseUrl}?${new URLSearchParams({ ...parametros, apikey: apiKey })}`;
    const dados = await chamar(async () => {
      const resposta = await obterJson(url, { dependencia: 'alpha-vantage', timeoutMs: 6000 });
      if (resposta?.Note || resposta?.Information) {
        throw new ExternalApiError('alpha-vantage: cota de requisições excedida', { dependencia: 'alpha-vantage', status: 429, retryable: false });
      }
      return resposta;
    });
    return dados;
  }

  return {
    nome: 'alpha-vantage',

    async buscarCotacao(ativo) {
      const dados = await consultar({ function: 'GLOBAL_QUOTE', symbol: ativo.ticker });
      const q = validarContrato(schemas.cotacao, dados, 'alpha-vantage')['Global Quote'];
      return {
        ticker: ativo.ticker,
        nome: ativo.nome,
        tipo: ativo.tipo,
        preco: Number(q['05. price']),
        variacaoPercentual: Number(q['10. change percent'].replace('%', '')),
        moeda: 'USD',
        atualizadoEm: new Date(`${q['07. latest trading day']}T21:00:00Z`).toISOString(),
        fonte: 'alpha-vantage',
      };
    },

    async buscarHistorico(ativo, dias) {
      const dados = await consultar({ function: 'TIME_SERIES_DAILY', symbol: ativo.ticker, outputsize: 'compact' });
      const serie = validarContrato(schemas.serie, dados, 'alpha-vantage')['Time Series (Daily)'];
      return Object.entries(serie)
        .map(([data, ponto]) => ({ data, preco: Number(ponto['4. close']) }))
        .sort((a, b) => a.data.localeCompare(b.data))
        .slice(-dias);
    },

    async buscarIndicadores(ativo) {
      const dados = await consultar({ function: 'OVERVIEW', symbol: ativo.ticker });
      const v = validarContrato(schemas.visaoGeral, dados, 'alpha-vantage');
      const dy = numeroOuNulo(v.DividendYield);
      return {
        pl: numeroOuNulo(v.PERatio),
        dividendYield: dy == null ? null : Number((dy * 100).toFixed(2)),
        marketCap: numeroOuNulo(v.MarketCapitalization),
        fonte: 'alpha-vantage',
      };
    },
  };
}

module.exports = { criarAlphaVantageClient, schemas };

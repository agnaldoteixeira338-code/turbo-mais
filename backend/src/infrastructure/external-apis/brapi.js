const { z } = require('zod');
const { obterJson, validarContrato, ExternalApiError } = require('./httpClient');
const { criarChamadaResiliente } = require('../resilience/circuitBreakers');

/**
 * brapi.dev — cotações da B3.
 * Contrato "consumer-driven": validamos SÓ os campos que usamos; campos extras
 * são permitidos (passthrough) para não quebrar quando a API adicionar dados.
 */
const schemas = {
  cotacao: z.object({
    results: z
      .array(
        z
          .object({
            symbol: z.string(),
            shortName: z.string().nullish(),
            longName: z.string().nullish(),
            currency: z.string().nullish(),
            regularMarketPrice: z.number(),
            regularMarketChangePercent: z.number().nullish(),
            regularMarketTime: z.union([z.string(), z.number()]).nullish(),
            priceEarnings: z.number().nullish(),
            marketCap: z.number().nullish(),
            historicalDataPrice: z
              .array(z.object({ date: z.number(), close: z.number().nullish() }).passthrough())
              .nullish(),
          })
          .passthrough(),
      )
      .min(1),
  }).passthrough(),
};

function intervaloPara(dias) {
  if (dias <= 5) return '5d';
  if (dias <= 30) return '1mo';
  if (dias <= 90) return '3mo';
  if (dias <= 180) return '6mo';
  return '1y';
}

function criarBrapiClient({ token, baseUrl = 'https://brapi.dev/api', logger } = {}) {
  const chamar = criarChamadaResiliente('brapi', { logger });
  const headers = token ? { authorization: `Bearer ${token}` } : {};

  async function consultar(ticker, parametros = {}) {
    const query = new URLSearchParams(parametros).toString();
    const url = `${baseUrl}/quote/${encodeURIComponent(ticker)}${query ? `?${query}` : ''}`;
    const dados = await chamar(() => obterJson(url, { dependencia: 'brapi', headers }));
    return validarContrato(schemas.cotacao, dados, 'brapi').results[0];
  }

  /**
   * Código negociado na B3. Para ações brasileiras é o próprio ticker; para
   * empresas americanas é o BDR (ex.: AAPL → AAPL34), guardado em codigo_externo.
   * O ticker exibido no app continua sendo o original (ADR-012).
   */
  const codigoB3 = (ativo) => ativo.codigoExterno ?? ativo.ticker;

  return {
    nome: 'brapi',

    async buscarCotacao(ativo) {
      const r = await consultar(codigoB3(ativo));
      return {
        ticker: ativo.ticker,
        nome: ativo.nome,
        tipo: ativo.tipo,
        preco: r.regularMarketPrice,
        variacaoPercentual: r.regularMarketChangePercent ?? 0,
        moeda: r.currency ?? 'BRL',
        atualizadoEm: r.regularMarketTime ? new Date(r.regularMarketTime).toISOString() : new Date().toISOString(),
        fonte: 'brapi',
      };
    },

    async buscarHistorico(ativo, dias) {
      const r = await consultar(codigoB3(ativo), { range: intervaloPara(dias), interval: '1d' });
      if (!r.historicalDataPrice?.length) {
        throw new ExternalApiError('brapi: histórico vazio', { dependencia: 'brapi', retryable: false });
      }
      return r.historicalDataPrice
        .filter((p) => p.close != null)
        .map((p) => ({ data: new Date(p.date * 1000).toISOString().slice(0, 10), preco: p.close }))
        .slice(-dias);
    },

    async buscarIndicadores(ativo) {
      const r = await consultar(codigoB3(ativo));
      return { pl: r.priceEarnings ?? null, dividendYield: null, marketCap: r.marketCap ?? null, fonte: 'brapi' };
    },
  };
}

module.exports = { criarBrapiClient, schemas };

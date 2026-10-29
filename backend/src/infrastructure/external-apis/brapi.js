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

/**
 * No plano gratuito da brapi, histórico acima de 3 meses só vem para algumas
 * ações (PETR4, VALE3 e ITUB4, conferido em 2026-10-29); para as demais e para
 * os BDRs a API responde HTTP 400. Nesse caso pedimos o maior período liberado
 * e a tela informa o período real (ADR-015).
 */
const MAIOR_PERIODO_GRATUITO = '3mo';
const PERIODOS_LONGOS = new Set(['6mo', '1y']);

const montarUrl = (baseUrl, ticker, parametros) => {
  const query = new URLSearchParams(parametros).toString();
  return `${baseUrl}/quote/${encodeURIComponent(ticker)}${query ? `?${query}` : ''}`;
};

function criarBrapiClient({ token, baseUrl = 'https://brapi.dev/api', logger } = {}) {
  const chamar = criarChamadaResiliente('brapi', { logger });
  const headers = token ? { authorization: `Bearer ${token}` } : {};

  /**
   * @param {object} [opcoes.parametrosReserva] se a API recusar com HTTP 400, tenta de novo com
   *   estes parâmetros. Fica DENTRO da chamada protegida de propósito: o plano não liberar um
   *   período não é falha da brapi e não pode contar para abrir o circuit breaker das cotações.
   */
  async function consultar(ticker, parametros = {}, { parametrosReserva } = {}) {
    const dados = await chamar(async () => {
      try {
        return await obterJson(montarUrl(baseUrl, ticker, parametros), { dependencia: 'brapi', headers });
      } catch (err) {
        if (err.status !== 400 || !parametrosReserva) throw err;
        logger?.info({ ticker, pedido: parametros.range, usado: parametrosReserva.range }, 'brapi: período não liberado no plano; usando o maior disponível');
        return obterJson(montarUrl(baseUrl, ticker, parametrosReserva), { dependencia: 'brapi', headers });
      }
    });
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
      const range = intervaloPara(dias);
      const r = await consultar(codigoB3(ativo), { range, interval: '1d' }, {
        parametrosReserva: PERIODOS_LONGOS.has(range) ? { range: MAIOR_PERIODO_GRATUITO, interval: '1d' } : undefined,
      });
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

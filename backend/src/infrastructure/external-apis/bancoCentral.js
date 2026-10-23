const { z } = require('zod');
const { obterJson, validarContrato, ExternalApiError } = require('./httpClient');
const { criarChamadaResiliente } = require('../resilience/circuitBreakers');

/**
 * Banco Central do Brasil — API do SGS (Sistema Gerenciador de Séries
 * Temporais), pública e sem chave: https://dadosabertos.bcb.gov.br
 * Formato: GET /dados/serie/bcdata.sgs.{codigo}/dados?formato=json&dataInicial=dd/mm/aaaa&dataFinal=dd/mm/aaaa
 *
 * Por que intervalo de datas e não "/ultimos/N": a série da meta Selic é
 * publicada com datas FUTURAS (a meta vale até a próxima reunião do Copom),
 * então os "últimos N" pontos podem ser todos do futuro. Pedimos os últimos
 * 60 dias até hoje e, como a API não garante a ordem, ordenamos por data.
 *
 * Séries usadas (conferidas no SGS em 2026-10-23):
 *   432  Taxa Selic: meta definida pelo Copom, % a.a.
 *   4389 Taxa CDI anualizada base 252, % a.a.
 *   7811 Taxa Referencial (TR) do mês, % a.m. (usada na poupança)
 */
const SERIES = Object.freeze({ selicMeta: 432, cdi: 4389, trMensal: 7811 });

const schemas = {
  serie: z
    .array(
      z
        .object({
          data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'data no formato dd/mm/aaaa'),
          valor: z.string().regex(/^-?\d+(\.\d+)?$/, 'valor numérico'),
        })
        .passthrough(),
    )
    .min(1),
};

const JANELA_DIAS = 60;

/** "21/10/2026" → "2026-10-21" (ISO, compara como texto). */
const dataIso = (ddmmaaaa) => ddmmaaaa.split('/').reverse().join('-');
/** Date → "21/10/2026" (formato aceito pelo SGS). */
const dataSgs = (data) => data.toISOString().slice(0, 10).split('-').reverse().join('/');

function criarBancoCentralClient({ baseUrl = 'https://api.bcb.gov.br', logger, clock = () => new Date() } = {}) {
  const chamar = criarChamadaResiliente('banco-central', { logger });

  /** Último valor vigente até HOJE dentro da janela (descarta datas futuras por garantia). */
  async function ultimoValor(nome, codigo) {
    const agora = clock();
    const inicio = new Date(agora.getTime() - JANELA_DIAS * 24 * 3600 * 1000);
    const url = `${baseUrl}/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${dataSgs(inicio)}&dataFinal=${dataSgs(agora)}`;
    const dados = await chamar(() => obterJson(url, { dependencia: 'banco-central', timeoutMs: 5000 }));
    const pontos = validarContrato(schemas.serie, dados, 'banco-central');
    const hoje = agora.toISOString().slice(0, 10);
    const vigentes = pontos.map((p) => ({ data: dataIso(p.data), valor: Number(p.valor) })).filter((p) => p.data <= hoje);
    const ultimo = vigentes.sort((a, b) => a.data.localeCompare(b.data)).at(-1);
    if (!ultimo) {
      throw new ExternalApiError(`banco-central: série ${codigo} (${nome}) sem valor vigente`, { dependencia: 'banco-central', status: 502, retryable: false });
    }
    return ultimo;
  }

  return {
    nome: 'banco-central',

    /** @returns {Promise<{selicMeta, cdi, trMensal: {valor: number, data: string}}>} valores em % */
    async buscarTaxas() {
      const [selicMeta, cdi, trMensal] = await Promise.all(
        Object.entries(SERIES).map(([nome, codigo]) => ultimoValor(nome, codigo)),
      );
      return { selicMeta, cdi, trMensal };
    },
  };
}

module.exports = { criarBancoCentralClient, schemas, SERIES };

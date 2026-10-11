/**
 * Fachada única de dados de mercado (implementa a porta MarketDataGateway).
 *
 * Cadeia de resiliência para cada cotação (ADR-007):
 *
 *   cache fresco ──▶ stale (revalida em 2º plano) ──▶ origem
 *                                                     │ circuit breaker
 *                                                     │   └─ retry c/ backoff
 *                                                     ▼ falhou?
 *                                   último valor conhecido (lkg, "desatualizado")
 *                                                     ▼ não há?
 *                    [dev] simulado marcado  |  [prod] cotação "indisponível"
 *
 * Contrato: `obterCotacao` NUNCA lança. Uma API fora do ar degrada um card,
 * não a tela inteira.
 */
class MarketDataGateway {
  constructor({ provedores, simulado, cache, logger, modo = 'live', fallbackSimulado = false, ttlSegundos = 60, staleSegundos = 600, concorrencia = 5 }) {
    this.provedores = provedores;
    this.simulado = simulado;
    this.cache = cache;
    this.logger = logger;
    this.modo = modo;
    this.fallbackSimulado = fallbackSimulado;
    this.ttlSegundos = ttlSegundos;
    this.staleSegundos = staleSegundos;
    this.concorrencia = concorrencia;
  }

  #provedorPara(ativo) {
    if (this.modo === 'mock') return this.simulado;
    const provedor = this.provedores[ativo.tipo];
    if (!provedor) throw new Error(`Sem provedor de dados para o tipo ${ativo.tipo}`);
    return provedor;
  }

  async obterCotacao(ativo) {
    if (ativo.tipo === 'cdb') return this.#cotacaoRendaFixa(ativo);

    let provedor;
    try {
      provedor = this.#provedorPara(ativo);
      const { valor, stale } = await this.cache.obterComRevalidacao(
        `cotacao:${ativo.ticker}`,
        () => provedor.buscarCotacao(ativo),
        { ttlSegundos: this.ttlSegundos, staleSegundos: this.staleSegundos },
      );
      return { ...valor, desatualizado: stale, indisponivel: false };
    } catch (err) {
      this.logger?.warn({ ticker: ativo.ticker, provedor: provedor?.nome, erro: err.message }, 'cotação indisponível na origem e no cache');
      if (this.fallbackSimulado && this.modo !== 'mock') {
        const simulada = await this.simulado.buscarCotacao(ativo);
        return { ...simulada, desatualizado: true, indisponivel: false };
      }
      return {
        ticker: ativo.ticker,
        nome: ativo.nome,
        tipo: ativo.tipo,
        preco: null,
        variacaoPercentual: null,
        moeda: ativo.moeda,
        atualizadoEm: null,
        fonte: provedor?.nome ?? 'desconhecida',
        desatualizado: true,
        indisponivel: true,
      };
    }
  }

  /** Busca várias cotações com concorrência limitada (respeita cota das APIs). */
  async obterCotacoes(ativos) {
    const resultados = new Array(ativos.length);
    let proximo = 0;
    const trabalhar = async () => {
      while (proximo < ativos.length) {
        const i = proximo;
        proximo += 1;
        resultados[i] = await this.obterCotacao(ativos[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concorrencia, ativos.length) }, trabalhar));
    return resultados;
  }

  async obterHistorico(ativo, dias = 30) {
    if (ativo.tipo === 'cdb') return { pontos: [], desatualizado: false, fonte: 'referencia' };
    return this.#comFallback(ativo, `historico:${ativo.ticker}:${dias}`, (p) => p.buscarHistorico(ativo, dias), {
      ttlSegundos: 3600,
      staleSegundos: 6 * 3600,
      embrulhar: (pontos, stale, fonte) => ({ pontos, desatualizado: stale, fonte }),
    });
  }

  async obterIndicadores(ativo) {
    if (ativo.tipo === 'cdb') return null;
    return this.#comFallback(ativo, `indicadores:${ativo.ticker}`, (p) => p.buscarIndicadores(ativo), {
      ttlSegundos: 24 * 3600,
      staleSegundos: 48 * 3600,
      embrulhar: (indicadores, stale) => ({ ...indicadores, desatualizado: stale }),
    });
  }

  async #comFallback(ativo, chave, buscar, { ttlSegundos, staleSegundos, embrulhar }) {
    const provedor = this.#provedorPara(ativo);
    try {
      const { valor, stale } = await this.cache.obterComRevalidacao(chave, () => buscar(provedor), { ttlSegundos, staleSegundos });
      return embrulhar(valor, stale, provedor.nome);
    } catch (err) {
      if (this.fallbackSimulado && this.modo !== 'mock') {
        return embrulhar(await buscar(this.simulado), true, 'simulado');
      }
      throw err;
    }
  }

  #cotacaoRendaFixa(ativo) {
    return {
      ticker: ativo.ticker,
      nome: ativo.nome,
      tipo: ativo.tipo,
      preco: null,
      variacaoPercentual: null,
      rendimento: ativo.rendimentoMedio,
      moeda: 'BRL',
      atualizadoEm: null,
      fonte: 'referencia',
      desatualizado: false,
      indisponivel: false,
    };
  }
}

module.exports = { MarketDataGateway };

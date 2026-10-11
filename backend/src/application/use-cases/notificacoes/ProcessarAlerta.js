const { Notificacao } = require('../../../domain/entities/Notificacao');

/**
 * Coração do priceWatcher: roda a cada 60s (job repetível do BullMQ).
 *
 *   1. descobre quais tickers têm alertas ativos (índice parcial)
 *   2. busca as cotações (cache SWR + circuit breaker por trás)
 *   3. publica a cotação nas rooms do WebSocket ("ticker:PETR4")
 *   4. avalia cada alerta (regra no domínio: Alerta.avaliar)
 *   5. grava a notificação de forma IDEMPOTENTE e só notifica se ela é nova
 *
 * Política de dados ruins: cotação desatualizada (fallback) ou indisponível
 * NÃO dispara alerta. Um alerta falso de "PETR4 caiu 5%" baseado em dado
 * velho é pior do que um alerta atrasado — ver ADR-007.
 */
class ProcessarAlerta {
  constructor({ alertaRepository, notificacaoRepository, ativoRepository, marketData, notificador, logger, janelaMinutos, clock = () => new Date() }) {
    this.alertaRepository = alertaRepository;
    this.notificacaoRepository = notificacaoRepository;
    this.ativoRepository = ativoRepository;
    this.marketData = marketData;
    this.notificador = notificador;
    this.logger = logger;
    this.janelaMinutos = janelaMinutos;
    this.clock = clock;
  }

  async execute() {
    const resumo = { tickers: 0, alertasAvaliados: 0, disparados: 0, duplicadosIgnorados: 0, ignoradosPorDadoRuim: 0 };
    const tickers = await this.alertaRepository.listarTickersComAlertasAtivos();
    if (tickers.length === 0) return resumo;

    const ativos = await this.ativoRepository.buscarPorTickers(tickers);
    const cotacoes = await this.marketData.obterCotacoes(ativos);
    const momento = this.clock();
    resumo.tickers = cotacoes.length;

    for (const cotacao of cotacoes) {
      if (cotacao.indisponivel || cotacao.desatualizado || !Number.isFinite(cotacao.variacaoPercentual)) {
        resumo.ignoradosPorDadoRuim += 1;
        continue;
      }
      this.#emitirComSeguranca(() => this.notificador.emitirCotacao(cotacao));

      const alertas = await this.alertaRepository.listarAtivosPorTicker(cotacao.ticker);
      for (const alerta of alertas) {
        resumo.alertasAvaliados += 1;
        const direcao = alerta.avaliar(cotacao.variacaoPercentual);
        if (!direcao) continue;

        const notificacao = await this.notificacaoRepository.criarSeNaoExistir({
          usuarioId: alerta.usuarioId,
          alertaId: alerta.id,
          ticker: cotacao.ticker,
          variacao: Number(cotacao.variacaoPercentual.toFixed(2)),
          direcao,
          preco: cotacao.preco,
          hashIdempotencia: Notificacao.gerarHashIdempotencia({
            alertaId: alerta.id,
            direcao,
            momento,
            janelaMinutos: this.janelaMinutos,
          }),
        });

        if (!notificacao) {
          resumo.duplicadosIgnorados += 1;
          continue;
        }
        resumo.disparados += 1;
        this.#emitirComSeguranca(() => this.notificador.notificarUsuario(alerta.usuarioId, notificacao));
      }
    }

    this.logger?.info({ resumo }, 'priceWatcher: ciclo concluído');
    return resumo;
  }

  // O tempo real é best-effort: a notificação já está no banco e o front a
  // busca por polling se o socket falhar. Erro de emissão nunca falha o job.
  #emitirComSeguranca(fn) {
    try {
      fn();
    } catch (err) {
      this.logger?.warn({ err }, 'falha ao emitir evento em tempo real');
    }
  }
}

module.exports = { ProcessarAlerta };

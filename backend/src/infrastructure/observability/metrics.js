const client = require('prom-client');
const { estadoDosCircuitos } = require('../resilience/circuitBreakers');

const VALOR_ESTADO = { fechado: 0, 'meio-aberto': 1, aberto: 2 };

/**
 * Métricas no formato Prometheus (GET /metrics).
 *
 * Cardinalidade sob controle: o label `rota` usa o PADRÃO da rota
 * (/api/v1/alertas/:id), nunca a URL real — senão cada UUID viraria uma
 * série temporal nova e o Prometheus explodiria.
 */
function criarMetricas({ filas } = {}) {
  const registry = new client.Registry();
  registry.setDefaultLabels({ app: 'turbo-mais' });
  client.collectDefaultMetrics({ register: registry, prefix: 'turbo_mais_' });

  const httpDuracao = new client.Histogram({
    name: 'turbo_mais_http_request_duration_seconds',
    help: 'Tempo de resposta HTTP por rota',
    labelNames: ['metodo', 'rota', 'status'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const httpTotal = new client.Counter({
    name: 'turbo_mais_http_requests_total',
    help: 'Total de requisições HTTP (throughput); taxa de erro = status 5xx / total',
    labelNames: ['metodo', 'rota', 'status'],
    registers: [registry],
  });

  const errosAplicacao = new client.Counter({
    name: 'turbo_mais_app_errors_total',
    help: 'Erros tratados pelo errorHandler, por código',
    labelNames: ['codigo', 'status'],
    registers: [registry],
  });

  const cacheResultados = new client.Counter({
    name: 'turbo_mais_cache_results_total',
    help: 'Resultado das leituras de cache (hit, stale, miss, ultimo-conhecido)',
    labelNames: ['resultado'],
    registers: [registry],
  });

  const websocketConexoes = new client.Gauge({
    name: 'turbo_mais_websocket_connections',
    help: 'Conexões WebSocket abertas nesta réplica',
    registers: [registry],
  });

  const notificacoesDisparadas = new client.Counter({
    name: 'turbo_mais_notifications_sent_total',
    help: 'Notificações de alerta criadas (já deduplicadas)',
    registers: [registry],
  });

  const priceWatcherDuracao = new client.Histogram({
    name: 'turbo_mais_price_watcher_duration_seconds',
    help: 'Duração de cada ciclo do priceWatcher',
    buckets: [0.5, 1, 2, 5, 10, 20, 40],
    registers: [registry],
  });

  new client.Gauge({
    name: 'turbo_mais_circuit_breaker_state',
    help: 'Estado do circuit breaker (0=fechado, 1=meio-aberto, 2=aberto)',
    labelNames: ['circuito'],
    registers: [registry],
    collect() {
      this.reset();
      for (const { nome, estado } of estadoDosCircuitos()) this.set({ circuito: nome }, VALOR_ESTADO[estado]);
    },
  });

  if (filas) {
    new client.Gauge({
      name: 'turbo_mais_queue_jobs',
      help: 'Jobs por fila e estado (inclui a DLQ)',
      labelNames: ['fila', 'estado'],
      registers: [registry],
      async collect() {
        this.reset();
        await Promise.all(
          Object.values(filas).map(async (fila) => {
            try {
              const contagens = await fila.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
              for (const [estado, n] of Object.entries(contagens)) this.set({ fila: fila.name, estado }, n);
            } catch {
              // Redis indisponível: a métrica simplesmente não é atualizada neste scrape
            }
          }),
        );
      },
    });
  }

  return {
    registry,
    httpDuracao,
    httpTotal,
    errosAplicacao,
    cacheResultados,
    websocketConexoes,
    notificacoesDisparadas,
    priceWatcherDuracao,
  };
}

module.exports = { criarMetricas };

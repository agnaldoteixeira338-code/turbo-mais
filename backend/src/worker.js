const http = require('node:http');
const { carregarEnv } = require('./config/env');
const { criarLogger } = require('./infrastructure/logger/pinoLogger');
const { criarContainer } = require('./config/container');
const { criarEmailWorker } = require('./infrastructure/queue/workers/emailWorker');
const { criarPriceWatcherWorker, agendarPriceWatcher } = require('./infrastructure/queue/workers/priceWatcherWorker');
const { criarDemoResetWorker, agendarRestauracaoDemo } = require('./infrastructure/queue/workers/demoResetWorker');

/**
 * Processo de WORKERS, separado da API (ADR-004):
 *  - emailWorker: envio de e-mails (reset de senha, códigos 2FA)
 *  - priceWatcherWorker: ciclo de 60s que avalia alertas e gera notificações
 *  - demoResetWorker: restaura a conta demo ao estado de exemplo (ADR-013)
 *
 * Escala de forma independente: picos de e-mail não afetam a latência da API,
 * e a API pode ter 5 réplicas enquanto o worker tem 1.
 *
 * `iniciarWorkers` também é usado pelo server.js quando RUN_WORKERS_IN_PROCESS
 * está ligado (plano gratuito sem background worker — trade-off na ADR-009).
 */
async function iniciarWorkers({ env, logger, container }) {
  const { bullConnection, filas, emailService, useCases, metrics } = container;
  const workers = [
    criarEmailWorker({ connection: bullConnection, emailService, dlq: filas.dlq, logger }),
    criarPriceWatcherWorker({ connection: bullConnection, processarAlerta: useCases.processarAlerta, dlq: filas.dlq, logger, metrics }),
    criarDemoResetWorker({ connection: bullConnection, restaurarContaDemo: useCases.restaurarContaDemo, dlq: filas.dlq, logger }),
  ];
  await agendarPriceWatcher(filas.priceWatcher, env.PRICE_WATCH_INTERVAL_MS);
  const restauracaoDemo = await agendarRestauracaoDemo(filas.demoReset, env.DEMO_RESET_INTERVAL_MINUTES * 60_000);
  logger.info(
    { intervaloMs: env.PRICE_WATCH_INTERVAL_MS, restauracaoDemoMinutos: restauracaoDemo ? env.DEMO_RESET_INTERVAL_MINUTES : 'desligada' },
    '⚙️  workers iniciados',
  );
  // close() espera o job atual terminar: nenhum e-mail fica "pela metade"
  const encerrar = () => Promise.allSettled(workers.map((w) => w.close()));
  return { workers, encerrar };
}

async function iniciarProcessoWorker() {
  const env = carregarEnv();
  const logger = criarLogger({ level: env.LOG_LEVEL, nome: 'turbo-mais-worker' });
  const container = criarContainer({ env, logger });
  const { workers, encerrar: encerrarWorkers } = await iniciarWorkers({ env, logger, container });

  // Mini HTTP só para healthcheck (Docker/Render) e métricas do worker
  const saude = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      const rodando = workers.every((w) => w.isRunning());
      res.writeHead(rodando ? 200 : 503, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ status: rodando ? 'ok' : 'falha', workers: workers.map((w) => ({ fila: w.name, rodando: w.isRunning() })) }));
    }
    if (req.url === '/metrics') {
      res.writeHead(200, { 'content-type': container.metrics.registry.contentType });
      return res.end(await container.metrics.registry.metrics());
    }
    return res.writeHead(404).end();
  });
  saude.listen(env.WORKER_HEALTH_PORT);

  async function encerrar(sinal) {
    logger.info({ sinal }, 'encerrando workers (aguardando jobs em andamento)...');
    await encerrarWorkers();
    saude.close();
    await container.encerrar();
    process.exit(0);
  }
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
}

if (require.main === module) {
  iniciarProcessoWorker().catch((err) => {
    console.error('Falha ao iniciar os workers:', err);
    process.exit(1);
  });
}

module.exports = { iniciarWorkers };

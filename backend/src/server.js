const http = require('node:http');
const { carregarEnv } = require('./config/env');
const { criarLogger } = require('./infrastructure/logger/pinoLogger');
const { criarContainer } = require('./config/container');
const { criarApp } = require('./interfaces/http/app');
const { criarSocketServer } = require('./infrastructure/websocket/socketServer');
const { criarConexaoRedis } = require('./infrastructure/cache/redisClient');

/**
 * Processo da API HTTP + WebSocket. STATELESS (ADR-009): nenhum estado de
 * sessão em memória — tudo em Postgres/Redis — então N réplicas atrás de um
 * load balancer funcionam sem sticky session (o Socket.IO usa o redis-adapter).
 */
async function iniciar() {
  const env = carregarEnv();
  const logger = criarLogger({ level: env.LOG_LEVEL, nome: 'turbo-mais-api' });
  const container = criarContainer({ env, logger });
  const app = criarApp(container);

  const servidor = http.createServer(app);
  // Atrás do proxy do Render: keep-alive maior que o do LB evita 502 intermitente
  servidor.keepAliveTimeout = 65_000;
  servidor.headersTimeout = 66_000;
  servidor.requestTimeout = 30_000;

  const pubClient = criarConexaoRedis(env.REDIS_URL, { papel: 'socket-pub', logger });
  const subClient = pubClient.duplicate();
  const io = criarSocketServer(servidor, {
    tokenService: container.tokenService,
    corsOrigins: env.CORS_ORIGINS,
    pubClient,
    subClient,
    logger,
    metrics: container.metrics,
  });

  // Plano gratuito sem background worker: workers no mesmo processo (ADR-009)
  const workersEmProcesso = env.RUN_WORKERS_IN_PROCESS
    ? await require('./worker').iniciarWorkers({ env, logger, container })
    : null;

  servidor.listen(env.PORT, () => logger.info({ porta: env.PORT, ambiente: env.NODE_ENV, mercado: env.MARKET_DATA_MODE }, '🚀 Turbo Mais API no ar'));

  /**
   * Graceful shutdown (deploy sem derrubar requisições):
   *  1. /ready passa a responder 503 → o LB para de mandar tráfego
   *  2. para de aceitar conexões e espera as em andamento terminarem
   *  3. fecha WebSockets (clientes reconectam em outra réplica)
   *  4. fecha filas, pool e Redis
   *  Prazo máximo de 15s; depois disso, saída forçada.
   */
  let encerrando = false;
  async function encerrar(sinal) {
    if (encerrando) return;
    encerrando = true;
    container.estado.encerrando = true;
    logger.info({ sinal }, 'encerrando com elegância...');
    const forcar = setTimeout(() => {
      logger.error('shutdown excedeu 15s — saída forçada');
      process.exit(1);
    }, 15_000);
    forcar.unref();

    await new Promise((resolve) => io.close(() => resolve()));
    await new Promise((resolve) => servidor.close(() => resolve()));
    await workersEmProcesso?.encerrar();
    await container.encerrar();
    await Promise.allSettled([pubClient.quit(), subClient.quit()]);
    logger.info('encerrado');
    process.exit(0);
  }

  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
  process.on('unhandledRejection', (motivo) => logger.error({ err: motivo }, 'promise rejeitada sem tratamento'));
  process.on('uncaughtException', (err) => {
    // Estado do processo é desconhecido após uma exceção não capturada:
    // logamos e saímos; o orquestrador sobe uma réplica limpa.
    logger.fatal({ err }, 'exceção não capturada');
    process.exit(1);
  });
}

iniciar().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});

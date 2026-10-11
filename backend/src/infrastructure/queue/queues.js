const { Queue } = require('bullmq');
const { obterContexto } = require('../../shared/requestContext');

const NOMES_FILAS = Object.freeze({
  EMAIL: 'email',
  PRICE_WATCHER: 'price-watcher',
  DLQ: 'dead-letter',
});

/**
 * Política padrão de jobs (ADR-004):
 *  - 3 tentativas com backoff exponencial (2s, 4s, 8s)
 *  - concluídos somem após 1h (não acumulam memória no Redis)
 *  - falhos ficam 7 dias para inspeção — e são copiados para a DLQ
 */
const OPCOES_PADRAO_JOB = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
});

function criarFilas(connection) {
  return {
    email: new Queue(NOMES_FILAS.EMAIL, { connection, defaultJobOptions: OPCOES_PADRAO_JOB }),
    priceWatcher: new Queue(NOMES_FILAS.PRICE_WATCHER, {
      connection,
      // Ciclo de 60s: se falhar, o próximo ciclo já corrige. Retry longo só
      // atrasaria e sobreporia ciclos.
      defaultJobOptions: { attempts: 1, removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } },
    }),
    dlq: new Queue(NOMES_FILAS.DLQ, {
      connection,
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    }),
  };
}

/** Implementação da porta EmailQueue. */
class BullEmailQueue {
  constructor(queue) {
    this.queue = queue;
  }

  /**
   * `chaveIdempotencia` vira o jobId: o BullMQ ignora um add com jobId que
   * já existe, então um retry HTTP do cliente não gera e-mail duplicado.
   */
  async enfileirar({ tipo, para, dados, chaveIdempotencia }) {
    const { requestId } = obterContexto();
    await this.queue.add(tipo, { tipo, para, dados, requestId }, { jobId: chaveIdempotencia });
  }
}

/**
 * Dead Letter Queue: quando um job esgota as tentativas, copiamos o essencial
 * para a fila `dead-letter` (sem os dados sensíveis do payload). Lá ele fica
 * visível para reprocessamento manual e alimenta a métrica/alerta de DLQ.
 */
function encaminharFalhasParaDLQ(worker, dlq, logger) {
  worker.on('failed', async (job, erro) => {
    if (!job) return;
    const tentativasMax = job.opts.attempts ?? 1;
    if (job.attemptsMade < tentativasMax) return;
    try {
      await dlq.add(
        `${job.queueName}.${job.name}`,
        {
          filaOrigem: job.queueName,
          jobIdOrigem: job.id,
          nome: job.name,
          erro: erro?.message,
          tentativas: job.attemptsMade,
          falhouEm: new Date().toISOString(),
          requestId: job.data?.requestId,
        },
        { jobId: `dlq-${job.queueName}-${job.id}` },
      );
      logger.error({ fila: job.queueName, jobId: job.id, erro: erro?.message }, 'job movido para a DLQ');
    } catch (err) {
      logger.error({ err, jobId: job.id }, 'falha ao mover job para a DLQ');
    }
  });
}

module.exports = { NOMES_FILAS, OPCOES_PADRAO_JOB, criarFilas, BullEmailQueue, encaminharFalhasParaDLQ };

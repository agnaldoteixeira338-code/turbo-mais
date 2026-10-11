const { Worker } = require('bullmq');
const { NOMES_FILAS, encaminharFalhasParaDLQ } = require('../queues');
const { executarComContexto } = require('../../../shared/requestContext');

const ID_AGENDADOR = 'verificar-precos';

/**
 * Agenda o job repetível. `upsertJobScheduler` é IDEMPOTENTE: com 3 réplicas
 * de worker subindo ao mesmo tempo, continua existindo UM agendamento — e o
 * BullMQ garante que cada execução é processada por um único worker.
 * (Com node-cron, cada réplica dispararia o seu — ver ADR-004.)
 */
async function agendarPriceWatcher(queue, intervaloMs) {
  await queue.upsertJobScheduler(ID_AGENDADOR, { every: intervaloMs }, { name: ID_AGENDADOR });
}

function criarPriceWatcherWorker({ connection, processarAlerta, dlq, logger, metrics }) {
  const worker = new Worker(
    NOMES_FILAS.PRICE_WATCHER,
    (job) =>
      executarComContexto({ jobId: job.id }, async () => {
        const fim = metrics?.priceWatcherDuracao?.startTimer();
        const resumo = await processarAlerta.execute();
        fim?.();
        metrics?.notificacoesDisparadas?.inc(resumo.disparados);
        return resumo;
      }),
    // concurrency 1: ciclos não se sobrepõem dentro do worker
    { connection, concurrency: 1, lockDuration: 60_000 },
  );

  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'ciclo do priceWatcher falhou'));
  worker.on('error', (err) => logger.error({ err }, 'erro no worker do priceWatcher'));
  encaminharFalhasParaDLQ(worker, dlq, logger);
  return worker;
}

module.exports = { criarPriceWatcherWorker, agendarPriceWatcher, ID_AGENDADOR };

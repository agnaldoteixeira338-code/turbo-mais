const { Worker } = require('bullmq');
const { NOMES_FILAS, encaminharFalhasParaDLQ } = require('../queues');
const { executarComContexto } = require('../../../shared/requestContext');

const ID_AGENDADOR = 'restaurar-conta-demo';

/**
 * Agenda a restauração periódica da conta demo (ADR-013). Mesmo padrão do
 * priceWatcher: `upsertJobScheduler` é idempotente, então N réplicas (ou a API
 * com RUN_WORKERS_IN_PROCESS) registrando ao subir continuam sendo UM agendamento.
 *
 * Intervalo 0 = desligado: removemos o agendamento que uma versão anterior
 * possa ter deixado no Redis, senão ele continuaria disparando.
 */
async function agendarRestauracaoDemo(queue, intervaloMs) {
  if (!intervaloMs) {
    await queue.removeJobScheduler(ID_AGENDADOR);
    return false;
  }
  await queue.upsertJobScheduler(ID_AGENDADOR, { every: intervaloMs }, { name: ID_AGENDADOR });
  return true;
}

function criarDemoResetWorker({ connection, restaurarContaDemo, dlq, logger }) {
  const worker = new Worker(
    NOMES_FILAS.DEMO_RESET,
    (job) => executarComContexto({ jobId: job.id }, () => restaurarContaDemo.execute()),
    // concurrency 1: duas restaurações nunca rodam ao mesmo tempo neste worker
    { connection, concurrency: 1, lockDuration: 60_000 },
  );

  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'restauração da conta demo falhou'));
  worker.on('error', (err) => logger.error({ err }, 'erro no worker de restauração da conta demo'));
  encaminharFalhasParaDLQ(worker, dlq, logger);
  return worker;
}

module.exports = { criarDemoResetWorker, agendarRestauracaoDemo, ID_AGENDADOR };

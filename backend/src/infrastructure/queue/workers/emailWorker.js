const { Worker } = require('bullmq');
const { NOMES_FILAS, encaminharFalhasParaDLQ } = require('../queues');
const { executarComContexto } = require('../../../shared/requestContext');

/**
 * Worker de e-mail. Roda em PROCESSO SEPARADO da API (src/worker.js):
 * picos de envio não competem por CPU/event loop com requisições HTTP.
 *
 * limiter: no máximo 10 e-mails/s — respeita o rate limit do Resend e evita
 * que um bug de enfileiramento vire uma rajada de spam.
 */
function criarEmailWorker({ connection, emailService, dlq, logger }) {
  const worker = new Worker(
    NOMES_FILAS.EMAIL,
    (job) =>
      executarComContexto({ requestId: job.data.requestId, jobId: job.id }, async () => {
        await emailService.enviar(job.data);
        return { enviadoEm: new Date().toISOString() };
      }),
    { connection, concurrency: 5, limiter: { max: 10, duration: 1000 } },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id, tipo: job.name }, 'e-mail enviado'));
  worker.on('failed', (job, err) =>
    logger.warn({ jobId: job?.id, tentativa: job?.attemptsMade, erro: err.message }, 'falha ao enviar e-mail'),
  );
  worker.on('error', (err) => logger.error({ err }, 'erro no worker de e-mail'));
  encaminharFalhasParaDLQ(worker, dlq, logger);
  return worker;
}

module.exports = { criarEmailWorker };

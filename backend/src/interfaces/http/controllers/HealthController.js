const { estadoDosCircuitos } = require('../../../infrastructure/resilience/circuitBreakers');
const { comTimeout } = require('../../../shared/utils');

/**
 * Três sondas com papéis DIFERENTES (erro comum é usar uma só para tudo):
 *
 *  /live   → o processo está vivo? Não checa dependências. Se checasse, uma
 *            queda do Redis faria o orquestrador REINICIAR todas as réplicas
 *            em loop — sem resolver nada (falha em cascata).
 *  /ready  → posso receber tráfego? Postgres + Redis OK e não estou em
 *            shutdown. Usado pelo deploy (Render) e pelo rollback automático.
 *  /health → diagnóstico completo para humanos/monitoria: dependências,
 *            filas, circuit breakers. "degradado" ainda responde 200.
 */
class HealthController {
  constructor({ pool, redis, filas, estado, versao }) {
    this.pool = pool;
    this.redis = redis;
    this.filas = filas;
    this.estado = estado;
    this.versao = versao;
  }

  async #checar(nome, fn) {
    const inicio = Date.now();
    try {
      const detalhes = await comTimeout(fn(), 2000, `${nome}: timeout`);
      return { nome, status: 'ok', latenciaMs: Date.now() - inicio, ...(detalhes ? { detalhes } : {}) };
    } catch (err) {
      return { nome, status: 'falha', latenciaMs: Date.now() - inicio, erro: err.message };
    }
  }

  #postgres = () => this.#checar('postgres', () => this.pool.query('SELECT 1').then(() => null));

  #redis = () => this.#checar('redis', () => this.redis.ping().then(() => null));

  #filas = () =>
    this.#checar('bullmq', async () => {
      const entradas = await Promise.all(
        Object.values(this.filas).map(async (f) => [f.name, await f.getJobCounts('waiting', 'active', 'failed', 'delayed')]),
      );
      return Object.fromEntries(entradas);
    });

  live = (_req, res) => res.json({ status: 'ok', uptimeSegundos: Math.round(process.uptime()) });

  ready = async (_req, res) => {
    if (this.estado.encerrando) return res.status(503).json({ status: 'encerrando' });
    const [pg, redis] = await Promise.all([this.#postgres(), this.#redis()]);
    const pronto = pg.status === 'ok' && redis.status === 'ok';
    return res.status(pronto ? 200 : 503).json({ status: pronto ? 'pronto' : 'indisponivel', dependencias: [pg, redis] });
  };

  health = async (_req, res) => {
    const [pg, redis, filas] = await Promise.all([this.#postgres(), this.#redis(), this.#filas()]);
    const circuitos = estadoDosCircuitos();
    const apisExternas = circuitos.map((c) => ({ nome: c.nome, status: c.estado === 'fechado' ? 'ok' : 'degradado', circuito: c.estado }));

    const criticoOk = pg.status === 'ok' && redis.status === 'ok';
    const degradado = filas.status !== 'ok' || apisExternas.some((a) => a.status !== 'ok');
    const status = !criticoOk ? 'falha' : degradado ? 'degradado' : 'ok';

    return res.status(criticoOk ? 200 : 503).json({
      status,
      versao: this.versao,
      uptimeSegundos: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencias: { postgres: pg, redis, filas, apisExternas },
    });
  };
}

module.exports = { HealthController };

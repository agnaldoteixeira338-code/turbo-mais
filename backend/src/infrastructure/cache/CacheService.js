/**
 * Cache com STALE-WHILE-REVALIDATE + "último valor conhecido" (ADR-003).
 *
 * Linha do tempo de uma chave com ttl=60s e stale=600s:
 *
 *   0s ────────── 60s ─────────────────── 660s ───────────── 7 dias
 *   │   FRESCO    │  STALE: devolve na hora │   EXPIRADO       │
 *   │ devolve já  │  e revalida em 2º plano │ busca na origem; │
 *   │             │  (1 revalidação por vez,│ se falhar, usa o │
 *   │             │   via lock NX)          │ "lkg:" (último   │
 *   │             │                         │ valor conhecido) │
 *
 * Garantias:
 *  - Latência: com dado no cache, o usuário NUNCA espera a API externa.
 *  - Anti-stampede: (a) single-flight em memória (N requisições simultâneas
 *    no mesmo processo = 1 busca); (b) lock Redis NX entre réplicas.
 *  - Redis fora do ar: o cache vira pass-through (busca direto na origem)
 *    em vez de derrubar a API — Redis é otimização, não dependência crítica
 *    para leitura de cotações.
 */
class CacheService {
  constructor({ redis, logger, metrics, clock = () => Date.now() }) {
    this.redis = redis;
    this.logger = logger;
    this.metrics = metrics;
    this.clock = clock;
    this.emVoo = new Map();
  }

  async obterJson(chave) {
    try {
      const bruto = await this.redis.get(chave);
      return bruto ? JSON.parse(bruto) : null;
    } catch (err) {
      this.logger?.warn({ err, chave }, 'cache indisponível (get)');
      return null;
    }
  }

  async definirJson(chave, valor, ttlSegundos) {
    try {
      await this.redis.set(chave, JSON.stringify(valor), 'EX', ttlSegundos);
    } catch (err) {
      this.logger?.warn({ err, chave }, 'cache indisponível (set)');
    }
  }

  async remover(chave) {
    try {
      await this.redis.del(chave);
    } catch (err) {
      this.logger?.warn({ err, chave }, 'cache indisponível (del)');
    }
  }

  /**
   * @template T
   * @param {string} chave
   * @param {() => Promise<T>} buscar função que vai à origem
   * @param {{ttlSegundos: number, staleSegundos: number, lkgSegundos?: number}} opcoes
   * @returns {Promise<{valor: T, stale: boolean, origem: 'cache'|'origem'|'stale'|'ultimo-conhecido'}>}
   */
  async obterComRevalidacao(chave, buscar, { ttlSegundos, staleSegundos, lkgSegundos = 7 * 24 * 3600 }) {
    const entrada = await this.obterJson(chave);
    const agora = this.clock();

    if (entrada) {
      const idadeSegundos = (agora - entrada.t) / 1000;
      if (idadeSegundos < ttlSegundos) {
        this.#contar('hit');
        return { valor: entrada.v, stale: false, origem: 'cache' };
      }
      this.#contar('stale');
      this.#revalidarEmSegundoPlano(chave, buscar, { ttlSegundos, staleSegundos, lkgSegundos });
      return { valor: entrada.v, stale: true, origem: 'stale' };
    }

    this.#contar('miss');
    try {
      const valor = await this.#buscarUmaVez(chave, buscar, { ttlSegundos, staleSegundos, lkgSegundos });
      return { valor, stale: false, origem: 'origem' };
    } catch (err) {
      const ultimo = await this.obterJson(`lkg:${chave}`);
      if (ultimo) {
        this.#contar('ultimo-conhecido');
        this.logger?.warn({ chave, erro: err.message }, 'origem falhou; servindo último valor conhecido');
        return { valor: ultimo.v, stale: true, origem: 'ultimo-conhecido' };
      }
      throw err;
    }
  }

  /** Single-flight: requisições concorrentes pela mesma chave compartilham a mesma Promise. */
  #buscarUmaVez(chave, buscar, opcoes) {
    if (this.emVoo.has(chave)) return this.emVoo.get(chave);
    const promessa = this.#buscarEArmazenar(chave, buscar, opcoes).finally(() => this.emVoo.delete(chave));
    this.emVoo.set(chave, promessa);
    return promessa;
  }

  async #buscarEArmazenar(chave, buscar, { ttlSegundos, staleSegundos, lkgSegundos }) {
    const valor = await buscar();
    const entrada = { v: valor, t: this.clock() };
    try {
      await this.redis
        .multi()
        .set(chave, JSON.stringify(entrada), 'EX', ttlSegundos + staleSegundos)
        .set(`lkg:${chave}`, JSON.stringify(entrada), 'EX', lkgSegundos)
        .exec();
    } catch (err) {
      this.logger?.warn({ err, chave }, 'cache indisponível (gravação após busca)');
    }
    return valor;
  }

  async #revalidarEmSegundoPlano(chave, buscar, opcoes) {
    let travou = false;
    try {
      // Lock entre réplicas: só uma revalida; as outras seguem servindo stale
      travou = (await this.redis.set(`lock:${chave}`, '1', 'EX', 30, 'NX')) === 'OK';
    } catch {
      return;
    }
    if (!travou) return;

    this.#buscarUmaVez(chave, buscar, opcoes)
      .catch((err) => this.logger?.warn({ chave, erro: err.message }, 'revalidação em segundo plano falhou; mantendo valor stale'))
      .finally(() => this.redis.del(`lock:${chave}`).catch(() => {}));
  }

  #contar(resultado) {
    this.metrics?.cacheResultados?.inc({ resultado });
  }
}

module.exports = { CacheService };

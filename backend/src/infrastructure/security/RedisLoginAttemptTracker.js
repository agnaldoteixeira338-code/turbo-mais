const { sha256 } = require('../../shared/utils');

/**
 * Contador de falhas de login por conta, no Redis (compartilhado entre réplicas).
 *
 * - Chave = sha256(e-mail): o Redis não guarda e-mails em claro.
 * - Janela fixa a partir da 1ª falha; ao atingir o limite, a conta fica
 *   bloqueada até a chave expirar (15 min).
 * - Complementa o rate limit por IP: este protege contra ataque DISTRIBUÍDO
 *   (muitos IPs, uma conta); o rate limit protege contra um IP, muitas contas.
 *
 * Trade-off: um atacante pode bloquear a conta de alguém de propósito
 * (DoS de conta). Aceito porque o bloqueio é temporário e o reset de senha
 * continua funcionando — documentado no THREAT-MODEL.md.
 */
class RedisLoginAttemptTracker {
  constructor({ redis, maxTentativas = 5, janelaSegundos = 900, logger }) {
    this.redis = redis;
    this.maxTentativas = maxTentativas;
    this.janelaSegundos = janelaSegundos;
    this.logger = logger;
  }

  #chave(identificador) {
    return `login:falhas:${sha256(identificador)}`;
  }

  async verificarBloqueio(identificador) {
    try {
      const chave = this.#chave(identificador);
      const [tentativas, ttl] = await Promise.all([this.redis.get(chave), this.redis.ttl(chave)]);
      const bloqueado = Number(tentativas ?? 0) >= this.maxTentativas;
      return { bloqueado, retryAfterSeconds: bloqueado ? Math.max(ttl, 1) : 0 };
    } catch (err) {
      // Fail-open consciente: Redis fora do ar não impede login legítimo.
      // O rate limit por IP continua valendo (também fail-open, ver rateLimiter).
      this.logger?.warn({ err }, 'login tracker indisponível — seguindo sem bloqueio');
      return { bloqueado: false, retryAfterSeconds: 0 };
    }
  }

  async registrarFalha(identificador) {
    try {
      const chave = this.#chave(identificador);
      const tentativas = await this.redis.incr(chave);
      // Só a 1ª falha define o prazo: a janela não "desliza" a cada tentativa
      if (tentativas === 1) await this.redis.expire(chave, this.janelaSegundos);
      const bloqueado = tentativas >= this.maxTentativas;
      const ttl = bloqueado ? await this.redis.ttl(chave) : 0;
      return { tentativas, bloqueado, retryAfterSeconds: Math.max(ttl, 0) };
    } catch (err) {
      this.logger?.warn({ err }, 'login tracker indisponível — falha não contabilizada');
      return { tentativas: 0, bloqueado: false, retryAfterSeconds: 0 };
    }
  }

  async limpar(identificador) {
    try {
      await this.redis.del(this.#chave(identificador));
    } catch (err) {
      this.logger?.warn({ err }, 'login tracker indisponível (limpar)');
    }
  }
}

module.exports = { RedisLoginAttemptTracker };

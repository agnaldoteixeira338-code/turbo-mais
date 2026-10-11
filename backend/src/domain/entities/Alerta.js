const { DomainValidationError } = require('../errors/DomainValidationError');

const DIRECOES = Object.freeze(['alta', 'baixa', 'ambas']);
const GATILHO_MINIMO = 0.01;
const GATILHO_MAXIMO = 100;

/**
 * Entidade Alerta: "me avise quando PETR4 variar X% para cima/baixo no dia".
 *
 * A regra de disparo vive AQUI (domínio), não no worker. O worker só busca
 * dados e chama `avaliar` — assim a regra é testável sem Redis/Postgres.
 */
class Alerta {
  constructor({ id, usuarioId, ticker, gatilhoPercentual, direcao, ativo = true, criadoEm = new Date() }) {
    Alerta.validar({ gatilhoPercentual, direcao });
    this.id = id;
    this.usuarioId = usuarioId;
    this.ticker = ticker;
    this.gatilhoPercentual = Number(gatilhoPercentual);
    this.direcao = direcao;
    this.ativo = Boolean(ativo);
    this.criadoEm = criadoEm;
  }

  static validar({ gatilhoPercentual, direcao }) {
    const gatilho = Number(gatilhoPercentual);
    if (!Number.isFinite(gatilho) || gatilho < GATILHO_MINIMO || gatilho > GATILHO_MAXIMO) {
      throw new DomainValidationError(
        `Gatilho deve estar entre ${GATILHO_MINIMO}% e ${GATILHO_MAXIMO}%`,
        'gatilhoPercentual',
      );
    }
    if (!DIRECOES.includes(direcao)) {
      throw new DomainValidationError(`Direção deve ser uma de: ${DIRECOES.join(', ')}`, 'direcao');
    }
  }

  /**
   * @param {number} variacaoPercentual variação do dia, ex.: -3.2
   * @returns {'alta'|'baixa'|null} direção que disparou, ou null
   */
  avaliar(variacaoPercentual) {
    if (!this.ativo || !Number.isFinite(variacaoPercentual)) return null;

    const observaAlta = this.direcao === 'alta' || this.direcao === 'ambas';
    const observaBaixa = this.direcao === 'baixa' || this.direcao === 'ambas';

    if (observaAlta && variacaoPercentual >= this.gatilhoPercentual) return 'alta';
    if (observaBaixa && variacaoPercentual <= -this.gatilhoPercentual) return 'baixa';
    return null;
  }
}

module.exports = { Alerta, DIRECOES };

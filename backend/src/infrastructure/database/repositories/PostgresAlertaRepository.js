const { AlertaRepository } = require('../../../domain/repositories/AlertaRepository');
const { Alerta } = require('../../../domain/entities/Alerta');
const { ConflictError } = require('../../../application/errors');

const COLUNAS = 'id, usuario_id, ticker, gatilho_percentual, direcao, ativo, criado_em';

const paraEntidade = (l) =>
  l
    ? new Alerta({
        id: l.id,
        usuarioId: l.usuario_id,
        ticker: l.ticker,
        gatilhoPercentual: Number(l.gatilho_percentual),
        direcao: l.direcao,
        ativo: l.ativo,
        criadoEm: l.criado_em,
      })
    : null;

class PostgresAlertaRepository extends AlertaRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async criar({ usuarioId, ticker, gatilhoPercentual, direcao }) {
    try {
      const { rows } = await this.db.query(
        `INSERT INTO alertas (usuario_id, ticker, gatilho_percentual, direcao) VALUES ($1, $2, $3, $4) RETURNING ${COLUNAS}`,
        [usuarioId, ticker, gatilhoPercentual, direcao],
      );
      return paraEntidade(rows[0]);
    } catch (err) {
      if (err.code === '23505') throw new ConflictError('Você já tem um alerta idêntico para este ativo', 'ALERTA_DUPLICADO');
      throw err;
    }
  }

  async buscarPorId(id, usuarioId) {
    const { rows } = await this.db.query(`SELECT ${COLUNAS} FROM alertas WHERE id = $1 AND usuario_id = $2`, [id, usuarioId]);
    return paraEntidade(rows[0]);
  }

  async atualizar(id, usuarioId, { gatilhoPercentual, direcao, ativo }) {
    try {
      const { rows } = await this.db.query(
        `UPDATE alertas SET gatilho_percentual = $3, direcao = $4, ativo = $5
          WHERE id = $1 AND usuario_id = $2 RETURNING ${COLUNAS}`,
        [id, usuarioId, gatilhoPercentual, direcao, ativo],
      );
      return paraEntidade(rows[0]);
    } catch (err) {
      if (err.code === '23505') throw new ConflictError('Você já tem um alerta idêntico para este ativo', 'ALERTA_DUPLICADO');
      throw err;
    }
  }

  async remover(id, usuarioId) {
    const { rowCount } = await this.db.query('DELETE FROM alertas WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    return rowCount > 0;
  }

  async listar(usuarioId, { limit, offset }) {
    const { rows } = await this.db.query(
      `SELECT ${COLUNAS}, COUNT(*) OVER () AS total FROM alertas
        WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT $2 OFFSET $3`,
      [usuarioId, limit, offset],
    );
    return { itens: rows.map(paraEntidade), total: rows[0] ? Number(rows[0].total) : 0 };
  }

  async contarPorUsuario(usuarioId) {
    const { rows } = await this.db.query('SELECT COUNT(*)::int AS n FROM alertas WHERE usuario_id = $1', [usuarioId]);
    return rows[0].n;
  }

  async listarTickersComAlertasAtivos() {
    const { rows } = await this.db.query('SELECT DISTINCT ticker FROM alertas WHERE ativo = TRUE ORDER BY ticker');
    return rows.map((r) => r.ticker);
  }

  async listarAtivosPorTicker(ticker) {
    const { rows } = await this.db.query(`SELECT ${COLUNAS} FROM alertas WHERE ticker = $1 AND ativo = TRUE`, [ticker]);
    return rows.map(paraEntidade);
  }

  async removerTodosDoUsuario(usuarioId) {
    const { rowCount } = await this.db.query('DELETE FROM alertas WHERE usuario_id = $1', [usuarioId]);
    return rowCount;
  }
}

module.exports = { PostgresAlertaRepository };

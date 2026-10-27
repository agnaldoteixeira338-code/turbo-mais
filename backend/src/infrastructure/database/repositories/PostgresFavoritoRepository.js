const { FavoritoRepository } = require('../../../domain/repositories/FavoritoRepository');
const { Favorito } = require('../../../domain/entities/Favorito');

const paraEntidade = (l) =>
  new Favorito({ id: l.id, usuarioId: l.usuario_id, ticker: l.ticker, tipo: l.tipo, criadoEm: l.criado_em });

class PostgresFavoritoRepository extends FavoritoRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async adicionar({ usuarioId, ticker, tipo }) {
    // CTE: insere se não existir e, em qualquer caso, devolve a linha + flag
    const { rows } = await this.db.query(
      `WITH inserido AS (
         INSERT INTO favoritos (usuario_id, ticker, tipo) VALUES ($1, $2, $3)
         ON CONFLICT (usuario_id, ticker) DO NOTHING
         RETURNING *, TRUE AS criado
       )
       SELECT * FROM inserido
       UNION ALL
       SELECT f.*, FALSE AS criado FROM favoritos f
        WHERE f.usuario_id = $1 AND f.ticker = $2 AND NOT EXISTS (SELECT 1 FROM inserido)`,
      [usuarioId, ticker, tipo],
    );
    return { favorito: paraEntidade(rows[0]), criado: rows[0].criado };
  }

  async remover(usuarioId, ticker) {
    const { rowCount } = await this.db.query('DELETE FROM favoritos WHERE usuario_id = $1 AND ticker = $2', [usuarioId, ticker]);
    return rowCount > 0;
  }

  async listar(usuarioId, { tipo, limit, offset }) {
    // COUNT(*) OVER () traz o total na mesma ida ao banco
    const { rows } = await this.db.query(
      `SELECT f.*, COUNT(*) OVER () AS total
         FROM favoritos f
        WHERE f.usuario_id = $1 AND ($2::text IS NULL OR f.tipo = $2)
        ORDER BY f.criado_em DESC
        LIMIT $3 OFFSET $4`,
      [usuarioId, tipo ?? null, limit, offset],
    );
    return { itens: rows.map(paraEntidade), total: rows[0] ? Number(rows[0].total) : 0 };
  }

  async removerTodosDoUsuario(usuarioId) {
    const { rowCount } = await this.db.query('DELETE FROM favoritos WHERE usuario_id = $1', [usuarioId]);
    return rowCount;
  }
}

module.exports = { PostgresFavoritoRepository };

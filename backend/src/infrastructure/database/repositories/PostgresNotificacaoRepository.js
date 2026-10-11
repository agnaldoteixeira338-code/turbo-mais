const { NotificacaoRepository } = require('../../../domain/repositories/NotificacaoRepository');
const { Notificacao } = require('../../../domain/entities/Notificacao');

const COLUNAS = 'id, usuario_id, alerta_id, ticker, variacao, direcao, preco, lida, hash_idempotencia, criado_em';

const paraEntidade = (l) =>
  l
    ? new Notificacao({
        id: l.id,
        usuarioId: l.usuario_id,
        alertaId: l.alerta_id,
        ticker: l.ticker,
        variacao: l.variacao,
        direcao: l.direcao,
        preco: l.preco,
        lida: l.lida,
        hashIdempotencia: l.hash_idempotencia,
        criadoEm: l.criado_em,
      })
    : null;

class PostgresNotificacaoRepository extends NotificacaoRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async criarSeNaoExistir({ usuarioId, alertaId, ticker, variacao, direcao, preco, hashIdempotencia }) {
    const { rows } = await this.db.query(
      `INSERT INTO notificacoes (usuario_id, alerta_id, ticker, variacao, direcao, preco, hash_idempotencia)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (hash_idempotencia) DO NOTHING
       RETURNING ${COLUNAS}`,
      [usuarioId, alertaId, ticker, variacao, direcao, preco, hashIdempotencia],
    );
    return paraEntidade(rows[0]);
  }

  async listar(usuarioId, { apenasNaoLidas = false, limit, offset }) {
    const [lista, contagem] = await Promise.all([
      this.db.query(
        `SELECT ${COLUNAS}, COUNT(*) OVER () AS total FROM notificacoes
          WHERE usuario_id = $1 AND ($2::boolean = FALSE OR lida = FALSE)
          ORDER BY criado_em DESC LIMIT $3 OFFSET $4`,
        [usuarioId, apenasNaoLidas, limit, offset],
      ),
      this.db.query('SELECT COUNT(*)::int AS n FROM notificacoes WHERE usuario_id = $1 AND lida = FALSE', [usuarioId]),
    ]);
    return {
      itens: lista.rows.map(paraEntidade),
      total: lista.rows[0] ? Number(lista.rows[0].total) : 0,
      naoLidas: contagem.rows[0].n,
    };
  }

  async marcarComoLida(id, usuarioId) {
    const { rows } = await this.db.query(
      `UPDATE notificacoes SET lida = TRUE WHERE id = $1 AND usuario_id = $2 RETURNING ${COLUNAS}`,
      [id, usuarioId],
    );
    return paraEntidade(rows[0]);
  }
}

module.exports = { PostgresNotificacaoRepository };

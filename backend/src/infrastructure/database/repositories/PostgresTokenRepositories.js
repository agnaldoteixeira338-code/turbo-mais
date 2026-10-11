const {
  RefreshTokenRepository,
  TokenRecuperacaoRepository,
  Token2faRepository,
} = require('../../../domain/repositories/TokenRepositories');

const refreshParaObjeto = (l) =>
  l && {
    id: l.id,
    usuarioId: l.usuario_id,
    familiaId: l.familia_id,
    expiraEm: new Date(l.expira_em),
    revogado: l.revogado,
  };

class PostgresRefreshTokenRepository extends RefreshTokenRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async criar({ usuarioId, tokenHash, familiaId, expiraEm, ip, userAgent }) {
    const { rows } = await this.db.query(
      `INSERT INTO refresh_tokens (usuario_id, token_hash, familia_id, expira_em, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, usuario_id, familia_id, expira_em, revogado`,
      [usuarioId, tokenHash, familiaId, expiraEm, ip, userAgent],
    );
    return refreshParaObjeto(rows[0]);
  }

  async buscarPorHashParaAtualizacao(tokenHash) {
    // FOR UPDATE: duas abas fazendo refresh ao mesmo tempo são serializadas
    const { rows } = await this.db.query(
      `SELECT id, usuario_id, familia_id, expira_em, revogado
         FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash],
    );
    return refreshParaObjeto(rows[0]);
  }

  async revogar(id, { substituidoPor } = {}) {
    await this.db.query(
      `UPDATE refresh_tokens SET revogado = TRUE, revogado_em = now(), substituido_por = $2 WHERE id = $1`,
      [id, substituidoPor ?? null],
    );
  }

  async revogarPorHash(tokenHash) {
    await this.db.query(
      `UPDATE refresh_tokens SET revogado = TRUE, revogado_em = now() WHERE token_hash = $1 AND revogado = FALSE`,
      [tokenHash],
    );
  }

  async revogarFamilia(familiaId) {
    await this.db.query(
      `UPDATE refresh_tokens SET revogado = TRUE, revogado_em = COALESCE(revogado_em, now()) WHERE familia_id = $1`,
      [familiaId],
    );
  }

  async revogarTodosDoUsuario(usuarioId) {
    await this.db.query(
      `UPDATE refresh_tokens SET revogado = TRUE, revogado_em = now() WHERE usuario_id = $1 AND revogado = FALSE`,
      [usuarioId],
    );
  }
}

class PostgresTokenRecuperacaoRepository extends TokenRecuperacaoRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async criar({ usuarioId, tokenHash, expiraEm }) {
    await this.db.query('INSERT INTO tokens_recuperacao (usuario_id, token_hash, expira_em) VALUES ($1, $2, $3)', [
      usuarioId,
      tokenHash,
      expiraEm,
    ]);
  }

  async invalidarPendentes(usuarioId) {
    await this.db.query('UPDATE tokens_recuperacao SET usado = TRUE, usado_em = now() WHERE usuario_id = $1 AND usado = FALSE', [
      usuarioId,
    ]);
  }

  async consumir(tokenHash) {
    // Check-and-set atômico: só UMA requisição consegue consumir o token
    const { rows } = await this.db.query(
      `UPDATE tokens_recuperacao SET usado = TRUE, usado_em = now()
        WHERE token_hash = $1 AND usado = FALSE AND expira_em > now()
        RETURNING usuario_id`,
      [tokenHash],
    );
    return rows[0] ? { usuarioId: rows[0].usuario_id } : null;
  }
}

class PostgresToken2faRepository extends Token2faRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async criar({ usuarioId, codigoHash, finalidade, expiraEm }) {
    const { rows } = await this.db.query(
      `INSERT INTO tokens_2fa (usuario_id, codigo_hash, finalidade, expira_em) VALUES ($1, $2, $3, $4) RETURNING id`,
      [usuarioId, codigoHash, finalidade, expiraEm],
    );
    return { id: rows[0].id };
  }

  async invalidarPendentes(usuarioId, finalidade) {
    await this.db.query('UPDATE tokens_2fa SET usado = TRUE WHERE usuario_id = $1 AND finalidade = $2 AND usado = FALSE', [
      usuarioId,
      finalidade,
    ]);
  }

  async buscarPendente(usuarioId, finalidade) {
    const { rows } = await this.db.query(
      `SELECT id, codigo_hash, tentativas, expira_em FROM tokens_2fa
        WHERE usuario_id = $1 AND finalidade = $2 AND usado = FALSE
        ORDER BY criado_em DESC LIMIT 1`,
      [usuarioId, finalidade],
    );
    const l = rows[0];
    return l ? { id: l.id, codigoHash: l.codigo_hash, tentativas: l.tentativas, expiraEm: new Date(l.expira_em) } : null;
  }

  async incrementarTentativas(id) {
    await this.db.query('UPDATE tokens_2fa SET tentativas = tentativas + 1 WHERE id = $1', [id]);
  }

  async consumir(id) {
    const { rowCount } = await this.db.query('UPDATE tokens_2fa SET usado = TRUE WHERE id = $1 AND usado = FALSE', [id]);
    return rowCount === 1;
  }
}

module.exports = { PostgresRefreshTokenRepository, PostgresTokenRecuperacaoRepository, PostgresToken2faRepository };

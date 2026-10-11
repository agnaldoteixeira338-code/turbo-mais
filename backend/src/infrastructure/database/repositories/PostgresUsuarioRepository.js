const { UsuarioRepository } = require('../../../domain/repositories/UsuarioRepository');
const { Usuario } = require('../../../domain/entities/Usuario');
const { ConflictError } = require('../../../application/errors');

const COLUNAS = 'id, email, celular, senha_hash, two_factor_ativo, criado_em';

function paraEntidade(linha) {
  return linha
    ? new Usuario({
        id: linha.id,
        email: linha.email,
        celular: linha.celular,
        senhaHash: linha.senha_hash,
        twoFactorAtivo: linha.two_factor_ativo,
        criadoEm: linha.criado_em,
      })
    : null;
}

/** Toda query usa placeholders ($1, $2...) — nunca concatenação (OWASP A03). */
class PostgresUsuarioRepository extends UsuarioRepository {
  /** @param {import('pg').Pool | import('pg').PoolClient} db */
  constructor(db) {
    super();
    this.db = db;
  }

  async criar({ email, celular, senhaHash }) {
    try {
      const { rows } = await this.db.query(
        `INSERT INTO usuarios (email, celular, senha_hash) VALUES ($1, $2, $3) RETURNING ${COLUNAS}`,
        [email, celular, senhaHash],
      );
      return paraEntidade(rows[0]);
    } catch (err) {
      if (err.code === '23505') throw new ConflictError('E-mail já cadastrado', 'EMAIL_JA_CADASTRADO');
      throw err;
    }
  }

  async buscarPorEmail(email) {
    const { rows } = await this.db.query(`SELECT ${COLUNAS} FROM usuarios WHERE lower(email) = lower($1)`, [email]);
    return paraEntidade(rows[0]);
  }

  async buscarPorId(id) {
    const { rows } = await this.db.query(`SELECT ${COLUNAS} FROM usuarios WHERE id = $1`, [id]);
    return paraEntidade(rows[0]);
  }

  async atualizarSenha(id, senhaHash) {
    await this.db.query('UPDATE usuarios SET senha_hash = $2 WHERE id = $1', [id, senhaHash]);
  }

  async atualizarDoisFatores(id, ativo) {
    await this.db.query('UPDATE usuarios SET two_factor_ativo = $2 WHERE id = $1', [id, ativo]);
  }
}

module.exports = { PostgresUsuarioRepository };

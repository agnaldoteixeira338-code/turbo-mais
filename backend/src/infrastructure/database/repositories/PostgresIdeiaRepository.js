const { IdeiaRepository, AuditLogRepository } = require('../../../domain/repositories/IdeiaRepository');
const { Ideia } = require('../../../domain/entities/Ideia');
const { Sugestao } = require('../../../domain/entities/Sugestao');

class PostgresIdeiaRepository extends IdeiaRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async criar({ usuarioId, textoDescrito, palavrasChave }) {
    const { rows } = await this.db.query(
      `INSERT INTO ideias (usuario_id, texto_descrito, palavras_chave) VALUES ($1, $2, $3)
       RETURNING id, usuario_id, texto_descrito, palavras_chave, criado_em`,
      [usuarioId, textoDescrito, palavrasChave],
    );
    const l = rows[0];
    return new Ideia({ id: l.id, usuarioId: l.usuario_id, textoDescrito: l.texto_descrito, palavrasChave: l.palavras_chave, criadoEm: l.criado_em });
  }

  async adicionarSugestoes(ideiaId, sugestoes) {
    // Um único INSERT multi-linha com UNNEST: 1 round-trip para N sugestões
    const { rows } = await this.db.query(
      `INSERT INTO sugestoes (ideia_id, ticker, score, posicao, justificativa)
       SELECT $1::uuid, * FROM UNNEST($2::text[], $3::numeric[], $4::smallint[], $5::text[])
       RETURNING id, ticker, score, posicao, justificativa, criado_em`,
      [
        ideiaId,
        sugestoes.map((s) => s.ticker),
        sugestoes.map((s) => s.score),
        sugestoes.map((s) => s.posicao),
        sugestoes.map((s) => s.justificativa),
      ],
    );
    const extras = new Map(sugestoes.map((s) => [s.ticker, s]));
    return rows
      .map((l) => new Sugestao({ ...l, ideiaId, criadoEm: l.criado_em, nome: extras.get(l.ticker)?.nome, tipo: extras.get(l.ticker)?.tipo }))
      .sort((a, b) => a.posicao - b.posicao);
  }

  async listar(usuarioId, { limit, offset }) {
    const { rows } = await this.db.query(
      `SELECT i.id, i.usuario_id, i.texto_descrito, i.palavras_chave, i.criado_em,
              COUNT(*) OVER () AS total,
              COALESCE(
                (SELECT json_agg(json_build_object(
                          'id', s.id, 'ticker', s.ticker, 'nome', a.nome, 'tipo', a.tipo,
                          'score', s.score, 'posicao', s.posicao, 'justificativa', s.justificativa)
                        ORDER BY s.posicao)
                   FROM sugestoes s LEFT JOIN ativos_educativos a ON a.ticker = s.ticker
                  WHERE s.ideia_id = i.id),
                '[]'::json) AS sugestoes
         FROM ideias i
        WHERE i.usuario_id = $1
        ORDER BY i.criado_em DESC
        LIMIT $2 OFFSET $3`,
      [usuarioId, limit, offset],
    );
    return {
      itens: rows.map(
        (l) =>
          new Ideia({
            id: l.id,
            usuarioId: l.usuario_id,
            textoDescrito: l.texto_descrito,
            palavrasChave: l.palavras_chave,
            criadoEm: l.criado_em,
            sugestoes: l.sugestoes.map((s) => new Sugestao({ ...s, ideiaId: l.id })),
          }),
      ),
      total: rows[0] ? Number(rows[0].total) : 0,
    };
  }

  async removerTodasDoUsuario(usuarioId) {
    // sugestoes.ideia_id tem ON DELETE CASCADE: as sugestões vão junto
    const { rowCount } = await this.db.query('DELETE FROM ideias WHERE usuario_id = $1', [usuarioId]);
    return rowCount;
  }
}

class PostgresAuditLogRepository extends AuditLogRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async registrar({ usuarioId, acao, ip, userAgent, requestId, metadados }) {
    await this.db.query(
      `INSERT INTO audit_log (usuario_id, acao, ip, user_agent, request_id, metadados) VALUES ($1, $2, $3, $4, $5, $6)`,
      [usuarioId ?? null, acao, ip ?? null, userAgent ? String(userAgent).slice(0, 255) : null, requestId ?? null, metadados ?? {}],
    );
  }
}

module.exports = { PostgresIdeiaRepository, PostgresAuditLogRepository };

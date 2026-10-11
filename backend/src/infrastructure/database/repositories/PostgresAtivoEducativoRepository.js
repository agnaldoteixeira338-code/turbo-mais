const { AtivoEducativoRepository } = require('../../../domain/repositories/AtivoEducativoRepository');
const { AtivoEducativo } = require('../../../domain/entities/AtivoEducativo');

const COLUNAS = `id, ticker, nome, tipo, o_que_faz, papel_sociedade, setor, pais, fundacao,
  perfil_risco, rendimento_medio, tags, codigo_externo, preco_referencia, moeda`;

const paraEntidade = (l) =>
  new AtivoEducativo({
    id: l.id,
    ticker: l.ticker,
    nome: l.nome,
    tipo: l.tipo,
    oQueFaz: l.o_que_faz,
    papelSociedade: l.papel_sociedade,
    setor: l.setor,
    pais: l.pais,
    fundacao: l.fundacao,
    perfilRisco: l.perfil_risco,
    rendimentoMedio: l.rendimento_medio,
    tags: l.tags,
    codigoExterno: l.codigo_externo,
    precoReferencia: l.preco_referencia,
    moeda: l.moeda,
  });

/** Escapa curingas do LIKE para que "%" digitado pelo usuário seja literal. */
const escaparLike = (texto) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * O catálogo é pequeno e quase estático: `listarTodos` é cacheado em memória
 * por 5 min (o motor de sugestões lê o catálogo inteiro a cada ideia).
 */
class PostgresAtivoEducativoRepository extends AtivoEducativoRepository {
  constructor(db, { ttlCatalogoMs = 5 * 60 * 1000 } = {}) {
    super();
    this.db = db;
    this.ttlCatalogoMs = ttlCatalogoMs;
    this.catalogo = null;
  }

  async buscarPorTicker(ticker) {
    const { rows } = await this.db.query(`SELECT ${COLUNAS} FROM ativos_educativos WHERE ticker = $1`, [ticker]);
    return rows[0] ? paraEntidade(rows[0]) : null;
  }

  async buscarPorTickers(tickers) {
    if (tickers.length === 0) return [];
    const { rows } = await this.db.query(`SELECT ${COLUNAS} FROM ativos_educativos WHERE ticker = ANY($1::text[]) ORDER BY ticker`, [
      tickers,
    ]);
    return rows.map(paraEntidade);
  }

  async buscar({ termo, tipo, setor, limit, offset }) {
    const padrao = termo ? `%${escaparLike(termo)}%` : null;
    const { rows } = await this.db.query(
      `SELECT ${COLUNAS}, COUNT(*) OVER () AS total FROM ativos_educativos
        WHERE ($1::text IS NULL OR ticker ILIKE $1 OR nome ILIKE $1)
          AND ($2::text IS NULL OR tipo = $2)
          AND ($3::text IS NULL OR setor = $3)
        ORDER BY tipo, ticker
        LIMIT $4 OFFSET $5`,
      [padrao, tipo ?? null, setor ?? null, limit, offset],
    );
    return { itens: rows.map(paraEntidade), total: rows[0] ? Number(rows[0].total) : 0 };
  }

  async listarTodos() {
    const agora = Date.now();
    if (this.catalogo && agora - this.catalogo.em < this.ttlCatalogoMs) return this.catalogo.itens;
    const { rows } = await this.db.query(`SELECT ${COLUNAS} FROM ativos_educativos ORDER BY ticker`);
    this.catalogo = { itens: rows.map(paraEntidade), em: agora };
    return this.catalogo.itens;
  }
}

module.exports = { PostgresAtivoEducativoRepository };

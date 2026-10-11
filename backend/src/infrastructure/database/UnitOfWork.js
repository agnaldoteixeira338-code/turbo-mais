const { comTransacao } = require('./pool');

/**
 * Unit of Work: entrega ao caso de uso um conjunto de repositórios que
 * compartilham a MESMA conexão/transação. O use case expressa "isto é
 * atômico" sem saber o que é BEGIN/COMMIT — e nos testes unitários basta
 * um UoW falso que chama fn(repositoriosEmMemoria).
 */
class PostgresUnitOfWork {
  /**
   * @param {import('pg').Pool} pool
   * @param {(db: import('pg').PoolClient) => object} fabricaDeRepositorios
   */
  constructor(pool, fabricaDeRepositorios) {
    this.pool = pool;
    this.fabricaDeRepositorios = fabricaDeRepositorios;
  }

  run(fn) {
    return comTransacao(this.pool, (client) => fn(this.fabricaDeRepositorios(client)));
  }
}

module.exports = { PostgresUnitOfWork };

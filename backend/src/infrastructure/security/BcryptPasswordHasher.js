const bcrypt = require('bcryptjs');

/**
 * Hash de senha com Bcrypt (custo 12 ≈ 250ms por hash).
 *
 * Usamos `bcryptjs` (implementação JS pura do MESMO algoritmo e formato $2b$)
 * em vez do binding nativo `bcrypt`: elimina toolchain C++ no build Docker
 * (Alpine) e no Windows. Custo: ~30% mais lento por hash — compensado por o
 * hash rodar de forma assíncrona e só em cadastro/login/reset. Os hashes são
 * intercambiáveis: dá para trocar para o nativo sem migrar dados. (ADR-001 §bcrypt)
 */
class BcryptPasswordHasher {
  constructor({ saltRounds = 12 } = {}) {
    this.saltRounds = saltRounds;
  }

  hash(senha) {
    return bcrypt.hash(senha, this.saltRounds);
  }

  compare(senha, hash) {
    return bcrypt.compare(senha, hash);
  }
}

module.exports = { BcryptPasswordHasher };

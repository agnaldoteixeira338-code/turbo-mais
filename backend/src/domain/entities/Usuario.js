/**
 * Entidade Usuario.
 *
 * Por decisão de produto (privacidade por padrão), o cadastro NÃO coleta nome
 * nem CPF: o Turbo Mais não movimenta dinheiro, então não precisa de KYC.
 */
class Usuario {
  constructor({ id, email, celular, senhaHash, twoFactorAtivo = false, criadoEm = new Date() }) {
    this.id = id;
    this.email = email;
    this.celular = celular;
    this.senhaHash = senhaHash;
    this.twoFactorAtivo = Boolean(twoFactorAtivo);
    this.criadoEm = criadoEm;
  }

  exigeSegundoFator() {
    return this.twoFactorAtivo;
  }
}

module.exports = { Usuario };

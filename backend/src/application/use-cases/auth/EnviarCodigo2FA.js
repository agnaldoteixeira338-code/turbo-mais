const crypto = require('node:crypto');

/**
 * Gera um código de 6 dígitos (CSPRNG), guarda só o HMAC e enfileira o e-mail.
 *
 * Por que HMAC e não sha256 simples? Um código de 6 dígitos tem só 10^6
 * possibilidades: com acesso ao banco, um sha256 seria revertido em
 * milissegundos. O HMAC exige também o segredo do servidor (pepper), que não
 * está no banco.
 */
class EnviarCodigo2FA {
  constructor({ token2faRepository, tokenService, emailQueue, validadeMinutos, clock = () => new Date() }) {
    this.token2faRepository = token2faRepository;
    this.tokenService = tokenService;
    this.emailQueue = emailQueue;
    this.validadeMinutos = validadeMinutos;
    this.clock = clock;
  }

  async execute({ usuario, finalidade }) {
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const expiraEm = new Date(this.clock().getTime() + this.validadeMinutos * 60 * 1000);

    await this.token2faRepository.invalidarPendentes(usuario.id, finalidade);
    const registro = await this.token2faRepository.criar({
      usuarioId: usuario.id,
      codigoHash: this.tokenService.hashCodigo(codigo),
      finalidade,
      expiraEm,
    });

    await this.emailQueue.enfileirar({
      tipo: '2fa',
      para: usuario.email,
      dados: { codigo, validadeMinutos: this.validadeMinutos, finalidade },
      chaveIdempotencia: `2fa-${registro.id}`,
    });
  }
}

module.exports = { EnviarCodigo2FA };

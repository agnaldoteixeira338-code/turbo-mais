const { UnauthorizedError, TooManyRequestsError } = require('../../errors');
const { compararSeguro } = require('../../../shared/utils');

/**
 * Verifica um código 2FA com limite de tentativas POR CÓDIGO.
 * Com 5 tentativas e 10^6 combinações, a chance de acerto por força bruta é
 * de 0,0005% por código emitido — e cada novo código invalida o anterior.
 */
class VerificarCodigo2FA {
  constructor({ token2faRepository, tokenService, maxTentativas, clock = () => new Date() }) {
    this.token2faRepository = token2faRepository;
    this.tokenService = tokenService;
    this.maxTentativas = maxTentativas;
    this.clock = clock;
  }

  async execute({ usuarioId, codigo, finalidade }) {
    const pendente = await this.token2faRepository.buscarPendente(usuarioId, finalidade);
    if (!pendente || pendente.expiraEm.getTime() <= this.clock().getTime()) {
      throw new UnauthorizedError('Código inválido ou expirado', 'CODIGO_INVALIDO');
    }

    if (pendente.tentativas >= this.maxTentativas) {
      await this.token2faRepository.consumir(pendente.id); // queima o código
      throw new TooManyRequestsError('Muitas tentativas. Solicite um novo código.', 60, 'CODIGO_BLOQUEADO');
    }

    const confere = compararSeguro(this.tokenService.hashCodigo(codigo), pendente.codigoHash);
    if (!confere) {
      await this.token2faRepository.incrementarTentativas(pendente.id);
      throw new UnauthorizedError('Código inválido ou expirado', 'CODIGO_INVALIDO');
    }

    // Consumo atômico: se duas requisições chegarem juntas com o código certo,
    // só uma vence (UPDATE ... WHERE usado = false).
    const consumido = await this.token2faRepository.consumir(pendente.id);
    if (!consumido) throw new UnauthorizedError('Código inválido ou expirado', 'CODIGO_INVALIDO');
  }
}

module.exports = { VerificarCodigo2FA };

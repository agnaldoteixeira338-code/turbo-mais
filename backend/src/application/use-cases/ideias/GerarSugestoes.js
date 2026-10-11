const { sanitizarTexto } = require('../../../shared/sanitizar');
const { ValidationError } = require('../../errors');
const { LIMITES } = require('../../../shared/constants');

/**
 * "Descreva o que você quer" → top 10 ativos com justificativa.
 *
 * O texto é sanitizado ANTES de tudo (XSS armazenado) e a ideia + sugestões
 * são gravadas numa única transação: nunca existe ideia "pela metade".
 * Não há — de propósito — nenhuma ação de compra: o Turbo Mais só informa.
 */
class GerarSugestoes {
  constructor({ ativoRepository, unitOfWork, motorDeSugestoes }) {
    this.ativoRepository = ativoRepository;
    this.unitOfWork = unitOfWork;
    this.motorDeSugestoes = motorDeSugestoes;
  }

  async execute({ usuarioId, texto }) {
    const textoLimpo = sanitizarTexto(texto);
    if (textoLimpo.length < 3) {
      throw new ValidationError('Descreva sua ideia com pelo menos 3 caracteres');
    }

    const catalogo = await this.ativoRepository.listarTodos();
    const { palavrasChave, sugestoes } = this.motorDeSugestoes.sugerir(textoLimpo, catalogo, {
      limite: LIMITES.SUGESTOES_POR_IDEIA,
    });

    return this.unitOfWork.run(async ({ ideias }) => {
      const ideia = await ideias.criar({ usuarioId, textoDescrito: textoLimpo, palavrasChave });
      ideia.sugestoes = sugestoes.length > 0 ? await ideias.adicionarSugestoes(ideia.id, sugestoes) : [];
      return ideia;
    });
  }
}

module.exports = { GerarSugestoes };

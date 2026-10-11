/**
 * Erro de regra de domínio (invariante violada).
 *
 * Vive no domínio — e não em application/errors — porque o domínio é a camada
 * mais interna e não pode depender de nenhuma outra (regra de dependência da
 * Clean Architecture). O errorHandler HTTP traduz este erro para 422.
 */
class DomainValidationError extends Error {
  /**
   * @param {string} message mensagem amigável (pt-BR), segura para o usuário
   * @param {string} [campo] campo que violou a regra, quando aplicável
   */
  constructor(message, campo) {
    super(message);
    this.name = 'DomainValidationError';
    this.campo = campo;
  }
}

module.exports = { DomainValidationError };

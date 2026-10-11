/**
 * Hierarquia de erros da aplicação.
 *
 * Cada erro carrega o status HTTP e um `code` estável (contrato com o
 * frontend: o front decide o que fazer pelo code, nunca pela mensagem).
 * Erros que NÃO herdam de AppError são tratados como bugs → 500 genérico.
 */
class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'ERRO_INTERNO', details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // erro esperado, não é bug
  }
}

class ValidationError extends AppError {
  constructor(message = 'Dados inválidos', details) {
    super(message, { statusCode: 400, code: 'DADOS_INVALIDOS', details });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado', code = 'NAO_AUTENTICADO') {
    super(message, { statusCode: 401, code });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado', code = 'ACESSO_NEGADO') {
    super(message, { statusCode: 403, code });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, { statusCode: 404, code: 'NAO_ENCONTRADO' });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflito com o estado atual do recurso', code = 'CONFLITO') {
    super(message, { statusCode: 409, code });
  }
}

class UnprocessableError extends AppError {
  constructor(message, code = 'REGRA_DE_NEGOCIO', details) {
    super(message, { statusCode: 422, code, details });
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas requisições. Tente novamente em instantes.', retryAfterSeconds = 60, code = 'LIMITE_EXCEDIDO') {
    super(message, { statusCode: 429, code });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Serviço temporariamente indisponível', code = 'SERVICO_INDISPONIVEL') {
    super(message, { statusCode: 503, code });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  TooManyRequestsError,
  ServiceUnavailableError,
};

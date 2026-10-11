const { ValidationError } = require('../../../application/errors');

/**
 * Valida body/query/params com Zod e entrega o resultado em `req.valido`.
 *
 * Não sobrescrevemos req.query: no Express 5 ele é um getter somente-leitura.
 * Usar `req.valido` também deixa explícito no controller que o dado passou
 * pela validação (e já está convertido: "20" → 20, "true" → true).
 */
function validateInput(schemas) {
  return (req, _res, next) => {
    req.valido = req.valido ?? {};
    const erros = [];
    for (const parte of ['params', 'query', 'body']) {
      if (!schemas[parte]) continue;
      const resultado = schemas[parte].safeParse(req[parte] ?? {});
      if (resultado.success) {
        req.valido[parte] = resultado.data;
      } else {
        erros.push(
          ...resultado.error.issues.map((i) => ({ local: parte, campo: i.path.join('.') || undefined, mensagem: i.message })),
        );
      }
    }
    if (erros.length > 0) return next(new ValidationError('Dados inválidos', erros));
    return next();
  };
}

module.exports = { validateInput };

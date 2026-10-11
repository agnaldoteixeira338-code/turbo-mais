const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * Contexto por requisição/job (requestId, usuarioId) propagado de forma
 * implícita via AsyncLocalStorage. Qualquer log emitido durante a requisição —
 * inclusive dentro de repositórios e clientes HTTP — sai com o mesmo
 * requestId, sem precisar passar o logger de mão em mão.
 */
const storage = new AsyncLocalStorage();

function executarComContexto(contexto, fn) {
  return storage.run({ ...contexto }, fn);
}

function obterContexto() {
  return storage.getStore() ?? {};
}

/** Enriquecimento tardio (ex.: authMiddleware descobre o usuarioId depois). */
function definirNoContexto(chave, valor) {
  const store = storage.getStore();
  if (store) store[chave] = valor;
}

module.exports = { executarComContexto, obterContexto, definirNoContexto };

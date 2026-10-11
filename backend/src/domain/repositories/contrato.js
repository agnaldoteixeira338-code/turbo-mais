/**
 * JavaScript não tem `interface`. Usamos classes-base abstratas cujos métodos
 * falham alto se não forem implementados — o adaptador concreto (Postgres,
 * in-memory nos testes) estende a classe e sobrescreve cada método.
 *
 * Isso documenta o contrato no código e faz o teste quebrar cedo (fail fast)
 * se alguém esquecer de implementar um método numa nova implementação.
 */
function naoImplementado(classe, metodo) {
  throw new Error(`${classe}.${metodo}() não implementado`);
}

module.exports = { naoImplementado };

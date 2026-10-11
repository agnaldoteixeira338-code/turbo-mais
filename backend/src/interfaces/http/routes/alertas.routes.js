const { Router } = require('express');
const dtos = require('../../../application/dtos');

function alertasRoutes({ controller, mw }) {
  const r = Router();
  const v = mw.validateInput;
  r.use(mw.auth, mw.rl.usuario);

  r.get('/', v({ query: dtos.alertas.listar }), controller.listar);
  r.post('/', v({ body: dtos.alertas.criar }), mw.idempotency, controller.criar);
  r.put('/:id', v({ params: dtos.alertas.params, body: dtos.alertas.atualizar }), controller.atualizar);
  r.delete('/:id', v({ params: dtos.alertas.params }), controller.remover);

  return r;
}

module.exports = { alertasRoutes };

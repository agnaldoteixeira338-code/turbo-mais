const { Router } = require('express');
const dtos = require('../../../application/dtos');

function ideiasRoutes({ controller, mw }) {
  const r = Router();
  const v = mw.validateInput;
  r.use(mw.auth, mw.rl.usuario);

  r.get('/', v({ query: dtos.ideias.listar }), controller.listar);
  r.post('/', v({ body: dtos.ideias.criar }), mw.idempotency, controller.criar);

  return r;
}

module.exports = { ideiasRoutes };

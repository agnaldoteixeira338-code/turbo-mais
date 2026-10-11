const { Router } = require('express');
const dtos = require('../../../application/dtos');

function notificacoesRoutes({ controller, mw }) {
  const r = Router();
  const v = mw.validateInput;
  r.use(mw.auth, mw.rl.usuario);

  r.get('/', v({ query: dtos.notificacoes.listar }), controller.listar);
  r.patch('/:id/lida', v({ params: dtos.notificacoes.params }), controller.marcarComoLida);

  return r;
}

module.exports = { notificacoesRoutes };

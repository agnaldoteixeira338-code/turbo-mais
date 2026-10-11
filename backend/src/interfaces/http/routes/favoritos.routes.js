const { Router } = require('express');
const dtos = require('../../../application/dtos');
const { ACOES_AUDITORIA } = require('../../../shared/constants');

function favoritosRoutes({ controller, mw }) {
  const r = Router();
  const v = mw.validateInput;
  r.use(mw.auth, mw.rl.usuario);

  r.get('/', v({ query: dtos.favoritos.listar }), controller.listar);
  r.post(
    '/',
    v({ body: dtos.favoritos.adicionar }),
    mw.idempotency,
    mw.audit(ACOES_AUDITORIA.FAVORITO_ADICIONADO, (req) => ({ ticker: req.valido.body.ticker })),
    controller.adicionar,
  );
  r.delete('/:ticker', v({ params: dtos.favoritos.params }), mw.audit(ACOES_AUDITORIA.FAVORITO_REMOVIDO), controller.remover);

  return r;
}

module.exports = { favoritosRoutes };

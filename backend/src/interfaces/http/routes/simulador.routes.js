const { Router } = require('express');
const dtos = require('../../../application/dtos');

/**
 * Simulador (ADR-014). O POST não grava nada, então não precisa de
 * Idempotency-Key; e, como as outras rotas autenticadas, usa Bearer token
 * (imune a CSRF) e o rate limit por usuário.
 */
function simuladorRoutes({ controller, mw }) {
  const r = Router();
  r.use(mw.auth, mw.rl.usuario);

  r.get('/taxas', controller.taxas);
  r.post('/', mw.validateInput({ body: dtos.simulador.simular }), controller.simular);

  return r;
}

module.exports = { simuladorRoutes };

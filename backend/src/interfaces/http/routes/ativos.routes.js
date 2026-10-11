const { Router } = require('express');
const dtos = require('../../../application/dtos');

function ativosRoutes({ controller, mw }) {
  const r = Router();
  const v = mw.validateInput;
  r.use(mw.auth, mw.rl.usuario);

  const lista = v({ query: dtos.ativos.buscar });
  r.get('/', lista, controller.buscar);
  // Rotas fixas ANTES de /:ticker, senão "criptomoedas" seria lido como ticker
  r.get('/acoes-brasileiras', lista, controller.porCategoria('acoesBrasileiras'));
  r.get('/acoes-globais', lista, controller.porCategoria('acoesGlobais'));
  r.get('/criptomoedas', lista, controller.porCategoria('criptomoedas'));
  r.get('/cdbs', lista, controller.porCategoria('cdbs'));
  r.get('/bancos', lista, controller.porCategoria('bancos'));
  r.get('/:ticker', v({ params: dtos.ativos.params, query: dtos.ativos.detalhe }), controller.detalhar);

  return r;
}

module.exports = { ativosRoutes };

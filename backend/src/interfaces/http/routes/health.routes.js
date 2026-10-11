const { Router } = require('express');
const { UnauthorizedError } = require('../../../application/errors');
const { compararSeguro } = require('../../../shared/utils');

function healthRoutes({ controller, metrics, metricsToken }) {
  const r = Router();
  r.get('/live', controller.live);
  r.get('/ready', controller.ready);
  r.get('/health', controller.health);

  // /metrics expõe nomes de rotas e volumes: em produção, exige token (scraper)
  r.get('/metrics', async (req, res) => {
    if (metricsToken) {
      const recebido = (req.get('authorization') ?? '').replace(/^Bearer /, '');
      if (!compararSeguro(recebido, metricsToken)) throw new UnauthorizedError('Token de métricas inválido');
    }
    res.setHeader('Content-Type', metrics.registry.contentType);
    res.send(await metrics.registry.metrics());
  });

  return r;
}

module.exports = { healthRoutes };

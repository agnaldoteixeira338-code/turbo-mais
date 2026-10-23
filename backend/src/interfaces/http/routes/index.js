const { Router } = require('express');
const { authRoutes } = require('./auth.routes');
const { favoritosRoutes } = require('./favoritos.routes');
const { alertasRoutes } = require('./alertas.routes');
const { notificacoesRoutes } = require('./notificacoes.routes');
const { ativosRoutes } = require('./ativos.routes');
const { ideiasRoutes } = require('./ideias.routes');

/**
 * Router da v1. Versionamento por PREFIXO de URL (ADR-006): uma v2 seria um
 * novo router montado em /api/v2 convivendo com este durante a depreciação.
 */
function rotasV1({ controllers, mw }) {
  const r = Router();
  // Chamado pelo SPA ao abrir: começa a acordar a API (Render gratuita) enquanto
  // a pessoa ainda lê a tela. Não toca banco nem Redis; só o rate limit global.
  r.get('/ping', (req, res) => res.status(204).end());
  r.use('/auth', authRoutes({ controller: controllers.auth, mw }));
  r.use('/favoritos', favoritosRoutes({ controller: controllers.favoritos, mw }));
  r.use('/alertas', alertasRoutes({ controller: controllers.alertas, mw }));
  r.use('/notificacoes', notificacoesRoutes({ controller: controllers.notificacoes, mw }));
  r.use('/ativos', ativosRoutes({ controller: controllers.ativos, mw }));
  r.use('/ideias', ideiasRoutes({ controller: controllers.ideias, mw }));
  return r;
}

module.exports = { rotasV1 };

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const { requestLogger } = require('./middlewares/requestLogger');
const { httpMetrics } = require('./middlewares/httpMetrics');
const { cspMiddleware, cspSwagger } = require('./middlewares/cspMiddleware');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { healthRoutes } = require('./routes/health.routes');
const { rotasV1 } = require('./routes');
const { criarDocumentoOpenApi } = require('../../config/swagger');

/**
 * Monta o app Express a partir do container. Não abre porta (isso é do
 * server.js) — o que permite ao Supertest testar o app inteiro em memória.
 *
 * A ORDEM dos middlewares é deliberada:
 *   requestId/log → métricas → headers de segurança → CORS → parsers
 *   → rate limit global → health → docs → API → 404 → errorHandler
 */
function criarApp(container) {
  const { env, logger, metrics, mw, controllers } = container;
  const app = express();

  app.disable('x-powered-by');
  // IP real do usuário atrás dos proxies (produção: Vercel → Render = 2 saltos)
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestLogger(logger));
  app.use(httpMetrics(metrics));
  app.use(cspMiddleware({ producao: env.NODE_ENV === 'production' }));
  app.use(
    cors({
      // Whitelist explícita por ambiente — nunca "*" com credentials
      origin: (origem, cb) => cb(null, !origem || env.CORS_ORIGINS.includes(origem)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Retry-After', 'RateLimit', 'RateLimit-Policy', 'Idempotent-Replayed'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '10kb' })); // payloads da API são pequenos: limite baixo = menos DoS
  app.use(cookieParser());
  app.use(mw.rl.global);

  app.use(healthRoutes({ controller: controllers.health, metrics, metricsToken: env.METRICS_TOKEN }));

  if (env.SWAGGER_ENABLED) {
    const documento = criarDocumentoOpenApi();
    app.get('/api/docs.json', (_req, res) => res.json(documento));
    app.use('/api/docs', cspSwagger(), swaggerUi.serve, swaggerUi.setup(documento, { customSiteTitle: 'Turbo Mais API' }));
  }

  app.use('/api/v1', rotasV1({ controllers, mw }));

  app.use(notFoundHandler);
  app.use(errorHandler({ logger, metrics }));
  return app;
}

module.exports = { criarApp };

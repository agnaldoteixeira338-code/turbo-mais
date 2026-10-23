/**
 * COMPOSITION ROOT — o único lugar do sistema que conhece TODAS as
 * implementações concretas e as liga às portas (DI manual, sem framework).
 *
 * Por que DI manual e não um container (awilix, inversify)? São ~40 objetos:
 * um arquivo explícito é mais fácil de ler, de depurar e de entender numa
 * entrevista do que mágica de resolução por nome. `overrides` permite que os
 * testes de integração troquem só o que precisam (ex.: fila de e-mail falsa).
 */
const { criarLogger } = require('../infrastructure/logger/pinoLogger');
const { criarPool } = require('../infrastructure/database/pool');
const { PostgresUnitOfWork } = require('../infrastructure/database/UnitOfWork');
const { PostgresUsuarioRepository } = require('../infrastructure/database/repositories/PostgresUsuarioRepository');
const {
  PostgresRefreshTokenRepository,
  PostgresTokenRecuperacaoRepository,
  PostgresToken2faRepository,
} = require('../infrastructure/database/repositories/PostgresTokenRepositories');
const { PostgresFavoritoRepository } = require('../infrastructure/database/repositories/PostgresFavoritoRepository');
const { PostgresAlertaRepository } = require('../infrastructure/database/repositories/PostgresAlertaRepository');
const { PostgresNotificacaoRepository } = require('../infrastructure/database/repositories/PostgresNotificacaoRepository');
const { PostgresAtivoEducativoRepository } = require('../infrastructure/database/repositories/PostgresAtivoEducativoRepository');
const { PostgresIdeiaRepository, PostgresAuditLogRepository } = require('../infrastructure/database/repositories/PostgresIdeiaRepository');
const { criarConexaoRedis } = require('../infrastructure/cache/redisClient');
const { CacheService } = require('../infrastructure/cache/CacheService');
const { criarFilas, BullEmailQueue } = require('../infrastructure/queue/queues');
const { EmailService } = require('../infrastructure/email/EmailService');
const { MarketDataGateway } = require('../infrastructure/external-apis/MarketDataGateway');
const { criarBrapiClient } = require('../infrastructure/external-apis/brapi');
const { criarCoinGeckoClient } = require('../infrastructure/external-apis/coingecko');
const { criarAlphaVantageClient } = require('../infrastructure/external-apis/alphaVantage');
const { criarMockMarketData } = require('../infrastructure/external-apis/mockMarketData');
const { criarProvedorComFallback } = require('../infrastructure/external-apis/provedorComFallback');
const { SocketIoNotificador } = require('../infrastructure/websocket/socketEmitter');
const { criarMetricas } = require('../infrastructure/observability/metrics');
const { encerrarCircuitos } = require('../infrastructure/resilience/circuitBreakers');
const { BcryptPasswordHasher } = require('../infrastructure/security/BcryptPasswordHasher');
const { JwtTokenService } = require('../infrastructure/security/JwtTokenService');
const { RedisLoginAttemptTracker } = require('../infrastructure/security/RedisLoginAttemptTracker');
const { AuditLogService } = require('../infrastructure/security/AuditLogService');

const { MotorDeSugestoes } = require('../domain/services/MotorDeSugestoes');
const dicionario = require('../domain/services/dicionarioSinonimos.json');
const { LIMITES } = require('../shared/constants');

const { EmitirSessao } = require('../application/use-cases/auth/EmitirSessao');
const { CadastrarUsuario } = require('../application/use-cases/auth/CadastrarUsuario');
const { Login } = require('../application/use-cases/auth/Login');
const { EntrarComoVisitante } = require('../application/use-cases/auth/EntrarComoVisitante');
const { RestaurarContaDemo } = require('../application/use-cases/demo/RestaurarContaDemo');
const { RefreshToken } = require('../application/use-cases/auth/RefreshToken');
const { Logout } = require('../application/use-cases/auth/Logout');
const { EsqueciSenha } = require('../application/use-cases/auth/EsqueciSenha');
const { ResetarSenha } = require('../application/use-cases/auth/ResetarSenha');
const { EnviarCodigo2FA } = require('../application/use-cases/auth/EnviarCodigo2FA');
const { VerificarCodigo2FA } = require('../application/use-cases/auth/VerificarCodigo2FA');
const { Ativar2FA } = require('../application/use-cases/auth/Ativar2FA');
const { Validar2FA } = require('../application/use-cases/auth/Validar2FA');
const { AdicionarFavorito } = require('../application/use-cases/favoritos/AdicionarFavorito');
const { RemoverFavorito } = require('../application/use-cases/favoritos/RemoverFavorito');
const { ListarFavoritos } = require('../application/use-cases/favoritos/ListarFavoritos');
const { CriarAlerta } = require('../application/use-cases/alertas/CriarAlerta');
const { AtualizarAlerta } = require('../application/use-cases/alertas/AtualizarAlerta');
const { RemoverAlerta } = require('../application/use-cases/alertas/RemoverAlerta');
const { ListarAlertas } = require('../application/use-cases/alertas/ListarAlertas');
const { ListarNotificacoes } = require('../application/use-cases/notificacoes/ListarNotificacoes');
const { MarcarComoLida } = require('../application/use-cases/notificacoes/MarcarComoLida');
const { ProcessarAlerta } = require('../application/use-cases/notificacoes/ProcessarAlerta');
const { BuscarAtivos } = require('../application/use-cases/ativos/BuscarAtivos');
const { BuscarAcoesBrasileiras } = require('../application/use-cases/ativos/BuscarAcoesBrasileiras');
const { BuscarAcoesGlobais } = require('../application/use-cases/ativos/BuscarAcoesGlobais');
const { DetalharAtivo } = require('../application/use-cases/ativos/DetalharAtivo');
const { GerarSugestoes } = require('../application/use-cases/ideias/GerarSugestoes');
const { ListarIdeias } = require('../application/use-cases/ideias/ListarIdeias');

const { AuthController } = require('../interfaces/http/controllers/AuthController');
const { FavoritosController } = require('../interfaces/http/controllers/FavoritosController');
const { AlertasController } = require('../interfaces/http/controllers/AlertasController');
const { NotificacoesController } = require('../interfaces/http/controllers/NotificacoesController');
const { AtivosController } = require('../interfaces/http/controllers/AtivosController');
const { IdeiasController } = require('../interfaces/http/controllers/IdeiasController');
const { HealthController } = require('../interfaces/http/controllers/HealthController');
const { authMiddleware } = require('../interfaces/http/middlewares/authMiddleware');
const { criarRateLimiters } = require('../interfaces/http/middlewares/rateLimiter');
const { validateInput } = require('../interfaces/http/middlewares/validateInput');
const { csrfProtection } = require('../interfaces/http/middlewares/csrfProtection');
const { auditLogger } = require('../interfaces/http/middlewares/auditLogger');
const { idempotency } = require('../shared/idempotency');

function criarContainer({ env, logger = criarLogger({ level: env.LOG_LEVEL }), overrides = {} }) {
  // ------------------------------------------------------------ infraestrutura
  const pool = overrides.pool ?? criarPool({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX, ssl: env.DATABASE_SSL, logger });
  const redis = overrides.redis ?? criarConexaoRedis(env.REDIS_URL, { papel: 'geral', logger });
  const bullConnection = overrides.bullConnection ?? criarConexaoRedis(env.REDIS_URL, { papel: 'bullmq', logger });
  const filas = criarFilas(bullConnection);
  const metrics = criarMetricas({ filas });
  const cache = new CacheService({ redis, logger, metrics });

  const fabricaDeRepositorios = (db) => ({
    usuarios: new PostgresUsuarioRepository(db),
    refreshTokens: new PostgresRefreshTokenRepository(db),
    tokensRecuperacao: new PostgresTokenRecuperacaoRepository(db),
    tokens2fa: new PostgresToken2faRepository(db),
    favoritos: new PostgresFavoritoRepository(db),
    alertas: new PostgresAlertaRepository(db),
    notificacoes: new PostgresNotificacaoRepository(db),
    ideias: new PostgresIdeiaRepository(db),
  });
  const repos = fabricaDeRepositorios(pool);
  const ativoRepository = new PostgresAtivoEducativoRepository(pool);
  const unitOfWork = new PostgresUnitOfWork(pool, fabricaDeRepositorios);

  const auditLog = new AuditLogService({ auditLogRepository: new PostgresAuditLogRepository(pool), logger });
  const passwordHasher = new BcryptPasswordHasher({ saltRounds: env.BCRYPT_SALT_ROUNDS });
  const tokenService = new JwtTokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    resetSecret: env.JWT_RESET_SECRET,
    doisFatoresSecret: env.JWT_2FA_SECRET,
    codigoHmacSecret: env.CODE_HMAC_SECRET,
    issuer: env.JWT_ISSUER,
    accessTtlSegundos: env.ACCESS_TOKEN_TTL_SECONDS,
    resetTtlMinutos: LIMITES.RESET_SENHA_VALIDADE_MINUTOS,
  });
  const loginAttemptTracker = new RedisLoginAttemptTracker({
    redis,
    maxTentativas: LIMITES.LOGIN_MAX_TENTATIVAS,
    janelaSegundos: LIMITES.LOGIN_BLOQUEIO_SEGUNDOS,
    logger,
  });
  const emailQueue = overrides.emailQueue ?? new BullEmailQueue(filas.email);
  const emailService = new EmailService({
    from: env.EMAIL_FROM,
    resendApiKey: env.RESEND_API_KEY,
    brevoApiKey: env.BREVO_API_KEY,
    smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, user: env.SMTP_USER, pass: env.SMTP_PASS },
    logger,
    ambiente: env.NODE_ENV,
  });

  const brapi = criarBrapiClient({ token: env.BRAPI_TOKEN, logger });
  const marketData =
    overrides.marketData ??
    new MarketDataGateway({
      provedores: {
        acao_br: brapi,
        // Ações globais: BDR na B3 via brapi (funciona a partir da nuvem) com a
        // Alpha Vantage como reserva — ADR-012
        acao_global: criarProvedorComFallback([brapi, criarAlphaVantageClient({ apiKey: env.ALPHA_VANTAGE_API_KEY, logger })], { logger }),
        cripto: criarCoinGeckoClient({ apiKey: env.COINGECKO_API_KEY, logger }),
      },
      simulado: criarMockMarketData(),
      cache,
      logger,
      modo: env.MARKET_DATA_MODE,
      fallbackSimulado: env.MARKET_DATA_FALLBACK_SIMULADO,
      ttlSegundos: env.CACHE_TTL_SECONDS,
      staleSegundos: env.CACHE_STALE_SECONDS,
      // TTL específico por tipo (ex.: provedor com cota pequena). Hoje todos os
      // provedores cabem no TTL padrão (CACHE_TTL_SECONDS).
      ttlPorTipo: {},
    });
  const notificador = overrides.notificador ?? new SocketIoNotificador(redis);

  // ---------------------------------------------------------------- casos de uso
  const emitirSessao = new EmitirSessao({
    refreshTokenRepository: repos.refreshTokens,
    tokenService,
    refreshTokenTtlDias: env.REFRESH_TOKEN_TTL_DAYS,
  });
  const enviarCodigo2FA = new EnviarCodigo2FA({
    token2faRepository: repos.tokens2fa,
    tokenService,
    emailQueue,
    validadeMinutos: LIMITES.CODIGO_2FA_VALIDADE_MINUTOS,
  });
  const verificarCodigo2FA = new VerificarCodigo2FA({
    token2faRepository: repos.tokens2fa,
    tokenService,
    maxTentativas: LIMITES.CODIGO_2FA_MAX_TENTATIVAS,
  });
  const buscarAtivos = new BuscarAtivos({ ativoRepository, marketData });
  const motorDeSugestoes = new MotorDeSugestoes(dicionario);

  const useCases = {
    cadastrarUsuario: new CadastrarUsuario({ usuarioRepository: repos.usuarios, passwordHasher, auditLog }),
    login: new Login({
      usuarioRepository: repos.usuarios,
      passwordHasher,
      loginAttemptTracker,
      emitirSessao,
      enviarCodigo2FA,
      tokenService,
      auditLog,
    }),
    entrarComoVisitante: new EntrarComoVisitante({ usuarioRepository: repos.usuarios, emitirSessao, auditLog, emailDemo: env.DEMO_USER_EMAIL }),
    refreshToken: new RefreshToken({ unitOfWork, tokenService, emitirSessao, auditLog }),
    logout: new Logout({ refreshTokenRepository: repos.refreshTokens, tokenService, auditLog }),
    esqueciSenha: new EsqueciSenha({
      usuarioRepository: repos.usuarios,
      tokenRecuperacaoRepository: repos.tokensRecuperacao,
      tokenService,
      emailQueue,
      auditLog,
      frontendUrl: env.FRONTEND_URL,
      validadeMinutos: LIMITES.RESET_SENHA_VALIDADE_MINUTOS,
    }),
    resetarSenha: new ResetarSenha({ unitOfWork, tokenService, passwordHasher, auditLog }),
    ativar2FA: new Ativar2FA({ usuarioRepository: repos.usuarios, enviarCodigo2FA, verificarCodigo2FA, auditLog }),
    validar2FA: new Validar2FA({ usuarioRepository: repos.usuarios, tokenService, verificarCodigo2FA, emitirSessao, auditLog }),
    adicionarFavorito: new AdicionarFavorito({ favoritoRepository: repos.favoritos, ativoRepository }),
    removerFavorito: new RemoverFavorito({ favoritoRepository: repos.favoritos }),
    listarFavoritos: new ListarFavoritos({ favoritoRepository: repos.favoritos, ativoRepository, marketData }),
    criarAlerta: new CriarAlerta({ alertaRepository: repos.alertas, ativoRepository, auditLog }),
    atualizarAlerta: new AtualizarAlerta({ alertaRepository: repos.alertas, auditLog }),
    removerAlerta: new RemoverAlerta({ alertaRepository: repos.alertas, auditLog }),
    listarAlertas: new ListarAlertas({ alertaRepository: repos.alertas }),
    listarNotificacoes: new ListarNotificacoes({ notificacaoRepository: repos.notificacoes }),
    marcarComoLida: new MarcarComoLida({ notificacaoRepository: repos.notificacoes }),
    processarAlerta: new ProcessarAlerta({
      alertaRepository: repos.alertas,
      notificacaoRepository: repos.notificacoes,
      ativoRepository,
      marketData,
      notificador,
      logger,
      janelaMinutos: env.ALERTA_JANELA_MINUTOS,
    }),
    buscarAtivos,
    buscarAcoesBrasileiras: new BuscarAcoesBrasileiras({ buscarAtivos }),
    buscarAcoesGlobais: new BuscarAcoesGlobais({ buscarAtivos }),
    detalharAtivo: new DetalharAtivo({ ativoRepository, marketData, logger }),
    gerarSugestoes: new GerarSugestoes({ ativoRepository, unitOfWork, motorDeSugestoes }),
    listarIdeias: new ListarIdeias({ ideiaRepository: repos.ideias }),
    restaurarContaDemo: new RestaurarContaDemo({
      usuarioRepository: repos.usuarios,
      ativoRepository,
      unitOfWork,
      motorDeSugestoes,
      auditLog,
      logger,
      emailDemo: env.DEMO_USER_EMAIL,
    }),
  };

  // ------------------------------------------------------------------- HTTP
  const estado = { encerrando: false };
  const controllers = {
    auth: new AuthController({ useCases, cookieSeguro: env.COOKIE_SECURE, refreshTtlDias: env.REFRESH_TOKEN_TTL_DAYS, usuarioRepository: repos.usuarios }),
    favoritos: new FavoritosController({ useCases }),
    alertas: new AlertasController({ useCases }),
    notificacoes: new NotificacoesController({ useCases }),
    ativos: new AtivosController({ useCases }),
    ideias: new IdeiasController({ useCases }),
    health: new HealthController({ pool, redis, filas, estado, versao: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local' }),
  };
  const mw = {
    auth: authMiddleware(tokenService),
    rl: criarRateLimiters({ redis, desabilitado: !env.RATE_LIMIT_ENABLED }),
    validateInput,
    csrf: csrfProtection({ seguro: env.COOKIE_SECURE }),
    idempotency: idempotency({ redis, logger }),
    audit: (acao, extrair) => auditLogger(auditLog, acao, extrair),
  };

  async function encerrar() {
    await Promise.allSettled(Object.values(filas).map((f) => f.close()));
    encerrarCircuitos();
    await Promise.allSettled([pool.end(), redis.quit(), bullConnection.quit()]);
  }

  return {
    env, logger, pool, redis, bullConnection, filas, metrics, cache, marketData, tokenService,
    emailService, notificador, repos, ativoRepository, useCases, controllers, mw, estado, encerrar,
  };
}

module.exports = { criarContainer };

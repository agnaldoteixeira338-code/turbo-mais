const { z } = require('zod');

// Em produção as variáveis vêm do ambiente (Render). O .env é só conveniência local.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ quiet: true });
}

const booleano = (padrao) =>
  z
    .enum(['true', 'false'])
    .default(padrao)
    .transform((v) => v === 'true');

const segredo = (nome) =>
  z.string({ required_error: `${nome} é obrigatório` }).min(32, `${nome} precisa de ao menos 32 caracteres`);

// Painéis de hospedagem aceitam o valor com aspas coladas por engano
// ("rediss://..."): removemos aspas e espaços nas pontas antes de validar.
const semAspas = (v) => (typeof v === 'string' ? v.trim().replace(/^(['"])(.*)\1$/, '$2').trim() : v);

const urlDeConexao = (nome, protocolos) =>
  z.preprocess(
    semAspas,
    z.string().refine((v) => protocolos.some((p) => v.startsWith(p)), {
      message: `${nome} deve começar com ${protocolos.join(' ou ')} (sem aspas)`,
    }),
  );

/**
 * FAIL FAST: configuração inválida derruba o processo NA INICIALIZAÇÃO, com
 * mensagem clara — e não às 3h da manhã, na primeira requisição que precisar
 * do valor. Também é a documentação viva de toda variável que a API lê.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3334),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  DATABASE_URL: urlDeConexao('DATABASE_URL', ['postgres://', 'postgresql://']),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: booleano('false'),

  REDIS_URL: urlDeConexao('REDIS_URL', ['redis://', 'rediss://']).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: segredo('JWT_ACCESS_SECRET'),
  JWT_RESET_SECRET: segredo('JWT_RESET_SECRET'),
  JWT_2FA_SECRET: segredo('JWT_2FA_SECRET'),
  CODE_HMAC_SECRET: segredo('CODE_HMAC_SECRET'),
  JWT_ISSUER: z.string().default('turbo-mais-api'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: booleano('false'),

  EMAIL_FROM: z.string().default('Turbo Mais <nao-responda@turbomais.dev>'),
  RESEND_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleano('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  MARKET_DATA_MODE: z.enum(['live', 'mock']).default('live'),
  MARKET_DATA_FALLBACK_SIMULADO: booleano('false'),
  BRAPI_TOKEN: z.string().optional(),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  CACHE_STALE_SECONDS: z.coerce.number().int().positive().default(600),

  PRICE_WATCH_INTERVAL_MS: z.coerce.number().int().min(10_000).default(60_000),
  RUN_WORKERS_IN_PROCESS: booleano('false'),
  ALERTA_JANELA_MINUTOS: z.coerce.number().int().positive().default(60),

  // Conta usada pelo botão "Entrar como visitante". Vazio = recurso desligado.
  DEMO_USER_EMAIL: z
    .string()
    .default('demo@turbomais.dev')
    .transform((v) => v.trim() || null)
    .refine((v) => v === null || z.string().email().safeParse(v).success, 'DEMO_USER_EMAIL deve ser um e-mail válido'),

  RATE_LIMIT_ENABLED: booleano('true'),
  SWAGGER_ENABLED: booleano('true'),
  METRICS_TOKEN: z.string().optional(),
});

function carregarEnv(fonte = process.env) {
  const resultado = schema.safeParse(fonte);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // console.error de propósito: o logger ainda não existe neste ponto
    console.error(`\n❌ Configuração inválida:\n${problemas}\n`);
    throw new Error('Configuração de ambiente inválida');
  }
  const env = resultado.data;
  if (env.NODE_ENV === 'production') {
    if (!env.COOKIE_SECURE) throw new Error('COOKIE_SECURE deve ser true em produção');
    if (env.MARKET_DATA_FALLBACK_SIMULADO) throw new Error('MARKET_DATA_FALLBACK_SIMULADO não pode ser usado em produção');
  }
  return Object.freeze(env);
}

module.exports = { carregarEnv, schema };

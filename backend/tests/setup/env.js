// Variáveis de ambiente de TESTE. Valores fixos e fictícios — nunca segredos reais.
const padrao = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://turbo:turbo@localhost:5432/turbo_mais_test',
  REDIS_URL: 'redis://localhost:6379/1',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdefghijklmnop',
  JWT_RESET_SECRET: 'test-reset-secret-0123456789abcdefghijklmnopq',
  JWT_2FA_SECRET: 'test-2fa-secret-0123456789abcdefghijklmnopqrs',
  CODE_HMAC_SECRET: 'test-hmac-secret-0123456789abcdefghijklmnopq',
  BCRYPT_SALT_ROUNDS: '10',
  MARKET_DATA_MODE: 'mock',
  RATE_LIMIT_ENABLED: 'false',
  FRONTEND_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
};

for (const [chave, valor] of Object.entries(padrao)) {
  if (process.env[chave] === undefined) process.env[chave] = valor;
}

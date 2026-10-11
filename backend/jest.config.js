/**
 * Projetos de teste separados — cada um roda num estágio diferente do CI:
 *   unit        sem I/O (fakes em memória) → rápido, roda em todo commit
 *   contract    schemas das APIs externas contra fixtures (e opcionalmente ao vivo)
 *   integration HTTP real (Supertest) + Postgres + Redis reais (serviços do CI)
 *   e2e         jornada completa do usuário pela API
 */
const base = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  clearMocks: true,
};

module.exports = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.js'] },
    { ...base, displayName: 'contract', testMatch: ['<rootDir>/tests/contract/**/*.test.js'] },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      globalSetup: '<rootDir>/tests/setup/globalSetup.js',
    },
    {
      ...base,
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      globalSetup: '<rootDir>/tests/setup/globalSetup.js',
    },
  ],
  // Cobertura medida sobre o NÚCLEO (domínio + aplicação + utilitários + resiliência):
  // é onde mora a regra de negócio. Adaptadores de I/O são cobertos pela integração.
  collectCoverageFrom: [
    'src/domain/**/*.js',
    'src/application/**/*.js',
    'src/shared/**/*.js',
    'src/infrastructure/cache/CacheService.js',
    'src/infrastructure/resilience/**/*.js',
    'src/infrastructure/external-apis/MarketDataGateway.js',
    'src/infrastructure/external-apis/mockMarketData.js',
    'src/infrastructure/security/**/*.js',
    'src/interfaces/http/middlewares/**/*.js',
    '!src/**/repositories/*Repository.js',
    '!src/domain/repositories/**',
    '!src/application/ports/**',
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 75, functions: 80, lines: 80 },
  },
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
};

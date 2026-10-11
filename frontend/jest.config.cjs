module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.{js,jsx}'],
  moduleNameMapper: {
    // import.meta.env não existe no Jest: o módulo de config é trocado por um stub
    '^(\\.{1,2}/)+config/env(\\.js)?$': '<rootDir>/tests/stubs/env.js',
    '\\.(css)$': 'identity-obj-proxy',
    '^@fontsource-variable/.*$': 'identity-obj-proxy',
  },
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/main.jsx', '!src/config/env.js'],
};

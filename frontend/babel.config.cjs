// Usado SOMENTE pelo Jest (o Vite usa esbuild). Transpila JSX/ESM para os testes.
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};

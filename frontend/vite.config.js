import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Em desenvolvimento, o Vite faz PROXY de /api e /socket.io para a API.
 * Assim front e API ficam na MESMA ORIGEM — o cookie de refresh pode ser
 * SameSite=Strict e não precisamos de CORS com credenciais no dia a dia.
 * O mesmo papel é do Nginx no Docker e do rewrite da Vercel em produção.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3333', changeOrigin: false },
      '/socket.io': { target: 'http://localhost:3333', ws: true },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Recharts é pesado: chunk separado, baixado só nas telas com gráfico
        manualChunks: { recharts: ['recharts'], vendor: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
});

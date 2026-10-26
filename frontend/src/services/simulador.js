import { api } from './api';

export const simuladorService = {
  taxas: () => api('/simulador/taxas').then((r) => r.data),

  /** Não grava nada no servidor: só calcula (sem Idempotency-Key). */
  simular: ({ valorInicial, aporteMensal, prazoMeses }, { signal } = {}) =>
    api('/simulador', { method: 'POST', body: { valorInicial, aporteMensal, prazoMeses }, signal }).then((r) => r.data),
};

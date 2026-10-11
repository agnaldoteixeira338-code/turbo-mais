import { api } from './api';

export const ideiaService = {
  enviar: (texto) => api('/ideias', { method: 'POST', body: { texto }, idempotente: true }).then((r) => r.data),
  listar: ({ page = 1, limit = 10 } = {}) => api(`/ideias?page=${page}&limit=${limit}`),
};

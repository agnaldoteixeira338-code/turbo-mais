import { api } from './api';

export const favoritosService = {
  listar: ({ tipo, page = 1, limit = 100 } = {}) => {
    const q = new URLSearchParams({ page, limit, ...(tipo ? { tipo } : {}) });
    return api(`/favoritos?${q}`);
  },
  adicionar: (ticker) => api('/favoritos', { method: 'POST', body: { ticker }, idempotente: true }).then((r) => r.data),
  remover: (ticker) => api(`/favoritos/${encodeURIComponent(ticker)}`, { method: 'DELETE' }),
};

export const ativosService = {
  listarPorCategoria: (categoria, { q, page = 1, limit = 50 } = {}, signal) => {
    const params = new URLSearchParams({ page, limit, ...(q ? { q } : {}) });
    return api(`/ativos/${categoria}?${params}`, { signal });
  },
  buscar: ({ q, tipo, page = 1, limit = 20 } = {}, signal) => {
    const params = new URLSearchParams({ page, limit, ...(q ? { q } : {}), ...(tipo ? { tipo } : {}) });
    return api(`/ativos?${params}`, { signal });
  },
  detalhar: (ticker, dias = 30) => api(`/ativos/${encodeURIComponent(ticker)}?dias=${dias}`).then((r) => r.data),
};

export const alertasService = {
  listar: () => api('/alertas?limit=100'),
  criar: ({ ticker, gatilhoPercentual, direcao }) => api('/alertas', { method: 'POST', body: { ticker, gatilhoPercentual, direcao }, idempotente: true }).then((r) => r.data),
  atualizar: (id, campos) => api(`/alertas/${id}`, { method: 'PUT', body: campos }).then((r) => r.data),
  remover: (id) => api(`/alertas/${id}`, { method: 'DELETE' }),
};

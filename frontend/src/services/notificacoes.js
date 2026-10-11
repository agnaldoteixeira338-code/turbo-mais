import { api } from './api';

export const notificacoesService = {
  listar: ({ page = 1, limit = 20, naoLidas = false } = {}) =>
    api(`/notificacoes?${new URLSearchParams({ page, limit, ...(naoLidas ? { naoLidas: 'true' } : {}) })}`),
  marcarComoLida: (id) => api(`/notificacoes/${id}/lida`, { method: 'PATCH' }).then((r) => r.data),
};

/**
 * Notification API do navegador. A permissão só pode ser pedida a partir de
 * um gesto do usuário (clique) — pedir no carregamento é bloqueado e irrita.
 */
export const notificacaoNavegador = {
  suportada: () => typeof window !== 'undefined' && 'Notification' in window,
  permissao: () => (notificacaoNavegador.suportada() ? Notification.permission : 'denied'),
  async pedirPermissao() {
    if (!notificacaoNavegador.suportada()) return 'denied';
    return Notification.requestPermission();
  },
  exibir({ titulo, corpo, tag }) {
    if (notificacaoNavegador.permissao() !== 'granted' || document.visibilityState === 'visible') return;
    try {
      new Notification(titulo, { body: corpo, tag, icon: '/favicon.svg' });
    } catch {
      /* alguns navegadores móveis só permitem via Service Worker */
    }
  },
};

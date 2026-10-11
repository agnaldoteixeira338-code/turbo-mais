import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { notificacoesService, notificacaoNavegador } from '../services/notificacoes';
import { MODOS } from '../services/socket';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { percentual } from '../utils/formatar';

export const NotificacoesContext = createContext(null);
const INTERVALO_POLLING_MS = 30_000;

/**
 * Notificações de alertas: chegam pelo socket em tempo real; se o socket
 * degradar para REST, buscamos periodicamente. A fonte da verdade é sempre
 * a API (o socket só "avisa antes").
 */
export function NotificacoesProvider({ children }) {
  const { autenticado } = useAuth();
  const { socket, modo } = useSocket();
  const [notificacoes, setNotificacoes] = useState([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [permissao, setPermissao] = useState(notificacaoNavegador.permissao());

  const carregar = useCallback(async () => {
    try {
      const { data, meta } = await notificacoesService.listar({ limit: 30 });
      setNotificacoes(data);
      setNaoLidas(meta?.naoLidas ?? 0);
    } catch {
      /* mantém o que já temos; nova tentativa no próximo ciclo */
    }
  }, []);

  useEffect(() => {
    if (autenticado) carregar();
    else {
      setNotificacoes([]);
      setNaoLidas(0);
    }
  }, [autenticado, carregar]);

  // Tempo real
  useEffect(() => {
    if (!socket) return undefined;
    const aoChegar = (n) => {
      setNotificacoes((atual) => (atual.some((x) => x.id === n.id) ? atual : [n, ...atual]));
      setNaoLidas((v) => v + 1);
      setToasts((atual) => [...atual, n].slice(-3));
      notificacaoNavegador.exibir({
        titulo: `${n.direcao === 'alta' ? '📈' : '📉'} ${n.ticker} ${percentual(n.variacao)}`,
        corpo: 'Seu alerta do Turbo Mais foi disparado.',
        tag: n.id,
      });
    };
    socket.on('notificacao', aoChegar);
    return () => socket.off('notificacao', aoChegar);
  }, [socket]);

  // Fallback: polling REST quando o tempo real não está disponível
  useEffect(() => {
    if (!autenticado || modo !== MODOS.REST_POLLING) return undefined;
    const id = setInterval(carregar, INTERVALO_POLLING_MS);
    return () => clearInterval(id);
  }, [autenticado, modo, carregar]);

  const marcarComoLida = useCallback(async (id) => {
    setNotificacoes((atual) => atual.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    setNaoLidas((v) => Math.max(0, v - 1));
    try {
      await notificacoesService.marcarComoLida(id);
    } catch {
      carregar(); // reconcilia com o servidor
    }
  }, [carregar]);

  const dispensarToast = useCallback((id) => setToasts((atual) => atual.filter((t) => t.id !== id)), []);
  const pedirPermissao = useCallback(async () => setPermissao(await notificacaoNavegador.pedirPermissao()), []);

  const valor = useMemo(
    () => ({ notificacoes, naoLidas, toasts, permissao, carregar, marcarComoLida, dispensarToast, pedirPermissao }),
    [notificacoes, naoLidas, toasts, permissao, carregar, marcarComoLida, dispensarToast, pedirPermissao],
  );
  return <NotificacoesContext.Provider value={valor}>{children}</NotificacoesContext.Provider>;
}

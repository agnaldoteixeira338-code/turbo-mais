import { createContext, useEffect, useMemo, useState } from 'react';
import { criarConexaoTempoReal, MODOS } from '../services/socket';
import { obterAccessToken, renovarSessao } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export const SocketContext = createContext(null);

/** Mantém UMA conexão Socket.IO por sessão autenticada. */
export function SocketProvider({ children }) {
  const { autenticado } = useAuth();
  const [socket, setSocket] = useState(null);
  const [modo, setModo] = useState(MODOS.CONECTANDO);

  useEffect(() => {
    if (!autenticado) return undefined;
    const s = criarConexaoTempoReal({ obterToken: obterAccessToken, renovarToken: renovarSessao, aoMudarModo: setModo });
    s.connect();
    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      setModo(MODOS.CONECTANDO);
    };
  }, [autenticado]);

  const valor = useMemo(() => ({ socket, modo, tempoReal: modo === MODOS.WEBSOCKET || modo === MODOS.LONG_POLLING }), [socket, modo]);
  return <SocketContext.Provider value={valor}>{children}</SocketContext.Provider>;
}

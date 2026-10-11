import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { favoritosService } from '../services/favoritos';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';

export const FavoritosContext = createContext(null);

/**
 * Watchlist do usuário + cotações ao vivo dos favoritos.
 *
 * - Atualização OTIMISTA: a estrela acende na hora; se a API falhar,
 *   desfazemos e mostramos o erro (UX rápida sem mentir para o usuário).
 * - Assina as rooms `ticker:X` no socket para receber cotações em tempo real.
 */
export function FavoritosProvider({ children }) {
  const { autenticado } = useAuth();
  const { socket } = useSocket();
  const [itens, setItens] = useState([]);
  const [tickers, setTickers] = useState(() => new Set());
  const [cotacoesAoVivo, setCotacoesAoVivo] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const pendentes = useRef(new Set());

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await favoritosService.listar();
      setItens(data);
      setTickers(new Set(data.map((f) => f.ticker)));
      setErro(null);
    } catch (e) {
      setErro(e);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (autenticado) recarregar();
    else {
      setItens([]);
      setTickers(new Set());
    }
  }, [autenticado, recarregar]);

  // Assina as cotações dos favoritos (e reassina quando a lista ou o socket mudam)
  useEffect(() => {
    if (!socket) return undefined;
    const assinar = () => socket.emit('assinar', [...tickers]);
    const aoReceber = (c) => setCotacoesAoVivo((atual) => ({ ...atual, [c.ticker]: c }));
    socket.on('connect', assinar);
    socket.on('cotacao', aoReceber);
    if (socket.connected) assinar();
    return () => {
      socket.off('connect', assinar);
      socket.off('cotacao', aoReceber);
    };
  }, [socket, tickers]);

  const alternar = useCallback(
    async (ticker) => {
      if (pendentes.current.has(ticker)) return; // evita duplo clique
      pendentes.current.add(ticker);
      const eraFavorito = tickers.has(ticker);
      const aplicar = (favoritar) =>
        setTickers((atual) => {
          const novo = new Set(atual);
          if (favoritar) novo.add(ticker);
          else novo.delete(ticker);
          return novo;
        });

      aplicar(!eraFavorito);
      try {
        if (eraFavorito) {
          await favoritosService.remover(ticker);
          setItens((atual) => atual.filter((f) => f.ticker !== ticker));
        } else {
          await favoritosService.adicionar(ticker);
          recarregar();
        }
        setErro(null);
      } catch (e) {
        aplicar(eraFavorito); // rollback
        setErro(e);
        throw e;
      } finally {
        pendentes.current.delete(ticker);
      }
    },
    [tickers, recarregar],
  );

  const valor = useMemo(
    () => ({ itens, tickers, cotacoesAoVivo, carregando, erro, alternar, recarregar, ehFavorito: (t) => tickers.has(t) }),
    [itens, tickers, cotacoesAoVivo, carregando, erro, alternar, recarregar],
  );
  return <FavoritosContext.Provider value={valor}>{children}</FavoritosContext.Provider>;
}
